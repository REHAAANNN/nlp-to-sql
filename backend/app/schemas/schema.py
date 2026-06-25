from typing import Any

from pydantic import BaseModel, Field


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    nullable: bool
    primary_key: bool = False
    foreign_key: bool = False
    default: str | None = None


class ForeignKeyInfo(BaseModel):
    column: str
    referred_table: str
    referred_column: str


class TableInfo(BaseModel):
    name: str
    columns: list[ColumnInfo]
    primary_keys: list[str] = Field(default_factory=list)
    foreign_keys: list[ForeignKeyInfo] = Field(default_factory=list)
    row_count: int | None = None


class SchemaResponse(BaseModel):
    connection_id: str
    db_type: str
    database: str
    tables: list[TableInfo]


class DashboardResponse(BaseModel):
    connected: bool
    connection_id: str | None = None
    db_type: str | None = None
    database: str | None = None
    tables: int = 0
    rows: int = 0
    largest_table: dict[str, Any] | None = None
    recent_queries: list[dict[str, Any]] = Field(default_factory=list)
