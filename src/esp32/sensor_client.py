"""
sensor_client.py  –  HTTP client for the Sensor Arduino node.

Key improvements over the old version:
  • Fixed the self._base_url / self.base_url naming bug (crashed at runtime).
  • Reads the registered URL from state at call-time, not at import-time.
  • Raises ArduinoNotRegistered when no IP has been registered yet.
  • Raises ArduinoUnreachable (with full context) when the request times out
    or the node returns a non-2xx response.
  • Every failure is logged so the backend log tells you *exactly* which
    endpoint failed and why.
"""

import logging
import requests
import src.state as state

logger = logging.getLogger("sensor_client")

DEFAULT_TIMEOUT = 5  # seconds


class ArduinoNotRegistered(Exception):
    """Raised when no Arduino has called /register yet."""


class ArduinoUnreachable(Exception):
    """Raised when the Arduino is registered but not responding."""


class SensorNodeClient:
    def __init__(self, base_url: str | None = None):
        # Allow an explicit URL for testing; otherwise read from shared state.
        self._explicit_url = base_url

    # ── internal ──────────────────────────────────────────────────────────

    def _base_url(self) -> str:
        url = self._explicit_url or state.sensor_node_url
        if not url:
            raise ArduinoNotRegistered(
                "Sensor node has not registered yet. "
                "Make sure the Arduino boots and POSTs to /api/arduino/register/sensor."
            )
        return url.rstrip("/")

    def _request(
        self, endpoint: str, method: str = "GET", timeout: int = DEFAULT_TIMEOUT
    ):
        base = self._base_url()
        url = f"{base}{endpoint}"
        logger.debug("[SENSOR] %s %s", method, url)
        try:
            resp = requests.request(method, url, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.ConnectionError as e:
            msg = f"[SENSOR] Cannot connect to sensor node at {url} — is the Arduino online?"
            logger.error(msg)
            raise ArduinoUnreachable(msg) from e
        except requests.exceptions.Timeout:
            msg = f"[SENSOR] Request to {url} timed out after {timeout}s — Arduino may be busy or offline."
            logger.error(msg)
            raise ArduinoUnreachable(msg)
        except requests.exceptions.HTTPError as e:
            msg = f"[SENSOR] {url} returned HTTP {e.response.status_code}: {e.response.text[:200]}"
            logger.error(msg)
            raise ArduinoUnreachable(msg) from e
        except Exception as e:
            logger.exception("[SENSOR] Unexpected error calling %s", url)
            raise

    # ── actuators ─────────────────────────────────────────────────────────

    def door_open(self):
        return self._request("/api/door/open", timeout=12)

    def door_close(self):
        return self._request("/api/door/close", timeout=12)

    def light_wc(self, on: bool):
        return self._request(f"/api/light/wc/{'on' if on else 'off'}")

    def light_kitchen(self, on: bool):
        return self._request(f"/api/light/kitchen/{'on' if on else 'off'}")

    def light_bedroom(self, on: bool):
        return self._request(f"/api/light/bedroom/{'on' if on else 'off'}")

    def speaker_alert(self):
        return self._request("/api/speaker/alert")

    # ── sensors ───────────────────────────────────────────────────────────

    def get_sensors(self):
        return self._request("/api/sensors")

    def get_device_states(self):
        return self._request("/api/devices")
