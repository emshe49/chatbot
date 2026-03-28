import json
import sys
import os
import re
from typing import List, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
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
# Retriever function
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
# Keyword extraction
# ----------------------------
def extract_key_information(text: str) -> List[str]:
    key_phrases = []
    amount_patterns = [
        r'PKR\s*[\d,]+', r'Rs\.?\s*[\d,]+', r'\$\s*[\d,]+',
        r'[\d,]+\s*PKR', r'[\d,]+\s*Rs', r'\b\d+\s*%',
        r'\b\d+\s*credit', r'\b\d+\s*hours', r'\b\d+\s*seats'
    ]
    for pattern in amount_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        key_phrases.extend([m.lower() for m in matches])
    common_words = {"the", "a", "an", "is", "are", "and", "or", "for", "to", "of", "in", "on"}
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
    for word in words:
        word_lower = word.lower()
        if word_lower not in common_words and len(word_lower) > 3:
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
# Hybrid recall (keyword + semantic)
# ----------------------------
def hybrid_recall(chunks: List[dict], gold_answer: str, semantic_threshold=0.65) -> Tuple[int, str]:
    if not chunks:
        return 0, "no_chunks"
    if keyword_recall(chunks, gold_answer):
        return 1, "keyword"
    try:
        gold_embedding = embed_texts([gold_answer])[0]
        chunk_texts = [c["text"] for c in chunks]
        chunk_embeddings = embed_texts(chunk_texts)
        gold_vec = np.array(gold_embedding).reshape(1, -1)
        for i, emb in enumerate(chunk_embeddings):
            chunk_vec = np.array(emb).reshape(1, -1)
            similarity = cosine_similarity(gold_vec, chunk_vec)[0][0]
            if similarity >= semantic_threshold:
                return 1, "semantic"
    except Exception as e:
        print(f"  [WARN] Semantic recall failed: {e}")
    return 0, "failed"

# ----------------------------
# Precision@k
# ----------------------------
def precision_at_k(chunks: List[dict], gold_answer: str, k=12) -> float:
    if not chunks:
        return 0.0
    key_phrases = extract_key_information(gold_answer)
    relevant_count = 0
    for chunk_info in chunks[:k]:
        chunk_text = chunk_info["text"].lower()
        matches = sum(1 for phrase in key_phrases if phrase in chunk_text)
        if key_phrases and matches / len(key_phrases) >= 0.5:
            relevant_count += 1
    return relevant_count / k

# ----------------------------
# Reciprocal Rank
# ----------------------------
def reciprocal_rank(chunks: List[dict], gold_answer: str) -> float:
    if not chunks:
        return 0.0
    key_phrases = extract_key_information(gold_answer)
    for rank, chunk_info in enumerate(chunks, start=1):
        chunk_text = chunk_info["text"].lower()
        matches = sum(1 for phrase in key_phrases if phrase in chunk_text)
        if key_phrases and matches / len(key_phrases) >= 0.5:
            return 1.0 / rank
    return 0.0

# ----------------------------
# Run advanced evaluation
# ----------------------------
def run_advanced_evaluation():
    NAMESPACE = "UG-2023-24"
    EVAL_LIMIT = min(50, len(questions))

    results = []

    total_hybrid_recall = 0
    total_precision = 0
    total_mrr = 0
    method_counts = {"keyword": 0, "semantic": 0, "failed": 0, "no_chunks": 0}

    print(f"Evaluating {EVAL_LIMIT} questions with Precision@k and MRR...\n")

    for i, (question, gold_answer) in enumerate(zip(questions[:EVAL_LIMIT], gold_answers[:EVAL_LIMIT])):
        chunks = retrieve_context(question, NAMESPACE, top_k=8)
        recall_score, method_used = hybrid_recall(chunks, gold_answer)
        prec = precision_at_k(chunks, gold_answer, k=8)
        rr = reciprocal_rank(chunks, gold_answer)

        total_hybrid_recall += recall_score
        total_precision += prec
        total_mrr += rr
        method_counts[method_used] += 1

        results.append({
            "question": question,
            "gold_answer": gold_answer,
            "recall": recall_score,
            "precision@8": round(prec, 3),
            "reciprocal_rank": round(rr, 3),
            "method_used": method_used,
            "chunks_retrieved": len(chunks),
            "top_chunk_preview": chunks[0]["text"][:150] if chunks else ""
        })

        print(f"Q{i+1}: Recall={recall_score}, Precision@8={prec:.2f}, RR={rr:.2f}, Method={method_used}")

    # Summary
    avg_recall = total_hybrid_recall / EVAL_LIMIT
    avg_precision = total_precision / EVAL_LIMIT
    avg_mrr = total_mrr / EVAL_LIMIT

    print("\n" + "="*50)
    print("ADVANCED EVALUATION RESULTS")
    print("="*50)
    print(f"Avg Recall@8: {avg_recall:.2f}")
    print(f"Avg Precision@8: {avg_precision:.2f}")
    print(f"Mean Reciprocal Rank (MRR): {avg_mrr:.2f}")
    print("\nMethod breakdown:")
    for method, count in method_counts.items():
        if count > 0:
            percentage = (count / EVAL_LIMIT) * 100
            print(f"  {method}: {count} ({percentage:.1f}%)")

    # Save CSV
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs("evaluation_results", exist_ok=True)
    csv_path = f"evaluation_results/retriever_eval_{timestamp}.csv"
    df = pd.DataFrame(results)
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"\n✅ CSV logged to: {csv_path}")

    return avg_recall, avg_precision, avg_mrr

# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    avg_recall, avg_precision, avg_mrr = run_advanced_evaluation()
    print(f"\n✅ Final metrics: Recall@8={avg_recall:.2f}, Precision@8={avg_precision:.2f}, MRR={avg_mrr:.2f}")
