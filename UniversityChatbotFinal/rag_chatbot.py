import os
import sys

# --------------------------------------------------
# LANGSMITH OBSERVABILITY (OPTIONAL)
# --------------------------------------------------
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "university-rag-observability"

from langsmith import traceable

# --------------------------------------------------
# PROJECT ROOT AUTO-DETECTION
# --------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

# --------------------------------------------------
# RAG IMPORTS
# --------------------------------------------------
from pipeline.embedder import embed_texts
from pipeline.pinecone_index import PineconeClient
from pipeline.llm import generate_answer


# --------------------------------------------------
# GET AVAILABLE NAMESPACES
# --------------------------------------------------

def get_available_namespaces():
    pc = PineconeClient()
    stats = pc.index.describe_index_stats()
    return list(stats.get("namespaces", {}).keys())


# --------------------------------------------------
# RAG QUESTION ANSWERING (NO MEMORY)
# --------------------------------------------------

@traceable(run_type="chain", name="University-RAG-Query")
def ask_question(question: str, namespace: str, user_type: str):
    """
    Core RAG pipeline.
    No session storage.
    No memory saving.
    Pure retrieval + generation.
    """

    # ---------------------------
    # Greeting shortcut
    # ---------------------------
    if question.lower().strip() in ["hi", "hello", "hey"]:
        return (
            "Hello! 👋 I can help you with admissions, eligibility, programs, "
            "fees, staff policies, awards, and other university information."
        )

    pc = PineconeClient()

    # ---------------------------
    # 1️⃣ EMBEDDING
    # ---------------------------

    @traceable(run_type="embedding", name="Query-Embedding")
    def embed_query(q):
        return embed_texts([q])[0]

    query_embedding = embed_query(question)

    # ---------------------------
    # 2️⃣ RETRIEVAL
    # ---------------------------

    @traceable(run_type="retriever", name="Pinecone-Retrieval")
    def retrieve_chunks(embedding):
        return pc.index.query(
            vector=embedding,
            top_k=12,
            namespace=namespace,
            include_metadata=True,
        )

    results = retrieve_chunks(query_embedding)

    if not results.get("matches"):
        return "The requested information is not available in the provided documents."

    # ---------------------------
    # 3️⃣ BUILD CONTEXT
    # ---------------------------

    @traceable(run_type="chain", name="Context-Construction")
    def build_context(matches):
        chunks = []
        sources = set()

        for match in matches:
            metadata = match.get("metadata", {})
            if "text" in metadata:
                chunks.append(metadata["text"])
            if "source_file" in metadata:
                sources.add(metadata["source_file"])

        return "\n\n".join(chunks), sources

    context, sources = build_context(results["matches"])

    # ---------------------------
    # 4️⃣ GENERATE ANSWER
    # ---------------------------

    @traceable(run_type="llm", name="Answer-Generation")
    def generate_llm_answer(ctx, q):
        return generate_answer(ctx, q)

    answer = generate_llm_answer(context, question)

    # ---------------------------
    # Attach Sources
    # ---------------------------

    if sources:
        answer += "\n\n📄 Sources:\n"
        for src in sorted(sources):
            answer += f"- {src}\n"

    return answer


# --------------------------------------------------
# TEST (OPTIONAL)
# --------------------------------------------------

if __name__ == "__main__":
    namespaces = get_available_namespaces()
    selected_namespace = namespaces[0] if namespaces else "staff"

    response = ask_question(
        question="What programs are available?",
        namespace=selected_namespace,
        user_type="student",
    )

    print(response)