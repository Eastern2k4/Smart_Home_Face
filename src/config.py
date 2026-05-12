import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # project root

DB_PATH = os.path.join(BASE_DIR, "faces")
TEMP_PATH = os.path.join(BASE_DIR, "temp")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024

FACE_MODEL = "ArcFace"
FACE_DETECTOR = "opencv"

CAMERA_CAPTURE_INTERVAL_SECONDS = float(
    os.environ.get("CAMERA_CAPTURE_INTERVAL_SECONDS", "5")
)
CAMERA_NO_FACE_RETENTION_SECONDS = float(
    os.environ.get("CAMERA_NO_FACE_RETENTION_SECONDS", "60")
)

# Environment variables (can be overridden)
CAMERA_NODE_URL = os.environ.get("CAMERA_NODE_URL", "")
SENSOR_NODE_URL = os.environ.get("SENSOR_NODE_URL", None)  # will be set by registration
