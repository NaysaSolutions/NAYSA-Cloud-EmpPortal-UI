import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark, faBell } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from "./AuthContext"; // Use Auth context

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); // Get user from context
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef();

  const toggleDropdown = () => setIsDropdownOpen(prev => !prev);
  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path) => location.pathname === path;

  // Build nav items only if user is loaded
  const navItems = user ? [
    { path: "/dashboard", label: "Inquiry" },
    { path: "/timekeeping", label: "Timekeeping" },
    ...(user.approver !== "1"
      ? [{ path: "/overtime", label: "Overtime" }]
      : [{
          label: "Overtime",
          children: [
            { path: "/overtime", label: "Overtime Application" },
            { path: "/overtimeapproval", label: "Overtime for Approval" }
          ]
        }]
    ),
    ...(user.approver !== "1"
      ? [{ path: "/leave", label: "Leave" }]
      : [{
          label: "Leave",
          children: [
            { path: "/leave", label: "Leave Application" },
            { path: "/leaveapproval", label: "Leave for Approval" }
          ]
        }]
    ),
    ...(user.approver !== "1"
      ? [{ path: "/official-business", label: "Official Business" }]
      : [{
          label: "Official Business",
          children: [
            { path: "/official-business", label: "Official Business Application" },
            { path: "/OfficialBusinessApproval", label: "Official Business for Approval" }
          ]
        }]
    ),
  ] : [];

  return (
    <>
      {/* Top Blue Bar */}
      <div className="flex justify-center items-center bg-blue-900 text-white p-3 fixed top-0 left-0 w-full h-[30px] z-30">
        <span className="font-bold text-lg">NAYSA SOLUTIONS INC.</span>
      </div>

      {/* Main Navbar */}
      <div className="flex justify-between items-center bg-white shadow-md p-3 fixed top-[15px] mt-3 left-0 w-full z-20">
        {/* Logo + Title */}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <img src="/naysa_logo.png" className="w-[100px] h-[60px]" alt="Naysa Logo" />
          <span className="text-blue-800 font-bold mt-1 text-base sm:text-base md:text-lg lg:text-xl">Employee Portal</span>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden sm:hidden md:hidden lg:flex space-x-12 text-sm sm:text-sm md:text-base lg:text-xl">
          {navItems.map((item, index) => (
            <div key={index} className="relative group">
              {item.children ? (
                <>
                  <span className="cursor-pointer text-blue-800 hover:font-extrabold">{item.label}</span>
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
        <div className="flex items-center space-x-4 relative" ref={dropdownRef}>
          <h2 className="text-blue-800 mt-1 font-bold text-base sm:text-base md:text-lg lg:text-xl hidden sm:block">
            {user?.empName || "Employee"}
          </h2>

          {/* Profile Picture */}
          <div
            className="w-10 h-10 rounded-full overflow-hidden cursor-pointer"
            onClick={toggleDropdown}
          >
            <img
              src={user?.empNo ? `/${user.empNo}.jpg` : "/Default.jpg"}
              alt="Profile"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/Default.jpg";
              }}
              className="w-full h-full object-cover shadow-md"
            />
          </div>

          {/* Hamburger Icon */}
          <button onClick={toggleMobileMenu} className="lg:hidden p-2 text-gray-600 focus:outline-none">
            <FontAwesomeIcon icon={isMobileMenuOpen ? faXmark : faBars} size="lg" />
          </button>

          {/* Profile Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-12 w-48 bg-white rounded-lg py-2 z-30 shadow-lg">
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

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed top-[100px] left-0 w-full bg-white shadow-md z-10 py-4 px-6">
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
