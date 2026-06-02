import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # project root

DATABASE_PATH = os.path.join(BASE_DIR, "database")
DB_PATH = DATABASE_PATH
HOSTS_PATH = os.path.join(DATABASE_PATH, "Hosts")
STRANGER_PATH = os.path.join(DATABASE_PATH, "Strangers")
TEMP_PATH = os.path.join(DATABASE_PATH, "Temp")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024

FACE_MODEL = "ArcFace"
FACE_DETECTOR = "opencv"
FACE_CONFIDENCE_THRESHOLD = float(os.environ.get("FACE_CONFIDENCE_THRESHOLD", "60"))
CAMERA_CAPTURE_INTERVAL_SECONDS = float(
    os.environ.get("CAMERA_CAPTURE_INTERVAL_SECONDS", "5")
)
STRANGER_ALERT_SECONDS = float(os.environ.get("STRANGER_ALERT_SECONDS", "300"))
STRANGER_ALERT_FRAMES = int(os.environ.get("STRANGER_ALERT_FRAMES", "5"))
DOOR_CLOSE_STABLE_FRAMES = int(os.environ.get("DOOR_CLOSE_STABLE_FRAMES", "2"))
TEMP_MAX_IMAGES = int(os.environ.get("TEMP_MAX_IMAGES", "100"))

# Environment variables (can be overridden)
CAMERA_NODE_URL = os.environ.get("CAMERA_NODE_URL", "")
SENSOR_NODE_URL = os.environ.get("SENSOR_NODE_URL", None)  # will be set by registration
