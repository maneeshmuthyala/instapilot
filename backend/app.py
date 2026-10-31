"""
app.py - InstaPilot AI Flask backend.

Routes (same requests and responses as the Colab version):
  GET    /api/health            no token needed
  POST   /api/generate          needs X-API-Token
  GET    /api/history           needs X-API-Token
  DELETE /api/reel/<reel_id>    needs X-API-Token

Run locally:      python backend/app.py
Run on Render:    gunicorn app:app --workers 1 --threads 4 --timeout 300
"""

import asyncio
import secrets
import threading
from concurrent.futures import ThreadPoolExecutor
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS

import config
import database
from tasks import reel_crew

# Stop early, with a clear message, if a required setting is missing.
config.validate_config()

# Create the database table if it does not exist yet.
database.init_db()

app = Flask(__name__)

# Only the frontend origins listed in CORS_ORIGINS may call the API from a browser.
CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS}})

# The crew's task objects keep their results after a run, so only one
# generation may run at a time.
_generation_lock = threading.Lock()


# --- Authentication ---
def require_api_token(view_function):
    @wraps(view_function)
    def wrapper(*args, **kwargs):
        supplied_token = request.headers.get("X-API-Token", "")

        if not secrets.compare_digest(
            supplied_token.encode("utf-8"), config.API_TOKEN.encode("utf-8")
        ):
            return jsonify({
                "status": "error",
                "message": "Unauthorized request"
            }), 401

        return view_function(*args, **kwargs)

    return wrapper


# --- CrewAI execution helper (same approach as the notebook) ---
def execute_crew(inputs):
    return asyncio.run(
        reel_crew.kickoff_async(inputs=inputs)
    )


# 1. Health API
@app.route("/api/health", methods=["GET"])
def health_check():
    try:
        database.check_connection()

        return jsonify({
            "status": "success",
            "message": "InstaPilot backend is running!",
            "database": "Connected"
        }), 200

    except Exception:
        app.logger.exception("Health check failed")
        return jsonify({
            "status": "error",
            "message": "Database connection failed"
        }), 500


# 2. Reel generation API
@app.route("/api/generate", methods=["POST"])
@require_api_token
def generate_reel_api():
    try:
        data = request.get_json(silent=True) or {}

        required_fields = [
            "reel_theme",
            "target_audience",
            "duration_seconds",
            "content_goal"
        ]

        missing = [
            field for field in required_fields
            if field not in data
        ]

        if missing:
            return jsonify({
                "status": "error",
                "message": "Missing required fields",
                "missing_fields": missing
            }), 400

        inputs = {
            "reel_theme": str(data["reel_theme"]).strip(),
            "target_audience": str(data["target_audience"]).strip(),
            "duration_seconds": int(data["duration_seconds"]),
            "content_goal": str(data["content_goal"]).strip()
        }

        if (
            not inputs["reel_theme"]
            or not inputs["target_audience"]
            or not inputs["content_goal"]
            or inputs["duration_seconds"] <= 0
        ):
            return jsonify({
                "status": "error",
                "message": "Invalid Reel requirements"
            }), 400

        with _generation_lock:
            with ThreadPoolExecutor(max_workers=1) as executor:
                result = executor.submit(
                    execute_crew, inputs
                ).result()

        if result.pydantic is None:
            raise ValueError("Structured Reel output is missing")

        reel_data = result.pydantic.model_dump()

        reel_id = database.save_reel_package(reel_data, inputs)

        return jsonify({
            "status": "success",
            "message": "Reel generated successfully!",
            "reel_id": reel_id,
            "reel": reel_data
        }), 201

    except (ValueError, TypeError) as e:
        app.logger.exception("Reel generation rejected")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

    except Exception as e:
        app.logger.exception("Reel generation failed")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# 3. History API
@app.route("/api/history", methods=["GET"])
@require_api_token
def get_reel_history_api():
    try:
        reels = database.get_all_reels()

        return jsonify({
            "status": "success",
            "total": len(reels),
            "reels": reels
        }), 200

    except Exception as e:
        app.logger.exception("History failed")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# 4. Delete Reel API
@app.route("/api/reel/<int:reel_id>", methods=["DELETE"])
@require_api_token
def delete_reel_api(reel_id):
    try:
        deleted = database.delete_reel(reel_id)

        if not deleted:
            return jsonify({
                "status": "error",
                "message": "Reel not found"
            }), 404

        return jsonify({
            "status": "success",
            "message": "Reel deleted successfully!",
            "reel_id": reel_id
        }), 200

    except Exception as e:
        app.logger.exception("Delete failed")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


if __name__ == "__main__":
    # Local development only. On Render, Gunicorn starts the app instead.
    app.run(host="127.0.0.1", port=config.PORT, debug=config.DEBUG)