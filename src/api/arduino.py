"""
arduino.py  –  Arduino registration endpoints
Each Arduino POSTs its WiFi.localIP() here on boot so the backend knows
where to reach it.  The backend now logs every registration, every error,
and exposes a /status endpoint so you can see what is connected.
"""

import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
import src.state as state

logger = logging.getLogger("arduino")

arduino_bp = Blueprint("arduino", __name__)


# ─── helpers ────────────────────────────────────────────────────────────────


def _extract_ip(data: dict | None) -> str | None:
    """Return a cleaned IP string from the JSON body, or None."""
    if not data:
        return None
    ip = data.get("ip", "").strip()
    return ip if ip else None


def _stamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _camera_device(ip: str) -> dict:
    base_url = f"http://{ip}"
    return {
        "stream_url": f"{base_url}:81/stream",
        "capture_url": f"{base_url}/capture",
    }


def _sensor_device(ip: str) -> dict:
    base_url = f"http://{ip}"
    return {
        "sensor_url": f"{base_url}/api/sensors",
        "door_url": f"{base_url}/api/door",
    }


# ─── registration endpoints ──────────────────────────────────────────────────


@arduino_bp.route("/register/sensor", methods=["POST"])
def register_sensor():
    """
    Sensor Arduino calls this on boot:
        POST /api/arduino/register/sensor
        { "ip": "192.168.1.42" }
    """
    data = request.get_json(silent=True)
    ip = _extract_ip(data)

    if not ip:
        logger.warning(
            "[REGISTER] Sensor registration failed – missing or empty 'ip' field. Body: %s",
            data,
        )
        return jsonify({"error": "Missing or empty 'ip' field"}), 400

    state.sensor_node_url = f"http://{ip}"
    state.sensor_last_seen = _stamp()
    state.connected_devices["sensor"] = _sensor_device(ip)
    logger.info("[REGISTER] Sensor node registered at %s", state.sensor_node_url)
    return (
        jsonify(
            {
                "success": True,
                "device_id": "sensor",
                "device": state.connected_devices["sensor"],
                "status": "ok",
                "url": state.sensor_node_url,
                "registered_at": state.sensor_last_seen,
            }
        ),
        200,
    )


@arduino_bp.route("/register/camera", methods=["POST"])
def register_camera():
    """
    Camera Arduino calls this on boot:
        POST /api/arduino/register/camera
        { "ip": "192.168.1.77" }
    """
    data = request.get_json(silent=True)
    ip = _extract_ip(data)

    if not ip:
        logger.warning(
            "[REGISTER] Camera registration failed – missing or empty 'ip' field. Body: %s",
            data,
        )
        return jsonify({"error": "Missing or empty 'ip' field"}), 400

    state.camera_node_url = f"http://{ip}"
    state.connected_devices["camera"] = _camera_device(ip)
    state.camera_stream_url = state.connected_devices["camera"]["stream_url"]
    state.camera_capture_url = state.connected_devices["camera"]["capture_url"]
    state.camera_last_seen = _stamp()
    logger.info("[REGISTER] Camera node registered at %s", state.camera_node_url)
    return (
        jsonify(
            {
                "success": True,
                "device_id": "camera",
                "device": state.connected_devices["camera"],
                "status": "ok",
                "url": state.camera_node_url,
                "stream_url": state.camera_stream_url,
                "capture_url": state.camera_capture_url,
                "registered_at": state.camera_last_seen,
            }
        ),
        200,
    )


# ─── status / health ─────────────────────────────────────────────────────────


@arduino_bp.route("/status", methods=["GET"])
def status():
    """
    Returns what the backend currently knows about its Arduino nodes.
    Useful for debugging "why isn't the backend talking to my Arduino?"
    """
    return jsonify(
        {
            "sensor_node": {
                "url": state.sensor_node_url,
                "device": state.connected_devices.get("sensor"),
                "last_registered": getattr(state, "sensor_last_seen", None),
                "connected": state.sensor_node_url is not None,
            },
            "camera_node": {
                "url": state.camera_stream_url or state.camera_node_url,
                "base_url": state.camera_node_url,
                "stream_url": state.camera_stream_url,
                "capture_url": state.camera_capture_url,
                "device": state.connected_devices.get("camera"),
                "last_registered": getattr(state, "camera_last_seen", None),
                "connected": state.camera_stream_url is not None
                or state.camera_node_url is not None,
            },
        }
    )
