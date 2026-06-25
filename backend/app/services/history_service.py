from bson import ObjectId

from app.db.mongo import mongo_store
from app.schemas.history import HistoryItem


def _serialize_history_item(item: dict) -> HistoryItem:
    item_id = str(item.get("_id") or ObjectId())
    return HistoryItem(
        id=item_id,
        prompt=item.get("prompt"),
        generated_queries=item.get("generated_queries", []),
        selected_query=item.get("selected_query"),
        timestamp=item.get("timestamp"),
        metadata=item.get("metadata", {}),
    )


def list_history(limit: int = 50, user_id: str | None = None, connection_id: str | None = None) -> list[HistoryItem]:
    return [_serialize_history_item(item) for item in mongo_store.list_history(limit=limit, user_id=user_id, connection_id=connection_id)]


def delete_history(history_id: str) -> bool:
    return mongo_store.delete_history(history_id)
