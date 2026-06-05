import os
import json
import socket
import subprocess
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # project root
ROOT_DIR = Path(BASE_DIR)


def _deep_merge(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _load_app_config() -> dict:
    example_path = ROOT_DIR / "config" / "app.example.json"
    local_path = ROOT_DIR / "config" / "app.local.json"
    with example_path.open() as f:
        config = json.load(f)
    if local_path.exists():
        with local_path.open() as f:
            config = _deep_merge(config, json.load(f))
    return config


def _env(name: str, default, caster):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return caster(raw)


def _resolve_backend_host(host: str) -> str:
    host = str(host).strip()
    if host and host.lower() != "auto":
        return host
    detected = _detect_lan_ip()
    return detected or "127.0.0.1"


def _detect_lan_ip() -> str | None:
    detected = _detect_lan_ip_with_socket()
    if detected:
        return detected
    for command in (
        ["ipconfig", "getifaddr", "en0"],
        ["ipconfig", "getifaddr", "en1"],
        ["ifconfig"],
        ["ip", "addr", "show"],
        ["hostname", "-I"],
    ):
        detected = _detect_lan_ip_with_command(command)
        if detected:
            return detected
    return None


def _detect_lan_ip_with_socket() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            return ip if not ip.startswith("127.") else None
    except OSError:
        return None


def _detect_lan_ip_with_command(command: list[str]) -> str | None:
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    for token in result.stdout.replace("\n", " ").split():
        parts = token.split(".")
        if len(parts) != 4:
            continue
        try:
            if all(0 <= int(part) <= 255 for part in parts) and not token.startswith(
                "127."
            ):
                return token
        except ValueError:
            continue
    return None


APP_CONFIG = _load_app_config()
BACKEND_CONFIG = APP_CONFIG["backend"]
WIFI_CONFIG = APP_CONFIG["wifi"]
RECOGNITION_CONFIG = APP_CONFIG["recognition"]
FIRMWARE_CONFIG = APP_CONFIG["firmware"]

DB_PATH = os.path.join(BASE_DIR, "faces")
TEMP_PATH = os.path.join(BASE_DIR, "temp")
STRANGER_PATH = os.path.join(DB_PATH, "Strangers")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024
TEMP_MAX_IMAGES = _env(
    "TEMP_MAX_IMAGES",
    int(RECOGNITION_CONFIG["temp_max_images"]),
    int,
)

FACE_MODEL = "ArcFace"
FACE_DETECTOR = "opencv"
CAMERA_SOURCE = _env("CAMERA_SOURCE", "esp32", str).lower()
LAPTOP_CAMERA_INDEX = _env("LAPTOP_CAMERA_INDEX", 0, int)

FACE_CONFIDENCE_THRESHOLD = 0.6
CAMERA_CAPTURE_INTERVAL_SECONDS = _env(
    "CAMERA_CAPTURE_INTERVAL_SECONDS",
    float(RECOGNITION_CONFIG["camera_capture_interval_seconds"]),
    float,
)
STRANGER_ALERT_SECONDS = _env(
    "STRANGER_ALERT_SECONDS",
    float(RECOGNITION_CONFIG["stranger_alert_seconds"]),
    float,
)
STRANGER_ALERT_FRAMES = _env(
    "STRANGER_ALERT_FRAMES",
    int(RECOGNITION_CONFIG["stranger_alert_frames"]),
    int,
)
DOOR_CLOSE_STABLE_FRAMES = _env(
    "DOOR_CLOSE_STABLE_FRAMES",
    int(RECOGNITION_CONFIG["door_close_stable_frames"]),
    int,
)
ANTI_SPOOFING_ENABLED = _env(
    "ANTI_SPOOFING_ENABLED",
    bool(RECOGNITION_CONFIG.get("anti_spoofing_enabled", True)),
    lambda v: str(v).lower() not in ("0", "false", "no"),
)
ANTI_SPOOFING_FAIL_CLOSED = _env(
    "ANTI_SPOOFING_FAIL_CLOSED",
    bool(RECOGNITION_CONFIG.get("anti_spoofing_fail_closed", False)),
    lambda v: str(v).lower() in ("1", "true", "yes"),
)
HOST_IDENTITY = "Hosts"

BACKEND_HOST = _resolve_backend_host(_env("BACKEND_HOST", BACKEND_CONFIG["host"], str))
BACKEND_PORT = _env("BACKEND_PORT", int(BACKEND_CONFIG["port"]), int)
WIFI_SSID = _env("WIFI_SSID", WIFI_CONFIG["ssid"], str)
WIFI_PASSWORD = _env("WIFI_PASSWORD", WIFI_CONFIG["password"], str)
BACKEND_REGISTER_INTERVAL_MS = _env(
    "BACKEND_REGISTER_INTERVAL_MS",
    int(FIRMWARE_CONFIG["register_interval_ms"]),
    int,
)
SENSOR_HTTP_PORT = _env(
    "SENSOR_HTTP_PORT",
    int(FIRMWARE_CONFIG["sensor_http_port"]),
    int,
)
CAMERA_HTTP_PORT = _env(
    "CAMERA_HTTP_PORT",
    int(FIRMWARE_CONFIG["camera_http_port"]),
    int,
)
CAMERA_STREAM_PORT = _env(
    "CAMERA_STREAM_PORT",
    int(FIRMWARE_CONFIG["camera_stream_port"]),
    int,
)
SPEAKER_ALERT_DURATION_MS = _env(
    "SPEAKER_ALERT_DURATION_MS",
    int(FIRMWARE_CONFIG["speaker_alert_duration_ms"]),
    int,
)
ALARM_CHECK_INTERVAL_MS = _env(
    "ALARM_CHECK_INTERVAL_MS",
    int(FIRMWARE_CONFIG["alarm_check_interval_ms"]),
    int,
)

# Environment variables (can be overridden)
CAMERA_NODE_URL = os.environ.get("CAMERA_NODE_URL", "")
SENSOR_NODE_URL = os.environ.get("SENSOR_NODE_URL", None)  # will be set by registration
