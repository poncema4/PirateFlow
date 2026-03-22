"""
Door/opening detection using edge detection and contour analysis.

Analyzes a camera frame to find likely doorway rectangles and suggests
a crossing line across the opening. Uses OpenCV edge detection + contour
filtering — no ML model needed.

Strategy:
1. Convert to grayscale, blur to reduce noise
2. Canny edge detection to find edges
3. Find contours and filter for large, roughly rectangular shapes
4. Score candidates by: verticality, aspect ratio (tall > wide), size
5. The best candidate's bottom edge becomes the suggested crossing line
"""

import cv2
import numpy as np
from typing import Optional


def detect_doorway(frame: np.ndarray) -> Optional[dict]:
    """
    Detect the most likely doorway in a camera frame.

    Returns dict with:
        - bbox: (x, y, w, h) of the detected door region
        - crossing_line: ((x1, y1), (x2, y2)) normalized 0-1 — suggested line across the threshold
        - confidence: 0-1 how confident the detection is
        - contour: the raw contour points (for visualization)

    Returns None if no likely doorway found.
    """
    h, w = frame.shape[:2]

    # Preprocessing
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive threshold to handle varying lighting
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 2
    )

    # Edge detection
    edges = cv2.Canny(blurred, 30, 100)

    # Combine threshold and edges
    combined = cv2.bitwise_or(thresh, edges)

    # Morphological operations to connect nearby edges (door frames)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    combined = cv2.dilate(combined, kernel, iterations=2)
    combined = cv2.erode(combined, kernel, iterations=1)

    # Find contours
    contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    # Score each contour as a potential doorway
    candidates = []
    min_area = (h * w) * 0.02   # At least 2% of frame
    max_area = (h * w) * 0.7    # No more than 70% of frame

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue

        # Approximate to polygon
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.04 * peri, True)

        # Get bounding rectangle
        x, y, bw, bh = cv2.boundingRect(contour)

        # Score based on door-like properties
        score = 0.0

        # Aspect ratio: doors are taller than wide (ratio 1.5-3.0 is typical)
        aspect = bh / max(bw, 1)
        if 1.2 <= aspect <= 4.0:
            score += 0.3
        elif 0.8 <= aspect <= 1.2:
            score += 0.1  # Could be a wide opening

        # Size: larger is more likely a real door
        size_ratio = area / (h * w)
        score += min(0.3, size_ratio * 3)

        # Rectangularity: how close is the contour to its bounding rect?
        rect_area = bw * bh
        rectangularity = area / max(rect_area, 1)
        if rectangularity > 0.6:
            score += 0.2

        # Vertical edges: doors have strong vertical lines
        # Check if the contour has near-vertical segments
        if len(approx) >= 4:
            score += 0.1

        # Position: doors are usually not at the very edge of frame
        cx = x + bw / 2
        cy = y + bh / 2
        if 0.1 * w < cx < 0.9 * w:
            score += 0.1

        candidates.append({
            "contour": contour,
            "approx": approx,
            "bbox": (x, y, bw, bh),
            "area": area,
            "aspect": aspect,
            "score": score,
        })

    if not candidates:
        return None

    # Pick best candidate
    best = max(candidates, key=lambda c: c["score"])

    x, y, bw, bh = best["bbox"]

    # Suggest crossing line at the bottom third of the doorway
    # (where people's bodies cross the threshold)
    line_y = (y + bh * 0.75) / h  # 75% down the door = threshold level
    line_x1 = max(0, (x - 10)) / w
    line_x2 = min(w, (x + bw + 10)) / w

    return {
        "bbox": best["bbox"],
        "crossing_line": (
            (line_x1, line_y),
            (line_x2, line_y),
        ),
        "confidence": min(1.0, best["score"]),
        "contour": best["contour"],
    }


def suggest_crossing_line(frame: np.ndarray) -> dict:
    """
    High-level function: detect doorway and return a suggested crossing line.

    Returns:
        {
            "line": ((x1, y1), (x2, y2)) — normalized 0-1 coordinates,
            "confidence": float,
            "door_bbox": (x, y, w, h) or None,
            "detected": bool,
        }
    """
    result = detect_doorway(frame)

    if result and result["confidence"] > 0.2:
        return {
            "line": result["crossing_line"],
            "confidence": result["confidence"],
            "door_bbox": result["bbox"],
            "detected": True,
        }

    # Fallback: horizontal line at 50% height, full width
    return {
        "line": ((0.05, 0.5), (0.95, 0.5)),
        "confidence": 0.0,
        "door_bbox": None,
        "detected": False,
    }


def draw_detection(frame: np.ndarray, detection: dict) -> np.ndarray:
    """Draw the detection result on a frame for visualization."""
    display = frame.copy()
    h, w = frame.shape[:2]

    if detection.get("door_bbox"):
        x, y, bw, bh = detection["door_bbox"]
        cv2.rectangle(display, (x, y), (x + bw, y + bh), (0, 255, 0), 2)
        cv2.putText(display, f"Door ({detection['confidence']:.0%})",
                    (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Draw crossing line
    (x1, y1), (x2, y2) = detection["line"]
    pt1 = (int(x1 * w), int(y1 * h))
    pt2 = (int(x2 * w), int(y2 * h))
    cv2.line(display, pt1, pt2, (0, 255, 255), 3)
    cv2.putText(display, "CROSSING LINE", (pt1[0], pt1[1] - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

    # Label sides
    mid_x = (pt1[0] + pt2[0]) // 2
    mid_y = (pt1[1] + pt2[1]) // 2
    cv2.putText(display, "OUTSIDE", (mid_x - 30, mid_y - 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 200, 255), 1)
    cv2.putText(display, "INSIDE", (mid_x - 25, mid_y + 35),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 255, 100), 1)

    return display
