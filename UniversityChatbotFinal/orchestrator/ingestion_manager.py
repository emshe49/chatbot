import sys
import shutil
from pathlib import Path
import traceback

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.stdout.reconfigure(encoding='utf-8')

from scripts.run_partition import run_for_pdf
from scripts.run_indexer import index_chunks_file

PDF_ROOT = PROJECT_ROOT / "data" / "pdf"

DATASET_CONFIG = {
    "staff": {
        "pdf_folder": PDF_ROOT / "staffData",
        "namespace": "staffs"
    },
    "ug": {
        "pdf_folder": PDF_ROOT / "ug",
        "namespace": None
    },
    "pg": {
        "pdf_folder": PDF_ROOT / "pg",
        "namespace": None
    },
    "notification":{
        "pdf_folder": PDF_ROOT / "notification",
        "namespace": "Notification"
    }
}

def emit(progress: int, message: str):
    print(f"PROGRESS::{progress}::{message}", flush=True)

def process_uploaded_pdf(pdf_path: str, dataset_type: str):
    try:
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError("PDF not found")

        if dataset_type not in DATASET_CONFIG:
            raise ValueError("Dataset must be: staff | ug | pg | notification")

        config = DATASET_CONFIG[dataset_type]
        target_folder = config["pdf_folder"]
        target_folder.mkdir(parents=True, exist_ok=True)

        # 1️⃣ Store PDF
        emit(10, "Storing PDF...")
        stored_pdf = target_folder / pdf_path.name
        shutil.copy(pdf_path, stored_pdf)
        emit(20, f"PDF stored as {stored_pdf.name}")

        # 2️⃣ Partition
        emit(35, "Extracting & partitioning text...")
        chunks_path = run_for_pdf(stored_pdf)
        emit(55, f"Partition complete → {chunks_path.name}")

        # 3️⃣ Index
        emit(70, "Generating embeddings & indexing...")
        index_chunks_file(
            chunks_path,
            fixed_namespace=config["namespace"]
        )
        emit(90, "Chunks indexed in vector database")

        # 4️⃣ Done
        emit(100, "Ingestion completed successfully ✅")

    except Exception:
        emit(0, "Ingestion failed ❌")
        traceback.print_exc()
        raise
