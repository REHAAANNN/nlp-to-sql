from typing import Any

from pydantic import BaseModel, Field


class GenerateQueryRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=4000)
    connection_id: str | None = None


class QueryOption(BaseModel):
    sql: str
    confidence: int = Field(ge=0, le=100)
    recommended: bool = False
    explanation: str | None = None


class GenerateQueryResponse(BaseModel):
    queries: list[QueryOption]
    best_query: str | None = None


class ExplainQueryRequest(BaseModel):
    query: str = Field(min_length=2, max_length=20000)
    connection_id: str | None = None


class ExplainQueryResponse(BaseModel):
    explanation: str
    joins_used: list[str] = Field(default_factory=list)
    filters_used: list[str] = Field(default_factory=list)
    aggregations_used: list[str] = Field(default_factory=list)


class AnalyzeImpactRequest(BaseModel):
    query: str = Field(min_length=2, max_length=20000)
    connection_id: str | None = None


class AnalyzeImpactResponse(BaseModel):
    rows_affected: int | None = None
    risk: str
    query_cost: str | None = None
    warnings: list[str] = Field(default_factory=list)
    explain: list[dict[str, Any]] | list[str] = Field(default_factory=list)


class ExecuteQueryRequest(BaseModel):
    query: str = Field(min_length=2, max_length=20000)
    connection_id: str | None = None
    confirm_destructive: bool = False


class ExecuteQueryResponse(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    execution_time_ms: float
    truncated: bool = False
    message: str
