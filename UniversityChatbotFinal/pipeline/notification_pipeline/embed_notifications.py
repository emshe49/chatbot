# pipeline/notification_pipeline/embed_notifications.py

import json
from tqdm import tqdm
import os
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from pipeline.embedder import embed_texts
from pipeline.pinecone_index import PineconeClient


# ===============================
# PATHS
# ===============================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

PROCESSED_FILE = os.path.join(
    BASE_DIR,
    "data",
    "notifications",
    "processed",
    "notifications_chunks.json"
)

NAMESPACE = "Notification"


# ===============================
# LANGCHAIN EMBEDDING WRAPPER
# ===============================
class CustomEmbedding:
    """
    Wrapper so LangChain retriever can use our embed_texts() function.
    """

    def embed_documents(self, texts):
        return embed_texts(texts)

    def embed_query(self, text):
        return embed_texts([text])[0]


# ===============================
# HELPER FUNCTION TO CLEAN METADATA
# ===============================
def sanitize_metadata(meta: dict) -> dict:
    """Ensure all metadata values are valid for Pinecone."""

    clean_meta = {}

    for k, v in meta.items():

        if v is None:
            clean_meta[k] = ""

        elif isinstance(v, (str, bool, int, float)):
            clean_meta[k] = v

        elif isinstance(v, list):
            clean_meta[k] = [str(x) for x in v if x is not None]

        else:
            clean_meta[k] = str(v)

    return clean_meta


# ===============================
# INCREMENTAL EMBEDDING FUNCTION
# ===============================
def run_embedding():

    if not os.path.exists(PROCESSED_FILE):
        print(" Processed chunks file not found. Run chunking first.")
        return

    print(f"\nLoading processed chunks from {PROCESSED_FILE}")

    with open(PROCESSED_FILE, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    if not chunks:
        print(" No chunks found to embed.")
        return

    print(f" Total chunks loaded: {len(chunks)}")

    # Connect to Pinecone
    pc = PineconeClient()

    # ===============================
    # CHECK ALREADY EMBEDDED CHUNKS
    # ===============================
    existing_ids = set()

    print("Checking for already embedded chunks in Pinecone...")

    for c in tqdm(chunks, desc="Checking existing chunks"):

        res = pc.index.query(
            vector=[0.0] * 384,
            top_k=1,
            namespace=NAMESPACE,
            filter={"chunk_id": {"$eq": c["chunk_id"]}},
            include_metadata=False
        )

        if res.get("matches"):
            existing_ids.add(c["chunk_id"])

    # ===============================
    # FILTER NEW CHUNKS
    # ===============================
    new_chunks = [c for c in chunks if c["chunk_id"] not in existing_ids]

    if not new_chunks:
        print(" All chunks are already embedded. Nothing to do.")

    else:

        print(f" New chunks to embed: {len(new_chunks)}")

        # ===============================
        # CREATE DOCUMENTS
        # ===============================
        documents = []

        for c in new_chunks:

            doc = Document(
                page_content=c["text"],
                metadata=c.get("metadata", {})
            )

            documents.append(doc)

        # ===============================
        # GENERATE EMBEDDINGS
        # ===============================
        texts = [doc.page_content for doc in documents]

        print("Generating embeddings for new chunks...")

        embeddings = embed_texts(texts)

        # ===============================
        # PREPARE VECTORS
        # ===============================
        vectors = []

        for i, emb in enumerate(embeddings):

            meta = sanitize_metadata(documents[i].metadata)

            # IMPORTANT: LangChain requires "text"
            meta["text"] = documents[i].page_content

            meta["chunk_id"] = new_chunks[i]["chunk_id"]

            vectors.append({
                "id": new_chunks[i]["chunk_id"],
                "values": emb,
                "metadata": meta
            })

        # ===============================
        # UPSERT TO PINECONE
        # ===============================
        print(f"Upserting embeddings to Pinecone namespace '{NAMESPACE}'...")

        for i in tqdm(range(0, len(vectors), 50), desc="Upserting"):
            pc.upsert(vectors[i:i+50], namespace=NAMESPACE)

        print(f" Incremental embedding complete for {len(vectors)} new chunks.")

    # ===============================
    # TEST RETRIEVER
    # ===============================
    print("\n===============================")
    print("TESTING RETRIEVER")
    print("===============================")

    try:

        embeddings = CustomEmbedding()

        vectorstore = PineconeVectorStore(
            index=pc.index,
            embedding=embeddings,
            namespace=NAMESPACE
        )

        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

        docs = retriever.invoke("latest news of uet mardan")

        print("\n Retrieved Documents:", len(docs))

        if docs:
            print("\n First Document Content:\n")
            print(docs[0].page_content[:500])
        else:
            print("No documents retrieved. Check embeddings or metadata.")

    except Exception as e:
        print("Retriever test failed:", str(e))


# ===============================
# RUN SCRIPT
# ===============================
if __name__ == "__main__":
    run_embedding()