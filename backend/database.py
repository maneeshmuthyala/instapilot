"""
database.py - all database code lives here.

Local development -> SQLite file (DB_PATH)
Production        -> Postgres, used automatically when DATABASE_URL is set

The functions return the same values for both databases, so app.py does not
need to know which one is in use.
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime

import config

# Columns added after the first version of the table. Used to safely upgrade
# an older SQLite file (for example the database from your Colab notebook).
_EXTRA_COLUMNS = {
    "status": "TEXT DEFAULT 'Draft'",
    "approved_at": "TIMESTAMP",
    "instagram_media_id": "TEXT",
    "published_at": "TIMESTAMP",
    "publish_error": "TEXT",
}

_INSERT_SQL = """
    INSERT INTO reel_packages
    (reel_title, reel_theme, duration, content_json)
    VALUES (?, ?, ?, ?)
"""


def _sql(query):
    """Queries are written with '?' placeholders; Postgres needs '%s'."""
    return query.replace("?", "%s") if config.USE_POSTGRES else query


@contextmanager
def get_connection():
    """Open a connection, commit on success, roll back on error, always close."""
    if config.USE_POSTGRES:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(config.DATABASE_URL, cursor_factory=RealDictCursor)
    else:
        folder = os.path.dirname(config.DB_PATH)
        if folder:
            os.makedirs(folder, exist_ok=True)
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create the reel_packages table if needed (safe to call every startup)."""
    with get_connection() as conn:
        cur = conn.cursor()

        if config.USE_POSTGRES:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS reel_packages (
                    id SERIAL PRIMARY KEY,
                    reel_title TEXT NOT NULL,
                    reel_theme TEXT,
                    duration INTEGER,
                    content_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'),
                    status TEXT DEFAULT 'Draft',
                    approved_at TIMESTAMP,
                    instagram_media_id TEXT,
                    published_at TIMESTAMP,
                    publish_error TEXT
                )
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS reel_packages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reel_title TEXT NOT NULL,
                    reel_theme TEXT,
                    duration INTEGER,
                    content_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'Draft',
                    approved_at TIMESTAMP,
                    instagram_media_id TEXT,
                    published_at TIMESTAMP,
                    publish_error TEXT
                )
            """)

            # Upgrade an older table that is missing some columns.
            cur.execute("PRAGMA table_info(reel_packages)")
            existing = [column["name"] for column in cur.fetchall()]
            for column, definition in _EXTRA_COLUMNS.items():
                if column not in existing:
                    cur.execute(
                        f"ALTER TABLE reel_packages ADD COLUMN {column} {definition}"
                    )


def check_connection():
    """Used by /api/health. Raises an exception if the database is unreachable."""
    with get_connection() as conn:
        conn.cursor().execute("SELECT 1")
    return True


def save_reel_package(reel_data, inputs):
    """Save one generated Reel package and return its new id."""
    params = (
        reel_data["reel_title"],
        inputs["reel_theme"],
        reel_data["total_duration_seconds"],
        json.dumps(reel_data, ensure_ascii=False),
    )

    with get_connection() as conn:
        cur = conn.cursor()
        if config.USE_POSTGRES:
            cur.execute(_sql(_INSERT_SQL + " RETURNING id"), params)
            reel_id = cur.fetchone()["id"]
        else:
            cur.execute(_INSERT_SQL, params)
            reel_id = cur.lastrowid

    return reel_id


def get_all_reels():
    """Return all saved Reels, newest first (content_json is already parsed)."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, reel_title, reel_theme, duration,
                   content_json, created_at, status
            FROM reel_packages
            ORDER BY id DESC
        """)
        rows = cur.fetchall()

    reels = []
    for row in rows:
        reel = dict(row)
        reel["content_json"] = json.loads(reel["content_json"])
        # SQLite gives a string already; make Postgres look the same.
        if isinstance(reel["created_at"], datetime):
            reel["created_at"] = reel["created_at"].strftime("%Y-%m-%d %H:%M:%S")
        reels.append(reel)

    return reels


def delete_reel(reel_id):
    """Delete one Reel. Returns True if it existed, False if not found."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(_sql("DELETE FROM reel_packages WHERE id = ?"), (reel_id,))
        return cur.rowcount > 0