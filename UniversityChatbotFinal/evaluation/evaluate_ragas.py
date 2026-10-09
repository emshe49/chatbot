import os
import json
import time

from dotenv import load_dotenv
from datasets import Dataset

from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
    answer_correctness
)

import ragas.llms
ragas.llms.DEFAULT_N_GENERATIONS = 1

from langchain_openai import ChatOpenAI
from ragas.llms import LangchainLLMWrapper


from sentence_transformers import SentenceTransformer
from langchain_core.embeddings import Embeddings
from ragas.embeddings import LangchainEmbeddingsWrapper


# =====================================================
# ENV
# =====================================================

load_dotenv()

os.environ["RAGAS_MAX_CONCURRENT"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["OMP_NUM_THREADS"] = "1"



# =====================================================
# FILE
# =====================================================

INPUT_FILE = "ragas_input.json"


if not os.path.exists(INPUT_FILE):
    raise FileNotFoundError(
        "ragas_input.json not found"
    )



# =====================================================
# EVALUATION LLM
# =====================================================

llm = ChatOpenAI(
    model="meta-llama/llama-3.3-70b-instruct",
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    temperature=0,
    max_tokens=2048,
    timeout=300,
    default_headers={
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "RAGAS-Evaluation"
    }
)


evaluator_llm = LangchainLLMWrapper(llm)



# =====================================================
# EMBEDDINGS
# =====================================================

st_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)


class CustomEmbeddings(Embeddings):

    def embed_documents(self, texts):

        return st_model.encode(
            texts,
            normalize_embeddings=True
        ).tolist()


    def embed_query(self, text):

        return st_model.encode(
            text,
            normalize_embeddings=True
        ).tolist()



embedding_model = CustomEmbeddings()


evaluator_embeddings = LangchainEmbeddingsWrapper(
    embedding_model
)



# =====================================================
# LOAD RAGAS INPUT
# =====================================================

with open(
    INPUT_FILE,
    "r",
    encoding="utf-8"
) as f:

    data = json.load(f)



print(
    f"\nLoaded {len(data)} samples"
)



# =====================================================
# CLEAN DATA
# =====================================================

final_data = []


for item in data:

    final_data.append(
        {
            "question": item.get("question",""),

            "answer":
                item.get("answer","")
                or "No answer",

            "contexts":
                item.get(
                    "contexts",
                    ["No context"]
                ),

            "ground_truth":
                item.get(
                    "ground_truth",
                    ""
                )
        }
    )



dataset = Dataset.from_list(
    final_data
)



# =====================================================
# RUN RAGAS
# =====================================================

print(
    "\nRunning RAGAS evaluation...\n"
)


start = time.time()



result = evaluate(
    dataset,

    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
        answer_correctness
    ],

    llm=evaluator_llm,

    embeddings=evaluator_embeddings,

    raise_exceptions=False
)



elapsed = (
    time.time() - start
) / 60




# =====================================================
# DISPLAY RESULTS
# =====================================================

df = result.to_pandas()


print("\n==============================")
print("FINAL RAGAS RESULTS")
print("==============================\n")


print(df)



scores = (
    df
    .mean(numeric_only=True)
    .to_dict()
)



print("\n===== AVERAGE SCORES =====\n")


for metric, score in scores.items():

    print(
        f"{metric:<25}"
        f"{score:.4f}"
        f" ({score*100:.2f}%)"
    )



print(
    f"\nTime: {elapsed:.2f} minutes"
)



# =====================================================
# SAVE
# =====================================================

timestamp = int(time.time())


df.to_csv(
    f"ragas_scores_{timestamp}.csv",
    index=False
)


with open(
    f"ragas_summary_{timestamp}.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        scores,
        f,
        indent=4
    )


print("\nSaved:")
print(f"ragas_scores_{timestamp}.csv")
print(f"ragas_summary_{timestamp}.json")
print("\nEvaluation completed.")