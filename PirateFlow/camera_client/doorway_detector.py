"""
Doorway detection using Claude Vision API with OpenCV fallback.

Finds the actual doorway in a camera frame and returns a polygon zone
defining the threshold region, plus which direction leads into the room.

Primary: Claude Vision analyzes the frame and returns polygon coordinates.
Fallback: OpenCV edge/contour detection approximates the door frame.
"""

import base64
import json
import os
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np


@dataclass
class DoorwayResult:
    """Result of doorway detection."""
    polygon: list[tuple[float, float]]  # normalized (x,y) vertices, 0-1
    room_direction: tuple[float, float]  # unit vector pointing into room
    confidence: float
    reference_frame: Optional[np.ndarray] = field(default=None, repr=False)
    detected: bool = True


# ---------------------------------------------------------------------------
# Claude Vision detection
# ---------------------------------------------------------------------------

CLAUDE_PROMPT = """Analyze this security/surveillance camera frame. Your task is to identify the doorway or entrance/exit opening visible in the image.

Return a JSON object with these fields:
{
  "doorway_found": true/false,
  "polygon": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],
  "room_side": "left" | "right" | "top" | "bottom",
  "confidence": 0.0-1.0,
  "description": "brief description of what you see"
}

CRITICAL INSTRUCTIONS:
- The camera is mounted OUTSIDE a classroom/room, looking at the door from a hallway/corridor.
- "polygon" must be a THIN STRIP across the door threshold — like a narrow tripwire zone that people walk THROUGH in 1-2 seconds.
- The polygon should be NARROW in the direction people walk through (about 10-15% of the image depth). NOT a large box covering the whole doorway area.
- Think of it as a finish line at a race — a thin band people cross, not a big area they stand in.
- Example: if the door is visible as a vertical rectangle, the polygon should be 4 points forming a thin horizontal band across the bottom of the door frame where the threshold/floor is.
- Coordinates are NORMALIZED 0.0-1.0 where (0,0) is top-left and (1,1) is bottom-right.
- "room_side" indicates which direction leads INTO the room FROM the camera's perspective.
  - The camera is in the corridor/hallway, so the room is THROUGH/BEYOND the door.
  - If the door leads to an area that is farther from the camera (deeper in the image), room_side is typically "top" (top of image = further away in perspective).
  - If the door is to the left of the image and the room is through it, say "left".
- If no clear doorway is visible, set doorway_found to false.

Respond ONLY with the JSON object, no other text."""


def detect_doorway_claude(frame: np.ndarray, api_key: str = None) -> Optional[DoorwayResult]:
    """Use Claude Vision to detect the doorway in a frame.

    This is synchronous (blocking) — intended to run once at startup.
    """
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        import anthropic
    except ImportError:
        print("[doorway] anthropic package not installed")
        return None

    # Encode frame as JPEG base64
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    image_b64 = base64.b64encode(buffer).decode("utf-8")

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            temperature=0.1,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": CLAUDE_PROMPT},
                    {"type": "image", "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": image_b64,
                    }},
                ],
            }],
        )

        # Parse response
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[:raw.rfind("```")]
            raw = raw.strip()

        data = json.loads(raw)

        if not data.get("doorway_found", False):
            print(f"[doorway] Claude says no doorway found: {data.get('description', '')}")
            return None

        polygon = [tuple(p) for p in data["polygon"]]
        confidence = float(data.get("confidence", 0.5))
        room_side = data.get("room_side", "bottom")

        # Convert room_side to a direction vector
        room_dir = _room_side_to_vector(room_side, polygon)

        print(f"[doorway] Claude detected doorway: {len(polygon)} vertices, "
              f"room side={room_side}, confidence={confidence:.0%}")
        print(f"[doorway] Description: {data.get('description', '')}")

        return DoorwayResult(
            polygon=polygon,
            room_direction=room_dir,
            confidence=confidence,
            reference_frame=frame.copy(),
        )

    except Exception as e:
        print(f"[doorway] Claude Vision failed: {e}")
        return None


def _room_side_to_vector(room_side: str, polygon: list) -> tuple[float, float]:
    """Convert a room_side string to a unit direction vector from polygon center."""
    # Compute polygon center
    cx = sum(p[0] for p in polygon) / len(polygon)
    cy = sum(p[1] for p in polygon) / len(polygon)

    vectors = {
        "left": (-1.0, 0.0),
        "right": (1.0, 0.0),
        "top": (0.0, -1.0),
        "bottom": (0.0, 1.0),
    }
    return vectors.get(room_side.lower(), (0.0, 1.0))


# ---------------------------------------------------------------------------
# OpenCV fallback detection
# ---------------------------------------------------------------------------

def detect_doorway_opencv(frame: np.ndarray) -> Optional[DoorwayResult]:
    """Detect doorway using OpenCV edge detection and contour analysis.
    Returns a polygon zone from the best door-like contour found.
    """
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Edge detection
    edges = cv2.Canny(blurred, 30, 100)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.erode(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    min_area = h * w * 0.02
    max_area = h * w * 0.7
    best = None
    best_score = 0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        aspect = bh / max(bw, 1)
        rect_fill = area / max(bw * bh, 1)

        score = 0.0
        if 1.2 <= aspect <= 4.0:
            score += 0.3
        if rect_fill > 0.6:
            score += 0.2
        score += min(0.3, (area / (h * w)) * 3)
        cx = x + bw / 2
        if 0.1 * w < cx < 0.9 * w:
            score += 0.1

        if score > best_score:
            best_score = score
            best = (x, y, bw, bh)

    if not best or best_score < 0.2:
        return None

    x, y, bw, bh = best
    # Create a THIN STRIP across the bottom of the door (the threshold)
    # The strip is about 15% of the door height, centered at 75% down
    pad = 0.02
    strip_center_y = (y + bh * 0.75) / h
    strip_half_h = (bh * 0.08) / h  # thin strip

    polygon = [
        (max(0, x / w - pad), strip_center_y - strip_half_h),
        (min(1, (x + bw) / w + pad), strip_center_y - strip_half_h),
        (min(1, (x + bw) / w + pad), strip_center_y + strip_half_h),
        (max(0, x / w - pad), strip_center_y + strip_half_h),
    ]

    # Camera is outside looking at door — room is through/beyond the door (top of image in perspective)
    room_direction = (0.0, -1.0)

    return DoorwayResult(
        polygon=polygon,
        room_direction=room_direction,
        confidence=best_score,
        reference_frame=frame.copy(),
    )


# ---------------------------------------------------------------------------
# Main detection function
# ---------------------------------------------------------------------------

def detect_doorway(frame: np.ndarray, api_key: str = None) -> DoorwayResult:
    """Detect doorway using Claude Vision (primary) or OpenCV (fallback).
    Always returns a result — falls back to center-frame default if nothing found.
    """
    # Try Claude Vision first
    result = detect_doorway_claude(frame, api_key)
    if result and result.confidence > 0.3:
        return result

    # Fallback to OpenCV
    print("[doorway] Trying OpenCV fallback...")
    result = detect_doorway_opencv(frame)
    if result:
        print(f"[doorway] OpenCV detected doorway (confidence: {result.confidence:.0%})")
        result.reference_frame = frame.copy()
        return result

    # Last resort: thin strip across center
    print("[doorway] No doorway detected — using default thin strip at center")
    return DoorwayResult(
        polygon=[(0.1, 0.45), (0.9, 0.45), (0.9, 0.55), (0.1, 0.55)],
        room_direction=(0.0, -1.0),  # room is "through" the door (top/further from camera)
        confidence=0.0,
        reference_frame=frame.copy(),
        detected=False,
    )


# ---------------------------------------------------------------------------
# Camera stability check
# ---------------------------------------------------------------------------

def check_camera_stability(current_frame: np.ndarray,
                           reference_frame: np.ndarray,
                           threshold: float = 0.7) -> float:
    """Compare current frame to reference. Returns similarity 0-1.
    If below threshold, the camera has likely moved.
    """
    # Resize both to small size for fast comparison
    size = (160, 120)
    ref_small = cv2.resize(cv2.cvtColor(reference_frame, cv2.COLOR_BGR2GRAY), size)
    cur_small = cv2.resize(cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY), size)

    # Normalized cross-correlation
    result = cv2.matchTemplate(cur_small, ref_small, cv2.TM_CCOEFF_NORMED)
    similarity = float(result[0][0])
    return similarity
