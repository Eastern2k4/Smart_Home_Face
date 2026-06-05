"""Background camera recognition workflow service."""

import logging
import os
import threading
import time
from datetime import datetime

import requests

from src.config import (
    CAMERA_CAPTURE_INTERVAL_SECONDS,
    STRANGER_ALERT_FRAMES,
    STRANGER_ALERT_SECONDS,
)
from src.face_recognition.database import (
    move_temp_capture_to_stranger,
    save_temp_capture,
)
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
        self.image_path = None
        self.stranger_scan_count = 0
        self.event_id = 0
        self.event_type = None
        self.event_message = None
        self.event_at = None
        self.speaker_target = None
        self.speaker_reason = None
        self.updated_at = None

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
                "camera_source": getattr(self.camera, "source", "unknown"),
                "classification": self.current_state.classification,
                "identity": self.current_state.identity,
                "confidence": (
                    round(self.current_state.confidence * 100, 1)
                    if self.current_state.confidence is not None
                    else None
                ),
                "distance": self.current_state.distance,
                "threshold": self.current_state.threshold,
                "liveness_score": self.current_state.liveness_score,
                "reason": self.current_state.reason,
                "door_allowed": self.current_state.classification == "host",
                "stranger_duration_seconds": self._get_stranger_duration(),
                "stranger_scan_count": self.stranger_scan_count,
                "stranger_alert": self.stranger_scan_count >= STRANGER_ALERT_FRAMES,
                "image_path": self.image_path,
                "event_id": self.event_id,
                "event_type": self.event_type,
                "event_message": self.event_message,
                "event_at": self.event_at,
                "speaker_target": self.speaker_target,
                "speaker_reason": self.speaker_reason,
                "updated_at": self.updated_at,
                "last_action": self.device_control.last_action(),
                "error": self.last_error_message,
                "last_error_type": self.last_error_type,
                "last_error_message": self.last_error_message,
            }

    def process_once(self):
        image_data = self.camera.snapshot()
        capture = self._process_capture(image_data)
        if capture:
            self._update_state(capture)

    def snapshot(self, camera_url: str = "") -> bytes:
        return self.camera.snapshot(camera_url or None)

    def stream(self, camera_url: str = ""):
        if hasattr(self.camera, "stream"):
            return self.camera.stream()
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
                    self._touch_locked()
            finally:
                self._stop_event.wait(CAMERA_CAPTURE_INTERVAL_SECONDS)

    def _process_capture(self, image_data):
        image_path = save_temp_capture(image_data)
        return Capture(image_path, has_face=True)

    def _update_state(self, capture: Capture):
        now = time.time()
        action_result = None
        should_alert = False
        stranger_path = None

        result = self.face_verification.classify_host_image(capture.image_path)

        with self._lock:
            self.last_error_type = None
            self.last_error_message = None
            if result.classification in ("no_face", "error"):
                self.stranger_tracker.reset()
                self.stranger_scan_count = 0
                self.image_path = None
                self.current_state = RecognitionResult(
                    result.classification,
                    None,
                    None,
                    None,
                    None,
                    liveness_score=result.liveness_score,
                    reason=result.reason,
                )
            elif result.classification == "spoof":
                self.stranger_tracker.reset()
                self.stranger_scan_count = 0
                self.image_path = None
                self.current_state = result
                self._set_event_locked(
                    "spoof_detected",
                    (
                        f"Invalid or spoofed face detected (score={result.liveness_score:.3f})"
                        if result.liveness_score is not None
                        else "Invalid or spoofed face detected"
                    ),
                )
            elif result.classification == "host":
                self.stranger_tracker.reset()
                self.stranger_scan_count = 0
                self.image_path = capture.image_path
                self.current_state = result
                action_result = result
                self._set_event_locked(
                    "host",
                    f"TRUE - Host recognized ({self._format_confidence(result.confidence)})",
                )
            elif result.classification == "stranger":
                self.stranger_tracker.update(now)
                self.stranger_scan_count += 1
                self.image_path = capture.image_path
                self.current_state = result
                should_alert = self.stranger_scan_count == STRANGER_ALERT_FRAMES
                if should_alert:
                    self._set_event_locked(
                        "stranger_alert",
                        f"ALERT - Stranger detected on scan {self.stranger_scan_count}",
                        speaker_target="front_door",
                        speaker_reason="stranger_5_frames",
                    )
            self._touch_locked()

        if action_result:
            try:
                self.device_control.handle_recognition_result(action_result)
            except Exception:
                logger.exception("camera recognition door action failed")

        if result.classification == "stranger":
            try:
                self.device_control.handle_non_host_seen("stranger")
            except Exception:
                logger.exception("camera recognition close-door action failed")
            if should_alert:
                try:
                    self.device_control.trigger_speaker_alert(
                        target="front_door",
                        reason="stranger_5_frames",
                    )
                    stranger_path = move_temp_capture_to_stranger(capture.image_path)
                except Exception:
                    logger.exception("camera recognition stranger alert failed")
        elif result.classification in ("no_face", "spoof", "error"):
            try:
                self.device_control.handle_non_host_seen(result.classification)
            except Exception:
                logger.exception("camera recognition close-door action failed")

        if result.classification != "stranger" or not should_alert:
            try:
                os.unlink(capture.image_path)
            except OSError:
                pass

        if stranger_path:
            with self._lock:
                self.image_path = stranger_path
                self._touch_locked()

    def _set_event_locked(
        self,
        event_type,
        event_message,
        speaker_target=None,
        speaker_reason=None,
    ):
        self.event_id += 1
        self.event_type = event_type
        self.event_message = event_message
        self.event_at = self._now_iso()
        self.speaker_target = speaker_target
        self.speaker_reason = speaker_reason

    def _touch_locked(self):
        self.updated_at = self._now_iso()

    @staticmethod
    def _now_iso():
        return datetime.now().isoformat()

    @staticmethod
    def _format_confidence(confidence):
        if confidence is None:
            return "unknown confidence"
        return f"{confidence * 100:.1f}%"
