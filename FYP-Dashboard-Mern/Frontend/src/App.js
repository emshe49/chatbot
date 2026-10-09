import { BrowserRouter, Routes, Route } from "react-router-dom";

// Admin
import { AdminAuthProvider } from "./context/AdminContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import AdminLogin from "./pages/auth/AdminLogin";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";

import Analytics from "./pages/Analytics";
import UploadProspectus from "./pages/UploadProspectus";
import Settings from "./pages/Settings";
import AutoScraping from "./pages/AutoScraping";

// Chatbot (Public)
import ChatbotUI from "./pages/ChatbotUI";

function App() {
  return (
    <BrowserRouter>
      {/* ✅ Wrap ALL routes with AdminAuthProvider */}
      <AdminAuthProvider>
        <Routes>

          {/* ===== Admin Login ===== */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ===== Reset Password (IMPORTANT: PUBLIC ROUTE) ===== */}
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* ===== Admin Protected Routes ===== */}
          <Route
            element={
              <ProtectedAdminRoute>
                <MainLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/upload-prospectus" element={<UploadProspectus />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="/admin/auto-scraping" element={<AutoScraping />} />
          </Route>

          {/* ===== PUBLIC CHATBOT ===== */}
          <Route path="/" element={<ChatbotUI />} />

        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default App;