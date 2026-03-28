import os
from langsmith import Client
from dotenv import load_dotenv
from scripts.chat import ask_question  # Your RAG function

# --------------------------------------------------
# LOAD ENV VARIABLES
# --------------------------------------------------
load_dotenv()

os.environ["LANGCHAIN_TRACING_V2"] = "true"
# ⚠️ Better: store API key in .env instead of hardcoding
# os.environ["LANGCHAIN_API_KEY"] = "your_key_here"

client = Client()

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
DATASET_ID = "e21fbec5-7704-4619-889d-ae5bd61c64c9"
NAMESPACE = "UNDERGRADUATE PROSPECTUS 2025-26 V1"
USER_TYPE = "Student"
SESSION_ID = "evaluation-session"

# --------------------------------------------------
# RAG APP FUNCTION (LangSmith compatible)
# --------------------------------------------------
def rag_app(inputs: dict) -> dict:
    question = inputs["question"]

    answer = ask_question(
        question=question,
        namespace=NAMESPACE,
        user_type=USER_TYPE,
        session_id=SESSION_ID
    )

    return {"answer": answer}


# --------------------------------------------------
# EXACT MATCH EVALUATOR (Correct Signature)
# --------------------------------------------------
def exact_match_evaluator(run, example):
    predicted_answer = run.outputs.get("answer", "")
    reference_answer = example.outputs.get("answer", "")

    score = int(
        predicted_answer.strip().lower()
        == reference_answer.strip().lower()
    )

    return {
        "key": "exact_match",
        "score": score,
    }


# --------------------------------------------------
# RUN EVALUATION
# --------------------------------------------------
print("\n🔍 Running evaluation on dataset...\n")

results = client.evaluate(
    rag_app,
    data=DATASET_ID,
    evaluators=[exact_match_evaluator],
    experiment_prefix="University-RAG-Evaluation"
)

# --------------------------------------------------
# PRINT RESULTS (Correct Access Pattern)
# --------------------------------------------------
print("\n🎓 Evaluation Results Summary:\n")

for result in results:
    example = result.example
    run = result.run
    scores = result.evaluation_results

    question = example.inputs.get("question")
    reference = example.outputs.get("answer")
    predicted = run.outputs.get("answer")

    exact_match_score = None
    for s in scores:
        if s.key == "exact_match":
            exact_match_score = s.score

    print("-" * 60)
    print(f"Q         : {question}")
    print(f"Reference : {reference}")
    print(f"Predicted : {predicted}")
    print(f"Exact Match Score: {exact_match_score}")

print("\n✅ Evaluation complete! Check full metrics in LangSmith UI.")
