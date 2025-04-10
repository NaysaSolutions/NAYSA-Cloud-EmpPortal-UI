import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

const Dashboard = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <div className="flex h-screen font-poppins">
      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-50">
        {/* Header with Notification and Profile */}
        <div className="flex justify-end mb-4 space-x-4 relative">
          {/* Notification Bell */}
          <div className="relative">
            <FontAwesomeIcon
              icon={faBell}
              className="w-5 h-5 text-gray-500 bg-white p-2 rounded-lg shadow-md cursor-pointer"
            />
            {/* Notification Badge */}
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-yellow-400 rounded-full border-2 border-white"></span>
          </div>

          {/* Profile Picture */}
          <div
            className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden shadow-md cursor-pointer"
            onClick={toggleDropdown}
          >
            <img
              src="3135715.png"
              alt="Profile"
              className="w-full h-full object-cover"
            />
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
              <button className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left">
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Welcome Message */}
        <h2 className="text-2xl font-bold mb-8">Welcome, Gerard</h2>

        {/* Content */}
        <div className="grid grid-cols-3 gap-6">
          {/* My Clients */}
          <div className="col-span-1 bg-gray-50 p-5 rounded-lg shadow-md">
            <h3 className="text-lg font-bold mb-4">My Clients</h3>
            <ul className="space-y-2 text-md font-poppins">
              <li>HIZON LABORATORIES INC.</li>
              <li>PHILODRILL</li>
              <li>JM TOMAIN LABORATORIES INC.</li>
              <li>ACHAN</li>
              <li>AMENICO</li>
              <li>POWERONE</li>
              <li>ERAMEN</li>
              <li>INNOVENTION</li>
              <li>EDISON LEE</li>
              <li>ROBES</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
