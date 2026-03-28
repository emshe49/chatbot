import os
import pickle


def save_chunks_to_txt(chunks_pkl_path, output_txt_path):

    # Try loading as pickle first
    try:
        with open(chunks_pkl_path, "rb") as f:
            chunks = pickle.load(f)

        print("✅ Pickle file loaded successfully")

        with open(output_txt_path, "w", encoding="utf-8") as out:
            for i, chunk in enumerate(chunks, start=1):

                # Handle different chunk types
                if isinstance(chunk, str):
                    text = chunk
                elif hasattr(chunk, "text"):
                    text = chunk.text
                elif isinstance(chunk, dict) and "text" in chunk:
                    text = chunk["text"]
                else:
                    text = str(chunk)

                out.write(f"--- Chunk {i} ---\n")
                out.write(text.strip())
                out.write("\n\n")

        print(f"✅ Saved {len(chunks)} chunks to {output_txt_path}")

    except Exception as e:
        print("⚠️ Pickle loading failed. Trying as text file...")
        print("Error:", e)

        # If file is actually text
        with open(chunks_pkl_path, "r", encoding="utf-8") as f:
            data = f.read()

        with open(output_txt_path, "w", encoding="utf-8") as out:
            out.write(data)

        print("✅ File copied as text successfully")


if __name__ == "__main__":

    chunks_pkl = r"data/cache/notification/Scrutiny.17.03.2026.v1/table_summaries.pkl"
    output_txt = r"data/cache/notification/Scrutiny.17.03.2026.v1/table_summaries.txt"

    save_chunks_to_txt(chunks_pkl, output_txt)