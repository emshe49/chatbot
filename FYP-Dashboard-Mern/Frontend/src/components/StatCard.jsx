function StatCard({ title, value, icon, borderColor }) {
  return (
    <div
      className="stat-card"
      style={{ borderLeft: `5px solid ${borderColor}` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {icon}
        <div>
          <h4>{title}</h4>
          <h2>{value}</h2>
        </div>
      </div>
    </div>
  );
}

export default StatCard;
