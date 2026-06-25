from typing import Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.clerk import verify_clerk_token
from app.auth.security import decode_access_token
from app.db.mongo import mongo_store
from app.utils.exceptions import AppError


bearer_scheme = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError("Authentication required", status_code=401)

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            raise AppError("Invalid auth token", status_code=401)

        user = mongo_store.get_user_by_id(user_id)
        if user is None:
            raise AppError("User not found", status_code=401)
        return user
    except AppError:
        clerk_payload = verify_clerk_token(token)
        clerk_user_id = clerk_payload.get("sub")
        if not isinstance(clerk_user_id, str):
            raise AppError("Invalid Clerk session token", status_code=401)

        user = mongo_store.get_user_by_clerk_id(clerk_user_id)
        if user is not None:
            return user

        email = (
            clerk_payload.get("email")
            or clerk_payload.get("email_address")
            or f"{clerk_user_id}@clerk.local"
        )
        name = clerk_payload.get("name") or clerk_payload.get("full_name") or "Clerk User"
        return mongo_store.create_user(
            name=str(name),
            email=str(email),
            auth_provider="clerk",
            profile_picture=str(clerk_payload.get("picture") or ""),
            clerk_user_id=clerk_user_id,
        )
