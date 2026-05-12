import requests
from urllib.parse import urlparse, urljoin
import src.state as state


class CameraClient:
    def __init__(self, base_url=None):
        self._base_url = base_url

    def _get_base_url(self):
        if self._base_url:
            return self._base_url
        if not state.camera_node_url:
            raise Exception("Camera node not registered yet")
        return state.camera_node_url

    def _build_url_candidates(self, base_url):
        """Generate possible snapshot endpoints for a given base URL."""
        parsed = urlparse(base_url)
        base = base_url.rstrip("/")
        candidates = [base]
        if not parsed.path or parsed.path == "/":
            candidates.extend(["/capture", "/jpg", "/jpeg", "/stream", "/video"])
        elif parsed.path.endswith("/capture"):
            root = base[: base.rfind("/capture")]
            candidates.extend([f"{root}/jpg", f"{root}/jpeg", f"{root}/stream"])
        elif parsed.path.endswith("/jpg") or parsed.path.endswith("/jpeg"):
            root = base[: base.rfind("/")]
            candidates.extend([f"{root}/capture", f"{root}/stream"])
        return list(dict.fromkeys(candidates))

    def _fetch_image(self, url, timeout=30):
        """Fetch JPEG from a specific URL, handling MJPEG streams."""
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()
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
        base = camera_url if camera_url else self._get_base_url()
        for candidate in self._build_url_candidates(base):
            try:
                return self._fetch_image(candidate, timeout=30)
            except Exception:
                continue
        raise Exception("Could not fetch snapshot from any candidate endpoint")
