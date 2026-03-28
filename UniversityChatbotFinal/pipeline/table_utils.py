import re

def table_to_text(table_element) -> str:
    """
    Convert table element into clean structured text for summarization.

    FIX: Old version left raw HTML tags like <td>, <tr> in the output.
    This confused the LLM during summarization → wrong numbers.

    New version properly strips HTML and builds a pipe-separated table
    that the LLM can read row by row clearly.
    """

    # -----------------------------------------------
    # Priority 1: Use HTML and convert to clean table
    # -----------------------------------------------
    if hasattr(table_element, "metadata") and table_element.metadata.text_as_html:
        html = table_element.metadata.text_as_html

        try:
            clean_table = html_to_pipe_table(html)
            if clean_table and len(clean_table.strip()) > 10:
                return clean_table
        except Exception:
            pass  # Fall through to plain text

    # -----------------------------------------------
    # Priority 2: Plain text fallback
    # -----------------------------------------------
    if hasattr(table_element, "text") and table_element.text:
        return table_element.text.strip()

    return ""


def html_to_pipe_table(html: str) -> str:
    """
    Convert HTML table to pipe-separated plain text.

    Example output:
    Course Code | Course Name | Credits | Pre-Requisite
    CS-101 | Intro to CS | 3 | None
    BSH-232 | Complex Variables | 3 | None
    """

    # Remove everything inside <thead>, keep content
    html = re.sub(r"<thead>|</thead>|<tbody>|</tbody>|<tfoot>|</tfoot>", "", html)

    rows = []

    # Find all table rows
    tr_pattern = re.compile(r"<tr[^>]*>(.*?)</tr>", re.DOTALL | re.IGNORECASE)
    for tr_match in tr_pattern.finditer(html):
        row_html = tr_match.group(1)

        # Extract all cells (th or td)
        cell_pattern = re.compile(r"<t[hd][^>]*>(.*?)</t[hd]>", re.DOTALL | re.IGNORECASE)
        cells = []
        for cell_match in cell_pattern.finditer(row_html):
            cell_text = cell_match.group(1)
            # Remove any remaining HTML tags inside cell
            cell_text = re.sub(r"<[^>]+>", " ", cell_text)
            # Normalize whitespace
            cell_text = " ".join(cell_text.split()).strip()
            cells.append(cell_text)

        if cells:
            rows.append(" | ".join(cells))

    if not rows:
        # If no rows found, just strip all HTML
        plain = re.sub(r"<[^>]+>", " ", html)
        plain = " ".join(plain.split())
        return plain

    return "\n".join(rows)
