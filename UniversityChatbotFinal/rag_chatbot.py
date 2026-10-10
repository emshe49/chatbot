import os
import sys
import re
from functools import lru_cache
from typing import Generator

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
from pipeline.llm import generate_answer, rewrite_query

# --------------------------------------------------
# 🔥 RERANKER IMPORT (NEW)
# --------------------------------------------------
try:
    from sentence_transformers import CrossEncoder
    _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
except Exception as e:
    print("Reranker not loaded, fallback to normal ranking:", e)
    _reranker = None


# --------------------------------------------------
# GLOBAL PINECONE CLIENT
# --------------------------------------------------
_pc = PineconeClient()


# --------------------------------------------------
# GET AVAILABLE NAMESPACES
# --------------------------------------------------
def get_available_namespaces():
    stats = _pc.index.describe_index_stats()
    return list(stats.get("namespaces", {}).keys())


# --------------------------------------------------
# CACHED EMBEDDING
# --------------------------------------------------
@lru_cache(maxsize=512)
def get_embedding(text: str):
    return embed_texts([text])[0]


# ==================================================
# 🔥 RERANKING FUNCTION (NEW CORE LOGIC)
# ==================================================
def rerank_results(query: str, matches: list, top_k: int = 10):
    """
    Rerank Pinecone results using Cross-Encoder
    """
    if not _reranker or not matches:
        return matches[:top_k]

    scored = []

    for m in matches:
        meta = m.get("metadata", {})
        text = meta.get("text", "")

        if not text:
            continue

        score = _reranker.predict([(query, text)])[0]
        scored.append((score, m))

    # Sort by reranker score
    scored.sort(key=lambda x: x[0], reverse=True)

    return [m for _, m in scored[:top_k]]


# ==================================================
# MEMORY FUNCTIONS
# ==================================================
def build_memory_context(chat_history: list) -> str:
    if not chat_history:
        return ""

    memory = []
    for msg in chat_history[-4:]:
        role = "User" if msg["sender"] == "user" else "Assistant"
        memory.append(f"{role}: {msg['text']}")

    return "\n".join(memory)


def rewrite_question_with_memory(question: str, memory_context: str) -> str:
    if not memory_context:
        return question
    return rewrite_query(memory_context, question)


def handle_special_memory_questions(question: str, chat_history: list):
    q = question.lower().strip()

    meta_triggers = [
        "what question did i ask before",
        "what did i ask before",
        "what was my previous question",
        "what did i ask previously",
        "what was my last question",
    ]

    if any(trigger in q for trigger in meta_triggers):
        user_messages = [
            msg["text"]
            for msg in chat_history
            if msg["sender"] == "user"
        ]

        if len(user_messages) >= 2:
            return f'Your previous question was: "{user_messages[-2]}"'

        return "You have not asked any previous question in this session."

    return None


# ==================================================
# SMART INTENT DETECTION
# ==================================================
def is_notification_query(text: str):
    text = text.lower()
    keywords = [
        "notification", "notifications",
        "announcement", "announcements",
        "news", "update", "updates",
        "latest", "recent",
        "tender", "auction",
        "pm", "prime minister", "laptop scheme",
        "seminar", "event",
        "result", "merit list",
        "admission", "notice"
    ]
    return any(k in text for k in keywords)


# ==================================================
# LIMIT DETECTION
# ==================================================
def detect_limit(text: str):
    text = text.lower()

    if any(x in text for x in ["all", "full list", "everything", "complete list"]):
        return "all"

    match = re.search(r"(\d+)", text)
    if match:
        return int(match.group(1))

    if any(x in text for x in ["recent", "latest", "new"]):
        return 5

    return 1


# ==================================================
# REFERENCE EXTRACTION HELPERS
# ==================================================
def extract_chunk_references(match: dict) -> dict:
    """
    Extracts document name, clean section, clause/rule numbers, and table references
    from a match's metadata and chunk text.
    """
    meta = match.get("metadata", {})
    text = meta.get("text", "")
    source_file = meta.get("source_file", "University Document")

    # 1. Section extraction
    raw_section = meta.get("section", "")
    section = None
    if raw_section and raw_section != "general":
        if len(raw_section) <= 45:
            section = raw_section.strip()
        else:
            if "hostel" in raw_section.lower():
                section = "Hostels"
            elif "admission" in raw_section.lower():
                section = "Admissions"
            elif "fee" in raw_section.lower() or "scholarship" in raw_section.lower():
                section = "Fees & Scholarships"
            elif "discipline" in raw_section.lower():
                section = "Discipline"
            else:
                m = re.match(r"^(\d+(?:\.\d+)*\.?\s*[A-Za-z\s]{3,35})", raw_section)
                if m:
                    s = m.group(1).strip()
                    s = re.sub(r"\s+(?:in|of|for|to|with|and|the|a|an|Tab|Table)\s*$", "", s, flags=re.I)
                    section = s
                else:
                    words = raw_section[:35].split()
                    section = " ".join(words[:-1]) if len(words) > 1 else raw_section[:30]

    # 2. Table references extraction
    tables = set()
    if meta.get("table_number"):
        tables.add(f"Table {meta['table_number']}")
    if meta.get("table_name"):
        tables.add(str(meta["table_name"]))

    found_tables = re.findall(
        r"Table\s*\(?(\d+)\)?(?:\s*[:\-–]\s*([A-Za-z\s]{3,30}))?",
        text,
        re.IGNORECASE,
    )
    for num, name in found_tables:
        if name and len(name.strip()) > 2 and len(name.strip()) <= 30:
            tables.add(f"Table {num} ({name.strip()})")
        else:
            tables.add(f"Table {num}")

    # 3. Clauses / Rules (only validated rules)
    rules = set()
    found_clauses = re.findall(
        r"\b(?:Clause|Rule|Section)\s*(\d+(?:\.\d+)*)\b",
        text,
        re.IGNORECASE,
    )
    for c in found_clauses:
        rules.add(c)
    leading_nums = re.findall(r"^\s*(\d+\.\d+)\.?\s+[A-Z]", text, re.MULTILINE)
    for c in leading_nums:
        rules.add(c)

    return {
        "source_file": source_file,
        "section": section,
        "tables": sorted(list(tables)),
        "rules": sorted(
            list(rules),
            key=lambda x: [int(p) if p.isdigit() else 0 for p in x.split(".")],
        ),
    }


def format_sources_output(doc_refs: dict) -> str:
    """
    Renders formatted Sources section with sections, clauses, and table numbers.
    """
    if not doc_refs:
        return ""

    lines = ["\n\nSources:"]
    for src, details in sorted(doc_refs.items()):
        sub_items = []
        if details.get("sections"):
            seen = set()
            clean_secs = []
            for s in sorted(list(details["sections"])):
                s_lower = s.lower().strip()
                if s_lower not in seen:
                    seen.add(s_lower)
                    clean_secs.append(s.title() if s.isupper() else s)
            if clean_secs:
                sub_items.append(f"Section: {', '.join(clean_secs[:2])}")
        if details.get("rules"):
            rules = sorted(list(details["rules"]))[:4]
            sub_items.append(f"Rules/Clauses: {', '.join(rules)}")
        if details.get("tables"):
            tbls = sorted(list(details["tables"]))[:3]
            sub_items.append(f"Tables: {', '.join(tbls)}")

        if sub_items:
            lines.append(f"- **{src}**")
            for sub in sub_items:
                lines.append(f"  - {sub}")
        else:
            lines.append(f"- **{src}**")

    return "\n".join(lines) + "\n"


# ==================================================
# RAG BUILDER
# ==================================================
def _build_rag_prompt(question: str, namespace: str, chat_history: list = None) -> dict:

    if question.lower().strip() in ["hi", "hello", "hey"]:
        return {
            "early_return": "Hello! 👋 I can help you with admissions, programs, fees, and notifications."
        }

    if chat_history:
        special = handle_special_memory_questions(question, chat_history)
        if special:
            return {"early_return": special}

    memory_context = build_memory_context(chat_history)

    rewritten_question = (
        rewrite_question_with_memory(question, memory_context)
        if memory_context else question
    )

    query_embedding = get_embedding(rewritten_question)

    # ==================================================
    # STEP 1: Retrieve from Pinecone
    # ==================================================
    results = _pc.index.query(
        vector=query_embedding,
        top_k=15,
        namespace=namespace,
        include_metadata=True,
    )

    if not results.get("matches"):
        return {"early_return": "The requested information is not available."}

    raw_matches = results["matches"]

    # ==================================================
    # 🔥 STEP 2: RERANK RESULTS (NEW)
    # ==================================================
    reranked_matches = rerank_results(rewritten_question, raw_matches, top_k=10)

    # --------------------------------------------------
    # NOTIFICATION EXTRACTION
    # --------------------------------------------------
    notification_links = []
    for match in reranked_matches:
        meta = match.get("metadata", {})
        title = meta.get("title")
        url = meta.get("url")

        if title and url:
            notification_links.append((title, url))

    # --------------------------------------------------
    # SMART NOTIFICATION RESPONSE
    # --------------------------------------------------
    if notification_links and is_notification_query(question):

        limit = detect_limit(question)

        if limit == "all":
            selected = notification_links
        elif isinstance(limit, int):
            selected = notification_links[:limit]
        else:
            selected = notification_links[:1]

        answer = "Recent notifications from UET Mardan:\n\n"

        for i, (title, url) in enumerate(selected):
            answer += f"{i+1}. **{title}**\n\n[Click here]({url})\n\n"

        return {"early_return": answer}

    # --------------------------------------------------
    # NORMAL RAG FLOW
    # --------------------------------------------------
    chunks = []
    doc_refs = {}

    for match in reranked_matches[:7]:
        meta = match.get("metadata", {})
        text = meta.get("text")
        if not text:
            continue

        ref = extract_chunk_references(match)
        src = ref["source_file"]

        if src not in doc_refs:
            doc_refs[src] = {"sections": set(), "tables": set(), "rules": set()}

        if ref["section"]:
            doc_refs[src]["sections"].add(ref["section"])
        for t in ref["tables"]:
            doc_refs[src]["tables"].add(t)
        for r in ref["rules"]:
            doc_refs[src]["rules"].add(r)

        # Build chunk tag for LLM
        tag_parts = [f"Source: {src}"]
        if ref["section"]:
            tag_parts.append(f"Section: {ref['section']}")
        if ref["rules"]:
            tag_parts.append(f"Rules/Clauses: {', '.join(ref['rules'][:3])}")
        if ref["tables"]:
            tag_parts.append(f"Tables: {', '.join(ref['tables'])}")

        header = f"[Context Document: {' | '.join(tag_parts)}]"
        chunks.append(f"{header}\n{text}")

    context = "\n\n".join(chunks)

    if memory_context:
        full_prompt = (
            "You are a helpful university assistant.\n\n"
            f"Conversation History:\n{memory_context}\n\n"
            f"Retrieved Context:\n{context}\n\n"
            f"Question:\n{question}"
        )
    else:
        full_prompt = f"Retrieved Context:\n{context}\n\nQuestion:\n{question}"

    return {
        "early_return": None,
        "full_prompt": full_prompt,
        "chunks": chunks,
        "sources": set(doc_refs.keys()),
        "doc_refs": doc_refs,
        "formatted_sources": format_sources_output(doc_refs),
    }


# ==================================================
# NON-STREAMING
# ==================================================
def ask_question(question, namespace, user_type, chat_history=None, return_context=False):

    rag = _build_rag_prompt(question, namespace, chat_history)

    if rag.get("early_return"):
        if return_context:
            return {"answer": rag["early_return"], "contexts": []}
        return rag["early_return"]

    answer = generate_answer(rag["full_prompt"])

    if rag.get("formatted_sources"):
        answer += rag["formatted_sources"]
    elif rag.get("sources"):
        answer += "\n\nSources:\n"
        for src in sorted(rag["sources"]):
            answer += f"- {src}\n"

    if return_context:
        return {"answer": answer, "contexts": rag["chunks"]}

    return answer


# ==================================================
# STREAMING
# ==================================================
def ask_question_stream(question, namespace, user_type, chat_history=None):

    rag = _build_rag_prompt(question, namespace, chat_history)

    if rag.get("early_return"):
        yield rag["early_return"]
        return

    for token in generate_answer(rag["full_prompt"], stream=True):
        yield token

    if rag.get("formatted_sources"):
        yield rag["formatted_sources"]
    elif rag.get("sources"):
        yield "\n\nSources:\n"
        for src in sorted(rag["sources"]):
            yield f"- {src}\n"