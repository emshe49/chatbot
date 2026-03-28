const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Routes
const ingestionHistoryRoute = require("./routes/ingestionHistory");
const uploadRoute = require("./routes/upload");
const ingestionProgress = require("./routes/ingestionProgress");
const seedAdmin = require("./seed/adminSeed");
const adminAuthRoutes = require("./routes/adminAuth");
// User routes
const scraperRoutes = require("./routes/scraperRoutes");


// Models
const Ingestion = require("./models/Ingestion"); // For analytics

const chatRoutes = require("./routes/chat");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ---------------------------
// MongoDB connection
// ---------------------------
mongoose.connect("mongodb://127.0.0.1:27017/ingestionDB")
  .then(async () => {
    console.log("MongoDB Connected");

    // Seed default admin if not exists
    await seedAdmin();

    // Recover unfinished ingestion jobs
    await Ingestion.updateMany(
      { status: "Processing" },
      { status: "Failed" }
    );

    console.log("Recovered unfinished jobs");
  })
  .catch(err => console.log("MongoDB Connection Error:", err));

// ---------------------------
// Ingestion & Upload Routes
// ---------------------------
app.use("/api", uploadRoute);
app.get("/api/ingestion-progress", ingestionProgress);
app.post("/api/cancel-ingestion", ingestionProgress.cancelIngestion);
app.use("/api/ingestion-history", ingestionHistoryRoute);
app.use("/api", chatRoutes);
app.use("/api/scraper", scraperRoutes);
// ---------------------------
// Authentication Routes
// ---------------------------
app.use("/api/auth", adminAuthRoutes); // Admin login


// ---------------------------
// Analytics Endpoint
// ---------------------------
app.get("/api/analytics", async (req, res) => {
  try {
    const totalFiles = await Ingestion.countDocuments();

    const totalChunksAgg = await Ingestion.aggregate([
      { $group: { _id: null, sum: { $sum: "$chunkCount" } } }
    ]);

    const totalEmbeddingsAgg = await Ingestion.aggregate([
      { $group: { _id: null, sum: { $sum: "$embeddingCount" } } }
    ]);

    res.json({
      totalFiles,
      totalChunks: totalChunksAgg[0]?.sum || 0,
      totalEmbeddings: totalEmbeddingsAgg[0]?.sum || 0
    });
  } catch (err) {
    console.error("Analytics Error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ---------------------------
// Chatbot / User Example Routes
// ---------------------------
// You can later add routes for namespaces, new_session, chat, etc.
// Example:
// app.get("/api/namespaces", namespaceController.getNamespaces);
// app.post("/api/chat", chatController.handleChat);

// ---------------------------
// Start Server
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
