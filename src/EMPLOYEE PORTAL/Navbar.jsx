import { useNavigate, useLocation } from "react-router-dom"; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { useState } from "react";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get the current route
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Function to toggle dropdown
  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  // Function to check if a link is active
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Top Navbar */}
      <div className="flex justify-center items-center bg-[#162e3a] text-white p-3 fixed top-0 left-0 w-full h-[30px] z-20">
        <span className="font-bold text-lg">NAYSA SOLUTIONS INC.</span>
      </div>

      {/* Main Navbar */}
      <div className="flex justify-between items-center bg-white shadow-md p-4 fixed top-[15px] mt-3 left-0 w-full z-10">
        
        {/* ✅ Clickable Logo & "Employee Portal" */}
        <div 
          className="flex items-center space-x-2 cursor-pointer" 
          onClick={() => navigate("/dashboard")}
        >
          <img 
            src="naysa_logo.png" 
            className="w-[100px] h-[60px]" 
            alt="Naysa Logo"
          />
          <span className="text-[#0e00cb] font-bold text-lg mt-3">Employee Portal</span>
        </div>

        {/* Navigation Links */}
        <div className="flex space-x-[45px] ml-[450px]">
          <span 
            onClick={() => navigate("/dashboard")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/dashboard") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Inquiry
          </span>
          <span 
            onClick={() => navigate("/timekeeping")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/timekeeping") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Timekeeping
          </span>
          <span 
            onClick={() => navigate("/overtime")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/overtime") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Overtime
          </span>
          <span 
            onClick={() => navigate("/leave")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/leave") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Leave
          </span>
          <span 
            onClick={() => navigate("/official-business")} 
            className={`cursor-pointer hover:font-bold ${
              isActive("/official-business") ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-700"
            }`}
          >
            Official Business
          </span>
        </div>

        {/* Header with Notification and Profile */}
        <div className="flex justify-end mb-4 space-x-4 relative">
          {/* Notification Bell */}
          <div className="relative">
            <FontAwesomeIcon
              icon={faBell}
              className="w-5 h-5 text-gray-500 bg-white p-2 rounded-lg shadow-md cursor-pointer"
            />
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-yellow-400 rounded-full border-2 border-white"></span>
          </div>

          {/* Profile Picture */}
          <div
            className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden shadow-md cursor-pointer"
            onClick={toggleDropdown}
          >
            <img src="3135715.png" alt="Profile" className="w-full h-full object-cover" />
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-10 w-48 bg-white rounded-lg shadow-md py-2 z-10">
              <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                Account Management
              </button>
              <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                Settings
              </button>
              <button
  className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
  onClick={() => {
    navigate("/"); // Redirect to login page
  }}
>
  Logout
</button>

            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
