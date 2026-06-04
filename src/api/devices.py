"""
Device API routes consumed by the frontend dashboard.

This module owns HTTP request/response handling for sensor polling and
door/light control. Workflow handling lives in DeviceControlService.
"""

import logging

from flask import Blueprint, jsonify, request

from src.services.errors import ArduinoNotRegistered, ArduinoUnreachable

logger = logging.getLogger("devices_api")
SPEAKER_TARGETS = {"front_door", "house_gas"}


def _arduino_call(fn, *args, **kwargs):
    """
    Call fn(*args, **kwargs) and convert Arduino errors into proper HTTP
    responses so the frontend gets structured errors instead of raw 500s.
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
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Unexpected error in arduino call")
        return jsonify({"error": "internal_error", "message": str(e)}), 500


def create_devices_blueprint(device_control_service):
    devices_bp = Blueprint("devices", __name__)

    def _set_door_response(action: str):
        action_result = device_control_service.set_door(action)
        return action_result.response

    @devices_bp.route("/control/door/<action>", methods=["POST"])
    def control_door(action):
        return _arduino_call(_set_door_response, action)

    @devices_bp.route("/control/light/<room>/<on_off>", methods=["POST"])
    def control_light(room, on_off):
        if on_off not in ("on", "off"):
            return jsonify({"error": "state must be 'on' or 'off'"}), 400
        flag = on_off == "on"
        return _arduino_call(device_control_service.set_light, room, flag)

    @devices_bp.route("/sensors", methods=["GET"])
    def get_sensors():
        return _arduino_call(device_control_service.get_sensors)

    @devices_bp.route("/devices", methods=["GET"])
    def get_device_states():
        return _arduino_call(device_control_service.get_device_states)

    @devices_bp.route("/speaker/alert", methods=["POST"])
    def speaker_alert():
        def _trigger():
            return device_control_service.trigger_speaker_alert(
                target="front_door",
                reason="stranger_5_frames",
            ).to_dict()

        return _arduino_call(_trigger)

    @devices_bp.route("/speaker/alert/<target>", methods=["POST"])
    def speaker_alert_target(target):
        if target not in SPEAKER_TARGETS:
            return jsonify({"error": "invalid_speaker_target"}), 400

        data = request.get_json(silent=True) or {}
        reason = data.get("reason") or (
            "stranger_5_frames" if target == "front_door" else "manual_test"
        )
        return _arduino_call(
            lambda: device_control_service.trigger_speaker_alert(
                target=target,
                reason=reason,
            ).to_dict()
        )

    @devices_bp.route("/speaker/settings", methods=["GET"])
    def speaker_settings():
        return _arduino_call(device_control_service.get_speaker_settings)

    @devices_bp.route("/speaker/audio", methods=["POST"])
    def speaker_audio():
        data = request.get_json(silent=True) or {}
        return _arduino_call(
            device_control_service.update_speaker_audio,
            int(data.get("frontVolume", 80)),
            int(data.get("houseGasVolume", 75)),
            int(data.get("frontFrequency", data.get("frequency", 880))),
            int(data.get("houseGasFrequency", 1200)),
            int(data.get("duration", 5000)),
        )

    @devices_bp.route("/speaker/test/<target>", methods=["POST"])
    def speaker_test(target):
        if target not in SPEAKER_TARGETS:
            return jsonify({"error": "invalid_speaker_target"}), 400
        return _arduino_call(device_control_service.test_speaker, target)

    return devices_bp
