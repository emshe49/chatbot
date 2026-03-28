import "../styles/layout.css";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { FaUsers, FaComments, FaClock, FaRobot } from "react-icons/fa";
import { useEffect, useState } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function Analytics() {
  const [data, setData] = useState(null);
  const token = localStorage.getItem("adminToken");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(
          "http://localhost:5000/api/admin/analytics",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("Analytics Error:", err);
      }
    };

    fetchAnalytics();
  }, [token]);

  if (!data) return <p>Loading analytics...</p>;

  const lineData = {
    labels: data.months,
    datasets: [
      {
        label: "User Queries",
        data: data.userCounts,
        borderColor: "#2563eb",
        backgroundColor: "#2563eb33",
        tension: 0.4,
      },
    ],
  };

  const barData = {
    labels: data.months,
    datasets: [
      {
        label: "User Queries",
        data: data.userCounts,
        backgroundColor: "#f97316",
      },
      {
        label: "Bot Responses",
        data: data.botCounts,
        backgroundColor: "#2563eb",
      },
    ],
  };

  return (
    <div>
      <div className="dashboard-welcome">
        <h2>Analytics Overview</h2>
        <p>Live system metrics and chatbot activity</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <FaUsers size={24} color="#2563eb" />
          <div>
            <h4>Total Users</h4>
            <h2>{data.totalUsers}</h2>
          </div>
        </div>

        <div className="stat-card">
          <FaComments size={24} color="#f97316" />
          <div>
            <h4>Total Queries</h4>
            <h2>{data.totalQueries}</h2>
          </div>
        </div>

        <div className="stat-card">
          <FaClock size={24} color="#eab308" />
          <div>
            <h4>Pending Queries</h4>
            <h2>{data.pendingQueries}</h2>
          </div>
        </div>

        <div className="stat-card">
          <FaRobot size={24} color="#10b981" />
          <div>
            <h4>Total Bot Responses</h4>
            <h2>{data.totalResponses}</h2>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <Line data={lineData} />
        </div>

        <div className="chart-container">
          <Bar data={barData} />
        </div>
      </div>
    </div>
  );
}

export default Analytics;