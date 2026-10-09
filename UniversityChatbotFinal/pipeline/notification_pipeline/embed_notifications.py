# pipeline/notification_pipeline/embed_notifications.py
import json
import os
import sys
from tqdm import tqdm
from pipeline.embedder import embed_texts
from pipeline.pinecone_index import PineconeClient

# ===============================
# PATHS
# ===============================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROCESSED_FILE = os.path.join(
    BASE_DIR,
    "data",
    "notifications",
    "processed",
    "notifications_chunks.json"
)

NAMESPACE = "Notification"

# ===============================
# HELPER FUNCTION TO CLEAN METADATA
# ===============================
def sanitize_metadata(meta: dict) -> dict:
    clean_meta = {}
    for k, v in meta.items():
        if v is None:
            clean_meta[k] = ""
        elif isinstance(v, (str, bool, int, float)):
            clean_meta[k] = v
        elif isinstance(v, list):
            clean_meta[k] = [str(x) for x in v if x is not None]
        else:
            clean_meta[k] = str(v)
    return clean_meta

# ===============================
# INCREMENTAL EMBEDDING FUNCTION
# ===============================
def run_embedding():
    print("\n========== INCREMENTAL EMBEDDING ==========", flush=True)
    print("PROGRESS: 75", flush=True)

    if not os.path.exists(PROCESSED_FILE):
        print("Processed chunks file not found. Run chunking first.", flush=True)
        return 0

    try:
        with open(PROCESSED_FILE, "r", encoding="utf-8") as f:
            chunks = json.load(f)
    except Exception as e:
        print(f"Error loading {PROCESSED_FILE}: {e}", flush=True)
        return 0

    if not chunks:
        print("No chunks found to embed.", flush=True)
        return 0

    print(f"Total chunks in library: {len(chunks)}", flush=True)

    pc = PineconeClient()

    # Fast ID existence check via fetch in batches of 100
    existing_ids = set()
    print("Verifying vector state in Pinecone...", flush=True)

    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        chunk_batch = chunks[i:i + batch_size]
        id_batch = [c["chunk_id"] for c in chunk_batch if c.get("chunk_id")]
        try:
            fetch_res = pc.index.fetch(ids=id_batch, namespace=NAMESPACE)
            found = set(fetch_res.get("vectors", {}).keys())
            existing_ids.update(found)
        except Exception as e:
            # If fetch fails, proceed conservatively
            print(f"Batch fetch notice: {e}", flush=True)

    new_chunks = [c for c in chunks if c.get("chunk_id") not in existing_ids]

    if not new_chunks:
        print("All chunks are already embedded in Pinecone index.", flush=True)
        print("PROGRESS: 95", flush=True)
        return 0

    print(f"New chunks to embed and upsert: {len(new_chunks)}", flush=True)
    print("PROGRESS: 80", flush=True)

    # Embed and upsert in batches of 50
    upsert_batch_size = 50
    total_upserted = 0

    for i in range(0, len(new_chunks), upsert_batch_size):
        sub_batch = new_chunks[i:i + upsert_batch_size]
        texts = [c["text"] for c in sub_batch]

        print(f"Generating embeddings for batch {i // upsert_batch_size + 1} ({len(texts)} chunks)...", flush=True)
        embeddings = embed_texts(texts)

        vectors = []
        for j, emb in enumerate(embeddings):
            meta = sanitize_metadata(sub_batch[j].get("metadata", {}))
            meta["text"] = sub_batch[j]["text"]
            meta["chunk_id"] = sub_batch[j]["chunk_id"]
            meta["title"] = sub_batch[j].get("title", "")
            meta["url"] = sub_batch[j].get("metadata", {}).get("url", "")
            meta["date"] = sub_batch[j].get("metadata", {}).get("date", "")

            vectors.append({
                "id": sub_batch[j]["chunk_id"],
                "values": emb,
                "metadata": meta
            })

        pc.upsert(vectors=vectors, namespace=NAMESPACE)
        total_upserted += len(vectors)
        pct = 80 + int((total_upserted / len(new_chunks)) * 15)
        print(f"PROGRESS: {pct}", flush=True)

    print(f"✅ Successfully upserted {total_upserted} vectors to Pinecone namespace '{NAMESPACE}'.", flush=True)
    print("PROGRESS: 95", flush=True)
    return total_upserted

if __name__ == "__main__":
    count = run_embedding()
    print(f"Embedding finished with {count} upserted vectors.")