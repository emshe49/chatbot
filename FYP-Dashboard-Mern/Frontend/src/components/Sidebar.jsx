import { NavLink, useNavigate } from "react-router-dom";
import "../styles/layout.css";

function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("adminToken"); // Remove token
    navigate("/login"); // Redirect to login
  };

  return (
    <aside className="sidebar">
      <h2 className="logo">Admin Dashboard</h2>

      <nav className="nav-links">
        <NavLink to="admin/dashboard" end className="nav-item">
          Dashboard
        </NavLink>

        <NavLink to="admin/upload-prospectus" className="nav-item">
          Upload Prospectus
        </NavLink>
        <NavLink to="admin/analytics" className="nav-item">
          Analytics
        </NavLink>

        <NavLink to="admin/auto-scraping" className="nav-item">
          Auto Scraping
        </NavLink>

        <NavLink to="admin/settings" className="nav-item">
          Settings
        </NavLink>
      </nav>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        style={{
          marginTop: "auto",
          width: "90%",
          marginLeft: "5%",
          padding: "10px",
          backgroundColor: "#f97316",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;