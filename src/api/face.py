"""Face API routes consumed by the frontend dashboard."""

import logging
import os

from flask import Blueprint, jsonify, request

logger = logging.getLogger("face_api")


def create_face_blueprint(face_verification_service, device_control_service):
    face_bp = Blueprint("face", __name__)

    @face_bp.route("/get-faces", methods=["GET"])
    def list_faces():
        return jsonify({"faces": face_verification_service.list_faces()})

    @face_bp.route("/add-face", methods=["POST"])
    def add_face():
        if "image" not in request.files or "name" not in request.form:
            return jsonify({"error": "Missing image or name"}), 400
        file = request.files["image"]
        name = request.form["name"].strip()
        if not name or file.filename == "":
            return jsonify({"error": "Invalid name or file"}), 400
        tmp_path = face_verification_service.save_upload_to_temp(file)
        try:
            if not face_verification_service.has_face(tmp_path):
                return jsonify({"error": "No face detected in uploaded image"}), 400
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        file.seek(0)
        face_verification_service.add_face(name, file)
        logger.info("Added face for '%s'", name)
        return jsonify({"success": True, "message": f"Face '{name}' added"})

    @face_bp.route("/add-host-face", methods=["POST"])
    def add_host_face():
        if "image" not in request.files:
            return jsonify({"error": "Missing image"}), 400
        file = request.files["image"]
        name = request.form.get("name", "").strip()
        if file.filename == "":
            return jsonify({"error": "Empty file"}), 400
        tmp_path = face_verification_service.save_upload_to_temp(file)
        try:
            if not face_verification_service.has_face(tmp_path):
                return jsonify({"error": "No face detected in uploaded image"}), 400
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        file.seek(0)
        filepath = face_verification_service.add_host_face(file, name=name or None)
        logger.info("Added host face '%s' at %s", name or "Hosts", filepath)
        return jsonify(
            {
                "success": True,
                "identity": "Hosts",
                "name": name or "Hosts",
                "path": filepath,
                "message": "Host face added",
            }
        )

    @face_bp.route("/delete-face", methods=["POST"])
    def remove_face():
        data = request.get_json()
        name = (data or {}).get("name", "").strip()
        if not name:
            return jsonify({"error": "No name provided"}), 400
        face_verification_service.delete_face(name)
        logger.info("Deleted face for '%s'", name)
        return jsonify({"success": True})

    @face_bp.route("/verify-face", methods=["POST"])
    def verify_face():
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400
        file = request.files["image"]
        if file.filename == "":
            return jsonify({"error": "Empty file"}), 400

        try:
            recognition = face_verification_service.classify_uploaded_host_image(file)
            result = face_verification_service.verification_response(recognition)
            if not result["match"]:
                logger.info("verify-face: no match found")
                return jsonify(
                    {
                        "match": False,
                        "classification": result.get("classification"),
                    }
                )
            best_match = result["best_match"]
            logger.info(
                "verify-face: matched '%s' distance=%.4f",
                best_match["identity"],
                best_match["distance"],
            )
            action = device_control_service.handle_recognition_result(recognition)
            return jsonify(
                {
                    "match": True,
                    "best_match": best_match,
                    "classification": result.get("classification"),
                    "action": action.to_dict(),
                }
            )
        except Exception as e:
            logger.exception("verify-face failed")
            return jsonify({"error": str(e)}), 500

    return face_bp
