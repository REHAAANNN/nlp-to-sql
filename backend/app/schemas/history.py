from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class HistoryCreate(BaseModel):
    prompt: str | None = None
    generated_queries: list[dict[str, Any]] = Field(default_factory=list)
    selected_query: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class HistoryItem(BaseModel):
    id: str
    prompt: str | None = None
    generated_queries: list[dict[str, Any]] = Field(default_factory=list)
    selected_query: str | None = None
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class HistoryResponse(BaseModel):
    items: list[HistoryItem]


class DeleteHistoryResponse(BaseModel):
    deleted: bool = Field(default=True)
