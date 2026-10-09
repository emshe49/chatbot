import os
import re
from dotenv import load_dotenv
from groq import Groq

# --------------------------------------------------
# Load environment variables
# --------------------------------------------------
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found. Please set it in the .env file.")

# --------------------------------------------------
# Initialize Groq client
# --------------------------------------------------
client = Groq(api_key=GROQ_API_KEY)

# --------------------------------------------------
# Model
# --------------------------------------------------
MODEL_NAME = "openai/gpt-oss-120b"
# Alternative:
# MODEL_NAME = "llama-3.1-70b-versatile"


# ==================================================
# OUTPUT CLEANER
# ==================================================
def clean_output(text: str) -> str:
    """
    Converts messy markdown/table output into clean plain text.
    """

    # Remove bold / italic markdown
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)

    # Remove markdown table pipes
    text = re.sub(r"\|", " ", text)

    # Remove table separator lines
    text = re.sub(r"-{3,}", "", text)

    # Convert HTML breaks
    text = re.sub(r"<br\s*/?>", "\n", text)

    # Remove bullet symbols
    text = re.sub(r"^\s*[-•]\s*", "", text, flags=re.MULTILINE)

    # Normalize spacing
    text = re.sub(r"[ \t]+", " ", text)

    # Normalize newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ==================================================
# QUERY REWRITER
# ==================================================
def rewrite_query(conversation_history: str, followup_question: str) -> str:
    """
    Rewrites vague follow-up questions into standalone searchable questions.
    """

    system_prompt = """
You are a query rewriting assistant for a university chatbot.

Your ONLY task:
Rewrite vague follow-up questions into fully self-contained questions.

Rules:
1. Return ONLY the rewritten question
2. No explanation
3. No extra text
4. Keep concise
5. Include the specific topic from history
6. If already complete, return unchanged
"""

    user_prompt = f"""
Conversation History:
{conversation_history}

Follow-up Question:
{followup_question}

Rewritten Question:
"""

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
        max_tokens=100,
    )

    rewritten = response.choices[0].message.content.strip()

    return rewritten if rewritten else followup_question


# ==================================================
# MAIN ANSWER GENERATOR
# ==================================================
def _generate_answer_stream(prompt: str, system_prompt: str):
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
        max_tokens=1100,
        stream=True,
    )
    for chunk in response:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


def generate_answer(prompt: str, stream: bool = False):
    """
    Generates final chatbot answer from fully prepared prompt.
    Supports both non-streaming (returns str) and streaming (returns generator).
    """

    system_prompt = """
You are an intelligent university chatbot for UET Mardan.

INSTRUCTIONS:

1. Use conversation history when available
2. Use retrieved university context as primary source
3. Resolve follow-up references:
   - the above
   - these
   - tell me again
   - previous one
   - what about that

4. Summarize and rewrite information naturally
5. Do NOT copy raw prospectus formatting
6. If answer is unavailable, reply exactly:
The requested information is not available.

STRICT OUTPUT RULES:

1. Plain text only
2. No markdown
3. No tables
4. No pipes |
5. No HTML
6. No bullet symbols
7. Use short readable paragraphs
8. Use numbered lists only when needed

GOOD FORMAT EXAMPLE:

Need-Based Scholarship Criteria

1. Student must be admitted on open merit.
2. Minimum CGPA should be 2.5.
3. No failing grades are allowed.

Bad formats:
| table |
markdown
HTML tags
"""

    if stream:
        return _generate_answer_stream(prompt, system_prompt)

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
        max_tokens=1100,
    )

    raw_answer = response.choices[0].message.content.strip()

    return clean_output(raw_answer)