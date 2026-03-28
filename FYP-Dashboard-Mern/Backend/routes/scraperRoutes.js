const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const router = express.Router();

router.get("/run-scraper", (req, res) => {

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();

  const scriptPath = path.join(
    __dirname,
    "../../../UniversityChatbotFinal/scripts/run_notifications.py"
  );

  const pythonProcess = spawn(
    "D:\\anaconda3\\python.exe",
    ["-u", scriptPath]
  );

  pythonProcess.stdout.on("data", (data) => {

    const lines = data.toString().split("\n");

    lines.forEach((line) => {

      if (!line.trim()) return;

      console.log(line);

      if (line.startsWith("PROGRESS:")) {

        const percent = line.replace("PROGRESS:", "");

        res.write(`event: progress\n`);
        res.write(`data: ${percent}\n\n`);

      } else {

        res.write(`event: log\n`);
        res.write(`data: ${line}\n\n`);

      }

    });

  });

  pythonProcess.stderr.on("data", (data) => {

    const error = data.toString();
    console.error(error);

    res.write(`event: log\n`);
    res.write(`data: ERROR: ${error}\n\n`);

  });

  pythonProcess.on("close", () => {

    res.write(`event: log\n`);
    res.write(`data: PIPELINE FINISHED\n\n`);

    res.end();

  });

});

module.exports = router;