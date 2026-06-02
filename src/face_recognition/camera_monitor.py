import logging
import os
import tempfile
import threading
import time
from datetime import datetime

from src.config import (
    CAMERA_CAPTURE_INTERVAL_SECONDS,
    DOOR_CLOSE_STABLE_FRAMES,
    STRANGER_ALERT_FRAMES,
    STRANGER_ALERT_SECONDS,
)
from src.esp32.camera_client import CameraClient
from src.esp32.sensor_client import SensorNodeClient
from src.face_recognition.database import (
    HOST_IDENTITY,
    move_temp_capture_to_stranger,
    save_temp_capture,
)
from src.face_recognition.verifier import (
    FaceNotDetected,
    has_face,
    verify_against_database,
)

logger = logging.getLogger("camera_monitor")

_lock = threading.Lock()
_thread = None
_stop_event = threading.Event()
_stranger_started_at = None
_last_stranger_saved_at = None
_last_commanded_door_open = None
_non_host_frames = 0
_stranger_scan_count = 0
_status = {
    "running": False,
    "door_allowed": False,
    "classification": "idle",
    "identity": None,
    "confidence": None,
    "image_path": None,
    "stranger_duration_seconds": 0,
    "stranger_scan_count": 0,
    "stranger_alert": False,
    "event_id": 0,
    "event_type": None,
    "event_message": None,
    "event_at": None,
    "updated_at": None,
    "error": None,
}


def _now_iso():
    return datetime.now().isoformat()


def _set_status(**updates):
    with _lock:
        _status.update(updates)
        _status["updated_at"] = _now_iso()


def _set_recognition_event(event_type, event_message):
    with _lock:
        _status["event_id"] += 1
        _status["event_type"] = event_type
        _status["event_message"] = event_message
        _status["event_at"] = _now_iso()


def get_status():
    with _lock:
        return dict(_status)


def start_monitor():
    global _thread
    with _lock:
        if _thread and _thread.is_alive():
            return False
        _stop_event.clear()
        _thread = threading.Thread(target=_run_loop, daemon=True)
        _thread.start()
        _status["running"] = True
        _status["error"] = None
        return True


def stop_monitor():
    _stop_event.set()
    _set_status(running=False)


def _confidence_from_match(match):
    threshold = match.get("threshold") or 1.0
    distance = match.get("distance", threshold)
    if threshold <= 0:
        return 0.0
    return max(0.0, min(100.0, ((threshold - distance) / threshold) * 100.0))


def _open_door():
    try:
        return SensorNodeClient().door_open()
    except Exception as e:
        logger.warning("Could not open door after host recognition: %s", e)
        return {"success": False, "error": str(e)}


def _close_door():
    try:
        return SensorNodeClient().door_close()
    except Exception as e:
        logger.warning("Could not close door after stranger recognition: %s", e)
        return {"success": False, "error": str(e)}


def _trigger_speaker_alert():
    try:
        return SensorNodeClient().speaker_alert()
    except Exception as e:
        logger.warning("Could not trigger speaker alert: %s", e)
        return {"success": False, "error": str(e)}


def _command_door(open_door):
    global _last_commanded_door_open
    if _last_commanded_door_open == open_door:
        return {"success": True, "skipped": True}

    result = _open_door() if open_door else _close_door()
    if result.get("success", False):
        _last_commanded_door_open = open_door
    return result


def _mark_host_seen():
    global _non_host_frames, _stranger_scan_count
    _non_host_frames = 0
    _stranger_scan_count = 0
    return _command_door(True)


def _mark_non_host_seen():
    global _non_host_frames
    _non_host_frames += 1
    if _non_host_frames < DOOR_CLOSE_STABLE_FRAMES:
        return {"success": True, "skipped": True, "reason": "waiting_for_stable_non_host"}
    return _command_door(False)


def _reset_stranger_tracking():
    global _stranger_started_at, _stranger_scan_count
    _stranger_started_at = None
    _stranger_scan_count = 0


def _handle_stranger(image_path):
    global _stranger_started_at, _last_stranger_saved_at, _stranger_scan_count

    now = time.time()
    if _stranger_started_at is None:
        _stranger_started_at = now

    _stranger_scan_count += 1
    _mark_non_host_seen()

    duration = now - _stranger_started_at
    should_alert = _stranger_scan_count >= STRANGER_ALERT_FRAMES
    saved_path = None

    if _stranger_scan_count == STRANGER_ALERT_FRAMES:
        _trigger_speaker_alert()
        saved_path = move_temp_capture_to_stranger(image_path)
        _last_stranger_saved_at = now
        _set_recognition_event(
            "stranger_alert",
            f"ALERT - Stranger detected on scan {_stranger_scan_count}",
        )
    elif should_alert and (
        _last_stranger_saved_at is None
        or now - _last_stranger_saved_at >= STRANGER_ALERT_SECONDS
    ):
        saved_path = move_temp_capture_to_stranger(image_path)
        _last_stranger_saved_at = now

    _set_status(
        door_allowed=False,
        classification="stranger",
        identity=None,
        confidence=None,
        image_path=saved_path or image_path,
        stranger_duration_seconds=round(duration, 1),
        stranger_scan_count=_stranger_scan_count,
        stranger_alert=should_alert,
        error=None,
    )


def _process_capture(image_data):
    probe_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as probe:
            probe.write(image_data)
            probe_path = probe.name

        if not has_face(probe_path):
            _reset_stranger_tracking()
            _mark_non_host_seen()
            _set_status(
                door_allowed=False,
                classification="no_face",
                identity=None,
                confidence=None,
                image_path=None,
                stranger_duration_seconds=0,
                stranger_scan_count=0,
                stranger_alert=False,
                error=None,
            )
            return
    finally:
        if probe_path and os.path.exists(probe_path):
            try:
                os.remove(probe_path)
            except OSError:
                pass

    image_path = save_temp_capture(image_data)

    try:
        match = verify_against_database(image_path, allowed_identities={HOST_IDENTITY})
    except FaceNotDetected:
        _reset_stranger_tracking()
        _mark_non_host_seen()
        _set_status(
            door_allowed=False,
            classification="no_face",
            identity=None,
            confidence=None,
            image_path=image_path,
            stranger_duration_seconds=0,
            stranger_scan_count=0,
            stranger_alert=False,
            error=None,
        )
        return

    if match:
        confidence = _confidence_from_match(match)
        _reset_stranger_tracking()
        _mark_host_seen()
        _set_recognition_event(
            "host",
            f"TRUE - Host recognized ({confidence:.1f}%)",
        )
        _set_status(
            door_allowed=True,
            classification="host",
            identity=HOST_IDENTITY,
            confidence=round(confidence, 1),
            image_path=image_path,
            stranger_duration_seconds=0,
            stranger_scan_count=0,
            stranger_alert=False,
            error=None,
        )
        return

    _handle_stranger(image_path)


def _run_loop():
    client = CameraClient()
    _set_status(running=True, error=None)
    _command_door(False)

    while not _stop_event.is_set():
        try:
            image_data = client.snapshot()
            _process_capture(image_data)
        except Exception as e:
            logger.exception("Camera monitor iteration failed")
            _set_status(error=str(e), door_allowed=False)
        finally:
            _stop_event.wait(CAMERA_CAPTURE_INTERVAL_SECONDS)

    _set_status(running=False)
