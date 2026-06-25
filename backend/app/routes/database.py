from fastapi import APIRouter, Depends

from app.auth.dependencies import current_user
from app.schemas.database import (
    DatabaseConnectionRequest,
    DatabaseConnectionResponse,
    SavedDatabasesResponse,
    SelectDatabaseRequest,
    SelectDatabaseResponse,
)
from app.services.database_service import connect_database, saved_databases_for_user, select_saved_database


router = APIRouter(tags=["database"])


def _connect_response(state, message: str) -> DatabaseConnectionResponse:
    return DatabaseConnectionResponse(
        connected=True,
        connection_id=state.connection_id,
        database_id=str(state.connection_id),
        db_type=state.db_type,
        database=state.database,
        message=message,
    )


@router.post("/database/connect", response_model=DatabaseConnectionResponse)
async def connect_saved_db(
    payload: DatabaseConnectionRequest,
    user: dict = Depends(current_user),
) -> DatabaseConnectionResponse:
    state = connect_database(payload, user=user)
    return _connect_response(state, "Database connected, schema cached, and credentials saved securely")


@router.post("/connect-db", response_model=DatabaseConnectionResponse)
async def connect_db_compat(
    payload: DatabaseConnectionRequest,
    user: dict = Depends(current_user),
) -> DatabaseConnectionResponse:
    state = connect_database(payload, user=user)
    return _connect_response(state, "Database connected, schema cached, and credentials saved securely")


@router.get("/database/saved", response_model=SavedDatabasesResponse)
async def list_saved_databases(user: dict = Depends(current_user)) -> SavedDatabasesResponse:
    return SavedDatabasesResponse(databases=saved_databases_for_user(user))


@router.post("/database/select", response_model=SelectDatabaseResponse)
async def select_database(
    payload: SelectDatabaseRequest,
    user: dict = Depends(current_user),
) -> SelectDatabaseResponse:
    state = select_saved_database(
        user,
        payload.database_id,
        payload.password.get_secret_value() if payload.password else None,
    )
    return SelectDatabaseResponse(
        connected=True,
        connection_id=state.connection_id,
        database_id=str(state.connection_id),
        db_type=state.db_type,
        database=state.database,
        message="Saved database selected and active session restored",
    )
