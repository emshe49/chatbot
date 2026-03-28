import pickle
from tqdm import tqdm
from pipeline.embedder import embed_texts
from pipeline.pinecone_index import PineconeClient

def index_chunks(chunks_pkl, namespace: str):
    print(f"📌 Indexing → {chunks_pkl} → namespace={namespace}")

    with open(chunks_pkl, "rb") as f:
        chunks = pickle.load(f)

    print(f"📦 Loaded {len(chunks)} chunks")

    pc = PineconeClient()

    texts = [c["content"] for c in chunks]
    metadatas = []
    for c in chunks:
        meta = c.get("metadata", {})
        meta["source_text"] = c["content"]  # store the actual chunk text
        metadatas.append(meta)

    embeddings = embed_texts(texts)

    vectors = []
    for i, emb in enumerate(embeddings):
        vectors.append({
            "id": f"{namespace}-{i}",
            "values": emb,
            "metadata": metadatas[i]
        })

    # Batch upsert
    for i in tqdm(range(0, len(vectors), 50), desc="Upserting"):
        pc.upsert(vectors[i:i+50], namespace=namespace)

    print("✅ Indexing complete")
