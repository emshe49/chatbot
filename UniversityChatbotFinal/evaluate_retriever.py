import json
import sys
import os
import re
from typing import List, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import csv
from datetime import datetime

# ----------------------------
# Project root
# ----------------------------
PROJECT_ROOT = r"D:\UniversityChatbotFinal"
sys.path.insert(0, PROJECT_ROOT)

# ----------------------------
# Imports
# ----------------------------
from pipeline.embedder import embed_texts
from pipeline.pinecone_index import PineconeClient

# ----------------------------
# Load evaluation dataset
# ----------------------------
with open("uet_mardan_evaluation_dataset.json", "r", encoding="utf-8") as f:
    dataset = json.load(f)

questions = [item["question"] for item in dataset["evaluation_dataset"]]
gold_answers = [item["gold_answer"] for item in dataset["evaluation_dataset"]]

# ----------------------------
# Pinecone client
# ----------------------------
pc = PineconeClient()

# ----------------------------
# Retrieve context function
# ----------------------------
def retrieve_context(question, namespace, top_k=8):
    query_embedding = embed_texts([question])[0]
    results = pc.index.query(
        vector=query_embedding,
        top_k=top_k,
        namespace=namespace,
        include_metadata=True,
        include_values=False
    )

    chunks = []
    for match in results.get("matches", []):
        meta = match.get("metadata", {})
        if meta and "text" in meta:
            chunks.append({
                "text": meta["text"],
                "score": match.get("score", 0),
                "metadata": meta
            })
    return chunks

# ----------------------------
# Key phrase extraction
# ----------------------------
def extract_key_information(text: str) -> List[str]:
    key_phrases = []

    # Extract numeric values, percentages, credit hours, seats
    amount_patterns = [
        r'PKR\s*[\d,]+', r'Rs\.?\s*[\d,]+', r'\$\s*[\d,]+',
        r'[\d,]+\s*PKR', r'[\d,]+\s*Rs', r'\b\d+\s*%', 
        r'\b\d+\s*credit', r'\b\d+\s*hours', r'\b\d+\s*seats'
    ]
    for pattern in amount_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        key_phrases.extend([m.lower() for m in matches])

    # Extract important words (filter out common words)
    common_words = {"the", "a", "an", "is", "are", "and", "or", "for", "to", "of", "in", "on"}
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
    for word in words:
        word_lower = word.lower()
        if word_lower not in common_words:
            key_phrases.append(word_lower)

    return list(set(key_phrases))

# ----------------------------
# Keyword recall
# ----------------------------
def keyword_recall(chunks: List[dict], gold_answer: str) -> int:
    if not chunks:
        return 0

    key_phrases = extract_key_information(gold_answer)

    for chunk_info in chunks:
        chunk_text = chunk_info["text"].lower()
        matches = sum(1 for phrase in key_phrases if phrase in chunk_text)
        if key_phrases and matches / len(key_phrases) >= 0.5:
            return 1
    return 0

# ----------------------------
# Hybrid recall
# ----------------------------
def hybrid_recall(chunks: List[dict], gold_answer: str, semantic_threshold=0.65) -> Tuple[int, str, float]:
    """
    Returns: (recall_score, method_used, top_similarity)
    """
    if not chunks:
        return 0, "no_chunks", 0.0

    # Try keyword recall first
    if keyword_recall(chunks, gold_answer):
        return 1, "keyword", 1.0

    # Semantic fallback
    try:
        gold_embedding = embed_texts([gold_answer])[0]
        chunk_texts = [c["text"] for c in chunks]
        chunk_embeddings = embed_texts(chunk_texts)
        gold_vec = np.array(gold_embedding).reshape(1, -1)

        top_similarity = 0.0
        for emb in chunk_embeddings:
            chunk_vec = np.array(emb).reshape(1, -1)
            similarity = cosine_similarity(gold_vec, chunk_vec)[0][0]
            if similarity > top_similarity:
                top_similarity = similarity
            if similarity >= semantic_threshold:
                return 1, "semantic", similarity

        return 0, "semantic_failed", top_similarity
    except Exception as e:
        print(f"  [WARN] Semantic recall failed: {e}")
        return 0, "failed", 0.0

# ----------------------------
# Run evaluation with CSV logging
# ----------------------------
def run_evaluation_with_csv():
    NAMESPACE = "UG-2023-24"
    EVAL_LIMIT = min(50, len(questions))

    total_recall = 0
    method_counts = {"keyword": 0, "semantic": 0, "semantic_failed": 0, "failed": 0, "no_chunks": 0}

    # CSV logging
    output_dir = "evaluation_results"
    os.makedirs(output_dir, exist_ok=True)
    csv_file = os.path.join(output_dir, f"retriever_eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    csv_headers = ["question", "gold_answer", "recall", "method_used", "top_similarity", "retrieved_chunks"]

    with open(csv_file, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_headers)
        writer.writeheader()

        for i, (question, gold_answer) in enumerate(zip(questions[:EVAL_LIMIT], gold_answers[:EVAL_LIMIT])):
            print(f"Evaluating Q{i+1}: {question[:80]}...")
            chunks = retrieve_context(question, NAMESPACE, top_k=8)
            recall_score, method_used, top_similarity = hybrid_recall(chunks, gold_answer)
            total_recall += recall_score
            method_counts[method_used] = method_counts.get(method_used, 0) + 1

            # Write row to CSV
            writer.writerow({
                "question": question,
                "gold_answer": gold_answer,
                "recall": recall_score,
                "method_used": method_used,
                "top_similarity": round(top_similarity, 3),
                "retrieved_chunks": " ||| ".join([c["text"][:150].replace("\n"," ") for c in chunks])
            })

    # Summary
    print("\n" + "="*50)
    print("EVALUATION RESULTS")
    print("="*50)
    print(f"Total questions evaluated: {EVAL_LIMIT}")
    print(f"Overall Recall@8: {total_recall/EVAL_LIMIT:.2f} ({total_recall}/{EVAL_LIMIT})")
    print("\nMethod breakdown:")
    for method, count in method_counts.items():
        if count > 0:
            print(f"  {method}: {count} ({(count/EVAL_LIMIT)*100:.1f}%)")

    print(f"\n✅ CSV logged to: {csv_file}")
    return total_recall/EVAL_LIMIT

# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    final_recall = run_evaluation_with_csv()
    print(f"\n✅ Final recall score: {final_recall:.2f}")
