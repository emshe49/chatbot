import { useState } from "react";
import { 
  Play, 
  Clock, 
  FileText, 
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Database,
  Globe,
  BarChart3
} from "lucide-react";

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

    eventSource.addEventListener("progress", (event) => {
      const percent = parseInt(event.data);
      if (!isNaN(percent)) {
        setProgress(percent);
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      setScrapingStatus("idle");
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Auto Web Scraping
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Monitor and control automated web scraping for university data
              </p>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-3 rounded-2xl">
              <Database className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        

        {/* Scraping Control */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <div className="flex flex-col items-center space-y-6">
            <button
              onClick={startScraping}
              disabled={scrapingStatus === "running"}
              className={`
                relative group px-8 py-4 rounded-xl font-semibold text-lg
                transition-all duration-300 transform hover:scale-105
                flex items-center gap-3 shadow-md
                ${scrapingStatus === "running" 
                  ? "bg-gray-400 cursor-not-allowed opacity-50" 
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                }
              `}
            >
              {scrapingStatus === "running" ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Scraping in Progress...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Scraping
                </>
              )}
            </button>

            {scrapingStatus === "running" && (
              <div className="w-full max-w-md space-y-2">
                <div className="relative pt-1">
                  <div className="overflow-hidden h-3 text-xs flex rounded-full bg-gray-200">
                    <div
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-center text-sm font-medium text-gray-600">
                  {progress}% completed
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Live Log Panel */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
              <h3 className="text-white font-semibold text-lg">Live Scraping Logs</h3>
              <span className="ml-auto text-xs text-gray-400 font-mono">
                {logs.length} entries
              </span>
            </div>
          </div>
          
          <div className="bg-gray-900 p-6 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-mono text-sm">
                  No logs yet. Start scraping to see real-time logs...
                </p>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`
                      p-3 rounded-lg border-l-4 transition-all duration-200
                      ${log.type === "error" 
                        ? "bg-red-900/20 border-red-500 text-red-300" 
                        : "bg-gray-800/50 border-blue-500 text-gray-300"
                      }
                      hover:bg-opacity-100 transform hover:translate-x-1
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        [{log.time}]
                      </span>
                      <span className="flex-1 break-all">
                        {log.message}
                      </span>
                      {log.type === "error" ? (
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scraping History */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Recent Scraping History</h3>
          </div>
          
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <Globe className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{item.website}</p>
                    <p className="text-sm text-gray-500">{item.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Pages Scraped</p>
                    <p className="font-semibold text-gray-800">{item.pages}</p>
                  </div>
                  <div className="bg-green-100 px-3 py-1 rounded-full">
                    <span className="text-xs font-medium text-green-700">{item.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AutoScraping;