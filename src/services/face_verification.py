"""Face database and verification workflows."""

import os
import tempfile

from src.config import FACE_CONFIDENCE_THRESHOLD, HOST_IDENTITY
from src.face_recognition.database import (
    add_face_image,
    add_host_face_image,
    delete_face,
    get_all_faces,
)
from src.face_recognition.models import RecognitionResult
from src.face_recognition.verifier import FaceNotDetected, has_face, verify_against_database


class FaceVerificationService:
    """Owns face storage workflows and host/stranger classification semantics."""

    def list_faces(self):
        return get_all_faces()

    def add_face(self, name: str, image_file):
        return add_face_image(name, image_file)

    def add_host_face(self, image_file, name: str | None = None):
        return add_host_face_image(image_file, name=name)

    def delete_face(self, name: str):
        return delete_face(name)

    def save_upload_to_temp(self, image_file) -> str:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            image_file.save(tmp.name)
            return tmp.name

    def has_face(self, image_path: str) -> bool:
        return has_face(image_path)

    def classify_host_image(self, image_path: str) -> RecognitionResult:
        return self.classify_image(image_path, allowed_identities={HOST_IDENTITY})

    def classify_image(
        self, image_path: str, allowed_identities: set[str] | None = None
    ) -> RecognitionResult:
        if not self.has_face(image_path):
            return RecognitionResult("no_face", None, None, None, None)

        try:
            match = verify_against_database(
                image_path, allowed_identities=allowed_identities
            )
        except FaceNotDetected:
            return RecognitionResult("no_face", None, None, None, None)
        if not match:
            return RecognitionResult("stranger", None, None, None, None)

        confidence = self.confidence_from_match(match)
        if confidence >= FACE_CONFIDENCE_THRESHOLD:
            return RecognitionResult(
                "host",
                match["identity"],
                confidence,
                match.get("distance"),
                match.get("threshold"),
            )

        return RecognitionResult(
            "stranger",
            None,
            confidence,
            match.get("distance"),
            match.get("threshold"),
        )

    def verify_host_image(self, image_path: str) -> dict:
        result = self.classify_host_image(image_path)
        return self.verification_response(result)

    def classify_uploaded_host_image(self, image_file) -> RecognitionResult:
        tmp_path = self.save_upload_to_temp(image_file)
        try:
            return self.classify_host_image(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def verify_uploaded_host_image(self, image_file) -> dict:
        result = self.classify_uploaded_host_image(image_file)
        return self.verification_response(result)

    def verification_response(self, result: RecognitionResult) -> dict:
        if result.classification != "host":
            return {"match": False, "classification": result.classification}

        return {
            "match": True,
            "classification": result.classification,
            "best_match": self.result_to_match(result),
        }

    @staticmethod
    def confidence_from_match(match: dict) -> float:
        distance = match.get("distance", 1.0)
        threshold = match.get("threshold") or FACE_CONFIDENCE_THRESHOLD
        if not threshold:
            return 0.0
        return max(0.0, min(1.0, 1.0 - distance / threshold))

    @staticmethod
    def result_to_match(result: RecognitionResult) -> dict:
        return {
            "identity": result.identity,
            "distance": result.distance,
            "threshold": result.threshold,
            "confidence": (
                round(result.confidence * 100, 1)
                if result.confidence is not None
                else None
            ),
        }
