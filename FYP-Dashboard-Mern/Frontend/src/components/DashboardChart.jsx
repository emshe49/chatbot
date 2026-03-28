import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

function DashboardChart() {
  const data = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        label: "Web Pages Scraped",
        data: [120, 190, 300, 250, 220, 310],
        backgroundColor: "#3b82f6",
      },
    ],
  };

  return (
    <div className="chart-container">
      <h3>Monthly Web Pages Scraped</h3>
      <Bar data={data} />
    </div>
  );
}

export default DashboardChart;
