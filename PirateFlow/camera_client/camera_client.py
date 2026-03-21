#!/usr/bin/env python3
"""
PirateFlow Camera Client

Captures frames from a webcam or RTSP stream and sends them to the
PirateFlow API for face verification. Supports two modes:

  Webcam:  python camera_client.py --source webcam --room-id rm_001
  RTSP:    python camera_client.py --source rtsp://user:pass@192.168.1.100/h264Preview_01_main --room-id rm_001

The client sends a frame every --interval seconds to POST /api/face/verify.
If --show-feed is set, displays the live feed with detection status overlay.
"""

import argparse
import base64
import sys
import time

import cv2
import requests


def parse_args():
    parser = argparse.ArgumentParser(description="PirateFlow Camera Client")
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="PirateFlow API base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--room-id",
        default="rm_001",
        help="Room ID this camera monitors (default: rm_001)",
    )
    parser.add_argument(
        "--camera-key",
        default="dev-camera-key",
        help="Camera API key for authentication",
    )
    parser.add_argument(
        "--source",
        default="webcam",
        help="Video source: 'webcam' for local camera, or an RTSP URL",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=3.0,
        help="Seconds between scans (default: 3.0)",
    )
    parser.add_argument(
        "--show-feed",
        action="store_true",
        help="Display live camera feed with detection overlay",
    )
    return parser.parse_args()


def open_video_source(source: str) -> cv2.VideoCapture:
    """Open a video source (webcam index or RTSP URL)."""
    if source == "webcam":
        cap = cv2.VideoCapture(0)
    else:
        # RTSP — use TCP transport for reliability over ethernet
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize buffer to get latest frame

    if not cap.isOpened():
        print(f"ERROR: Could not open video source: {source}")
        sys.exit(1)

    print(f"Video source opened: {source}")
    return cap


def flush_and_read(cap: cv2.VideoCapture, is_rtsp: bool):
    """
    Read the latest frame. For RTSP, flush the buffer first so we don't
    process stale frames that have been sitting in OpenCV's internal buffer.
    """
    if is_rtsp:
        # Flush buffer by grabbing (not decoding) several frames
        for _ in range(5):
            cap.grab()
    return cap.read()


def frame_to_base64(frame) -> str:
    """Encode an OpenCV frame as JPEG base64."""
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode("utf-8")


def verify_face(api_url: str, room_id: str, camera_key: str, image_b64: str) -> dict:
    """Send a frame to the PirateFlow face verify endpoint."""
    try:
        resp = requests.post(
            f"{api_url}/api/face/verify",
            json={"room_id": room_id, "image_base64": image_b64},
            headers={"X-Camera-Key": camera_key},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        return {"error": "Cannot connect to API"}
    except requests.exceptions.Timeout:
        return {"error": "API request timed out"}
    except Exception as e:
        return {"error": str(e)}


def draw_overlay(frame, result: dict):
    """Draw detection result on the frame."""
    h, w = frame.shape[:2]

    if "error" in result:
        # Yellow border + error text
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 255, 255), 3)
        cv2.putText(frame, f"Error: {result['error']}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    elif not result.get("recognized", False):
        # Red border — unrecognized
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 0, 255), 3)
        cv2.putText(frame, "UNRECOGNIZED", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        if result.get("alert_sent"):
            cv2.putText(frame, "ALERT SENT", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    elif result.get("has_valid_booking"):
        # Green border — authorized
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 255, 0), 3)
        name = result.get("user_name", "Unknown")
        conf = result.get("confidence", 0)
        cv2.putText(frame, f"AUTHORIZED: {name} ({conf:.0%})", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    else:
        # Red border — recognized but no booking
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 0, 255), 3)
        name = result.get("user_name", "Unknown")
        cv2.putText(frame, f"NO BOOKING: {name}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        if result.get("alert_sent"):
            cv2.putText(frame, "ALERT SENT", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    return frame


def main():
    args = parse_args()

    print(f"PirateFlow Camera Client")
    print(f"  API:      {args.api_url}")
    print(f"  Room:     {args.room_id}")
    print(f"  Source:   {args.source}")
    print(f"  Interval: {args.interval}s")
    print(f"  Show:     {args.show_feed}")
    print()

    cap = open_video_source(args.source)
    is_rtsp = args.source != "webcam"
    last_scan = 0
    last_result = {}
    reconnect_attempts = 0

    try:
        while True:
            ret, frame = flush_and_read(cap, is_rtsp)
            if not ret:
                reconnect_attempts += 1
                if is_rtsp and reconnect_attempts <= 10:
                    wait = min(reconnect_attempts * 2, 10)
                    print(f"WARNING: Lost RTSP stream, reconnecting in {wait}s... (attempt {reconnect_attempts})")
                    time.sleep(wait)
                    cap.release()
                    cap = open_video_source(args.source)
                    continue
                elif not is_rtsp:
                    print("WARNING: Failed to read frame, retrying...")
                    time.sleep(1)
                    continue
                else:
                    print("ERROR: Could not reconnect to RTSP stream after 10 attempts.")
                    break
            reconnect_attempts = 0  # Reset on successful read

            now = time.time()

            # Scan at the configured interval
            if now - last_scan >= args.interval:
                last_scan = now
                image_b64 = frame_to_base64(frame)
                result = verify_face(args.api_url, args.room_id, args.camera_key, image_b64)
                last_result = result

                # Print result to console
                ts = time.strftime("%H:%M:%S")
                if "error" in result:
                    print(f"[{ts}] Error: {result['error']}")
                elif not result.get("recognized"):
                    print(f"[{ts}] No face recognized | Alert: {result.get('alert_sent', False)}")
                else:
                    name = result.get("user_name", "?")
                    booking = result.get("has_valid_booking", False)
                    conf = result.get("confidence", 0)
                    status = "AUTHORIZED" if booking else "UNAUTHORIZED"
                    print(f"[{ts}] {status} | {name} | Confidence: {conf:.0%} | Alert: {result.get('alert_sent', False)}")

            # Show feed if requested
            if args.show_feed:
                display = draw_overlay(frame.copy(), last_result)
                cv2.imshow(f"PirateFlow Camera - {args.room_id}", display)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    print("Quit requested.")
                    break

    except KeyboardInterrupt:
        print("\nStopped by user.")
    finally:
        cap.release()
        if args.show_feed:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
