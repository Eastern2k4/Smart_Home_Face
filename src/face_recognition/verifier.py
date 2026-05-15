import os
from deepface import DeepFace
from src.config import DB_PATH, TEMP_PATH, FACE_MODEL, FACE_DETECTOR
from .database import allowed_file


def verify_against_database(image_path, allowed_identities=None):
    """
    Compare a temporary image against all faces in DB.
    Returns best match dict or None.
    """
    best = None
    min_distance = 1.0

    if not os.path.exists(DB_PATH):
        return None

    for person in os.listdir(DB_PATH):
        if allowed_identities is not None and person not in allowed_identities:
            continue
        person_path = os.path.join(DB_PATH, person)
        if not os.path.isdir(person_path):
            continue
        for img_file in os.listdir(person_path):
            if not allowed_file(img_file):
                continue
            db_image = os.path.join(person_path, img_file)
            try:
                result = DeepFace.verify(
                    img1_path=image_path,
                    img2_path=db_image,
                    model_name=FACE_MODEL,
                    detector_backend=FACE_DETECTOR,
                    enforce_detection=False,
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
                print(f"Error comparing {db_image}: {e}")
                continue
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
