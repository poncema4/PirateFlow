"""
Minimal seeder for PirateFlow.

Seeds the database with just enough to get started:
- 1 building, 1 floor, 1 room, 1 camera
- 1 admin account
- 15 enrolled students with face images
- Basic access rules

More buildings/rooms/data added as the system grows.
"""

from services.auth import hash_password
from services.database import get_db


def _ts():
    return "2026-03-21T00:00:00Z"


# 15 enrolled students — real team + collected on campus
ENROLLED_STUDENTS = [
    {"first": "Benedykt", "last": "Kosiek",         "email": "student@shu.edu",              "major": "Computer Science", "year": "junior", "sid": "11800545"},
    {"first": "Joseph",   "last": "Lodge",           "email": "joseph.lodge@shu.edu",         "major": "Computer Science", "year": "junior", "sid": "11909189"},
    {"first": "Victor",   "last": "Flores",          "email": "victor.flores@shu.edu",        "major": "Computer Science", "year": "junior", "sid": "11921918"},
    {"first": "Marco",    "last": "Ponce",           "email": "marco.ponce@shu.edu",          "major": "Computer Science", "year": "junior", "sid": "12121302"},
    {"first": "Liam",     "last": "Triebenbacher",   "email": "liam.triebenbacher@shu.edu",   "major": "Physics",          "year": "junior", "sid": "12335746"},
    {"first": "Caleb",    "last": "Thompson",        "email": "caleb.thompson@shu.edu",       "major": "Biology",          "year": "sophomore", "sid": "11834201"},
    {"first": "Ethan",    "last": "Rivera",          "email": "ethan.rivera@shu.edu",         "major": "Business",         "year": "senior",    "sid": "11845302"},
    {"first": "James",    "last": "Robinson",        "email": "james.robinson@shu.edu",       "major": "Mathematics",      "year": "junior",    "sid": "11856403"},
    {"first": "Jocelyn",  "last": "Morales",         "email": "jocelyn.morales@shu.edu",      "major": "Nursing",          "year": "freshman",  "sid": "11867504"},
    {"first": "Marcus",   "last": "Webb",            "email": "marcus.webb@shu.edu",          "major": "Communications",   "year": "sophomore", "sid": "11878605"},
    {"first": "Maya",     "last": "Osei",            "email": "maya.osei@shu.edu",            "major": "English",          "year": "senior",    "sid": "11889706"},
    {"first": "Ryan",     "last": "Nakamura",        "email": "ryan.nakamura@shu.edu",        "major": "History",          "year": "junior",    "sid": "11890807"},
    {"first": "Sofia",    "last": "Ramirez",         "email": "sofia.ramirez@shu.edu",        "major": "Biology",          "year": "freshman",  "sid": "11901908"},
    {"first": "Victoria", "last": "Torres",          "email": "victoria.torres@shu.edu",      "major": "Computer Science", "year": "sophomore", "sid": "11913009"},
    {"first": "Zoe",      "last": "Bennett",         "email": "zoe.bennett@shu.edu",          "major": "Business",         "year": "senior",    "sid": "11924110"},
]


async def seed_database():
    """Populate the database with minimal starter data. Skips if data already exists."""
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) FROM buildings")
    row = await cursor.fetchone()
    if row[0] > 0:
        print("Database already seeded, skipping.")
        return

    print("Seeding PirateFlow database...")
    now = _ts()
    password_hash = hash_password("openshu2026")

    # ------------------------------------------------------------------
    # 1 BUILDING, 1 FLOOR, 1 ROOM
    # ------------------------------------------------------------------
    await db.execute(
        "INSERT INTO buildings VALUES (?,?,?,?,?,?,?)",
        ("bld_001", "Jubilee Hall", "JUB",
         "400 South Orange Ave, South Orange, NJ 07079", 4, 40.7428, -74.2432),
    )

    await db.execute(
        "INSERT INTO floors VALUES (?,?,?,?)",
        ("flr_001", "bld_001", 1, "Floor 1"),
    )

    await db.execute(
        "INSERT INTO rooms VALUES (?,?,?,?,?,?,1,'available',?)",
        ("rm_001", "flr_001", "Room 112", "classroom", 37, None,
         "Classroom in Jubilee Hall, Floor 1. Capacity 37."),
    )

    # Equipment
    await db.execute("INSERT INTO room_equipment VALUES (?,?,?)", ("eq_001", "rm_001", "projector"))
    await db.execute("INSERT INTO room_equipment VALUES (?,?,?)", ("eq_002", "rm_001", "whiteboard"))
    await db.execute("INSERT INTO room_equipment VALUES (?,?,?)", ("eq_003", "rm_001", "speaker"))

    # Camera
    await db.execute(
        "INSERT INTO cameras VALUES (?,?,?,?,?)",
        ("cam_001", "rm_001", "CAM-JUB-112", "online", now),
    )

    # Room occupancy init
    await db.execute(
        "INSERT INTO room_occupancy VALUES (?,0,?)", ("rm_001", now),
    )

    print("  1 building, 1 floor, 1 room, 1 camera")

    # ------------------------------------------------------------------
    # USERS: 15 enrolled people (14 students + 1 admin)
    # ------------------------------------------------------------------
    for i, s in enumerate(ENROLLED_STUDENTS):
        uid = f"usr_{i + 1:03d}"
        role = "admin" if s["last"] == "Lodge" else "student"
        await db.execute(
            "INSERT INTO users VALUES (?,?,?,?,?,?,NULL,?,?,?,?)",
            (uid, s["email"], password_hash, s["first"], s["last"],
             role, s["major"], s["year"], s["sid"], now),
        )

        # Enrolled face
        face_path = f"faces/{s['first'].lower()}_{s['last'].lower()}.jpg"
        label = f"{s['first']} {s['last']}"
        await db.execute(
            "INSERT INTO enrolled_faces VALUES (?,?,?,?,?,1)",
            (f"face_{i + 1:03d}", uid, face_path, label, now),
        )

    print("  15 users (1 admin: Joseph Lodge, 14 students, all with enrolled faces)")

    # ------------------------------------------------------------------
    # ACCESS RULES
    # ------------------------------------------------------------------
    # Admin: full access
    await db.execute(
        "INSERT INTO access_rules VALUES (?,NULL,'admin',NULL,NULL,NULL,0,23,?)",
        ("rule_001", now),
    )

    # Students: Jubilee Hall weekdays 8am-6pm
    await db.execute(
        "INSERT INTO access_rules VALUES (?,NULL,'student',NULL,?,'0,1,2,3,4',8,18,?)",
        ("rule_002", "bld_001", now),
    )

    print("  2 access rules")

    await db.commit()
    print("Seeding complete!")
