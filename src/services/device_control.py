"""Smart-home device control workflows and action policy."""

from dataclasses import dataclass
import time

from src.config import DOOR_CLOSE_STABLE_FRAMES
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
        self._last_commanded_door_open: bool | None = None
        self._non_host_frames = 0
        self._last_action: ActionResult | None = None
        self._last_action_at: float | None = None

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
        if self._last_commanded_door_open is True and reason != "manual":
            return self._record_action(
                ActionResult(
                    "door_open",
                    allowed=True,
                    executed=False,
                    reason="already_open",
                    response={"success": True, "skipped": True},
                )
            )
        result = self.sensor.door_open()
        self._last_commanded_door_open = True
        return self._record_action(
            ActionResult(
                "door_open",
                allowed=True,
                executed=True,
                reason=reason,
                response=result,
            )
        )

    def close_door(self, reason: str = "manual"):
        if self._last_commanded_door_open is False and reason != "manual":
            return self._record_action(
                ActionResult(
                    "door_close",
                    allowed=True,
                    executed=False,
                    reason="already_closed",
                    response={"success": True, "skipped": True},
                )
            )
        result = self.sensor.door_close()
        self._last_commanded_door_open = False
        return self._record_action(
            ActionResult(
                "door_close",
                allowed=True,
                executed=True,
                reason=reason,
                response=result,
            )
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
        if result.classification == "host":
            return self.handle_host_seen(result.identity)

        return self.handle_non_host_seen(result.classification)

    def handle_host_seen(self, identity: str | None = None) -> ActionResult:
        self._non_host_frames = 0
        return self.open_door(
            reason="face_recognition",
            identity=identity,
        )

    def handle_non_host_seen(self, reason: str = "non_host") -> ActionResult:
        self._non_host_frames += 1
        if self._non_host_frames < DOOR_CLOSE_STABLE_FRAMES:
            return self._record_action(
                ActionResult(
                    "door_close",
                    allowed=True,
                    executed=False,
                    reason="waiting_for_stable_non_host",
                    response={
                        "success": True,
                        "skipped": True,
                        "non_host_frames": self._non_host_frames,
                    },
                )
            )
        return self.close_door(reason=reason)

    def trigger_speaker_alert(self) -> ActionResult:
        result = self.sensor.speaker_alert()
        return self._record_action(
            ActionResult(
                "speaker_alert",
                allowed=True,
                executed=True,
                reason="stranger_alert",
                response=result,
            )
        )

    def last_action(self) -> dict | None:
        if not self._last_action:
            return None
        data = self._last_action.to_dict()
        data["at"] = self._last_action_at
        return data

    def _record_action(self, result: ActionResult) -> ActionResult:
        self._last_action = result
        self._last_action_at = time.time()
        return result
