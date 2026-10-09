const fs = require("fs");

function getPythonPath() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  const preferredCandidates = [
    "C:\\Users\\HP\\AppData\\Local\\Programs\\Python\\Python314\\python.exe",
    "D:\\anaconda3\\python.exe"
  ];

  for (const candidate of preferredCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python";
}

module.exports = getPythonPath;
