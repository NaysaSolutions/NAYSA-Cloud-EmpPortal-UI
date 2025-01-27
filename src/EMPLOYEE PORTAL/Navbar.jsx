import React from 'react';

const Navbar = () => {
  return (
    <>
      {/* Top Navbar */}
      <div className="flex justify-center items-center bg-gray-800 text-white p-3 fixed top-0 left-0 w-full h-[30px] z-20">
  {/* Centered Content */}
  <span className="font-bold text-lg">
    NEW NEMAR DEVELOPMENT CORPORATION
  </span>
</div>

      {/* Main Navbar */}
      <div className="flex justify-between items-center bg-white shadow-md p-4 fixed top-[15px] mt-3 left-0 w-full z-10">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <img
            src="naysa logo.png"
            className="w-[100px] h-[60px]"
            alt="Naysa Logo"
          />
          <span className="text-[#0e00cb] font-bold text-lg mt-3">Employee Portal</span>
        </div>

        {/* Navigation Links */}
        <div className="flex space-x-[45px] ml-[500px]">
          <a href="#" className="text-blue-700 hover:font-bold">
            Inquiry
          </a>
          <a href="#" className="text-blue-700 hover:font-bold">
            Timekeeping
          </a>
          <a href="#" className="text-blue-700 hover:font-bold">
            Overtime
          </a>
          <a href="#" className="text-blue-700 hover:font-bold">
            Leave
          </a>
          <a href="#" className="text-blue-700 hover:font-bold">
            Official Business
          </a>
          <a href="#" className="text-blue-700 hover:font-bold">
            Adjustment
          </a>
        </div>

        {/* Notification and Profile */}
        <div className="flex items-center space-x-4">
          {/* Notification Icon */}
          <div className="relative">
            <button className="text-gray-700 hover:text-blue-700 focus:outline-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
                />
              </svg>
            </button>
            <div className="absolute top-0 right-0 bg-red-500 w-2.5 h-2.5 rounded-full"></div>
          </div>

          {/* Profile Icon */}
          <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
