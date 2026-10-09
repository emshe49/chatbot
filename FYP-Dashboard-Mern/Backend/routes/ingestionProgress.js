const { spawn } = require("child_process");
const path = require("path");
const Ingestion = require("../models/Ingestion");
const getPythonPath = require("../utils/pythonPath");

let activeProcess = null;

module.exports = async (req, res) => {
  const { pdfPath, datasetType } = req.query;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const scriptPath = path.join(
    __dirname,
    "../../../UniversityChatbotFinal/scripts/run_ingestion.py"
  );

  let chunkCount = 0;
  let embeddingCount = 0;

  // ✅ Create DB record immediately
  const record = await Ingestion.create({
    fileName: path.basename(pdfPath),
    filePath: pdfPath,
    datasetType,
    chunkCount: 0,
    embeddingCount: 0,
    progress: 0,
    status: "Processing"
  });

  const recordId = record._id;

  const py = spawn(getPythonPath(), ["-u", scriptPath, pdfPath, datasetType]);
  activeProcess = py;

  py.on("error", async (err) => {
    console.error("❌ Ingestion spawn error:", err.message);
    await Ingestion.findByIdAndUpdate(recordId, { status: "Failed" });
    res.write(
      `data: ${JSON.stringify({
        progress: 0,
        message: `Python spawn error: ${err.message}`,
        done: true
      })}\n\n`
    );
    activeProcess = null;
    res.end();
  });

  py.stdout.on("data", async (data) => {
    const lines = data.toString().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.startsWith("PROGRESS::")) {
        const [, percent, message] = line.trim().split("::");

        if (message.includes("chunks")) {
          const match = message.match(/\d+/);
          if (match) chunkCount = Number(match[0]);
        }

        if (message.includes("embeddings")) {
          const match = message.match(/\d+/);
          if (match) embeddingCount = Number(match[0]);
        }

        await Ingestion.findByIdAndUpdate(recordId, {
          chunkCount,
          embeddingCount,
          progress: Number(percent),
          status: Number(percent) === 100 ? "Completed" : "Processing"
        });

        res.write(
          `data: ${JSON.stringify({
            progress: Number(percent),
            message,
            chunkCount,
            embeddingCount
          })}\n\n`
        );
      }
    }
  });

  py.on("close", async (code) => {
    if (code !== 0) {
      await Ingestion.findByIdAndUpdate(recordId, {
        status: "Failed"
      });

      res.write(
        `data: ${JSON.stringify({
          progress: 0,
          message: "Processing failed",
          done: true
        })}\n\n`
      );
    }

    activeProcess = null;
    res.end();
  });
};

// Cancel API
module.exports.cancelIngestion = async (req, res) => {
  if (activeProcess) {
    activeProcess.kill("SIGTERM");
    activeProcess = null;

    await Ingestion.updateMany(
      { status: "Processing" },
      { status: "Failed" }
    );

    return res.json({ status: "cancelled" });
  }

  res.json({ status: "no active process" });
};
