"""
Face recognition service for access control.

Handles face encoding, registration, identification, and booking validation.
All CPU-bound face_recognition calls are wrapped in asyncio.to_thread()
to keep the FastAPI event loop responsive.

In-memory stores for hackathon; will migrate to SQLite when Role 1 delivers DB.
"""

import asyncio
import base64
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

import face_recognition
import numpy as np
from PIL import Image

from models.schemas import AccessLogEntry

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MATCH_TOLERANCE = 0.5  # Lower = stricter matching. 0.6 is default, 0.5 is tighter.

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------

# user_id -> 128-d face encoding (numpy array)
_face_registry: dict[str, np.ndarray] = {}

# Chronological log of all face scan attempts
_access_log: list[AccessLogEntry] = []

# user_id -> name (for display in alerts)
_user_names: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _decode_image(image_base64: str) -> bytes:
    """Decode a base64-encoded image string to raw bytes."""
    # Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    return base64.b64decode(image_base64)


def _bytes_to_rgb_array(image_bytes: bytes) -> np.ndarray:
    """Convert raw image bytes to a numpy RGB array for face_recognition."""
    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("RGB")
    return np.array(image)


# ---------------------------------------------------------------------------
# Sync face processing (run in thread pool)
# ---------------------------------------------------------------------------

def _extract_encoding(image_bytes: bytes) -> Optional[np.ndarray]:
    """Extract a single face encoding from image bytes. Returns None if no face found."""
    try:
        rgb_array = _bytes_to_rgb_array(image_bytes)
    except Exception:
        return None
    # Use HOG model (fast, CPU-only). CNN would be more accurate but needs GPU.
    face_locations = face_recognition.face_locations(rgb_array, model="hog")
    if not face_locations:
        return None
    # Take the first (largest) face
    encodings = face_recognition.face_encodings(rgb_array, face_locations[:1])
    if not encodings:
        return None
    return encodings[0]


def _match_face(encoding: np.ndarray) -> Optional[tuple[str, float]]:
    """
    Compare an encoding against all registered faces.
    Returns (user_id, confidence) or None if no match.
    Confidence is 1.0 - distance (higher = better match).
    """
    if not _face_registry:
        return None

    try:
        user_ids = list(_face_registry.keys())
        known_encodings = list(_face_registry.values())

        distances = face_recognition.face_distance(known_encodings, encoding)
        best_idx = int(np.argmin(distances))
        best_distance = float(distances[best_idx])

        if best_distance <= MATCH_TOLERANCE:
            confidence = round(1.0 - best_distance, 3)
            return user_ids[best_idx], confidence
    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def register_face(user_id: str, image_bytes: bytes, user_name: str = "") -> bool:
    """
    Register or update a face encoding for a user.
    Returns True if a face was found and registered, False otherwise.
    """
    encoding = await asyncio.to_thread(_extract_encoding, image_bytes)
    if encoding is None:
        return False
    _face_registry[user_id] = encoding
    if user_name:
        _user_names[user_id] = user_name
    return True


async def identify_face(image_bytes: bytes) -> Optional[tuple[str, float]]:
    """
    Identify a face against the registry.
    Returns (user_id, confidence) or None if not recognized.
    """
    encoding = await asyncio.to_thread(_extract_encoding, image_bytes)
    if encoding is None:
        return None
    return await asyncio.to_thread(_match_face, encoding)


def check_booking_validity(user_id: str, room_id: str) -> bool:
    """
    Check if the user has a confirmed booking for this room right now.
    Uses stub bookings until Role 1 delivers real DB queries.
    """
    from routers.bookings import _STUB_BOOKINGS
    now = datetime.now(timezone.utc)
    for booking in _STUB_BOOKINGS:
        if (
            booking.user_id == user_id
            and booking.room_id == room_id
            and booking.status.value == "confirmed"
            and booking.start_time <= now <= booking.end_time
        ):
            return True
    return False


def log_access(
    room_id: str,
    room_name: str,
    user_id: Optional[str],
    user_name: Optional[str],
    confidence: Optional[float],
    had_valid_booking: bool,
    alert_sent: bool,
) -> AccessLogEntry:
    """Record an access attempt in the log."""
    entry = AccessLogEntry(
        id=f"acc_{uuid.uuid4().hex[:8]}",
        room_id=room_id,
        room_name=room_name,
        detected_user_id=user_id,
        detected_user_name=user_name,
        matched_confidence=confidence,
        had_valid_booking=had_valid_booking,
        alert_sent=alert_sent,
        captured_at=datetime.now(timezone.utc),
    )
    _access_log.append(entry)
    # Keep last 500 entries to avoid unbounded growth
    if len(_access_log) > 500:
        _access_log.pop(0)
    return entry


def remove_face(user_id: str) -> bool:
    """Remove a user's face encoding. Returns True if it existed."""
    removed = _face_registry.pop(user_id, None) is not None
    _user_names.pop(user_id, None)
    return removed


def get_registered_count() -> int:
    """Return the number of registered face encodings."""
    return len(_face_registry)


def get_user_name(user_id: str) -> Optional[str]:
    """Look up a registered user's name."""
    return _user_names.get(user_id)


def get_access_log(limit: int = 50) -> list[AccessLogEntry]:
    """Return the most recent access log entries."""
    return list(reversed(_access_log[-limit:]))


def decode_image(image_base64: str) -> bytes:
    """Public wrapper for base64 image decoding."""
    return _decode_image(image_base64)
