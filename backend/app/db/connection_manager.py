from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.engine import URL

from app.config.settings import get_settings
from app.schemas.database import DatabaseConnectionRequest, DatabaseType
from app.utils.exceptions import ConnectionNotFoundError


@dataclass
class ConnectionState:
    connection_id: UUID
    engine: Engine
    db_type: DatabaseType
    database: str
    username: str
    host: str
    port: int
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    schema_cache: dict | None = None
    schema_cached_at: datetime | None = None


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, ConnectionState] = {}
        self._default_id: str | None = None

    def _build_url(self, payload: DatabaseConnectionRequest) -> URL:
        driver = "postgresql+psycopg2" if payload.db_type == DatabaseType.postgresql else "mysql+pymysql"
        return URL.create(
            drivername=driver,
            username=payload.username,
            password=payload.password.get_secret_value(),
            host=payload.host,
            port=payload.port,
            database=payload.database,
        )

    def connect(self, payload: DatabaseConnectionRequest, connection_id: UUID | None = None) -> ConnectionState:
        settings = get_settings()
        if payload.db_type == DatabaseType.mysql:
            connect_args = {"connect_timeout": 2}
            if payload.ssl:
                connect_args["ssl"] = {}
        else:
            connect_args = {"connect_timeout": 2, "sslmode": "require" if payload.ssl else "prefer"}

        engine = create_engine(
            self._build_url(payload),
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_recycle=1800,
            connect_args=connect_args,
        )

        if payload.db_type == DatabaseType.postgresql:
            timeout_ms = settings.statement_timeout_ms

            @event.listens_for(engine, "connect")
            def set_postgres_statement_timeout(dbapi_connection, _) -> None:
                with dbapi_connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = %s", (timeout_ms,))

        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        state = ConnectionState(
            connection_id=connection_id or uuid4(),
            engine=engine,
            db_type=payload.db_type,
            database=payload.database,
            username=payload.username,
            host=payload.host,
            port=payload.port,
        )
        key = str(state.connection_id)
        self._connections[key] = state
        self._default_id = key
        return state

    def get(self, connection_id: str | None = None) -> ConnectionState:
        key = connection_id or self._default_id
        if not key or key not in self._connections:
            raise ConnectionNotFoundError()
        return self._connections[key]

    def clear_schema_cache(self, connection_id: str | None = None) -> None:
        state = self.get(connection_id)
        state.schema_cache = None
        state.schema_cached_at = None

    def remove(self, connection_id: str) -> None:
        state = self._connections.pop(connection_id, None)
        if state:
            state.engine.dispose()
        if self._default_id == connection_id:
            self._default_id = next(iter(self._connections), None)

    def get_schema_cache(self, connection_id: str | None = None) -> dict | None:
        state = self.get(connection_id)
        if not state.schema_cache or not state.schema_cached_at:
            return None
        max_age = timedelta(seconds=get_settings().schema_cache_seconds)
        if datetime.now(timezone.utc) - state.schema_cached_at > max_age:
            return None
        return state.schema_cache

    def set_schema_cache(self, schema: dict, connection_id: str | None = None) -> None:
        state = self.get(connection_id)
        state.schema_cache = schema
        state.schema_cached_at = datetime.now(timezone.utc)

    def has_default(self) -> bool:
        return self._default_id is not None and self._default_id in self._connections


connection_manager = ConnectionManager()
