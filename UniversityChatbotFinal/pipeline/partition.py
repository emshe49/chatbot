from unstructured.partition.pdf import partition_pdf
from unstructured.documents.elements import Table


def partition_pdf_document(pdf_path: str):
    """
    Partition PDF into text and tables (hi_res).
    """

    elements = partition_pdf(
        filename=pdf_path,
        strategy="hi_res",
        infer_table_structure=True,
        extract_images_in_pdf=False,
        include_page_breaks=False,
    )

    text_elements = []
    table_elements = []

    for el in elements:
        if isinstance(el, Table):
            table_elements.append(el)
        else:
            if hasattr(el, "text") and el.text:
                cleaned = el.text.strip()
                if cleaned:
                    text_elements.append(cleaned)

    return {
        "text": text_elements,
        "tables": table_elements,
        "total_elements": len(elements),
    }
