"""User management endpoints — admin only."""

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import UserPayload, require_role
from models.schemas import PaginatedResponse, UserCreateRequest, UserOut, UserRole, UserUpdateRequest
from services.auth import hash_password
from services.database import get_db
from services.queries import get_all_users, create_user, update_user, delete_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=PaginatedResponse)
async def list_users(
    role: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: list all users with optional role filter."""
    db = await get_db()
    result = await get_all_users(db, role=role, search=search, page=page, page_size=page_size)
    items = [UserOut(**r) for r in result["items"]]
    return PaginatedResponse(
        items=items, total=result["total"],
        page=result["page"], page_size=result["page_size"],
    )


@router.post("", response_model=dict, status_code=201)
async def create_user_endpoint(
    body: UserCreateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: create a new user."""
    db = await get_db()

    # Check email uniqueness
    cursor = await db.execute("SELECT id FROM users WHERE email = ?", (body.email,))
    if await cursor.fetchone():
        raise HTTPException(status_code=400, detail="Email already in use")

    password_hash = hash_password(body.password)
    user_id = await create_user(
        db, email=body.email, password_hash=password_hash,
        first_name=body.first_name, last_name=body.last_name,
        role=body.role.value, department=body.department,
        major=body.major, year=body.year, student_id=body.student_id,
    )
    return {"id": user_id, "status": "created"}


@router.put("/{user_id}", response_model=dict)
async def update_user_endpoint(
    user_id: str,
    body: UserUpdateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: update a user."""
    db = await get_db()
    cursor = await db.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="User not found")

    updates = body.model_dump(exclude_none=True)
    if "role" in updates:
        updates["role"] = updates["role"].value
    await update_user(db, user_id, **updates)
    return {"id": user_id, "status": "updated"}


@router.delete("/{user_id}", response_model=dict)
async def delete_user_endpoint(
    user_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: delete a user."""
    db = await get_db()
    cursor = await db.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="User not found")

    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    await delete_user(db, user_id)
    return {"id": user_id, "status": "deleted"}
