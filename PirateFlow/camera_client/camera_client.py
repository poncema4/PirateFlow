#!/usr/bin/env python3
"""
PirateFlow Camera Client — Doorway Entry/Exit Detection

Uses:
  - Claude Vision API to detect the doorway in the camera frame
  - YOLOv8 for person detection + ByteTrack for persistent tracking
  - Polygon zone state machine for entry/exit determination
  - Face recognition on person crops for identity resolution

The camera processing runs locally. Only events are sent to the server.

Usage:
  python camera_client.py --room-id rm_001 --camera-id cam_001 --source webcam
  python camera_client.py --room-id rm_001 --camera-id cam_001 \\
    --source "rtsp://admin:Password1@192.168.0.28:554/h264Preview_01_sub" \\
    --api-url https://pirateflow.net --show-feed
"""

import argparse
import base64
import os
import sys
import time

import cv2
import numpy as np

from doorway_detector import detect_doorway, check_camera_stability
from zone_tracker import DoorwayZoneTracker, TrackedPerson, CrossingEvent
from person_identifier import PersonIdentifier

try:
    import requests
except ImportError:
    requests = None


def parse_args():
    p = argparse.ArgumentParser(description="PirateFlow Camera Client")
    p.add_argument("--api-url", default="http://localhost:8000")
    p.add_argument("--room-id", required=True)
    p.add_argument("--camera-id", required=True)
    p.add_argument("--camera-key", default="dev-camera-key")
    p.add_argument("--source", default="webcam", help="'webcam' or RTSP URL")
    p.add_argument("--fps", type=float, default=5.0, help="Processing FPS")
    p.add_argument("--show-feed", action="store_true")
    p.add_argument("--faces-dir", default=None)
    p.add_argument("--anthropic-key", default=None, help="Anthropic API key for doorway detection")
    p.add_argument("--send-frames", action="store_true", help="Send annotated frames to server")
    p.add_argument("--yolo-size", default="n", choices=["n", "s", "m"],
                   help="YOLO model size: n=nano(fast), s=small, m=medium(accurate)")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Video source
# ---------------------------------------------------------------------------

def open_source(source: str) -> cv2.VideoCapture:
    if source == "webcam":
        cap = cv2.VideoCapture(0)
    else:
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if not cap.isOpened():
        print(f"ERROR: Cannot open {source}")
        sys.exit(1)
    print(f"Opened: {source}")
    return cap


def flush_and_read(cap, is_rtsp):
    if is_rtsp:
        for _ in range(3):
            cap.grab()
    return cap.read()


# ---------------------------------------------------------------------------
# API communication
# ---------------------------------------------------------------------------

def send_event(api_url, camera_key, camera_id, room_id,
               user_id, user_name, direction, confidence, frame_b64=None):
    if not requests:
        return None
    payload = {
        "camera_id": camera_id, "room_id": room_id,
        "user_id": user_id, "user_name": user_name,
        "direction": direction, "confidence": confidence,
    }
    if frame_b64:
        payload["frame_jpeg_b64"] = frame_b64
    try:
        r = requests.post(
            f"{api_url}/api/cameras/events",
            json=payload,
            headers={"X-Camera-Key": camera_key},
            timeout=5,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  API error: {e}")
        return None


# ---------------------------------------------------------------------------
# Overlay drawing
# ---------------------------------------------------------------------------

def draw_overlay(frame, doorway_polygon, room_direction, zone_tracker,
                 detections, identifier, event_log):
    display = frame.copy()
    h, w = frame.shape[:2]

    # Draw doorway polygon zone (semi-transparent fill)
    if doorway_polygon:
        pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in doorway_polygon], np.int32)
        overlay = display.copy()
        cv2.fillPoly(overlay, [pts], (0, 255, 255, 40))
        cv2.addWeighted(overlay, 0.15, display, 0.85, 0, display)
        cv2.polylines(display, [pts], True, (0, 255, 255), 2)

        # Draw "DOORWAY" label
        cx = int(sum(p[0] for p in doorway_polygon) / len(doorway_polygon) * w)
        cy = int(sum(p[1] for p in doorway_polygon) / len(doorway_polygon) * h)
        cv2.putText(display, "DOORWAY", (cx - 35, cy - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

        # Draw room direction arrow
        rd = room_direction
        ax = cx + int(rd[0] * 40)
        ay = cy + int(rd[1] * 40)
        cv2.arrowedLine(display, (cx, cy + 10), (ax, ay + 10), (0, 200, 0), 2, tipLength=0.4)
        cv2.putText(display, "ROOM", (ax - 20, ay + 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)

    # Draw tracked people
    for det in detections:
        x1, y1, x2, y2 = det.bbox
        track_id = det.track_id

        # Color based on state
        state = zone_tracker.get_track_state(track_id)
        identity = identifier.get_identity(track_id)

        if state:
            state_name = state.state.value
            if state_name == "inside":
                color = (0, 255, 0)    # green — in room
            elif state_name == "in_zone":
                color = (0, 255, 255)  # yellow — in doorway
            elif state_name == "outside":
                color = (255, 165, 0)  # orange — outside
            else:
                color = (200, 200, 200)
        else:
            color = (200, 200, 200)
            state_name = "?"

        # Bounding box
        cv2.rectangle(display, (x1, y1), (x2, y2), color, 2)

        # Name + state label
        if identity:
            uid, name = identity
            label = f"{name} [{state_name}]"
        else:
            label = f"#{track_id} [{state_name}]"

        cv2.putText(display, label, (x1, y1 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

    # Room roster (top-right corner)
    roster = zone_tracker.get_roster()
    cv2.putText(display, f"IN ROOM: {len(roster)}", (w - 180, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    for i, entry in enumerate(roster[:8]):
        name = entry.user_name or entry.user_id or f"#{entry.track_id}"
        cv2.putText(display, f"  {name}", (w - 180, 50 + i * 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)

    # Event log (bottom)
    y_off = h - 15
    for direction, msg in reversed(event_log[-5:]):
        color = (0, 255, 0) if direction == "entry" else (0, 165, 255)
        cv2.putText(display, msg, (10, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        y_off -= 20

    return display


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    print("=" * 60)
    print("  PirateFlow Camera Client — Doorway Detection")
    print("=" * 60)
    print(f"  API:       {args.api_url}")
    print(f"  Camera:    {args.camera_id}")
    print(f"  Room:      {args.room_id}")
    print(f"  Source:    {args.source}")
    print(f"  YOLO:      yolov8{args.yolo_size}.pt")
    print()

    # --- Load YOLO model ---
    print("Loading YOLOv8 model...")
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    model = YOLO(f"yolov8{args.yolo_size}.pt")
    print(f"  Model loaded: yolov8{args.yolo_size}.pt")

    # --- Load face registry ---
    identifier = PersonIdentifier()
    faces_dir = args.faces_dir
    if not faces_dir:
        # Default location
        default = os.path.join(os.path.dirname(__file__), "..", "backend", "faces")
        if os.path.isdir(default):
            faces_dir = default

    if faces_dir:
        print(f"Loading faces from {faces_dir}...")
        count = identifier.load_faces_from_dir(faces_dir)
        print(f"  {count} faces loaded")
    else:
        print("  No faces directory — identification disabled")

    # --- Open video ---
    cap = open_source(args.source)
    is_rtsp = args.source != "webcam"

    # Flush initial frames (let auto-exposure settle)
    print("Warming up camera...")
    for _ in range(10):
        cap.grab()
    ret, init_frame = cap.read()
    if not ret:
        print("ERROR: Cannot read initial frame")
        sys.exit(1)

    # --- Detect doorway ---
    print("\nDetecting doorway...")
    api_key = args.anthropic_key or os.getenv("ANTHROPIC_API_KEY")
    doorway = detect_doorway(init_frame, api_key=api_key)

    if doorway.detected:
        print(f"  Doorway found! ({doorway.confidence:.0%} confidence)")
        print(f"  Polygon: {len(doorway.polygon)} vertices")
    else:
        print("  Using default zone — no doorway detected")

    # --- Initialize zone tracker ---
    zone_tracker = DoorwayZoneTracker(
        polygon=doorway.polygon,
        room_direction=doorway.room_direction,
    )

    # --- Main loop ---
    frame_interval = 1.0 / args.fps
    last_process = 0
    frame_count = 0
    event_log = []
    last_stability_check = time.time()
    reconnect_attempts = 0

    print(f"\nTracking at {args.fps} FPS. Press Ctrl+C to stop.\n")

    try:
        while True:
            ret, frame = flush_and_read(cap, is_rtsp)
            if not ret:
                reconnect_attempts += 1
                if is_rtsp and reconnect_attempts <= 10:
                    wait = min(reconnect_attempts * 2, 10)
                    print(f"Lost stream, reconnecting in {wait}s...")
                    time.sleep(wait)
                    cap.release()
                    cap = open_source(args.source)
                    continue
                time.sleep(1)
                continue
            reconnect_attempts = 0

            now = time.time()
            if now - last_process < frame_interval:
                # Still show feed between processing
                if args.show_feed:
                    cv2.imshow("PirateFlow", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                continue

            last_process = now
            frame_count += 1
            h, w = frame.shape[:2]

            # --- YOLO detect + track ---
            results = model.track(frame, persist=True, classes=[0],
                                  verbose=False, conf=0.4)

            detections = []
            if results and results[0].boxes is not None and results[0].boxes.id is not None:
                boxes = results[0].boxes
                for i in range(len(boxes)):
                    x1, y1, x2, y2 = map(int, boxes.xyxy[i].tolist())
                    track_id = int(boxes.id[i].item())
                    conf = float(boxes.conf[i].item())

                    # Centroid at bottom-center of bbox (feet position)
                    cx = ((x1 + x2) / 2.0) / w
                    cy = y2 / h  # bottom of bbox

                    detections.append(TrackedPerson(
                        track_id=track_id,
                        bbox=(x1, y1, x2, y2),
                        centroid=(cx, cy),
                        confidence=conf,
                    ))

            # --- Zone tracker update ---
            events = zone_tracker.update(detections)

            # --- Face identification (every 5th frame, unidentified tracks) ---
            if frame_count % 5 == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                for det in detections:
                    if identifier.get_identity(det.track_id):
                        continue
                    result = identifier.try_identify(rgb, det.track_id, det.bbox)
                    if result:
                        uid, name, conf = result
                        zone_tracker.assign_identity(det.track_id, uid, name)
                        print(f"  Identified #{det.track_id} as {name} ({conf:.0%})")

            # --- Handle crossing events ---
            for evt in events:
                ts = time.strftime("%H:%M:%S")
                name = evt.user_name or (f"#{evt.track_id}")
                icon = ">>>" if evt.direction == "entry" else "<<<"
                msg = f"[{ts}] {icon} {evt.direction.upper()}: {name}"
                print(msg)
                event_log.append((evt.direction, msg))
                if len(event_log) > 20:
                    event_log.pop(0)

                # Send to server
                frame_b64 = None
                if args.send_frames:
                    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    frame_b64 = base64.b64encode(buf).decode()

                result = send_event(
                    args.api_url, args.camera_key, args.camera_id, args.room_id,
                    evt.user_id, evt.user_name, evt.direction, evt.confidence,
                    frame_b64,
                )
                if result:
                    auth = "OK" if result.get("authorized") else "UNAUTHORIZED"
                    print(f"  Server: {auth} | Room occupancy: {result.get('occupancy', '?')}")

            # --- Camera stability check (every 60s) ---
            if now - last_stability_check > 60 and doorway.reference_frame is not None:
                last_stability_check = now
                sim = check_camera_stability(frame, doorway.reference_frame)
                if sim < 0.7:
                    print(f"\n  Camera may have moved (similarity: {sim:.2f}). Re-detecting doorway...")
                    doorway = detect_doorway(frame, api_key=api_key)
                    zone_tracker = DoorwayZoneTracker(
                        polygon=doorway.polygon,
                        room_direction=doorway.room_direction,
                    )

            # --- Display ---
            if args.show_feed:
                display = draw_overlay(
                    frame, doorway.polygon, doorway.room_direction,
                    zone_tracker, detections, identifier, event_log,
                )
                # Show FPS
                cv2.putText(display, f"FPS: {args.fps:.0f} | Detections: {len(detections)}",
                            (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                cv2.imshow("PirateFlow", display)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        cap.release()
        if args.show_feed:
            cv2.destroyAllWindows()

        # Print final roster
        roster = zone_tracker.get_roster()
        if roster:
            print(f"\nFinal room roster ({len(roster)} people):")
            for r in roster:
                name = r.user_name or r.user_id or f"#{r.track_id}"
                print(f"  - {name}")


if __name__ == "__main__":
    main()
