import re

def clean_text_blocks(text_blocks):
    """
    Light cleaning:
    - Remove headers/footers (prospectus, website, page numbers)
    - Normalize whitespace
    - Keep all meaningful content including:
      * Semester headings
      * Short important lines
      * Course titles
    """

    cleaned = []

    REMOVE_TEXTS = {
        "UET MARDAN, UNDERGRADUATE PROSPECTUS 2025-2026",
        "UET MARDAN, POSTGRADUATE PROSPECTUS 2024-2025",
        "www.uetmardan.edu.pk"
    }

    PAGE_NUMBER_PATTERN = re.compile(r"^page\s*\d+$", re.IGNORECASE)

    for text in text_blocks:
        # Normalize whitespace
        text = text.replace("\n", " ").replace("\t", " ")
        text = " ".join(text.split())

        # Skip empty text
        if not text:
            continue

        # Remove known boilerplate headers/footers
        if any(bt.lower() in text.lower() for bt in REMOVE_TEXTS):
            continue

        # Remove page numbers like "Page 12"
        if PAGE_NUMBER_PATTERN.match(text):
            continue

        cleaned.append(text)

    return cleaned
