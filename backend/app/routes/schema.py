from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import current_user
from app.schemas.schema import DashboardResponse, SchemaResponse
from app.services.schema_service import dashboard_stats, fetch_schema
from app.utils.exceptions import AppError


router = APIRouter(tags=["schema"])


def _connection_id(user: dict, requested: str | None = None) -> str:
    connection_id = requested or user.get("active_database_id")
    if not connection_id:
        raise AppError("Select a database before using this endpoint", status_code=400)
    return str(connection_id)


@router.get("/schema", response_model=SchemaResponse)
async def get_schema(
    connection_id: str | None = Query(default=None),
    user: dict = Depends(current_user),
) -> SchemaResponse:
    return fetch_schema(_connection_id(user, connection_id))


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    connection_id: str | None = Query(default=None),
    user: dict = Depends(current_user),
) -> DashboardResponse:
    return dashboard_stats(_connection_id(user, connection_id), user_id=str(user["_id"]))
