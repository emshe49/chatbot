import json
import os
import sys
from datetime import datetime

# --------------------------------------------------
# LANGSMITH OBSERVABILITY (MUST BE AT TOP)
# --------------------------------------------------
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "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"
os.environ["LANGCHAIN_PROJECT"] = "university-rag-observability"

from langsmith import traceable

# --------------------------------------------------
# Project setup (AUTO ROOT DETECTION)
# --------------------------------------------------
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)
sys.path.insert(0, PROJECT_ROOT)

# --------------------------------------------------
# RAG Imports
# --------------------------------------------------
from pipeline.embedder import embed_texts
from pipeline.pinecone_index import PineconeClient
from pipeline.llm import generate_answer

# --------------------------------------------------
# Memory Imports
# --------------------------------------------------
from memory.chat_memory import (
    save_message,
    load_history,
    create_new_session,
    list_sessions,
    switch_session
)

# --------------------------------------------------
# Paths
# --------------------------------------------------
HISTORY_DIR = os.path.join(PROJECT_ROOT, "data", "chat_history")
os.makedirs(HISTORY_DIR, exist_ok=True)

# --------------------------------------------------
# Pinecone helper
# --------------------------------------------------
def get_available_namespaces(pc):
    stats = pc.index.describe_index_stats()
    return list(stats.get("namespaces", {}).keys())

# --------------------------------------------------
# RAG QUESTION ANSWERING (FULLY OBSERVABLE)
# --------------------------------------------------
@traceable(run_type="chain", name="University-RAG-Query")
def ask_question(question: str, namespace: str, user_type: str, session_id: str):

    # ---- Greeting shortcut ----
    if question.lower().strip() in ["hi", "hello", "hey"]:
        return (
            "Hello! 👋 I can help you with admissions, eligibility, programs, "
            "fees, staff policies, awards, and other university information."
        )

    pc = PineconeClient()

    # ---------------------------
    # 1️⃣ EMBEDDING STEP
    # ---------------------------
    @traceable(run_type="embedding", name="Query-Embedding")
    def embed_query(q):
        return embed_texts([q])[0]

    query_embedding = embed_query(question)

    # ---------------------------
    # 2️⃣ RETRIEVAL STEP
    # ---------------------------
    @traceable(run_type="retriever", name="Pinecone-Retrieval")
    def retrieve_chunks(embedding):
        return pc.index.query(
            vector=embedding,
            top_k=8,
            namespace=namespace,
            include_metadata=True
        )

    results = retrieve_chunks(query_embedding)

    if not results["matches"]:
        return "The requested information is not available in the provided documents."

    # ---------------------------
    # 3️⃣ CONTEXT CONSTRUCTION
    # ---------------------------
    @traceable(run_type="chain", name="Context-Construction")
    def build_context(matches):
        chunks = []
        sources = set()

        for match in matches:
            meta = match.get("metadata", {})
            if "text" in meta:
                chunks.append(meta["text"])
            if "source_file" in meta:
                sources.add(meta["source_file"])

        return "\n\n".join(chunks), sources

    context, sources = build_context(results["matches"])

    # ---------------------------
    # 4️⃣ LLM GENERATION
    # ---------------------------
    @traceable(run_type="llm", name="Answer-Generation")
    def generate_llm_answer(ctx, q):
        return generate_answer(ctx, q)

    answer = generate_llm_answer(context, question)

    # ---------------------------
    # Attach sources
    # ---------------------------
    if sources:
        answer += "\n\n📄 Sources:\n"
        for src in sorted(sources):
            answer += f"- {src}\n"

    return answer

# --------------------------------------------------
# MAIN CHAT LOOP
# --------------------------------------------------
def main():
    print("\n🎓 University Chatbot (RAG + Memory + FULL Observability)")
    print("========================================================")

    pc = PineconeClient()
    namespaces = get_available_namespaces(pc)

    if not namespaces:
        print("❌ No namespaces found in Pinecone.")
        sys.exit(1)

    # -------------------------------
    # Ask user type
    # -------------------------------
    user_type = ""
    while user_type.lower() not in ["student", "staff"]:
        user_type = input("\nAre you a Student or Staff? ").strip()

    if user_type.lower() == "staff":
        if "staff" not in namespaces:
            print("❌ Staff namespace not found!")
            sys.exit(1)
        selected_namespace = "staff"
    else:
        student_namespaces = [ns for ns in namespaces if ns != "staff"]
        print("\nAvailable student prospectuses:\n")
        for i, ns in enumerate(student_namespaces, start=1):
            print(f"{i}. {ns}")

        while True:
            try:
                choice = int(input("\nSelect prospectus number: "))
                selected_namespace = student_namespaces[choice - 1]
                break
            except Exception:
                print("❌ Invalid selection, try again")

    # -------------------------------
    # Start chat session
    # -------------------------------
    current_session = create_new_session()
    print(f"\n🧠 New chat session started: {current_session}")

    # -------------------------------
    # Chat loop
    # -------------------------------
    while True:
        q = input("\nAsk a question: ").strip()

        if q.lower() == "exit":
            print("\n👋 Goodbye!")
            break

        save_message("user", q, current_session)

        try:
            answer = ask_question(
                question=q,
                namespace=selected_namespace,
                user_type=user_type,
                session_id=current_session
            )
        except Exception as e:
            print("❌ Error:", e)
            continue

        save_message("assistant", answer, current_session)

        print("\nAnswer:\n")
        print(answer)
        print("-" * 60)

# --------------------------------------------------
# ENTRY POINT
# --------------------------------------------------
if __name__ == "__main__":
    main()
