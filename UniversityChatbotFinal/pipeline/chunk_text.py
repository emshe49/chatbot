from typing import List, Dict
import re
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# --------------------------------------------------
# SECTION HEADER DETECTION
# --------------------------------------------------
SECTION_HEADER_REGEX = re.compile(
    r"""
    ^\s*
    (
        \d+\s+[A-Z][A-Z\s]+            # 4 APPLICATION PROCEDURE
        |
        \d+\.\d+                       # 4.1 , 4.2 , 5.3
        |
        [A-Z][A-Z\s]{5,}               # ELIGIBILITY FOR ADMISSION
    )
    """,
    re.VERBOSE
)

def is_section_header(text: str) -> bool:
    """Detect if a text block is a section header"""
    return bool(SECTION_HEADER_REGEX.match(text.strip()))

# --------------------------------------------------
# SEMANTIC CHUNKING FUNCTION
# --------------------------------------------------
def chunk_text_blocks(
    text_blocks: List[str],
    base_metadata: Dict,
    min_tokens: int = 400,
    max_tokens: int = 700,
    chunk_overlap: int = 75
) -> List[Document]:
    """
    True semantic chunking for prospectus PDFs.

    Features:
    ✔ Preserves semantic meaning
    ✔ Dynamically merges small paragraphs
    ✔ Splits long sections intelligently
    ✔ Adds rich metadata for RAG
    """

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_tokens,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". "]
    )

    documents: List[Document] = []
    current_section_blocks: List[str] = []
    current_section_title = None
    chunk_counter = 0

    def flush_section():
        """Flush current section into semantic chunks"""
        nonlocal chunk_counter
        if not current_section_blocks:
            return

        # Merge blocks into a single section text
        section_text = "\n".join(current_section_blocks).strip()
        if not section_text:
            return

        # Split intelligently if section is too long
        chunks = splitter.split_text(section_text)

        for chunk in chunks:
            # Skip extremely short chunks
            if len(chunk.split()) < 20:
                continue
            chunk_counter += 1
            documents.append(
                Document(
                    page_content=chunk,
                    metadata={
                        **base_metadata,
                        "chunk_id": chunk_counter,
                        "chunk_type": "text",
                        "section": current_section_title or "general",
                        "chunk_length": len(chunk)
                    }
                )
            )

    # --------------------------------------------------
    # Iterate over text blocks
    # --------------------------------------------------
    for block in text_blocks:
        if not block or not block.strip():
            continue

        block = block.strip()

        # If new section → flush previous
        if is_section_header(block):
            flush_section()
            current_section_title = block
            current_section_blocks = [block]
        else:
            current_section_blocks.append(block)

    # Flush final section
    flush_section()

    return documents

# --------------------------------------------------
# EXAMPLE USAGE
# --------------------------------------------------
if __name__ == "__main__":
    text_blocks = [
        "1 ADMISSION CRITERIA",
        "All applicants must meet eligibility criteria.",
        "4.1 Minimum Grades",
        "Applicants must have at least 60% marks.",
        "4.2 Application Procedure",
        "Fill the online form and submit documents.",
        "Eligibility documents include transcripts, CNIC, and other certificates."
    ]

    base_metadata = {
        "source_file": "Prospectus_25-26.pdf",
        "university": "UET Mardan"
    }

    docs = chunk_text_blocks(text_blocks, base_metadata)

    for d in docs:
        print(d.metadata)
        print(d.page_content)
        print("---")
