import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, Trash2 } from "lucide-react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, title = null, duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, title, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, title = "Success") => addToast("success", msg, title),
    error: (msg, title = "Error") => addToast("error", msg, title, 5000),
    warning: (msg, title = "Warning") => addToast("warning", msg, title),
    info: (msg, title = "Information") => addToast("info", msg, title),
    delete: (msg, title = "Deleted") => addToast("delete", msg, title, 4000),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Floating Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          const typeConfig = {
            success: {
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
              border: "border-emerald-200/80 bg-white shadow-emerald-500/10",
              titleColor: "text-emerald-900",
              badge: "bg-emerald-50 text-emerald-700",
            },
            error: {
              icon: <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />,
              border: "border-rose-200/80 bg-white shadow-rose-500/10",
              titleColor: "text-rose-900",
              badge: "bg-rose-50 text-rose-700",
            },
            warning: {
              icon: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
              border: "border-amber-200/80 bg-white shadow-amber-500/10",
              titleColor: "text-amber-900",
              badge: "bg-amber-50 text-amber-700",
            },
            delete: {
              icon: <Trash2 className="w-5 h-5 text-rose-600 flex-shrink-0" />,
              border: "border-rose-200/80 bg-white shadow-rose-500/10",
              titleColor: "text-rose-900",
              badge: "bg-rose-50 text-rose-700",
            },
            info: {
              icon: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
              border: "border-blue-200/80 bg-white shadow-blue-500/10",
              titleColor: "text-blue-900",
              badge: "bg-blue-50 text-blue-700",
            },
          };

          const config = typeConfig[t.type] || typeConfig.info;

          return (
            <div
              key={t.id}
              className={`
                pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg
                backdrop-blur-md transition-all duration-300 animate-slide-in
                ${config.border}
              `}
              style={{
                animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              <div className="pt-0.5">{config.icon}</div>
              <div className="flex-1 min-w-0 pr-1">
                {t.title && (
                  <h4 className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${config.titleColor}`}>
                    {t.title}
                  </h4>
                )}
                <p className="text-xs text-slate-700 leading-relaxed break-words font-medium">
                  {t.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
