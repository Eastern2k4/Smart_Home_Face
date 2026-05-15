"""
app.py  –  Flask application factory with structured logging.
"""

import logging
import os
import sys

if __package__ is None or __package__ == "":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request
from src.api.arduino import arduino_bp
from src.api.frontend import frontend_bp, esp32_snapshot, esp32_stream
import src.state as state


def create_app():
    # ── logging ──────────────────────────────────────────────────────────
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            # Uncomment to also write to a file:
            # logging.FileHandler("backend.log"),
        ],
    )

    app = Flask(__name__)

    # ── blueprints ───────────────────────────────────────────────────────
    app.register_blueprint(arduino_bp, url_prefix="/api/arduino")
    app.register_blueprint(frontend_bp, url_prefix="/api")

    @app.route("/register-device", methods=["POST"])
    def register_device_compat():
        data = request.get_json(silent=True) or {}
        device_id = data.get("device_id") or data.get("type") or "device"

        state.connected_devices[device_id] = {
            "stream_url": data.get("stream_url"),
            "capture_url": data.get("capture_url"),
            "sensor_url": data.get("sensor_url"),
            "door_url": data.get("door_url"),
        }

        if state.connected_devices[device_id].get("stream_url"):
            state.camera_stream_url = state.connected_devices[device_id]["stream_url"]
        if state.connected_devices[device_id].get("capture_url"):
            state.camera_capture_url = state.connected_devices[device_id]["capture_url"]

        return jsonify({"success": True})

    @app.route("/devices", methods=["GET"])
    def get_registered_devices_compat():
        return jsonify(state.connected_devices)

    @app.route("/camera-url/<device_id>", methods=["GET"])
    def get_camera_url_compat(device_id):
        device = state.connected_devices.get(device_id)
        if not device:
            return jsonify({"error": "Device not found"}), 404
        return jsonify({"stream_url": device.get("stream_url")})

    @app.route("/esp32/snapshot", methods=["GET"])
    def esp32_snapshot_compat():
        return esp32_snapshot()

    @app.route("/esp32/stream", methods=["GET"])
    def esp32_stream_compat():
        return esp32_stream()

    # ── CORS ─────────────────────────────────────────────────────────────
    @app.after_request
    def after_request(response):
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add(
            "Access-Control-Allow-Headers", "Content-Type,Authorization"
        )
        response.headers.add(
            "Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS"
        )
        return response

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
