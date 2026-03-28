import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

# ----------------------------
# CONFIG
# ----------------------------
CSV_FILE = "evaluation_results/retriever_eval_20260126_232233.csv"  # your CSV path
OUTPUT_DIR = "evaluation_results/plots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ----------------------------
# LOAD CSV
# ----------------------------
df = pd.read_csv(CSV_FILE)

# Ensure column names are correct
# Expecting: ['Question', 'Recall', 'Precision@8', 'RR', 'Method']
print(df.head())

# ----------------------------
# SET STYLE
# ----------------------------
sns.set(style="whitegrid")
plt.rcParams.update({'figure.figsize': (12,6), 'axes.titlesize':16, 'axes.labelsize':14})

# ----------------------------
# PLOT 1: Recall@8 per Question
# ----------------------------
plt.figure()
sns.barplot(x=df.index+1, y="Recall", data=df, palette="Blues_d")
plt.title("Recall@8 per Question")
plt.xlabel("Question #")
plt.ylabel("Recall (0 or 1)")
plt.ylim(0,1.1)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "recall_per_question.png"))
plt.show()

# ----------------------------
# PLOT 2: Precision@8 per Question
# ----------------------------
plt.figure()
sns.barplot(x=df.index+1, y="Precision@8", data=df, palette="Greens_d")
plt.title("Precision@8 per Question")
plt.xlabel("Question #")
plt.ylabel("Precision@8")
plt.ylim(0,1.1)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "precision_per_question.png"))
plt.show()

# ----------------------------
# PLOT 3: Reciprocal Rank (RR) per Question
# ----------------------------
plt.figure()
sns.barplot(x=df.index+1, y="RR", data=df, palette="Oranges_d")
plt.title("Reciprocal Rank (RR) per Question")
plt.xlabel("Question #")
plt.ylabel("RR")
plt.ylim(0,1.1)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "rr_per_question.png"))
plt.show()

# ----------------------------
# PLOT 4: Method breakdown
# ----------------------------
plt.figure()
method_counts = df['Method'].value_counts()
sns.barplot(x=method_counts.index, y=method_counts.values, palette="Set2")
plt.title("Retriever Method Breakdown")
plt.xlabel("Method")
plt.ylabel("Number of Questions")
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "method_breakdown.png"))
plt.show()

# ----------------------------
# PLOT 5: Avg Metrics Summary
# ----------------------------
avg_recall = df['Recall'].mean()
avg_precision = df['Precision@8'].mean()
avg_mrr = df['RR'].mean()

plt.figure()
metrics = ['Avg Recall@8', 'Avg Precision@8', 'MRR']
values = [avg_recall, avg_precision, avg_mrr]
sns.barplot(x=metrics, y=values, palette="coolwarm")
plt.title("Average Metrics")
plt.ylim(0,1.1)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "avg_metrics.png"))
plt.show()

print(f"\n✅ Plots saved to: {OUTPUT_DIR}")
print(f"Avg Recall@8: {avg_recall:.2f}, Avg Precision@8: {avg_precision:.2f}, MRR: {avg_mrr:.2f}")
