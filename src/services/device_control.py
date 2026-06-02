"""Smart-home device control workflows and action policy."""

from dataclasses import dataclass

from src.esp32.sensor_client import SensorNodeClient
from src.face_recognition.models import RecognitionResult


@dataclass
class ActionResult:
    type: str
    allowed: bool
    executed: bool
    reason: str
    response: dict | None = None

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "allowed": self.allowed,
            "executed": self.executed,
            "reason": self.reason,
            "response": self.response,
        }


class DeviceControlService:
    """Owns sensor polling, actuator commands, and recognition-triggered actions."""

    def __init__(self, sensor_client: SensorNodeClient):
        self.sensor = sensor_client

    def get_sensors(self):
        return self.sensor.get_sensors()

    def get_device_states(self):
        return self.sensor.get_device_states()

    def set_door(self, action: str):
        if action == "open":
            return self.open_door(reason="manual")
        if action == "close":
            return self.close_door(reason="manual")
        raise ValueError("action must be 'open' or 'close'")

    def open_door(self, reason: str = "manual", identity: str | None = None):
        result = self.sensor.door_open()
        return ActionResult(
            "door_open",
            allowed=True,
            executed=True,
            reason=reason,
            response=result,
        )

    def close_door(self, reason: str = "manual"):
        result = self.sensor.door_close()
        return ActionResult(
            "door_close",
            allowed=True,
            executed=True,
            reason=reason,
            response=result,
        )

    def set_light(self, room: str, on: bool):
        if room == "wc":
            return self.sensor.light_wc(on)
        if room == "kitchen":
            return self.sensor.light_kitchen(on)
        if room == "bedroom":
            return self.sensor.light_bedroom(on)
        raise ValueError("invalid room")

    def handle_recognition_result(self, result: RecognitionResult) -> ActionResult:
        if result.classification != "host":
            return ActionResult(
                "none",
                allowed=False,
                executed=False,
                reason=result.classification,
            )

        return self.open_door(
            reason="face_recognition",
            identity=result.identity,
        )
