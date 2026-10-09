import sys
import os

# UTF-8 stdout configuration for clean emojis and unicode logs
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["TRANSFORMERS_NO_TF"] = "1"
os.environ["USE_TF"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import warnings
warnings.filterwarnings("ignore")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(PROJECT_ROOT)

from pipeline.notification_pipeline.scraper import run_scraper
from pipeline.notification_pipeline.chunk_notifications import run_chunking
from pipeline.notification_pipeline.embed_notifications import run_embedding

def main():
    print("\n========== NOTIFICATION PIPELINE STARTED ==========\n", flush=True)
    print("PROGRESS: 5", flush=True)

    print("Step 1: Running Scraper for UET Mardan notices & events...\n", flush=True)
    try:
        new_items = run_scraper()
        print(f"\nScraping complete. New items discovered: {new_items}", flush=True)
    except Exception as e:
        print(f"Scraper error: {e}", flush=True)

    print("\nStep 2: Running Content Chunking with Link Context...\n", flush=True)
    try:
        new_chunks = run_chunking()
        print(f"Chunking stage complete ({new_chunks} new chunks generated).", flush=True)
    except Exception as e:
        print(f"Chunking error: {e}", flush=True)

    print("\nStep 3: Running Incremental Vector Embedding & Pinecone Sync...\n", flush=True)
    try:
        new_vectors = run_embedding()
        print(f"Embedding stage complete ({new_vectors} vectors upserted).", flush=True)
    except Exception as e:
        print(f"Embedding error: {e}", flush=True)

    print("PROGRESS: 100", flush=True)
    print("\n========== PIPELINE FINISHED SUCCESSFULLY ==========\n", flush=True)

if __name__ == "__main__":
    main()