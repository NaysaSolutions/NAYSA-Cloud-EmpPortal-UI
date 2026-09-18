import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark, faBell } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from "./AuthContext"; // Use Auth context
import { useSidebarStore } from "./useSidebarStore";
import { getAccessRights } from "./accessRights";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth(); // Get user from context
  const { isOpen: isSidebarOpen, toggleSidebar } = useSidebarStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef();
  const companyName =
    user?.comp_name?.trim?.() || user?.compName?.trim?.() || "Employee Portal";

  const toggleDropdown = () => setIsDropdownOpen(prev => !prev);
  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    navigate("/", { replace: true });
  };

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
  const isEnabled = (value) => ["1", "y", "yes", "true"].includes(String(value ?? "").trim().toLowerCase());
  const getUserField = (fieldName) => {
    const normalizedName = fieldName.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const matchedKey = Object.keys(user || {}).find(
      (key) => key.toLowerCase() === fieldName.toLowerCase() ||
        key.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalizedName
    );
    return matchedKey ? user[matchedKey] : undefined;
  };
  const { isApprover, isHr, isManager, canApprove, canConfirmDtr,
    canViewDtrMonitoring, canViewLeaveMonitoring, canManageEmployeeShifts,
    canApproveEmployeeShifts } = getAccessRights(user);

// console.log("Access Rights:", isApprover, isHr, isManager, canConfirmDtr)

  const portalAccess = {
    dtr: isEnabled(getUserField("portalDTR")),
    dtrConfirmation: isEnabled(getUserField("portalDTRConfirm") ?? getUserField("portalDTConfirm")),
    timekeeping: isEnabled(getUserField("portalTK")),
    leave: isEnabled(getUserField("portalLV")),
    officialBusiness: isEnabled(getUserField("portalOB")),
    overtime: isEnabled(getUserField("portalOT")),
    offset: isEnabled(getUserField("portalOffSet")),
  };
  const timekeepingChildren = [
    ...(portalAccess.timekeeping ? [{ path: "/timekeeping", label: "Timekeeping (In and Out)" }] : []),
    ...(portalAccess.timekeeping ? [{ path: "/timekeepingAdj", label: "Timekeeping (Adjustment)" }] : []),
    ...(portalAccess.dtr && canApprove
      ? [{ path: "/timekeepingAdjApproval", label: "Timekeeping for Approval" }]
      : []),
    ...(canConfirmDtr
      ? [{ path: "/dtrApproval", label: "DTR Confirmation" }]
      : []),
    ...(portalAccess.dtr ? [{ path: "/dtrMonitoring", label: "DTR Monitoring" }] : []),
  ];
  const leaveChildren = [
    { path: "/leave", label: "Leave Application" },
    ...(canApprove
      ? [{ path: "/leaveapproval", label: "Leave for Approval" }]
      : []),
    ...(portalAccess.leave ? [{ path: "/leaveMonitoring", label: "Leave Monitoring" }] : []),
  ];
 

  // Build nav items only if user is loaded
  const navItems = user ? [
    { path: "/dashboard", label: "Inquiry" },
    {
      label: "Employee Shift",
      children: [
        { path: "/employee-shift", label: canManageEmployeeShifts ? "Employee Shift Setup" : "My Shift Schedule" },
        ...(canApproveEmployeeShifts ? [{ path: "/employee-shift-approval", label: "Shift Change for Approval" }] : []),
      ]
    },
    ...(timekeepingChildren.length ? [{
      label: "Timekeeping",
      children: timekeepingChildren
    }] : []),
    {
      path: "/payslipviewer", label: "Payslip"
    },
    ...(portalAccess.overtime ? (!canApprove
      ? [{ path: "/overtime", label: "Overtime" }]
      : [{
        label: "Overtime",
        children: [
          { path: "/overtime", label: "Overtime Application" },
          { path: "/overtimeapproval", label: "Overtime for Approval" }
        ]
      }]) : []),
    ...(portalAccess.leave ? [{
      label: "Leave",
      children: leaveChildren
    }] : []),
    ...(portalAccess.officialBusiness ? (!canApprove
      ? [{ path: "/official-business", label: "Official Business" }]
      : [{
        label: "Official Business",
        children: [
          { path: "/official-business", label: "Official Business Application" },
          { path: "/OfficialBusinessApproval", label: "Official Business for Approval" }
        ]
      }]) : []),
    ...(portalAccess.offset ? (!canApprove
      ? [{ path: "/offsetApplication", label: "Offset" }]
      : [{
        label: "Offset",
        children: [
          { path: "/offsetApplication", label: "Offset Application" },
          { path: "/offsetApproval", label: "Offset for Approval" }
        ]
      }]) : []),
  ] : [];


  /*
   * Portal access is returned by the dashboard endpoint and controls whether a
   * module is offered in navigation. HR/approver status only exposes the
   * approval child after the matching primary portal permission is enabled.
   */
  /*
  {
      label: "Timekeeping",
      children: timekeepingChildren
    },
    { path: "/payslipviewer", label: "Payslip" }, // ← Insert here
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
    {
      label: "Leave",
      children: leaveChildren
    },

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
  */


  return (
    <>
      {/* Top Blue Bar */}
      <div className="flex justify-center items-center bg-blue-900 text-white p-3 fixed top-0 left-0 w-full h-[30px] z-30 cursor-pointer select-none">
        {/* <span className="font-bold text-sm md:text-lg">NEW NEMAR DEVELOPMENT CORPORATION</span> */}
        {/* <span className="font-bold text-lg">STT (PHILIPPINES), INC.</span> */}
        {/* <span className="font-bold text-lg">TEST SOLUTION SERVICES INC.</span> */}
        {/* <span className="font-bold text-lg">NAYSA-SOLUTIONS INC.</span> */}
        <span className="font-bold text-lg">{companyName}</span>
      </div>

      {/* Main Navbar */}
      <div className="flex justify-between items-center bg-white shadow-md p-1 fixed top-[15px] mt-3 left-0 w-full z-20 cursor-pointer select-none">
        {/* Logo + Title */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-md text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <FontAwesomeIcon icon={isSidebarOpen ? faXmark : faBars} size="lg" />
          </button>

          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <img src="/naysa_logo.png" className="w-[75px] h-[45px]" alt="Naysa Logo" />
            <span className="text-blue-800 font-bold mt-1 text-[14px] sm:text-base md:text-base">Employee Portal</span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden sm:hidden md:hidden lg:flex space-x-10 text-sm sm:text-sm md:text-base lg:text-lg">
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
                        className={`whitespace-nowrap px-4 py-2 hover:bg-gray-100 cursor-pointer ${isActive(child.path) ? "font-bold text-blue-900" : "text-gray-700"
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
                  className={`cursor-pointer hover:font-extrabold ${isActive(item.path) ? "text-blue-900 font-bold border-b-2 border-blue-900" : "text-blue-800"
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
          <h2 className="text-blue-800 mt-1 font-bold text-base sm:text-base md:text-base hidden sm:block">
            {/* {user?.empName || "Employee"} */}
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
              {isHr && (
                <button
                  className="block px-4 py-2 text-sm text-blue-800 hover:bg-blue-50 w-full text-left"
                  onClick={() => {
                    navigate("/employee-access-settings");
                    setIsDropdownOpen(false);
                  }}
                >
                  Settings
                </button>
              )}
              <button
                className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed top-[80px] left-0 w-full bg-white shadow-md z-10 py-2 px-4">
          <div className="flex flex-col space-y-3">
            {navItems.map((item, index) => (
              <div key={index}>
                {item.children ? (
                  <div className="mb-0">
                    <p className="font-semibold text-blue-800">{item.label}</p>
                    <div className="ml-8">
                      {item.children.map((child, idx) => (
                        <span
                          key={idx}
                          onClick={() => {
                            navigate(child.path);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`block py-1.5 cursor-pointer ${isActive(child.path) ? "text-blue-900 font-bold" : "text-gray-700"
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
                    className={`cursor-pointer text-md hover:font-semibold ${isActive(item.path) ? "text-blue-900 font-bold border-l-4 pl-2 border-blue-900" : "text-gray-700"
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
