import "../styles/layout.css";
import { useState } from "react";

function Settings() {
  const [adminName, setAdminName] = useState("Admin");
  const [email, setEmail] = useState("admin@uni.edu");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleUpdateInfo = (e) => {
    e.preventDefault();
    alert("Admin info updated (static demo)");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");

      const res = await fetch("http://localhost:5000/api/admin/settings/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to update password");

      alert(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      {/* Page Title */}
      <div className="dashboard-welcome">
        <h2>Settings</h2>
        <p>Manage admin info and system configuration</p>
      </div>

      {/* Admin Info Section */}
      <div className="chart-container" style={{ padding: "30px" }}>
        <h3 style={{ marginBottom: "20px" }}>Admin Information</h3>
        <form onSubmit={handleUpdateInfo} style={{ display: "grid", gap: "15px" }}>
          <input
            type="text"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Enter Name"
            className="settings-input"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter Email"
            className="settings-input"
          />
          <button type="submit" className="settings-btn">
            Update Info
          </button>
        </form>
      </div>

      {/* Password Change Section */}
      <div className="chart-container" style={{ marginTop: "25px", padding: "30px" }}>
        <h3 style={{ marginBottom: "20px" }}>Change Password</h3>
        <form onSubmit={handleChangePassword} style={{ display: "grid", gap: "15px" }}>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current Password"
            className="settings-input"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            className="settings-input"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            className="settings-input"
          />
          <button type="submit" className="settings-btn">
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;
