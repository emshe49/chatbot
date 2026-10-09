const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const getPythonPath = require("../utils/pythonPath");

const router = express.Router();

router.get("/run-scraper", (req, res) => {

  // =========================
  // SSE HEADERS
  // =========================
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // =========================
  // PYTHON PATH
  // =========================
  const scriptPath = path.join(
    __dirname,
    "../../../UniversityChatbotFinal/scripts/run_notifications.py"
  );

  const pythonExecutable = getPythonPath();
  const pythonProcess = spawn(pythonExecutable, ["-u", scriptPath]);

  // =========================
  // ERROR EVENT HANDLER
  // =========================
  pythonProcess.on("error", (err) => {
    console.error("❌ Scraper spawn error:", err.message);
    res.write(`event: log\n`);
    res.write(`data: ${JSON.stringify({
      message: `Failed to spawn Python process: ${err.message}`,
      step: "error",
      time: new Date().toLocaleTimeString()
    })}\n\n`);
    res.end();
  });

  // =========================
  // CLEAN FUNCTION
  // =========================
  const clean = (text) => {
    if (!text) return "";
    return text
      .replace(/\r/g, "")
      .replace(/\u001b\[[0-9;]*m/g, "")
      .trim();
  };

  // =========================
  // STEP DETECTION (FIXED)
  // =========================
  const detectStep = (msg) => {
    const text = msg.toLowerCase();

    if (
      text.includes("scraper") ||
      text.includes("events archive") ||
      text.includes("news archive") ||
      text.includes("opening")
    ) return "scraper";

    if (
      text.includes("chunk") ||
      text.includes("incremental chunking")
    ) return "chunking";

    if (
      text.includes("embedding") ||
      text.includes("pinecone") ||
      text.includes("sentence") ||
      text.includes("index")
    ) return "embedding";

    if (
      text.includes("retriev")
    ) return "retriever";

    if (
      text.includes("finished") ||
      text.includes("pipeline completed")
    ) return "done";

    return "general";
  };

  // =========================
  // SEND LOG
  // =========================
  const sendLog = (line) => {
    const message = clean(line);
    if (!message) return;

    const step = detectStep(message);

    const payload = JSON.stringify({
      message,
      step,
      time: new Date().toLocaleTimeString()
    });

    res.write(`event: log\n`);
    res.write(`data: ${payload}\n\n`);
  };

  // =========================
  // STDOUT
  // =========================
  pythonProcess.stdout.setEncoding("utf8");

  pythonProcess.stdout.on("data", (data) => {
    const buffer = data.toString();

    buffer.split(/\r?\n/).forEach((line) => {
      const msg = clean(line);
      if (!msg) return;

      // Progress handling
      if (msg.startsWith("PROGRESS:")) {
        const percent = msg.replace("PROGRESS:", "").trim();
        res.write(`event: progress\n`);
        res.write(`data: ${percent}\n\n`);
      } else {
        sendLog(msg);
      }
    });
  });

  // =========================
  // STDERR
  // =========================
  pythonProcess.stderr.on("data", (data) => {
    sendLog(data.toString());
  });

  // =========================
  // CLOSE
  // =========================
  pythonProcess.on("close", () => {
    res.write(`event: log\n`);
    res.write(`data: ${JSON.stringify({
      message: "Pipeline completed successfully 🎉",
      step: "done",
      time: new Date().toLocaleTimeString()
    })}\n\n`);
    res.end();
  });

  req.on("close", () => {
    try {
      pythonProcess.kill();
    } catch (e) {
      // Ignore kill error
    }
  });

});

module.exports = router;