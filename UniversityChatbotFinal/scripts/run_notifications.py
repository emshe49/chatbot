import sys
import os
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
run_scraper()

print("\nStep 2: Running Chunking...\n", flush=True)
run_chunking()

print("\nStep 3: Running Embedding...\n", flush=True)
run_embedding()

print("\n========== PIPELINE FINISHED SUCCESSFULLY ==========\n", flush=True)