import os
import shutil
from werkzeug.utils import secure_filename
from src.config import DB_PATH, ALLOWED_EXTENSIONS

HOST_IDENTITY = "Hosts"


def get_all_faces():
    """Return list of unique person names."""
    faces = set()
    if not os.path.exists(DB_PATH):
        return []
    for root, _, files in os.walk(DB_PATH):
        for file in files:
            if allowed_file(file):
                rel = os.path.relpath(os.path.join(root, file), DB_PATH)
                name = rel.split(os.sep)[0]
                faces.add(name)
    return sorted(faces)


def add_face_image(name, image_file):
    """Save uploaded image to person's folder."""
    name_secure = secure_filename(name)
    person_dir = os.path.join(DB_PATH, name_secure)
    os.makedirs(person_dir, exist_ok=True)
    count = len([f for f in os.listdir(person_dir) if allowed_file(f)])
    filename = secure_filename(f"{name_secure}_{count}.jpg")
    filepath = os.path.join(person_dir, filename)
    image_file.save(filepath)
    return filepath


def add_host_face_image(image_file):
    """Save uploaded host image to faces/Hosts."""
    return add_face_image(HOST_IDENTITY, image_file)


def delete_face(name):
    """Remove entire person folder."""
    name_secure = secure_filename(name)
    person_dir = os.path.join(DB_PATH, name_secure)
    if os.path.exists(person_dir):
        shutil.rmtree(person_dir)
        return True
    return False


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
