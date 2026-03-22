"""
Database connection manager and schema definition.

Uses aiosqlite for async SQLite access with WAL mode.
Schema auto-creates on first startup if tables don't exist.

Tables cover:
  - Campus structure (buildings, floors, rooms, equipment)
  - People & identity (users, clubs, club_members, enrolled_faces)
  - Camera & access control (cameras, access_rules, access_events, alerts)
  - Booking & revenue (bookings, revenue_entries)
  - Real-time & analytics (room_occupancy, usage_stats)
"""

import os
from pathlib import Path

import aiosqlite

_DEFAULT_DB_PATH = str(Path(__file__).parent.parent / "pirateflow.db")
DB_PATH = os.getenv("DATABASE_URL", _DEFAULT_DB_PATH)

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    """Return the shared database connection."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def init_db() -> aiosqlite.Connection:
    """Open connection, enable WAL + foreign keys, create tables."""
    global _db
    _db = await aiosqlite.connect(DB_PATH)
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL;")
    await _db.execute("PRAGMA foreign_keys=ON;")
    await _create_tables(_db)
    await _db.commit()
    return _db


async def close_db():
    """Close the database connection."""
    global _db
    if _db is not None:
        await _db.close()
        _db = None


async def _create_tables(db: aiosqlite.Connection):
    await db.executescript("""

    -- =======================================================================
    -- CAMPUS STRUCTURE
    -- =======================================================================

    CREATE TABLE IF NOT EXISTS buildings (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        code         TEXT NOT NULL UNIQUE,
        address      TEXT,
        total_floors INTEGER NOT NULL DEFAULT 1,
        latitude     REAL,
        longitude    REAL
    );

    CREATE TABLE IF NOT EXISTS floors (
        id           TEXT PRIMARY KEY,
        building_id  TEXT NOT NULL REFERENCES buildings(id),
        floor_number INTEGER NOT NULL,
        name         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
        id          TEXT PRIMARY KEY,
        floor_id    TEXT NOT NULL REFERENCES floors(id),
        name        TEXT NOT NULL,
        room_type   TEXT NOT NULL,
        capacity    INTEGER NOT NULL,
        hourly_rate REAL,
        is_bookable INTEGER NOT NULL DEFAULT 1,
        status      TEXT NOT NULL DEFAULT 'available',
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS room_equipment (
        id             TEXT PRIMARY KEY,
        room_id        TEXT NOT NULL REFERENCES rooms(id),
        equipment_type TEXT NOT NULL
    );

    -- =======================================================================
    -- PEOPLE & IDENTITY
    -- Roles: admin, staff, student, visitor
    -- =======================================================================

    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name    TEXT NOT NULL,
        last_name     TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'student',
        department    TEXT,
        major         TEXT,
        year          TEXT,
        student_id    TEXT,
        created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clubs (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        category   TEXT,
        department TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS club_members (
        id      TEXT PRIMARY KEY,
        club_id TEXT NOT NULL REFERENCES clubs(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        role    TEXT NOT NULL DEFAULT 'member'
    );

    -- Face encodings for recognition. Stored as binary blobs (not images).
    -- Encodings are 128-d float arrays — one-way, not reversible to images.
    CREATE TABLE IF NOT EXISTS enrolled_faces (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL REFERENCES users(id),
        face_image_path TEXT,
        label           TEXT NOT NULL,
        enrolled_at     TEXT NOT NULL,
        is_active       INTEGER NOT NULL DEFAULT 1,
        encodings_blob  BLOB
    );

    -- =======================================================================
    -- CAMERA & ACCESS CONTROL
    -- =======================================================================

    CREATE TABLE IF NOT EXISTS cameras (
        id                TEXT PRIMARY KEY,
        room_id           TEXT NOT NULL REFERENCES rooms(id),
        name              TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'online',
        installed_at      TEXT NOT NULL,
        rtsp_url          TEXT,
        doorway_polygon   TEXT,
        room_direction    TEXT,
        entry_direction   TEXT NOT NULL DEFAULT 'top_to_bottom'
    );

    CREATE TABLE IF NOT EXISTS access_rules (
        id          TEXT PRIMARY KEY,
        user_id     TEXT REFERENCES users(id),
        role        TEXT,
        room_id     TEXT REFERENCES rooms(id),
        building_id TEXT REFERENCES buildings(id),
        day_of_week TEXT,
        start_hour  INTEGER NOT NULL DEFAULT 0,
        end_hour    INTEGER NOT NULL DEFAULT 23,
        created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_events (
        id         TEXT PRIMARY KEY,
        camera_id  TEXT NOT NULL REFERENCES cameras(id),
        room_id    TEXT NOT NULL REFERENCES rooms(id),
        user_id    TEXT REFERENCES users(id),
        direction  TEXT NOT NULL,
        authorized INTEGER NOT NULL DEFAULT 1,
        confidence REAL,
        timestamp  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
        id           TEXT PRIMARY KEY,
        event_id     TEXT REFERENCES access_events(id),
        room_id      TEXT REFERENCES rooms(id),
        user_id      TEXT REFERENCES users(id),
        alert_type   TEXT NOT NULL,
        severity     TEXT NOT NULL DEFAULT 'warning',
        description  TEXT NOT NULL,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL
    );

    -- =======================================================================
    -- BOOKING & REVENUE
    -- =======================================================================

    CREATE TABLE IF NOT EXISTS bookings (
        id           TEXT PRIMARY KEY,
        room_id      TEXT NOT NULL REFERENCES rooms(id),
        user_id      TEXT NOT NULL REFERENCES users(id),
        club_id      TEXT REFERENCES clubs(id),
        title        TEXT NOT NULL,
        purpose      TEXT,
        start_time   TEXT NOT NULL,
        end_time     TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'confirmed',
        booking_type TEXT NOT NULL DEFAULT 'internal_student',
        created_at   TEXT NOT NULL,
        cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS revenue_entries (
        id                 TEXT PRIMARY KEY,
        booking_id         TEXT NOT NULL REFERENCES bookings(id),
        amount             REAL NOT NULL,
        revenue_type       TEXT NOT NULL,
        billing_department TEXT,
        created_at         TEXT NOT NULL
    );

    -- =======================================================================
    -- REAL-TIME OCCUPANCY & ANALYTICS
    -- =======================================================================

    CREATE TABLE IF NOT EXISTS room_occupancy (
        room_id      TEXT PRIMARY KEY REFERENCES rooms(id),
        headcount    INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_stats (
        id                    TEXT PRIMARY KEY,
        room_id               TEXT NOT NULL REFERENCES rooms(id),
        date                  TEXT NOT NULL,
        total_entries         INTEGER NOT NULL DEFAULT 0,
        unique_visitors       INTEGER NOT NULL DEFAULT 0,
        peak_headcount        INTEGER NOT NULL DEFAULT 0,
        total_hours_used      REAL NOT NULL DEFAULT 0,
        avg_headcount         REAL NOT NULL DEFAULT 0,
        primary_purpose       TEXT,
        primary_major         TEXT,
        primary_club          TEXT,
        unauthorized_attempts INTEGER NOT NULL DEFAULT 0
    );

    -- =======================================================================
    -- CAMPUS EVENTS (scraped from SHU CampusLabs)
    -- =======================================================================

    CREATE TABLE IF NOT EXISTS campus_events (
        id              TEXT PRIMARY KEY,
        external_id     TEXT UNIQUE,
        name            TEXT NOT NULL,
        description     TEXT,
        location        TEXT,
        starts_at       TEXT NOT NULL,
        ends_at         TEXT,
        image_url       TEXT,
        organization    TEXT,
        category_names  TEXT,
        scraped_at      TEXT NOT NULL,
        building_id     TEXT REFERENCES buildings(id),
        room_id         TEXT REFERENCES rooms(id),
        booking_id      TEXT REFERENCES bookings(id)
    );

    -- =======================================================================
    -- INDEXES
    -- =======================================================================

    CREATE INDEX IF NOT EXISTS idx_floors_building         ON floors(building_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_floor             ON rooms(floor_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_type              ON rooms(room_type);
    CREATE INDEX IF NOT EXISTS idx_room_equip_room         ON room_equipment(room_id);
    CREATE INDEX IF NOT EXISTS idx_club_members_club       ON club_members(club_id);
    CREATE INDEX IF NOT EXISTS idx_club_members_user       ON club_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_enrolled_faces_user     ON enrolled_faces(user_id);
    CREATE INDEX IF NOT EXISTS idx_cameras_room            ON cameras(room_id);
    CREATE INDEX IF NOT EXISTS idx_access_rules_user       ON access_rules(user_id);
    CREATE INDEX IF NOT EXISTS idx_access_rules_role       ON access_rules(role);
    CREATE INDEX IF NOT EXISTS idx_access_rules_room       ON access_rules(room_id);
    CREATE INDEX IF NOT EXISTS idx_access_events_camera    ON access_events(camera_id);
    CREATE INDEX IF NOT EXISTS idx_access_events_room      ON access_events(room_id);
    CREATE INDEX IF NOT EXISTS idx_access_events_user      ON access_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_access_events_time      ON access_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_alerts_room             ON alerts(room_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_type             ON alerts(alert_type);
    CREATE INDEX IF NOT EXISTS idx_bookings_room           ON bookings(room_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_user           ON bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_start          ON bookings(start_time);
    CREATE INDEX IF NOT EXISTS idx_bookings_status         ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_club           ON bookings(club_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_purpose        ON bookings(purpose);
    CREATE INDEX IF NOT EXISTS idx_revenue_booking         ON revenue_entries(booking_id);
    CREATE INDEX IF NOT EXISTS idx_usage_stats_room_date   ON usage_stats(room_id, date);
    CREATE INDEX IF NOT EXISTS idx_usage_stats_date        ON usage_stats(date);
    """)
