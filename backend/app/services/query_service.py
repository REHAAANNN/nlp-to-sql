from time import perf_counter
from typing import Any
import re

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.ai import groq_service
from app.config.settings import get_settings
from app.db.connection_manager import connection_manager
from app.db.mongo import mongo_store
from app.schemas.query import (
    AnalyzeImpactResponse,
    ExecuteQueryResponse,
    ExplainQueryResponse,
    GenerateQueryResponse,
    QueryOption,
)
from app.services.schema_service import schema_for_prompt
from app.utils.exceptions import AIServiceError, AppError
from app.utils.sql_parser import extract_aggregations, extract_filters, extract_joins
from app.utils.sql_safety import normalize_sql, statement_type, validate_sql_safety


def _quote_identifier(name: str, state: Any) -> str:
    return state.engine.dialect.identifier_preparer.quote(name)


def _unquote_identifier(name: str) -> str:
    return name.strip().strip('"`[]')


def _schema_column_map(schema: dict[str, Any]) -> dict[str, set[str]]:
    tables: dict[str, set[str]] = {}
    for table in schema.get("tables", []):
        table_name = str(table.get("name", ""))
        if not table_name:
            continue
        tables[table_name.lower()] = {
            str(column.get("name"))
            for column in table.get("columns", [])
            if isinstance(column, dict) and column.get("name")
        }
    return tables


def _column_alias_score(requested: str, candidate: str) -> int:
    req = requested.lower().replace("_", "")
    cand = candidate.lower().replace("_", "")
    if req == cand:
        return 100
    if req == "name" and cand.endswith("name") and not cand.endswith("id"):
        return 95
    if req in cand:
        return 80
    if cand in req:
        return 70
    return 0


def _closest_column(requested: str, candidates: set[str]) -> str | None:
    ranked = sorted(
        ((column, _column_alias_score(requested, column)) for column in candidates),
        key=lambda item: item[1],
        reverse=True,
    )
    if not ranked or ranked[0][1] < 70:
        return None
    return ranked[0][0]


def _repair_schema_identifiers(sql: str, schema: dict[str, Any], state: Any) -> tuple[str, list[str]]:
    table_columns = _schema_column_map(schema)
    warnings: list[str] = []

    def repair_insert(match: re.Match[str]) -> str:
        table_token = match.group("table")
        table_name = _unquote_identifier(table_token.split(".")[-1])
        columns = [_unquote_identifier(column) for column in match.group("columns").split(",")]
        real_columns = table_columns.get(table_name.lower())
        if not real_columns:
            warnings.append(f"Unknown table in generated INSERT: {table_name}")
            return match.group(0)

        repaired_columns: list[str] = []
        for column in columns:
            if column in real_columns:
                repaired_columns.append(column)
                continue
            replacement = _closest_column(column, real_columns)
            if not replacement:
                warnings.append(f"Unknown column in generated INSERT for {table_name}: {column}")
                repaired_columns.append(column)
                continue
            warnings.append(f"Replaced nonexistent column {table_name}.{column} with {table_name}.{replacement}")
            repaired_columns.append(replacement)

        quoted = ", ".join(_quote_identifier(column, state) for column in repaired_columns)
        return f"INSERT INTO {_quote_identifier(table_name, state)} ({quoted})"

    def repair_update(match: re.Match[str]) -> str:
        table_token = match.group("table")
        table_name = _unquote_identifier(table_token.split(".")[-1])
        assignments = match.group("assignments")
        real_columns = table_columns.get(table_name.lower())
        if not real_columns:
            warnings.append(f"Unknown table in generated UPDATE: {table_name}")
            return match.group(0)

        def repair_assignment(assignment_match: re.Match[str]) -> str:
            column = _unquote_identifier(assignment_match.group("column"))
            if column in real_columns:
                return assignment_match.group(0)
            replacement = _closest_column(column, real_columns)
            if not replacement:
                warnings.append(f"Unknown column in generated UPDATE for {table_name}: {column}")
                return assignment_match.group(0)
            warnings.append(f"Replaced nonexistent column {table_name}.{column} with {table_name}.{replacement}")
            return f"{_quote_identifier(replacement, state)} ="

        repaired_assignments = re.sub(
            r"(?P<column>[A-Za-z_][\w]*|\"[^\"]+\"|`[^`]+`)\s*=",
            repair_assignment,
            assignments,
        )
        return f"UPDATE {_quote_identifier(table_name, state)} SET {repaired_assignments}"

    repaired = re.sub(
        r"\bINSERT\s+INTO\s+(?P<table>[A-Za-z_][\w.]*|\"[^\"]+\"|`[^`]+`)\s*\((?P<columns>[^)]+)\)",
        repair_insert,
        sql,
        flags=re.IGNORECASE,
    )
    repaired = re.sub(
        r"\bUPDATE\s+(?P<table>[A-Za-z_][\w.]*|\"[^\"]+\"|`[^`]+`)\s+SET\s+(?P<assignments>.+?)(?=\bWHERE\b|$)",
        repair_update,
        repaired,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return repaired, warnings


def _has_schema_identifier_errors(sql: str, schema: dict[str, Any]) -> bool:
    table_columns = _schema_column_map(schema)

    for match in re.finditer(
        r"\bINSERT\s+INTO\s+(?P<table>[A-Za-z_][\w.]*|\"[^\"]+\"|`[^`]+`)\s*\((?P<columns>[^)]+)\)",
        sql,
        flags=re.IGNORECASE,
    ):
        table_name = _unquote_identifier(match.group("table").split(".")[-1])
        real_columns = table_columns.get(table_name.lower())
        if not real_columns:
            return True
        columns = [_unquote_identifier(column) for column in match.group("columns").split(",")]
        if any(column not in real_columns for column in columns):
            return True

    for match in re.finditer(
        r"\bUPDATE\s+(?P<table>[A-Za-z_][\w.]*|\"[^\"]+\"|`[^`]+`)\s+SET\s+(?P<assignments>.+?)(?=\bWHERE\b|$)",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        table_name = _unquote_identifier(match.group("table").split(".")[-1])
        real_columns = table_columns.get(table_name.lower())
        if not real_columns:
            return True
        for assignment in re.finditer(r"(?P<column>[A-Za-z_][\w]*|\"[^\"]+\"|`[^`]+`)\s*=", match.group("assignments")):
            if _unquote_identifier(assignment.group("column")) not in real_columns:
                return True

    return False


def _coerce_confidence(value: Any, index: int) -> int:
    try:
        confidence = int(value)
    except (TypeError, ValueError):
        confidence = 0
    if confidence <= 0:
        return max(55, 92 - (index * 8))
    return min(100, max(1, confidence))


def _with_postgres_returning(sql: str, state: Any) -> str:
    kind = statement_type(sql)
    if state.db_type.value != "postgresql" or kind not in {"INSERT", "UPDATE", "DELETE"}:
        return sql
    if re.search(r"\breturning\b", sql, flags=re.IGNORECASE):
        return sql
    return f"{normalize_sql(sql)} RETURNING *"


def _table_matches_prompt(table_name: str, prompt: str) -> bool:
    normalized_prompt = prompt.lower()
    normalized_table = table_name.lower()
    singular = normalized_table[:-1] if normalized_table.endswith("s") else normalized_table

    prompt_words = set(normalized_prompt.replace("_", " ").split())
    table_words = set(normalized_table.replace("_", " ").split())

    return (
        normalized_table in normalized_prompt
        or singular in prompt_words
        or bool(table_words & prompt_words)
    )


def _fallback_generate_sql(prompt: str, schema: dict[str, Any], state: Any, reason: str) -> GenerateQueryResponse:
    tables = schema.get("tables", [])
    if not tables:
        raise AIServiceError(f"Groq is unavailable and no schema tables were found. Original error: {reason}")

    matched = [table for table in tables if _table_matches_prompt(str(table.get("name", "")), prompt)]
    target = matched[0] if matched else tables[0]
    table_name = str(target["name"])
    columns = [
        str(column["name"])
        for column in target.get("columns", [])
        if isinstance(column, dict) and column.get("name")
    ]
    selected_columns = columns[:12] or ["*"]
    column_sql = ", ".join(
        "*" if column == "*" else _quote_identifier(column, state)
        for column in selected_columns
    )
    table_sql = _quote_identifier(table_name, state)
    lowered_prompt = prompt.lower()

    select_sql = f"SELECT {column_sql}\nFROM {table_sql}\nLIMIT 100;"
    count_sql = f"SELECT COUNT(*) AS total\nFROM {table_sql};"
    best_query = count_sql if any(word in lowered_prompt for word in ["count", "how many", "total"]) else select_sql

    options = [
        QueryOption(
            sql=best_query,
            confidence=68,
            recommended=True,
            explanation=(
                "Groq is unavailable, so this was generated locally from the connected schema. "
                f"It uses the real {table_name} table and does not invent columns."
            ),
        ),
        QueryOption(
            sql=count_sql if best_query != count_sql else select_sql,
            confidence=58,
            recommended=False,
            explanation=f"Alternative schema-based query for the real {table_name} table.",
        ),
    ]

    for table in tables:
        other_name = str(table.get("name", ""))
        if other_name and other_name != table_name:
            other_columns = [
                str(column["name"])
                for column in table.get("columns", [])
                if isinstance(column, dict) and column.get("name")
            ][:8]
            other_sql = (
                f"SELECT {', '.join(_quote_identifier(column, state) for column in other_columns) or '*'}\n"
                f"FROM {_quote_identifier(other_name, state)}\nLIMIT 100;"
            )
            options.append(
                QueryOption(
                    sql=other_sql,
                    confidence=42,
                    recommended=False,
                    explanation=f"Another real table found in the connected schema: {other_name}.",
                )
            )
            break

    return GenerateQueryResponse(queries=options[:3], best_query=best_query)


def _split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    quote: str | None = None
    index = 0

    while index < len(sql):
        char = sql[index]
        current.append(char)

        if quote:
            if char == quote:
                if index + 1 < len(sql) and sql[index + 1] == quote:
                    current.append(sql[index + 1])
                    index += 1
                else:
                    quote = None
        elif char in {"'", '"'}:
            quote = char
        elif char == ";":
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []

        index += 1

    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def _query_options_from_ai_result(result: dict[str, Any], schema: dict[str, Any], state: Any) -> list[QueryOption]:
    options: list[QueryOption] = []
    seen: set[str] = set()

    for index, item in enumerate(result.get("queries", [])):
        base_confidence = _coerce_confidence(item.get("confidence"), index)
        explanation = item.get("explanation")
        statements = _split_sql_statements(str(item.get("sql", "")))

        for statement in statements:
            statement, schema_warnings = _repair_schema_identifiers(statement, schema, state)
            statement = _with_postgres_returning(statement, state)
            normalized = normalize_sql(statement)
            if not normalized or normalized in seen or _has_schema_identifier_errors(normalized, schema):
                continue
            seen.add(normalized)
            if schema_warnings:
                warning_text = "; ".join(schema_warnings)
                explanation = f"{explanation or 'Generated from connected schema.'} Schema check: {warning_text}."
            options.append(
                QueryOption(
                    sql=f"{normalized};",
                    confidence=base_confidence,
                    recommended=bool(item.get("recommended", False)) and len(options) == 0,
                    explanation=explanation,
                )
            )
            if len(options) >= 3:
                return options

    return options


def generate_queries(prompt: str, connection_id: str | None = None, *, user_id: str | None = None) -> GenerateQueryResponse:
    state = connection_manager.get(connection_id)
    connection_manager.clear_schema_cache(str(state.connection_id))
    schema = schema_for_prompt(str(state.connection_id))
    try:
        result = groq_service.generate_sql(prompt, schema, state.db_type.value)
    except AIServiceError as exc:
        fallback = _fallback_generate_sql(prompt, schema, state, exc.message)
        mongo_store.save_history(
            {
                "prompt": prompt,
                "generated_queries": [item.model_dump() for item in fallback.queries],
                "selected_query": fallback.best_query,
                "metadata": {
                    "connection_id": str(state.connection_id),
                    "db_type": state.db_type.value,
                    "ai_fallback": True,
                    "ai_error": exc.message,
                },
                "user_id": user_id,
            }
        )
        return fallback

    options = _query_options_from_ai_result(result, schema, state)
    if not options:
        fallback = _fallback_generate_sql(prompt, schema, state, "Groq generated SQL with tables or columns outside the connected schema")
        mongo_store.save_history(
            {
                "prompt": prompt,
                "generated_queries": [item.model_dump() for item in fallback.queries],
                "selected_query": fallback.best_query,
                "metadata": {
                    "connection_id": str(state.connection_id),
                    "db_type": state.db_type.value,
                    "schema_validation_fallback": True,
                },
                "user_id": user_id,
            }
        )
        return fallback
    best_query = result.get("best_query") or (groq_service.recommend_query([item.model_dump() for item in options]) or {}).get("sql")
    option_sql = {normalize_sql(option.sql) for option in options}
    if best_query and (len(_split_sql_statements(best_query)) > 1 or normalize_sql(best_query) not in option_sql):
        best_query = options[0].sql if options else None

    mongo_store.save_history(
        {
            "prompt": prompt,
            "generated_queries": [item.model_dump() for item in options],
            "selected_query": best_query,
            "metadata": {"connection_id": str(state.connection_id), "db_type": state.db_type.value},
            "user_id": user_id,
        }
    )
    return GenerateQueryResponse(queries=options, best_query=best_query)


def explain_query(sql: str, connection_id: str | None = None) -> ExplainQueryResponse:
    schema = None
    try:
        state = connection_manager.get(connection_id)
        schema = schema_for_prompt(str(state.connection_id))
        result = groq_service.explain_sql(sql, schema)
        return ExplainQueryResponse(
            explanation=result.get("explanation", "No explanation returned."),
            joins_used=result.get("joins_used", []),
            filters_used=result.get("filters_used", []),
            aggregations_used=result.get("aggregations_used", []),
        )
    except Exception:
        joins = extract_joins(sql)
        filters = extract_filters(sql)
        aggregations = extract_aggregations(sql)
        return ExplainQueryResponse(
            explanation="This query reads or modifies data based on the selected tables, filters, joins, and aggregations.",
            joins_used=joins,
            filters_used=filters,
            aggregations_used=aggregations,
        )


def _explain_sql_for_dialect(sql: str, db_type: str) -> str:
    normalized = normalize_sql(sql)
    if db_type == "postgresql":
        return f"EXPLAIN (FORMAT JSON) {normalized}"
    return f"EXPLAIN {normalized}"


def analyze_impact(sql: str, connection_id: str | None = None) -> AnalyzeImpactResponse:
    state = connection_manager.get(connection_id)
    warnings = validate_sql_safety(sql, confirm_destructive=True)
    kind = statement_type(sql)
    risk = "low"
    query_cost: str | None = None
    rows_affected: int | None = None
    explain_rows: list[dict[str, Any]] | list[str] = []

    if kind in {"UPDATE", "DELETE"}:
        risk = "medium"
    if any("without WHERE" in warning for warning in warnings):
        risk = "high"

    try:
        with state.engine.connect() as connection:
            result = connection.execute(text(_explain_sql_for_dialect(sql, state.db_type.value)))
            raw_rows = result.fetchall()
            if state.db_type.value == "postgresql" and raw_rows:
                explain_rows = raw_rows[0][0]
                plan = explain_rows[0].get("Plan", {}) if isinstance(explain_rows, list) else {}
                rows_affected = plan.get("Plan Rows")
                total_cost = plan.get("Total Cost")
                query_cost = str(total_cost) if total_cost is not None else None
                if plan.get("Total Cost", 0) > 10000:
                    risk = "high"
            else:
                explain_rows = [dict(row._mapping) for row in raw_rows]
                row_values = [
                    int(row.get("rows", 0))
                    for row in explain_rows
                    if isinstance(row, dict) and str(row.get("rows", "")).isdigit()
                ]
                rows_affected = max(row_values) if row_values else None
    except Exception as exc:
        warnings.append(f"EXPLAIN failed: {exc}")

    if kind == "SELECT" and "SELECT * can return too much data; prefer explicit columns" in warnings:
        risk = "medium"

    return AnalyzeImpactResponse(
        rows_affected=rows_affected,
        risk=risk,
        query_cost=query_cost or risk,
        warnings=warnings,
        explain=explain_rows,
    )


def execute_query(sql: str, connection_id: str | None = None, *, confirm_destructive: bool = False) -> ExecuteQueryResponse:
    state = connection_manager.get(connection_id)
    warnings = validate_sql_safety(sql, confirm_destructive=confirm_destructive)
    kind = statement_type(sql)
    normalized = normalize_sql(_with_postgres_returning(sql, state))
    start = perf_counter()
    max_rows = get_settings().max_result_rows

    try:
        with state.engine.begin() as connection:
            result = connection.execute(text(normalized))
            elapsed = (perf_counter() - start) * 1000

            if result.returns_rows:
                rows = result.fetchmany(max_rows + 1)
                truncated = len(rows) > max_rows
                rows = rows[:max_rows]
                columns = list(result.keys())
                affected = result.rowcount if result.rowcount is not None and result.rowcount >= 0 else len(rows)
                if kind in {"INSERT", "UPDATE", "DELETE"}:
                    connection_manager.clear_schema_cache(str(state.connection_id))
                return ExecuteQueryResponse(
                    columns=columns,
                    rows=[list(row) for row in rows],
                    row_count=affected,
                    execution_time_ms=round(elapsed, 2),
                    truncated=truncated,
                    message=f"{kind} executed successfully ({affected} rows affected)" + (" with warnings: " + "; ".join(warnings) if warnings else ""),
                )

            if kind in {"INSERT", "UPDATE", "DELETE"}:
                connection_manager.clear_schema_cache(str(state.connection_id))

            return ExecuteQueryResponse(
                columns=[],
                rows=[],
                row_count=result.rowcount if result.rowcount is not None else 0,
                execution_time_ms=round(elapsed, 2),
                truncated=False,
                message=f"{kind} executed successfully ({result.rowcount if result.rowcount is not None else 0} rows affected)" + (" with warnings: " + "; ".join(warnings) if warnings else ""),
            )
    except SQLAlchemyError as exc:
        original = getattr(exc, "orig", None)
        detail = str(original or exc).strip()
        raise AppError(f"Database rejected {kind}: {detail}", status_code=422) from exc
