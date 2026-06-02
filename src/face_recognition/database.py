import os
import shutil
from werkzeug.utils import secure_filename
from src.config import (
    ALLOWED_EXTENSIONS,
    DB_PATH,
    HOST_IDENTITY,
    STRANGER_PATH,
    TEMP_MAX_IMAGES,
    TEMP_PATH,
)

__all__ = [
    "HOST_IDENTITY",
    "get_all_faces",
    "add_face_image",
    "add_host_face_image",
    "delete_face",
    "allowed_file",
    "ensure_database_dirs",
    "save_temp_capture",
    "move_temp_capture_to_stranger",
]

SYSTEM_FOLDERS = {"Strangers", "Temp"}


def ensure_database_dirs():
    os.makedirs(DB_PATH, exist_ok=True)
    os.makedirs(os.path.join(DB_PATH, HOST_IDENTITY), exist_ok=True)
    os.makedirs(STRANGER_PATH, exist_ok=True)
    os.makedirs(TEMP_PATH, exist_ok=True)


def get_all_faces():
    """Return list of unique person names."""
    ensure_database_dirs()
    faces = set()
    for root, _, files in os.walk(DB_PATH):
        for file in files:
            if allowed_file(file):
                rel = os.path.relpath(os.path.join(root, file), DB_PATH)
                name = rel.split(os.sep)[0]
                if name in SYSTEM_FOLDERS:
                    continue
                faces.add(name)
    return sorted(faces)


def next_image_path(folder_path, prefix):
    prefix_secure = secure_filename(prefix) or "image"
    index = 0
    while True:
        filename = secure_filename(f"{prefix_secure}_{index}.jpg")
        filepath = os.path.join(folder_path, filename)
        if not os.path.exists(filepath):
            return filepath
        index += 1


def add_face_image(name, image_file):
    """Save uploaded image to person's folder."""
    ensure_database_dirs()
    name_secure = secure_filename(name)
    person_dir = os.path.join(DB_PATH, name_secure)
    os.makedirs(person_dir, exist_ok=True)
    filepath = next_image_path(person_dir, name_secure)
    image_file.save(filepath)
    return filepath


def add_host_face_image(image_file, name=None):
    """Save an uploaded image to the canonical host folder."""
    ensure_database_dirs()
    host_dir = os.path.join(DB_PATH, HOST_IDENTITY)
    prefix = secure_filename(name or HOST_IDENTITY) or HOST_IDENTITY
    filepath = next_image_path(host_dir, prefix)
    image_file.save(filepath)
    return filepath


def delete_face(name):
    """Remove entire person folder."""
    ensure_database_dirs()
    name_secure = secure_filename(name)
    person_dir = os.path.join(DB_PATH, name_secure)
    if os.path.exists(person_dir):
        shutil.rmtree(person_dir)
        return True
    return False


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _image_files_by_age(folder_path):
    ensure_database_dirs()
    entries = []
    for filename in os.listdir(folder_path):
        if not allowed_file(filename):
            continue
        path = os.path.join(folder_path, filename)
        if os.path.isfile(path):
            entries.append((path, os.path.getmtime(path)))
    entries.sort(key=lambda item: item[1])
    return [path for path, _ in entries]


def prune_temp_images(max_images=TEMP_MAX_IMAGES):
    files = _image_files_by_age(TEMP_PATH)
    overflow = len(files) - max_images
    if overflow <= 0:
        return []
    removed = []
    for path in files[:overflow]:
        try:
            os.remove(path)
            removed.append(path)
        except OSError:
            continue
    return removed


def save_temp_capture(image_data):
    ensure_database_dirs()
    filepath = next_image_path(TEMP_PATH, "temp")
    with open(filepath, "wb") as image_file:
        image_file.write(image_data)
    prune_temp_images()
    return filepath


def move_temp_capture_to_stranger(temp_path):
    ensure_database_dirs()
    if not os.path.exists(temp_path):
        return None
    destination = next_image_path(STRANGER_PATH, "stranger")
    shutil.copy2(temp_path, destination)
    try:
        os.remove(temp_path)
    except OSError:
        pass
    return destination
