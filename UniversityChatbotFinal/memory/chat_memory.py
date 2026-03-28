import json
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
HISTORY_DIR = os.path.join(BASE_DIR, "data", "chat_history")

os.makedirs(HISTORY_DIR, exist_ok=True)

_current_session = None


def _session_path(session_id):
    return os.path.join(HISTORY_DIR, f"{session_id}.json")


def create_new_session():
    global _current_session
    session_id = datetime.now().strftime("session_%Y-%m-%d_%H-%M-%S")
    _current_session = session_id
    save_history(session_id, [])
    return session_id


def get_current_session():
    return _current_session


def switch_session(session_id):
    global _current_session
    path = _session_path(session_id)
    if not os.path.exists(path):
        raise ValueError("Session does not exist")
    _current_session = session_id


def list_sessions():
    return sorted(
        f.replace(".json", "")
        for f in os.listdir(HISTORY_DIR)
        if f.endswith(".json")
    )


def load_history(session_id):
    path = _session_path(session_id)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_history(session_id, history):
    path = _session_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def save_message(role, message, session_id):
    history = load_history(session_id)
    history.append({
        "role": role,
        "message": message,
        "timestamp": datetime.now().isoformat()
    })
    save_history(session_id, history)
