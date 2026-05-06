from flask import Flask, render_template, request, jsonify, Response
from deepface import DeepFace
import os
import shutil
from urllib.parse import urlparse, urljoin
import urllib.request
from werkzeug.utils import secure_filename
import requests
import http.client

import pandas as pd  # add this at the top of app.py if not already

app = Flask(__name__, template_folder="templates", static_folder="static")


def build_esp32_url_candidates(camera_url: str):
    parsed = urlparse(camera_url)
    base_url = camera_url.rstrip('/')
    candidates = [base_url]

    if not parsed.path or parsed.path == '/':
        candidates.extend([
            urljoin(base_url, '/capture'),
            urljoin(base_url, '/jpg'),
            urljoin(base_url, '/jpeg'),
            urljoin(base_url, '/stream'),
            urljoin(base_url, '/video'),
        ])
    elif parsed.path.endswith('/capture'):
        root = base_url[: base_url.rfind('/capture')]
        candidates.extend([
            urljoin(root, '/jpg'),
            urljoin(root, '/jpeg'),
            urljoin(root, '/stream'),
            urljoin(root, '/video'),
        ])
    elif parsed.path.endswith('/jpg') or parsed.path.endswith('/jpeg'):
        root = base_url[: base_url.rfind('/')]
        candidates.extend([
            urljoin(root, '/capture'),
            urljoin(root, '/stream'),
            urljoin(root, '/video'),
        ])
    return list(dict.fromkeys(candidates))


def fetch_esp32_image(url, timeout=30):
    """Fetch image data from ESP32 camera"""
    try:
        print(f"[ESP32] Connecting to: {url} (timeout: {timeout}s)")
        response = requests.get(url, timeout=timeout, stream=True)
        print(f"[ESP32] Response status: {response.status_code}")
        response.raise_for_status()
        content_type = response.headers.get('content-type', '').lower()
        print(f"[ESP32] Content-Type: {content_type}")

        if 'multipart' in content_type and 'boundary=' in content_type:
            boundary = content_type.split('boundary=')[-1].strip()
            if boundary.startswith('"') and boundary.endswith('"'):
                boundary = boundary[1:-1]
            boundary_bytes = boundary.encode('utf-8')
        else:
            boundary_bytes = None

        image_data = bytearray()
        try:
            for chunk in response.iter_content(chunk_size=8192):
                if not chunk:
                    continue
                image_data.extend(chunk)

                if boundary_bytes:
                    start = image_data.find(b'\xff\xd8')
                    end = image_data.find(b'\xff\xd9', start + 2) if start != -1 else -1
                    if start != -1 and end != -1:
                        jpeg = image_data[start:end + 2]
                        print(f"[ESP32] MJPEG frame captured: {len(jpeg)} bytes")
                        return bytes(jpeg)
                else:
                    if image_data.endswith(b"\xff\xd9"):
                        print(f"[ESP32] JPEG end found after {len(image_data)} bytes")
                        return bytes(image_data)

                if len(image_data) > 5 * 1024 * 1024:
                    raise Exception("ESP32 image exceeded 5MB limit")
        except (requests.exceptions.ChunkedEncodingError, requests.exceptions.ContentDecodingError, http.client.IncompleteRead) as e:
            if image_data:
                print(f"[ESP32] Warning: incomplete stream, using {len(image_data)} bytes")
                return bytes(image_data)
            raise

        if not image_data:
            raise Exception("Empty image response from ESP32 camera")

        if image_data.endswith(b"\xff\xd9"):
            return bytes(image_data)

        print(f"[ESP32] Warning: collected {len(image_data)} bytes without JPEG end marker")
        return bytes(image_data)
    except requests.exceptions.Timeout:
        raise Exception(f"Request timeout after {timeout}s - ESP32 camera not responding. Check if ESP32 is powered on and reachable.")
    except requests.exceptions.ConnectionError as e:
        raise Exception(f"Cannot connect to ESP32 at this address. Error: {str(e)}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Request failed: {str(e)}")


# CORS headers
@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
    return response


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "faces")
TEMP_PATH = os.path.join(BASE_DIR, "temp")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

os.makedirs(DB_PATH, exist_ok=True)
os.makedirs(TEMP_PATH, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_identity_from_path(file_path):
    normalized = os.path.normpath(file_path)
    try:
        rel_path = os.path.relpath(normalized, DB_PATH)
    except ValueError:
        rel_path = os.path.basename(normalized)

    parts = rel_path.split(os.path.sep)
    if len(parts) == 1:
        return os.path.splitext(parts[0])[0]
    return parts[0]


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/verify-face", methods=["POST", "OPTIONS"])
def verify_face():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    # Save uploaded image to temp
    temp_path = os.path.join(TEMP_PATH, "verify_temp.jpg")
    file.save(temp_path)

    try:
        best_match = None
        min_distance = 1.0  # lower is better

        # Iterate over all face directories
        for person in os.listdir(DB_PATH):
            person_path = os.path.join(DB_PATH, person)
            if not os.path.isdir(person_path):
                continue
            for img_file in os.listdir(person_path):
                if not allowed_file(img_file):
                    continue
                db_image = os.path.join(person_path, img_file)
                try:
                    # Verify against each database image
                    result = DeepFace.verify(
                        img1_path=temp_path,
                        img2_path=db_image,
                        model_name="ArcFace",
                        detector_backend="opencv",
                        enforce_detection=False,
                        # silent is NOT allowed here – remove it
                    )
                    if result.get("verified"):
                        distance = result.get("distance", 1.0)
                        if distance < min_distance:
                            min_distance = distance
                            best_match = {
                                "identity": person,
                                "distance": distance,
                                "threshold": result.get("threshold"),
                                # "confidence": result.get("confidence"),
                                "similarity_metric": result.get("similarity_metric"),
                            }
                except Exception as e:
                    # Skip any image that causes an error
                    print(f"Error comparing with {db_image}: {e}")
                    continue

        if best_match:
            return jsonify({"match": True, "best_match": best_match})
        else:
            return jsonify({"match": False})

    except Exception as e:
        print("Verification error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.route("/add-face", methods=["POST", "OPTIONS"])
def add_face():
    """Add a new face to the database"""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image uploaded"}), 400

    if "name" not in request.form:
        return jsonify({"success": False, "error": "No name provided"}), 400

    file = request.files["image"]
    name = request.form["name"].strip()

    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Invalid file type"}), 400

    if not name:
        return jsonify({"success": False, "error": "Name cannot be empty"}), 400

    # Create directory for the face
    face_dir = os.path.join(DB_PATH, secure_filename(name))
    os.makedirs(face_dir, exist_ok=True)

    try:
        # Save the image
        filename = secure_filename(f"{name}_{len(os.listdir(face_dir))}.jpg")
        filepath = os.path.join(face_dir, filename)
        file.save(filepath)

        return jsonify(
            {"success": True, "message": f"Face '{name}' added successfully"}
        )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/delete-face", methods=["POST", "OPTIONS"])
def delete_face():
    """Delete a face from the database"""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    try:
        data = request.get_json()
        name = data.get("name", "").strip()

        if not name:
            return jsonify({"success": False, "error": "No name provided"}), 400

        face_dir = os.path.join(DB_PATH, secure_filename(name))

        if not os.path.exists(face_dir):
            return jsonify({"success": False, "error": "Face not found"}), 404

        shutil.rmtree(face_dir)
        return jsonify(
            {"success": True, "message": f"Face '{name}' deleted successfully"}
        )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/get-faces", methods=["GET"])
def get_faces():
    """Get list of all faces in database"""
    try:
        if not os.path.exists(DB_PATH):
            return jsonify({"faces": []})

        faces = set()
        for root, _, files in os.walk(DB_PATH):
            for file in files:
                if allowed_file(file):
                    full_path = os.path.join(root, file)
                    faces.add(extract_identity_from_path(full_path))

        return jsonify({"faces": sorted(faces)})

    except Exception as e:
        return jsonify({"faces": [], "error": str(e)})


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get database statistics"""
    try:
        face_identities = set()
        image_count = 0

        if os.path.exists(DB_PATH):
            for root, _, files in os.walk(DB_PATH):
                for file in files:
                    if allowed_file(file):
                        image_count += 1
                        full_path = os.path.join(root, file)
                        face_identities.add(extract_identity_from_path(full_path))

        return jsonify(
            {"total_people": len(face_identities), "total_images": image_count}
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/esp32/snapshot", methods=["GET"])
def esp32_snapshot():
    camera_url = request.args.get("camera_url", "").strip()
    if not camera_url:
        return jsonify({"error": "camera_url query parameter is required"}), 400

    candidates = build_esp32_url_candidates(camera_url)
    last_error = None

    for candidate in candidates:
        try:
            print(f"[ESP32] Trying snapshot URL: {candidate}")
            image_data = fetch_esp32_image(candidate, timeout=30)
            print(f"[ESP32] Successfully fetched {len(image_data)} bytes from {candidate}")
            return Response(image_data, content_type="image/jpeg")
        except Exception as e:
            print(f"[ESP32] Candidate failed: {candidate} -> {e}")
            last_error = e

    error_message = str(last_error) if last_error else "Unknown ESP32 snapshot error"
    return jsonify({"error": f"Failed to fetch ESP32 snapshot: {error_message}"}), 500


@app.route("/esp32/test", methods=["GET"])
def esp32_test():
    """Test ESP32 connectivity"""
    camera_url = request.args.get("camera_url", "").strip()
    if not camera_url:
        return jsonify({"error": "camera_url query parameter is required"}), 400

    candidates = build_esp32_url_candidates(camera_url)
    results = []

    print(f"\n[ESP32 TEST] Testing connection to candidates: {candidates}")

    for candidate in candidates:
        try:
            response = requests.get(candidate, timeout=5, stream=True)
            status_code = response.status_code
            content_type = response.headers.get('content-type', 'unknown')
            msg = f"Status: {status_code}. Content-Type: {content_type}"
            if status_code == 405:
                msg += " (GET not allowed)"
            results.append({
                "url": candidate,
                "status_code": status_code,
                "content_type": content_type,
                "message": msg,
            })
        except requests.exceptions.Timeout:
            results.append({
                "url": candidate,
                "status_code": None,
                "content_type": None,
                "message": "Timeout",
            })
        except requests.exceptions.ConnectionError as e:
            results.append({
                "url": candidate,
                "status_code": None,
                "content_type": None,
                "message": f"Connection error: {str(e)}",
            })
        except Exception as e:
            results.append({
                "url": candidate,
                "status_code": None,
                "content_type": None,
                "message": f"Error: {str(e)}",
            })

    return jsonify({
        "success": any(r["status_code"] == 200 for r in results if r["status_code"] is not None),
        "camera_url": camera_url,
        "results": results,
    })


@app.route("/upload", methods=["POST"])
def upload_frame():
    image_data = request.data
    if not image_data:
        return jsonify({"error": "No image data received"}), 400

    content_type = request.headers.get("Content-Type", "")
    if "jpeg" not in content_type.lower() and "jpg" not in content_type.lower():
        return jsonify({"error": "Upload must be JPEG image data"}), 400

    temp_path = os.path.join(TEMP_PATH, "esp32_upload.jpg")
    try:
        with open(temp_path, "wb") as f:
            f.write(image_data)

        result = DeepFace.find(
            img_path=temp_path,
            db_path=DB_PATH,
            model_name="ArcFace",
            detector_backend="opencv",
            enforce_detection=False,
            silent=True,
        )

        if len(result) > 0 and not result[0].empty:
            best_match = result[0].iloc[0].to_dict()
            match_image_path = best_match.get("identity")
            if match_image_path:
                verify_result = DeepFace.verify(
                    img1_path=temp_path,
                    img2_path=match_image_path,
                    model_name="ArcFace",
                    detector_backend="opencv",
                    enforce_detection=False,
                    silent=True,
                )
                best_match["verified"] = verify_result.get("verified", False)
                best_match["confidence"] = verify_result.get("confidence", None)
                best_match["distance"] = verify_result.get("distance", None)
                best_match["threshold"] = verify_result.get("threshold", None)
                best_match["similarity_metric"] = verify_result.get(
                    "similarity_metric", None
                )
                best_match["identity"] = extract_identity_from_path(match_image_path)
                return jsonify(
                    {"match": best_match["verified"], "best_match": best_match}
                )

        return jsonify({"match": False})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
