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

# Known SHU building name patterns -> (code, full name)
LOCATION_PATTERNS = {
    r"jubilee|jub\b":               ("JUB", "Jubilee Hall"),
    r"walsh\s*lib|library":         ("WLB", "Walsh Library"),
    r"mcnulty|mcn\b":              ("MCN", "McNulty Hall"),
    r"corrigan|cor\b":             ("COR", "Corrigan Hall"),
    r"university\s*center|galleon": ("UC",  "University Center"),
    r"arts?\s*(?:and|&)\s*sci":    ("A&S", "Arts & Sciences Hall"),
    r"schwartz":                    ("SCH", "Schwartz Hall"),
    r"boland":                      ("BOL", "Boland Hall"),
    r"xavier":                      ("XAV", "Xavier Hall"),
    r"fahy":                        ("FAH", "Fahy Hall"),
    r"chapel|immaculate":           ("CHP", "Chapel of the Immaculate Conception"),
    r"rec\w*\s*center|gym":        ("REC", "Recreation Center"),
    r"stafford":                    ("STA", "Stafford Hall"),
    r"bayley":                      ("BAY", "Bayley Hall"),
    r"presidents":                  ("PRE", "Presidents Hall"),
    r"aquinas":                     ("AQU", "Aquinas Hall"),
    r"serra":                       ("SER", "Serra Hall"),
    r"mooney":                      ("MOO", "Mooney Hall"),
}

# Default room type per building code
BUILDING_ROOM_TYPES = {
    "A&S": "classroom",
    "MCN": "science_lab",
    "FAH": "classroom",
    "SCH": "classroom",
    "COR": "classroom",
    "JUB": "classroom",
    "BOL": "classroom",
    "XAV": "classroom",
    "MOO": "classroom",
    "STA": "classroom",
    "BAY": "classroom",
    "PRE": "classroom",
    "AQU": "classroom",
    "SER": "classroom",
    "WLB": "study_room",
    "UC":  "multipurpose",
    "CHP": "event_space",
    "REC": "event_space",
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
    Auto-creates buildings and rooms that don't exist yet.
    Updates campus_events with matched building_id and room_id.
    Returns count of events matched.
    """
    db = await get_db()

    # Load existing buildings keyed by code
    cursor = await db.execute("SELECT id, code, name FROM buildings")
    buildings = {r["code"]: dict(r) for r in await cursor.fetchall()}
    building_names = {r["name"].lower(): r for r in buildings.values()}

    # Load existing rooms
    cursor = await db.execute("""
        SELECT r.id, r.name, f.building_id, b.code AS building_code
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
    """)
    rooms = [dict(r) for r in await cursor.fetchall()]

    # Track floors we've created: (building_id, floor_num) -> floor_id
    cursor = await db.execute("SELECT id, building_id, floor_number FROM floors")
    existing_floors = {(r["building_id"], r["floor_number"]): r["id"] for r in await cursor.fetchall()}

    # Get unmatched events
    cursor = await db.execute(
        "SELECT id, location, name FROM campus_events WHERE building_id IS NULL AND location IS NOT NULL AND location != ''"
    )
    events = [dict(r) for r in await cursor.fetchall()]

    created_buildings = 0
    created_rooms = 0
    matched = 0

    for event in events:
        loc = event["location"].lower()
        building_id = None
        matched_code = None
        matched_name = None
        room_id = None

        # Try pattern matching
        for pattern, (code, full_name) in LOCATION_PATTERNS.items():
            if re.search(pattern, loc, re.IGNORECASE):
                matched_code = code
                matched_name = full_name
                if code in buildings:
                    building_id = buildings[code]["id"]
                break

        # Try direct building name match
        if not building_id and not matched_code:
            for bname, bdata in building_names.items():
                if bname in loc:
                    building_id = bdata["id"]
                    matched_code = bdata["code"]
                    break

        # Auto-create building if pattern matched but building doesn't exist
        if not building_id and matched_code:
            building_id = f"bld_{uuid.uuid4().hex[:8]}"
            await db.execute(
                "INSERT INTO buildings VALUES (?,?,?,?,?,NULL,NULL)",
                (building_id, matched_name, matched_code, "400 South Orange Ave, South Orange, NJ 07079", 4),
            )
            buildings[matched_code] = {"id": building_id, "code": matched_code, "name": matched_name}
            building_names[matched_name.lower()] = buildings[matched_code]
            # Create 4 default floors
            for fn in range(1, 5):
                fid = f"flr_{uuid.uuid4().hex[:8]}"
                await db.execute("INSERT INTO floors VALUES (?,?,?,?)", (fid, building_id, fn, f"Floor {fn}"))
                existing_floors[(building_id, fn)] = fid
            created_buildings += 1
            print(f"    Auto-created building: {matched_name} ({matched_code})")

        # Try to match or create room
        if building_id:
            room_match = re.search(r'(\d{2,4})', event["location"])
            if room_match:
                room_num = room_match.group(1)
                # Check existing rooms
                for room in rooms:
                    if room["building_id"] == building_id and room_num in room["name"]:
                        room_id = room["id"]
                        break

                # Auto-create room if not found
                if not room_id:
                    floor_num = int(room_num[0]) if len(room_num) >= 3 else 1
                    floor_num = min(floor_num, 4)  # cap at 4 floors
                    floor_key = (building_id, floor_num)
                    floor_id = existing_floors.get(floor_key)
                    if not floor_id:
                        floor_id = f"flr_{uuid.uuid4().hex[:8]}"
                        await db.execute("INSERT INTO floors VALUES (?,?,?,?)", (floor_id, building_id, floor_num, f"Floor {floor_num}"))
                        existing_floors[floor_key] = floor_id

                    room_id = f"rm_{uuid.uuid4().hex[:8]}"
                    room_name = f"Room {room_num}"
                    room_type = BUILDING_ROOM_TYPES.get(matched_code or "", "multipurpose")
                    # Special case: Walsh Library Solutions Studio
                    if matched_code == "WLB" and "solution" in event["location"].lower():
                        room_type = "maker_space"
                    await db.execute(
                        "INSERT INTO rooms VALUES (?,?,?,?,?,NULL,1,'available',NULL)",
                        (room_id, floor_id, room_name, room_type, 30),
                    )
                    rooms.append({"id": room_id, "name": room_name, "building_id": building_id, "building_code": matched_code or ""})
                    created_rooms += 1

        if building_id:
            await db.execute(
                "UPDATE campus_events SET building_id = ?, room_id = ? WHERE id = ?",
                (building_id, room_id, event["id"]),
            )
            matched += 1

    await db.commit()
    if created_buildings or created_rooms:
        print(f"    Auto-created {created_buildings} buildings, {created_rooms} rooms from events")
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
