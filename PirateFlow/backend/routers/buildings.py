"""Building endpoints — list and detail."""

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import UserPayload, get_current_user
from models.schemas import BuildingOut, FloorOut

router = APIRouter(prefix="/api/buildings", tags=["buildings"], dependencies=[Depends(get_current_user)])

# Stub data matching SHU campus
STUB_BUILDINGS = [
    BuildingOut(id="bld_001", name="Jubilee Hall", code="JUB", address="400 South Orange Ave", total_floors=4, room_count=22, current_occupancy_pct=0.45),
    BuildingOut(id="bld_002", name="McNulty Hall", code="MCN", address="400 South Orange Ave", total_floors=4, room_count=25, current_occupancy_pct=0.62),
    BuildingOut(id="bld_003", name="Corrigan Hall", code="COR", address="400 South Orange Ave", total_floors=3, room_count=15, current_occupancy_pct=0.38),
    BuildingOut(id="bld_004", name="Walsh Library", code="WAL", address="400 South Orange Ave", total_floors=5, room_count=30, current_occupancy_pct=0.71),
    BuildingOut(id="bld_005", name="University Center", code="UC", address="400 South Orange Ave", total_floors=3, room_count=20, current_occupancy_pct=0.29),
    BuildingOut(id="bld_006", name="Stafford Place", code="STP", address="400 South Orange Ave", total_floors=3, room_count=18, current_occupancy_pct=0.55),
]


@router.get("", response_model=list[BuildingOut])
async def list_buildings():
    """Return all buildings with summary stats."""
    # TODO: replace with DB query
    return STUB_BUILDINGS


@router.get("/{building_id}", response_model=dict)
async def get_building(building_id: str):
    """Return building detail with floors and room summaries."""
    # TODO: replace with DB query
    building = next((b for b in STUB_BUILDINGS if b.id == building_id), None)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    floors = [
        FloorOut(id=f"flr_{building_id}_{i}", building_id=building_id, floor_number=i, name=f"Floor {i}", room_count=building.room_count // building.total_floors)
        for i in range(1, building.total_floors + 1)
    ]

    return {"building": building, "floors": floors}
