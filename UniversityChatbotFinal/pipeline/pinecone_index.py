import os
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"), override=True)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "uet-mardan-chatbot")

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY not loaded")

class PineconeClient:
    def __init__(
        self,
        dimension=384,
        metric="cosine",
        cloud="aws",
        region="us-east-1",
    ):
        self.pc = Pinecone(api_key=PINECONE_API_KEY)

        if PINECONE_INDEX_NAME not in self.pc.list_indexes().names():
            self.pc.create_index(
                name=PINECONE_INDEX_NAME,
                dimension=dimension,
                metric=metric,
                spec=ServerlessSpec(cloud=cloud, region=region),
            )

        self.index = self.pc.Index(PINECONE_INDEX_NAME)
        print(f"Connected to Pinecone index: {PINECONE_INDEX_NAME}")

    def upsert(self, vectors, namespace: str):
        self.index.upsert(vectors=vectors, namespace=namespace)

    # 🔹 NEW: check if PDF already indexed
    def pdf_already_indexed(self, namespace: str, doc_hash: str) -> bool:
        res = self.index.query(
            vector=[0.0] * 384,
            top_k=1,
            namespace=namespace,
            filter={"pdf_hash": {"$eq": doc_hash}},
            include_metadata=False
        )
        return len(res.get("matches", [])) > 0
