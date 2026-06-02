"""
app.py  –  Flask application factory with structured logging.
"""

import logging
import sys
from flask import Flask
from src.api.arduino import arduino_bp
from src.api.camera import create_camera_blueprint
from src.api.devices import create_devices_blueprint
from src.api.face import create_face_blueprint
from src.dependencies.services import create_service_container


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

    # ── services ────────────────────────────────────────────────────────
    services = create_service_container()

    # ── blueprints ───────────────────────────────────────────────────────
    app.register_blueprint(arduino_bp, url_prefix="/api/arduino")
    app.register_blueprint(
        create_face_blueprint(services.face_verification, services.device_control),
        url_prefix="/api",
    )
    app.register_blueprint(
        create_devices_blueprint(services.device_control),
        url_prefix="/api",
    )
    app.register_blueprint(
        create_camera_blueprint(services.camera_recognition),
        url_prefix="/api",
    )

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
