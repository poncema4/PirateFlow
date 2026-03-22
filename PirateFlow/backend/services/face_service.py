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

MATCH_TOLERANCE = 0.55  # Tighter tolerance — ID photos are high quality, we can be stricter
DETECTION_MODEL = "cnn"  # "cnn" is more accurate than "hog", slower but fine for our scale
NUM_JITTERS = 5  # More re-samples = more stable encodings (worth the extra time at registration)

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
    Normalize a camera frame to bridge the gap with studio ID photos.
    ID photos: even lighting, sharp, front-facing, good contrast.
    Camera frames: uneven lighting, motion blur, angles, variable contrast.

    This preprocessing makes camera frames look more like ID photos.
    """
    # Auto-contrast — normalizes exposure to match ID photo levels
    image = ImageOps.autocontrast(image, cutoff=2)

    # Boost contrast slightly — ID photos have good contrast
    image = ImageEnhance.Contrast(image).enhance(1.15)

    # Sharpen — compensates for motion blur and camera softness
    image = ImageEnhance.Sharpness(image).enhance(1.5)

    # Normalize color balance — reduces fluorescent light color cast
    image = ImageEnhance.Color(image).enhance(0.9)

    return image


def _apply_gamma(image: Image.Image, gamma: float) -> Image.Image:
    """Apply gamma correction to simulate different lighting conditions."""
    img_array = np.array(image, dtype=np.float32) / 255.0
    corrected = np.power(img_array, gamma)
    return Image.fromarray((corrected * 255).astype(np.uint8))


def _perspective_transform(image: Image.Image, direction: str, strength: float = 0.08) -> Image.Image:
    """Simulate a slight perspective shift as if the face were viewed from an angle.
    This helps match ID headshots (front-facing) against security camera angles.
    """
    w, h = image.size
    s = strength
    if direction == "left":
        # Face turned slightly left (camera sees right side more)
        coeffs = [1 + s, s, 0, -s * 0.5, 1, 0, s / w, 0]
    elif direction == "right":
        coeffs = [1 + s, -s, 0, s * 0.5, 1, 0, -s / w, 0]
    elif direction == "up":
        # Camera is above looking down (common for security cameras)
        coeffs = [1, 0, 0, 0, 1 + s, -s * h * 0.1, 0, s / h]
    else:  # down
        coeffs = [1, 0, 0, 0, 1 + s, s * h * 0.05, 0, -s / h]
    try:
        return image.transform(image.size, Image.PERSPECTIVE, coeffs, Image.BILINEAR)
    except Exception:
        return image


def _generate_augmented_images(image: Image.Image) -> list[Image.Image]:
    """
    Generate augmented versions of a single ID headshot for robust matching
    against security camera footage.

    ID photos are front-facing, controlled lighting. Security cameras have:
    - Different angles (above, side)
    - Hallway/fluorescent lighting
    - Motion blur, lower resolution
    - Different distances

    We generate variations to cover these differences.
    """
    augmented = []

    # --- Core variations ---
    # 1. Original (normalized)
    augmented.append(ImageOps.autocontrast(image, cutoff=1))

    # 2. Horizontal flip (webcam mirror + walking from either side)
    augmented.append(ImageOps.mirror(image))

    # --- Lighting variations (hallway vs studio) ---
    # 3-4. Brightness (hallway lighting varies a lot)
    augmented.append(ImageEnhance.Brightness(image).enhance(1.3))
    augmented.append(ImageEnhance.Brightness(image).enhance(0.7))

    # 5-6. Contrast (security cameras often have low contrast)
    augmented.append(ImageEnhance.Contrast(image).enhance(1.4))
    augmented.append(ImageEnhance.Contrast(image).enhance(0.6))

    # 7-8. Gamma (overhead fluorescent = harsh shadows from above)
    augmented.append(_apply_gamma(image, 0.6))
    augmented.append(_apply_gamma(image, 1.5))

    # --- Angle variations (ID is front-facing, camera is not) ---
    # 9-12. Perspective transforms simulating different camera angles
    augmented.append(_perspective_transform(image, "left"))
    augmented.append(_perspective_transform(image, "right"))
    augmented.append(_perspective_transform(image, "up"))    # camera above
    augmented.append(_perspective_transform(image, "up", 0.12))  # more extreme above angle

    # 13-16. Head tilt/rotation (people don't walk perfectly straight)
    augmented.append(image.rotate(8, resample=Image.BILINEAR, expand=False, fillcolor=(128, 128, 128)))
    augmented.append(image.rotate(-8, resample=Image.BILINEAR, expand=False, fillcolor=(128, 128, 128)))
    augmented.append(image.rotate(15, resample=Image.BILINEAR, expand=False, fillcolor=(128, 128, 128)))
    augmented.append(image.rotate(-15, resample=Image.BILINEAR, expand=False, fillcolor=(128, 128, 128)))

    # --- Combined variations (realistic scenarios) ---
    # 17. Harsh fluorescent hallway: bright + high contrast + slight angle
    harsh = ImageEnhance.Contrast(ImageEnhance.Brightness(image).enhance(1.2)).enhance(1.3)
    augmented.append(_perspective_transform(harsh, "up"))

    # 18. Dim hallway: dark + low contrast
    dim = ImageEnhance.Contrast(ImageEnhance.Brightness(image).enhance(0.8)).enhance(0.7)
    augmented.append(dim)

    # 19. Mirrored + camera angle (walking toward camera from the other side)
    augmented.append(_perspective_transform(ImageOps.mirror(image), "up"))

    # 20. Slightly blurred (motion blur / distance from camera)
    try:
        from PIL import ImageFilter
        augmented.append(image.filter(ImageFilter.GaussianBlur(radius=1)))
    except Exception:
        pass

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
    """Extract face encoding from a camera frame with enhanced preprocessing.

    Tries multiple approaches to maximize match rate against ID photos:
    1. Normalized frame + CNN detection (most accurate)
    2. Normalized frame + HOG detection (faster fallback)
    3. Raw frame + HOG (in case normalization hurts)
    """
    try:
        pil_image = _bytes_to_pil(image_bytes)
    except Exception:
        return None

    # Attempt 1: Normalized + CNN (best quality)
    normalized = _normalize_frame(pil_image)
    rgb_array = _pil_to_array(normalized)

    try:
        face_locations = face_recognition.face_locations(rgb_array, model="cnn")
    except Exception:
        face_locations = []

    if face_locations:
        encodings = face_recognition.face_encodings(rgb_array, face_locations[:1], num_jitters=2)
        if encodings:
            return encodings[0]

    # Attempt 2: Normalized + HOG (faster)
    face_locations = face_recognition.face_locations(rgb_array, model="hog")
    if face_locations:
        encodings = face_recognition.face_encodings(rgb_array, face_locations[:1], num_jitters=2)
        if encodings:
            return encodings[0]

    # Attempt 3: Raw frame + HOG (maybe normalization removed important features)
    raw_array = _pil_to_array(pil_image)
    face_locations = face_recognition.face_locations(raw_array, model="hog")
    if face_locations:
        encodings = face_recognition.face_encodings(raw_array, face_locations[:1], num_jitters=1)
        if encodings:
            return encodings[0]

    return None


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

    Uses two thresholds:
    - MATCH_TOLERANCE (0.55): high confidence match
    - MATCH_TOLERANCE + 0.07 (0.62): second-chance match, only if the best
      match is significantly better than the second-best (gap > 0.05)

    Returns (user_id, confidence) or None if no match.
    """
    if not _face_registry:
        return None

    results = []  # (distance, user_id)

    try:
        for user_id, user_encodings in _face_registry.items():
            distances = face_recognition.face_distance(user_encodings, encoding)
            min_distance = float(np.min(distances))
            results.append((min_distance, user_id))

        if not results:
            return None

        results.sort(key=lambda x: x[0])
        best_dist, best_uid = results[0]

        # High confidence match
        if best_dist <= MATCH_TOLERANCE:
            return best_uid, round(1.0 - best_dist, 3)

        # Second-chance: if the best match is close AND significantly better
        # than the next best, it's likely correct
        RELAXED_TOLERANCE = MATCH_TOLERANCE + 0.07
        if best_dist <= RELAXED_TOLERANCE and len(results) >= 2:
            second_dist = results[1][0]
            gap = second_dist - best_dist
            if gap > 0.05:  # clear separation from second best
                return best_uid, round(1.0 - best_dist, 3)

    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

def _serialize_encodings(encodings: list[np.ndarray]) -> bytes:
    """Serialize face encodings to a binary blob for DB storage."""
    import pickle
    return pickle.dumps([e.tolist() for e in encodings])


def _deserialize_encodings(blob: bytes) -> list[np.ndarray]:
    """Deserialize face encodings from a DB blob."""
    import pickle
    return [np.array(e) for e in pickle.loads(blob)]


async def register_face(user_id: str, image_bytes: bytes, user_name: str = "") -> bool:
    """
    Register face encodings for a user from an ID photo.

    1. Computes augmented encodings from the photo
    2. Saves ENCODINGS (not the image) to DB as a binary blob
    3. Saves the photo to disk as backup for re-registration
    4. Caches encodings in memory for fast matching

    The photo is only used during this registration step.
    At runtime, only the 128-d number arrays are used for matching.
    """
    encodings = await asyncio.to_thread(_register_with_augmentation, image_bytes)
    if not encodings:
        return False
    _face_registry[user_id] = encodings
    if user_name:
        _user_names[user_id] = user_name

    try:
        import os
        # Save photo to disk (backup only — not used at runtime)
        faces_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "faces")
        os.makedirs(faces_dir, exist_ok=True)
        filename = f"{user_id}.jpg"
        filepath = os.path.join(faces_dir, filename)
        with open(filepath, "wb") as f:
            f.write(image_bytes)

        # Save encodings to DB (this is what gets loaded on restart)
        from services.database import get_db
        db = await get_db()
        face_id = f"face_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        label = user_name or user_id
        encodings_blob = _serialize_encodings(encodings)

        await db.execute("DELETE FROM enrolled_faces WHERE user_id = ?", (user_id,))
        await db.execute(
            "INSERT INTO enrolled_faces VALUES (?,?,?,?,?,1,?)",
            (face_id, user_id, f"faces/{filename}", label, now, encodings_blob),
        )
        await db.commit()
    except Exception as e:
        print(f"[face_service] DB persistence failed (non-fatal): {e}")

    print(f"[face_service] Registered {len(encodings)} encodings for {user_name or user_id}")
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


async def check_booking_validity(user_id: str, room_id: str) -> bool:
    """Check if the user has a confirmed booking for this room right now."""
    from services.database import get_db
    db = await get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cursor = await db.execute("""
        SELECT COUNT(*) FROM bookings
        WHERE user_id = ? AND room_id = ? AND status = 'confirmed'
        AND start_time <= ? AND end_time >= ?
    """, (user_id, room_id, now, now))
    count = (await cursor.fetchone())[0]
    return count > 0


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


async def remove_face(user_id: str) -> bool:
    """Remove a user's face encoding from memory, disk, and DB."""
    removed = _face_registry.pop(user_id, None) is not None
    _user_names.pop(user_id, None)

    try:
        import os
        faces_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "faces")
        filepath = os.path.join(faces_dir, f"{user_id}.jpg")
        if os.path.exists(filepath):
            os.remove(filepath)

        from services.database import get_db
        db = await get_db()
        await db.execute("DELETE FROM enrolled_faces WHERE user_id = ?", (user_id,))
        await db.commit()
    except Exception as e:
        print(f"[face_service] DB cleanup failed (non-fatal): {e}")

    return removed


async def load_enrolled_faces():
    """Load pre-computed face encodings from DB.

    Encodings are stored as binary blobs — no images are loaded or processed.
    This makes startup instant regardless of how many faces are enrolled.
    If a face was registered before encoding storage was added (no blob),
    falls back to recomputing from the photo on disk.
    """
    import os
    try:
        from services.database import get_db
        db = await get_db()
        cursor = await db.execute("""
            SELECT ef.user_id, ef.face_image_path, ef.label, ef.encodings_blob,
                   u.first_name || ' ' || u.last_name AS user_name
            FROM enrolled_faces ef
            JOIN users u ON ef.user_id = u.id
            WHERE ef.is_active = 1
        """)
        rows = await cursor.fetchall()

        base_dir = os.path.dirname(os.path.dirname(__file__))
        loaded = 0
        recomputed = 0

        for row in rows:
            user_id = row["user_id"]
            name = row["user_name"] or row["label"]

            # Try loading pre-computed encodings from DB blob (fast path)
            if row["encodings_blob"]:
                try:
                    encodings = _deserialize_encodings(row["encodings_blob"])
                    if encodings:
                        _face_registry[user_id] = encodings
                        _user_names[user_id] = name
                        loaded += 1
                        continue
                except Exception:
                    pass

            # Fallback: recompute from photo (slow path, only for legacy entries)
            if row["face_image_path"]:
                filepath = os.path.join(base_dir, row["face_image_path"])
                if os.path.exists(filepath):
                    with open(filepath, "rb") as f:
                        image_bytes = f.read()
                    encodings = await asyncio.to_thread(_register_with_augmentation, image_bytes)
                    if encodings:
                        _face_registry[user_id] = encodings
                        _user_names[user_id] = name
                        # Save encodings to DB so next restart is instant
                        blob = _serialize_encodings(encodings)
                        await db.execute(
                            "UPDATE enrolled_faces SET encodings_blob = ? WHERE user_id = ?",
                            (blob, user_id),
                        )
                        recomputed += 1

        if recomputed:
            await db.commit()

        total = loaded + recomputed
        if total:
            msg = f"[face_service] Loaded {loaded} faces from DB encodings"
            if recomputed:
                msg += f", recomputed {recomputed} from photos (now cached)"
            print(msg)
    except Exception as e:
        print(f"[face_service] Failed to load enrolled faces: {e}")


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
