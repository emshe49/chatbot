# --------------------------------------------------
# UPDATED: Groq LLM Table Summarization with Llama 4 Scout
# CHANGE: Switched from langchain_groq to direct Groq API with streaming
# MODEL: meta-llama/llama-4-scout-17b-16e-instruct (17B parameters)
# BENEFITS: Better accuracy, streaming support, multimodal capabilities
# --------------------------------------------------

from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file!")

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

# --------------------------------------------------
# Safe truncation (row-aware)
# --------------------------------------------------
def safe_truncate_table(table_text: str, max_chars: int = 3500) -> str:
    """Truncate table while preserving row integrity"""
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
# Main summarization function with streaming
# --------------------------------------------------
def summarize_table(table_text: str, use_streaming: bool = True) -> str:
    """
    Convert university prospectus table into structured text.
    Every number, code, and value is copied EXACTLY as written.
    
    Args:
        table_text (str): The table data to summarize
        use_streaming (bool): Whether to use streaming for real-time output
    
    Returns:
        str: Structured summary of the table
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

    try:
        if use_streaming:
            # Use streaming for real-time output
            summary = ""
            print("Processing with streaming...\n")
            
            completion = client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0,  # Keep 0 for factual accuracy
                max_completion_tokens=2048,
                top_p=1,
                stream=True,
                stop=None
            )
            
            # Stream and accumulate the response
            for chunk in completion:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    print(content, end="", flush=True)
                    summary += content
            
            print("\n")  # New line after streaming
            return summary
        
        else:
            # Non-streaming mode
            completion = client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0,  # Keep 0 for factual accuracy
                max_completion_tokens=2048,
                top_p=1,
                stream=False,
                stop=None
            )
            
            summary = completion.choices[0].message.content.strip()
            return summary

    except Exception as e:
        return f"Error during summarization: {str(e)}"


# --------------------------------------------------
# Example usage
# --------------------------------------------------
if __name__ == "__main__":
    # Sample course table
    example_table = """
    Course Code | Course Title                          | Theory | Lab | Cr.Hrs. | Prerequisite (if any)
    SE-103      | Discrete Structures                   | 3      | 0   | 3       | None
    SE-104      | Object Oriented Programming           | 3      | 0   | 3       | SE-102
    SE-104L     | Object Oriented Programming Lab       | 0      | 3   | 1       | SE-102L
    BSH-130     | Applied Physics                       | 3      | 0   | 3       | None
    BSH-201     | Communication & Presentation Skills   | 3      | 0   | 3       | None
    BSH-***     | General Education Elective-I          | 3      | 0   | 3       | None
    """

    print("=" * 60)
    print("GROQ TABLE SUMMARIZER - Llama 4 Scout Model")
    print("=" * 60)
    print("\nInput Table:\n")
    print(example_table)
    print("\n" + "=" * 60)
    print("SUMMARY OUTPUT (with streaming):")
    print("=" * 60 + "\n")
    
    # Run with streaming enabled (default)
    summary = summarize_table(example_table, use_streaming=True)
    
    print("\n" + "=" * 60)
    print("Summary generated successfully!")
    print("=" * 60)