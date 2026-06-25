import json
import re
import urllib.error
import urllib.request
from typing import Any

from app.config.settings import get_settings
from app.utils.exceptions import AIServiceError


GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def _schema_text(schema: dict[str, Any]) -> str:
    lines: list[str] = []
    for table in schema.get("tables", []):
        columns = [
            str(column.get("name"))
            for column in table.get("columns", [])
            if isinstance(column, dict) and column.get("name")
        ]
        lines.append(f"{table.get('name')}({', '.join(columns)})")
    return "\n".join(lines)


def _extract_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            raise AIServiceError("Groq returned non-JSON content")
        return json.loads(match.group(0))


def _chat(messages: list[dict[str, str]], *, temperature: float = 0.1) -> dict[str, Any]:
    settings = get_settings()
    if not settings.groq_api_key:
        raise AIServiceError("GROQ_API_KEY is missing. Add it to backend/.env")

    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        GROQ_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SQL-AI-Assistant/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise AIServiceError(f"Groq request failed: {detail}") from exc
    except Exception as exc:
        raise AIServiceError(f"Groq request failed: {exc}") from exc

    content = data["choices"][0]["message"]["content"]
    return _extract_json(content)


def generate_sql(prompt: str, schema: dict[str, Any], dialect: str) -> dict[str, Any]:
    system_prompt = (
        "You are a senior database engineer inside an AI SQL assistant. "
        "Return JSON only. Generate safe SQL for the given dialect and schema. "
        "Never invent tables or columns. Prefer SELECT queries unless the user clearly asks to write data. "
        "If a user uses a generic field name, map it to the closest real column from the schema."
    )
    user_prompt = {
        "task": "Generate exactly 3 SQL query options and recommend the best one.",
        "natural_language_prompt": prompt,
        "sql_dialect": dialect,
        "database_schema_text": _schema_text(schema),
        "schema": schema,
        "constraints": [
            "Use only provided tables and columns.",
            "Before returning SQL, verify every table and column exists in database_schema_text.",
            "For INSERT statements, the column list must contain only real columns from the target table.",
            "Do not use generic columns like name when the schema has a more specific column like full_name.",
            "Return valid SQL only in the sql fields.",
            "Each sql field must contain exactly one SQL statement.",
            "Do not join multiple statements with semicolons.",
            "If the user asks to change multiple tables, return one statement per query option.",
            "Use WHERE clauses for UPDATE and DELETE.",
            "Avoid SELECT * when specific columns are obvious.",
        ],
        "required_json_shape": {
            "queries": [
                {"sql": "string", "confidence": 0, "recommended": False, "explanation": "string"}
            ],
            "best_query": "string",
        },
    }
    return _chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_prompt)},
        ],
        temperature=0.15,
    )


def explain_sql(sql: str, schema: dict[str, Any] | None = None) -> dict[str, Any]:
    system_prompt = "Explain SQL in clear English. Return JSON only."
    user_prompt = {
        "task": "Explain this SQL query.",
        "sql": sql,
        "schema": schema or {},
        "required_json_shape": {
            "explanation": "string",
            "joins_used": ["string"],
            "filters_used": ["string"],
            "aggregations_used": ["string"],
        },
    }
    return _chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_prompt)},
        ],
        temperature=0.05,
    )


def recommend_query(queries: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not queries:
        return None
    recommended = [query for query in queries if query.get("recommended")]
    return max(recommended or queries, key=lambda query: int(query.get("confidence", 0)))
