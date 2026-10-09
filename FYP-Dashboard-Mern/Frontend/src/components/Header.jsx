import { useLocation } from "react-router-dom";
import { User, Bell, Activity } from "lucide-react";

function Header() {
  const location = useLocation();

  const getPageTitle = (path) => {
    if (path.includes("upload-prospectus")) return "Upload Prospectus & Ingestion";
    if (path.includes("auto-scraping")) return "Automated Scraping Monitor";
    if (path.includes("analytics")) return "System Analytics";
    if (path.includes("settings")) return "Settings & Configuration";
    return "Operations Dashboard";
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between flex-shrink-0 z-20 shadow-xs">
      {/* Page Title & Breadcrumb */}
      <div>
        <h2 className="text-base font-bold text-slate-800 tracking-tight">
          {getPageTitle(location.pathname)}
        </h2>
        <p className="text-[11px] text-slate-400">
          UET Mardan Intelligent Knowledge System
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* System Pulse */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 font-medium">
          <Activity size={13} className="text-emerald-500 animate-pulse" />
          <span>Vector DB Active</span>
        </div>

        {/* Profile Avatar */}
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            AD
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-800">Admin</p>
            <p className="text-[10px] text-slate-400">Superuser</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
