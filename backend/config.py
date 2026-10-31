"""
config.py - the single place where all settings are read.

Values come from environment variables:
  - locally: from the file backend/.env (never committed to GitHub)
  - on Render: from the dashboard's Environment tab
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Loads backend/.env if it exists. Real environment variables (e.g. on Render)
# are NOT overwritten by this.
load_dotenv(BASE_DIR / ".env")


def _clean(value):
    """Return a stripped string, or '' if the variable is missing."""
    return (value or "").strip()


# --- Secrets (no defaults on purpose) ---
GEMINI_API_KEY = _clean(os.getenv("GEMINI_API_KEY"))
API_TOKEN = _clean(os.getenv("API_TOKEN"))

# --- Gemini model (default is the model used in the notebook) ---
GEMINI_MODEL = _clean(os.getenv("GEMINI_MODEL")) or "gemini-3.5-flash-lite"

# --- Database ---
# If DATABASE_URL is set (production Postgres), it is used.
# Otherwise a local SQLite file is used (local development).
DATABASE_URL = _clean(os.getenv("DATABASE_URL"))
DB_PATH = _clean(os.getenv("DB_PATH")) or str(BASE_DIR / "instapilot.db")
USE_POSTGRES = bool(DATABASE_URL)

# --- CORS: comma-separated list of frontend origins allowed to call the API ---
_default_origins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in (_clean(os.getenv("CORS_ORIGINS")) or _default_origins).split(",")
    if origin.strip()
]

# --- Server ---
PORT = int(_clean(os.getenv("PORT")) or "5000")
DEBUG = _clean(os.getenv("FLASK_DEBUG")) == "1"


def missing_required():
    """Names of required settings that are not set."""
    required = {"GEMINI_API_KEY": GEMINI_API_KEY, "API_TOKEN": API_TOKEN}
    return [name for name, value in required.items() if not value]


def validate_config():
    """Called once at startup by app.py. Stops early with a clear message."""
    missing = missing_required()
    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
            + ". Set them in backend/.env (local) or in the Render dashboard."
        )