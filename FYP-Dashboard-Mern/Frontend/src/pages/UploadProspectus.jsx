import { useState, useEffect } from "react";

function UploadProspectus() {
  const [file, setFile] = useState(null);
  const [datasetType, setDatasetType] = useState("ug");

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [message, setMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState(""); // New state for upload message

  let eventSourceRef = null;

  // 🔥 Reconnect if processing exists
  useEffect(() => {
    const checkActiveProcess = async () => {
      const res = await fetch("http://localhost:5000/api/ingestion-history");
      const data = await res.json();

      const processing = data.find(r => r.status === "Processing");

      if (processing) {
        setProgress(processing.progress || 0);
        setProgressMessage("Processing in background...");
      }
    };

    checkActiveProcess();
  }, []);

  const handleUpload = async () => {
    if (!file) return alert("Select a PDF first");

    // Show upload starting message
    setUploadMessage("📄 Your PDF is uploaded and the process is starting...");
    setProgress(0);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("datasetType", datasetType);

    try {
      const res = await fetch("http://localhost:5000/api/upload-pdf", {
        method: "POST",
        body: formData
      });

      const result = await res.json();

      if (result.status === "uploaded") {
        // Clear the file input
        setFile(null);
        // Clear the file input field in the DOM
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
        
        // Clear upload message after 3 seconds
        setTimeout(() => {
          setUploadMessage("");
        }, 3000);
        
        startProgress(result.filePath, result.datasetType);
      } else {
        setUploadMessage("❌ Upload failed. Please try again.");
        setTimeout(() => {
          setUploadMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadMessage("❌ Error uploading file. Please try again.");
      setTimeout(() => {
        setUploadMessage("");
      }, 3000);
    }
  };

  const startProgress = (pdfPath, datasetType) => {
    eventSourceRef = new EventSource(
      `http://localhost:5000/api/ingestion-progress?pdfPath=${encodeURIComponent(pdfPath)}&datasetType=${datasetType}`
    );

    eventSourceRef.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.progress !== undefined) {
        setProgress(data.progress);
        setProgressMessage(data.message);
      }

      if (data.progress === 100) {
        setMessage("Processing completed ✅");
        eventSourceRef.close();
      }
    };

    eventSourceRef.onerror = () => {
      setMessage("Processing failed ❌");
      eventSourceRef.close();
    };
  };

  const cancelIngestion = async () => {
    await fetch("http://localhost:5000/api/cancel-ingestion", {
      method: "POST"
    });

    setMessage("Ingestion cancelled ❌");
    setProgress(0);
    setUploadMessage("");
  };

  return (
    <div className="p-6 space-y-6">

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Upload PDF</h2>

        <select
          value={datasetType}
          onChange={(e) => setDatasetType(e.target.value)}
          className="border p-2 rounded mb-3"
        >
          <option value="ug">UG</option>
          <option value="pg">PG</option>
          <option value="staff">Staff</option>
          <option value="notification">Notification</option>
        </select>

        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files[0])}
          className="border p-2 rounded"
        />

        <div className="mt-3 flex gap-3">
          <button
            onClick={handleUpload}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Upload & Process
          </button>

          <button
            onClick={cancelIngestion}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
          >
            Cancel
          </button>
        </div>

        {/* Upload message notification */}
        {uploadMessage && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700 font-medium">{uploadMessage}</p>
          </div>
        )}

        {progress > 0 && (
          <div className="mt-6">
            <div className="w-full bg-gray-200 h-4 rounded overflow-hidden">
              <div
                className="bg-blue-600 h-4 rounded transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {progress}% - {progressMessage}
            </p>
          </div>
        )}

        {message && (
          <div className={`mt-4 p-3 rounded-lg ${
            message.includes("✅") ? "bg-green-50 border border-green-200 text-green-700" : 
            message.includes("❌") ? "bg-red-50 border border-red-200 text-red-700" :
            "bg-gray-50 border border-gray-200"
          }`}>
            <p className="font-medium">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadProspectus;