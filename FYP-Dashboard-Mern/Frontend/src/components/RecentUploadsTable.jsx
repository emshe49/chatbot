function RecentUploadsTable() {
  return (
    <div className="table-container">
      <h3>Recent Uploads</h3>

      <table>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Type</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>dataset_01.csv</td>
            <td>CSV</td>
            <td>12 Aug 2025</td>
          </tr>
          <tr>
            <td>chat_logs.json</td>
            <td>JSON</td>
            <td>13 Aug 2025</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default RecentUploadsTable;
