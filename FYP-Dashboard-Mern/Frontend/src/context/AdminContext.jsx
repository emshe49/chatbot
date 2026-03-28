import { createContext, useContext, useState, useEffect } from "react";

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load admin from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const email = localStorage.getItem("adminEmail");
    const role = localStorage.getItem("adminRole") || "admin";

    if (token && email) {
      setAdmin({ token, email, role });
    }
    setLoading(false);
  }, []);

  // Login function
  const login = ({ token, email, role = "admin" }) => {
    localStorage.setItem("adminToken", token);
    localStorage.setItem("adminEmail", email);
    localStorage.setItem("adminRole", role);
    setAdmin({ token, email, role });
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminEmail");
    localStorage.removeItem("adminRole");
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, login, logout, loading, setLoading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
