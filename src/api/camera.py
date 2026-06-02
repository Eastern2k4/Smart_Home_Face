"""
Camera API routes consumed by the frontend dashboard.

This module owns HTTP request/response handling for ESP32-CAM snapshot/stream
proxying and background camera recognition service controls.
"""

import logging

from flask import Blueprint, Response, jsonify, request

from src.esp32.sensor_client import ArduinoNotRegistered, ArduinoUnreachable

logger = logging.getLogger("camera_api")


def create_camera_blueprint(camera_recognition_service):
    camera_bp = Blueprint("camera", __name__)

    @camera_bp.route("/esp32/snapshot", methods=["GET"])
    def esp32_snapshot():
        camera_url = request.args.get("camera_url", "").strip()
        try:
            image_data = camera_recognition_service.snapshot(camera_url)
            return Response(image_data, content_type="image/jpeg")
        except ArduinoNotRegistered as e:
            return jsonify({"error": "arduino_not_registered", "message": str(e)}), 503
        except ArduinoUnreachable as e:
            return jsonify({"error": "arduino_unreachable", "message": str(e)}), 502
        except Exception as e:
            logger.exception("snapshot failed")
            return jsonify({"error": str(e)}), 500

    @camera_bp.route("/esp32/stream", methods=["GET"])
    def esp32_stream():
        camera_url = request.args.get("camera_url", "").strip()
        try:
            stream, content_type = camera_recognition_service.stream(camera_url)
            return Response(stream, content_type=content_type)
        except ArduinoNotRegistered as e:
            return jsonify({"error": "arduino_not_registered", "message": str(e)}), 503
        except ArduinoUnreachable as e:
            return jsonify({"error": "arduino_unreachable", "message": str(e)}), 502
        except Exception as e:
            logger.exception("stream proxy failed")
            return jsonify({"error": str(e)}), 500

    @camera_bp.route("/camera/recognition-status", methods=["GET"])
    def camera_recognition_status():
        return jsonify(camera_recognition_service.get_status())

    @camera_bp.route("/camera/recognition/start", methods=["POST"])
    def camera_recognition_start():
        started = camera_recognition_service.start()
        return jsonify(
            {
                "success": True,
                "started": started,
                "status": camera_recognition_service.get_status(),
            }
        )

    @camera_bp.route("/camera/recognition/stop", methods=["POST"])
    def camera_recognition_stop():
        camera_recognition_service.stop()
        return jsonify(
            {"success": True, "status": camera_recognition_service.get_status()}
        )

    return camera_bp
