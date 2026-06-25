from typing import Any

import jwt
from jwt import PyJWKClient

from app.config.settings import get_settings
from app.utils.exceptions import AppError


def verify_clerk_token(token: str) -> dict[str, Any]:
    settings = get_settings()

    if settings.clerk_jwks_url:
        jwks_client = PyJWKClient(settings.clerk_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        decode_kwargs: dict[str, Any] = {
            "key": signing_key.key,
            "algorithms": ["RS256"],
            "options": {"verify_aud": False},
        }
        if settings.clerk_issuer:
            decode_kwargs["issuer"] = settings.clerk_issuer
        try:
            return jwt.decode(token, **decode_kwargs)
        except jwt.PyJWTError as exc:
            raise AppError("Invalid Clerk session token", status_code=401) from exc

    if settings.environment == "production":
        raise AppError("CLERK_JWKS_URL is required in production", status_code=500)

    try:
        return jwt.decode(token, options={"verify_signature": False, "verify_aud": False})
    except jwt.PyJWTError as exc:
        raise AppError("Invalid Clerk session token", status_code=401) from exc
