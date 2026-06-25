from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, SecretStr


class DatabaseType(StrEnum):
    postgresql = "postgresql"
    mysql = "mysql"


class DatabaseConnectionRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    db_type: DatabaseType
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(gt=0, le=65535)
    username: str = Field(min_length=1, max_length=255)
    password: SecretStr
    database: str = Field(min_length=1, max_length=255)
    ssl: bool = True


class DatabaseConnectionResponse(BaseModel):
    connected: bool
    connection_id: UUID
    database_id: str
    db_type: DatabaseType
    database: str
    message: str


class SavedDatabase(BaseModel):
    database_id: str
    name: str
    db_type: DatabaseType
    host: str
    port: int
    username: str
    database: str
    schema_cache: list | dict | None = None
    last_connected: str | None = None


class SavedDatabasesResponse(BaseModel):
    databases: list[SavedDatabase]


class SelectDatabaseRequest(BaseModel):
    database_id: str = Field(min_length=1)
    password: SecretStr | None = None


class SelectDatabaseResponse(BaseModel):
    connected: bool
    connection_id: UUID
    database_id: str
    db_type: DatabaseType
    database: str
    message: str
