"""Background camera recognition workflow service."""

import logging
import os
import tempfile
import threading
import time

import requests

from src.config import CAMERA_CAPTURE_INTERVAL_SECONDS, STRANGER_ALERT_SECONDS, TEMP_PATH
from src.face_recognition.models import Capture, RecognitionResult, StrangerTracker
from src.services.device_control import DeviceControlService
from src.services.face_verification import FaceVerificationService

logger = logging.getLogger("camera_recognition_service")


class CameraRecognitionService:
    """Owns continuous camera capture, recognition, status, and action dispatch."""

    def __init__(
        self,
        camera_client,
        face_verification_service: FaceVerificationService,
        device_control_service: DeviceControlService,
    ):
        self.camera = camera_client
        self.face_verification = face_verification_service
        self.device_control = device_control_service
        self.stranger_tracker = StrangerTracker(STRANGER_ALERT_SECONDS)
        self.current_state = RecognitionResult("idle", None, None, None, None)
        self._thread = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self.last_error_type = None
        self.last_error_message = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return False
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return True

    def stop(self):
        self._stop_event.set()

    def get_status(self):
        with self._lock:
            return {
                "running": self._thread is not None and self._thread.is_alive(),
                "classification": self.current_state.classification,
                "identity": self.current_state.identity,
                "confidence": self.current_state.confidence,
                "distance": self.current_state.distance,
                "threshold": self.current_state.threshold,
                "door_allowed": self.current_state.classification == "host",
                "stranger_duration_seconds": self._get_stranger_duration(),
                "stranger_alert": self.stranger_tracker.last_alert_at is not None,
                "last_error_type": self.last_error_type,
                "last_error_message": self.last_error_message,
            }

    def process_once(self):
        image_data = self.camera.snapshot()
        capture = self._process_capture(image_data)
        if capture:
            self._update_state(capture)

    def snapshot(self, camera_url: str = "") -> bytes:
        if camera_url:
            return self.camera.__class__(base_url=camera_url).snapshot()
        return self.camera.snapshot()

    def stream(self, camera_url: str = ""):
        stream_url = self.camera.stream_url(camera_url)
        response = requests.get(stream_url, stream=True, timeout=10)
        response.raise_for_status()
        return (
            response.iter_content(chunk_size=1024),
            response.headers.get("Content-Type", "multipart/x-mixed-replace"),
        )

    def _get_stranger_duration(self):
        if self.stranger_tracker.first_seen_at is None:
            return 0
        return time.time() - self.stranger_tracker.first_seen_at

    def _run(self):
        while not self._stop_event.is_set():
            try:
                self.process_once()
            except Exception as e:
                logger.exception("camera recognition loop failed")
                with self._lock:
                    self.last_error_type = type(e).__name__
                    self.last_error_message = str(e)
                    self.current_state = RecognitionResult(
                        "error", None, None, None, None
                    )
            finally:
                self._stop_event.wait(CAMERA_CAPTURE_INTERVAL_SECONDS)

    def _process_capture(self, image_data):
        image_path = self.save_temp_capture(image_data)
        has_face = self.face_verification.has_face(image_path)
        return Capture(image_path, has_face=has_face)

    def _update_state(self, capture: Capture):
        now = time.time()
        action_result = None
        result = RecognitionResult("no_face", None, None, None, None)

        if capture.has_face:
            result = self.face_verification.classify_host_image(capture.image_path)

        with self._lock:
            self.last_error_type = None
            self.last_error_message = None
            if not capture.has_face or result.classification == "no_face":
                self.stranger_tracker.reset()
                self.current_state = RecognitionResult(
                    "no_face", None, None, None, None
                )
            elif result.classification == "host":
                self.stranger_tracker.reset()
                self.current_state = result
                action_result = result
            elif result.classification == "stranger":
                self.stranger_tracker.update(now)
                self.current_state = result

        try:
            os.unlink(capture.image_path)
        except OSError:
            pass

        if action_result:
            try:
                self.device_control.handle_recognition_result(action_result)
            except Exception:
                logger.exception("camera recognition door action failed")

    @staticmethod
    def save_temp_capture(image_data: bytes) -> str:
        os.makedirs(TEMP_PATH, exist_ok=True)
        fd, path = tempfile.mkstemp(suffix=".jpg", dir=TEMP_PATH)
        with os.fdopen(fd, "wb") as temp_file:
            temp_file.write(image_data)
        return path
