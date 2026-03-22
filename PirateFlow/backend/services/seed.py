"""
Minimal seeder for PirateFlow.

Only creates a bootstrap admin account if no users exist.
All other data (buildings, rooms, cameras, students) is created
through the admin UI.
"""

from services.auth import hash_password
from services.database import get_db


async def seed_database():
    """Create bootstrap admin if no users exist."""
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) FROM users")
    row = await cursor.fetchone()
    if row[0] > 0:
        return

    print("Seeding bootstrap admin account...")
    now = "2026-03-21T00:00:00Z"
    password_hash = hash_password("admin")

    await db.execute(
        "INSERT INTO users VALUES (?,?,?,?,?,?,NULL,NULL,NULL,NULL,?)",
        ("usr_admin", "admin@shu.edu", password_hash, "Admin", "User", "admin", now),
    )

    await db.commit()
    print("  Created admin@shu.edu (password: admin)")
