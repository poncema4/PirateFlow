"""Building endpoints — list, detail, and admin CRUD."""

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import UserPayload, get_current_user, require_role
from models.schemas import BuildingCreateRequest, BuildingOut, BuildingUpdateRequest, FloorCreateRequest, FloorOut, UserRole
from services.database import get_db
from services.queries import (
    get_all_buildings, get_building_by_id,
    create_building, update_building, delete_building,
    create_floor, delete_floor,
)

router = APIRouter(prefix="/api/buildings", tags=["buildings"])


@router.get("", response_model=list[BuildingOut])
async def list_buildings():
    """Return all buildings with summary stats."""
    db = await get_db()
    rows = await get_all_buildings(db)
    return [BuildingOut(**r) for r in rows]


@router.get("/{building_id}", response_model=dict)
async def get_building(building_id: str):
    """Return building detail with floors and room summaries."""
    db = await get_db()
    result = await get_building_by_id(db, building_id)
    if not result:
        raise HTTPException(status_code=404, detail="Building not found")

    building = result["building"]
    floors = result["floors"]

    building_out = BuildingOut(
        id=building["id"], name=building["name"], code=building["code"],
        address=building["address"], total_floors=building["total_floors"],
        room_count=len(result["rooms"]),
        current_occupancy_pct=0.0,
    )

    floors_out = [
        FloorOut(
            id=f["id"], building_id=f["building_id"],
            floor_number=f["floor_number"], name=f["name"],
            room_count=sum(1 for r in result["rooms"] if r["floor_id"] == f["id"]),
        )
        for f in floors
    ]

    return {"building": building_out, "floors": floors_out}


# ---------------------------------------------------------------------------
# Admin CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=dict, status_code=201)
async def create_building_endpoint(
    body: BuildingCreateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: create a new building."""
    db = await get_db()
    building_id = await create_building(
        db, name=body.name, code=body.code, address=body.address,
        total_floors=body.total_floors, latitude=body.latitude, longitude=body.longitude,
    )
    return {"id": building_id, "status": "created"}


@router.put("/{building_id}", response_model=dict)
async def update_building_endpoint(
    building_id: str,
    body: BuildingUpdateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: update a building."""
    db = await get_db()
    existing = await get_building_by_id(db, building_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Building not found")
    await update_building(db, building_id, **body.model_dump(exclude_none=True))
    return {"id": building_id, "status": "updated"}


@router.delete("/{building_id}", response_model=dict)
async def delete_building_endpoint(
    building_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: delete a building and all its floors/rooms."""
    db = await get_db()
    existing = await get_building_by_id(db, building_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Building not found")
    await delete_building(db, building_id)
    return {"id": building_id, "status": "deleted"}


@router.post("/{building_id}/floors", response_model=dict, status_code=201)
async def create_floor_endpoint(
    building_id: str,
    body: FloorCreateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: add a floor to a building."""
    db = await get_db()
    existing = await get_building_by_id(db, building_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Building not found")
    floor_id = await create_floor(db, building_id, body.floor_number, body.name)
    return {"id": floor_id, "status": "created"}


@router.delete("/floors/{floor_id}", response_model=dict)
async def delete_floor_endpoint(
    floor_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: delete a floor and its rooms."""
    db = await get_db()
    await delete_floor(db, floor_id)
    return {"id": floor_id, "status": "deleted"}
