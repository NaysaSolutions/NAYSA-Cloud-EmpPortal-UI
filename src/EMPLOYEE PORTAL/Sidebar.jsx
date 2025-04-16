import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext"; // Import AuthContext to get logged-in user data
import { Menu, X } from "lucide-react"; // Optional: Lucide icons for hamburger

const Sidebar = () => {
  const { user } = useAuth(); // Get logged-in user data
  const [employeeInfo, setEmployeeInfo] = useState(null); // To store employee data
  const [error, setError] = useState(null); // Error state
  const [isOpen, setIsOpen] = useState(false); // Mobile toggle

  useEffect(() => {
    // Check if user and empNo are available before making the API request
    if (user && user.empNo) {
      const fetchEmployeeInfo = async () => {
        try {
          // Send the employee number to the API
          const response = await fetch("https://api.nemarph.com:81/api/dashBoard", {
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


 // Toggle sidebar visibility on small screens
 const toggleSidebar = () => setIsOpen(!isOpen);

 if (error) {
   return (
     <div className="fixed top-[90px] left-0 w-full bg-white p-4 shadow-md z-50">
       Error: {error}
     </div>
   );
 }

  // Render error message if there is an issue
  if (error) {
    return (
      <div className="h-screen w-65 bg-white shadow-md fixed top-[120px] left-0 p-6">
        Error: {error}
      </div>
    );
  }

  // Render sidebar with employee details (or empty state if not available)
  return (
    // <div className="h-screen w-[260px] bg-white shadow-md fixed top-[90px] left-0 p-5">
 
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        // className="md:hidden fixed top-12 left-6 z-50 bg-white shadow-md p-2 rounded-full"
        className="hidden fixed top-12 left-6 z-50 bg-white shadow-md p-2 rounded-full"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed top-[90px] left-0 h-screen w-[260px] bg-white shadow-md p-5 z-40 transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:block mt-7
        `}
      >
 
  {/* Profile Section */}
  <div className="flex flex-col items-center text-center">
    <img
       src={"Default.jpg"}
      className="w-[130px] h-[130px] rounded-full object-cover mb-4"
    />

{/* <img
  src={`${employeeInfo.empNo}.jpg`}
  onError={(e) => { e.target.onerror = null; e.target.src = 'Default.jpg'; }}
  className="w-[130px] h-[130px] rounded-full object-cover mb-4"
/> */}


    {/* <img src="naysa_logo.png" className="w-[100px] h-[60px]" alt="Naysa Logo" /> */}
    <h2 className="text-lg font-semibold text-[#1c394e] break-words">
      Welcome Back, <br /> {user.empName || "Employee"}!
    </h2>
  </div>
  <hr />
  {/* Employee Details Section */}
  <div className="mt-5 text-md text-gray-700">
    <p className="mb-1">
      <span className="font-semibold">Employee No.:</span> 
      <br />
      {employeeInfo ? employeeInfo.empNo : "Loading..."}
    </p>
    <p className="mb-2">
      <span className="font-semibold">Branch:</span> 
      <br />
      <span className="block break-words">
        {employeeInfo ? employeeInfo.branchName : "Loading..."}
      </span>
    </p>
    <p className="mb-2">
      <span className="font-semibold">Payroll Group:</span> 
      <br />
      <span className="block break-words">
        {employeeInfo ? employeeInfo.payrollGroup : "Loading..."}
      </span>
    </p>
    <p className="mb-2">
      <span className="font-semibold">Department:</span> 
      <br />
      <span className="block break-words">
        {employeeInfo ? employeeInfo.department : "Loading..."}
      </span>
    </p>
    <p className="mb-2">
      <span className="font-semibold">Position:</span> 
      <br />
      <span className="block break-words">
        {employeeInfo ? employeeInfo.position : "Loading..."}
      </span>
    </p>
    <p className="mb-2">
      <span className="font-semibold">Employee Status:</span> 
      <br />
      <span className="block break-words">
        {employeeInfo ? employeeInfo.employeeStatus : "Loading..."}
      </span>
    </p>
    <p className="mb-2">
      <span className="font-semibold">Shift Schedule:</span> 
      <br />
      <span className="block break-words">
        {employeeInfo ? employeeInfo.shiftSchedule : "Loading..."}
      </span>
    </p>
  </div>
</div>
</>
  );
};

export default Sidebar;
