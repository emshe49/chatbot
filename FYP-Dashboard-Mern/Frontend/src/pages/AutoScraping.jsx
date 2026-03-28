import { useState } from "react";
import "../styles/layout.css";
import "./AutoScraping.css";

function AutoScraping() {

  const [scrapingStatus, setScrapingStatus] = useState("idle");
  const [progress, setProgress] = useState(0);

  const [history, setHistory] = useState([
    { id: 1, website: "university.edu", pages: 120, time: "2026-02-06 09:00", status: "Completed" },
    { id: 2, website: "engineering.edu", pages: 80, time: "2026-02-05 15:30", status: "Completed" },
    { id: 3, website: "science.edu", pages: 200, time: "2026-02-05 11:45", status: "Completed" },
  ]);

  const [logs, setLogs] = useState([]);

  const startScraping = () => {

    setScrapingStatus("running");
    setLogs([]);
    setProgress(0);

    const eventSource = new EventSource(
      "http://localhost:5000/api/scraper/run-scraper"
    );

    // =========================
    // LOG EVENTS
    // =========================
    eventSource.addEventListener("log", (event) => {

      const message = event.data;

      const newLog = {
        time: new Date().toLocaleTimeString(),
        message: message,
        type: message.includes("ERROR") ? "error" : "info"
      };

      setLogs((prev) => [newLog, ...prev]);

      if (message.includes("PIPELINE FINISHED")) {
        setScrapingStatus("idle");
        setProgress(100);
        eventSource.close();
      }

    });

    // =========================
    // PROGRESS EVENTS
    // =========================
    eventSource.addEventListener("progress", (event) => {

      const percent = parseInt(event.data);

      if (!isNaN(percent)) {
        setProgress(percent);
      }

    });

    // =========================
    // ERROR HANDLING
    // =========================
    eventSource.onerror = () => {

      eventSource.close();
      setScrapingStatus("idle");

    };

  };

  return (
    <div>

      <div className="dashboard-welcome">
        <h2>Auto Web Scraping</h2>
        <p>Monitor and control automated web scraping for university data</p>
      </div>

      {/* Stats Cards */}
      <div className="card-container">

        <div className="scrape-card">
          <h4>Total Pages Scraped</h4>
          <p>{history.reduce((acc, h) => acc + h.pages, 0)}</p>
        </div>

        <div className="scrape-card">
          <h4>Last Scrape</h4>
          <p>{history[0]?.time || "N/A"}</p>
        </div>

        <div className="scrape-card">
          <h4>Scraping Status</h4>
          <p className={scrapingStatus === "running" ? "running" : "idle"}>
            {scrapingStatus === "running" ? "Running..." : "Idle"}
          </p>
        </div>

      </div>

      {/* Scraping Control */}
      <div className="scraping-container">

        <button
          className="scrape-btn"
          onClick={startScraping}
          disabled={scrapingStatus === "running"}
        >
          {scrapingStatus === "running" ? "Scraping..." : "Start Scraping"}
        </button>

        {scrapingStatus === "running" && (
          <div className="progress-bar">
            <div
              className="progress"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {scrapingStatus === "running" && (
          <p className="progress-text">{progress}% completed</p>
        )}

      </div>

      {/* Live Log Panel */}
      <div className="log-panel">

        <h3>Live Scraping Logs</h3>

        <div className="log-container">

          {logs.map((log, index) => (
            <div key={index} className={`log-entry ${log.type}`}>
              <span className="log-time">{log.time}</span> - {log.message}
            </div>
          ))}

        </div>

      </div>

     

    </div>
  );
}

export default AutoScraping;