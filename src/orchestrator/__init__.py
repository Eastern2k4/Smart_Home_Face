from src.esp32.sensor_client import SensorNodeClient


class ActionOrchestrator:
    def __init__(self, sensor_client: SensorNodeClient):
        self.sensor = sensor_client

    def on_face_verified(self, identity: str, confidence: float):
        """What to do when a known face is recognised."""
        print(f"Verified: {identity} (confidence {confidence})")
        # Open the door automatically
        result = self.sensor.door_open()
        if not result.get("success", False):
            # Log error but don't break the flow
            print(f"Door open failed: {result}")
        # You could also log to a database, send notification, etc.
        return result
