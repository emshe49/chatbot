import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import warnings
warnings.filterwarnings("ignore")

import tensorflow as tf
tf.get_logger().setLevel('ERROR')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn

from rag_chatbot import ask_question, ask_question_stream, get_available_namespaces

# --------------------------------------------------
# APP CONFIG
# --------------------------------------------------

app = FastAPI(title="University RAG Chatbot API (Public)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class ChatRequest(BaseModel):
    question: str
    namespace: Optional[str] = None
    chat_history: Optional[list] = []


class NamespacesResponse(BaseModel):
    namespaces: list


# --------------------------------------------------
# GET AVAILABLE NAMESPACES
# --------------------------------------------------

@app.get("/api/namespaces", response_model=NamespacesResponse)
def api_get_namespaces():
    namespaces = get_available_namespaces()
    return {"namespaces": namespaces}


# --------------------------------------------------
# REAL STREAMING CHAT ENDPOINT
# --------------------------------------------------

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """
    Streams tokens from the LLM as they are generated.
    No fake word-splitting — every chunk is a real LLM token.
    """

    def stream_generator():
        for token in ask_question_stream(
            question=req.question,
            namespace=req.namespace,
            user_type="public",
            chat_history=req.chat_history,
        ):
            yield token

    return StreamingResponse(stream_generator(), media_type="text/plain")


# --------------------------------------------------
# NON-STREAMING ENDPOINT  (kept for internal use / testing)
# --------------------------------------------------

@app.post("/api/chat/full")
async def api_chat_full(req: ChatRequest):
    """
    Returns the complete answer as a single JSON response.
    Useful for internal tooling or clients that don't support streaming.
    """
    answer = ask_question(
        question=req.question,
        namespace=req.namespace,
        user_type="public",
        chat_history=req.chat_history,
    )
    return {"answer": answer}


# --------------------------------------------------
# RUN
# --------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)