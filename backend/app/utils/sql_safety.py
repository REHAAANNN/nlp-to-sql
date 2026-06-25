import re

from app.utils.exceptions import UnsafeQueryError


BLOCKED_PATTERNS = [
    r"\bdrop\b",
    r"\bdrop\s+database\b",
    r"\bdrop\s+schema\b",
    r"\btruncate\b",
    r"\balter\s+system\b",
    r"\bcopy\b.+\bprogram\b",
    r"\bxp_cmdshell\b",
    r"\bload_file\s*\(",
    r"\binto\s+outfile\b",
    r"\bshutdown\b",
    r"\bgrant\s+all\b",
    r"\brevoke\s+all\b",
]

DESTRUCTIVE_STATEMENTS = {"UPDATE", "DELETE"}
WRITE_STATEMENTS = {"INSERT", "UPDATE", "DELETE"}


def normalize_sql(sql: str) -> str:
    return sql.strip().rstrip(";").strip()


def statement_type(sql: str) -> str:
    cleaned = re.sub(r"^\s*(--[^\n]*\n|/\*.*?\*/\s*)*", "", sql, flags=re.DOTALL)
    match = re.match(r"([a-zA-Z]+)", cleaned.strip())
    return match.group(1).upper() if match else "UNKNOWN"


def contains_multiple_statements(sql: str) -> bool:
    body = sql.strip()
    if body.endswith(";"):
        body = body[:-1]
    return ";" in body


def has_where_clause(sql: str) -> bool:
    return bool(re.search(r"\bwhere\b", sql, flags=re.IGNORECASE))


def validate_sql_safety(sql: str, *, confirm_destructive: bool = False) -> list[str]:
    normalized = normalize_sql(sql)
    lowered = normalized.lower()
    warnings: list[str] = []

    if not normalized:
        raise UnsafeQueryError("Query cannot be empty")

    if contains_multiple_statements(normalized):
        raise UnsafeQueryError("Multiple SQL statements are not allowed")

    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, lowered, flags=re.IGNORECASE | re.DOTALL):
            raise UnsafeQueryError(f"Blocked unsafe SQL pattern: {pattern}")

    kind = statement_type(normalized)
    if kind in DESTRUCTIVE_STATEMENTS and not confirm_destructive:
        raise UnsafeQueryError(f"{kind} queries require confirm_destructive=true")

    if kind in DESTRUCTIVE_STATEMENTS and not has_where_clause(normalized):
        warnings.append(f"{kind} without WHERE can affect every row")

    if re.search(r"\bselect\s+\*", lowered):
        warnings.append("SELECT * can return too much data; prefer explicit columns")

    if lowered.count(" join ") >= 4:
        warnings.append("Query contains many joins and may be expensive")

    return warnings
