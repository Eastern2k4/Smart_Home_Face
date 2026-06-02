import os
import shutil
from werkzeug.utils import secure_filename
from src.config import (
    ALLOWED_EXTENSIONS,
    DATABASE_PATH,
    HOSTS_PATH,
    STRANGER_PATH,
    TEMP_MAX_IMAGES,
    TEMP_PATH,
)


HOST_IDENTITY = "Hosts"
STRANGER_IDENTITY = "Strangers"
TEMP_IDENTITY = "Temp"
SYSTEM_FOLDERS = {STRANGER_IDENTITY, TEMP_IDENTITY}


def ensure_database_dirs():
    """Create required folders under the project's database directory.

    Called at application startup to ensure other modules can read/write
    images without checking existence everywhere.
    """
    os.makedirs(DATABASE_PATH, exist_ok=True)
    os.makedirs(HOSTS_PATH, exist_ok=True)
    os.makedirs(STRANGER_PATH, exist_ok=True)
    os.makedirs(TEMP_PATH, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_all_faces():
    """Return list of unique person names (excluding internal folders)."""
    ensure_database_dirs()
    faces = set()
    for root, _, files in os.walk(DATABASE_PATH):
        for file in files:
            if not allowed_file(file):
                continue
            rel = os.path.relpath(os.path.join(root, file), DATABASE_PATH)
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
    """Save uploaded image to person's folder and return saved path."""
    ensure_database_dirs()
    name_secure = secure_filename(name)
    person_dir = os.path.join(DATABASE_PATH, name_secure)
    os.makedirs(person_dir, exist_ok=True)
    filepath = next_image_path(person_dir, name_secure)
    image_file.save(filepath)
    return filepath


def add_host_face_image(image_file, name=None):
    """Save an image into the Hosts folder (used for known hosts)."""
    ensure_database_dirs()
    name_secure = secure_filename(name or HOST_IDENTITY) or HOST_IDENTITY
    filepath = next_image_path(HOSTS_PATH, name_secure)
    image_file.save(filepath)
    return filepath


def save_bytes_to_folder(folder_path, prefix, image_data):
    ensure_database_dirs()
    count = len([f for f in os.listdir(folder_path) if allowed_file(f)])
    filename = secure_filename(f"{prefix}_{count}.jpg")
    filepath = os.path.join(folder_path, filename)
    with open(filepath, "wb") as f:
        f.write(image_data)
    return filepath


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
    return [p for p, _ in entries]


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
    path = save_bytes_to_folder(TEMP_PATH, "temp", image_data)
    prune_temp_images()
    return path


def move_temp_capture_to_stranger(temp_path):
    ensure_database_dirs()
    if not os.path.exists(temp_path):
        return None
    count = len([f for f in os.listdir(STRANGER_PATH) if allowed_file(f)])
    filename = secure_filename(f"stranger_{count}.jpg")
    destination = os.path.join(STRANGER_PATH, filename)
    shutil.copy2(temp_path, destination)
    try:
        os.remove(temp_path)
    except OSError:
        pass
    return destination


def delete_face(name):
    ensure_database_dirs()
    name_secure = secure_filename(name)
    person_dir = os.path.join(DATABASE_PATH, name_secure)
    if os.path.exists(person_dir):
        shutil.rmtree(person_dir)
        return True
    return False

