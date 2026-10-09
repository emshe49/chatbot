const cron = require("node-cron");
const { spawn } = require("child_process");
const path = require("path");
const getPythonPath = require("../utils/pythonPath");

let isRunning = false;

function runNotificationPipeline() {

    if (isRunning) {
        console.log("⚠ Pipeline already running...");
        return;
    }

    isRunning = true;

    console.log("\n=================================");
    console.log("🚀 Auto Notification Pipeline Started");
    console.log("Time:", new Date().toLocaleString());
    console.log("=================================\n");

    const scriptPath = path.join(
        __dirname,
        "../../../UniversityChatbotFinal/scripts/run_notifications.py"
    );

    const pythonExecutable = getPythonPath();
    console.log("Using Python executable:", pythonExecutable);

    const pythonProcess = spawn(
        pythonExecutable,
        ["-u", scriptPath]
    );

    // =========================
    // PROCESS ERROR HANDLER (PREVENTS CRASHES)
    // =========================
    pythonProcess.on("error", (err) => {
        console.error("❌ Failed to spawn Python notification script:", err.message);
        isRunning = false;
    });

    // =========================
    // STDOUT
    // =========================
    pythonProcess.stdout.on("data", (data) => {
        console.log(data.toString());
    });

    // =========================
    // STDERR
    // =========================
    pythonProcess.stderr.on("data", (data) => {
        console.error("❌ ERROR:", data.toString());
    });

    // =========================
    // PROCESS END
    // =========================
    pythonProcess.on("close", (code) => {
        console.log(`\n✅ Pipeline Finished (Exit Code: ${code})`);
        console.log("=================================\n");
        isRunning = false;
    });

    // =========================
    // SAFETY TIMEOUT
    // =========================
    setTimeout(() => {
        if (isRunning) {
            console.log("⚠ Force stopping pipeline (timeout reached)");
            try {
                pythonProcess.kill("SIGKILL");
            } catch (e) {
                // Ignore kill errors
            }
            isRunning = false;
        }
    }, 1000 * 60 * 20); // 20 minutes max runtime
}

/*
=================================
CRON JOB
=================================
Runs every 360 minutes
*/
cron.schedule("*/360 * * * *", () => {
    console.log("\n⏰ Cron Triggered");
    runNotificationPipeline();
});

console.log("✅ Notification Scheduler Started");

module.exports = runNotificationPipeline;