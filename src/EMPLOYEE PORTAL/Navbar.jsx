import { useNavigate, useLocation } from "react-router-dom"; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { useState } from "react";
import { useAuth } from "./AuthContext"; // Import AuthContext

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get the current route
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user } = useAuth(); // Get user data from AuthContext

  // Function to toggle dropdown
  const toggleDropdown = () => setIsDropdownOpen(prev => !prev);
  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

  // Function to check if a link is active
  const isActive = (path) => location.pathname === path;
  const navItems = [
    { path: "/dashboard", label: "Inquiry" },
    { path: "/timekeeping", label: "Timekeeping" },

// Only show this single link if not approver
...(user.approver !== "1"
  ? [{ path: "/overtime", label: "Overtime" }]
  : [
      {
        label: "Overtime",
        children: [
          { path: "/overtime", label: "Overtime Application" },
          { path: "/overtimeapproval", label: "Overtime for Approval" }
        ]
      }
    ]
),

    // Only show this single link if not approver
    ...(user.approver !== "1"
      ? [{ path: "/leave", label: "Leave" }]
      : [
          {
            label: "Leave",
            children: [
              { path: "/leave", label: "Leave Application" },
              { path: "/leaveapproval", label: "Leave for Approval" }
            ]
          }
        ]
    ),
  
// Only show this single link if not approver
...(user.approver !== "1"
  ? [{ path: "/official-business", label: "Official Business" }]
  : [
      {
        label: "Official Business",
        children: [
          { path: "/official-business", label: "Official Business Application" },
          { path: "/official-business", label: "Official Business for Approval" }
        ]
      }
    ]
),

  ];
  

  return (
    <>
      {/* Top Blue Bar */}
      <div className="flex justify-center items-center bg-blue-900 text-white p-3 fixed top-0 left-0 w-full h-[30px] z-30">
        <span className="font-bold text-lg">NAYSA SOLUTIONS INC.</span>
      </div>

      {/* Main Navbar */}
      <div className="flex justify-between items-center bg-white shadow-md p-3 fixed top-[15px] mt-3 left-0 w-full z-20">
        {/* Logo + Portal */}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <img src="naysa_logo.png" className="w-[100px] h-[60px]" alt="Naysa Logo" />
          <span className="text-blue-800 font-bold text-lg mt-3">Employee Portal</span>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex space-x-20">
        {navItems.map((item, index) => (
  <div key={index} className="relative group">
    {item.children ? (
      <>
        <span className="cursor-pointer text-blue-800 hover:font-extrabold">
          {item.label}
        </span>
        <div className="absolute hidden group-hover:block bg-white shadow-md rounded-md mt-0.5 z-20">
          {item.children.map((child, idx) => (
            <div
              key={idx}
              onClick={() => navigate(child.path)}
              className={`whitespace-nowrap px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                isActive(child.path) ? "font-bold text-blue-900" : "text-gray-700"
              }`}
            >
              {child.label}
            </div>
          ))}
        </div>
      </>
    ) : (
      <span
        onClick={() => navigate(item.path)}
        className={`cursor-pointer hover:font-extrabold ${
          isActive(item.path) ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-800"
        }`}
      >
        {item.label}
      </span>
    )}
  </div>
))}
        </div>

{/* Right Side Controls */}
<div className="flex items-center space-x-4 relative">
          {/* Hamburger Icon on Mobile */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 text-gray-600 focus:outline-none"
          >
            <FontAwesomeIcon icon={isMobileMenuOpen ? faXmark : faBars} size="lg" />
          </button>

          {/* Profile Picture */}
          <div
            className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden shadow-md cursor-pointer"
            onClick={toggleDropdown}
          >
            <img src="3135715.png" alt="Profile" className="w-full h-full object-cover" />
          </div>

          {/* Profile Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-12 w-48 bg-white rounded-lg shadow-md py-2 z-30">
              <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">Account Management</button>
              <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">Settings</button>
              <button
                className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                onClick={() => navigate("/")}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-[100px] left-0 w-full bg-white shadow-md z-10 py-4 px-6">
          <div className="flex flex-col space-y-4">
          {navItems.map((item, index) => (
  <div key={index}>
    {item.children ? (
      <div className="mb-2">
        <p className="font-semibold text-blue-800">{item.label}</p>
        <div className="ml-4">
          {item.children.map((child, idx) => (
            <span
              key={idx}
              onClick={() => {
                navigate(child.path);
                setIsMobileMenuOpen(false);
              }}
              className={`block py-1 cursor-pointer ${
                isActive(child.path) ? "text-blue-900 font-bold" : "text-gray-700"
              }`}
            >
              {child.label}
            </span>
          ))}
        </div>
      </div>
    ) : (
      <span
        onClick={() => {
          navigate(item.path);
          setIsMobileMenuOpen(false);
        }}
        className={`cursor-pointer text-md hover:font-semibold ${
          isActive(item.path) ? "text-blue-900 font-bold border-l-4 pl-2 border-blue-900" : "text-gray-700"
        }`}
      >
        {item.label}
      </span>
    )}
  </div>
))}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
