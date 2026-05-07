# recognition/face_matcher.py
from deepface import DeepFace
import os


class FaceRecognizer:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.model_name = "VGG-Face"
        self.detector_backend = "opencv"
        self.threshold = 0.6
        self.dataset_path = "./dataset"
        self._initialized = True

    def recognize(self, test_image_path):
        best_match = None
        min_distance = 1.0
        for file in os.listdir(self.dataset_path):
            db_image = os.path.join(self.dataset_path, file)
            result = DeepFace.verify(
                img1_path=test_image_path,
                img2_path=db_image,
                model_name=self.model_name,
                detector_backend=self.detector_backend,
                enforce_detection=False,
            )
            distance = result["distance"]
            if distance < min_distance:
                min_distance = distance
                best_match = file
        if min_distance < self.threshold:
            return os.path.splitext(best_match)[0]
        return None
