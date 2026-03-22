#!/usr/bin/env python3
"""Test the full events scraping pipeline locally."""

import asyncio
import sys
sys.path.insert(0, ".")


async def main():
    from services.database import init_db
    await init_db()

    from services.events_scraper import scrape_all_events, create_bookings_from_events, get_upcoming_events

    # Full scrape with pagination
    print("=" * 60)
    print("  Full Event Scrape")
    print("=" * 60)
    stats = await scrape_all_events(scrape_past=True, max_pages=5)
    print(f"\nResults:")
    print(f"  Added:   {stats['added']}")
    print(f"  Skipped: {stats['skipped']} (already in DB)")
    print(f"  Matched: {stats['matched']} (auto-matched to buildings)")
    print(f"  Total:   {stats['total_fetched']} fetched from API")

    # Create bookings
    print(f"\n{'=' * 60}")
    print("  Creating Bookings from Events")
    print("=" * 60)
    bookings = await create_bookings_from_events()
    print(f"  Bookings created: {bookings}")

    # Show upcoming events
    print(f"\n{'=' * 60}")
    print("  Upcoming Events")
    print("=" * 60)
    events = await get_upcoming_events(limit=15)
    for e in events:
        matched = ""
        if e.get("building_id"):
            matched = f" [MATCHED: bld={e['building_id']}"
            if e.get("room_id"):
                matched += f", room={e['room_id']}"
            if e.get("booking_id"):
                matched += f", booking={e['booking_id']}"
            matched += "]"
        print(f"  {e['starts_at'][:16]} | {e['name'][:45]:<45} | {e.get('location', '')[:30]}{matched}")

    # Count totals
    from services.database import get_db
    db = await get_db()
    cursor = await db.execute("SELECT COUNT(*) FROM campus_events")
    total = (await cursor.fetchone())[0]
    cursor = await db.execute("SELECT COUNT(*) FROM campus_events WHERE building_id IS NOT NULL")
    matched_total = (await cursor.fetchone())[0]
    cursor = await db.execute("SELECT COUNT(*) FROM campus_events WHERE booking_id IS NOT NULL")
    booked = (await cursor.fetchone())[0]

    print(f"\n  Total events in DB: {total}")
    print(f"  Matched to buildings: {matched_total}")
    print(f"  With bookings: {booked}")


asyncio.run(main())
