# pipeline/notification_pipeline/chunk_notifications.py
# PRODUCTION READY – INCREMENTAL CLEAN + CHUNK + METADATA STRUCTURE

import json
import os
import re

# ===============================
# PATHS
# ===============================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

RAW_FILE = os.path.join(
    BASE_DIR,
    "data",
    "notifications",
    "raw",
    "scraped_notifications.json"
)

PROCESSED_DIR = os.path.join(
    BASE_DIR,
    "data",
    "notifications",
    "processed"
)

PROCESSED_FILE = os.path.join(
    PROCESSED_DIR,
    "notifications_chunks.json"
)

os.makedirs(PROCESSED_DIR, exist_ok=True)

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

    stop_phrases = [
        "University of Engineering & Technology Mardan",
        "Charsadda Road",
        "read more...",
    ]

    for phrase in stop_phrases:
        if phrase in text:
            text = text.split(phrase)[0]

    text = re.sub(r"\n\s*\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()

# ===============================
# SMART CHUNKING WITH OVERLAP
# ===============================

def chunk_text(text, chunk_size=400, overlap=80):
    words = text.split()
    chunks = []

    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunk = " ".join(chunk_words)
        chunks.append(chunk)

        start += chunk_size - overlap

    return chunks

# ===============================
# DATE EXTRACTION
# ===============================

def extract_date(text):
    pattern = r"\b\d{1,2}(st|nd|rd|th)?\s+\w+,\s+\d{4}"
    match = re.search(pattern, text)
    if match:
        return match.group()
    return None

# ===============================
# MAIN PROCESSING (INCREMENTAL)
# ===============================

def run_chunking():

    print("\n========== INCREMENTAL CHUNKING ==========")

    if not os.path.exists(RAW_FILE):
        print("Raw file not found.")
        return

    with open(RAW_FILE, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    print("Loaded raw notifications:", len(raw_data))

    # Load existing chunks
    existing_chunks = load_existing_chunks()
    print("Already existing chunks:", len(existing_chunks))

    # Collect already processed notification IDs
    already_processed_ids = set(
        chunk["source_id"] for chunk in existing_chunks
    )

    print("Already processed notifications:", len(already_processed_ids))

    new_chunks = []

    for item in raw_data:

        # ✅ SKIP if already chunked
        if item["id"] in already_processed_ids:
            continue

        cleaned_content = clean_notification_content(item["content"])

        if not cleaned_content or len(cleaned_content) < 50:
            continue

        chunks = chunk_text(cleaned_content)
        extracted_date = extract_date(cleaned_content)

        print(f"Chunking NEW notification: {item['title']}")

        for i, chunk in enumerate(chunks):

            chunk_object = {
                "chunk_id": f"{item['id']}_chunk_{i+1}",
                "source_id": item["id"],
                "type": item["type"],
                "title": item["title"],
                "text": chunk,
                "metadata": {
                    "category": "notification",
                    "notification_type": item["type"],
                    "title": item["title"],
                    "url": item["link"],
                    "date": extracted_date
                }
            }

            new_chunks.append(chunk_object)

    # ===============================
    # SAVE ONLY IF NEW CHUNKS CREATED
    # ===============================

    if new_chunks:
        updated_chunks = existing_chunks + new_chunks

        with open(PROCESSED_FILE, "w", encoding="utf-8") as f:
            json.dump(updated_chunks, f, ensure_ascii=False, indent=4)

        print("\nNew chunks added:", len(new_chunks))
        print("Total chunks now:", len(updated_chunks))
        print("Saved to:", PROCESSED_FILE)

    else:
        print("\nNo new notifications to chunk. File unchanged.")


if __name__ == "__main__":
    run_chunking()