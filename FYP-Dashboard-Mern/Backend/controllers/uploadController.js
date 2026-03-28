exports.handleUpload = (req, res) => {
  const file = req.file;
  const datasetType = req.body.datasetType;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!datasetType) {
    return res.status(400).json({ error: "datasetType is required" });
  }

  res.json({
    status: "uploaded",
    filePath: file.path,
    datasetType
  });
};
