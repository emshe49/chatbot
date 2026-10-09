import { useState, useEffect, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, RefreshCw, Layers } from "lucide-react";
import { useToast } from "../context/ToastContext";

function UploadProspectus() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [datasetType, setDatasetType] = useState("ug");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Check if active ingestion is currently running
  useEffect(() => {
    const checkActiveProcess = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/ingestion-history");
        const data = await res.json();
        const processing = Array.isArray(data) ? data.find((r) => r.status === "Processing") : null;

        if (processing) {
          setProgress(processing.progress || 10);
          setProgressMessage("Processing ingestion pipeline in background...");
          setIsUploading(true);
        }
      } catch (err) {
        console.error("Active process check error:", err);
      }
    };

    checkActiveProcess();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const handleUpload = async () => {
    if (!file) {
      toast.warning("Please select a PDF document first");
      return;
    }

    setIsUploading(true);
    setProgress(5);
    setProgressMessage("Uploading PDF document to server...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("datasetType", datasetType);

    try {
      const res = await fetch("http://localhost:5000/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (result.status === "uploaded") {
        toast.info("PDF uploaded. Starting partitioning & embedding...");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        startProgress(result.filePath, result.datasetType);
      } else {
        toast.error("Upload failed. Please check server logs.");
        setIsUploading(false);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.message || "Network error while uploading PDF");
      setIsUploading(false);
    }
  };

  const startProgress = (pdfPath, datasetType) => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const es = new EventSource(
      `http://localhost:5000/api/ingestion-progress?pdfPath=${encodeURIComponent(
        pdfPath
      )}&datasetType=${datasetType}`
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) {
          setProgress(data.progress);
          setProgressMessage(data.message || "Processing...");
        }

        if (data.progress >= 100) {
          toast.success("Document ingested & embedded into vector database!");
          setIsUploading(false);
          es.close();
        }
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    es.onerror = () => {
      toast.error("Ingestion stream encountered an error");
      setIsUploading(false);
      es.close();
    };
  };

  const cancelIngestion = async () => {
    try {
      await fetch("http://localhost:5000/api/cancel-ingestion", {
        method: "POST",
      });
      if (eventSourceRef.current) eventSourceRef.current.close();
      toast.delete("Ingestion pipeline cancelled");
      setProgress(0);
      setProgressMessage("");
      setIsUploading(false);
    } catch (err) {
      toast.error("Failed to cancel ingestion");
    }
  };

  const datasets = [
    { id: "ug", name: "Undergraduate (UG)", desc: "Prospectus, rules, and BS degree quotas" },
    { id: "pg", name: "Postgraduate (PG)", desc: "MS/PhD degree rules, curriculum & research" },
    { id: "staff", name: "Faculty & Staff", desc: "Faculty records, offices, and directories" },
    { id: "notification", name: "Campus Notices", desc: "Official academic alerts & tender circulars" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
          Upload Prospectus & PDF Ingestion
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Ingest university documents into Pinecone vector namespaces for RAG search
        </p>
      </div>

      {/* Main Upload Box */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
        {/* Step 1: Target Dataset Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            1. Select Target Namespace / Dataset
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {datasets.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDatasetType(d.id)}
                className={`
                  p-3.5 rounded-xl border text-left transition-all duration-150 flex items-start gap-3
                  ${
                    datasetType === d.id
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  }
                `}
              >
                <div
                  className={`p-2 rounded-lg ${
                    datasetType === d.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Layers size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{d.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{d.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: PDF File Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            2. Choose PDF Document
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="
              border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8
              text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all duration-200
            "
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <UploadCloud size={24} />
            </div>
            {file ? (
              <div>
                <p className="text-sm font-bold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to process
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Click to browse or drop prospectus PDF here
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports official prospectus, syllabus, or guidelines PDF files
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleUpload}
            disabled={isUploading || !file}
            className={`
              py-2.5 px-5 rounded-xl text-xs font-semibold text-white transition-all duration-150 flex items-center gap-2
              ${
                isUploading || !file
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-[0.98]"
              }
            `}
          >
            {isUploading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Processing Pipeline...</span>
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                <span>Upload & Start Ingestion</span>
              </>
            )}
          </button>

          {isUploading && (
            <button
              onClick={cancelIngestion}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Live Progress Bar Card */}
        {progress > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 mt-4 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>{progressMessage || "Processing document..."}</span>
              <span className="text-blue-600 font-bold">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadProspectus;