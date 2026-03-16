import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// 1. Import TanStack Query (React Query)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth } from "./EMPLOYEE PORTAL/AuthContext";
import Sidebar from "./EMPLOYEE PORTAL/Sidebar";
import Navbar from "./EMPLOYEE PORTAL/Navbar";
import Dashboard from "./EMPLOYEE PORTAL/Dashboard";
import LoginPortal from "./EMPLOYEE PORTAL/LoginPortal";
import Timekeeping from "./EMPLOYEE PORTAL/Timekeeping";
import TimekeepingAdjustment from "./EMPLOYEE PORTAL/TimekeepingAdjustment";
import TimekeepingAdjustmentApproval from "./EMPLOYEE PORTAL/TimekeepingAdjustmentApproval";
import TimekeepingAdjustmentReview from "./EMPLOYEE PORTAL/TimekeepingAdjustmentReview";
import OffsetApplication from "./EMPLOYEE PORTAL/OffsetApplication";
import OffsetApproval from "./EMPLOYEE PORTAL/OffsetApproval";
import PayslipViewer from "./EMPLOYEE PORTAL/PayslipViewer";
import Leave from "./EMPLOYEE PORTAL/Leave";
import Overtime from "./EMPLOYEE PORTAL/Overtime";
import LeaveApproval from "./EMPLOYEE PORTAL/LeaveApproval";
import LeaveReview from "./EMPLOYEE PORTAL/LeaveReview";
import OvertimeApproval from "./EMPLOYEE PORTAL/OvertimeApproval";
import OvertimeReview from "./EMPLOYEE PORTAL/OvertimeReview";
import OfficialBusiness from "./EMPLOYEE PORTAL/OfficialBusiness";
import OfficialBusinessApproval from "./EMPLOYEE PORTAL/OfficialBusinessApproval";
import OfficialBusinessReview from "./EMPLOYEE PORTAL/OBReview";
import Register from "./NAYSA Cloud/Register";
import ForgotPassword from "./Authentication/ForgotPassword";
import ScrollToTop from "./components/ScrollToTop";

// 2. Initialize the QueryClient
// This manages the cache and the timing of your data refreshes
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Automatically refresh data when you click back onto the tab
      retry: 1,                   // Retry failed requests once
      staleTime: 1000 * 60 * 5,   // Consider data fresh for 5 minutes
    },
  },
});

const App = () => {
  return (
    // 3. Wrap everything with the QueryClientProvider
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LoginPortal />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/timekeeping" element={<ProtectedRoute><Layout><Timekeeping /></Layout></ProtectedRoute>} />
            <Route path="/timekeepingAdj" element={<ProtectedRoute><Layout><TimekeepingAdjustment /></Layout></ProtectedRoute>} />
            <Route path="/timekeepingAdjApproval" element={<ProtectedRoute><Layout><TimekeepingAdjustmentApproval /></Layout></ProtectedRoute>} />
            <Route path="/timekeepingAdjReview" element={<ProtectedRoute><Layout><TimekeepingAdjustmentReview /></Layout></ProtectedRoute>} />
            <Route path="/offsetApplication" element={<ProtectedRoute><Layout><OffsetApplication /></Layout></ProtectedRoute>} />
            <Route path="/offsetApproval" element={<ProtectedRoute><Layout><OffsetApproval /></Layout></ProtectedRoute>} />
            <Route path="/payslipviewer" element={<ProtectedRoute><Layout><PayslipViewer /></Layout></ProtectedRoute>} />
            <Route path="/leave" element={<ProtectedRoute><Layout><Leave /></Layout></ProtectedRoute>} />
            <Route path="/overtime" element={<ProtectedRoute><Layout><Overtime /></Layout></ProtectedRoute>} />
            <Route path="/overtimeApproval" element={<ProtectedRoute><Layout><OvertimeApproval /></Layout></ProtectedRoute>} />
            <Route path="/overtime-review" element={<ProtectedRoute><Layout><OvertimeReview /></Layout></ProtectedRoute>} />
            <Route path="/leaveApproval" element={<ProtectedRoute><Layout><LeaveApproval /></Layout></ProtectedRoute>} />
            <Route path="/leave-review" element={<ProtectedRoute><Layout><LeaveReview /></Layout></ProtectedRoute>} />
            <Route path="/official-business" element={<ProtectedRoute><Layout><OfficialBusiness /></Layout></ProtectedRoute>} />
            <Route path="/OfficialBusinessApproval" element={<ProtectedRoute><Layout><OfficialBusinessApproval /></Layout></ProtectedRoute>} />
            <Route path="/OfficialBusinessReview" element={<ProtectedRoute><Layout><OfficialBusinessReview /></Layout></ProtectedRoute>} />

            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

// Layout Component for pages with Sidebar & Navbar
const Layout = ({ children }) => (
  <div className="flex">
    <Sidebar />
    <div className="flex-grow">
      <Navbar />
      {children}
    </div>
  </div>
);

// ProtectedRoute to prevent unauthorized access
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" />;
};

export default App;