"""
Database query helpers for PirateFlow.

Encapsulates common SQL queries so routers don't write raw SQL.
All functions take a db connection (from get_db()) as first arg.
"""

import uuid
from datetime import datetime, timedelta


# ===================================================================
# BUILDINGS
# ===================================================================

async def get_all_buildings(db):
    """Return all buildings with room count and current occupancy %."""
    cursor = await db.execute("""
        SELECT b.id, b.name, b.code, b.address, b.total_floors, b.latitude, b.longitude,
               COUNT(r.id) AS room_count,
               COALESCE(SUM(CASE WHEN ro.headcount > 0 THEN 1 ELSE 0 END), 0) AS occupied_rooms
        FROM buildings b
        LEFT JOIN floors f ON f.building_id = b.id
        LEFT JOIN rooms r ON r.floor_id = f.id
        LEFT JOIN room_occupancy ro ON ro.room_id = r.id
        GROUP BY b.id
    """)
    rows = await cursor.fetchall()
    results = []
    for r in rows:
        room_count = r["room_count"]
        occ_pct = round(r["occupied_rooms"] / room_count, 2) if room_count > 0 else 0.0
        results.append({
            "id": r["id"], "name": r["name"], "code": r["code"],
            "address": r["address"], "total_floors": r["total_floors"],
            "latitude": r["latitude"], "longitude": r["longitude"],
            "room_count": room_count, "current_occupancy_pct": occ_pct,
        })
    return results


async def get_building_by_id(db, building_id: str):
    """Return a single building with floors and room summaries."""
    cursor = await db.execute(
        "SELECT * FROM buildings WHERE id = ?", (building_id,)
    )
    building = await cursor.fetchone()
    if not building:
        return None

    cursor = await db.execute(
        "SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number", (building_id,)
    )
    floors = await cursor.fetchall()

    cursor = await db.execute("""
        SELECT r.*, f.name AS floor_name, b.name AS building_name,
               GROUP_CONCAT(re.equipment_type) AS equipment_csv
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        LEFT JOIN room_equipment re ON re.room_id = r.id
        WHERE f.building_id = ?
        GROUP BY r.id
        ORDER BY f.floor_number, r.name
    """, (building_id,))
    rooms = await cursor.fetchall()

    return {"building": building, "floors": floors, "rooms": rooms}


# ===================================================================
# ROOMS
# ===================================================================

async def get_rooms_filtered(db, building_id=None, floor_id=None, room_type=None,
                              min_capacity=None, equipment=None, page=1, page_size=20):
    """Return filtered, paginated rooms with equipment and building/floor names."""
    conditions = []
    params = []

    if building_id:
        conditions.append("f.building_id = ?")
        params.append(building_id)
    if floor_id:
        conditions.append("r.floor_id = ?")
        params.append(floor_id)
    if room_type:
        conditions.append("r.room_type = ?")
        params.append(room_type)
    if min_capacity:
        conditions.append("r.capacity >= ?")
        params.append(min_capacity)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"""
        SELECT COUNT(DISTINCT r.id)
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        {where}
    """
    cursor = await db.execute(count_sql, params)
    total = (await cursor.fetchone())[0]

    # Get page of rooms
    offset = (page - 1) * page_size
    sql = f"""
        SELECT r.id, r.name, r.room_type, r.capacity, r.status, r.hourly_rate,
               r.is_bookable, r.description,
               f.id AS floor_id, f.name AS floor_name,
               b.id AS building_id, b.name AS building_name,
               GROUP_CONCAT(re.equipment_type) AS equipment_csv
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        LEFT JOIN room_equipment re ON re.room_id = r.id
        {where}
        GROUP BY r.id
        ORDER BY b.name, f.floor_number, r.name
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(sql, params + [page_size, offset])
    rows = await cursor.fetchall()

    items = []
    for r in rows:
        equip = r["equipment_csv"].split(",") if r["equipment_csv"] else []
        # Filter by equipment if requested
        if equipment:
            if not all(e in equip for e in equipment):
                continue
        items.append({
            "id": r["id"], "name": r["name"], "room_type": r["room_type"],
            "capacity": r["capacity"], "status": r["status"],
            "hourly_rate": r["hourly_rate"], "is_bookable": bool(r["is_bookable"]),
            "description": r["description"],
            "floor_id": r["floor_id"], "floor_name": r["floor_name"],
            "building_id": r["building_id"], "building_name": r["building_name"],
            "equipment": equip,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_room_by_id(db, room_id: str):
    """Return full room detail with equipment and upcoming bookings."""
    cursor = await db.execute("""
        SELECT r.*, f.id AS floor_id, f.name AS floor_name,
               b.id AS building_id, b.name AS building_name
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        WHERE r.id = ?
    """, (room_id,))
    room = await cursor.fetchone()
    if not room:
        return None

    # Equipment
    cursor = await db.execute(
        "SELECT equipment_type FROM room_equipment WHERE room_id = ?", (room_id,)
    )
    equip_rows = await cursor.fetchall()
    equipment = [r["equipment_type"] for r in equip_rows]

    # Upcoming bookings
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    cursor = await db.execute("""
        SELECT bk.*, u.first_name || ' ' || u.last_name AS user_name
        FROM bookings bk
        JOIN users u ON bk.user_id = u.id
        WHERE bk.room_id = ? AND bk.end_time > ? AND bk.status = 'confirmed'
        ORDER BY bk.start_time
        LIMIT 10
    """, (room_id, now))
    bookings = await cursor.fetchall()

    return {
        "room": room,
        "equipment": equipment,
        "upcoming_bookings": bookings,
    }


async def get_room_availability(db, room_id: str, date: str):
    """Return hourly time slots for a room on a given date showing booked vs free."""
    # Get bookings for that date
    date_start = f"{date}T00:00:00Z"
    date_end = f"{date}T23:59:59Z"

    cursor = await db.execute("""
        SELECT id, start_time, end_time
        FROM bookings
        WHERE room_id = ? AND start_time < ? AND end_time > ? AND status = 'confirmed'
        ORDER BY start_time
    """, (room_id, date_end, date_start))
    bookings = await cursor.fetchall()

    slots = []
    for hour in range(8, 22):
        slot_start = f"{date}T{hour:02d}:00:00Z"
        slot_end = f"{date}T{hour + 1:02d}:00:00Z"

        booking_id = None
        for bk in bookings:
            if bk["start_time"] < slot_end and bk["end_time"] > slot_start:
                booking_id = bk["id"]
                break

        slots.append({
            "start_time": f"{hour:02d}:00",
            "end_time": f"{hour + 1:02d}:00",
            "status": "booked" if booking_id else "available",
            "booking_id": booking_id,
        })

    return slots


# ===================================================================
# BOOKINGS
# ===================================================================

async def create_booking(db, room_id, user_id, title, start_time, end_time,
                          booking_type="internal_student", club_id=None, purpose=None):
    """Insert a new booking and return its ID."""
    import uuid
    booking_id = f"bk_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    start_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_str = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    await db.execute(
        "INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (booking_id, room_id, user_id, club_id, title, purpose,
         start_str, end_str, "confirmed", booking_type, now, None),
    )
    await db.commit()
    return booking_id


async def check_booking_conflict(db, room_id, start_time, end_time, exclude_id=None):
    """Return True if the room has a conflicting booking in the time range."""
    start_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_str = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    sql = """
        SELECT COUNT(*) FROM bookings
        WHERE room_id = ? AND status = 'confirmed'
        AND start_time < ? AND end_time > ?
    """
    params = [room_id, end_str, start_str]

    if exclude_id:
        sql += " AND id != ?"
        params.append(exclude_id)

    cursor = await db.execute(sql, params)
    count = (await cursor.fetchone())[0]
    return count > 0


async def get_bookings_filtered(db, user_id=None, role=None, status=None,
                                 room_id=None, page=1, page_size=20):
    """Return filtered, paginated bookings."""
    conditions = []
    params = []

    # Students see only their own bookings
    if role and role != "admin":
        conditions.append("bk.user_id = ?")
        params.append(user_id)
    if status:
        conditions.append("bk.status = ?")
        params.append(status)
    if room_id:
        conditions.append("bk.room_id = ?")
        params.append(room_id)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_sql = f"SELECT COUNT(*) FROM bookings bk {where}"
    cursor = await db.execute(count_sql, params)
    total = (await cursor.fetchone())[0]

    offset = (page - 1) * page_size
    sql = f"""
        SELECT bk.*, r.name AS room_name, b.name AS building_name,
               u.first_name || ' ' || u.last_name AS user_name
        FROM bookings bk
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        JOIN users u ON bk.user_id = u.id
        {where}
        ORDER BY bk.start_time DESC
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(sql, params + [page_size, offset])
    rows = await cursor.fetchall()

    return {"items": rows, "total": total, "page": page, "page_size": page_size}


async def get_booking_by_id(db, booking_id: str):
    """Return a single booking with room and user details."""
    cursor = await db.execute("""
        SELECT bk.*, r.name AS room_name, b.name AS building_name,
               u.first_name || ' ' || u.last_name AS user_name
        FROM bookings bk
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        JOIN users u ON bk.user_id = u.id
        WHERE bk.id = ?
    """, (booking_id,))
    return await cursor.fetchone()


async def cancel_booking(db, booking_id: str):
    """Cancel a booking (soft delete)."""
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    await db.execute(
        "UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ?",
        (now, booking_id),
    )
    await db.commit()


# ===================================================================
# ANALYTICS
# ===================================================================

async def get_utilization(db, building_id=None, room_type=None,
                           start_date="2026-01-01", end_date="2026-03-21",
                           granularity="daily"):
    """Return utilization time series from usage_stats or access_events."""
    conditions = ["us.date >= ? AND us.date <= ?"]
    params = [start_date, end_date]

    if building_id:
        conditions.append("f.building_id = ?")
        params.append(building_id)
    if room_type:
        conditions.append("r.room_type = ?")
        params.append(room_type)

    where = " AND ".join(conditions)

    # Group by date (or week/month for other granularities)
    if granularity == "weekly":
        group_expr = "strftime('%Y-W%W', us.date)"
    elif granularity == "monthly":
        group_expr = "strftime('%Y-%m', us.date)"
    else:
        group_expr = "us.date"

    sql = f"""
        SELECT {group_expr} AS period,
               ROUND(AVG(CASE WHEN us.total_hours_used > 0 THEN
                   MIN(1.0, us.total_hours_used / 14.0) ELSE 0 END), 2) AS utilization_pct
        FROM usage_stats us
        JOIN rooms r ON us.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        WHERE {where}
        GROUP BY period
        ORDER BY period
    """
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()
    return [{"period": r["period"], "utilization_pct": r["utilization_pct"]} for r in rows]


async def get_utilization_heatmap(db, building_id=None, start_date="2026-01-01", end_date="2026-03-21"):
    """Return heatmap data: day_of_week x hour -> avg entries."""
    conditions = ["ae.timestamp >= ? AND ae.timestamp <= ?"]
    params = [f"{start_date}T00:00:00Z", f"{end_date}T23:59:59Z"]

    if building_id:
        conditions.append("f.building_id = ?")
        params.append(building_id)

    where = " AND ".join(conditions)

    sql = f"""
        SELECT CAST(strftime('%w', ae.timestamp) AS INTEGER) AS dow,
               CAST(strftime('%H', ae.timestamp) AS INTEGER) AS hour,
               COUNT(*) AS entries
        FROM access_events ae
        JOIN rooms r ON ae.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        WHERE ae.direction = 'entry' AND {where}
        GROUP BY dow, hour
    """
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()

    # Find max for normalization
    max_entries = max((r["entries"] for r in rows), default=1)

    cells = []
    for r in rows:
        # Convert Sunday=0 to Monday=0
        day = (r["dow"] - 1) % 7
        cells.append({
            "day": day,
            "hour": r["hour"],
            "value": round(r["entries"] / max_entries, 2),
        })
    return cells


async def get_peak_hours(db, building_id=None, start_date="2026-01-01", end_date="2026-03-21"):
    """Return average activity by hour of day."""
    conditions = ["ae.timestamp >= ? AND ae.timestamp <= ?"]
    params = [f"{start_date}T00:00:00Z", f"{end_date}T23:59:59Z"]

    if building_id:
        conditions.append("f.building_id = ?")
        params.append(building_id)

    where = " AND ".join(conditions)

    sql = f"""
        SELECT CAST(strftime('%H', ae.timestamp) AS INTEGER) AS hour,
               COUNT(*) AS total_entries
        FROM access_events ae
        JOIN rooms r ON ae.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        WHERE ae.direction = 'entry' AND {where}
        GROUP BY hour
        ORDER BY hour
    """
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()

    max_entries = max((r["total_entries"] for r in rows), default=1)
    return [{"hour": r["hour"], "avg_utilization": round(r["total_entries"] / max_entries, 2)} for r in rows]


async def get_usage_by_department(db, start_date="2026-01-01", end_date="2026-03-21"):
    """Return space usage grouped by user major/department."""
    sql = """
        SELECT COALESCE(u.major, u.department, 'Unknown') AS department,
               COUNT(*) AS total_bookings,
               ROUND(SUM(
                   (julianday(bk.end_time) - julianday(bk.start_time)) * 24
               ), 1) AS total_hours
        FROM bookings bk
        JOIN users u ON bk.user_id = u.id
        WHERE bk.start_time >= ? AND bk.end_time <= ?
        AND bk.status != 'cancelled'
        GROUP BY department
        ORDER BY total_hours DESC
    """
    cursor = await db.execute(sql, (f"{start_date}T00:00:00Z", f"{end_date}T23:59:59Z"))
    rows = await cursor.fetchall()
    return [{"department": r["department"], "total_hours": r["total_hours"],
             "total_bookings": r["total_bookings"]} for r in rows]


async def get_revenue_summary(db, start_date="2026-01-01", end_date="2026-03-21", building_id=None):
    """Return revenue breakdown."""
    conditions = ["rev.created_at >= ? AND rev.created_at <= ?"]
    params = [f"{start_date}T00:00:00Z", f"{end_date}T23:59:59Z"]

    if building_id:
        conditions.append("fl.building_id = ?")
        params.append(building_id)

    where = " AND ".join(conditions)

    # Totals
    sql = f"""
        SELECT COALESCE(SUM(rev.amount), 0) AS total,
               COALESCE(SUM(CASE WHEN rev.revenue_type = 'external_rental' THEN rev.amount ELSE 0 END), 0) AS external_rental,
               COALESCE(SUM(CASE WHEN rev.revenue_type = 'department_chargeback' THEN rev.amount ELSE 0 END), 0) AS chargebacks
        FROM revenue_entries rev
        JOIN bookings bk ON rev.booking_id = bk.id
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors fl ON r.floor_id = fl.id
        WHERE {where}
    """
    cursor = await db.execute(sql, params)
    totals = await cursor.fetchone()

    # By building
    sql_bld = f"""
        SELECT b.name AS building_name, COALESCE(SUM(rev.amount), 0) AS amount
        FROM revenue_entries rev
        JOIN bookings bk ON rev.booking_id = bk.id
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors fl ON r.floor_id = fl.id
        JOIN buildings b ON fl.building_id = b.id
        WHERE {where}
        GROUP BY b.id
        ORDER BY amount DESC
    """
    cursor = await db.execute(sql_bld, params)
    by_building = [{"building_name": r["building_name"], "amount": r["amount"]}
                   for r in await cursor.fetchall()]

    # By room type
    sql_rt = f"""
        SELECT r.room_type, COALESCE(SUM(rev.amount), 0) AS amount
        FROM revenue_entries rev
        JOIN bookings bk ON rev.booking_id = bk.id
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors fl ON r.floor_id = fl.id
        WHERE {where}
        GROUP BY r.room_type
        ORDER BY amount DESC
    """
    cursor = await db.execute(sql_rt, params)
    by_room_type = [{"room_type": r["room_type"], "amount": r["amount"]}
                    for r in await cursor.fetchall()]

    # Over time (monthly)
    sql_time = f"""
        SELECT strftime('%Y-%m', rev.created_at) AS period,
               COALESCE(SUM(rev.amount), 0) AS amount
        FROM revenue_entries rev
        JOIN bookings bk ON rev.booking_id = bk.id
        JOIN rooms r ON bk.room_id = r.id
        JOIN floors fl ON r.floor_id = fl.id
        WHERE {where}
        GROUP BY period
        ORDER BY period
    """
    cursor = await db.execute(sql_time, params)
    over_time = [{"period": r["period"], "amount": r["amount"]}
                 for r in await cursor.fetchall()]

    return {
        "total": totals["total"],
        "external_rental": totals["external_rental"],
        "chargebacks": totals["chargebacks"],
        "by_building": by_building,
        "by_room_type": by_room_type,
        "over_time": over_time,
    }


async def get_revenue_opportunity(db, start_date="2026-01-01", end_date="2026-03-21"):
    """Return underutilized rooms with revenue potential."""
    sql = """
        SELECT r.id, r.name AS room_name, r.room_type, r.capacity,
               r.hourly_rate, b.name AS building_name,
               COUNT(bk.id) AS booking_count,
               COALESCE(SUM(
                   (julianday(bk.end_time) - julianday(bk.start_time)) * 24
               ), 0) AS hours_booked
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        LEFT JOIN bookings bk ON bk.room_id = r.id
            AND bk.status != 'cancelled'
            AND bk.start_time >= ? AND bk.end_time <= ?
        WHERE r.hourly_rate IS NOT NULL AND r.hourly_rate > 0
        GROUP BY r.id
    """
    cursor = await db.execute(sql, (f"{start_date}T00:00:00Z", f"{end_date}T23:59:59Z"))
    rows = await cursor.fetchall()

    # Calculate days in range
    from datetime import datetime as dt
    d1 = dt.strptime(start_date, "%Y-%m-%d")
    d2 = dt.strptime(end_date, "%Y-%m-%d")
    weeks = max(1, (d2 - d1).days / 7)

    # Available hours: 14 hours/day (8am-10pm) * 5 weekdays = 70/week
    available_per_week = 70.0

    opportunities = []
    for r in rows:
        hours_per_week = r["hours_booked"] / weeks if weeks > 0 else 0
        utilization = min(1.0, hours_per_week / available_per_week)
        unused_hours = available_per_week - hours_per_week
        estimated_revenue = round(unused_hours * r["hourly_rate"], 2)

        opportunities.append({
            "room_id": r["id"],
            "room_name": r["room_name"],
            "building_name": r["building_name"],
            "room_type": r["room_type"],
            "current_utilization_pct": round(utilization, 2),
            "available_hours_per_week": round(unused_hours, 1),
            "hourly_rate": r["hourly_rate"],
            "estimated_weekly_revenue": estimated_revenue,
        })

    opportunities.sort(key=lambda x: x["estimated_weekly_revenue"], reverse=True)

    total_weekly = sum(o["estimated_weekly_revenue"] for o in opportunities)
    return {
        "estimated_untapped_weekly": round(total_weekly, 2),
        "estimated_untapped_semester": round(total_weekly * 16, 2),
        "underutilized_spaces": opportunities,
    }


# ===================================================================
# OCCUPANCY (real-time from camera system)
# ===================================================================

async def get_room_occupancy(db, room_id: str):
    """Return current headcount for a room."""
    cursor = await db.execute(
        "SELECT headcount, last_updated FROM room_occupancy WHERE room_id = ?", (room_id,)
    )
    return await cursor.fetchone()


async def update_room_occupancy(db, room_id: str, headcount: int):
    """Update real-time headcount for a room."""
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    await db.execute(
        "UPDATE room_occupancy SET headcount = ?, last_updated = ? WHERE room_id = ?",
        (headcount, now, room_id),
    )
    await db.commit()


# ===================================================================
# BUILDING CRUD
# ===================================================================

async def create_building(db, name, code, address=None, total_floors=1,
                          latitude=None, longitude=None):
    """Insert a new building and return its ID."""
    building_id = f"bld_{uuid.uuid4().hex[:8]}"
    await db.execute(
        "INSERT INTO buildings VALUES (?,?,?,?,?,?,?)",
        (building_id, name, code, address, total_floors, latitude, longitude),
    )
    await db.commit()
    return building_id


async def update_building(db, building_id, **updates):
    """Update building fields. Only non-None values are updated."""
    allowed = {"name", "code", "address", "total_floors", "latitude", "longitude"}
    sets = []
    params = []
    for k, v in updates.items():
        if k in allowed and v is not None:
            sets.append(f"{k} = ?")
            params.append(v)
    if not sets:
        return
    params.append(building_id)
    await db.execute(f"UPDATE buildings SET {', '.join(sets)} WHERE id = ?", params)
    await db.commit()


async def delete_building(db, building_id):
    """Delete building and cascade to floors, rooms, equipment, occupancy."""
    # Get all rooms in this building for cleanup
    cursor = await db.execute("""
        SELECT r.id FROM rooms r JOIN floors f ON r.floor_id = f.id
        WHERE f.building_id = ?
    """, (building_id,))
    room_ids = [r["id"] for r in await cursor.fetchall()]

    for rid in room_ids:
        await db.execute("DELETE FROM room_equipment WHERE room_id = ?", (rid,))
        await db.execute("DELETE FROM room_occupancy WHERE room_id = ?", (rid,))
        await db.execute("DELETE FROM cameras WHERE room_id = ?", (rid,))

    cursor = await db.execute("SELECT id FROM floors WHERE building_id = ?", (building_id,))
    floor_ids = [r["id"] for r in await cursor.fetchall()]
    for fid in floor_ids:
        await db.execute("DELETE FROM rooms WHERE floor_id = ?", (fid,))

    await db.execute("DELETE FROM floors WHERE building_id = ?", (building_id,))
    await db.execute("DELETE FROM access_rules WHERE building_id = ?", (building_id,))
    await db.execute("DELETE FROM buildings WHERE id = ?", (building_id,))
    await db.commit()


# ===================================================================
# FLOOR CRUD
# ===================================================================

async def create_floor(db, building_id, floor_number, name):
    """Insert a new floor and return its ID."""
    floor_id = f"flr_{uuid.uuid4().hex[:8]}"
    await db.execute(
        "INSERT INTO floors VALUES (?,?,?,?)",
        (floor_id, building_id, floor_number, name),
    )
    await db.commit()
    return floor_id


async def delete_floor(db, floor_id):
    """Delete a floor and its rooms."""
    cursor = await db.execute("SELECT id FROM rooms WHERE floor_id = ?", (floor_id,))
    room_ids = [r["id"] for r in await cursor.fetchall()]
    for rid in room_ids:
        await db.execute("DELETE FROM room_equipment WHERE room_id = ?", (rid,))
        await db.execute("DELETE FROM room_occupancy WHERE room_id = ?", (rid,))
        await db.execute("DELETE FROM cameras WHERE room_id = ?", (rid,))
    await db.execute("DELETE FROM rooms WHERE floor_id = ?", (floor_id,))
    await db.execute("DELETE FROM floors WHERE id = ?", (floor_id,))
    await db.commit()


# ===================================================================
# ROOM CRUD
# ===================================================================

async def create_room(db, floor_id, name, room_type, capacity,
                      hourly_rate=None, is_bookable=True, description=None,
                      equipment=None):
    """Insert a new room with equipment and occupancy tracking."""
    room_id = f"rm_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    await db.execute(
        "INSERT INTO rooms (id, floor_id, name, room_type, capacity, hourly_rate, is_bookable, status, description) VALUES (?,?,?,?,?,?,?,?,?)",
        (room_id, floor_id, name, room_type, capacity,
         hourly_rate, int(is_bookable), "available", description),
    )
    # Add equipment
    if equipment:
        for equip_type in equipment:
            eid = f"eq_{uuid.uuid4().hex[:8]}"
            await db.execute(
                "INSERT INTO room_equipment VALUES (?,?,?)",
                (eid, room_id, equip_type),
            )
    # Initialize occupancy tracking
    await db.execute(
        "INSERT INTO room_occupancy VALUES (?,0,?)",
        (room_id, now),
    )
    await db.commit()
    return room_id


async def update_room(db, room_id, **updates):
    """Update room fields. Handles equipment separately."""
    equipment = updates.pop("equipment", None)

    allowed = {"name", "room_type", "capacity", "hourly_rate", "is_bookable",
               "status", "description"}
    sets = []
    params = []
    for k, v in updates.items():
        if k in allowed and v is not None:
            if k == "is_bookable":
                v = int(v)
            sets.append(f"{k} = ?")
            params.append(v)
    if sets:
        params.append(room_id)
        await db.execute(f"UPDATE rooms SET {', '.join(sets)} WHERE id = ?", params)

    if equipment is not None:
        await set_room_equipment(db, room_id, equipment)

    await db.commit()


async def set_room_equipment(db, room_id, equipment_list):
    """Replace all equipment for a room."""
    await db.execute("DELETE FROM room_equipment WHERE room_id = ?", (room_id,))
    for equip_type in equipment_list:
        eid = f"eq_{uuid.uuid4().hex[:8]}"
        await db.execute(
            "INSERT INTO room_equipment VALUES (?,?,?)",
            (eid, room_id, equip_type),
        )


async def delete_room(db, room_id):
    """Delete a room and related data."""
    await db.execute("DELETE FROM room_equipment WHERE room_id = ?", (room_id,))
    await db.execute("DELETE FROM room_occupancy WHERE room_id = ?", (room_id,))
    await db.execute("DELETE FROM cameras WHERE room_id = ?", (room_id,))
    await db.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
    await db.commit()


# ===================================================================
# USER CRUD
# ===================================================================

async def get_all_users(db, role=None, search=None, page=1, page_size=20):
    """Return paginated users with optional role filter."""
    conditions = []
    params = []
    if role:
        conditions.append("role = ?")
        params.append(role)
    if search:
        conditions.append("(email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)")
        params.extend([f"%{search}%"] * 3)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(f"SELECT COUNT(*) FROM users {where}", params)
    total = (await cursor.fetchone())[0]

    offset = (page - 1) * page_size
    cursor = await db.execute(
        f"SELECT id, email, first_name, last_name, role, department, major, year, student_id "
        f"FROM users {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    )
    rows = await cursor.fetchall()
    return {"items": [dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}


async def create_user(db, email, password_hash, first_name, last_name, role="student",
                      department=None, major=None, year=None, student_id=None):
    """Insert a new user and return their ID."""
    user_id = f"usr_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    await db.execute(
        "INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (user_id, email, password_hash, first_name, last_name, role,
         department, major, year, student_id, now),
    )
    await db.commit()
    return user_id


async def update_user(db, user_id, **updates):
    """Update user fields."""
    allowed = {"email", "first_name", "last_name", "role", "department",
               "major", "year", "student_id"}
    sets = []
    params = []
    for k, v in updates.items():
        if k in allowed and v is not None:
            sets.append(f"{k} = ?")
            params.append(v)
    if not sets:
        return
    params.append(user_id)
    await db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", params)
    await db.commit()


async def delete_user(db, user_id):
    """Delete a user."""
    await db.execute("DELETE FROM enrolled_faces WHERE user_id = ?", (user_id,))
    await db.execute("DELETE FROM club_members WHERE user_id = ?", (user_id,))
    await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    await db.commit()


# ===================================================================
# CAMERAS
# ===================================================================

async def create_camera(db, room_id, name, rtsp_url=None,
                        doorway_polygon=None, room_direction=None,
                        entry_direction="top_to_bottom", **kwargs):
    """Insert a new camera and return its ID."""
    import json as _json
    camera_id = f"cam_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    poly_json = _json.dumps(doorway_polygon) if doorway_polygon else None
    dir_json = _json.dumps(room_direction) if room_direction else None
    await db.execute(
        "INSERT INTO cameras VALUES (?,?,?,?,?,?,?,?,?)",
        (camera_id, room_id, name, "online", now, rtsp_url,
         poly_json, dir_json, entry_direction),
    )
    await db.commit()
    return camera_id


def _parse_camera_row(row):
    """Parse a camera DB row, deserializing JSON fields."""
    import json as _json
    d = dict(row)
    if d.get("doorway_polygon") and isinstance(d["doorway_polygon"], str):
        try:
            d["doorway_polygon"] = _json.loads(d["doorway_polygon"])
        except Exception:
            d["doorway_polygon"] = None
    if d.get("room_direction") and isinstance(d["room_direction"], str):
        try:
            d["room_direction"] = _json.loads(d["room_direction"])
        except Exception:
            d["room_direction"] = None
    return d


async def get_cameras(db, room_id=None):
    """Return all cameras with room/building names."""
    conditions = []
    params = []
    if room_id:
        conditions.append("c.room_id = ?")
        params.append(room_id)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(f"""
        SELECT c.*, r.name AS room_name, b.name AS building_name
        FROM cameras c
        JOIN rooms r ON c.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        {where}
        ORDER BY c.name
    """, params)
    return [_parse_camera_row(r) for r in await cursor.fetchall()]


async def get_camera_by_id(db, camera_id):
    """Return a single camera with room/building names."""
    cursor = await db.execute("""
        SELECT c.*, r.name AS room_name, b.name AS building_name
        FROM cameras c
        JOIN rooms r ON c.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings b ON f.building_id = b.id
        WHERE c.id = ?
    """, (camera_id,))
    row = await cursor.fetchone()
    return _parse_camera_row(row) if row else None


async def update_camera(db, camera_id, **updates):
    """Update camera fields."""
    import json as _json
    # Serialize polygon/direction fields to JSON strings
    if "doorway_polygon" in updates and updates["doorway_polygon"] is not None:
        updates["doorway_polygon"] = _json.dumps(updates["doorway_polygon"])
    if "room_direction" in updates and updates["room_direction"] is not None:
        updates["room_direction"] = _json.dumps(updates["room_direction"])
    allowed = {"name", "rtsp_url", "status", "doorway_polygon", "room_direction", "entry_direction"}
    sets = []
    params = []
    for k, v in updates.items():
        if k in allowed and v is not None:
            sets.append(f"{k} = ?")
            params.append(v)
    if not sets:
        return
    params.append(camera_id)
    await db.execute(f"UPDATE cameras SET {', '.join(sets)} WHERE id = ?", params)
    await db.commit()


async def delete_camera(db, camera_id):
    """Delete a camera."""
    await db.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
    await db.commit()


# ===================================================================
# ACCESS RULES
# ===================================================================

async def create_access_rule(db, role=None, user_id=None, room_id=None,
                              building_id=None, day_of_week=None,
                              start_hour=0, end_hour=23):
    """Insert a new access rule and return its ID."""
    rule_id = f"ar_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    await db.execute(
        "INSERT INTO access_rules VALUES (?,?,?,?,?,?,?,?,?)",
        (rule_id, user_id, role, room_id, building_id, day_of_week,
         start_hour, end_hour, now),
    )
    await db.commit()
    return rule_id


async def get_access_rules(db, building_id=None, room_id=None):
    """Return all access rules with optional filtering."""
    conditions = []
    params = []
    if building_id:
        conditions.append("building_id = ?")
        params.append(building_id)
    if room_id:
        conditions.append("room_id = ?")
        params.append(room_id)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(
        f"SELECT * FROM access_rules {where} ORDER BY created_at DESC", params
    )
    return [dict(r) for r in await cursor.fetchall()]


async def delete_access_rule(db, rule_id):
    """Delete an access rule."""
    await db.execute("DELETE FROM access_rules WHERE id = ?", (rule_id,))
    await db.commit()


async def check_access_rules(db, user_id, user_role, room_id, building_id=None):
    """Check if a user is authorized by access rules (not booking-based)."""
    now = datetime.utcnow()
    current_hour = now.hour
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    current_day = day_names[now.weekday()]

    cursor = await db.execute("""
        SELECT * FROM access_rules
        WHERE (user_id = ? OR user_id IS NULL)
          AND (role = ? OR role IS NULL)
          AND (room_id = ? OR room_id IS NULL)
          AND (building_id = ? OR building_id IS NULL)
          AND start_hour <= ? AND end_hour >= ?
    """, (user_id, user_role, room_id, building_id, current_hour, current_hour))
    rules = await cursor.fetchall()

    for rule in rules:
        if rule["day_of_week"] is None or current_day in rule["day_of_week"].lower():
            return True
    return False


# ===================================================================
# ACCESS EVENTS & ALERTS
# ===================================================================

async def insert_access_event(db, camera_id, room_id, user_id, direction,
                               authorized, confidence=None):
    """Insert an access event and return its ID."""
    event_id = f"evt_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    await db.execute(
        "INSERT INTO access_events VALUES (?,?,?,?,?,?,?,?)",
        (event_id, camera_id, room_id, user_id, direction,
         int(authorized), confidence, now),
    )
    await db.commit()
    return event_id


async def get_camera_events(db, camera_id=None, room_id=None, limit=50):
    """Return recent access events with user names."""
    conditions = []
    params = []
    if camera_id:
        conditions.append("ae.camera_id = ?")
        params.append(camera_id)
    if room_id:
        conditions.append("ae.room_id = ?")
        params.append(room_id)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(f"""
        SELECT ae.*, u.first_name || ' ' || u.last_name AS user_name
        FROM access_events ae
        LEFT JOIN users u ON ae.user_id = u.id
        {where}
        ORDER BY ae.timestamp DESC
        LIMIT ?
    """, params + [limit])
    return [dict(r) for r in await cursor.fetchall()]


async def insert_alert(db, event_id, room_id, user_id, alert_type,
                        severity, description):
    """Insert an alert and return its ID."""
    alert_id = f"alt_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    await db.execute(
        "INSERT INTO alerts VALUES (?,?,?,?,?,?,?,?,?)",
        (alert_id, event_id, room_id, user_id, alert_type, severity,
         description, 0, now),
    )
    await db.commit()
    return alert_id


async def get_alerts(db, acknowledged=None, severity=None, room_id=None, limit=50):
    """Return recent alerts."""
    conditions = []
    params = []
    if acknowledged is not None:
        conditions.append("acknowledged = ?")
        params.append(int(acknowledged))
    if severity:
        conditions.append("severity = ?")
        params.append(severity)
    if room_id:
        conditions.append("room_id = ?")
        params.append(room_id)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor = await db.execute(
        f"SELECT * FROM alerts {where} ORDER BY created_at DESC LIMIT ?",
        params + [limit],
    )
    return [dict(r) for r in await cursor.fetchall()]


async def acknowledge_alert(db, alert_id):
    """Mark an alert as acknowledged."""
    await db.execute(
        "UPDATE alerts SET acknowledged = 1 WHERE id = ?", (alert_id,)
    )
    await db.commit()
