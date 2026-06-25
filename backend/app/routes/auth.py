from typing import Any

from fastapi import APIRouter

from app.auth.security import create_access_token, hash_password, verify_password
from app.db.mongo import mongo_store
from app.schemas.auth import AuthResponse, AuthUser, GoogleAuthRequest, LoginRequest, SignupRequest
from app.utils.exceptions import AppError


router = APIRouter(prefix="/auth", tags=["auth"])


def _user_id(user: dict[str, Any]) -> str:
    return str(user.get("_id"))


def _auth_response(user: dict[str, Any]) -> AuthResponse:
    user_id = _user_id(user)
    return AuthResponse(
        access_token=create_access_token(user_id, {"email": user.get("email")}),
        user=AuthUser(
            id=user_id,
            name=user.get("name") or "",
            email=user.get("email") or "",
            auth_provider=user.get("auth_provider") or "email",
            profile_picture=user.get("profile_picture") or "",
            connected_databases=user.get("connected_databases") or [],
        ),
    )


@router.post("/signup", response_model=AuthResponse)
async def signup(payload: SignupRequest) -> AuthResponse:
    existing = mongo_store.get_user_by_email(payload.email)
    if existing is not None:
        raise AppError("An account with this email already exists", status_code=409)

    user = mongo_store.create_user(
        name=payload.name.strip(),
        email=payload.email,
        auth_provider="email",
        password_hash=hash_password(payload.password),
    )
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    user = mongo_store.get_user_by_email(payload.email)
    if user is None or not verify_password(payload.password, user.get("password_hash")):
        raise AppError("Invalid email or password", status_code=401)
    return _auth_response(user)


@router.post("/google", response_model=AuthResponse)
async def google_auth(payload: GoogleAuthRequest) -> AuthResponse:
    user = mongo_store.get_user_by_email(payload.email)
    if user is None:
        user = mongo_store.create_user(
            name=payload.name.strip(),
            email=payload.email,
            auth_provider="google",
            profile_picture=payload.profile_picture,
        )
    return _auth_response(user)
