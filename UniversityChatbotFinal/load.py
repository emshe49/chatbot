import json

with open('uet_mardan_evaluation_dataset.json', 'r') as f:
    dataset = json.load(f)

# Access questions
questions = [item["question"] for item in dataset["evaluation_dataset"]]
gold_answers = [item["gold_answer"] for item in dataset["evaluation_dataset"]]
