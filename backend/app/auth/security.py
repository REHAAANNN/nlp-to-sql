import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet

from app.config.settings import get_settings
from app.utils.exceptions import AppError


JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7
PASSWORD_ITERATIONS = 260_000


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def _secret_bytes() -> bytes:
    secret = get_settings().secret_key
    if not secret:
        raise AppError("SECRET_KEY is required for authentication", status_code=500)
    return secret.encode("utf-8")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${_b64url_encode(salt)}${_b64url_encode(digest)}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        algorithm, iterations, salt, digest = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            _b64url_decode(salt),
            int(iterations),
        )
        return hmac.compare_digest(_b64url_encode(candidate), digest)
    except Exception:
        return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)).timestamp()),
        **(extra or {}),
    }
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    signing_input = f"{_b64url_encode(json.dumps(header, separators=(',', ':')).encode())}.{_b64url_encode(json.dumps(payload, separators=(',', ':')).encode())}"
    signature = hmac.new(_secret_bytes(), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".", 2)
        signing_input = f"{header_b64}.{payload_b64}"
        expected = hmac.new(_secret_bytes(), signing_input.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_encode(expected), signature_b64):
            raise AppError("Invalid auth token", status_code=401)
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            raise AppError("Auth token expired", status_code=401)
        return payload
    except AppError:
        raise
    except Exception as exc:
        raise AppError("Invalid auth token", status_code=401) from exc


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(_secret_bytes()).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except Exception as exc:
        raise AppError("Saved database password cannot be decrypted", status_code=500) from exc
