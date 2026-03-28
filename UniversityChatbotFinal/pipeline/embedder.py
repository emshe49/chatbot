from sentence_transformers import SentenceTransformer

_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_texts(texts: list[str]) -> list[list[float]]:
    embeddings = _model.encode(
        texts,
        show_progress_bar=True,
        normalize_embeddings=True
    )
    return embeddings.tolist()
