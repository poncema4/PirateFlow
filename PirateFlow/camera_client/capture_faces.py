#!/usr/bin/env python3
"""
Quick face capture tool for PirateFlow.

Opens your webcam, shows the feed, and lets you capture face photos
for the recognition system. Photos are saved to the faces directory
and immediately available to the camera client.

Usage:
  python capture_faces.py                    # saves to ../backend/faces/
  python capture_faces.py --output ./faces   # custom directory

Controls:
  SPACE  - Capture current frame (then type the person's name)
  q      - Quit
"""

import argparse
import os
import sys

import cv2
import face_recognition


def main():
    parser = argparse.ArgumentParser(description="Capture face photos for PirateFlow")
    parser.add_argument("--output", default=None, help="Output directory for face images")
    parser.add_argument("--source", default="0", help="Camera source (0=webcam)")
    args = parser.parse_args()

    # Set up output directory
    if args.output:
        faces_dir = args.output
    else:
        faces_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "faces")
    os.makedirs(faces_dir, exist_ok=True)

    # Show existing faces
    existing = [f for f in os.listdir(faces_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    if existing:
        print(f"Existing faces in {faces_dir}:")
        for f in sorted(existing):
            print(f"  - {os.path.splitext(f)[0].replace('_', ' ').title()}")
        print()

    # Open camera
    source = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Cannot open camera: {source}")
        sys.exit(1)

    print("=" * 50)
    print("  PirateFlow Face Capture")
    print("=" * 50)
    print(f"  Saving to: {os.path.abspath(faces_dir)}")
    print()
    print("  SPACE = capture face")
    print("  q     = quit")
    print()

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        display = frame.copy()
        h, w = frame.shape[:2]

        # Detect faces in real-time for preview
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        small = cv2.resize(rgb, (0, 0), fx=0.5, fy=0.5)
        face_locs = face_recognition.face_locations(small, model="hog")

        for top, right, bottom, left in face_locs:
            # Scale back up
            top *= 2; right *= 2; bottom *= 2; left *= 2
            cv2.rectangle(display, (left, top), (right, bottom), (0, 255, 0), 2)
            cv2.putText(display, "Face detected", (left, top - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        face_count = len(face_locs)
        status_color = (0, 255, 0) if face_count == 1 else (0, 255, 255) if face_count > 1 else (0, 0, 255)
        cv2.putText(display, f"Faces: {face_count} | SPACE=capture, q=quit",
                    (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)

        if face_count == 0:
            cv2.putText(display, "No face detected - move closer", (10, h - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        elif face_count > 1:
            cv2.putText(display, "Multiple faces - only one person at a time", (10, h - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

        cv2.imshow("PirateFlow Face Capture", display)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break
        elif key == ord(" "):
            if face_count == 0:
                print("  No face detected! Move closer to the camera.")
                continue
            if face_count > 1:
                print("  Multiple faces detected! Only one person at a time.")
                continue

            # Capture successful - ask for name
            cv2.destroyWindow("PirateFlow Face Capture")
            name = input("\n  Enter person's name (e.g., 'John Smith'): ").strip()
            if not name:
                print("  Cancelled.")
                cv2.namedWindow("PirateFlow Face Capture")
                continue

            # Save the image
            filename = name.lower().replace(" ", "_") + ".jpg"
            filepath = os.path.join(faces_dir, filename)

            # Crop to just the face area with padding
            top, right, bottom, left = face_locs[0]
            top *= 2; right *= 2; bottom *= 2; left *= 2
            pad = 60
            crop_top = max(0, top - pad)
            crop_bottom = min(h, bottom + pad)
            crop_left = max(0, left - pad)
            crop_right = min(w, right + pad)
            face_crop = frame[crop_top:crop_bottom, crop_left:crop_right]

            cv2.imwrite(filepath, face_crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
            print(f"  Saved: {filepath}")

            # Verify it can be encoded
            test_img = face_recognition.load_image_file(filepath)
            test_enc = face_recognition.face_encodings(test_img)
            if test_enc:
                print(f"  Face encoding verified for {name}")
            else:
                print(f"  WARNING: Could not extract face encoding from saved image!")
                print(f"  Try again with better lighting or a clearer face angle.")

            print()
            cv2.namedWindow("PirateFlow Face Capture")

    cap.release()
    cv2.destroyAllWindows()

    # Summary
    all_faces = [f for f in os.listdir(faces_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    print(f"\n{len(all_faces)} faces in {os.path.abspath(faces_dir)}:")
    for f in sorted(all_faces):
        print(f"  - {os.path.splitext(f)[0].replace('_', ' ').title()}")


if __name__ == "__main__":
    main()
