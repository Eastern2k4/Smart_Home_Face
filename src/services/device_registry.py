"""Registered ESP32 node state."""

from dataclasses import dataclass
from datetime import datetime, timezone
import threading


@dataclass(frozen=True)
class NodeRegistration:
    url: str | None
    last_registered: str | None
    device: dict | None = None
    stream_url: str | None = None
    capture_url: str | None = None

    @property
    def connected(self) -> bool:
        return self.url is not None

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "base_url": self.url,
            "stream_url": self.stream_url,
            "capture_url": self.capture_url,
            "device": self.device,
            "last_registered": self.last_registered,
            "connected": self.connected,
        }


class DeviceRegistryService:
    """Owns backend knowledge of registered ESP32 sensor and camera nodes."""

    def __init__(self):
        self._lock = threading.Lock()
        self._sensor = NodeRegistration(None, None)
        self._camera = NodeRegistration(None, None)

    def register_sensor(self, ip: str) -> NodeRegistration:
        return self._register("sensor", ip)

    def register_camera(self, ip: str) -> NodeRegistration:
        return self._register("camera", ip)

    def get_sensor_url(self) -> str | None:
        with self._lock:
            return self._sensor.url

    def get_camera_url(self) -> str | None:
        with self._lock:
            return self._camera.url

    def get_camera_stream_url(self) -> str | None:
        with self._lock:
            return self._camera.stream_url

    def get_camera_capture_url(self) -> str | None:
        with self._lock:
            return self._camera.capture_url

    def status(self) -> dict:
        with self._lock:
            return {
                "sensor_node": self._sensor.to_dict(),
                "camera_node": self._camera.to_dict(),
            }

    def _register(self, node_type: str, ip: str) -> NodeRegistration:
        url = f"http://{ip}"
        device = None
        stream_url = None
        capture_url = None
        if node_type == "sensor":
            device = {
                "sensor_url": f"{url}/api/sensors",
                "door_url": f"{url}/api/door",
            }
        elif node_type == "camera":
            stream_url = f"{url}:81/stream"
            capture_url = f"{url}/capture"
            device = {
                "stream_url": stream_url,
                "capture_url": capture_url,
            }
        registration = NodeRegistration(
            url=url,
            last_registered=datetime.now(timezone.utc).isoformat(),
            device=device,
            stream_url=stream_url,
            capture_url=capture_url,
        )
        with self._lock:
            if node_type == "sensor":
                self._sensor = registration
            elif node_type == "camera":
                self._camera = registration
            else:
                raise ValueError(f"unknown node type: {node_type}")
        return registration
