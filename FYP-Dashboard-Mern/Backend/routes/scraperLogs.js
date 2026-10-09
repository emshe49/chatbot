const express = require("express");
const ScraperLog = require("../models/ScraperLog");

const router = express.Router();

// Save log from Python scraper
router.post("/log", async (req, res) => {
  try {
    const { message, type } = req.body;

    const log = await ScraperLog.create({
      message,
      type,
      createdAt: new Date()
    });

    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get logs for UI
router.get("/logs", async (req, res) => {
  try {
    const logs = await ScraperLog.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;