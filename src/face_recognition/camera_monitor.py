import os
import tempfile
import threading
import time

from src.face_recognition.models import (
    Capture,
    RecognitionResult,
    StrangerTracker,
)
from src.face_recognition.verifier import verify_against_database
from src.esp32.camera_client import CameraClient
from src.esp32.sensor_client import SensorNodeClient
from src.config import (
    CAMERA_CAPTURE_INTERVAL_SECONDS,
    FACE_CONFIDENCE_THRESHOLD,
    FACE_DETECTOR,
    HOST_IDENTITY,
    STRANGER_ALERT_SECONDS,
    TEMP_PATH,
)


def save_temp_capture(image_data: bytes) -> str:
    """Write camera bytes to a temporary JPEG and return its path."""
    os.makedirs(TEMP_PATH, exist_ok=True)
    fd, path = tempfile.mkstemp(suffix=".jpg", dir=TEMP_PATH)
    with os.fdopen(fd, "wb") as temp_file:
        temp_file.write(image_data)
    return path


def has_face(image_path: str) -> bool:
    try:
        from deepface import DeepFace

        faces = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend=FACE_DETECTOR,
            enforce_detection=True,
        )
        return len(faces) > 0
    except Exception:
        return False


def _confidence_from_match(match: dict) -> float:
    distance = match.get("distance", 1.0)
    threshold = match.get("threshold") or FACE_CONFIDENCE_THRESHOLD
    if not threshold:
        return 0.0
    return max(0.0, min(1.0, 1.0 - distance / threshold))


class CameraMonitor:
    def __init__(self, camera_client, sensor_client):
        self.camera = camera_client
        self.sensor = sensor_client
        self.stranger_tracker = StrangerTracker(STRANGER_ALERT_SECONDS)
        self.current_state = RecognitionResult("idle", None, None, None, None)
        self._thread = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

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
            }

    def _get_stranger_duration(self):
        if self.stranger_tracker.first_seen_at is None:
            return 0
        return time.time() - self.stranger_tracker.first_seen_at

    def _run(self):
        while not self._stop_event.is_set():
            try:
                image_data = self.camera.snapshot()
                capture = self._process_capture(image_data)
                if capture:
                    self._update_state(capture)
            except Exception as e:
                with self._lock:
                    self.current_state = RecognitionResult(
                        "error", None, None, None, None
                    )
            finally:
                self._stop_event.wait(CAMERA_CAPTURE_INTERVAL_SECONDS)

    def _process_capture(self, image_data):
        image_path = save_temp_capture(image_data)
        if not has_face(image_path):
            return Capture(image_path, has_face=False)
        return Capture(image_path, has_face=True)

    def _update_state(self, capture: Capture):
        now = time.time()
        open_door = False
        result = None

        if capture.has_face:
            result = self._recognize(capture)

        with self._lock:
            if not capture.has_face:
                self.stranger_tracker.reset()
                self.current_state = RecognitionResult(
                    "no_face", None, None, None, None
                )
            elif result.classification == "host":
                self.stranger_tracker.reset()
                self.current_state = result
                open_door = True
            elif result.classification == "stranger":
                self.stranger_tracker.update(now)
                self.current_state = result

        try:
            os.unlink(capture.image_path)
        except OSError:
            pass

        if open_door:
            try:
                self.sensor.door_open()
            except Exception as e:
                print(f"[CameraMonitor] door_open failed: {e}")

    def _recognize(self, capture: Capture) -> RecognitionResult:
        match = verify_against_database(
            capture.image_path, allowed_identities={HOST_IDENTITY}
        )
        if not match:
            return RecognitionResult("stranger", None, None, None, None)

        confidence = _confidence_from_match(match)
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


_monitor = CameraMonitor(CameraClient(), SensorNodeClient())


def start_monitor():
    return _monitor.start()


def stop_monitor():
    _monitor.stop()


def get_status():
    return _monitor.get_status()
