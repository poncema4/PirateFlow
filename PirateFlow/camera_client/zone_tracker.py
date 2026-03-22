"""
Polygon zone tracker for doorway entry/exit detection.

Instead of a crossing line, this tracks people through a doorway ZONE
(polygon region). A state machine per tracked person determines entry/exit
based on which side of the zone they exit to.

States per track:
  UNKNOWN  → initial state, resolves on first polygon check
  OUTSIDE  → person is on the corridor/outside side
  IN_ZONE  → person's centroid is inside the doorway polygon
  INSIDE   → person is on the room/interior side

Transitions that emit events:
  OUTSIDE → IN_ZONE → exits to room side    = ENTRY
  INSIDE  → IN_ZONE → exits to corridor side = EXIT
"""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import cv2
import numpy as np


class TrackZoneState(Enum):
    UNKNOWN = "unknown"
    OUTSIDE = "outside"
    IN_ZONE = "in_zone"
    INSIDE = "inside"


@dataclass
class TrackedPerson:
    """Detection from YOLO + ByteTrack."""
    track_id: int
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2 in pixels
    centroid: tuple[float, float]     # normalized (x, y) 0-1
    confidence: float
    bbox_area_norm: float = 0.0      # normalized bbox area (0-1 of frame)


@dataclass
class PersonState:
    """Internal state machine for a tracked person."""
    track_id: int
    state: TrackZoneState = TrackZoneState.UNKNOWN
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    entered_zone_from: Optional[str] = None  # "outside" or "inside"
    last_centroid: tuple[float, float] = (0.0, 0.0)
    smoothed_centroid: tuple[float, float] = (0.0, 0.0)  # EMA smoothed position
    last_seen: float = 0.0
    frames_seen: int = 0
    frames_in_zone: int = 0
    zone_entry_time: float = 0.0
    bbox_area: float = 0.0  # for filtering tiny detections


@dataclass
class CrossingEvent:
    """Emitted when a person enters or exits the room."""
    track_id: int
    direction: str  # "entry" or "exit"
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    confidence: Optional[float] = None


@dataclass
class RosterEntry:
    """A person currently in the room."""
    track_id: int
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    entered_at: float = 0.0
    last_seen: float = 0.0


class DoorwayZoneTracker:
    """Tracks people through a doorway polygon zone."""

    def __init__(
        self,
        polygon: list[tuple[float, float]],
        room_direction: tuple[float, float],
        track_timeout: float = 8.0,
        roster_stale_timeout: float = 300.0,
        min_frames_to_emit: int = 3,
        min_zone_time: float = 0.3,
        min_bbox_area: float = 0.005,         # ignore detections smaller than 0.5% of frame
        smoothing_alpha: float = 0.4,         # EMA smoothing factor (0=max smooth, 1=no smooth)
    ):
        # Convert polygon to numpy array for cv2.pointPolygonTest
        # Store as pixel coords will be set per-frame
        self.polygon_norm = polygon
        self.room_direction = np.array(room_direction, dtype=np.float32)
        self.track_timeout = track_timeout
        self.roster_stale_timeout = roster_stale_timeout
        self.min_frames_to_emit = min_frames_to_emit
        self.min_zone_time = min_zone_time
        self.min_bbox_area = min_bbox_area
        self.smoothing_alpha = smoothing_alpha

        self._states: dict[int, PersonState] = {}
        self._roster: dict[int, RosterEntry] = {}

        # Precompute polygon center for side determination
        self._poly_center = np.array([
            sum(p[0] for p in polygon) / len(polygon),
            sum(p[1] for p in polygon) / len(polygon),
        ], dtype=np.float32)

    def update(self, detections: list[TrackedPerson]) -> list[CrossingEvent]:
        """Process a frame's worth of detections. Returns crossing events."""
        now = time.monotonic()
        events = []

        # Build polygon in a format cv2 can use (scaled to 10000 for precision)
        scale = 10000
        poly_pts = np.array(
            [[int(p[0] * scale), int(p[1] * scale)] for p in self.polygon_norm],
            dtype=np.int32,
        )

        seen_track_ids = set()

        for det in detections:
            # Filter out tiny detections (people far in background)
            if det.bbox_area_norm > 0 and det.bbox_area_norm < self.min_bbox_area:
                continue

            seen_track_ids.add(det.track_id)
            cx, cy = det.centroid

            # Apply EMA smoothing to centroid (reduces jitter)
            if det.track_id in self._states:
                prev = self._states[det.track_id].smoothed_centroid
                a = self.smoothing_alpha
                cx = a * cx + (1 - a) * prev[0]
                cy = a * cy + (1 - a) * prev[1]

            # Point-in-polygon test
            test_point = (int(cx * scale), int(cy * scale))
            in_polygon = cv2.pointPolygonTest(poly_pts, test_point, False) >= 0

            # Get or create state
            if det.track_id not in self._states:
                # Check if this is a re-ID of someone already tracked
                # (ByteTrack assigns new ID after brief occlusion)
                merged = self._try_merge_track(det.track_id, (cx, cy), now)
                if merged:
                    continue

                self._states[det.track_id] = PersonState(
                    track_id=det.track_id,
                    last_seen=now,
                )

            state = self._states[det.track_id]
            state.last_centroid = det.centroid
            state.smoothed_centroid = (cx, cy)
            state.last_seen = now
            state.frames_seen += 1
            state.bbox_area = det.bbox_area_norm

            # Track zone time
            if in_polygon:
                state.frames_in_zone += 1
                if state.frames_in_zone == 1:
                    state.zone_entry_time = now
            else:
                state.frames_in_zone = 0

            # Resolve UNKNOWN state
            if state.state == TrackZoneState.UNKNOWN:
                if in_polygon:
                    state.state = TrackZoneState.IN_ZONE
                else:
                    side = self._which_side(det.centroid)
                    if side == "room":
                        state.state = TrackZoneState.INSIDE
                        # Person detected already inside — add to roster
                        self._roster[det.track_id] = RosterEntry(
                            track_id=det.track_id,
                            user_id=state.user_id,
                            user_name=state.user_name,
                            entered_at=now,
                            last_seen=now,
                        )
                    else:
                        state.state = TrackZoneState.OUTSIDE
                continue

            # State transitions
            if state.state == TrackZoneState.OUTSIDE:
                if in_polygon:
                    state.state = TrackZoneState.IN_ZONE
                    state.entered_zone_from = "outside"

            elif state.state == TrackZoneState.INSIDE:
                if in_polygon:
                    state.state = TrackZoneState.IN_ZONE
                    state.entered_zone_from = "inside"

            elif state.state == TrackZoneState.IN_ZONE:
                if not in_polygon:
                    # Exited the zone — determine which side
                    exit_side = self._which_side(det.centroid)

                    # Robustness: require minimum frames and time in zone
                    time_in_zone = now - state.zone_entry_time
                    is_reliable = (state.frames_seen >= self.min_frames_to_emit
                                   and time_in_zone >= self.min_zone_time)

                    if not is_reliable:
                        # Not enough evidence — just update state without emitting event
                        state.state = (TrackZoneState.INSIDE
                                       if exit_side == "room"
                                       else TrackZoneState.OUTSIDE)
                        continue

                    if state.entered_zone_from == "outside" and exit_side == "room":
                        # Came from outside, exited to room → ENTRY
                        state.state = TrackZoneState.INSIDE
                        event = CrossingEvent(
                            track_id=det.track_id,
                            direction="entry",
                            user_id=state.user_id,
                            user_name=state.user_name,
                            confidence=det.confidence,
                        )
                        events.append(event)
                        self._roster[det.track_id] = RosterEntry(
                            track_id=det.track_id,
                            user_id=state.user_id,
                            user_name=state.user_name,
                            entered_at=now,
                            last_seen=now,
                        )

                    elif state.entered_zone_from == "inside" and exit_side == "corridor":
                        # Came from room, exited to corridor → EXIT
                        state.state = TrackZoneState.OUTSIDE
                        event = CrossingEvent(
                            track_id=det.track_id,
                            direction="exit",
                            user_id=state.user_id,
                            user_name=state.user_name,
                            confidence=det.confidence,
                        )
                        events.append(event)
                        self._roster.pop(det.track_id, None)

                    elif state.entered_zone_from == "outside" and exit_side == "corridor":
                        # Backed out — no event
                        state.state = TrackZoneState.OUTSIDE

                    elif state.entered_zone_from == "inside" and exit_side == "room":
                        # Backed into room — no event
                        state.state = TrackZoneState.INSIDE

                    else:
                        # Ambiguous — reset based on current side
                        state.state = (TrackZoneState.INSIDE
                                       if exit_side == "room"
                                       else TrackZoneState.OUTSIDE)

        # Update roster last_seen for inside tracks
        for tid in seen_track_ids:
            if tid in self._roster:
                self._roster[tid].last_seen = now

        # Expire old tracks
        expired = [tid for tid, s in self._states.items()
                   if now - s.last_seen > self.track_timeout
                   and tid not in seen_track_ids]
        for tid in expired:
            del self._states[tid]

        # Expire stale roster entries
        stale = [tid for tid, r in self._roster.items()
                 if now - r.last_seen > self.roster_stale_timeout]
        for tid in stale:
            del self._roster[tid]

        return events

    def assign_identity(self, track_id: int, user_id: str, user_name: str = ""):
        """Assign a face-recognition identity to a tracked person."""
        if track_id in self._states:
            self._states[track_id].user_id = user_id
            self._states[track_id].user_name = user_name
        if track_id in self._roster:
            self._roster[track_id].user_id = user_id
            self._roster[track_id].user_name = user_name

    def get_roster(self) -> list[RosterEntry]:
        """Get list of people currently in the room."""
        return list(self._roster.values())

    def get_occupancy(self) -> int:
        """Get current headcount."""
        return len(self._roster)

    def get_track_state(self, track_id: int) -> Optional[PersonState]:
        """Get the current state of a tracked person."""
        return self._states.get(track_id)

    def _try_merge_track(self, new_track_id: int, centroid: tuple, now: float) -> bool:
        """Check if a new track ID is actually a re-ID of an existing person.
        If a recently-seen track is very close to this position, merge them.
        Returns True if merged (caller should skip creating new state).
        """
        merge_distance = 0.08  # normalized distance threshold
        merge_time = 3.0  # only merge with tracks seen within this many seconds

        best_match = None
        best_dist = float("inf")

        for tid, state in self._states.items():
            if tid == new_track_id:
                continue
            time_gap = now - state.last_seen
            if time_gap > merge_time:
                continue

            dist = ((state.smoothed_centroid[0] - centroid[0]) ** 2 +
                    (state.smoothed_centroid[1] - centroid[1]) ** 2) ** 0.5
            if dist < merge_distance and dist < best_dist:
                best_dist = dist
                best_match = tid

        if best_match is not None:
            old_state = self._states[best_match]
            # Create new state inheriting the old one's info
            self._states[new_track_id] = PersonState(
                track_id=new_track_id,
                state=old_state.state,
                user_id=old_state.user_id,
                user_name=old_state.user_name,
                entered_zone_from=old_state.entered_zone_from,
                last_centroid=centroid,
                smoothed_centroid=centroid,
                last_seen=now,
                frames_seen=old_state.frames_seen,
                frames_in_zone=old_state.frames_in_zone,
                zone_entry_time=old_state.zone_entry_time,
                bbox_area=old_state.bbox_area,
            )
            # Update roster if person was inside
            if best_match in self._roster:
                old_entry = self._roster.pop(best_match)
                self._roster[new_track_id] = RosterEntry(
                    track_id=new_track_id,
                    user_id=old_entry.user_id,
                    user_name=old_entry.user_name,
                    entered_at=old_entry.entered_at,
                    last_seen=now,
                )
            # Transfer identity in the identifier cache
            del self._states[best_match]
            return True

        return False

    def _which_side(self, point: tuple[float, float]) -> str:
        """Determine if a point is on the 'room' or 'corridor' side of the zone.
        Uses dot product of (point - polygon_center) with room_direction.
        """
        p = np.array(point, dtype=np.float32)
        offset = p - self._poly_center
        dot = float(np.dot(offset, self.room_direction))
        return "room" if dot > 0 else "corridor"
