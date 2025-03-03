import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext"; // Import AuthContext to get logged-in user data

const Sidebar = () => {
  const { user } = useAuth(); // Get logged-in user data
  const [employeeInfo, setEmployeeInfo] = useState(null); // To store employee data
  const [error, setError] = useState(null); // Error state

  useEffect(() => {
    // Check if user and empNo are available before making the API request
    if (user && user.empNo) {
      const fetchEmployeeInfo = async () => {
        try {
          // Send the employee number to the API
          const response = await fetch("http://127.0.0.1:8000/api/dashBoard", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ EMP_NO: user.empNo }), // Send empNo from logged-in user
          });

          const result = await response.json(); // Parse the response into JSON

          // Check if the result is successful
          if (result.success) {
            const parsedData = JSON.parse(result.data[0]?.result || '[]'); // Parse result string to JSON
            setEmployeeInfo(parsedData[0]); // Set employee data to state
          } else {
            throw new Error(result.message); // If not successful, throw an error with message
          }
        } catch (err) {
          setError(err.message); // Set error message if fetch fails
        }
      };

      fetchEmployeeInfo(); // Call the function to fetch employee info
    }
  }, [user]); // Re-run effect when user data changes

  // Render error message if there is an issue
  if (error) {
    return (
      <div className="h-screen w-80 bg-white shadow-md fixed top-[120px] left-0 p-6">
        Error: {error}
      </div>
    );
  }

  // Render sidebar with employee details (or empty state if not available)
  return (
    <div className="h-screen w-80 bg-white shadow-md fixed top-[120px] left-0 p-6">
      {/* Profile Section */}
      <div className="flex flex-col items-center">
        <img
          src="blank-profile-picture-973460_1280.webp"
          alt="Profile"
          className="w-[130px] h-[130px] rounded-full object-cover mb-4"
        />
        <h2 className="text-lg font-semibold text-[#1c394e] text-center">
          Welcome Back, <br /> {user.empName  || "Employee"}!
        </h2>
      </div>
<hr />
      {/* Employee Details Section */}
      <div className="mt-7 text-md text-gray-600">
        <p className="mb-2">
          <span className="font-semibold">Employee Number:</span> {employeeInfo ? employeeInfo.empNo : "Loading..."}
        </p>
        <p className="mb-2">
          <span className="font-semibold">Branch:</span> {employeeInfo ? employeeInfo.branchName : "Loading..."}
        </p>
        <p className="mb-2">
          <span className="font-semibold">Payroll Group:</span> {employeeInfo ? employeeInfo.payrollGroup : "Loading..."}
        </p>
        <p className="mb-2">
          <span className="font-semibold">Department:</span> {employeeInfo ? employeeInfo.department : "Loading..."}
        </p>
        <p className="mb-2">
          <span className="font-semibold">Position:</span> {employeeInfo ? employeeInfo.position : "Loading..."}
        </p>
        <p className="mb-2">
          <span className="font-semibold">Employee Status:</span> {employeeInfo ? employeeInfo.employeeStatus : "Loading..."}
        </p>
        <p className="mb-2">
          <span className="font-semibold">Shift Schedule:</span> {employeeInfo ? employeeInfo.shiftSchedule : "Loading..."}
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
