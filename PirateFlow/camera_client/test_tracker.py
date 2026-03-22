#!/usr/bin/env python3
"""
Test the doorway zone tracker with auto-detection.

1. Opens camera, captures a frame
2. Sends it to Claude Vision to detect the doorway
3. Shows the detected doorway polygon — you can click to adjust vertices
4. Press SPACE to start tracking people through the zone
5. Press 'q' to quit

Usage:
  python test_tracker.py                        # webcam
  python test_tracker.py --source "rtsp://..."  # RTSP camera
  python test_tracker.py --faces-dir ../backend/faces  # with face ID

Controls:
  SPACE     Start/stop tracking
  d         Re-detect doorway (calls Claude Vision again)
  r         Reset to default zone
  c         Clear polygon vertices, enter manual draw mode
  Click     In manual mode: add polygon vertex (min 3 to close)
  q         Quit
"""

import argparse
import os
import sys
import time

import cv2
import numpy as np

from doorway_detector import detect_doorway, check_camera_stability
from zone_tracker import DoorwayZoneTracker, TrackedPerson
from person_identifier import PersonIdentifier


def parse_args():
    p = argparse.ArgumentParser(description="PirateFlow Tracker Test")
    p.add_argument("--source", default="0")
    p.add_argument("--faces-dir", default=None)
    p.add_argument("--anthropic-key", default=None)
    p.add_argument("--yolo-size", default="n", choices=["n", "s", "m"])
    return p.parse_args()


# Manual polygon drawing state
manual_vertices = []
manual_mode = False


def mouse_callback(event, x, y, flags, param):
    global manual_vertices, manual_mode
    if not manual_mode:
        return
    h, w = param["shape"]
    if event == cv2.EVENT_LBUTTONDOWN:
        manual_vertices.append((x / w, y / h))
        print(f"  Vertex {len(manual_vertices)}: ({x/w:.2f}, {y/h:.2f})")
        if len(manual_vertices) >= 3:
            print("  Polygon ready. Press SPACE to start tracking, or click more vertices.")


def main():
    global manual_vertices, manual_mode
    args = parse_args()

    # Load YOLO
    print("Loading YOLOv8...")
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: pip install ultralytics")
        sys.exit(1)
    model = YOLO(f"yolov8{args.yolo_size}.pt")

    # Load faces
    identifier = PersonIdentifier()
    faces_dir = args.faces_dir
    if not faces_dir:
        default = os.path.join(os.path.dirname(__file__), "..", "backend", "faces")
        if os.path.isdir(default):
            faces_dir = default
    if faces_dir:
        print(f"Loading faces from {faces_dir}...")
        identifier.load_faces_from_dir(faces_dir)

    # Open video
    if args.source == "webcam":
        source = 0
    elif args.source.isdigit():
        source = int(args.source)
    else:
        source = args.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Cannot open: {source}")
        sys.exit(1)

    # Warm up
    for _ in range(10):
        cap.grab()
    ret, init_frame = cap.read()
    if not ret:
        print("Cannot read frame")
        sys.exit(1)
    h, w = init_frame.shape[:2]

    # Detect doorway
    print("\nDetecting doorway with Claude Vision...")
    api_key = args.anthropic_key or os.getenv("ANTHROPIC_API_KEY")
    doorway = detect_doorway(init_frame, api_key=api_key)

    if doorway.detected:
        print(f"  Doorway found ({doorway.confidence:.0%})")
    else:
        print("  No doorway detected — using default zone")

    # Setup window
    window = "PirateFlow Tracker Test"
    cv2.namedWindow(window)
    cv2.setMouseCallback(window, mouse_callback, {"shape": (h, w)})

    tracking = False
    zone_tracker = None
    event_log = []
    frame_count = 0

    print("\n=== SETUP MODE ===")
    print("  SPACE = start tracking")
    print("  d     = re-detect doorway (Claude Vision)")
    print("  c     = manual draw (click 4+ polygon vertices)")
    print("  f     = flip room direction (swap inside/outside)")
    print("  r     = reset to default zone")
    print("  q     = quit")
    print(f"\n  Room direction: {doorway.room_direction}")
    print(f"  (The green arrow shows which side is the ROOM)")
    print(f"  If camera is OUTSIDE the room looking at the door,")
    print(f"  the arrow should point AWAY from the camera (into the door).")
    print(f"  Press 'f' to flip if it's wrong.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue

        display = frame.copy()
        h, w = frame.shape[:2]

        if tracking and zone_tracker:
            # ── TRACKING MODE ──
            frame_count += 1

            results = model.track(frame, persist=True, classes=[0], verbose=False, conf=0.4)
            detections = []
            if results and results[0].boxes is not None and results[0].boxes.id is not None:
                boxes = results[0].boxes
                for i in range(len(boxes)):
                    x1, y1, x2, y2 = map(int, boxes.xyxy[i].tolist())
                    tid = int(boxes.id[i].item())
                    conf = float(boxes.conf[i].item())
                    cx = ((x1 + x2) / 2.0) / w
                    cy = y2 / h
                    detections.append(TrackedPerson(tid, (x1, y1, x2, y2), (cx, cy), conf))

            events = zone_tracker.update(detections)

            # Face ID every 5th frame
            if frame_count % 5 == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                for det in detections:
                    if not identifier.get_identity(det.track_id):
                        r = identifier.try_identify(rgb, det.track_id, det.bbox)
                        if r:
                            zone_tracker.assign_identity(det.track_id, r[0], r[1])

            for evt in events:
                ts = time.strftime("%H:%M:%S")
                name = evt.user_name or f"#{evt.track_id}"
                icon = ">>>" if evt.direction == "entry" else "<<<"
                msg = f"[{ts}] {icon} {evt.direction.upper()}: {name}"
                print(msg)
                event_log.append((evt.direction, msg))

            # Draw doorway polygon
            poly = doorway.polygon
            pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in poly], np.int32)
            overlay = display.copy()
            cv2.fillPoly(overlay, [pts], (0, 255, 255))
            cv2.addWeighted(overlay, 0.12, display, 0.88, 0, display)
            cv2.polylines(display, [pts], True, (0, 255, 255), 2)

            # Draw people
            for det in detections:
                x1, y1, x2, y2 = det.bbox
                state = zone_tracker.get_track_state(det.track_id)
                ident = identifier.get_identity(det.track_id)
                sn = state.state.value if state else "?"
                colors = {"inside": (0, 255, 0), "in_zone": (0, 255, 255),
                          "outside": (255, 165, 0), "unknown": (200, 200, 200)}
                c = colors.get(sn, (200, 200, 200))
                cv2.rectangle(display, (x1, y1), (x2, y2), c, 2)
                label = f"{ident[1] if ident else f'#{det.track_id}'} [{sn}]"
                cv2.putText(display, label, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, c, 1)

            # Roster
            roster = zone_tracker.get_roster()
            cv2.putText(display, f"IN ROOM: {len(roster)}", (w - 160, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            for i, r in enumerate(roster[:6]):
                n = r.user_name or f"#{r.track_id}"
                cv2.putText(display, f"  {n}", (w - 160, 55 + i * 18),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)

            # Events
            y_off = h - 15
            for d, msg in reversed(event_log[-5:]):
                clr = (0, 255, 0) if d == "entry" else (0, 165, 255)
                cv2.putText(display, msg, (10, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.4, clr, 1)
                y_off -= 20

            cv2.putText(display, "TRACKING (SPACE to pause)", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)

        else:
            # ── SETUP MODE ──
            # Draw current polygon
            poly = manual_vertices if manual_mode else doorway.polygon
            if poly and len(poly) >= 3:
                pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in poly], np.int32)
                overlay = display.copy()
                cv2.fillPoly(overlay, [pts], (0, 255, 255))
                cv2.addWeighted(overlay, 0.15, display, 0.85, 0, display)
                cv2.polylines(display, [pts], True, (0, 255, 255), 2)
                for p in poly:
                    cv2.circle(display, (int(p[0] * w), int(p[1] * h)), 6, (0, 200, 255), -1)

            # Draw partial vertices in manual mode
            if manual_mode and len(manual_vertices) < 3:
                for p in manual_vertices:
                    cv2.circle(display, (int(p[0] * w), int(p[1] * h)), 6, (255, 0, 255), -1)

            # Room direction arrow
            if poly and len(poly) >= 3:
                rd = doorway.room_direction
                cx = int(sum(p[0] for p in poly) / len(poly) * w)
                cy = int(sum(p[1] for p in poly) / len(poly) * h)
                cv2.arrowedLine(display, (cx, cy), (cx + int(rd[0] * 50), cy + int(rd[1] * 50)),
                                (0, 200, 0), 2, tipLength=0.3)
                cv2.putText(display, "ROOM", (cx + int(rd[0] * 55) - 20, cy + int(rd[1] * 55)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)

            mode_text = "MANUAL DRAW (click vertices)" if manual_mode else "SETUP (SPACE=start, f=flip, d=detect, c=draw)"
            conf_text = f" | Confidence: {doorway.confidence:.0%}" if doorway.detected else ""
            cv2.putText(display, mode_text + conf_text, (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 255), 2)

            # Show room direction label on both sides of the polygon
            if poly and len(poly) >= 3:
                pcx = sum(p[0] for p in poly) / len(poly)
                pcy = sum(p[1] for p in poly) / len(poly)
                rd = doorway.room_direction
                # Room side label
                rx = int((pcx + rd[0] * 0.15) * w)
                ry = int((pcy + rd[1] * 0.15) * h)
                cv2.putText(display, "ROOM (inside)", (rx - 45, ry),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                # Corridor side label
                cx2 = int((pcx - rd[0] * 0.15) * w)
                cy2 = int((pcy - rd[1] * 0.15) * h)
                cv2.putText(display, "CORRIDOR (outside)", (cx2 - 65, cy2),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 165, 0), 2)

        cv2.imshow(window, display)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break
        elif key == ord(" "):
            if tracking:
                tracking = False
                print("\n=== PAUSED ===\n")
            else:
                poly = manual_vertices if (manual_mode and len(manual_vertices) >= 3) else doorway.polygon
                if len(poly) < 3:
                    print("  Need at least 3 polygon vertices!")
                    continue
                if manual_mode:
                    doorway.polygon = manual_vertices[:]
                    manual_mode = False
                zone_tracker = DoorwayZoneTracker(
                    polygon=doorway.polygon,
                    room_direction=doorway.room_direction,
                )
                tracking = True
                frame_count = 0
                print("\n=== TRACKING ===\n")
        elif key == ord("d") and not tracking:
            print("Re-detecting doorway...")
            doorway = detect_doorway(frame, api_key=api_key)
            manual_mode = False
            manual_vertices.clear()
        elif key == ord("r") and not tracking:
            doorway.polygon = [(0.2, 0.3), (0.8, 0.3), (0.8, 0.7), (0.2, 0.7)]
            doorway.confidence = 0
            doorway.detected = False
            manual_mode = False
            manual_vertices.clear()
            print("  Reset to default zone")
        elif key == ord("f"):
            # Flip room direction
            dx, dy = doorway.room_direction
            doorway.room_direction = (-dx, -dy)
            print(f"  Room direction flipped to {doorway.room_direction}")
            if tracking and zone_tracker:
                # Rebuild tracker with new direction
                zone_tracker = DoorwayZoneTracker(
                    polygon=doorway.polygon,
                    room_direction=doorway.room_direction,
                )
                print("  Tracker reset with new direction")
        elif key == ord("c") and not tracking:
            manual_mode = True
            manual_vertices.clear()
            print("  Manual mode: click 4 points to draw a THIN STRIP across the door threshold")
            print("  Draw it narrow — like a tripwire people walk through, NOT a big box")

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
