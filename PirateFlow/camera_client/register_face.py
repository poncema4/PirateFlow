#!/usr/bin/env python3
"""Register a face from an image file.

Usage:
    python register_face.py photo.jpg
    python register_face.py photo.jpg --api-url http://localhost:8001
    python register_face.py photo.jpg --user-id usr_010 --token stub-student-token
"""

import argparse
import base64
import sys

import requests


def main():
    parser = argparse.ArgumentParser(description="Register a face from an image file")
    parser.add_argument("image", help="Path to a JPEG or PNG image of the face")
    parser.add_argument("--api-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--token", default="stub-access-token", help="Auth token")
    parser.add_argument("--user-id", default=None, help="Register for a specific user (admin only). Omit to register for yourself.")
    args = parser.parse_args()

    # Read and encode the image
    try:
        with open(args.image, "rb") as f:
            image_bytes = f.read()
    except FileNotFoundError:
        print(f"ERROR: File not found: {args.image}")
        sys.exit(1)

    b64 = base64.b64encode(image_bytes).decode()
    print(f"Image loaded: {args.image} ({len(image_bytes)} bytes)")

    # Choose endpoint
    if args.user_id:
        url = f"{args.api_url}/api/face/register/{args.user_id}"
    else:
        url = f"{args.api_url}/api/face/register"

    # Send request
    resp = requests.post(
        url,
        json={"image_base64": b64},
        headers={"Authorization": f"Bearer {args.token}"},
        timeout=120,
    )

    if resp.status_code == 200:
        data = resp.json()
        print(f"SUCCESS: {data['message']}")
    else:
        print(f"FAILED ({resp.status_code}): {resp.json().get('detail', resp.text)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
