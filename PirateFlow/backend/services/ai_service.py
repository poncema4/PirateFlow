"""
AI service — real Claude API integration for search, recommendations,
predictions, and anomaly detection.

Each function fetches relevant DB data and sends it to Claude for analysis.
Returns empty results if ANTHROPIC_API_KEY is not set.
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

import anthropic

_client: Optional[anthropic.AsyncAnthropic] = None

MODEL = "claude-sonnet-4-20250514"


def _get_client() -> Optional[anthropic.AsyncAnthropic]:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return None
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


def _parse_json(text: str) -> list | dict:
    """Parse JSON from Claude response, stripping markdown fences if present."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:cleaned.rfind("```")]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# AI Search
# ---------------------------------------------------------------------------

async def ai_search(query: str, db) -> dict:
    """Search for rooms using natural language via Claude."""
    client = _get_client()
    if not client:
        return {"query": query, "results": [], "ai_fallback": True}

    # Fetch all available rooms
    cursor = await db.execute("""
        SELECT r.id, r.name, r.room_type, r.capacity, r.status, r.hourly_rate,
               r.description, b.name AS building_name, f.name AS floor_name,
               GROUP_CONCAT(re.equipment_type) AS equipment_csv
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        LEFT JOIN room_equipment re ON re.room_id = r.id
        GROUP BY r.id
        ORDER BY b.name, r.name
    """)
    rooms = [dict(r) for r in await cursor.fetchall()]

    if not rooms:
        return {"query": query, "results": [], "ai_fallback": False}

    rooms_json = json.dumps([{
        "id": r["id"], "name": r["name"], "type": r["room_type"],
        "capacity": r["capacity"], "status": r["status"],
        "building": r["building_name"], "floor": r["floor_name"],
        "hourly_rate": r["hourly_rate"], "description": r["description"],
        "equipment": r["equipment_csv"].split(",") if r["equipment_csv"] else [],
    } for r in rooms], indent=2)

    try:
        response = await client.messages.create(
            model=MODEL, max_tokens=1024, temperature=0.3,
            system="You are a campus room search assistant. Given a list of available rooms and a user's query, return the most relevant rooms ranked by match quality. Respond ONLY with a JSON array of objects with fields: room_id, room_name, building_name, room_type, capacity, confidence (0-1), reasoning, equipment (array), status.",
            messages=[{"role": "user", "content": f"Available rooms:\n{rooms_json}\n\nUser query: \"{query}\"\n\nReturn the top matching rooms as a JSON array."}],
        )
        results = _parse_json(response.content[0].text)
        return {"query": query, "results": results, "ai_fallback": False}
    except Exception as e:
        print(f"[ai_service] search failed: {e}")
        return {"query": query, "results": [], "ai_fallback": True}


# ---------------------------------------------------------------------------
# AI Recommendations
# ---------------------------------------------------------------------------

async def ai_recommendations(user_id: str, db) -> list:
    """Get personalized room recommendations based on booking history."""
    client = _get_client()
    if not client:
        return []

    # Get user's recent bookings
    cursor = await db.execute("""
        SELECT bk.title, bk.start_time, bk.end_time, bk.booking_type,
               r.name AS room_name, r.room_type, r.capacity, b.name AS building_name
        FROM bookings bk
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        WHERE bk.user_id = ? AND bk.status != 'cancelled'
        ORDER BY bk.start_time DESC LIMIT 20
    """, (user_id,))
    history = [dict(r) for r in await cursor.fetchall()]

    # Get available rooms
    cursor = await db.execute("""
        SELECT r.id, r.name, r.room_type, r.capacity, r.status,
               b.name AS building_name,
               GROUP_CONCAT(re.equipment_type) AS equipment_csv
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        LEFT JOIN room_equipment re ON re.room_id = r.id
        WHERE r.status = 'available'
        GROUP BY r.id
    """)
    rooms = [dict(r) for r in await cursor.fetchall()]

    if not rooms:
        return []

    try:
        response = await client.messages.create(
            model=MODEL, max_tokens=1024, temperature=0.4,
            system="You are a campus room recommendation engine. Based on a user's booking history and available rooms, suggest rooms they'd likely want to book. Respond ONLY with a JSON array of objects: room_id, room_name, building_name, explanation, relevance_score (0-1).",
            messages=[{"role": "user", "content": f"Booking history:\n{json.dumps(history, indent=2)}\n\nAvailable rooms:\n{json.dumps([{k: r[k] for k in ['id','name','room_type','capacity','building_name']} for r in rooms], indent=2)}\n\nRecommend the best rooms."}],
        )
        return _parse_json(response.content[0].text)
    except Exception as e:
        print(f"[ai_service] recommendations failed: {e}")
        return []


# ---------------------------------------------------------------------------
# AI Predictions
# ---------------------------------------------------------------------------

async def ai_predict(db, building_id: Optional[str] = None, days_ahead: int = 7) -> list:
    """Predict utilization based on historical data."""
    client = _get_client()
    if not client:
        return []

    # Get historical booking data
    conditions = ["bk.status != 'cancelled'"]
    params = []
    if building_id:
        conditions.append("fl.building_id = ?")
        params.append(building_id)

    where = " AND ".join(conditions)
    cursor = await db.execute(f"""
        SELECT b.id AS building_id, b.name AS building_name,
               CAST(strftime('%w', bk.start_time) AS INTEGER) AS day_of_week,
               CAST(strftime('%H', bk.start_time) AS INTEGER) AS hour,
               COUNT(*) AS booking_count
        FROM bookings bk
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors fl ON r.floor_id = fl.id
        JOIN buildings b ON fl.building_id = b.id
        WHERE {where}
        GROUP BY b.id, day_of_week, hour
        ORDER BY b.name, day_of_week, hour
    """, params)
    historical = [dict(r) for r in await cursor.fetchall()]

    # Get building list
    cursor = await db.execute("SELECT id, name FROM buildings")
    buildings = [dict(r) for r in await cursor.fetchall()]

    if not buildings:
        return []

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    try:
        response = await client.messages.create(
            model=MODEL, max_tokens=2048, temperature=0.3,
            system=f"You are a campus utilization forecasting model. Based on historical booking patterns, predict utilization for the next {days_ahead} days starting from {today}. Respond ONLY with a JSON array of objects: building_id, building_name, date (YYYY-MM-DD), hour (8-21), predicted_utilization (0.0-1.0).",
            messages=[{"role": "user", "content": f"Buildings: {json.dumps(buildings)}\n\nHistorical booking patterns (day_of_week 0=Sun, hour, count):\n{json.dumps(historical, indent=2)}\n\nPredict utilization for the next {days_ahead} days."}],
        )
        return _parse_json(response.content[0].text)
    except Exception as e:
        print(f"[ai_service] predict failed: {e}")
        return []


# ---------------------------------------------------------------------------
# AI Anomaly Detection
# ---------------------------------------------------------------------------

async def ai_anomalies(db) -> list:
    """Detect anomalies in booking and access patterns."""
    client = _get_client()
    if not client:
        return []

    # Get recent bookings with no-show patterns
    cursor = await db.execute("""
        SELECT u.first_name || ' ' || u.last_name AS user_name,
               u.id AS user_id,
               r.name AS room_name, r.id AS room_id,
               b.name AS building_name,
               bk.status, bk.start_time, bk.end_time, bk.title
        FROM bookings bk
        JOIN users u ON bk.user_id = u.id
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        ORDER BY bk.start_time DESC LIMIT 100
    """)
    bookings = [dict(r) for r in await cursor.fetchall()]

    # Get recent access events
    cursor = await db.execute("""
        SELECT ae.*, u.first_name || ' ' || u.last_name AS user_name,
               r.name AS room_name, b.name AS building_name
        FROM access_events ae
        LEFT JOIN users u ON ae.user_id = u.id
        JOIN rooms r ON ae.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        ORDER BY ae.timestamp DESC LIMIT 100
    """)
    events = [dict(r) for r in await cursor.fetchall()]

    if not bookings and not events:
        return []

    now = datetime.now(timezone.utc).isoformat()

    try:
        response = await client.messages.create(
            model=MODEL, max_tokens=2048, temperature=0.3,
            system="""You are a campus security and space management anomaly detector. Analyze booking and access patterns to find anomalies like:
- ghost_booking: user books but never shows up
- phantom_usage: room is occupied but no booking exists
- space_hoarding: user/dept books many rooms but uses few
- unauthorized_access: person enters without booking/permission
- unusual_pattern: any other suspicious pattern

Respond ONLY with a JSON array of anomaly objects: id (anom_001, etc), type (one of the above), severity (critical/warning/info), room_id (nullable), room_name (nullable), building_name (nullable), description, recommended_action, supporting_data (object), detected_at (ISO timestamp).""",
            messages=[{"role": "user", "content": f"Current time: {now}\n\nRecent bookings:\n{json.dumps(bookings[:50], indent=2)}\n\nRecent access events:\n{json.dumps(events[:50], indent=2)}\n\nFind anomalies."}],
        )
        return _parse_json(response.content[0].text)
    except Exception as e:
        print(f"[ai_service] anomalies failed: {e}")
        return []
