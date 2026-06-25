from datetime import datetime, timezone
import logging
from typing import Any

from bson import ObjectId
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import ConfigurationError, PyMongoError

from app.config.settings import get_settings


logger = logging.getLogger(__name__)


class MongoStore:
    def __init__(self) -> None:
        self._client: MongoClient | None = None
        self._disabled = False

    @property
    def client(self) -> MongoClient | None:
        if self._disabled:
            return None
        if self._client is None:
            uri = get_settings().mongo_uri
            if uri:
                try:
                    self._client = MongoClient(uri, serverSelectionTimeoutMS=1500)
                except ConfigurationError as exc:
                    self._disabled = True
                    logger.warning("Disabling MongoDB persistence: %s", exc)
        return self._client

    def collection(self, name: str) -> Collection | None:
        if self.client is None:
            return None
        return self.client.get_database("sql_ai_assistant").get_collection(name)

    def save_history(self, document: dict[str, Any]) -> str:
        collection = self.collection("query_history")
        document.setdefault("timestamp", datetime.now(timezone.utc))
        if collection is None:
            fallback_id = str(ObjectId())
            in_memory_history.append({"_id": fallback_id, **document})
            return fallback_id
        try:
            result = collection.insert_one(document)
            return str(result.inserted_id)
        except PyMongoError as exc:
            logger.warning("Falling back to in-memory history: %s", exc)
            fallback_id = str(ObjectId())
            in_memory_history.append({"_id": fallback_id, **document})
            return fallback_id

    def list_history(self, limit: int = 50, user_id: str | None = None, connection_id: str | None = None) -> list[dict[str, Any]]:
        collection = self.collection("query_history")
        if collection is None:
            items = in_memory_history
            if user_id:
                items = [item for item in items if item.get("user_id") == user_id]
            if connection_id:
                items = [item for item in items if item.get("metadata", {}).get("connection_id") == connection_id]
            return list(reversed(items[-limit:]))
        try:
            query: dict[str, Any] = {}
            if user_id:
                query["user_id"] = user_id
            if connection_id:
                query["metadata.connection_id"] = connection_id
            return list(collection.find(query).sort("timestamp", -1).limit(limit))
        except PyMongoError as exc:
            logger.warning("Falling back to in-memory history list: %s", exc)
            items = in_memory_history
            if user_id:
                items = [item for item in items if item.get("user_id") == user_id]
            if connection_id:
                items = [item for item in items if item.get("metadata", {}).get("connection_id") == connection_id]
            return list(reversed(items[-limit:]))

    def delete_history(self, history_id: str) -> bool:
        collection = self.collection("query_history")
        if collection is None:
            original = len(in_memory_history)
            in_memory_history[:] = [item for item in in_memory_history if str(item.get("_id")) != history_id]
            return len(in_memory_history) != original
        if not ObjectId.is_valid(history_id):
            return False
        try:
            result = collection.delete_one({"_id": ObjectId(history_id)})
            return result.deleted_count > 0
        except PyMongoError as exc:
            logger.warning("Failed to delete MongoDB history item: %s", exc)
            return False

    def save_schema_metadata(self, document: dict[str, Any]) -> None:
        collection = self.collection("schema_metadata")
        if collection is None:
            return
        document["updated_at"] = datetime.now(timezone.utc)
        try:
            collection.update_one(
                {"connection_id": document["connection_id"]},
                {"$set": document},
                upsert=True,
            )
        except PyMongoError as exc:
            logger.warning("Skipping schema metadata persistence: %s", exc)

    def create_user(
        self,
        *,
        name: str,
        email: str,
        auth_provider: str,
        password_hash: str | None = None,
        profile_picture: str = "",
        clerk_user_id: str | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        document = {
            "name": name,
            "email": email.lower(),
            "auth_provider": auth_provider,
            "profile_picture": profile_picture,
            "password_hash": password_hash,
            "clerk_user_id": clerk_user_id,
            "created_at": now,
            "connected_databases": [],
            "active_database_id": None,
        }
        collection = self.collection("users")
        if collection is None:
            user_id = str(ObjectId())
            document["_id"] = user_id
            in_memory_users[user_id] = document
            return document
        try:
            result = collection.insert_one(document)
            document["_id"] = result.inserted_id
            return document
        except PyMongoError as exc:
            logger.warning("Falling back to in-memory users: %s", exc)
            user_id = str(ObjectId())
            document["_id"] = user_id
            in_memory_users[user_id] = document
            return document

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        normalized = email.lower()
        collection = self.collection("users")
        if collection is None:
            return next((user for user in in_memory_users.values() if user.get("email") == normalized), None)
        try:
            return collection.find_one({"email": normalized})
        except PyMongoError as exc:
            logger.warning("Falling back to in-memory user lookup: %s", exc)
            return next((user for user in in_memory_users.values() if user.get("email") == normalized), None)

    def get_user_by_clerk_id(self, clerk_user_id: str) -> dict[str, Any] | None:
        collection = self.collection("users")
        if collection is None:
            return next(
                (user for user in in_memory_users.values() if user.get("clerk_user_id") == clerk_user_id),
                None,
            )
        try:
            return collection.find_one({"clerk_user_id": clerk_user_id})
        except PyMongoError as exc:
            logger.warning("Falling back to in-memory Clerk user lookup: %s", exc)
            return next(
                (user for user in in_memory_users.values() if user.get("clerk_user_id") == clerk_user_id),
                None,
            )

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        collection = self.collection("users")
        if collection is None:
            return in_memory_users.get(user_id)
        query_id: ObjectId | str = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        try:
            return collection.find_one({"_id": query_id})
        except PyMongoError as exc:
            logger.warning("Falling back to in-memory user lookup: %s", exc)
            return in_memory_users.get(user_id)

    def add_connected_database(self, user_id: str, database: dict[str, Any]) -> None:
        collection = self.collection("users")
        if collection is None:
            user = in_memory_users.get(user_id)
            if user is None:
                return
            user.setdefault("connected_databases", [])
            # Remove duplicate by host/port/database/username, not just database_id
            user["connected_databases"] = [
                item for item in user["connected_databases"]
                if not (
                    item.get("host") == database.get("host")
                    and item.get("database") == database.get("database")
                    and item.get("username") == database.get("username")
                )
            ]
            user["connected_databases"].append(database)
            user["active_database_id"] = database["database_id"]
            return

        query_id: ObjectId | str = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        try:
            # Remove duplicate database by host+port+database+username match, not just database_id
            collection.update_one(
                {"_id": query_id},
                {
                    "$pull": {
                        "connected_databases": {
                            "host": database.get("host"),
                            "port": database.get("port"),
                            "database": database.get("database"),
                            "username": database.get("username"),
                        }
                    }
                },
            )
            collection.update_one(
                {"_id": query_id},
                {
                    "$set": {"active_database_id": database["database_id"]},
                    "$push": {"connected_databases": database},
                },
            )
        except PyMongoError as exc:
            logger.warning("Failed to save connected database: %s", exc)

    def set_active_database(self, user_id: str, database_id: str) -> None:
        collection = self.collection("users")
        if collection is None:
            if user_id in in_memory_users:
                in_memory_users[user_id]["active_database_id"] = database_id
            return
        query_id: ObjectId | str = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        try:
            collection.update_one({"_id": query_id}, {"$set": {"active_database_id": database_id}})
        except PyMongoError as exc:
            logger.warning("Failed to set active database: %s", exc)


in_memory_history: list[dict[str, Any]] = []
in_memory_users: dict[str, dict[str, Any]] = {}
mongo_store = MongoStore()