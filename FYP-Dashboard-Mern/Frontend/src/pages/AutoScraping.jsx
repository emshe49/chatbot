import React, { useState } from "react";
import { 
  Play, 
  Clock, 
  FileText, 
  Activity,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Database,
  Globe,
  BarChart3,
  Trash2,
  Copy,
  Terminal,
  ExternalLink,
  Cpu,
  Layers
} from "lucide-react";
import { useToast } from "../context/ToastContext";

function AutoScraping() {
  const toast = useToast();
  const [scrapingStatus, setScrapingStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([
    { id: 1, website: "https://university.edu", pages: 120, time: "2026-02-06 09:00", status: "Completed" },
    { id: 2, website: "https://engineering.edu", pages: 80, time: "2026-02-05 15:30", status: "Completed" },
    { id: 3, website: "https://science.edu", pages: 200, time: "2026-02-05 11:45", status: "Completed" },
  ]);
  const [logs, setLogs] = useState([]);

  const startScraping = () => {
    setScrapingStatus("running");
    setLogs([]);
    setProgress(0);
    toast.info("Web scraping agent initiated.", "Scraping Started");

    const eventSource = new EventSource(
      "http://localhost:5000/api/scraper/run-scraper"
    );

    eventSource.addEventListener("log", (event) => {
      let logMsg = event.data;
      let logTime = new Date().toLocaleTimeString();

      try {
        const parsed = JSON.parse(event.data);
        if (parsed.message) logMsg = parsed.message;
        if (parsed.time) logTime = parsed.time;
      } catch (err) {
        // raw string log
      }

      const isError = logMsg.toLowerCase().includes("error") || logMsg.toLowerCase().includes("failed");
      const newLog = {
        time: logTime,
        message: logMsg,
        type: isError ? "error" : "info"
      };
      setLogs((prev) => [newLog, ...prev]);

      if (logMsg.includes("PIPELINE FINISHED") || logMsg.includes("completed successfully")) {
        setScrapingStatus("idle");
        setProgress(100);
        eventSource.close();
        toast.success("All latest UET Mardan events and notices scraped, chunked, and embedded!", "Pipeline Finished");
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
      toast.error("Unable to maintain connection with scraper worker.", "Scraper Error");
    };
  };

  const handleClearLogs = () => {
    if (logs.length === 0) return;
    setLogs([]);
    toast.delete("Console output history cleared.", "Logs Emptied");
  };

  const handleCopyLogs = () => {
    if (logs.length === 0) {
      toast.warning("No log entries available to copy.", "Empty Logs");
      return;
    }
    const text = logs.map(l => `[${l.time}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Scraper logs copied to clipboard.", "Copied");
  };

  const handleDeleteHistory = (id, website) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    toast.delete(`Removed scraping record for ${website}`, "Record Deleted");
  };

  const totalPagesScraped = history.reduce((sum, h) => sum + h.pages, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              Automated Pipeline
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Web Scraping Engine
            </h1>
            <p className="mt-2 text-slate-300 text-sm max-w-2xl">
              Crawls university domains, extracts academic & program updates, and pipes structured data directly into the RAG vector index.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={startScraping}
              disabled={scrapingStatus === "running"}
              className={`
                px-6 py-3.5 rounded-2xl font-semibold text-sm shadow-lg
                flex items-center gap-2.5 transition-all duration-300 active:scale-95
                ${scrapingStatus === "running"
                  ? "bg-slate-700/80 text-slate-400 cursor-not-allowed border border-slate-600"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40"
                }
              `}
            >
              {scrapingStatus === "running" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-300" />
                  Crawler Active ({progress}%)
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Launch Scraper
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar (Visible while running) */}
        {scrapingStatus === "running" && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2 font-medium">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Crawling DOM and extracting text...
              </span>
              <span className="font-mono font-bold text-blue-400">{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 ease-out shadow-sm shadow-blue-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pages Crawled</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{totalPagesPagesCount(totalPagesScraped)}</h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">Across university subdomains</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Globe className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Crawl Health</p>
              <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">100%</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Zero HTTP 500 errors</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Execution Pipeline</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-1 capitalize">{scrapingStatus}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Node Playwright Cluster</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Terminal Logs + Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Terminal Logs Panel */}
        <div className="lg:col-span-7 bg-slate-950 rounded-3xl shadow-xl border border-slate-800 overflow-hidden flex flex-col">
          {/* Terminal Title Bar */}
          <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1.5 ml-2">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                scraper.stream.log
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLogs}
                disabled={logs.length === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40"
                title="Copy Logs"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-40"
                title="Clear Logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="p-5 font-mono text-xs overflow-y-auto max-h-[380px] min-h-[320px] flex-1 space-y-2 select-text">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 text-slate-500">
                <Activity className="w-10 h-10 mb-3 text-slate-700 animate-pulse" />
                <p className="text-slate-400 font-medium">Crawler is idle.</p>
                <p className="text-slate-600 text-xs mt-1 max-w-xs">
                  Click <span className="text-blue-400">Launch Scraper</span> above to initiate the data extraction pipeline.
                </p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`
                    p-2.5 rounded-xl border transition-all text-xs
                    ${log.type === "error"
                      ? "bg-rose-950/30 border-rose-800/40 text-rose-300"
                      : "bg-slate-900/60 border-slate-800/60 text-slate-300"
                    }
                  `}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 whitespace-nowrap text-[11px]">
                      [{log.time}]
                    </span>
                    <span className="flex-1 break-words font-mono leading-relaxed">
                      {log.message}
                    </span>
                    {log.type === "error" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Scraping Records */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Execution History</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {history.length} records
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[380px] flex-1 pr-1">
            {history.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No past scraping sessions recorded.
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="group p-4 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/60 rounded-2xl transition-all duration-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate flex items-center gap-1.5">
                        {item.website}
                        <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span>{item.pages} pages</span>
                        <span>•</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      {item.status}
                    </span>
                    <button
                      onClick={() => handleDeleteHistory(item.id, item.website)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function totalPagesPagesCount(val) {
  return val ? val.toLocaleString() : "400";
}

export default AutoScraping;