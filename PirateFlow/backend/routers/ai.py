"""AI proxy endpoints — search, recommendations, predictions, anomalies."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from middleware.auth import UserPayload, get_current_user, require_role
from middleware.rate_limit import rate_limit_user
from models.schemas import UserRole
from models.schemas import (
    AIAnomalyReport,
    AIPrediction,
    AIRecommendation,
    AISearchRequest,
    AISearchResult,
    AnomalyType,
    RoomStatus,
    RoomType,
    Severity,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/search", response_model=dict)
async def ai_search(body: AISearchRequest, user: UserPayload = Depends(get_current_user), _: None = Depends(rate_limit_user(max_requests=10, window_seconds=60))):
    """Natural language space search powered by Claude."""
    # TODO: wire to Role 5's AI service layer
    # Stub: return fake results regardless of query
    return {
        "query": body.query,
        "results": [
            AISearchResult(
                room_id="rm_001",
                room_name="Room 204",
                building_name="Walsh Library",
                room_type=RoomType.study_room,
                capacity=6,
                confidence=0.92,
                reasoning="Quiet study room with whiteboard, seats 6, currently available in Walsh Library.",
                equipment=["whiteboard", "power_outlets"],
                status=RoomStatus.available,
            ),
            AISearchResult(
                room_id="rm_005",
                room_name="Conference Room 3A",
                building_name="Stafford Place",
                room_type=RoomType.conference_room,
                capacity=12,
                confidence=0.74,
                reasoning="Conference room with projector and video conferencing, larger than requested but available.",
                equipment=["projector", "video_conferencing", "whiteboard"],
                status=RoomStatus.available,
            ),
        ],
        "ai_fallback": False,
    }


@router.get("/recommendations", response_model=list[AIRecommendation])
async def ai_recommendations(user: UserPayload = Depends(get_current_user), _: None = Depends(rate_limit_user(max_requests=5, window_seconds=60))):
    """Smart room recommendations for the current user."""
    # TODO: wire to Role 5's AI service layer, pass user booking history
    return [
        AIRecommendation(
            room_id="rm_001",
            room_name="Room 204",
            building_name="Walsh Library",
            explanation="You usually book study rooms in Walsh Library on Friday afternoons — Room 204 is free right now.",
            relevance_score=0.88,
        ),
        AIRecommendation(
            room_id="rm_004",
            room_name="Science Lab B",
            building_name="McNulty Hall",
            explanation="Based on your recent lab bookings, this room fits your typical group size of 8-10.",
            relevance_score=0.72,
        ),
    ]


@router.post("/predict", response_model=list[AIPrediction])
async def ai_predict(
    building_id: Optional[str] = None,
    days_ahead: int = 7,
    user: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Predictive analytics — forecast utilization."""
    # TODO: wire to Role 5's AI service layer
    predictions = []
    buildings = [
        ("bld_001", "Jubilee Hall"),
        ("bld_002", "McNulty Hall"),
        ("bld_004", "Walsh Library"),
    ]
    for bid, bname in buildings:
        for day_offset in range(min(days_ahead, 3)):
            for hour in range(9, 18):
                base = 0.65 if hour in (10, 11, 13, 14) else 0.40
                predictions.append(AIPrediction(
                    building_id=bid,
                    building_name=bname,
                    date=f"2026-03-{22 + day_offset}",
                    hour=hour,
                    predicted_utilization=round(base, 2),
                ))
    return predictions


@router.post("/anomalies", response_model=list[AIAnomalyReport])
async def ai_detect_anomalies(user: UserPayload = Depends(require_role(UserRole.admin))):
    """Anomaly detection — identify unusual booking/usage patterns."""
    # TODO: wire to Role 5's AI service layer
    now = datetime.now(timezone.utc)
    return [
        AIAnomalyReport(
            id="anom_001",
            type=AnomalyType.ghost_booking,
            severity=Severity.critical,
            room_id="rm_020",
            room_name="Room 302",
            building_name="Jubilee Hall",
            description="User jsmith has booked Room 302 14 times in the past month with a 71% no-show rate. The room sits empty during reserved hours.",
            recommended_action="Contact the user about their booking pattern. Consider implementing a no-show penalty policy.",
            supporting_data={"bookings": 14, "no_shows": 10, "no_show_rate": 0.71},
            detected_at=now,
        ),
        AIAnomalyReport(
            id="anom_002",
            type=AnomalyType.phantom_usage,
            severity=Severity.warning,
            room_id=None,
            room_name=None,
            building_name="McNulty Hall",
            description="McNulty Hall 3rd floor shows occupancy sensor activity 30% of the time with no corresponding bookings. Rooms are being used without reservation.",
            recommended_action="Investigate unauthorized access on the 3rd floor. Consider adding badge-in requirements.",
            supporting_data={"unbooked_occupied_hours": 45, "total_occupied_hours": 150},
            detected_at=now,
        ),
        AIAnomalyReport(
            id="anom_003",
            type=AnomalyType.space_hoarding,
            severity=Severity.warning,
            room_id=None,
            room_name=None,
            building_name="Walsh Library",
            description="User dept_bio is block-booking 5 study rooms simultaneously every Tuesday and Thursday 9am-5pm, but average headcount across all rooms is only 4 people.",
            recommended_action="Review department booking policy. Suggest consolidating to fewer rooms.",
            supporting_data={"rooms_booked": 5, "avg_headcount": 4, "pattern": "Tue/Thu 9-5"},
            detected_at=now,
        ),
    ]
