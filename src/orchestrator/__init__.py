from src.esp32.sensor_client import SensorNodeClient


class ActionOrchestrator:
    def __init__(self, sensor_client: SensorNodeClient):
        self.sensor = sensor_client

    def on_face_verified(self, identity: str, confidence: float):
        """What to do when a known face is recognised."""
        print(f"Verified: {identity} (confidence {confidence})")
        try:
            result = self.sensor.door_open()
            if not result.get("success", False):
                print(f"Door open failed: {result}")
            return result
        except Exception as e:
            print(f"Door open failed: {e}")
            return {"success": False, "error": str(e)}
