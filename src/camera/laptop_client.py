"""Laptop webcam client used as a local camera source for recognition tests."""

import logging
import time

from src.services.errors import ArduinoUnreachable

logger = logging.getLogger("laptop_camera_client")

MAX_IMAGE_BYTES = 5 * 1024 * 1024


class LaptopCameraClient:
    source = "laptop"

    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index

    def snapshot(self, camera_url: str | None = None) -> bytes:
        """
        Capture one JPEG frame from the laptop camera.

        camera_url is accepted for interface compatibility with CameraClient,
        but ignored because this source is local hardware.
        """
        frame = self._read_frame()
        return self._encode_jpeg(frame)

    def stream(self):
        """Yield an MJPEG stream from the laptop camera."""

        def generate():
            while True:
                try:
                    frame = self._read_frame()
                    image_data = self._encode_jpeg(frame)
                except ArduinoUnreachable as e:
                    logger.warning("laptop camera stream frame failed: %s", e)
                    time.sleep(0.5)
                    continue
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + image_data
                    + b"\r\n"
                )

        return generate(), "multipart/x-mixed-replace; boundary=frame"

    def stream_url(self, camera_url: str | None = None) -> str:
        """Return a descriptive pseudo URL for status/debug output."""
        return f"laptop-camera://{self.camera_index}/stream"

    def _read_frame(self):
        try:
            import cv2
        except ImportError as e:
            raise ArduinoUnreachable(
                "OpenCV is required for laptop camera mode. Install opencv-python."
            ) from e

        capture = cv2.VideoCapture(self.camera_index)
        if not capture.isOpened():
            capture.release()
            raise ArduinoUnreachable(
                f"Cannot open laptop camera index {self.camera_index}"
            )

        try:
            frame = None
            for _ in range(3):
                ok, candidate = capture.read()
                if ok:
                    frame = candidate
            if frame is None:
                raise ArduinoUnreachable(
                    f"No frame received from laptop camera index {self.camera_index}"
                )
            return frame
        finally:
            capture.release()

    def _encode_jpeg(self, frame) -> bytes:
        import cv2

        ok, buffer = cv2.imencode(".jpg", frame)
        if not ok:
            raise ArduinoUnreachable("Could not encode laptop camera frame as JPEG")
        image_data = buffer.tobytes()
        if len(image_data) > MAX_IMAGE_BYTES:
            raise ArduinoUnreachable(
                f"Laptop camera image exceeded {MAX_IMAGE_BYTES} bytes"
            )
        return image_data
