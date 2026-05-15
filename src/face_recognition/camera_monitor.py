# camera_monitor.py (revised)
import threading
import time
from datetime import datetime
from src.face_recognition.models import (
    Capture,
    RecognitionResult,
    StrangerTracker,
)
from src.config import STRANGER_ALERT_SECONDS


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
            # return a dict compatible with your frontend expectations
            return {
                "running": self._thread is not None and self._thread.is_alive(),
                "classification": self.current_state.classification,
                "identity": self.current_state.identity,
                "confidence": self.current_state.confidence,
                "door_allowed": self.current_state.classification == "host",
                "stranger_duration_seconds": self._get_stranger_duration(),
                "stranger_alert": self.stranger_tracker.last_alert_at is not None,
                # ... other fields you need
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
        # 1. Save to Temp folder
        image_path = save_temp_capture(image_data)

        # 2. Face detection
        if not has_face(image_path):
            return Capture(image_path, has_face=False)

        # 3. Verification against Hosts
        match = verify_against_database(image_path, allowed_identities={HOST_IDENTITY})
        if not match:
            # stranger
            return Capture(image_path, has_face=True)

        confidence = _confidence_from_match(match)
        if confidence >= FACE_CONFIDENCE_THRESHOLD:
            # host
            return Capture(
                image_path, has_face=True, is_spoof=False
            )  # extend with match data
        else:
            # low confidence -> treat as stranger
            return Capture(image_path, has_face=True)

    def _update_state(self, capture: Capture):
        now = time.time()
        with self._lock:
            if not capture.has_face:
                self.stranger_tracker.reset()
                self.current_state = RecognitionResult(
                    "no_face", None, None, None, None
                )
                return

            # Here you would actually call verify_against_database again or pass the match data.
            # For brevity, assume you have the result.
            # This is a placeholder – you should compute the result in _process_capture.
            result = self._recognize(capture)  # returns RecognitionResult
            if result.classification == "host":
                self.stranger_tracker.reset()
                self.sensor.door_open()
                self.current_state = result
            elif result.classification == "stranger":
                alert_now = self.stranger_tracker.update(now)
                if alert_now:
                    move_temp_capture_to_stranger(capture.image_path)
                    # also raise an event for the frontend
                self.current_state = result
