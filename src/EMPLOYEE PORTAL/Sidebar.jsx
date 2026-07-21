import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useSidebarStore } from "./useSidebarStore";

const Sidebar = () => {
  const { user } = useAuth();
  const { isOpen, setSidebarOpen, closeSidebar } = useSidebarStore();
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("Auth user object:", user);
  if (user?.empNo) {
    const fetchEmployeeInfo = async () => {
  try {
    console.log("Sending request with:", { EMP_NO: user.empNo });

    const response = await fetch(API_ENDPOINTS.dashBoard, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
    body: JSON.stringify({ EMP_NO: user.empNo }),
    }); 

    const result = await response.json();
console.log("Raw response from API:", result);

// Parse nested JSON string from result
if (result.success && Array.isArray(result.data) && result.data.length > 0) {
  setEmployeeInfo(result.data[0]);
  console.log("Employee info set:", result.data[0]);
} else {
  throw new Error("Employee info not found.");
}



  } catch (err) {
    console.error("Error fetching employee info:", err);
    setError(err.message);
  }
};


    fetchEmployeeInfo();
  }
}, [user?.empNo]);


  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarOpen]);

  useEffect(() => {
    document.body.classList.toggle("employee-sidebar-hidden", !isOpen);

    return () => {
      document.body.classList.remove("employee-sidebar-hidden");
    };
  }, [isOpen]);

  if (error) {
    return (
      <div className="fixed top-[50px] left-0 w-full bg-white p-4 shadow-md z-50">
        Error: {error}
      </div>
    );
  }

  return (
    <>
      {/* Sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 top-[70px] z-30 bg-black/30 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div
        className={`
          fixed top-[60px] left-0 h-screen w-[200px] bg-white shadow-md p-5 z-40 transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          mt-4 cursor-pointer select-none
        `}
      >
        {/* Profile Section */}
        <div className="flex flex-col items-center text-center">
          <img
              src={user?.empNo ? `/${user.empNo}.jpg` : "/Default.jpg"}
              alt="Profile"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/Default.jpg";
              }}
            className="w-[100px] h-[100px] rounded-full object-cover mb-4"
            />

          <h2 className="text-[14px] font-semibold text-[#1c394e] break-words">
            Welcome Back,<br /> {employeeInfo?.empName || "Employee"}!
          </h2>
        </div>

        <hr className="my-2" />

        {/* Employee Details Section */}
        <div className="text-[13px] text-gray-700 space-y-2">
          <DetailItem label="Employee No." value={employeeInfo?.empNo} />
          <DetailItem label="Branch" value={employeeInfo?.branchName} />
          <DetailItem label="Payroll Group" value={employeeInfo?.payrollGroup} />
          <DetailItem label="Department" value={employeeInfo?.department} />
          <DetailItem label="Position" value={employeeInfo?.position} />
          <DetailItem label="Employee Status" value={employeeInfo?.employeeStatus} />
          <DetailItem label="Shift Schedule" value={employeeInfo?.shiftSchedule} />
        </div>
      </div>
    </>
  );
};

// Reusable component for displaying label-value pairs
const DetailItem = ({ label, value }) => (
  <p>
    <span className="font-semibold">{label}:</span><br />
    <span className="break-words">{value || "Loading..."}</span>
  </p>
);

export default Sidebar;
