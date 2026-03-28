const mongoose = require("mongoose");

const IngestionSchema = new mongoose.Schema(
  {
    fileName: String,
    filePath: String,
    datasetType: String,
    chunkCount: { type: Number, default: 0 },
    embeddingCount: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Processing", "Completed", "Failed"],
      default: "Processing"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ingestion", IngestionSchema);
