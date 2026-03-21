"""
Authentication and authorization middleware.

Provides FastAPI dependencies for:
- get_current_user: extracts and validates JWT from Authorization header
- require_role: enforces minimum role level on endpoints

Usage in endpoints:
    @router.get("/admin-only")
    async def admin_endpoint(user: UserPayload = Depends(require_role(UserRole.admin))):
        ...

    @router.get("/any-authenticated")
    async def protected_endpoint(user: UserPayload = Depends(get_current_user)):
        ...

Role 1 integration:
    Once Role 1 delivers the JWT module, update _decode_token() to use their
    verify function and _get_user_from_db() to query the real database.
"""

import os
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from models.schemas import UserRole

# ---------------------------------------------------------------------------
# Token payload model
# ---------------------------------------------------------------------------

class UserPayload(BaseModel):
    """Decoded JWT claims. Attached to every authenticated request."""
    user_id: str
    email: str
    role: UserRole


# ---------------------------------------------------------------------------
# Security scheme
# ---------------------------------------------------------------------------

# HTTPBearer extracts the token from "Authorization: Bearer <token>"
# auto_error=False lets us return a custom 401 instead of FastAPI's default
_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Token decoding (Role 1 replaces this)
# ---------------------------------------------------------------------------

def _decode_token(token: str) -> Optional[UserPayload]:
    """Decode and validate a JWT access token. Returns UserPayload or None."""
    from services.auth import decode_access_token

    payload = decode_access_token(token)
    if payload is None:
        return None
    try:
        return UserPayload(
            user_id=payload["sub"],
            email=payload["email"],
            role=UserRole(payload["role"]),
        )
    except (KeyError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Role hierarchy
# ---------------------------------------------------------------------------

_ROLE_LEVEL = {
    UserRole.student: 0,
    UserRole.staff: 1,
    UserRole.admin: 2,
}


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> UserPayload:
    """
    FastAPI dependency that extracts and validates the JWT.

    Returns the decoded user payload or raises 401.
    Attach to any endpoint that requires authentication.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = _decode_token(credentials.credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(minimum_role: UserRole):
    """
    Factory that returns a dependency enforcing a minimum role level.

    Usage:
        @router.get("/admin-only")
        async def endpoint(user: UserPayload = Depends(require_role(UserRole.admin))):
            ...
    """
    async def _check_role(
        user: UserPayload = Depends(get_current_user),
    ) -> UserPayload:
        if _ROLE_LEVEL[user.role] < _ROLE_LEVEL[minimum_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This endpoint requires {minimum_role.value} role or higher",
            )
        return user

    return _check_role


# ---------------------------------------------------------------------------
# Camera API key auth (for face verify endpoint)
# ---------------------------------------------------------------------------

async def require_camera_key(
    x_camera_key: Optional[str] = Header(None),
) -> None:
    """
    Validates the camera API key from the X-Camera-Key header.
    Used by the face verify endpoint -- cameras are trusted devices,
    not user sessions, so they use a simple API key instead of JWT.
    """
    expected = os.getenv("CAMERA_API_KEY", "dev-camera-key")
    if not x_camera_key or x_camera_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing camera API key",
        )
