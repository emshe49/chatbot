const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const { protect, allowRoles } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

// Proper node-fetch import
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* =====================================================
   CREATE NEW SESSION (PUBLIC)
===================================================== */
router.post("/new_session", async (req, res) => {
  try {
    const { namespace } = req.body;

    if (!namespace) {
      return res.status(400).json({ message: "Namespace is required" });
    }

    const sessionId = uuidv4();

    const newChat = await Chat.create({
      sessionId,
      namespace,
      title: "New Chat",
      messages: [],
    });

    res.status(201).json({ session_id: newChat.sessionId });
  } catch (error) {
    console.error("New Session Error:", error);
    res.status(500).json({ message:"Failed to create session" });
  }
});

/* =====================================================
   CHAT WITH STREAMING (PUBLIC)
===================================================== */
router.post("/chat", async (req, res) => {
  try {
    const { session_id, question, namespace } = req.body;

    if (!session_id || !question || !namespace) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const chat = await Chat.findOne({ sessionId: session_id });

    if (!chat) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Save user message
    chat.messages.push({
      sender: "user",
      text: question,
      timestamp: new Date(),
    });

    await chat.save();

    // Call FastAPI backend
    const aiResponse = await fetch("http://localhost:8000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        namespace,
        session_id,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error("AI server error");
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    let fullAIResponse = "";

    for await (const chunk of aiResponse.body) {
      const textChunk = chunk.toString();
      fullAIResponse += textChunk;
      res.write(textChunk);
    }

    res.end();

    // Save assistant reply
    chat.messages.push({
      sender: "assistant",
      text: fullAIResponse,
      timestamp: new Date(),
    });

    /* ============================================
       🔥 AUTO-GENERATE TITLE FROM FIRST RESPONSE
    ============================================ */
    if (chat.title === "New Chat") {
      const cleanTitle = fullAIResponse
        .replace(/\n/g, " ")
        .trim()
        .substring(0, 40);

      chat.title =
        cleanTitle.length >= 40
          ? cleanTitle + "..."
          : cleanTitle;
    }

    await chat.save();

  } catch (err) {
    console.error("Chat Error:", err);

    if (!res.headersSent) {
      res.status(500).json({ message: "Server error during chat" });
    }
  }
});

/* ================================================= yourselves
   GET ALL SESSIONS (FILTER BY NAMESPACE)
===================================================== */
router.get("/sessions", async (req, res) => {
  try {
    const { namespace } = req.query;

    let filter = {};
    if (namespace) {
      filter.namespace = namespace;
    }

    const chats = await Chat.find(filter)
      .sort({ updatedAt: -1 })
      .select("sessionId title namespace updatedAt");

    res.json({ sessions: chats });
  } catch (error) {
    console.error("Fetch Sessions Error:", error);
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
});

/* =====================================================
   GET CHAT HISTORY (PUBLIC)
===================================================== */
router.get("/chat-history/:session_id", async (req, res) => {
  try {
    const chat = await Chat.findOne({
      sessionId: req.params.session_id,
    });

    if (!chat) {
      return res.status(404).json([]);
    }

    res.json(chat.messages);
  } catch (error) {
    console.error("Chat History Error:", error);
    res.status(500).json({ message: "Failed to load chat history" });
  }
});

/* =====================================================
   ADMIN DASHBOARD DATA (PROTECTED)
===================================================== */
router.get(
  "/admin/dashboard-data",
  protect,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const User = require("../models/User");

      const users = await User.find().select("-password");
      const chats = await Chat.find();

      let questionFrequency = {};
      let responseFrequency = {};

      chats.forEach(chat => {
        chat.messages.forEach(msg => {
          if (msg.sender === "user") {
            questionFrequency[msg.text] =
              (questionFrequency[msg.text] || 0) + 1;
          }
          if (msg.sender === "assistant") {
            responseFrequency[msg.text] =
              (responseFrequency[msg.text] || 0) + 1;
          }
        });
      });

      const topQuestions = Object.entries(questionFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const topResponses = Object.entries(responseFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      res.json({
        totalUsers: users.length,
        topQuestions,
        topResponses,
      });
    } catch (error) {
      console.error("Admin Dashboard Error:", error);
      res.status(500).json({ message: "Failed to load dashboard data" });
    }
  }
);

/* =====================================================
   ADMIN ANALYTICS (PROTECTED)
===================================================== */
router.get(
  "/admin/analytics",
  protect,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const User = require("../models/User");
      const users = await User.find();
      const chats = await Chat.find();

      let totalQueries = 0;
      let totalResponses = 0;
      const monthlyStats = {};

      chats.forEach(chat => {
        chat.messages.forEach(msg => {
          const month = new Date(msg.timestamp).toLocaleString("default", {
            month: "short",
          });

          if (!monthlyStats[month]) {
            monthlyStats[month] = { user: 0, bot: 0 };
          }

          if (msg.sender === "user") {
            totalQueries++;
            monthlyStats[month].user++;
          }

          if (msg.sender === "assistant") {
            totalResponses++;
            monthlyStats[month].bot++;
          }
        });
      });

      const months = Object.keys(monthlyStats);
      const userCounts = months.map(m => monthlyStats[m].user);
      const botCounts = months.map(m => monthlyStats[m].bot);

      res.json({
        totalUsers: users.length,
        totalQueries,
        totalResponses,
        pendingQueries: totalQueries - totalResponses,
        months,
        userCounts,
        botCounts,
      });
    } catch (error) {
      console.error("Analytics Error:", error);
      res.status(500).json({ message: "Failed to load analytics" });
    }
  }
);

module.exports = router;