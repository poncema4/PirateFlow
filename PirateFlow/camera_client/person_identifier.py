"""
Person identification via the server's face verification API.

SECURITY: No frames are ever saved to disk or kept in memory.
Frames are sent to the server's /api/face/verify endpoint for matching,
then immediately discarded. The server also does not save the frames —
it extracts a face encoding (128-d numbers), matches it, and discards
the image data.
"""

import base64
from typing import Optional

import cv2
import numpy as np


class PersonIdentifier:
    """Identifies people by sending crops to the server's face API.
    No frames are saved anywhere — they exist transiently in RAM only.
    """

    def __init__(self, api_url: str = "http://localhost:8000",
                 camera_key: str = "dev-camera-key"):
        self.api_url = api_url
        self.camera_key = camera_key
        self._identified: dict[int, tuple[str, str]] = {}
        self._failed_attempts: dict[int, int] = {}
        self.max_attempts = 15

    def try_identify(
        self,
        frame: np.ndarray,
        track_id: int,
        bbox: tuple[int, int, int, int],
        room_id: str = "",
    ) -> Optional[tuple[str, str, float]]:
        """Try to identify a person. Frame is used transiently, never saved."""
        if track_id in self._identified:
            uid, name = self._identified[track_id]
            return uid, name, 1.0

        attempts = self._failed_attempts.get(track_id, 0)
        if attempts >= self.max_attempts:
            return None

        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]

        # Crop upper body/head
        body_h = y2 - y1
        head_y2 = min(h, y1 + int(body_h * 0.6))
        pad_x = max(40, int((x2 - x1) * 0.4))
        pad_y = 30
        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_y)
        cx2 = min(w, x2 + pad_x)
        cy2 = min(h, head_y2 + pad_y)

        crop = frame[cy1:cy2, cx1:cx2]
        if crop.size == 0 or crop.shape[0] < 60 or crop.shape[1] < 60:
            return None

        # Encode as JPEG in memory only — never touches disk
        _, buffer = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
        image_b64 = base64.b64encode(buffer).decode("utf-8")
        del crop, buffer  # explicitly free

        # Send to server for matching — server discards image after encoding
        try:
            import requests
            resp = requests.post(
                f"{self.api_url}/api/face/verify",
                json={"room_id": room_id, "image_base64": image_b64},
                headers={"X-Camera-Key": self.camera_key},
                timeout=5,
            )
            del image_b64  # free the base64 string

            if resp.status_code == 200:
                data = resp.json()
                if data.get("recognized") and data.get("user_id"):
                    uid = data["user_id"]
                    name = data.get("user_name", uid)
                    confidence = data.get("confidence", 0.5)
                    self._identified[track_id] = (uid, name)
                    return uid, name, confidence
        except Exception:
            pass

        self._failed_attempts[track_id] = attempts + 1
        return None

    def get_identity(self, track_id: int) -> Optional[tuple[str, str]]:
        return self._identified.get(track_id)

    def clear_track(self, track_id: int):
        self._identified.pop(track_id, None)
        self._failed_attempts.pop(track_id, None)

    @property
    def registry_size(self) -> int:
        return 0
