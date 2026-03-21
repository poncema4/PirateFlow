"""Building endpoints — list and detail."""

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import get_current_user
from models.schemas import BuildingOut, FloorOut
from services.database import get_db
from services.queries import get_all_buildings, get_building_by_id

router = APIRouter(prefix="/api/buildings", tags=["buildings"], dependencies=[Depends(get_current_user)])


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
