import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  FileText,
  Database,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  Download,
  Calendar,
  TrendingUp,
  AlertCircle,
  Layers,
  Upload,
  Eye,
  Grid,
  List,
  BarChart3,
  Trash2,
  AlertTriangle
} from "lucide-react";

// ==================== CONSTANTS ====================
const API_BASE_URL = "http://localhost:5000/api";
const RECORDS_PER_PAGE = 10;
const REFRESH_INTERVAL = 30000; // 30 seconds

const STATUS_TYPES = {
  ALL: "All",
  COMPLETED: "Completed",
  PROCESSING: "Processing",
  FAILED: "Failed"
};

const STATUS_COLORS = {
  Completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", badge: "bg-emerald-100" },
  Processing: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", badge: "bg-blue-100" },
  Failed: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", badge: "bg-rose-100" }
};

const VIEW_MODES = {
  TABLE: "table",
  GRID: "grid"
};

// ==================== UTILITY FUNCTIONS ====================
const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch {
    return 'Invalid date';
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// ==================== SUB-COMPONENTS ====================

const StatCard = ({ title, value, icon: Icon, color = "blue", trend, subtitle }) => {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600 bg-blue-50 text-blue-600 border-blue-100",
    green: "from-emerald-500 to-emerald-600 bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "from-rose-500 to-rose-600 bg-rose-50 text-rose-600 border-rose-100",
    purple: "from-purple-500 to-purple-600 bg-purple-50 text-purple-600 border-purple-100",
    amber: "from-amber-500 to-amber-600 bg-amber-50 text-amber-600 border-amber-100"
  };

  return (
    <div className={`relative overflow-hidden bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 group`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color].split(' ')[0]} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color].split(' ')[2]} bg-opacity-10`}>
            <Icon size={28} className={colorClasses[color].split(' ')[3]} />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-sm font-medium text-emerald-600">{trend}</span>
            <span className="text-xs text-gray-500">vs last hour</span>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = STATUS_COLORS[status] || STATUS_COLORS.Failed;
  const icons = {
    Completed: CheckCircle,
    Processing: Clock,
    Failed: XCircle
  };
  const Icon = icons[status] || XCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.badge} ${config.text} border ${config.border}`}>
      <Icon size={14} />
      {status}
    </span>
  );
};

const ProgressBar = ({ progress, size = "md", showPercentage = true }) => {
  const heights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3"
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 bg-gray-100 rounded-full overflow-hidden ${heights[size]}`}>
        <div 
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progress || 0, 100)}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs font-medium text-gray-600 min-w-[40px]">
          {progress || 0}%
        </span>
      )}
    </div>
  );
};

const EmptyState = ({ message, icon: Icon, action }) => (
  <div className="text-center py-16 px-4">
    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
      {Icon ? <Icon size={32} className="text-gray-400" /> : <Info size={32} className="text-gray-400" />}
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No records found</h3>
    <p className="text-gray-500 mb-6">{message}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <RefreshCw size={18} />
        {action.label}
      </button>
    )}
  </div>
);

const FilterBar = ({ filters, onFilterChange, datasetTypes, onRefresh, loading }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by file name or type..."
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors min-w-[140px]"
        >
          {Object.values(STATUS_TYPES).map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(e) => onFilterChange("type", e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors min-w-[140px]"
        >
          {datasetTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors font-medium"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
    </div>

    {/* Active Filters */}
    {(filters.search || filters.status !== STATUS_TYPES.ALL || filters.type !== "All") && (
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-500">Active filters:</span>
        {filters.search && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
            Search: {filters.search}
            <button onClick={() => onFilterChange("search", "")} className="hover:text-blue-900">×</button>
          </span>
        )}
        {filters.status !== STATUS_TYPES.ALL && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
            Status: {filters.status}
            <button onClick={() => onFilterChange("status", STATUS_TYPES.ALL)} className="hover:text-blue-900">×</button>
          </span>
        )}
        {filters.type !== "All" && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
            Type: {filters.type}
            <button onClick={() => onFilterChange("type", "All")} className="hover:text-blue-900">×</button>
          </span>
        )}
      </div>
    )}
  </div>
);

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, recordName, isDeleting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="px-6 py-5 bg-white">
            <div className="flex items-center">
              <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-red-100 rounded-full sm:mx-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  Delete Record
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete <span className="font-semibold text-gray-700">"{recordName}"</span>? 
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DataTable = ({ records, onRecordClick, onDelete }) => {
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, record: null });

  const handleDeleteClick = (e, record) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, record });
  };

  const handleConfirmDelete = () => {
    if (deleteModal.record) {
      onDelete(deleteModal.record);
      setDeleteModal({ isOpen: false, record: null });
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">File Information</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Uploaded</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.map((record, index) => (
              <tr 
                key={record._id || index} 
                onClick={() => onRecordClick?.(record)}
                className="hover:bg-gray-50 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white transition-colors">
                      <FileText size={18} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{record.fileName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(record.fileSize)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                    <Layers size={12} className="mr-1" />
                    {record.datasetType}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={record.status} />
                </td>
                <td className="px-6 py-4">
                  <ProgressBar progress={record.progress} size="sm" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={14} className="text-gray-400" />
                    {formatDate(record.createdAt)}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => handleDeleteClick(e, record)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete record"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, record: null })}
        onConfirm={handleConfirmDelete}
        recordName={deleteModal.record?.fileName}
        isDeleting={false}
      />
    </>
  );
};

const DataGrid = ({ records, onRecordClick, onDelete }) => {
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, record: null });

  const handleDeleteClick = (e, record) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, record });
  };

  const handleConfirmDelete = () => {
    if (deleteModal.record) {
      onDelete(deleteModal.record);
      setDeleteModal({ isOpen: false, record: null });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {records.map((record, index) => (
          <div
            key={record._id || index}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300 group relative"
          >
            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRecordClick?.(record);
                }}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View details"
              >
                <Eye size={16} />
              </button>
              <button
                onClick={(e) => handleDeleteClick(e, record)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete record"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                <FileText size={20} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                  {record.fileName}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(record.fileSize)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium">
                  <Layers size={12} className="mr-1" />
                  {record.datasetType}
                </span>
                <StatusBadge status={record.status} />
              </div>

              <ProgressBar progress={record.progress} />

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {new Date(record.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, record: null })}
        onConfirm={handleConfirmDelete}
        recordName={deleteModal.record?.fileName}
        isDeleting={false}
      />
    </>
  );
};

const Pagination = ({ currentPage, totalPages, onPageChange, totalRecords, startIndex, endIndex }) => (
  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
    <div className="text-sm text-gray-600">
      Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
      <span className="font-medium">{Math.min(endIndex, totalRecords)}</span> of{' '}
      <span className="font-medium">{totalRecords.toLocaleString()}</span> records
    </div>
    
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={18} />
      </button>
      
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          
          return (
            <button
              key={i}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                currentPage === pageNum
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  </div>
);

// ==================== MAIN COMPONENT ====================

const Dashboard = () => {
  // State management
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    status: STATUS_TYPES.ALL,
    type: "All"
  });
  
  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    recordsPerPage: RECORDS_PER_PAGE
  });

  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    totalChunks: 0,
    totalEmbeddings: 0,
    totalSize: 0
  });

  // Memoized dataset types
  const datasetTypes = useMemo(() => 
    ["All", ...new Set(records.map(record => record.datasetType).filter(Boolean))],
    [records]
  );

  // Fetch ingestion history
  const fetchHistory = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/ingestion-history`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setRecords(data);
      
      // Update stats with aggregated data
      setStats({
        total: data.length,
        completed: data.filter(record => record.status === STATUS_TYPES.COMPLETED).length,
        processing: data.filter(record => record.status === STATUS_TYPES.PROCESSING).length,
        failed: data.filter(record => record.status === STATUS_TYPES.FAILED).length,
        totalChunks: data.reduce((acc, record) => acc + (record.chunkCount || 0), 0),
        totalEmbeddings: data.reduce((acc, record) => acc + (record.embeddingCount || 0), 0),
        totalSize: data.reduce((acc, record) => acc + (record.fileSize || 0), 0)
      });
      
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch ingestion history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete record
  const handleDelete = useCallback(async (record) => {
    if (!record._id) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ingestion-history/${record._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to delete record: ${response.status}`);
      }

      // Update records state
      setRecords(prevRecords => prevRecords.filter(r => r._id !== record._id));
      
      // Show success message (you can add a toast notification here)
      console.log('Record deleted successfully:', data.message);
      
    } catch (err) {
      console.error("Failed to delete record:", err);
      setError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchHistory();
    const intervalId = setInterval(fetchHistory, REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [fetchHistory]);

  // Filter records based on search and filters
  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(record =>
        record.fileName?.toLowerCase().includes(searchLower) ||
        record.datasetType?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status !== STATUS_TYPES.ALL) {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    if (filters.type !== "All") {
      filtered = filtered.filter(record => record.datasetType === filters.type);
    }

    return filtered;
  }, [filters, records]);

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Handle pagination
  const handlePageChange = useCallback((pageNumber) => {
    setPagination(prev => ({ ...prev, currentPage: pageNumber }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle record click
  const handleRecordClick = useCallback((record) => {
    console.log('Record clicked:', record);
    // Implement detail view or modal here
  }, []);

  // Get current records for pagination
  const currentRecords = useMemo(() => {
    const { currentPage, recordsPerPage } = pagination;
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    
    return filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  }, [filteredRecords, pagination]);

  // Calculate pagination indices
  const paginationIndices = useMemo(() => {
    const { currentPage, recordsPerPage } = pagination;
    return {
      indexOfFirstRecord: (currentPage - 1) * recordsPerPage,
      indexOfLastRecord: currentPage * recordsPerPage
    };
  }, [pagination]);

  // Calculate total pages
  const totalPages = useMemo(() => 
    Math.ceil(filteredRecords.length / pagination.recordsPerPage),
    [filteredRecords, pagination.recordsPerPage]
  );

  // Calculate success rate
  const successRate = useMemo(() => {
    if (stats.total === 0) return 0;
    return ((stats.completed / stats.total) * 100).toFixed(1);
  }, [stats]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-100 mb-6">
            <AlertCircle size={40} className="text-rose-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Unable to Load Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchHistory}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <RefreshCw size={18} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-8 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Database size={36} className="text-blue-400" />
                <span>Ingestion Dashboard</span>
              </h1>
              <p className="text-gray-300 mt-2 text-lg">
                Monitor and manage your data ingestion pipelines in real-time
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-gray-200">Live Updates</span>
              </div>
              <div className="w-px h-6 bg-white/20" />
              <span className="text-sm text-gray-300">Every 30s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total Records" 
            value={stats.total}
            icon={Database}
            color="blue"
            subtitle={`${formatFileSize(stats.totalSize)} total`}
          />
          <StatCard 
            title="Completed" 
            value={stats.completed}
            icon={CheckCircle}
            color="green"
            trend={`${successRate}% success rate`}
          />
          <StatCard 
            title="Processing" 
            value={stats.processing}
            icon={Clock}
            color="amber"
            subtitle={`${stats.totalChunks} chunks processed`}
          />
          <StatCard 
            title="Failed" 
            value={stats.failed}
            icon={XCircle}
            color="red"
            subtitle={`${((stats.failed / stats.total) * 100 || 0).toFixed(1)}% failure rate`}
          />
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <Layers size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Chunks</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalChunks.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-lg">
                <BarChart3 size={24} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Embeddings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEmbeddings.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-lg">
                <Upload size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Processing Time</p>
                <p className="text-2xl font-bold text-gray-900">2.4s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            datasetTypes={datasetTypes}
            onRefresh={fetchHistory}
            loading={loading}
          />
          
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === VIEW_MODES.TABLE
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
              title="Table view"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode(VIEW_MODES.GRID)}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === VIEW_MODES.GRID
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
              title="Grid view"
            >
              <Grid size={18} />
            </button>
          </div>
        </div>

        {/* Records Display */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <div className="inline-flex flex-col items-center gap-4">
              <RefreshCw size={40} className="animate-spin text-blue-600" />
              <div>
                <p className="text-lg font-medium text-gray-900 mb-1">Loading records...</p>
                <p className="text-sm text-gray-500">Fetching latest ingestion data</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {filteredRecords.length > 0 ? (
                <>
                  {viewMode === VIEW_MODES.TABLE ? (
                    <DataTable 
                      records={currentRecords} 
                      onRecordClick={handleRecordClick}
                      onDelete={handleDelete}
                    />
                  ) : (
                    <DataGrid 
                      records={currentRecords} 
                      onRecordClick={handleRecordClick}
                      onDelete={handleDelete}
                    />
                  )}

                  {/* Pagination */}
                  {filteredRecords.length > pagination.recordsPerPage && (
                    <Pagination
                      currentPage={pagination.currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                      totalRecords={filteredRecords.length}
                      startIndex={paginationIndices.indexOfFirstRecord}
                      endIndex={paginationIndices.indexOfLastRecord}
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  message="Try adjusting your filters or refresh the data."
                  icon={Info}
                  action={{
                    label: "Refresh Data",
                    onClick: fetchHistory
                  }}
                />
              )}
            </div>

            {/* Footer Info */}
            <div className="mt-4 text-sm text-gray-500 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
                <span>•</span>
                <span>{filteredRecords.length} records filtered</span>
              </div>
              <div className="flex items-center gap-2">
                <Download size={14} />
                <button className="hover:text-blue-600 transition-colors">Export Data</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;