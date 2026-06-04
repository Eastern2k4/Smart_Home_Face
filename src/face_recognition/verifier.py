import os
import logging
from deepface import DeepFace
from src.config import (
    ANTI_SPOOFING_ENABLED,
    ANTI_SPOOFING_FAIL_CLOSED,
    DB_PATH,
    FACE_MODEL,
    FACE_DETECTOR,
)
from src.face_recognition.models import AntiSpoofResult
from .database import allowed_file

logger = logging.getLogger("verifier")
_antispoof_instance = None


class FaceNotDetected(Exception):
    """Raised when no face can be detected in a query image."""


def has_face(image_path):
    """Return True when DeepFace can detect a face in the input image."""
    try:
        DeepFace.represent(
            img_path=image_path,
            model_name=FACE_MODEL,
            detector_backend=FACE_DETECTOR,
            enforce_detection=True,
        )
        return True
    except Exception as e:
        if "Face could not be detected" in str(e):
            return False
        return False


def _get_antispoof():
    global _antispoof_instance
    if _antispoof_instance is None:
        from deepface_antispoofing import DeepFaceAntiSpoofing

        _antispoof_instance = DeepFaceAntiSpoofing()
    return _antispoof_instance


def check_liveness(image_path: str) -> AntiSpoofResult:
    """Return whether the image contains a real/live face."""
    if not ANTI_SPOOFING_ENABLED:
        return AntiSpoofResult(is_real=True, reason="disabled")

    try:
        analyzer = _get_antispoof()
        result = analyzer.analyze_image(image_path)
    except Exception as e:
        logger.warning("[liveness] anti-spoof API error: %s", e)
        if ANTI_SPOOFING_FAIL_CLOSED:
            return AntiSpoofResult(is_real=False, reason="api_error")
        return AntiSpoofResult(is_real=True, reason="api_error_skipped")

    if "error" in result:
        logger.debug("[liveness] anti-spoof no-face result: %s", result["error"])
        return AntiSpoofResult(is_real=False, reason="no_face")

    score = result.get("spoof", {}).get("Real")
    dominant = result.get("dominant_spoof", "Fake")
    is_real = dominant == "Real"

    logger.debug(
        "[liveness] dominant=%s score=%.3f path=%s",
        dominant,
        score if score is not None else -1,
        image_path,
    )
    return AntiSpoofResult(
        is_real=is_real,
        score=score,
        reason="real" if is_real else "spoof",
    )


def verify_against_database(image_path, allowed_identities=None):
    """
    Compare a temporary image against all faces in DB.
    Returns best match dict or None.
    """
    if not os.path.exists(DB_PATH):
        return None

    best = None
    min_distance = 1.0
    attempted = 0
    face_detection_errors = 0

    for person in os.listdir(DB_PATH):
        if person.startswith("."):
            continue
        if allowed_identities and person not in allowed_identities:
            continue
        person_path = os.path.join(DB_PATH, person)
        if not os.path.isdir(person_path):
            continue
        for img_file in os.listdir(person_path):
            if not allowed_file(img_file):
                continue
            db_image = os.path.join(person_path, img_file)
            attempted += 1
            try:
                result = DeepFace.verify(
                    img1_path=image_path,
                    img2_path=db_image,
                    model_name=FACE_MODEL,
                    detector_backend=FACE_DETECTOR,
                    enforce_detection=True,
                )
                if result.get("verified"):
                    distance = result.get("distance", 1.0)
                    if distance < min_distance:
                        min_distance = distance
                        best = {
                            "identity": person,
                            "distance": distance,
                            "threshold": result.get("threshold"),
                            "similarity_metric": result.get("similarity_metric"),
                        }
            except Exception as e:
                if "Face could not be detected" in str(e):
                    face_detection_errors += 1
                print(f"Error comparing {db_image}: {e}")
                continue
    if best is None and attempted > 0 and face_detection_errors == attempted:
        raise FaceNotDetected("Face could not be detected in the input image")
    return best


def verify_pair(image1_path, image2_path):
    """Verify two specific images."""
    result = DeepFace.verify(
        img1_path=image1_path,
        img2_path=image2_path,
        model_name=FACE_MODEL,
        detector_backend=FACE_DETECTOR,
        enforce_detection=False,
    )
    return result
