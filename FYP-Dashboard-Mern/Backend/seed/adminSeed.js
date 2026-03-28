const bcrypt = require("bcryptjs");
const User = require("../models/User");

const seedAdmin = async () => {
  try {
    if (!(await User.findOne({ role: "admin" }))) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await User.create({
        name: "Super Admin",
        email: "admin@example.com",
        password: hashedPassword,
        role: "admin",
      });
      console.log("Admin account created");
    }
  } catch (error) {
    console.error("Admin seeding error:", error);
  }
};

module.exports = seedAdmin;
