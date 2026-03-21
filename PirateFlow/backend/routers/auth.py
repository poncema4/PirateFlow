"""Auth endpoints — login, token refresh, current user."""

from fastapi import APIRouter, Depends, HTTPException, Request

from middleware.auth import UserPayload, get_current_user
from middleware.rate_limit import rate_limit_ip
from models.schemas import LoginRequest, LoginResponse, RefreshRequest, TokenPair, UserOut, UserRole

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Map stub tokens to user IDs so login and decode stay in sync
_STUB_USERS = {
    "admin@shu.edu": {"id": "usr_001", "password": "openshu2026", "role": UserRole.admin, "first": "Demo", "last": "Admin"},
    "staff@shu.edu": {"id": "usr_005", "password": "openshu2026", "role": UserRole.staff, "first": "Demo", "last": "Staff"},
    "student@shu.edu": {"id": "usr_010", "password": "openshu2026", "role": UserRole.student, "first": "Demo", "last": "Student"},
}

# Stub token mapping — middleware/auth.py _decode_token() must match these
_ROLE_TO_TOKEN = {
    UserRole.admin: "stub-access-token",
    UserRole.staff: "stub-staff-token",
    UserRole.student: "stub-student-token",
}


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, _: None = Depends(rate_limit_ip(max_requests=5, window_seconds=60))):
    """Authenticate user, return JWT token pair."""
    # TODO: wire to Role 1's auth module (bcrypt verify, real JWT signing)
    user_info = _STUB_USERS.get(body.email)
    if not user_info or body.password != user_info["password"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    role = user_info["role"]
    return LoginResponse(
        access_token=_ROLE_TO_TOKEN[role],
        refresh_token="stub-refresh-token",
        user=UserOut(
            id=user_info["id"],
            email=body.email,
            first_name=user_info["first"],
            last_name=user_info["last"],
            role=role,
        ),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(body: RefreshRequest):
    """Exchange a refresh token for a new access token."""
    # TODO: wire to Role 1's auth module
    return TokenPair(
        access_token="stub-access-token",
        refresh_token="stub-new-refresh-token",
    )


@router.get("/me", response_model=UserOut)
async def me(user: UserPayload = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    # TODO: look up full user profile from DB using user.user_id
    user_info = next(
        (v for k, v in _STUB_USERS.items() if v["id"] == user.user_id),
        None,
    )
    if not user_info:
        return UserOut(id=user.user_id, email=user.email, first_name="Unknown", last_name="User", role=user.role)

    return UserOut(
        id=user.user_id,
        email=user.email,
        first_name=user_info["first"],
        last_name=user_info["last"],
        role=user.role,
    )
