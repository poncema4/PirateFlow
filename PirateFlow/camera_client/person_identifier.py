"""
Person identification using face_recognition on YOLO person crops.

Instead of running face detection on the full frame (slow, misses people
facing away), this module:
1. Takes a person bbox crop from a YOLO detection
2. Runs face_recognition on just the small crop (much faster)
3. Matches against the face registry to identify who it is
4. Caches identities per track_id
"""

import os
from typing import Optional

import face_recognition
import numpy as np


class PersonIdentifier:
    """Identifies people by running face recognition on person crops."""

    def __init__(self, tolerance: float = 0.58):
        self.tolerance = tolerance
        self._registry: dict[str, list[np.ndarray]] = {}  # user_id -> encodings
        self._names: dict[str, str] = {}  # user_id -> display name
        self._identified: dict[int, tuple[str, str]] = {}  # track_id -> (user_id, name)

    def load_faces_from_dir(self, faces_dir: str) -> int:
        """Load face images from a directory. Returns count loaded."""
        if not os.path.isdir(faces_dir):
            print(f"[identifier] Faces directory not found: {faces_dir}")
            return 0

        count = 0
        for fname in os.listdir(faces_dir):
            if not fname.lower().endswith((".jpg", ".jpeg", ".png")):
                continue

            name = os.path.splitext(fname)[0].replace("_", " ").title()
            path = os.path.join(faces_dir, fname)

            try:
                img = face_recognition.load_image_file(path)
                from PIL import Image, ImageEnhance, ImageOps
                pil_img = Image.fromarray(img)

                # Generate augmented versions for robust matching
                augmented = [pil_img]
                augmented.append(ImageOps.mirror(pil_img))
                augmented.append(ImageEnhance.Brightness(pil_img).enhance(1.25))
                augmented.append(ImageEnhance.Brightness(pil_img).enhance(0.75))
                augmented.append(ImageEnhance.Contrast(pil_img).enhance(1.3))

                all_encodings = []
                for aug in augmented:
                    aug_arr = np.array(aug)
                    encs = face_recognition.face_encodings(aug_arr, num_jitters=2)
                    all_encodings.extend(encs)

                if all_encodings:
                    uid = os.path.splitext(fname)[0].lower()
                    self._registry[uid] = all_encodings
                    self._names[uid] = name
                    count += 1
                    print(f"  Loaded: {name} ({len(all_encodings)} encodings)")
                else:
                    print(f"  WARNING: No face found in {fname}")
            except Exception as e:
                print(f"  Failed to load {fname}: {e}")

        return count

    def try_identify(
        self,
        frame: np.ndarray,
        track_id: int,
        bbox: tuple[int, int, int, int],
    ) -> Optional[tuple[str, str, float]]:
        """Try to identify a tracked person by their face.

        Args:
            frame: Full RGB frame
            track_id: ByteTrack track ID
            bbox: (x1, y1, x2, y2) pixel coordinates of person

        Returns:
            (user_id, user_name, confidence) or None
        """
        # Check cache first
        if track_id in self._identified:
            uid, name = self._identified[track_id]
            return uid, name, 1.0

        if not self._registry:
            return None

        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]

        # Focus on upper body / head area for better face detection
        body_h = y2 - y1
        head_y2 = min(h, y1 + int(body_h * 0.55))  # upper 55% of body

        # Wide padding for better face capture
        pad_x = max(30, int((x2 - x1) * 0.3))
        pad_y = 20
        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_y)
        cx2 = min(w, x2 + pad_x)
        cy2 = min(h, head_y2 + pad_y)

        crop = frame[cy1:cy2, cx1:cx2]
        if crop.size == 0 or crop.shape[0] < 60 or crop.shape[1] < 60:
            return None

        # Ensure crop is contiguous C-order uint8 (dlib requirement)
        crop = np.ascontiguousarray(crop, dtype=np.uint8)

        # Detect and encode face in the crop
        try:
            encodings = face_recognition.face_encodings(crop)
            if not encodings:
                return None
        except Exception:
            return None

        encoding = encodings[0]

        # Match against registry
        best_uid = None
        best_dist = float("inf")

        for uid, ref_encodings in self._registry.items():
            distances = face_recognition.face_distance(ref_encodings, encoding)
            min_dist = float(np.min(distances))
            if min_dist < best_dist:
                best_dist = min_dist
                best_uid = uid

        if best_dist <= self.tolerance and best_uid is not None:
            confidence = round(1.0 - best_dist, 3)
            name = self._names.get(best_uid, best_uid)
            # Cache for this track
            self._identified[track_id] = (best_uid, name)
            return best_uid, name, confidence

        return None

    def get_identity(self, track_id: int) -> Optional[tuple[str, str]]:
        """Get cached identity for a track."""
        return self._identified.get(track_id)

    def clear_track(self, track_id: int):
        """Remove cached identity when a track expires."""
        self._identified.pop(track_id, None)

    @property
    def registry_size(self) -> int:
        return len(self._registry)
