"""AI endpoints — search, recommendations, predictions, anomalies.

All endpoints are wired to real Claude API calls via services/ai_service.py.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from middleware.auth import UserPayload, get_current_user, require_role
from middleware.rate_limit import rate_limit_user
from models.schemas import UserRole, AISearchRequest
from services.database import get_db

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/search", response_model=dict)
async def ai_search(
    body: AISearchRequest,
    user: UserPayload = Depends(get_current_user),
    _: None = Depends(rate_limit_user(max_requests=10, window_seconds=60)),
):
    """Natural language space search powered by Claude."""
    from services.ai_service import ai_search as _ai_search
    db = await get_db()
    return await _ai_search(body.query, db)


@router.get("/recommendations", response_model=list)
async def ai_recommendations(
    user: UserPayload = Depends(get_current_user),
    _: None = Depends(rate_limit_user(max_requests=5, window_seconds=60)),
):
    """Smart room recommendations for the current user."""
    from services.ai_service import ai_recommendations as _ai_recommendations
    db = await get_db()
    return await _ai_recommendations(user.user_id, db)


class PredictRequest(BaseModel):
    days: int = 7


@router.post("/predict", response_model=list)
async def ai_predict(
    body: PredictRequest = PredictRequest(),
    building_id: Optional[str] = None,
    user: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Predictive analytics — forecast utilization."""
    from services.ai_service import ai_predict as _ai_predict
    db = await get_db()
    return await _ai_predict(db, building_id=building_id, days_ahead=body.days)


@router.post("/anomalies", response_model=list)
async def ai_detect_anomalies(
    user: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Anomaly detection — identify unusual booking/usage patterns."""
    from services.ai_service import ai_anomalies as _ai_anomalies
    db = await get_db()
    return await _ai_anomalies(db)
