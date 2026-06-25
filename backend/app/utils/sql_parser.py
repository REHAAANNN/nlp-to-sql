import re


def extract_filters(sql: str) -> list[str]:
    match = re.search(r"\bwhere\b(.+?)(\border\s+by\b|\bgroup\s+by\b|\blimit\b|$)", sql, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return []
    raw = match.group(1).strip()
    return [part.strip() for part in re.split(r"\band\b|\bor\b", raw, flags=re.IGNORECASE) if part.strip()]


def extract_joins(sql: str) -> list[str]:
    return [match.group(0).strip() for match in re.finditer(r"\b(?:inner|left|right|full|cross)?\s*join\s+[^\s]+", sql, flags=re.IGNORECASE)]


def extract_aggregations(sql: str) -> list[str]:
    functions = ["count", "sum", "avg", "min", "max"]
    found: list[str] = []
    for func in functions:
        if re.search(rf"\b{func}\s*\(", sql, flags=re.IGNORECASE):
            found.append(func.upper())
    return found
