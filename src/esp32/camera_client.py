import requests
import src.state as state


class CameraClient:
    def __init__(self, base_url=None):
        self._base_url = base_url

    def _get_base_url(self):
        if self._base_url:
            return self._normalize_base_url(self._base_url)
        if not state.camera_node_url:
            raise Exception("Camera node not registered yet")
        return self._normalize_base_url(state.camera_node_url)

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
        base = (
            self._normalize_base_url(camera_url)
            if camera_url
            else self._get_base_url()
        )
        response = requests.get(f"{base}/capture", timeout=10)
        response.raise_for_status()
        return response.content

    def stream_url(self, camera_url=None):
        """Return the registered ESP32-CAM MJPEG stream endpoint."""
        base = (
            self._normalize_base_url(camera_url)
            if camera_url
            else self._get_base_url()
        )
        return f"{base}/stream"
