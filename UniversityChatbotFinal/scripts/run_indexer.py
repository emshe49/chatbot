import os
import sys
import pickle
import hashlib
import json
from pathlib import Path
from tqdm import tqdm

# --------------------------------------------------
# Project root
# --------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.embedder import embed_texts
from pipeline.pinecone_index import PineconeClient

REGISTRY_PATH = PROJECT_ROOT / "data" / "index_registry.json"


# --------------------------------------------------
# REGISTRY HELPERS
# --------------------------------------------------
def load_registry():
    if not REGISTRY_PATH.exists():
        return {}
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_registry(registry):
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)


def hash_chunks(chunks):
    h = hashlib.md5()
    for c in chunks:
        h.update(c["content"].encode("utf-8"))
    return h.hexdigest()


def generate_vector_id(namespace, doc, idx, h):
    return f"{namespace}-{doc[:30]}-{idx}-{h[:6]}"


# ==================================================
# ✅ NEW: INDEX A SINGLE chunks.pkl FILE (USED BY ORCHESTRATOR)
# ==================================================
def index_chunks_file(chunks_pkl_path, fixed_namespace=None):
    """
    Index a single chunks.pkl file (one PDF only)
    """
    chunks_pkl_path = Path(chunks_pkl_path)

    if not chunks_pkl_path.exists():
        raise FileNotFoundError(f"chunks.pkl not found: {chunks_pkl_path}")

    pc = PineconeClient()
    registry = load_registry()

    doc_name = chunks_pkl_path.parent.name
    namespace = fixed_namespace if fixed_namespace else doc_name
    registry_key = f"{namespace}/{doc_name}"

    with open(chunks_pkl_path, "rb") as f:
        chunks = pickle.load(f)

    if not chunks:
        print(f"⚠️ Empty chunks → {doc_name}")
        return

    chunk_hash = hash_chunks(chunks)

    # ✅ DUPLICATE CHECK (CRITICAL FIX)
    if registry.get(registry_key) == chunk_hash:
        print(f"⏩ Already indexed → {doc_name}")
        return

    print(f"\n🆕 Indexing → {doc_name} ({namespace})")

    texts = [c["content"] for c in chunks]
    embeddings = embed_texts(texts)

    vectors = []
    for i, emb in enumerate(embeddings):
        meta = chunks[i].get("metadata", {}).copy()
        meta.update({
            "source_file": doc_name,
            "doc_hash": chunk_hash,
            "text": chunks[i]["content"]
        })

        vectors.append({
            "id": generate_vector_id(namespace, doc_name, i, chunk_hash),
            "values": emb,
            "metadata": meta
        })

    for i in tqdm(range(0, len(vectors), 50), desc="Upserting"):
        pc.upsert(vectors[i:i + 50], namespace=namespace)

    registry[registry_key] = chunk_hash
    save_registry(registry)

    print(f"✅ Indexed {len(vectors)} chunks from {doc_name}")


# ==================================================
# 🔁 OLD FUNCTION (KEPT FOR BACKWARD COMPATIBILITY)
# ==================================================
def index_folder(base_folder, fixed_namespace=None):
    """
    Index ALL chunks.pkl files inside a folder (legacy / batch mode)
    """
    base_folder = Path(base_folder)

    for root, _, files in os.walk(base_folder):
        if "chunks.pkl" not in files:
            continue

        index_chunks_file(
            Path(root) / "chunks.pkl",
            fixed_namespace=fixed_namespace
        )


# --------------------------------------------------
# RUN (OPTIONAL: for manual batch indexing)
# --------------------------------------------------
if __name__ == "__main__":

    # Staff → single namespace
    index_folder("data/cache/staffData", fixed_namespace="staff")

    # UG / PG → per-document namespace
    # index_folder("data/cache/ug")
    # index_folder("data/cache/pg")
