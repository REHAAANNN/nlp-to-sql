from sqlalchemy.exc import SQLAlchemyError
from uuid import UUID

from app.auth.security import decrypt_secret, encrypt_secret
from app.db.connection_manager import ConnectionState, connection_manager
from app.db.mongo import mongo_store
from app.schemas.database import DatabaseConnectionRequest
from app.services.schema_service import fetch_schema
from app.utils.exceptions import AppError


def _connect_and_cache(payload: DatabaseConnectionRequest, connection_id: UUID | None = None) -> ConnectionState:
    try:
        state = connection_manager.connect(payload, connection_id=connection_id)
    except SQLAlchemyError as exc:
        raise AppError(f"Database connection failed: {exc}", status_code=400) from exc
    except Exception as exc:
        raise AppError(f"Database connection failed: {exc}", status_code=400) from exc

    try:
        fetch_schema(str(state.connection_id))
    except SQLAlchemyError as exc:
        connection_manager.remove(str(state.connection_id))
        raise AppError(f"Connected, but schema reading failed: {exc}", status_code=400) from exc
    except Exception as exc:
        connection_manager.remove(str(state.connection_id))
        raise AppError(f"Connected, but schema reading failed: {exc}", status_code=400) from exc

    return state


def connect_database(payload: DatabaseConnectionRequest, user: dict | None = None) -> ConnectionState:
    state = _connect_and_cache(payload)
    if user is not None:
        schema = connection_manager.get_schema_cache(str(state.connection_id)) or {}
        database_id = str(state.connection_id)
        mongo_store.add_connected_database(
            str(user["_id"]),
            {
                "database_id": database_id,
                "name": payload.name or payload.database,
                "db_type": payload.db_type.value,
                "host": payload.host,
                "port": payload.port,
                "username": payload.username,
                "database": payload.database,
                "encrypted_password": encrypt_secret(payload.password.get_secret_value()),
                "schema_cache": schema.get("tables", []),
                "last_connected": state.created_at.isoformat(),
                "ssl": payload.ssl,
            },
        )
    return state


def saved_databases_for_user(user: dict) -> list[dict]:
    databases = user.get("connected_databases") or []
    sanitized = []
    for database in databases:
        sanitized.append(
            {
                "database_id": database.get("database_id"),
                "name": database.get("name") or database.get("database") or "Saved database",
                "db_type": database.get("db_type"),
                "host": database.get("host"),
                "port": database.get("port"),
                "username": database.get("username"),
                "database": database.get("database"),
                "schema_cache": database.get("schema_cache") or [],
                "last_connected": database.get("last_connected"),
            }
        )
    return sanitized


def select_saved_database(user: dict, database_id: str, password: str | None = None) -> ConnectionState:
    databases = user.get("connected_databases") or []
    saved = next((item for item in databases if item.get("database_id") == database_id), None)
    if saved is None:
        raise AppError("Saved database not found", status_code=404)

    secret = password or decrypt_secret(saved.get("encrypted_password") or "")
    payload = DatabaseConnectionRequest(
        name=saved.get("name") or saved.get("database"),
        db_type=saved.get("db_type"),
        host=saved.get("host"),
        port=int(saved.get("port")),
        username=saved.get("username"),
        password=secret,
        database=saved.get("database"),
        ssl=bool(saved.get("ssl", True)),
    )
    state = _connect_and_cache(payload, connection_id=UUID(database_id))
    schema = connection_manager.get_schema_cache(str(state.connection_id)) or {}
    saved["schema_cache"] = schema.get("tables", [])
    saved["last_connected"] = state.created_at.isoformat()
    if password:
        saved["encrypted_password"] = encrypt_secret(password)
    mongo_store.add_connected_database(str(user["_id"]), saved)
    mongo_store.set_active_database(str(user["_id"]), database_id)
    return state
