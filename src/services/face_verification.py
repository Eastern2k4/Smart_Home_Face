"""Face database and verification workflows."""

import logging
import os
import tempfile

from src.config import FACE_CONFIDENCE_THRESHOLD, HOST_IDENTITY
from src.face_recognition.database import (
    add_face_image,
    add_host_face_image,
    delete_face,
    get_all_faces,
)
from src.face_recognition.models import AntiSpoofResult, RecognitionResult
from src.face_recognition.verifier import (
    FaceNotDetected,
    check_liveness,
    has_face,
    verify_against_database,
)

logger = logging.getLogger("face_verification")


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

    def check_liveness(self, image_path: str) -> AntiSpoofResult:
        return check_liveness(image_path)

    def verify_host(self, image_path: str) -> RecognitionResult:
        """
        Layer 3: compare image against Hosts only.

        Assumes Layer 1 and Layer 2 have already passed.
        """
        try:
            match = verify_against_database(
                image_path, allowed_identities={HOST_IDENTITY}
            )
        except FaceNotDetected:
            logger.warning("[verify_host] face disappeared during DB comparison")
            return RecognitionResult(
                "no_face", None, None, None, None, reason="face_lost_during_verify"
            )
        except Exception as e:
            logger.exception("[verify_host] unexpected error")
            return RecognitionResult("error", None, None, None, None, reason=str(e))

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
            reason="low_host_confidence",
        )

    def classify_capture(
        self, image_path: str
    ) -> tuple[RecognitionResult, AntiSpoofResult | None]:
        """
        Run L1 -> L2 -> L3.

        Layer 4 is the consecutive stranger frame counter in CameraRecognitionService.
        """
        logger.debug("[recognition] L1 face check: %s", image_path)
        if not self.has_face(image_path):
            return (
                RecognitionResult("no_face", None, None, None, None),
                None,
            )

        logger.debug("[recognition] L2 liveness check")
        liveness = self.check_liveness(image_path)
        if not liveness.is_real:
            classification = "no_face" if liveness.reason == "no_face" else "spoof"
            return (
                RecognitionResult(
                    classification,
                    None,
                    None,
                    None,
                    None,
                    liveness_score=liveness.score,
                    reason=liveness.reason,
                ),
                liveness,
            )

        logger.debug("[recognition] L3 host verification")
        result = self.verify_host(image_path)
        result.liveness_score = liveness.score
        if result.reason is None:
            result.reason = liveness.reason
        return result, liveness

    def classify_host_image(self, image_path: str) -> RecognitionResult:
        result, _ = self.classify_capture(image_path)
        return result

    def classify_image(
        self, image_path: str, allowed_identities: set[str] | None = None
    ) -> RecognitionResult:
        if allowed_identities is None or allowed_identities == {HOST_IDENTITY}:
            return self.classify_host_image(image_path)

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
        return RecognitionResult(
            "host" if confidence >= FACE_CONFIDENCE_THRESHOLD else "stranger",
            match["identity"] if confidence >= FACE_CONFIDENCE_THRESHOLD else None,
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

    def validate_host_upload(self, image_file) -> RecognitionResult:
        tmp_path = self.save_upload_to_temp(image_file)
        try:
            if not self.has_face(tmp_path):
                return RecognitionResult("no_face", None, None, None, None)
            liveness = self.check_liveness(tmp_path)
            if not liveness.is_real:
                classification = "no_face" if liveness.reason == "no_face" else "spoof"
                return RecognitionResult(
                    classification,
                    None,
                    None,
                    None,
                    None,
                    liveness_score=liveness.score,
                    reason=liveness.reason,
                )
            return RecognitionResult(
                "valid",
                None,
                None,
                None,
                None,
                liveness_score=liveness.score,
                reason=liveness.reason,
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def verification_response(self, result: RecognitionResult) -> dict:
        if result.classification == "host":
            return {
                "match": True,
                "classification": "host",
                "best_match": self.result_to_match(result),
                "liveness_score": result.liveness_score,
                "reason": result.reason,
            }

        return {
            "match": False,
            "classification": result.classification,
            "message": self._classification_message(result),
            "liveness_score": result.liveness_score,
            "reason": result.reason,
        }

    @staticmethod
    def _classification_message(result: RecognitionResult) -> str:
        messages = {
            "no_face": "No face detected",
            "spoof": "Face image failed anti-spoofing check",
            "stranger": "Real face detected but not recognized as host",
            "error": "Recognition error",
        }
        return messages.get(result.classification, result.classification)

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
            "liveness_score": result.liveness_score,
        }
