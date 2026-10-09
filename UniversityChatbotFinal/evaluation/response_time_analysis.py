import os
import json
import sys
import pandas as pd
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

from rag_chatbot import ask_question_with_timing

NAMESPACE = "UNDERGRADUATE_PROSPECTUS_2025-26"
USER_TYPE = "student"

with open("evaluation_data.json","r",encoding="utf-8") as f:
    dataset = json.load(f)

rows=[]

for i,item in enumerate(dataset,1):

    print(f"{i}/{len(dataset)}")

    result = ask_question_with_timing(

        item["question"],

        namespace=NAMESPACE,

        user_type=USER_TYPE,


    )

    t = result["timings"]

    rows.append({

        "Question":item["question"],

        "Embedding":t["Embedding"],

        "Retrieval":t["Retrieval"],

        "Reranking":t["Reranking"],

        "Prompt Building":t["Prompt Building"],

        "LLM Generation":t["LLM Generation"],

        "Total":t["Total"]

    })

df = pd.DataFrame(rows)

print(df)

print("\nAverage Times\n")

print(df.mean(numeric_only=True))

df.to_csv("response_time_results.csv",index=False)

summary = df.mean(numeric_only=True)

summary.to_json("response_time_summary.json",indent=4)

print("Done.")