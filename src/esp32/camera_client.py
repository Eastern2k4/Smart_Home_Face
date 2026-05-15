import requests
from urllib.parse import urlparse, urljoin
import src.state as state
from src.esp32.sensor_client import ArduinoNotRegistered, ArduinoUnreachable


class CameraClient:
    def __init__(self, base_url=None):
        self._base_url = base_url

    def _get_base_url(self):
        if self._base_url:
            return self._base_url.rstrip("/")
        if not state.camera_node_url:
            raise ArduinoNotRegistered(
                "Camera node has not registered yet. "
                "Make sure the ESP32-CAM boots and POSTs to /api/arduino/register/camera."
            )
        return state.camera_node_url.rstrip("/")

    def _root_url(self, url):
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.hostname:
            return url.rstrip("/")
        if parsed.port:
            return f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"
        return f"{parsed.scheme}://{parsed.hostname}"

    def _build_url_candidates(self, base_url):
        """Generate possible snapshot endpoints for a given base URL."""
        parsed = urlparse(base_url)
        base = base_url.rstrip("/")
        candidates = [base]
        if not parsed.path or parsed.path == "/":
            candidates.extend(
                [
                    urljoin(base, "/capture"),
                    urljoin(base, "/jpg"),
                    urljoin(base, "/jpeg"),
                    urljoin(base, "/stream"),
                    urljoin(base, "/video"),
                ]
            )
        elif parsed.path.endswith("/capture"):
            root = base[: base.rfind("/capture")]
            candidates.extend([f"{root}/jpg", f"{root}/jpeg", f"{root}/stream"])
        elif parsed.path.endswith("/jpg") or parsed.path.endswith("/jpeg"):
            root = base[: base.rfind("/")]
            candidates.extend([f"{root}/capture", f"{root}/stream"])
        return list(dict.fromkeys(candidates))

    def stream_url(self):
        """Return the ESP32-CAM MJPEG stream URL from the registered base URL."""
        if self._base_url:
            parsed = urlparse(self._base_url)
            if parsed.path.rstrip("/") == "/stream":
                return self._base_url.rstrip("/")

        if not self._base_url and state.camera_stream_url:
            return state.camera_stream_url

        base = self._get_base_url()
        parsed = urlparse(base)
        if parsed.port:
            root = f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"
        else:
            root = f"{parsed.scheme}://{parsed.hostname}:81"
        return f"{root}/stream"

    def capture_url(self):
        """Return the ESP32-CAM still image URL from the registered base URL."""
        if self._base_url:
            parsed = urlparse(self._base_url)
            if parsed.path.rstrip("/") == "/capture":
                return self._base_url.rstrip("/")

        if not self._base_url and state.camera_capture_url:
            return state.camera_capture_url

        return f"{self._root_url(self._get_base_url())}/capture"

    def _fetch_image(self, url, timeout=30):
        """Fetch JPEG from a specific URL, handling MJPEG streams."""
        try:
            response = requests.get(url, timeout=timeout, stream=True)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise ArduinoUnreachable(
                f"Cannot fetch image from ESP32-CAM at {url}: {e}"
            ) from e
        content_type = response.headers.get("content-type", "").lower()

        image_data = bytearray()
        if "multipart" in content_type and "boundary=" in content_type:
            boundary = content_type.split("boundary=")[-1].strip().strip('"')
            boundary_bytes = boundary.encode()
            for chunk in response.iter_content(chunk_size=8192):
                image_data.extend(chunk)
                start = image_data.find(b"\xff\xd8")
                end = image_data.find(b"\xff\xd9", start + 2) if start != -1 else -1
                if start != -1 and end != -1:
                    return bytes(image_data[start : end + 2])
        else:
            for chunk in response.iter_content(chunk_size=8192):
                image_data.extend(chunk)
                if image_data.endswith(b"\xff\xd9"):
                    return bytes(image_data)
        if image_data:
            return bytes(image_data)
        raise Exception("No image data received")

    def snapshot(self, camera_url=None):
        """
        Fetch a snapshot from the camera.
        If camera_url is provided, use that; otherwise use the registered URL.
        """
        base = camera_url if camera_url else self.capture_url()
        for candidate in self._build_url_candidates(base):
            try:
                return self._fetch_image(candidate, timeout=30)
            except Exception:
                continue
        raise ArduinoUnreachable("Could not fetch snapshot from any candidate endpoint")
