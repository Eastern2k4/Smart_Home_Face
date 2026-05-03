import os
import pickle
import face_recognition
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)  # Allow frontend to call this backend

# Database file to store known faces
DB_FILE = "face_db.pkl"

# Load existing database or create new
if os.path.exists(DB_FILE):
    with open(DB_FILE, "rb") as f:
        known_face_encodings, known_face_names = pickle.load(f)
else:
    known_face_encodings = []
    known_face_names = []


def save_db():
    with open(DB_FILE, "wb") as f:
        pickle.dump((known_face_encodings, known_face_names), f)


def image_from_base64(base64_str):
    # Remove data URL prefix if present
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    image_data = base64.b64decode(base64_str)
    image = Image.open(BytesIO(image_data))
    return np.array(image)


@app.route("/verify-face", methods=["POST"])
def verify_face():
    if "image" not in request.files:
        return jsonify({"error": "No image file"}), 400

    file = request.files["image"]
    # Convert file to image array
    img = face_recognition.load_image_file(file)
    face_locations = face_recognition.face_locations(img)
    if len(face_locations) == 0:
        return jsonify({"verified": False, "message": "No face detected"})

    face_encodings = face_recognition.face_encodings(img, face_locations)
    if len(face_encodings) == 0:
        return jsonify({"verified": False, "message": "Could not encode face"})

    # Compare with known faces
    matches = face_recognition.compare_faces(known_face_encodings, face_encodings[0])
    distances = face_recognition.face_distance(known_face_encodings, face_encodings[0])

    best_match_index = np.argmin(distances) if len(distances) > 0 else None
    confidence = (
        100 - (distances[best_match_index] * 100) if best_match_index is not None else 0
    )
    is_match = matches[best_match_index] if best_match_index is not None else False

    if is_match and confidence > 60:
        name = known_face_names[best_match_index]
        return jsonify(
            {
                "verified": True,
                "name": name,
                "confidence": confidence,
                "message": f"Welcome {name}!",
            }
        )
    else:
        return jsonify({"verified": False, "message": "Face not recognized"})


@app.route("/add-face", methods=["POST"])
def add_face():
    if "name" not in request.form or "image" not in request.files:
        return jsonify({"error": "Missing name or image"}), 400

    name = request.form["name"]
    file = request.files["image"]

    img = face_recognition.load_image_file(file)
    face_locations = face_recognition.face_locations(img)
    if len(face_locations) == 0:
        return jsonify({"error": "No face detected in image"}), 400

    face_encodings = face_recognition.face_encodings(img, face_locations)
    if len(face_encodings) == 0:
        return jsonify({"error": "Could not encode face"}), 400

    known_face_encodings.append(face_encodings[0])
    known_face_names.append(name)
    save_db()

    return jsonify({"success": True, "message": f"Face added for {name}"})


@app.route("/get-faces", methods=["GET"])
def get_faces():
    return jsonify({"faces": known_face_names})


@app.route("/delete-face", methods=["POST"])
def delete_face():
    data = request.get_json()
    name = data.get("name")
    if not name:
        return jsonify({"error": "Name required"}), 400

    try:
        idx = known_face_names.index(name)
        del known_face_encodings[idx]
        del known_face_names[idx]
        save_db()
        return jsonify({"success": True})
    except ValueError:
        return jsonify({"error": "Face not found"}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
