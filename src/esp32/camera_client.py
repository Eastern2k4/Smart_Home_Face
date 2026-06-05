import requests
from urllib.parse import urlparse

from src.services.errors import ArduinoNotRegistered, ArduinoUnreachable

MAX_IMAGE_BYTES = 5 * 1024 * 1024


class CameraClient:
    source = "esp32"

    def __init__(self, base_url=None, registry=None):
        self._base_url = base_url
        self._registry = registry

    def _get_base_url(self):
        if self._base_url:
            return self._normalize_base_url(self._base_url)
        url = self._registry.get_camera_url() if self._registry else None
        if not url:
            raise ArduinoNotRegistered(
                "Camera node has not registered yet. "
                "Make sure the ESP32-CAM boots and POSTs to /api/arduino/register/camera."
            )
        return self._normalize_base_url(url)

    def capture_url(self, camera_url=None):
        if camera_url:
            return f"{self._normalize_base_url(camera_url)}/capture"
        if self._registry:
            capture_url = self._registry.get_camera_capture_url()
            if capture_url:
                return capture_url
        return f"{self._get_base_url()}/capture"

    def _normalize_base_url(self, url):
        base = url.rstrip("/")
        for suffix in ("/capture", "/stream"):
            if base.endswith(suffix):
                return base[: -len(suffix)]
        return base

    def snapshot(self, camera_url=None):
        """
        Fetch a JPEG snapshot from the camera's explicit /capture endpoint.
        If camera_url is provided, use that; otherwise use the registered URL.
        """
        url = self.capture_url(camera_url)
        try:
            response = requests.get(url, timeout=10, stream=True)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise ArduinoUnreachable(
                f"Cannot fetch image from ESP32-CAM at {url}: {e}"
            ) from e

        image_data = bytearray()
        for chunk in response.iter_content(chunk_size=8192):
            image_data.extend(chunk)
            if len(image_data) > MAX_IMAGE_BYTES:
                raise ArduinoUnreachable(
                    f"Image response exceeded {MAX_IMAGE_BYTES} bytes"
                )
            if image_data.endswith(b"\xff\xd9"):
                return bytes(image_data)
        if image_data:
            return bytes(image_data)
        raise ArduinoUnreachable("No image data received from ESP32-CAM")

    def stream_url(self, camera_url=None):
        """Return the registered ESP32-CAM MJPEG stream endpoint."""
        if camera_url:
            parsed = urlparse(camera_url)
            if parsed.path.rstrip("/") == "/stream":
                return camera_url.rstrip("/")
            return f"{self._normalize_base_url(camera_url)}/stream"
        if self._registry:
            stream_url = self._registry.get_camera_stream_url()
            if stream_url:
                return stream_url
        return f"{self._get_base_url()}/stream"
