"""
Crossing-line tracker for entry/exit detection.

Tracks faces across frames and detects when they cross a line drawn across
the doorway. The line can be at any angle (defined by two points), not just
horizontal. Uses the cross product to determine which side of the line a
point is on.

Supports two modes:
  - Auto-detected doorway line (from door_detector.py)
  - Manually placed line (admin draws on camera feed)
"""

import time
import uuid
from dataclasses import dataclass
from typing import Optional

import face_recognition
import numpy as np


@dataclass
class TrackState:
    """State for a tracked face crossing the camera view."""
    track_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    first_side: int = 0          # +1 or -1 (which side of the line)
    last_centroid: tuple = (0.0, 0.0)  # normalized (x, y)
    last_seen: float = 0.0       # time.monotonic()
    crossed: bool = False
    encoding: Optional[np.ndarray] = None
    confidence: Optional[float] = None


@dataclass
class CrossingEvent:
    """Emitted when a tracked face crosses the line."""
    track_id: str
    user_id: Optional[str]
    user_name: Optional[str]
    direction: str  # "entry" or "exit"
    confidence: Optional[float]


def _side_of_line(point, line_p1, line_p2) -> int:
    """Determine which side of a line a point is on.
    Returns +1 or -1. Uses the cross product of the line vector and point vector.
    """
    dx = line_p2[0] - line_p1[0]
    dy = line_p2[1] - line_p1[1]
    px = point[0] - line_p1[0]
    py = point[1] - line_p1[1]
    cross = dx * py - dy * px
    return 1 if cross >= 0 else -1


def _point_distance(p1, p2) -> float:
    """Euclidean distance between two 2D points."""
    return ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) ** 0.5


class CrossingLineTracker:
    """Tracks faces and detects crossing events across a two-point line."""

    def __init__(
        self,
        line_p1: tuple = (0.0, 0.5),    # (x, y) normalized 0-1
        line_p2: tuple = (1.0, 0.5),    # (x, y) normalized 0-1
        entry_side: int = -1,            # which side is "outside" — person comes FROM this side to enter
        match_fn=None,                   # (encoding) -> (user_id, confidence) or None
        spatial_threshold: float = 0.12,
        track_timeout: float = 5.0,
    ):
        self.line_p1 = line_p1
        self.line_p2 = line_p2
        self.entry_side = entry_side  # the "outside" side — crossing FROM here = entry
        self.match_fn = match_fn
        self.spatial_threshold = spatial_threshold
        self.track_timeout = track_timeout
        self.tracks: dict[str, TrackState] = {}

    @classmethod
    def from_config(cls, crossing_line_y=0.5, entry_direction="top_to_bottom", **kwargs):
        """Create from the old horizontal-line config for backwards compatibility."""
        line_p1 = (0.0, crossing_line_y)
        line_p2 = (1.0, crossing_line_y)
        # For top_to_bottom entry: "above" the line is outside (side depends on line orientation)
        # With a horizontal line, "above" = negative cross product side
        entry_side = -1 if entry_direction == "top_to_bottom" else 1
        return cls(line_p1=line_p1, line_p2=line_p2, entry_side=entry_side, **kwargs)

    def set_line(self, p1: tuple, p2: tuple, entry_side: int = -1):
        """Update the crossing line position."""
        self.line_p1 = p1
        self.line_p2 = p2
        self.entry_side = entry_side

    def process_frame(self, frame: np.ndarray) -> list[CrossingEvent]:
        """Process a single frame. Returns any crossing events detected."""
        now = time.monotonic()
        events = []
        h, w = frame.shape[:2]

        # Detect faces (HOG for speed)
        face_locations = face_recognition.face_locations(frame, model="hog")

        matched_track_ids = set()

        for face_loc in face_locations:
            top, right, bottom, left = face_loc
            cx = ((left + right) / 2.0) / w   # normalized x
            cy = ((top + bottom) / 2.0) / h   # normalized y
            centroid = (cx, cy)

            # Try spatial match to existing track
            matched_track = self._find_nearest_track(centroid, now)
            if matched_track and matched_track.track_id not in matched_track_ids:
                matched_track_ids.add(matched_track.track_id)
                matched_track.last_centroid = centroid
                matched_track.last_seen = now

                event = self._check_crossing(matched_track)
                if event:
                    events.append(event)
                continue

            # New face — identify
            encodings = face_recognition.face_encodings(frame, [face_loc], num_jitters=1)
            if not encodings:
                continue

            encoding = encodings[0]
            user_id = None
            user_name = None
            confidence = None

            if self.match_fn:
                result = self.match_fn(encoding)
                if result:
                    user_id, confidence = result
                    existing = self._find_track_by_user(user_id)
                    if existing and existing.track_id not in matched_track_ids:
                        matched_track_ids.add(existing.track_id)
                        existing.last_centroid = centroid
                        existing.last_seen = now
                        event = self._check_crossing(existing)
                        if event:
                            events.append(event)
                        continue

            # Create new track
            side = _side_of_line(centroid, self.line_p1, self.line_p2)
            track = TrackState(
                track_id=f"trk_{uuid.uuid4().hex[:6]}",
                user_id=user_id,
                user_name=user_name,
                first_side=side,
                last_centroid=centroid,
                last_seen=now,
                encoding=encoding,
                confidence=confidence,
            )
            self.tracks[track.track_id] = track

        # Expire old tracks
        expired = [tid for tid, t in self.tracks.items()
                   if now - t.last_seen > self.track_timeout]
        for tid in expired:
            del self.tracks[tid]

        return events

    def _find_nearest_track(self, centroid: tuple, now: float) -> Optional[TrackState]:
        best = None
        best_dist = float("inf")
        for track in self.tracks.values():
            if now - track.last_seen > self.track_timeout:
                continue
            dist = _point_distance(track.last_centroid, centroid)
            if dist < self.spatial_threshold and dist < best_dist:
                best = track
                best_dist = dist
        return best

    def _find_track_by_user(self, user_id: str) -> Optional[TrackState]:
        for track in self.tracks.values():
            if track.user_id == user_id and not track.crossed:
                return track
        return None

    def _check_crossing(self, track: TrackState) -> Optional[CrossingEvent]:
        if track.crossed:
            return None

        current_side = _side_of_line(track.last_centroid, self.line_p1, self.line_p2)

        if current_side == track.first_side:
            return None

        track.crossed = True

        # Determine direction: if they came from the entry_side, it's an entry
        if track.first_side == self.entry_side:
            direction = "entry"
        else:
            direction = "exit"

        return CrossingEvent(
            track_id=track.track_id,
            user_id=track.user_id,
            user_name=track.user_name,
            direction=direction,
            confidence=track.confidence,
        )
