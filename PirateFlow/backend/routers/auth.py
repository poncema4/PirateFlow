"""Auth endpoints — login, token refresh, current user."""

from fastapi import APIRouter, Depends, HTTPException, Request

from middleware.auth import UserPayload, get_current_user
from middleware.rate_limit import rate_limit_ip
from models.schemas import LoginRequest, LoginResponse, RefreshRequest, StudentLookupRequest, TokenPair, UserOut, UserRole
from models.schemas import LoginRequest, LoginResponse, RefreshRequest, TokenPair, UserOut, UserRole
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


# Student ID → user lookup (mock data keyed by SHU-style ID numbers)
_STUB_STUDENTS = {
    "9012345": {"id": "usr_010", "email": "student@shu.edu", "role": UserRole.student, "first": "Demo", "last": "Student"},
    "9023456": {"id": "usr_011", "email": "jsmith@shu.edu", "role": UserRole.student, "first": "John", "last": "Smith"},
    "9034567": {"id": "usr_012", "email": "mjones@shu.edu", "role": UserRole.student, "first": "Maria", "last": "Jones"},
    "9045678": {"id": "usr_013", "email": "akim@shu.edu", "role": UserRole.student, "first": "Alex", "last": "Kim"},
    "9056789": {"id": "usr_014", "email": "twill@shu.edu", "role": UserRole.student, "first": "Tyler", "last": "Williams"},
    "9067890": {"id": "usr_005", "email": "staff@shu.edu", "role": UserRole.staff, "first": "Demo", "last": "Staff"},
    "9078901": {"id": "usr_001", "email": "admin@shu.edu", "role": UserRole.admin, "first": "Demo", "last": "Admin"},
}


@router.post("/lookup", response_model=LoginResponse)
async def student_lookup(body: StudentLookupRequest, _: None = Depends(rate_limit_ip(max_requests=10, window_seconds=60))):
    """Look up a student by their SHU ID number and log them in."""
    student = _STUB_STUDENTS.get(body.student_id.strip())
    if not student:
        raise HTTPException(status_code=404, detail="No student found with that ID number")

    role = student["role"]
    return LoginResponse(
        access_token=create_access_token(student["id"], student["email"], role),
        refresh_token="stub-refresh-token",
        user=UserOut(
            id=student["id"],
            email=student["email"],
            first_name=student["first"],
            last_name=student["last"],
            role=role,
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
