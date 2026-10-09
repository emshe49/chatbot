# pipeline/notification_pipeline/chunk_notifications.py
import json
import os
import re

# ===============================
# PATHS
# ===============================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Potential raw data locations
RAW_DIRS = [
    os.path.join(SCRIPT_DIR, "output"),
    os.path.join(BASE_DIR, "data", "notifications", "raw"),
    os.path.join(BASE_DIR, "data")
]

PROCESSED_DIR = os.path.join(BASE_DIR, "data", "notifications", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)
PROCESSED_FILE = os.path.join(PROCESSED_DIR, "notifications_chunks.json")

# ===============================
# LOAD RAW DATA
# ===============================
def load_raw_data():
    items_by_link = {}

    for directory in RAW_DIRS:
        if not os.path.exists(directory):
            continue

        for filename in ["events.json", "news.json"]:
            filepath = os.path.join(directory, filename)
            if not os.path.exists(filepath):
                continue

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    entries = json.load(f)
                    for item in entries:
                        link = item.get("link")
                        if link and (link not in items_by_link or len(item.get("content", "")) > len(items_by_link[link].get("content", ""))):
                            items_by_link[link] = item
            except Exception as e:
                print(f"Error reading {filepath}: {e}", flush=True)

    print(f"Loaded {len(items_by_link)} unique raw notification records.", flush=True)
    return list(items_by_link.values())

# ===============================
# LOAD EXISTING CHUNKS
# ===============================
def load_existing_chunks():
    if os.path.exists(PROCESSED_FILE):
        try:
            with open(PROCESSED_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
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
        if phrase in text:
            text = text.split(phrase)[0]

    text = re.sub(r"\n\s*\n+", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()

# ===============================
# CHUNKING
# ===============================
def chunk_text(text, chunk_size=350, overlap=60):
    words = text.split()
    if not words:
        return []

    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        start += chunk_size - overlap
        if start >= len(words) or end >= len(words):
            break

    return chunks

# ===============================
# DATE EXTRACTION
# ===============================
def extract_date(text):
    if not text:
        return ""
    pattern = r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{4}\b"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(0) if match else ""

# ===============================
# RUN CHUNKING
# ===============================
def run_chunking():
    print("\n========== INCREMENTAL CHUNKING ==========", flush=True)
    print("PROGRESS: 55", flush=True)

    raw_data = load_raw_data()
    if not raw_data:
        print("No raw notification data found to chunk.", flush=True)
        return 0

    existing_chunks = load_existing_chunks()
    already_processed_ids = set(c.get("source_id") for c in existing_chunks if c.get("source_id"))

    print(f"Total raw items: {len(raw_data)} | Already chunked: {len(already_processed_ids)}", flush=True)

    new_chunks = []

    for item in raw_data:
        source_id = item.get("id") or str(item.get("link", ""))
        if not source_id or source_id in already_processed_ids:
            continue

        raw_content = item.get("content") or item.get("description") or ""
        clean_content = clean_notification_content(raw_content)

        if not clean_content or len(clean_content) < 30:
            continue

        title = item.get("title", "UET Mardan Notice")
        link = item.get("link", "")
        item_type = item.get("type", "news")
        extracted_date = item.get("date") or extract_date(raw_content)

        text_splits = chunk_text(clean_content)
        if not text_splits:
            text_splits = [clean_content]

        for i, split in enumerate(text_splits):
            chunk_unique_id = f"{source_id}_chunk_{i+1}"

            # Format enriched text so the RAG context retrieved by the LLM always contains the direct link!
            formatted_text = (
                f"Announcement: {title}\n"
                f"Type: {item_type.capitalize()}\n"
                f"Date: {extracted_date}\n"
                f"Official Link: {link}\n\n"
                f"Details:\n{split}"
            )

            new_chunks.append({
                "chunk_id": chunk_unique_id,
                "source_id": source_id,
                "type": item_type,
                "title": title,
                "text": formatted_text,
                "metadata": {
                    "category": "notification",
                    "notification_type": item_type,
                    "title": title,
                    "url": link,
                    "date": extracted_date,
                    "source": item.get("source", "uetm_live")
                }
            })

    if new_chunks:
        updated_chunks = existing_chunks + new_chunks
        with open(PROCESSED_FILE, "w", encoding="utf-8") as f:
            json.dump(updated_chunks, f, ensure_ascii=False, indent=4)

        print(f"Generated {len(new_chunks)} new chunks. Total library chunks: {len(updated_chunks)}", flush=True)
    else:
        print("All raw notifications are up to date in chunk library.", flush=True)

    print("PROGRESS: 70", flush=True)
    return len(new_chunks)

if __name__ == "__main__":
    count = run_chunking()
    print(f"Chunking finished with {count} new chunks.")