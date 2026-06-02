"""Application service dependency wiring."""

from dataclasses import dataclass

from src.esp32.camera_client import CameraClient
from src.esp32.sensor_client import SensorNodeClient
from src.services.camera_recognition import CameraRecognitionService
from src.services.device_control import DeviceControlService
from src.services.face_verification import FaceVerificationService


@dataclass
class ServiceContainer:
    face_verification: FaceVerificationService
    device_control: DeviceControlService
    camera_recognition: CameraRecognitionService


def create_service_container() -> ServiceContainer:
    sensor_client = SensorNodeClient()
    camera_client = CameraClient()
    face_verification_service = FaceVerificationService()
    device_control_service = DeviceControlService(sensor_client)
    camera_recognition_service = CameraRecognitionService(
        camera_client=camera_client,
        face_verification_service=face_verification_service,
        device_control_service=device_control_service,
    )
    return ServiceContainer(
        face_verification=face_verification_service,
        device_control=device_control_service,
        camera_recognition=camera_recognition_service,
    )
