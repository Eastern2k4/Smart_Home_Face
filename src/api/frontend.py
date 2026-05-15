"""
frontend.py  –  API endpoints consumed by the frontend UI.

Key improvements:
  • All sensor/camera proxy routes are wrapped in _arduino_call() which
    converts ArduinoNotRegistered → 503 and ArduinoUnreachable → 502,
    both with a human-readable JSON error body instead of a raw 500.
  • Route paths are cleaned up (removed accidental double /api prefix).
  • Logging added throughout.
"""

import logging
import tempfile
import os

from flask import Blueprint, request, jsonify, Response
import requests
import src.state as state

from src.face_recognition.database import (
    HOST_IDENTITY,
    get_all_faces,
    add_face_image,
    add_host_face_image,
    delete_face,
)
from src.face_recognition.camera_monitor import get_status as get_camera_status
from src.face_recognition.verifier import verify_against_database
from src.esp32.camera_client import CameraClient
from src.esp32.sensor_client import (
    SensorNodeClient,
    ArduinoNotRegistered,
    ArduinoUnreachable,
)
from src.orchestrator import ActionOrchestrator

logger = logging.getLogger("frontend")

frontend_bp = Blueprint("frontend", __name__)

sensor_client = SensorNodeClient()
camera_client = CameraClient()
orchestrator = ActionOrchestrator(sensor_client)


# ── error-wrapping helper ─────────────────────────────────────────────────────


def _arduino_call(fn, *args, **kwargs):
    """
    Call fn(*args, **kwargs) and convert Arduino errors into proper HTTP
    responses so the frontend gets a structured error instead of a 500.
    """
    try:
        return jsonify(fn(*args, **kwargs))
    except ArduinoNotRegistered as e:
        logger.warning("Arduino not registered: %s", e)
        return (
            jsonify(
                {
                    "error": "arduino_not_registered",
                    "message": str(e),
                    "hint": "The Arduino has not called /api/arduino/register yet. Reboot it or check its WiFi.",
                }
            ),
            503,
        )
    except ArduinoUnreachable as e:
        logger.error("Arduino unreachable: %s", e)
        return (
            jsonify(
                {
                    "error": "arduino_unreachable",
                    "message": str(e),
                    "hint": "Check that the Arduino is powered on and on the same network.",
                }
            ),
            502,
        )
    except Exception as e:
        logger.exception("Unexpected error in arduino call")
        return jsonify({"error": "internal_error", "message": str(e)}), 500


# ── face management ───────────────────────────────────────────────────────────


@frontend_bp.route("/get-faces", methods=["GET"])
def list_faces():
    return jsonify({"faces": get_all_faces()})


@frontend_bp.route("/add-face", methods=["POST"])
def add_face():
    if "image" not in request.files or "name" not in request.form:
        return jsonify({"error": "Missing image or name"}), 400
    file = request.files["image"]
    name = request.form["name"].strip()
    if not name or file.filename == "":
        return jsonify({"error": "Invalid name or file"}), 400
    add_face_image(name, file)
    logger.info("Added face for '%s'", name)
    return jsonify({"success": True, "message": f"Face '{name}' added"})


@frontend_bp.route("/add-host-face", methods=["POST"])
def add_host_face():
    if "image" not in request.files:
        return jsonify({"error": "Missing image"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty file"}), 400
    filepath = add_host_face_image(file)
    logger.info("Added host face at %s", filepath)
    return jsonify({
        "success": True,
        "identity": HOST_IDENTITY,
        "message": "Host face added",
    })


@frontend_bp.route("/delete-face", methods=["POST"])
def remove_face():
    data = request.get_json()
    name = (data or {}).get("name", "").strip()
    if not name:
        return jsonify({"error": "No name provided"}), 400
    delete_face(name)
    logger.info("Deleted face for '%s'", name)
    return jsonify({"success": True})


# ── verification ──────────────────────────────────────────────────────────────


@frontend_bp.route("/verify-face", methods=["POST"])
def verify_face():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty file"}), 400

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        best_match = verify_against_database(tmp_path)
        if not best_match:
            logger.info("verify-face: no match found")
            return jsonify({"match": False})
        logger.info(
            "verify-face: matched '%s' distance=%.4f",
            best_match["identity"],
            best_match["distance"],
        )
        orchestrator.on_face_verified(
            best_match["identity"], 1 - best_match["distance"]
        )
        return jsonify({"match": True, "best_match": best_match})
    except Exception as e:
        logger.exception("verify-face failed")
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp_path)


# ── camera ────────────────────────────────────────────────────────────────────


@frontend_bp.route("/esp32/snapshot", methods=["GET"])
def esp32_snapshot():
    camera_url = request.args.get("camera_url", "").strip()
    try:
        if camera_url:
            image_data = CameraClient(base_url=camera_url).snapshot()
        else:
            image_data = camera_client.snapshot()
        return Response(image_data, content_type="image/jpeg")
    except ArduinoNotRegistered as e:
        return jsonify({"error": "arduino_not_registered", "message": str(e)}), 503
    except ArduinoUnreachable as e:
        return jsonify({"error": "arduino_unreachable", "message": str(e)}), 502
    except Exception as e:
        logger.exception("snapshot failed")
        return jsonify({"error": str(e)}), 500


@frontend_bp.route("/esp32/stream", methods=["GET"])
def esp32_stream():
    camera_url = request.args.get("camera_url", "").strip()
    try:
        stream_url = camera_url or camera_client.stream_url()
        response = requests.get(stream_url, stream=True, timeout=10)
        response.raise_for_status()
        return Response(
            response.iter_content(chunk_size=1024),
            content_type=response.headers.get(
                "Content-Type", "multipart/x-mixed-replace"
            ),
        )
    except ArduinoNotRegistered as e:
        return jsonify({"error": "arduino_not_registered", "message": str(e)}), 503
    except ArduinoUnreachable as e:
        return jsonify({"error": "arduino_unreachable", "message": str(e)}), 502
    except Exception as e:
        logger.exception("stream proxy failed")
        return jsonify({"error": str(e)}), 500


@frontend_bp.route("/camera/recognition-status", methods=["GET"])
def camera_recognition_status():
    return jsonify(get_camera_status())


# ── door / light / sensors ────────────────────────────────────────────────────


@frontend_bp.route("/control/door/<action>", methods=["POST"])
def control_door(action):
    if action == "open":
        return _arduino_call(sensor_client.door_open)
    elif action == "close":
        return _arduino_call(sensor_client.door_close)
    return jsonify({"error": "action must be 'open' or 'close'"}), 400


@frontend_bp.route("/control/light/<room>/<on_off>", methods=["POST"])
def control_light(room, on_off):
    if on_off not in ("on", "off"):
        return jsonify({"error": "state must be 'on' or 'off'"}), 400
    flag = on_off == "on"
    if room == "wc":
        return _arduino_call(sensor_client.light_wc, flag)
    elif room == "kitchen":
        return _arduino_call(sensor_client.light_kitchen, flag)
    elif room == "bedroom":
        return _arduino_call(sensor_client.light_bedroom, flag)
    return jsonify({"error": "invalid room"}), 400


@frontend_bp.route("/sensors", methods=["GET"])
def get_sensors():
    return _arduino_call(sensor_client.get_sensors)


@frontend_bp.route("/devices", methods=["GET"])
def get_device_states():
    return _arduino_call(sensor_client.get_device_states)
