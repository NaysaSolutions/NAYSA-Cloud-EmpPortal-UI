import { Navigate } from "react-router-dom";
import { useAuth } from "@/NAYSA Cloud/Authentication/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, authLoading } = useAuth();

  // Prevent redirect while restoring auth from storage
  if (authLoading) return null; // or loading spinner

  return user ? children : <Navigate to="/login" replace />;
}
