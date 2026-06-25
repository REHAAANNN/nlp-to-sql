from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import current_user
from app.schemas.history import DeleteHistoryResponse, HistoryResponse
from app.services.history_service import delete_history, list_history


router = APIRouter(tags=["history"])


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    limit: int = Query(default=50, ge=1, le=200),
    connection_id: str | None = Query(default=None),
    user: dict = Depends(current_user),
) -> HistoryResponse:
    return HistoryResponse(items=list_history(limit=limit, user_id=str(user["_id"]), connection_id=connection_id))


@router.delete("/history/{history_id}", response_model=DeleteHistoryResponse)
async def remove_history(history_id: str) -> DeleteHistoryResponse:
    deleted = delete_history(history_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History item not found")
    return DeleteHistoryResponse(deleted=True)
