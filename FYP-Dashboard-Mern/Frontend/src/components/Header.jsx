import "../styles/layout.css";

function Header() {
  return (
    <div className="header">
      <h4>Dashboard</h4>
      {/* Profile Placeholder */}
      <div
        style={{
          width: 35,
          height: 35,
          borderRadius: "50%",
          background: "#1e293b",
        }}
      ></div>
    </div>
  );
}

export default Header;
