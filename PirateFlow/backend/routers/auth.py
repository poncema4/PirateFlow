"""Auth endpoints — login, token refresh, current user."""

from fastapi import APIRouter, Depends, HTTPException, Request

from middleware.auth import UserPayload, get_current_user
from middleware.rate_limit import rate_limit_ip
from models.schemas import LoginRequest, LoginResponse, RefreshRequest, StudentLookupRequest, TokenPair, UserOut, UserRole
from services.auth import verify_password, create_access_token, create_refresh_token, decode_refresh_token
from services.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, _: None = Depends(rate_limit_ip(max_requests=5, window_seconds=60))):
    """Authenticate user, return JWT token pair."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT id, email, password_hash, first_name, last_name, role, department, major, year, student_id FROM users WHERE email = ?",
        (body.email,),
    )
    row = await cursor.fetchone()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access = create_access_token(row["id"], row["email"], row["role"])
    refresh = create_refresh_token(row["id"])

    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserOut(
            id=row["id"],
            email=row["email"],
            first_name=row["first_name"],
            last_name=row["last_name"],
            role=UserRole(row["role"]),
            department=row["department"],
            major=row["major"],
            year=row["year"],
            student_id=row["student_id"],
        ),
    )


@router.post("/lookup", response_model=LoginResponse)
async def student_lookup(body: StudentLookupRequest, _: None = Depends(rate_limit_ip(max_requests=10, window_seconds=60))):
    """Look up a student by their SHU ID number and log them in."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT id, email, password_hash, first_name, last_name, role, department, major, year, student_id FROM users WHERE student_id = ?",
        (body.student_id.strip(),),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No student found with that ID number")

    access = create_access_token(row["id"], row["email"], row["role"])
    refresh = create_refresh_token(row["id"])

    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserOut(
            id=row["id"],
            email=row["email"],
            first_name=row["first_name"],
            last_name=row["last_name"],
            role=UserRole(row["role"]),
            department=row["department"],
            major=row["major"],
            year=row["year"],
            student_id=row["student_id"],
        ),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(body: RefreshRequest):
    """Exchange a refresh token for a new access token."""
    payload = decode_refresh_token(body.refresh_token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    db = await get_db()
    cursor = await db.execute(
        "SELECT id, email, role FROM users WHERE id = ?", (payload["sub"],),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(row["id"], row["email"], row["role"])
    refresh = create_refresh_token(row["id"])
    return TokenPair(access_token=access, refresh_token=refresh)


@router.get("/me", response_model=UserOut)
async def me(user: UserPayload = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT id, email, first_name, last_name, role, department, major, year, student_id FROM users WHERE id = ?",
        (user.user_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return UserOut(
        id=row["id"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
        role=UserRole(row["role"]),
        department=row["department"],
        major=row["major"],
        year=row["year"],
        student_id=row["student_id"],
    )
