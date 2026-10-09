import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  UploadCloud,
  Globe,
  Settings,
  LogOut,
  Bot,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "../context/ToastContext";

function Sidebar() {
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    toast.info("Logged out successfully");
    navigate("/admin/login");
  };

  const navItems = [
    { to: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, end: true },
    { to: "/admin/analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
    { to: "/admin/upload-prospectus", label: "Upload Prospectus", icon: <UploadCloud size={18} /> },
    { to: "/admin/auto-scraping", label: "Auto Scraping", icon: <Globe size={18} /> },
    { to: "/admin/settings", label: "Settings", icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-200 h-screen flex flex-col justify-between flex-shrink-0 z-30 transition-all duration-300">
      {/* Top Branding */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white">UET Admin</h1>
            <p className="text-[11px] text-slate-400">RAG Orchestration</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 mt-2">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Management
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `
                flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150
                ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }
              `}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        {/* Quick Link to Public Chatbot */}
        <Link
          to="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all"
        >
          <Bot size={16} className="text-blue-400" />
          <span>Go to Chatbot</span>
        </Link>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all active:scale-[0.98]"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;