"""
arduino.py  –  Arduino registration endpoints
Each Arduino POSTs its WiFi.localIP() here on boot so the backend knows
where to reach it.  The backend now logs every registration, every error,
and exposes a /status endpoint so you can see what is connected.
"""

import logging
from flask import Blueprint, request, jsonify

from src.services.device_registry import DeviceRegistryService

logger = logging.getLogger("arduino")


# ─── helpers ────────────────────────────────────────────────────────────────


def _extract_ip(data: dict | None) -> str | None:
    """Return a cleaned IP string from the JSON body, or None."""
    if not data:
        return None
    ip = data.get("ip", "").strip()
    return ip if ip else None


# ─── registration endpoints ──────────────────────────────────────────────────


def create_arduino_blueprint(
    device_registry_service: DeviceRegistryService,
    camera_recognition_service=None,
):
    arduino_bp = Blueprint("arduino", __name__)

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
                "[REGISTER] Sensor registration failed - missing or empty 'ip' field. Body: %s",
                data,
            )
            return jsonify({"error": "Missing or empty 'ip' field"}), 400

        registration = device_registry_service.register_sensor(ip)
        logger.info("[REGISTER] Sensor node registered at %s", registration.url)
        return (
            jsonify(
                {
                    "success": True,
                    "device_id": "sensor",
                    "device": registration.device,
                    "status": "ok",
                    "url": registration.url,
                    "registered_at": registration.last_registered,
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
                "[REGISTER] Camera registration failed - missing or empty 'ip' field. Body: %s",
                data,
            )
            return jsonify({"error": "Missing or empty 'ip' field"}), 400

        registration = device_registry_service.register_camera(ip)
        monitor_started = (
            camera_recognition_service.start()
            if camera_recognition_service is not None
            else False
        )
        logger.info("[REGISTER] Camera node registered at %s", registration.url)
        return (
            jsonify(
                {
                    "success": True,
                    "device_id": "camera",
                    "device": registration.device,
                    "status": "ok",
                    "url": registration.url,
                    "stream_url": registration.stream_url,
                    "capture_url": registration.capture_url,
                    "registered_at": registration.last_registered,
                    "camera_monitor_started": monitor_started,
                },
            ),
            200,
        )

    @arduino_bp.route("/status", methods=["GET"])
    def status():
        """
        Returns what the backend currently knows about its Arduino nodes.
        Useful for debugging "why isn't the backend talking to my Arduino?"
        """
        return jsonify(device_registry_service.status())

    return arduino_bp
