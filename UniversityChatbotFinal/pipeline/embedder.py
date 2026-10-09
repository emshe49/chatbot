import os

# 🚫 Prevent TensorFlow from loading
os.environ["TRANSFORMERS_NO_TF"] = "1"
os.environ["USE_TF"] = "0"

from sentence_transformers import SentenceTransformer

_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2",
            device="cpu"   # force CPU for stability
        )
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_model()

    embeddings = model.encode(
        texts,
        batch_size=16,              # reduces RAM spike
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True       # more stable than torch tensors
    )

    return embeddings.tolist()