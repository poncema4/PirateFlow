"""
Face recognition service for access control.

Handles face encoding, registration, identification, and booking validation.
All CPU-bound face_recognition calls are wrapped in asyncio.to_thread()
to keep the FastAPI event loop responsive.

Robustness strategy (single photo per user):
    At registration, we generate multiple augmented encodings from the single
    ID photo — brightness/contrast variations and a horizontal flip. This gives
    the matcher a richer set of reference encodings to compare against, making
    it far more tolerant of different webcam lighting and angles.

    At verification, we preprocess the webcam frame (normalize brightness,
    enhance contrast) before encoding, and use the CNN model for more accurate
    face detection.

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
from PIL import Image, ImageEnhance, ImageOps

from models.schemas import AccessLogEntry

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MATCH_TOLERANCE = 0.58  # Balanced: 0.5 was too strict, 0.6 is library default
DETECTION_MODEL = "cnn"  # "cnn" is more accurate than "hog", slower but fine for our scale
NUM_JITTERS = 3  # Re-sample each face N times and average — more stable encodings

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------

# user_id -> list of 128-d face encodings (multiple augmented from single photo)
_face_registry: dict[str, list[np.ndarray]] = {}

# Chronological log of all face scan attempts
_access_log: list[AccessLogEntry] = []

# user_id -> name (for display in alerts)
_user_names: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Image preprocessing
# ---------------------------------------------------------------------------

def _decode_image(image_base64: str) -> bytes:
    """Decode a base64-encoded image string to raw bytes."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    return base64.b64decode(image_base64)


def _bytes_to_pil(image_bytes: bytes) -> Image.Image:
    """Convert raw image bytes to a PIL Image in RGB mode."""
    image = Image.open(io.BytesIO(image_bytes))
    return image.convert("RGB")


def _pil_to_array(image: Image.Image) -> np.ndarray:
    """Convert PIL Image to numpy RGB array."""
    return np.array(image)


def _normalize_frame(image: Image.Image) -> Image.Image:
    """
    Normalize a webcam frame for better face matching.
    - Auto-contrast to handle varying lighting
    - Slight sharpness boost for webcam blur
    """
    image = ImageOps.autocontrast(image, cutoff=1)
    image = ImageEnhance.Sharpness(image).enhance(1.3)
    return image


def _apply_gamma(image: Image.Image, gamma: float) -> Image.Image:
    """Apply gamma correction to simulate different lighting conditions."""
    img_array = np.array(image, dtype=np.float32) / 255.0
    corrected = np.power(img_array, gamma)
    return Image.fromarray((corrected * 255).astype(np.uint8))


def _generate_augmented_images(image: Image.Image) -> list[Image.Image]:
    """
    Generate augmented versions of a single ID photo for robust matching.
    Returns a list of PIL Images including the original.
    More variations = more robust matching from a single photo.
    """
    augmented = []

    # 1. Original (normalized)
    augmented.append(ImageOps.autocontrast(image, cutoff=1))

    # 2. Horizontal flip (covers mirror-image webcam setups)
    augmented.append(ImageOps.mirror(image))

    # 3-4. Brightness variations
    augmented.append(ImageEnhance.Brightness(image).enhance(1.25))
    augmented.append(ImageEnhance.Brightness(image).enhance(0.75))

    # 5-6. Contrast variations
    augmented.append(ImageEnhance.Contrast(image).enhance(1.3))
    augmented.append(ImageEnhance.Contrast(image).enhance(0.7))

    # 7-8. Gamma correction (simulates harsh overhead vs. dim lighting)
    augmented.append(_apply_gamma(image, 0.7))  # Brighter shadows
    augmented.append(_apply_gamma(image, 1.4))  # Darker overall

    # 9-10. Slight rotations (head tilt)
    augmented.append(image.rotate(5, resample=Image.BILINEAR, expand=False, fillcolor=(128, 128, 128)))
    augmented.append(image.rotate(-5, resample=Image.BILINEAR, expand=False, fillcolor=(128, 128, 128)))

    # 11. Combined: bright + high contrast (harsh fluorescent lighting)
    augmented.append(ImageEnhance.Contrast(ImageEnhance.Brightness(image).enhance(1.15)).enhance(1.2))

    # 12. Combined: dark + low contrast (dim room)
    augmented.append(ImageEnhance.Contrast(ImageEnhance.Brightness(image).enhance(0.85)).enhance(0.8))

    # 13. Mirrored + brightness (webcam mirror with different lighting)
    augmented.append(ImageEnhance.Brightness(ImageOps.mirror(image)).enhance(1.2))

    return augmented


# ---------------------------------------------------------------------------
# Sync face processing (run in thread pool)
# ---------------------------------------------------------------------------

def _extract_encoding(image_bytes: bytes, use_cnn: bool = True) -> Optional[np.ndarray]:
    """Extract a single face encoding from image bytes. Returns None if no face found."""
    try:
        pil_image = _bytes_to_pil(image_bytes)
        rgb_array = _pil_to_array(pil_image)
    except Exception:
        return None

    model = DETECTION_MODEL if use_cnn else "hog"

    try:
        face_locations = face_recognition.face_locations(rgb_array, model=model)
    except Exception:
        # CNN can fail on some systems — fall back to HOG
        face_locations = face_recognition.face_locations(rgb_array, model="hog")

    if not face_locations:
        return None

    # Take the first (largest) face
    encodings = face_recognition.face_encodings(rgb_array, face_locations[:1], num_jitters=NUM_JITTERS)
    if not encodings:
        return None
    return encodings[0]


def _extract_encoding_from_pil(image: Image.Image, fast: bool = False) -> Optional[np.ndarray]:
    """Extract face encoding directly from a PIL Image.
    fast=True uses HOG + fewer jitters for registration speed.
    """
    rgb_array = _pil_to_array(image)
    model = "hog" if fast else DETECTION_MODEL
    jitters = 1 if fast else NUM_JITTERS

    try:
        face_locations = face_recognition.face_locations(rgb_array, model=model)
    except Exception:
        face_locations = face_recognition.face_locations(rgb_array, model="hog")

    if not face_locations:
        return None

    encodings = face_recognition.face_encodings(rgb_array, face_locations[:1], num_jitters=jitters)
    if not encodings:
        return None
    return encodings[0]


def _extract_encoding_webcam(image_bytes: bytes) -> Optional[np.ndarray]:
    """Extract face encoding from a webcam/RTSP frame with preprocessing.
    Uses HOG for speed -- verification needs to be fast for live feeds.
    """
    try:
        pil_image = _bytes_to_pil(image_bytes)
        pil_image = _normalize_frame(pil_image)
        rgb_array = _pil_to_array(pil_image)
    except Exception:
        return None

    face_locations = face_recognition.face_locations(rgb_array, model="hog")
    if not face_locations:
        return None

    encodings = face_recognition.face_encodings(rgb_array, face_locations[:1], num_jitters=1)
    if not encodings:
        return None
    return encodings[0]


def _register_with_augmentation(image_bytes: bytes) -> list[np.ndarray]:
    """
    Generate multiple face encodings from a single ID photo using augmentation.
    Returns a list of encodings, or empty list if no face found in original.
    """
    try:
        pil_image = _bytes_to_pil(image_bytes)
    except Exception:
        return []

    augmented_images = _generate_augmented_images(pil_image)
    total = len(augmented_images)
    encodings = []

    print(f"[face_service] Processing {total} augmented images...")
    for i, aug_image in enumerate(augmented_images, 1):
        print(f"[face_service]   Encoding {i}/{total}...", flush=True)
        encoding = _extract_encoding_from_pil(aug_image, fast=True)
        if encoding is not None:
            encodings.append(encoding)

    print(f"[face_service] Done: {len(encodings)}/{total} encodings extracted")
    return encodings


def _match_face(encoding: np.ndarray) -> Optional[tuple[str, float]]:
    """
    Compare an encoding against all registered faces.
    Each user has multiple augmented encodings — we check against all of them
    and use the best (lowest distance) match.

    Returns (user_id, confidence) or None if no match.
    Confidence is 1.0 - distance (higher = better match).
    """
    if not _face_registry:
        return None

    best_user_id = None
    best_distance = float("inf")

    try:
        for user_id, user_encodings in _face_registry.items():
            distances = face_recognition.face_distance(user_encodings, encoding)
            min_distance = float(np.min(distances))
            if min_distance < best_distance:
                best_distance = min_distance
                best_user_id = user_id

        if best_distance <= MATCH_TOLERANCE and best_user_id is not None:
            confidence = round(1.0 - best_distance, 3)
            return best_user_id, confidence
    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def register_face(user_id: str, image_bytes: bytes, user_name: str = "") -> bool:
    """
    Register or update face encodings for a user from a single ID photo.
    Generates multiple augmented encodings for robust matching.
    Returns True if at least one face encoding was extracted, False otherwise.
    """
    encodings = await asyncio.to_thread(_register_with_augmentation, image_bytes)
    if not encodings:
        return False
    _face_registry[user_id] = encodings
    if user_name:
        _user_names[user_id] = user_name
    print(f"[face_service] Registered {len(encodings)} augmented encodings for {user_name or user_id}")
    return True


async def identify_face(image_bytes: bytes) -> Optional[tuple[str, float]]:
    """
    Identify a face against the registry from a webcam frame.
    Preprocesses the frame for better matching before encoding.
    Returns (user_id, confidence) or None if not recognized.
    """
    encoding = await asyncio.to_thread(_extract_encoding_webcam, image_bytes)
    if encoding is None:
        return None
    return await asyncio.to_thread(_match_face, encoding)


def check_booking_validity(user_id: str, room_id: str) -> bool:
    """
    Check if the user has a confirmed booking for this room right now.
    Uses stub bookings until Role 1 delivers real DB queries.
    """
    from routers.bookings import STUB_BOOKINGS as _STUB_BOOKINGS
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
