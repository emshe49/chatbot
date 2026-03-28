const express = require("express");
const router = express.Router();
const Ingestion = require("../models/Ingestion");

router.get("/", async (req, res) => {
  try {
    const records = await Ingestion.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ingestion history" });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedRecord = await Ingestion.findByIdAndDelete(id);
    
    if (!deletedRecord) {
      return res.status(404).json({ error: "Record not found" });
    }
    
    res.json({ 
      message: "Record deleted successfully", 
      deletedRecord 
    });
  } catch (err) {
    console.error("Error deleting ingestion record:", err);
    res.status(500).json({ error: "Failed to delete ingestion record" });
  }
});

module.exports = router;
