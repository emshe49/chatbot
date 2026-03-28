# --------------------------------------------------
# FIXED: Groq LLM Table Summarization
# FIX 1: Changed model from llama-3.1-8b-instant → llama-3.3-70b-versatile
# FIX 2: Prompt now forces EXACT numeric preservation (no paraphrasing)
# FIX 3: Structured row-by-row output so RAG can find exact values
# --------------------------------------------------

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file!")

# --------------------------------------------------
# FIX 1: Use a larger, more accurate model
# llama-3.1-8b-instant was too small → hallucinated numbers
# llama-3.3-70b-versatile is much better for numeric precision
# --------------------------------------------------
llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model_name="llama-3.3-70b-versatile",  # FIXED: was llama-3.1-8b-instant
    temperature=0                            # Keep 0 for factual accuracy
)

# --------------------------------------------------
# Safe truncation (row-aware, unchanged)
# --------------------------------------------------
def safe_truncate_table(table_text: str, max_chars: int = 3500) -> str:
    if len(table_text) <= max_chars:
        return table_text
    rows = table_text.split("\n")
    truncated = ""
    for row in rows:
        if len(truncated) + len(row) > max_chars:
            break
        truncated += row + "\n"
    return truncated.strip()


# --------------------------------------------------
# FIX 2: New prompt that forces exact numeric copying
# OLD prompt asked for "bullet points" → LLM rewrote numbers
# NEW prompt forces structured KEY=VALUE format per row
# --------------------------------------------------
def summarize_table(table_text: str) -> str:
    """
    Convert university prospectus table into structured text.
    Every number, code, and value is copied EXACTLY as written.
    """

    if not table_text or not table_text.strip():
        return "No table content available."

    table_text = safe_truncate_table(table_text.strip())

    prompt = f"""You are extracting data from an official university prospectus table.

YOUR ONLY JOB: Convert each row of the table into one clear sentence.
Copy ALL numbers, codes, and values EXACTLY as they appear in the table.

STRICT RULES:
1. Copy every number exactly — do NOT change 3 to 4, or 1500 to 1600
2. Copy every course code exactly — CS-101, BSH-232, etc.
3. Copy every credit hour value exactly
4. Copy every fee amount exactly
5. Copy every merit score or percentage exactly
6. One sentence per row
7. Do NOT summarize multiple rows into one
8. Do NOT add any information not in the table
9. Do NOT skip any row

OUTPUT FORMAT (follow exactly):
For course tables:
[COURSE_CODE] [Course Name] has [X] credit hours, [X] theory hours, [X] lab hours. Prerequisite: [value].

For fee tables:
[Program Name] [Semester/Year] fee is [exact amount] PKR. [Any conditions exactly as written].

For merit/admission tables:
[Program] [Year/Batch] merit position [number] has aggregate [exact percentage]%.

For any other table:
Write one sentence per row copying all values exactly.

TABLE DATA:
{table_text}

STRUCTURED OUTPUT (one sentence per row, exact values only):"""

    response = llm.invoke([HumanMessage(content=prompt)])
    summary = response.content.strip()

    if len(summary.split()) < 10:
        return f"Table data (raw): {table_text[:500]}"

    return summary


# --------------------------------------------------
# Example usage
# --------------------------------------------------
if __name__ == "__main__":
    example_table = """
    Course Code | Course Title                          | Theory | Lab | Cr.Hrs. | Prerequisite (if any)
    SE-103      | Discrete Structures                   | 3      | 0   | 3       | None
    SE-104      | Object Oriented Programming           | 3      | 0   | 3       | SE-102
    SE-104L     | Object Oriented Programming Lab       | 0      | 3   | 1       | SE-102L
    BSH-130     | Applied Physics                       | 3      | 0   | 3       | None
    BSH-201     | Communication & Presentation Skills   | 3      | 0   | 3       | None
    BSH-***     | General Education Elective-I          | 3      | 0   | 3       | None
    """

    summary = summarize_table(example_table)
    print("Summary:\n", summary)