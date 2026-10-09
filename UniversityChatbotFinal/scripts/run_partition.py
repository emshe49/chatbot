import os
import sys
import pickle
import re
from pathlib import Path

# --------------------------------------------------
# Add project root
# --------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# --------------------------------------------------
# Imports
# --------------------------------------------------
from pipeline.partition import partition_pdf_document
from pipeline.clean_text import clean_text_blocks
from pipeline.chunk_text import chunk_text_blocks
from pipeline.table_utils import table_to_text
from pipeline.table_summarizer import summarize_table

# --------------------------------------------------
# Paths
# --------------------------------------------------
PDF_ROOT = PROJECT_ROOT / "data" / "pdf"
CACHE_ROOT = PROJECT_ROOT / "data" / "cache"

# --------------------------------------------------
# Pickle helpers
# --------------------------------------------------
def load_pkl(path: Path):
    if path.exists():
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


def save_pkl(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(data, f)

# --------------------------------------------------
# DATASET CONTEXT
# --------------------------------------------------
def get_dataset_context(folder_path: Path):
    name = folder_path.name.lower()

    if "staffs" in name:
        return {"dataset": "staffs", "role": "staffs"}

    if "ug" in name:
        batch = re.findall(r"\d{4}", name)
        return {
            "dataset": "ug",
            "level": "undergraduate",
            "batch": batch[0] if batch else "unknown"
        }

    if "pg" in name:
        batch = re.findall(r"\d{4}", name)
        return {
            "dataset": "pg",
            "level": "postgraduate",
            "batch": batch[0] if batch else "unknown"
        }

    return {"dataset": "unknown"}

# --------------------------------------------------
# FINAL CLEANING
# --------------------------------------------------
MIN_LENGTH = 80

def is_garbage(text: str) -> bool:
    if len(re.findall(r"[A-Za-z]", text)) < 30:
        return True

    symbol_count = len(re.findall(r"[©®#\[\]{}<>|]", text))

    if symbol_count > len(text) * 0.25:
        return True
    return False


def final_clean_chunks(chunks):
    cleaned = []
    seen = set()

    for item in chunks:
        text = item.get("content", "").strip()
        if not text or len(text) < MIN_LENGTH:
            continue
        if is_garbage(text):
            continue

        key = re.sub(r"\s+", " ", text.lower())
        if key in seen:
            continue

        seen.add(key)
        cleaned.append(item)

    print(f"   ✅ Final cleaned chunks: {len(cleaned)}")
    return cleaned

# --------------------------------------------------
# 🔥 SINGLE PDF PIPELINE (USED BY ORCHESTRATOR)
# --------------------------------------------------
def run_for_pdf(pdf_path: Path):

    folder_path = pdf_path.parent
    pdf_name = pdf_path.stem

    pdf_cache_dir = CACHE_ROOT / folder_path.name / pdf_name
    pdf_cache_dir.mkdir(parents=True, exist_ok=True)

    partition_cache = pdf_cache_dir / "partition.pkl"
    table_cache = pdf_cache_dir / "table_summaries.pkl"
    chunks_cache = pdf_cache_dir / "chunks.pkl"

    # 1️⃣ Partition
    result = load_pkl(partition_cache)
    if not result:
        result = partition_pdf_document(str(pdf_path))
        save_pkl(partition_cache, result)

    # 2️⃣ Clean text
    cleaned_text_blocks = clean_text_blocks(result["text"])

    base_metadata = {
        **get_dataset_context(folder_path),
        "source_file": pdf_path.name
    }

    # 3️⃣ Chunk text
    text_documents = chunk_text_blocks(
        cleaned_text_blocks,
        base_metadata=base_metadata
    )

    # 4️⃣ Tables
    table_summaries = load_pkl(table_cache)
    if not table_summaries:
        table_summaries = []
        for table in result.get("tables", []):
            summary = summarize_table(table_to_text(table))
            if summary:
                table_summaries.append(summary)
        save_pkl(table_cache, table_summaries)

    # 5️⃣ Combine
    all_chunks = []

    for doc in text_documents:
        all_chunks.append({
            "content": doc.page_content,
            "metadata": doc.metadata
        })

    for summary in table_summaries:
        all_chunks.append({
            "content": summary,
            "metadata": base_metadata
        })

    all_chunks = final_clean_chunks(all_chunks)
    save_pkl(chunks_cache, all_chunks)

    print(f"✅ Chunks saved → {chunks_cache}")
    return chunks_cache


# --------------------------------------------------
# OLD FUNCTION (OPTIONAL MANUAL USE)
# --------------------------------------------------
def run_for_folder(folder_path: Path):
    for file in os.listdir(folder_path):
        if file.lower().endswith(".pdf"):
            run_for_pdf(folder_path / file)
