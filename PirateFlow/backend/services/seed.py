"""
Seeder for PirateFlow.

Creates bootstrap admin, SHU buildings, floors, and rooms on first run.
"""

import uuid

from services.auth import hash_password, SHARED_PASSWORD
from services.database import get_db


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


async def seed_database():
    """Create bootstrap admin, buildings, and rooms if no users exist."""
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) FROM users")
    row = await cursor.fetchone()
    if row[0] > 0:
        return

    print("Seeding PirateFlow data...")
    now = "2026-03-21T00:00:00Z"
    password_hash = hash_password(SHARED_PASSWORD)

    # --- Admin user ---
    await db.execute(
        "INSERT INTO users VALUES (?,?,?,?,?,?,NULL,NULL,NULL,NULL,?)",
        ("usr_admin", "admin@shu.edu", password_hash, "Admin", "User", "admin", now),
    )
    print(f"  Created admin@shu.edu (password: {SHARED_PASSWORD})")

    # --- Buildings ---
    buildings = [
        ("bld_jubilee",  "Jubilee Hall",              "JUB", "400 South Orange Ave, South Orange, NJ 07079", 4),
        ("bld_corrigan", "Corrigan Hall",             "COR", "400 South Orange Ave, South Orange, NJ 07079", 3),
        ("bld_mcnulty",  "McNulty Hall",              "MCN", "400 South Orange Ave, South Orange, NJ 07079", 4),
        ("bld_mooney",   "Mooney Hall",               "MOO", "400 South Orange Ave, South Orange, NJ 07079", 3),
        ("bld_stafford",  "Stafford Hall",            "STA", "400 South Orange Ave, South Orange, NJ 07079", 3),
        ("bld_library",  "Walsh Library",             "WLB", "400 South Orange Ave, South Orange, NJ 07079", 4),
    ]
    for bid, name, code, addr, floors in buildings:
        await db.execute(
            "INSERT INTO buildings VALUES (?,?,?,?,?,NULL,NULL)",
            (bid, name, code, addr, floors),
        )

    # --- Floors ---
    floors = {}  # key: (building_id, floor_number) -> floor_id
    for bid, _, _, _, total in buildings:
        for fn in range(1, total + 1):
            fid = _id("flr")
            floors[(bid, fn)] = fid
            await db.execute(
                "INSERT INTO floors VALUES (?,?,?,?)",
                (fid, bid, fn, f"Floor {fn}"),
            )

    # --- Rooms ---
    # (building_id, floor_num, room_name, room_type, capacity, description)
    rooms = [
        # Jubilee Hall
        ("bld_jubilee", 1, "Room 101",  "classroom",       35, "Standard classroom with projector"),
        ("bld_jubilee", 1, "Room 102",  "classroom",       35, "Standard classroom with projector"),
        ("bld_jubilee", 1, "Room 105",  "lecture_hall",     80, "Large lecture hall with tiered seating"),
        ("bld_jubilee", 2, "Room 201",  "classroom",       30, "Standard classroom"),
        ("bld_jubilee", 2, "Room 204",  "computer_lab",    25, "Computer lab with 25 workstations"),
        ("bld_jubilee", 2, "Room 210",  "study_room",       8, "Small group study room"),
        ("bld_jubilee", 3, "Room 301",  "classroom",       30, "Standard classroom"),
        ("bld_jubilee", 3, "Room 305",  "conference_room", 12, "Faculty conference room"),

        # Corrigan Hall
        ("bld_corrigan", 1, "Room 101",  "classroom",      40, "Large classroom with smart board"),
        ("bld_corrigan", 1, "Room 108",  "lecture_hall",   100, "Main lecture hall"),
        ("bld_corrigan", 2, "Room 201",  "classroom",      35, "Standard classroom"),
        ("bld_corrigan", 2, "Room 205",  "study_room",      6, "Group study room"),
        ("bld_corrigan", 3, "Room 301",  "conference_room", 15, "Department conference room"),

        # McNulty Hall
        ("bld_mcnulty", 1, "Room 101",  "science_lab",     24, "Chemistry lab with fume hoods"),
        ("bld_mcnulty", 1, "Room 103",  "science_lab",     24, "Biology lab"),
        ("bld_mcnulty", 2, "Room 201",  "computer_lab",    30, "CS computer lab"),
        ("bld_mcnulty", 2, "Room 206",  "classroom",       35, "Standard classroom"),
        ("bld_mcnulty", 3, "Room 302",  "science_lab",     20, "Physics lab"),
        ("bld_mcnulty", 3, "Room 310",  "study_room",       6, "Study room"),

        # Mooney Hall
        ("bld_mooney", 1, "Room 101",  "classroom",        30, "Standard classroom"),
        ("bld_mooney", 1, "Room 110",  "event_space",      60, "Multipurpose event space"),
        ("bld_mooney", 2, "Room 201",  "classroom",        35, "Standard classroom"),
        ("bld_mooney", 2, "Room 208",  "computer_lab",     28, "Business computer lab"),

        # Stafford Hall
        ("bld_stafford", 1, "Room 101", "classroom",       30, "Standard classroom"),
        ("bld_stafford", 1, "Room 104", "multipurpose",    50, "Multipurpose room"),
        ("bld_stafford", 2, "Room 201", "study_room",       8, "Group study room"),
        ("bld_stafford", 2, "Room 205", "conference_room", 10, "Small conference room"),

        # Walsh Library
        ("bld_library", 1, "Room 101",  "study_room",       4, "Quiet study room"),
        ("bld_library", 1, "Room 102",  "study_room",       4, "Quiet study room"),
        ("bld_library", 1, "Room 105",  "study_room",       8, "Group study room"),
        ("bld_library", 2, "Room 201",  "computer_lab",    40, "Library computer lab"),
        ("bld_library", 2, "Room 205",  "study_room",       6, "Group study room"),
        ("bld_library", 3, "Room 301",  "conference_room", 12, "Library conference room"),
        ("bld_library", 3, "Room 305",  "study_room",       4, "Quiet study room"),
    ]

    equipment_map = {
        "classroom":       ["Projector", "Whiteboard"],
        "lecture_hall":     ["Projector", "Microphone", "Whiteboard"],
        "computer_lab":    ["Desktop Computers", "Projector"],
        "science_lab":     ["Lab Equipment", "Whiteboard"],
        "study_room":      ["Whiteboard"],
        "conference_room": ["Projector", "Whiteboard", "Video Conferencing"],
        "event_space":     ["Projector", "Microphone", "Speakers"],
        "multipurpose":    ["Projector", "Whiteboard", "Speakers"],
    }

    for bid, floor_num, name, rtype, cap, desc in rooms:
        rid = _id("rm")
        fid = floors[(bid, floor_num)]
        await db.execute(
            "INSERT INTO rooms VALUES (?,?,?,?,?,NULL,1,'available',?)",
            (rid, fid, name, rtype, cap, desc),
        )
        for equip in equipment_map.get(rtype, []):
            await db.execute(
                "INSERT INTO room_equipment VALUES (?,?,?)",
                (_id("eq"), rid, equip),
            )

    await db.commit()
    print(f"  Seeded {len(buildings)} buildings, {len(rooms)} rooms")


async def sync_passwords():
    """Ensure all users have the shared password (hackathon demo)."""
    db = await get_db()
    pw_hash = hash_password(SHARED_PASSWORD)
    await db.execute("UPDATE users SET password_hash = ?", (pw_hash,))
    await db.commit()
    print(f"  Synced all user passwords to shared password")
