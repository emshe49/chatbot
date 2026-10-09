import sys
import os
os.environ["TRANSFORMERS_NO_TF"] = "1"
os.environ["USE_TF"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import warnings

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
warnings.filterwarnings("ignore")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(PROJECT_ROOT)

from pipeline.notification_pipeline.scraper import run_scraper
from pipeline.notification_pipeline.chunk_notifications import run_chunking
from pipeline.notification_pipeline.embed_notifications import run_embedding

print("\n========== NOTIFICATION PIPELINE STARTED ==========\n", flush=True)

print("Step 1: Running Scraper...\n", flush=True)
new_items = run_scraper()

if new_items == 0:
    print("\nNO_NEW_DATA", flush=True)
    print("\n========== PIPELINE STOPPED ==========\n", flush=True)
    sys.exit(0)

print(f"\nNEW_DATA_FOUND: {new_items}", flush=True)

print("\nStep 2: Running Chunking...\n", flush=True)
run_chunking()

print("\nStep 3: Running Embedding...\n", flush=True)
run_embedding()

print("\n========== PIPELINE FINISHED SUCCESSFULLY ==========\n", flush=True)