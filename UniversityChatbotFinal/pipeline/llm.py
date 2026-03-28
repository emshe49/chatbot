import os
import re
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found. Please set it in the .env file.")

client = Groq(api_key=GROQ_API_KEY)

# --------------------------------------------------
# FIX: Corrected model name
# "openai/gpt-oss-120b" does NOT exist on Groq → caused silent failures
# Use a real, working Groq model:
# --------------------------------------------------
MODEL_NAME = "llama-3.3-70b-versatile"
# Other valid options if you want to try:
# MODEL_NAME = "llama-3.1-70b-versatile"
# MODEL_NAME = "mixtral-8x7b-32768"


def clean_output(text: str) -> str:
    """Remove markdown formatting for plain text output."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"^\s*[-•]\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def generate_answer(context: str, question: str) -> str:
    system_prompt = """You are a university information assistant for UET Mardan.

Answer student questions using ONLY the provided context from the official prospectus.

CRITICAL NUMERIC RULES (most important):
1. For credit hours: copy the EXACT number from context. Never guess.
2. For course codes: copy EXACTLY as written (e.g. CS-101, BSH-232).
3. For fees: copy the EXACT amount in PKR. Never round or estimate.
4. For merit scores: copy the EXACT percentage or aggregate.
5. For semester numbers: copy EXACTLY as stated.
6. If a number appears in context → copy it. Never change it.

ANSWER RULES:
1. Use ONLY information from the provided context.
2. If the answer is not in the context, say exactly:
   "The requested information is not available in the provided prospectus."
3. Never guess, estimate, or use outside knowledge.
4. Give complete answers — do not cut short.

FORMAT RULES:
1. Plain text only — no markdown, no asterisks, no bold.
2. Use numbered points (1. 2. 3.) when listing multiple items.
3. Keep language simple and student-friendly."""

    user_prompt = f"""Question:
{question}

Context from prospectus:
{context}

Answer (copy all numbers and codes exactly from context):"""

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0,      # FIXED: was 0.2 → 0 is better for exact numeric answers
        max_tokens=900
    )

    raw_answer = response.choices[0].message.content.strip()
    return clean_output(raw_answer)
