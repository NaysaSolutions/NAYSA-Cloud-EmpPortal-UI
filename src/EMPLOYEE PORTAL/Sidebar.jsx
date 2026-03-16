import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useSidebarStore } from "./useSidebarStore"; // Import the store we created
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import API_ENDPOINTS from "@/apiConfig.jsx";

const fetchEmployeeData = async (empNo) => {
  const response = await fetch(API_ENDPOINTS.dashBoard, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ EMP_NO: empNo }),
  });

  const result = await response.json();

  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
    throw new Error("Employee info not found.");
  }

  return result.data[0];
};

const Sidebar = () => {
  const { user, setUser } = useAuth();
  
  // Zustand: Replace local useState with global store
  const isOpen = useSidebarStore((state) => state.isOpen);
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);

  const { data: employeeInfo, error, isLoading, isError } = useQuery({
    queryKey: ["employee", user?.empNo],
    queryFn: () => fetchEmployeeData(user?.empNo),
    enabled: !!user?.empNo,
    staleTime: 1000 * 60 * 5,
  });

  // Sync with Global Context
  useEffect(() => {
    if (employeeInfo) {
      setUser(employeeInfo);
    }
  }, [employeeInfo, setUser]);

  // Sonner: Use non-intrusive toasts instead of breaking the layout
  useEffect(() => {
    if (isError) {
      toast.error("Data Fetch Failed", {
        description: error.message,
      });
    }
  }, [isError, error]);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-12 left-6 z-50 bg-white shadow-md p-2 rounded-full border border-gray-100"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <div
        className={`
          fixed top-[64px] left-0 h-screen w-[200px] bg-white shadow-md p-5 z-40 transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:block mt-4 cursor-pointer select-none
        `}
      >
        <div className="flex flex-col items-center text-center">
          <img
            src={user?.empNo ? `/${user.empNo}.jpg` : "/Default.jpg"}
            alt="Profile"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/Default.jpg";
            }}
            className="w-[100px] h-[100px] rounded-full object-cover mb-4 border border-gray-100"
          />

          <h2 className="text-[14px] font-semibold text-[#1c394e] break-words leading-tight">
            Welcome Back,<br /> 
            {isLoading ? (
              <span className="inline-block w-16 h-4 bg-gray-100 animate-pulse rounded mt-2 mb-2" />
            ) : (
              (employeeInfo?.empName || "Employee")
            )}!
          </h2>
        </div>

        <hr className="my-3 border-gray-100" />

        {/* Details Section */}
        <div className="text-[13px] text-gray-700 space-y-4">
          <DetailItem label="Employee No." value={employeeInfo?.empNo} loading={isLoading} />
          <DetailItem label="Branch" value={employeeInfo?.branchName} loading={isLoading} />
          <DetailItem label="Payroll Group" value={employeeInfo?.payrollGroup} loading={isLoading} />
          <DetailItem label="Department" value={employeeInfo?.department} loading={isLoading} />
          <DetailItem label="Position" value={employeeInfo?.position} loading={isLoading} />
          <DetailItem label="Status" value={employeeInfo?.employeeStatus} loading={isLoading} />
          <DetailItem label="Shift" value={employeeInfo?.shiftSchedule} loading={isLoading} />
        </div>
      </div>
    </>
  );
};

const DetailItem = ({ label, value, loading }) => (
  <div className="flex flex-col">
    <span className="font-semibold text-[#1c394e]">{label}:</span>
    <span className="break-words leading-none">
        {loading ? (
          <div className="h-3 w-full bg-gray-100 animate-pulse rounded mt-1" />
        ) : (
          value || "N/A"
        )}
    </span>
  </div>
);

export default Sidebar;