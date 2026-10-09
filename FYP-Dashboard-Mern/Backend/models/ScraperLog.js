const mongoose = require("mongoose");

const ScraperLogSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: "info"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent model overwrite error in dev (nodemon)
module.exports = mongoose.models.ScraperLog || mongoose.model("ScraperLog", ScraperLogSchema);