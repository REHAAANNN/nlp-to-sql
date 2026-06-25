from pydantic import BaseModel, EmailStr, Field


class AuthUser(BaseModel):
    id: str
    name: str
    email: str
    auth_provider: str
    profile_picture: str = ""
    connected_databases: list = []


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class GoogleAuthRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    profile_picture: str = ""
    google_token: str | None = None
