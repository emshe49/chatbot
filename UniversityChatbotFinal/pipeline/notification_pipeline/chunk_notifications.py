# pipeline/notification_pipeline/chunk_notifications.py
# FINAL FIXED VERSION – DATE SAFE + INCREMENTAL + PRODUCTION READY

import json
import os
import re

# ===============================
# PATHS
# ===============================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

SCRIPTS_OUTPUT = os.path.join(BASE_DIR, "scripts", "output")

EVENTS_FILE = os.path.join(SCRIPTS_OUTPUT, "events.json")
NEWS_FILE = os.path.join(SCRIPTS_OUTPUT, "news.json")

PROCESSED_DIR = os.path.join(BASE_DIR, "data", "notifications", "processed")
PROCESSED_FILE = os.path.join(PROCESSED_DIR, "notifications_chunks.json")

# ===============================
# LOAD RAW DATA
# ===============================

def load_raw_data():
    data = []

    for file_path in [EVENTS_FILE, NEWS_FILE]:
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                try:
                    items = json.load(f)
                    print(f"Loaded {len(items)} from {os.path.basename(file_path)}")
                    data.extend(items)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    return data

# ===============================
# LOAD EXISTING CHUNKS
# ===============================

def load_existing_chunks():
    if os.path.exists(PROCESSED_FILE):
        with open(PROCESSED_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

# ===============================
# CLEAN CONTENT
# ===============================

def clean_notification_content(text):
    if not text:
        return ""

    stop_phrases = [
        "University of Engineering & Technology Mardan",
        "Charsadda Road",
        "read more..."
    ]

    for phrase in stop_phrases:
        text = text.split(phrase)[0] if phrase in text else text

    text = re.sub(r"\n\s*\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()

# ===============================
# CHUNKING
# ===============================

def chunk_text(text, chunk_size=400, overlap=80):
    words = text.split()
    chunks = []

    start = 0
    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        start += chunk_size - overlap

    return chunks

# ===============================
# DATE EXTRACTION (FALLBACK ONLY)
# ===============================

def extract_date(text):
    pattern = r"\b\d{1,2}(st|nd|rd|th)?\s+\w+,\s+\d{4}"
    match = re.search(pattern, text)
    return match.group() if match else None

# ===============================
# MAIN
# ===============================

def run_chunking():

    print("\n========== INCREMENTAL CHUNKING ==========")

    raw_data = load_raw_data()

    if not raw_data:
        print("No raw data found.")
        return

    print("Total notifications:", len(raw_data))

    existing_chunks = load_existing_chunks()

    already_processed = set(
        chunk["source_id"] for chunk in existing_chunks
    )

    print("Already processed:", len(already_processed))

    new_chunks = []

    for item in raw_data:

        # ===============================
        # SKIP OLD
        # ===============================
        if item["id"] in already_processed:
            continue

        content = clean_notification_content(item.get("content", ""))

        if not content or len(content) < 50:
            continue

        # ===============================
        # ✅ FIXED DATE LOGIC (IMPORTANT)
        # ===============================
        extracted_date = item.get("date") or extract_date(content)

        chunks = chunk_text(content)

        print(f"Chunking NEW: {item['title']}")

        for i, chunk in enumerate(chunks):

            new_chunks.append({
                "chunk_id": f"{item['id']}_chunk_{i+1}",
                "source_id": item["id"],
                "type": item["type"],
                "title": item["title"],
                "text": chunk,
                "metadata": {
                    "category": "notification",
                    "notification_type": item["type"],
                    "title": item["title"],
                    "url": item.get("link", ""),
                    "date": extracted_date if extracted_date else "",
                    "source":item.get("source","")
                }
            })

    # ===============================
    # SAVE
    # ===============================
    if new_chunks:
        updated = existing_chunks + new_chunks

        with open(PROCESSED_FILE, "w", encoding="utf-8") as f:
            json.dump(updated, f, ensure_ascii=False, indent=4)

        print("\nNew chunks:", len(new_chunks))
        print("Total chunks:", len(updated))
        print("Saved to:", PROCESSED_FILE)

    else:
        print("\nNo new data to chunk.")

# ===============================
# RUN
# ===============================

if __name__ == "__main__":
    run_chunking()