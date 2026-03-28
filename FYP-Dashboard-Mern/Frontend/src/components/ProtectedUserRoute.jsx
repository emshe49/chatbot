import { Navigate } from "react-router-dom";
import { useUserAuth } from "../context/UserContext";

const ProtectedUserRoute = ({ children }) => {
  const { user, loading } = useUserAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedUserRoute;
