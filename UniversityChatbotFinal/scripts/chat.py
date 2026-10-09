import json
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# --------------------------------------------------
# LANGSMITH (optional)
# --------------------------------------------------
from langsmith import traceable

# --------------------------------------------------
# Project setup
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
    create_new_session
)

# --------------------------------------------------
# Stage 1: Pinecone Score Rerank (ONLY)
# --------------------------------------------------
def rerank_stage1(matches, top_n=10):
    return sorted(matches, key=lambda x: x["score"], reverse=True)[:top_n]

# --------------------------------------------------
# Context Builder
# --------------------------------------------------
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

# --------------------------------------------------
# FINAL ANSWER (STRICT PROMPT)
# --------------------------------------------------
def generate_final_answer(context, question):
    prompt = f"""
You are a university assistant.

Answer ONLY from the given context.

Rules:
- If answer is not in context → say "I don't know"
- Do NOT guess
- Be precise and short

Context:
{context}

Question:
{question}
"""
    return generate_answer("", prompt)

# --------------------------------------------------
# RAG Pipeline (UPDATED - NO STAGE 2)
# --------------------------------------------------
@traceable(run_type="chain", name="University-RAG-Fast")
def ask_question(question, namespace, user_type, session_id):

    # Greeting handling
    if question.lower() in ["hi", "hello", "hey"]:
        return "Hello! 👋 Ask me anything about the university."

    pc = PineconeClient()

    # 1️⃣ Embed Query
    query_embedding = embed_texts([question])[0]

    # 2️⃣ Retrieve from Pinecone
    results = pc.index.query(
        vector=query_embedding,
        top_k=20,  # retrieve more for better filtering
        namespace=namespace,
        include_metadata=True
    )

    if not results["matches"]:
        return "No relevant information found."

    # 3️⃣ Single Rerank (FAST)
    final_matches = rerank_stage1(results["matches"], top_n=10)

    # 4️⃣ Build Context
    context, sources = build_context(final_matches)

    # 5️⃣ Generate Answer
    answer = generate_final_answer(context, question)

    # 6️⃣ Attach Sources
    if sources:
        answer += "\n\n📄 Sources:\n"
        for s in sorted(sources):
            answer += f"- {s}\n"

    return answer

# --------------------------------------------------
# MAIN (CLI Testing)
# --------------------------------------------------
def main():
    print("\n🎓 University Chatbot (FAST VERSION)")
    print("====================================")

    pc = PineconeClient()
    namespaces = list(pc.index.describe_index_stats()["namespaces"].keys())

    user_type = input("Student or Staff: ").strip().lower()

    if user_type == "staff":
        namespace = "staff"
    else:
        print("Available Namespaces:")
        for i, ns in enumerate(namespaces):
            if ns != "staff":
                print(f"{i}. {ns}")
        choice = int(input("Select: "))
        namespace = namespaces[choice]

    session_id = create_new_session()

    while True:
        q = input("\nAsk: ")
        if q.lower() == "exit":
            break

        save_message("user", q, session_id)

        answer = ask_question(q, namespace, user_type, session_id)

        save_message("assistant", answer, session_id)

        print("\nAnswer:\n", answer)
        print("-" * 50)

if __name__ == "__main__":
    main()