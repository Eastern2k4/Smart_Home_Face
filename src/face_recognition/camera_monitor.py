import logging
import os
import re
import threading
import time
from datetime import datetime

from deepface import DeepFace

from src.config import (
    CAMERA_CAPTURE_INTERVAL_SECONDS,
    CAMERA_NO_FACE_RETENTION_SECONDS,
    FACE_DETECTOR,
    TEMP_PATH,
)
from src.esp32.camera_client import CameraClient
from src.face_recognition.verifier import verify_against_database

logger = logging.getLogger("camera_monitor")

_lock = threading.Lock()
_thread = None
_stop_event = threading.Event()
_no_face_files = {}
_status = {
    "running": False,
    "door_allowed": False,
    "classification": "idle",
    "identity": None,
    "image_path": None,
    "updated_at": None,
    "error": None,
}


def _stamp():
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")


def _safe_label(value):
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_") or "unknown"


def _set_status(**updates):
    with _lock:
        _status.update(updates)
        _status["updated_at"] = datetime.now().isoformat()


def get_status():
    with _lock:
        return dict(_status)


def stop_monitor():
    _stop_event.set()


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


def _detect_face(image_path):
    try:
        faces = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend=FACE_DETECTOR,
            enforce_detection=True,
        )
        return len(faces) > 0
    except Exception:
        return False


def _rename_capture(path, classification, identity=None):
    label = _safe_label(identity) if identity else classification
    new_path = os.path.join(TEMP_PATH, f"camera_{classification}_{label}_{_stamp()}.jpg")
    os.replace(path, new_path)
    return new_path


def _cleanup_no_face_files():
    now = time.time()
    expired = [
        path
        for path, created_at in _no_face_files.items()
        if now - created_at >= CAMERA_NO_FACE_RETENTION_SECONDS
    ]
    for path in expired:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError as e:
            logger.warning("Could not remove no-face capture %s: %s", path, e)
        finally:
            _no_face_files.pop(path, None)


def _process_capture(path):
    if not _detect_face(path):
        no_face_path = _rename_capture(path, "no_face")
        _no_face_files[no_face_path] = time.time()
        _set_status(
            door_allowed=False,
            classification="no_face",
            identity=None,
            image_path=no_face_path,
            error=None,
        )
        return

    match = verify_against_database(path)
    if match:
        owner_path = _rename_capture(path, "owner", match["identity"])
        _set_status(
            door_allowed=True,
            classification="owner",
            identity=match["identity"],
            image_path=owner_path,
            error=None,
        )
        return

    stranger_path = _rename_capture(path, "stranger")
    _set_status(
        door_allowed=False,
        classification="stranger",
        identity=None,
        image_path=stranger_path,
        error=None,
    )


def _run_loop():
    os.makedirs(TEMP_PATH, exist_ok=True)
    client = CameraClient()
    _set_status(running=True, error=None)

    while not _stop_event.is_set():
        capture_path = os.path.join(TEMP_PATH, f"camera_pending_{_stamp()}.jpg")
        try:
            image_data = client.snapshot()
            with open(capture_path, "wb") as file:
                file.write(image_data)
            _process_capture(capture_path)
        except Exception as e:
            if os.path.exists(capture_path):
                try:
                    os.remove(capture_path)
                except OSError:
                    pass
            logger.exception("Camera monitor iteration failed")
            _set_status(error=str(e), door_allowed=False)
        finally:
            _cleanup_no_face_files()
            _stop_event.wait(CAMERA_CAPTURE_INTERVAL_SECONDS)

    _set_status(running=False)
