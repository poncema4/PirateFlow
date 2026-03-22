"""
Minimal seeder for PirateFlow.

Only creates a bootstrap admin account if no users exist.
All other data (buildings, rooms, cameras, students) is created
through the admin UI.
"""

from services.auth import hash_password, SHARED_PASSWORD
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
    password_hash = hash_password(SHARED_PASSWORD)

    await db.execute(
        "INSERT INTO users VALUES (?,?,?,?,?,?,NULL,NULL,NULL,NULL,?)",
        ("usr_admin", "admin@shu.edu", password_hash, "Admin", "User", "admin", now),
    )

    await db.commit()
    print(f"  Created admin@shu.edu (password: {SHARED_PASSWORD})")


async def sync_passwords():
    """Ensure all users have the shared password (hackathon demo)."""
    db = await get_db()
    pw_hash = hash_password(SHARED_PASSWORD)
    await db.execute("UPDATE users SET password_hash = ?", (pw_hash,))
    await db.commit()
    print(f"  Synced all user passwords to shared password")
