import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { Menu, X } from "lucide-react";

const Sidebar = () => {
  const { user } = useAuth();
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    console.log("Auth user object:", user);
  if (user?.empNo) {
    const fetchEmployeeInfo = async () => {
  try {
    console.log("Sending request with:", { EMP_NO: user.empNo });

    const response = await fetch("https://api.nemarph.com:81/api/dashBoard", {
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


  const toggleSidebar = () => setIsOpen(!isOpen);

  if (error) {
    return (
      <div className="fixed top-[90px] left-0 w-full bg-white p-4 shadow-md z-50">
        Error: {error}
      </div>
    );
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="hidden fixed top-12 left-6 z-50 bg-white shadow-md p-2 rounded-full"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed top-[90px] left-0 h-screen w-[260px] bg-white shadow-md p-5 z-40 transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:block mt-7
        `}
      >
        {/* Profile Section */}
        <div className="flex flex-col items-center text-center">
          <img
            src={`/public/${user?.empNo || "Default"}.jpg`}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/public/Default.jpg";
            }}
            className="w-[130px] h-[130px] rounded-full object-cover mb-4"
            alt="Profile"
          />

          <h2 className="text-lg font-semibold text-[#1c394e] break-words">
            Welcome Back,<br /> {employeeInfo?.empName || "Employee"}!
          </h2>
        </div>

        <hr className="my-4" />

        {/* Employee Details Section */}
        <div className="text-md text-gray-700 space-y-2">
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
