import os
import time
import pandas as pd
from sentence_transformers import SentenceTransformer, util

# -----------------------------
# Add your scripts folder to path
# -----------------------------
import sys
PROJECT_ROOT = r"D:\UniversityChatbotFinal"
SCRIPTS_DIR = os.path.join(PROJECT_ROOT, "scripts")
sys.path.insert(0, SCRIPTS_DIR)

# -----------------------------
# Import your chatbot code
# -----------------------------
from scripts.chat import ask_question, create_new_session
from pipeline.pinecone_index import PineconeClient

# -----------------------------
# CONFIG
# -----------------------------
EVAL_CSV = os.path.join(PROJECT_ROOT, "evaluation_results", "retriever_eval_20260126_233413.csv")
OUTPUT_CSV = os.path.join(PROJECT_ROOT, "evaluation_results", "generator_eval_results.csv")
LOW_SIM_CSV = os.path.join(PROJECT_ROOT, "evaluation_results", "generator_low_similarity.csv")
SIMILARITY_THRESHOLD = 0.6  # Threshold for low similarity
DEFAULT_NAMESPACE = None      # If None, will pick first available namespace

# -----------------------------
# Load semantic similarity model
# -----------------------------
model = SentenceTransformer('all-MiniLM-L6-v2')

# -----------------------------
# Load evaluation data
# -----------------------------
df = pd.read_csv(EVAL_CSV)

if 'question' not in df.columns or 'gold_answer' not in df.columns:
    raise ValueError("CSV must contain 'question' and 'gold_answer' columns for generator evaluation")

# -----------------------------
# Initialize Pinecone once
# -----------------------------
pc = PineconeClient()
namespaces = list(pc.index.describe_index_stats().get("namespaces", {}).keys())
if not namespaces:
    raise ValueError("❌ No namespaces found in Pinecone.")

# Pick namespace
namespace = DEFAULT_NAMESPACE or namespaces[0]
print(f"\n✅ Using namespace: {namespace}")

# -----------------------------
# Start a new chat session
# -----------------------------
session_id = create_new_session()
print(f"\n🧠 Generator evaluation session started: {session_id}\n")

# -----------------------------
# Evaluate generator
# -----------------------------
results = []
low_similarity_results = []

for idx, row in df.iterrows():
    question = row['question']
    gold_answer = row['gold_answer']

    start = time.time()
    chatbot_answer = ask_question(question, namespace=namespace)
    end = time.time()
    response_time = end - start

    # Semantic similarity
    gold_emb = model.encode(gold_answer, convert_to_tensor=True)
    bot_emb = model.encode(chatbot_answer, convert_to_tensor=True)
    similarity = util.cos_sim(gold_emb, bot_emb).item()

    results.append({
        "question": question,
        "gold_answer": gold_answer,
        "chatbot_answer": chatbot_answer,
        "similarity": round(similarity, 3),
        "response_time_sec": round(response_time, 2)
    })

    # Save low-similarity answers
    if similarity < SIMILARITY_THRESHOLD:
        low_similarity_results.append({
            "question": question,
            "gold_answer": gold_answer,
            "chatbot_answer": chatbot_answer,
            "similarity": round(similarity, 3),
            "response_time_sec": round(response_time, 2)
        })

    print(f"Q{idx+1}: Similarity={similarity:.3f}, Time={response_time:.2f}s")

# -----------------------------
# Save results
# -----------------------------
os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
pd.DataFrame(results).to_csv(OUTPUT_CSV, index=False)
print(f"\n✅ Generator evaluation saved to: {OUTPUT_CSV}")

if low_similarity_results:
    pd.DataFrame(low_similarity_results).to_csv(LOW_SIM_CSV, index=False)
    print(f"⚠️ Low-similarity questions saved to: {LOW_SIM_CSV}")
else:
    print("✅ No low-similarity questions found.")

# -----------------------------
# Quick summary
# -----------------------------
avg_similarity = pd.DataFrame(results)['similarity'].mean()
avg_time = pd.DataFrame(results)['response_time_sec'].mean()
print(f"\nAverage similarity: {avg_similarity:.3f}")
print(f"Average response time: {avg_time:.2f} sec")
