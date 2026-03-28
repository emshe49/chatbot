const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { protect, allowRoles } = require("../middleware/auth");
const User = require("../models/User");

// Update Admin Password
router.put("/change-password", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const admin = await User.findById(req.user._id);

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;