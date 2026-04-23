from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


class SetupStatusResponse(BaseModel):
    initial_admin_created: bool
    setup_enabled: bool


class InitialAdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    password_confirm: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Kullanici adi en az 3 karakter olmalidir")
        if len(v) > 50:
            raise ValueError("Kullanici adi en fazla 50 karakter olmalidir")
        return v

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Sifre en az 8 karakter olmalidir")
        return v

    @field_validator("password_confirm")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Sifreler eslesmiyor")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserMeResponse(BaseModel):
    id: int
    username: str
    email: str
    status: str
    roles: list[str]
    last_login_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Admin user management ─────────────────────────────────────────────────────

class AdminUserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "admin"
    status: str = "active"

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Kullanici adi en az 3 karakter olmalidir")
        return v

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Sifre en az 6 karakter olmalidir")
        return v

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        allowed = {"admin", "reseller", "moderator", "super_admin"}
        if v not in allowed:
            raise ValueError(f"Gecersiz rol. Izin verilenler: {', '.join(allowed)}")
        return v


class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[str] = None
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"admin", "reseller", "moderator", "super_admin"}
        if v not in allowed:
            raise ValueError(f"Gecersiz rol")
        return v


class AdminUserResponse(BaseModel):
    id: int
    username: str
    email: str
    status: str
    roles: list[str]
    created_at: datetime
    last_login_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    new_password_confirm: str

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Yeni sifre en az 6 karakter olmalidir")
        return v

    @field_validator("new_password_confirm")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Sifreler eslesmiyor")
        return v

