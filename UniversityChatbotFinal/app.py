from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import time

from rag_chatbot import ask_question, get_available_namespaces

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


class NamespacesResponse(BaseModel):
    namespaces: list


# --------------------------------------------------
# GET AVAILABLE NAMESPACES (PUBLIC)
# --------------------------------------------------

@app.get("/api/namespaces", response_model=NamespacesResponse)
def api_get_namespaces():
    """
    Return all available namespaces (public)
    """
    namespaces = get_available_namespaces()
    return {"namespaces": namespaces}


# --------------------------------------------------
# STREAMING CHAT ENDPOINT (PUBLIC)
# --------------------------------------------------

@app.post("/api/chat")
async def api_chat(req: ChatRequest):

    namespace = req.namespace

    def stream_generator():

        answer = ask_question(
            question=req.question,
            namespace=namespace,
            user_type="public",   # no role now
        )

        words = answer.split(" ")

        for word in words:
            yield word + " "
            time.sleep(0.02)

    return StreamingResponse(stream_generator(), media_type="text/plain")


# --------------------------------------------------
# RUN
# --------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)