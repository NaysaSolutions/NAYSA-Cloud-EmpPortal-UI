import { Navigate } from "react-router-dom";
<<<<<<< Updated upstream
import { useAuth } from "@/NAYSA Cloud/Authentication/AuthContext.jsx";
=======
// import { useAuth } from "@/NAYSA Cloud/Authentication/AuthContext.jsx";
import { useAuth } from "./EMPLOYEE PORTAL/AuthContext.jsx";
>>>>>>> Stashed changes

export default function ProtectedRoute({ children }) {
  const { user, authLoading } = useAuth();

  // Prevent redirect while restoring auth from storage
  if (authLoading) return null; // or loading spinner

  return user ? children : <Navigate to="/login" replace />;
<<<<<<< Updated upstream
}
=======
}
>>>>>>> Stashed changes
