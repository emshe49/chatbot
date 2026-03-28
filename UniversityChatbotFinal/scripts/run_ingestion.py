# --------------------------------------------------
# ORCHESTRATION ENTRY SCRIPT
# --------------------------------------------------

import sys
from pathlib import Path

# --------------------------------------------------
# Fix Python path
# --------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.stdout.reconfigure(encoding="utf-8")

# --------------------------------------------------
# Import manager
# --------------------------------------------------
from orchestrator.ingestion_manager import process_uploaded_pdf

# --------------------------------------------------
# CLI ENTRY POINT
# --------------------------------------------------
if __name__ == "__main__":

    if len(sys.argv) < 3:
        print("PROGRESS::0::Missing arguments")
        sys.exit(1)

    pdf_path = sys.argv[1]
    dataset_type = sys.argv[2]

    try:
        process_uploaded_pdf(pdf_path, dataset_type)
        print("DONE")
        sys.stdout.flush()
    except Exception as e:
        print("PROGRESS::0::Ingestion failed ❌")
        sys.stdout.flush()
        sys.exit(1)
