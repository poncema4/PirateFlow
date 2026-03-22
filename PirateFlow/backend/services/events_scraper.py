"""
Campus events scraper for SHU CampusLabs Engage platform.

Scrapes https://shu.campuslabs.com/engage/api/discovery/event/search
to get real campus events. Runs on a schedule:
  - Full scrape on startup (past + future events, paginated)
  - Refresh every 2 hours for new events
  - Auto-matches event locations to buildings/rooms in our DB
  - Creates bookings from events so they show on the calendar

Rate limiting: 2 second delay between paginated requests.
Permission granted by SHU IT admin.
"""

import asyncio
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from services.database import get_db

ENGAGE_API = "https://shu.campuslabs.com/engage/api/discovery/event/search"
ENGAGE_IMAGE_BASE = "https://shu.campuslabs.com/engage/image/"
PAGE_SIZE = 100
RATE_LIMIT_DELAY = 2.0  # seconds between API requests

# Known SHU building name patterns -> building codes for auto-matching
LOCATION_PATTERNS = {
    r"jubilee|jub\b": "JUB",
    r"walsh\s*lib": "WAL",
    r"mcnulty|mcn\b": "MCN",
    r"corrigan|cor\b": "COR",
    r"university\s*center|galleon": "UC",
    r"arts?\s*(?:and|&)\s*sci": "A&S",
    r"schwartz|nu\b": "SCH",
    r"boland": "BOL",
    r"xavier": "XAV",
    r"fahy": "FAH",
    r"chapel|immaculate": "CHP",
    r"rec\w*\s*center|gym": "REC",
    r"stafford": "STP",
    r"bayley": "BAY",
    r"presidents": "PRE",
    r"aquinas": "AQU",
    r"serra": "SER",
}


# ---------------------------------------------------------------------------
# Core scraping
# ---------------------------------------------------------------------------

async def scrape_all_events(
    scrape_past: bool = True,
    max_pages: int = 50,
) -> dict:
    """Full paginated scrape of CampusLabs events.

    Returns: {"added": int, "skipped": int, "total_fetched": int, "matched": int}
    """
    now = datetime.now(timezone.utc)
    stats = {"added": 0, "skipped": 0, "total_fetched": 0, "matched": 0}

    # Scrape future events (most important)
    print("[events_scraper] Scraping future events...")
    await _scrape_pages(
        starts_after=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        order_direction="ascending",
        max_pages=max_pages,
        stats=stats,
    )

    # Scrape past events (for historical data / analytics)
    if scrape_past:
        print("[events_scraper] Scraping past events (last 90 days)...")
        ninety_days_ago = (now - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
        await _scrape_pages(
            starts_after=ninety_days_ago,
            ends_before=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            order_direction="descending",
            max_pages=max_pages // 2,
            stats=stats,
        )

    # Auto-match locations to buildings/rooms
    matched = await _auto_match_locations()
    stats["matched"] = matched

    print(f"[events_scraper] Done: {stats['added']} added, {stats['skipped']} skipped, "
          f"{stats['matched']} matched to buildings, {stats['total_fetched']} total fetched")
    return stats


async def _scrape_pages(
    starts_after: str = None,
    ends_before: str = None,
    order_direction: str = "ascending",
    max_pages: int = 50,
    stats: dict = None,
):
    """Paginate through CampusLabs API results."""
    if stats is None:
        stats = {"added": 0, "skipped": 0, "total_fetched": 0}

    for page in range(max_pages):
        skip = page * PAGE_SIZE
        params = {
            "orderByField": "startsOn",
            "orderByDirection": order_direction,
            "status": "Approved",
            "take": str(PAGE_SIZE),
            "skip": str(skip),
        }
        if starts_after:
            params["startsAfter"] = starts_after
        if ends_before:
            params["endsBefore"] = ends_before

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(ENGAGE_API, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            print(f"[events_scraper] API error on page {page}: {e}")
            break

        items = data.get("value", [])
        if not items:
            break

        stats["total_fetched"] += len(items)

        db = await get_db()
        scraped_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        for item in items:
            ext_id = str(item.get("id", ""))
            if not ext_id:
                continue

            # Skip if already exists
            cursor = await db.execute(
                "SELECT id FROM campus_events WHERE external_id = ?", (ext_id,)
            )
            if await cursor.fetchone():
                stats["skipped"] += 1
                continue

            event_id = f"cev_{uuid.uuid4().hex[:8]}"
            name = (item.get("name") or "").strip()
            description = (item.get("description") or "").strip()
            location = (item.get("location") or "").strip()
            starts_at = item.get("startsOn", "")
            ends_at = item.get("endsOn", "")

            # Image
            image_id = item.get("imagePath") or item.get("imageUrl") or ""
            image_url = f"{ENGAGE_IMAGE_BASE}{image_id}" if image_id else None

            # Organization
            org_name = ""
            if item.get("organizationName"):
                org_name = item["organizationName"]
            elif item.get("organizationNames"):
                org_name = ", ".join(item["organizationNames"][:3])

            # Categories
            categories = ""
            if item.get("categoryNames"):
                categories = ", ".join(item["categoryNames"][:5])

            await db.execute(
                "INSERT INTO campus_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (event_id, ext_id, name, description, location,
                 starts_at, ends_at, image_url, org_name, categories, scraped_at,
                 None, None, None),
            )
            stats["added"] += 1

        await db.commit()

        total_available = data.get("@odata.count", 0)
        print(f"[events_scraper]   Page {page + 1}: {len(items)} events "
              f"(+{stats['added']} new, {stats['skipped']} existing)")

        # Stop if we've gotten all events
        if skip + len(items) >= total_available or len(items) < PAGE_SIZE:
            break

        # Rate limit
        await asyncio.sleep(RATE_LIMIT_DELAY)


# ---------------------------------------------------------------------------
# Auto-match locations to buildings/rooms
# ---------------------------------------------------------------------------

async def _auto_match_locations() -> int:
    """Match event locations to buildings/rooms in our DB.
    Updates campus_events with matched building_id and room_id.
    Returns count of events matched.
    """
    db = await get_db()

    # Get all buildings with their codes
    cursor = await db.execute("SELECT id, code, name FROM buildings")
    buildings = {r["code"]: r for r in await cursor.fetchall()}
    building_names = {r["name"].lower(): r for r in buildings.values()}

    # Get all rooms
    cursor = await db.execute("""
        SELECT r.id, r.name, f.building_id, b.code AS building_code, b.name AS building_name
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
    """)
    rooms = [dict(r) for r in await cursor.fetchall()]

    # Get unmatched events
    cursor = await db.execute(
        "SELECT id, location, name FROM campus_events WHERE building_id IS NULL AND location IS NOT NULL AND location != ''"
    )
    events = [dict(r) for r in await cursor.fetchall()]

    matched = 0
    for event in events:
        loc = event["location"].lower()
        building_id = None
        room_id = None

        # Try pattern matching first
        for pattern, code in LOCATION_PATTERNS.items():
            if re.search(pattern, loc, re.IGNORECASE):
                if code in buildings:
                    building_id = buildings[code]["id"]
                break

        # Try direct building name match
        if not building_id:
            for bname, bdata in building_names.items():
                if bname in loc:
                    building_id = bdata["id"]
                    break

        # Try to match specific room (e.g., "Jubilee 430" -> room 430 in Jubilee)
        if building_id:
            room_match = re.search(r'(\d{2,4})', event["location"])
            if room_match:
                room_num = room_match.group(1)
                for room in rooms:
                    if (room["building_id"] == building_id and
                            room_num in room["name"]):
                        room_id = room["id"]
                        break

        if building_id:
            await db.execute(
                "UPDATE campus_events SET building_id = ?, room_id = ? WHERE id = ?",
                (building_id, room_id, event["id"]),
            )
            matched += 1

    await db.commit()
    return matched


# ---------------------------------------------------------------------------
# Create bookings from events
# ---------------------------------------------------------------------------

async def create_bookings_from_events() -> int:
    """Create bookings in the system from matched campus events.
    Only creates bookings for events that:
    - Have a matched room_id
    - Don't already have a corresponding booking
    - Are in the future
    Returns count of bookings created.
    """
    db = await get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    cursor = await db.execute("""
        SELECT ce.id, ce.name, ce.starts_at, ce.ends_at, ce.room_id, ce.organization
        FROM campus_events ce
        WHERE ce.room_id IS NOT NULL
          AND ce.starts_at >= ?
          AND ce.booking_id IS NULL
    """, (now,))
    events = [dict(r) for r in await cursor.fetchall()]

    # Get or create a system user for event bookings
    cursor = await db.execute("SELECT id FROM users WHERE email = 'events@shu.edu'")
    sys_user = await cursor.fetchone()
    if not sys_user:
        sys_user_id = f"usr_{uuid.uuid4().hex[:8]}"
        from services.auth import hash_password
        await db.execute(
            "INSERT INTO users VALUES (?,?,?,?,?,?,NULL,NULL,NULL,NULL,?)",
            (sys_user_id, "events@shu.edu", hash_password("events-system"),
             "Campus", "Events", "staff", now),
        )
        await db.commit()
    else:
        sys_user_id = sys_user["id"]

    created = 0
    for event in events:
        booking_id = f"bk_{uuid.uuid4().hex[:8]}"

        # Check for time conflict
        cursor = await db.execute("""
            SELECT COUNT(*) FROM bookings
            WHERE room_id = ? AND status = 'confirmed'
            AND start_time < ? AND end_time > ?
        """, (event["room_id"], event["ends_at"], event["starts_at"]))
        conflict = (await cursor.fetchone())[0]
        if conflict > 0:
            continue

        await db.execute(
            "INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (booking_id, event["room_id"], sys_user_id, None,
             event["name"], f"Campus event: {event['organization'] or 'SHU'}",
             event["starts_at"], event["ends_at"],
             "confirmed", "internal_department", now, None),
        )

        # Link event to booking
        await db.execute(
            "UPDATE campus_events SET booking_id = ? WHERE id = ?",
            (booking_id, event["id"]),
        )
        created += 1

    await db.commit()
    if created:
        print(f"[events_scraper] Created {created} bookings from campus events")
    return created


# ---------------------------------------------------------------------------
# Scheduled scraper (background task)
# ---------------------------------------------------------------------------

_scraper_task: Optional[asyncio.Task] = None


async def start_scheduled_scraper(interval_hours: float = 2.0):
    """Start the background scraper that runs periodically."""
    global _scraper_task
    if _scraper_task and not _scraper_task.done():
        return

    async def _run():
        # Initial full scrape
        await scrape_all_events(scrape_past=True)
        await create_bookings_from_events()

        while True:
            await asyncio.sleep(interval_hours * 3600)
            try:
                print(f"[events_scraper] Scheduled refresh...")
                await scrape_all_events(scrape_past=False, max_pages=10)
                await create_bookings_from_events()
            except Exception as e:
                print(f"[events_scraper] Scheduled scrape failed: {e}")

    _scraper_task = asyncio.create_task(_run())
    print(f"[events_scraper] Scheduled scraper started (every {interval_hours}h)")


async def stop_scheduled_scraper():
    """Stop the background scraper."""
    global _scraper_task
    if _scraper_task:
        _scraper_task.cancel()
        _scraper_task = None


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

async def get_upcoming_events(limit: int = 20, location: str = None) -> list:
    """Get upcoming events from DB."""
    db = await get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    conditions = ["starts_at >= ?"]
    params = [now]

    if location:
        conditions.append("location LIKE ?")
        params.append(f"%{location}%")

    where = " AND ".join(conditions)
    cursor = await db.execute(
        f"SELECT * FROM campus_events WHERE {where} ORDER BY starts_at ASC LIMIT ?",
        params + [limit],
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_events_for_date(date: str) -> list:
    """Get events for a specific date (YYYY-MM-DD)."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM campus_events WHERE starts_at LIKE ? ORDER BY starts_at ASC",
        (f"{date}%",),
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_events_at_location(location: str) -> list:
    """Get events at a specific location."""
    db = await get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cursor = await db.execute(
        "SELECT * FROM campus_events WHERE location LIKE ? AND starts_at >= ? ORDER BY starts_at ASC LIMIT 20",
        (f"%{location}%", now),
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_events_for_building(building_id: str, limit: int = 20) -> list:
    """Get upcoming events for a specific building."""
    db = await get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cursor = await db.execute(
        "SELECT * FROM campus_events WHERE building_id = ? AND starts_at >= ? ORDER BY starts_at ASC LIMIT ?",
        (building_id, now, limit),
    )
    return [dict(r) for r in await cursor.fetchall()]
