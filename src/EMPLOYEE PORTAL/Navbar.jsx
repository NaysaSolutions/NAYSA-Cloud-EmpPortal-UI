import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faXmark,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "./AuthContext";
import { useSidebarStore } from "./useSidebarStore";
import { getAccessRights } from "./accessRights";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isOpen: isSidebarOpen, toggleSidebar } = useSidebarStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const companyName =
    user?.comp_name?.trim?.() ||
    user?.compName?.trim?.() ||
    "Employee Portal";

  const employeeName =
    user?.empName?.trim?.() ||
    user?.emp_name?.trim?.() ||
    user?.employeeName?.trim?.() ||
    "Employee";

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
    setIsDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    navigate("/", { replace: true });
  };

  const navigateTo = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
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

  useEffect(() => {
    // Close mobile navigation after a route change.
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Prevent the page behind the mobile menu from scrolling.
    if (!isMobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const isActive = (path) => location.pathname === path;

  const isParentActive = (children = []) =>
    children.some((child) => isActive(child.path));

  const isEnabled = (value) =>
    ["1", "y", "yes", "true"].includes(
      String(value ?? "")
        .trim()
        .toLowerCase()
    );

  const getUserField = (fieldName) => {
    const normalizedName = fieldName.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const matchedKey = Object.keys(user || {}).find(
      (key) =>
        key.toLowerCase() === fieldName.toLowerCase() ||
        key.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalizedName
    );

    return matchedKey ? user[matchedKey] : undefined;
  };

  const {
    isHr,
    canApprove,
    canConfirmDtr,
    canManageEmployeeShifts,
    canApproveEmployeeShifts,
  } = getAccessRights(user);

  const portalAccess = {
    dtr: isEnabled(getUserField("portalDTR")),
    dtrConfirmation: isEnabled(
      getUserField("portalDTRConfirm") ?? getUserField("portalDTConfirm")
    ),
    timekeeping: isEnabled(getUserField("portalTK")),
    leave: isEnabled(getUserField("portalLV")),
    officialBusiness: isEnabled(getUserField("portalOB")),
    overtime: isEnabled(getUserField("portalOT")),
    offset: isEnabled(getUserField("portalOffSet")),
  };

  const timekeepingChildren = [
    ...(portalAccess.timekeeping
      ? [{ path: "/timekeeping", label: "Timekeeping (In and Out)" }]
      : []),
    ...(portalAccess.timekeeping
      ? [{ path: "/timekeepingAdj", label: "Timekeeping (Adjustment)" }]
      : []),
    ...(portalAccess.dtr && canApprove
      ? [
          {
            path: "/timekeepingAdjApproval",
            label: "Timekeeping for Approval",
          },
        ]
      : []),
    ...(canConfirmDtr
      ? [{ path: "/dtrApproval", label: "DTR Confirmation" }]
      : []),
    ...(portalAccess.dtr
      ? [{ path: "/dtrMonitoring", label: "DTR Monitoring" }]
      : []),
  ];

  const leaveChildren = [
    { path: "/leave", label: "Leave Application" },
    ...(canApprove
      ? [{ path: "/leaveapproval", label: "Leave for Approval" }]
      : []),
    ...(portalAccess.leave
      ? [{ path: "/leaveMonitoring", label: "Leave Monitoring" }]
      : []),
  ];

  // Build navigation only after the user record is available.
  const navItems = user
    ? [
        { path: "/dashboard", label: "Inquiry" },
        {
          label: "Employee Shift",
          children: [
            {
              path: "/employee-shift",
              label: canManageEmployeeShifts
                ? "Employee Shift Setup"
                : "My Shift Schedule",
            },
            ...(canApproveEmployeeShifts
              ? [
                  {
                    path: "/employee-shift-approval",
                    label: "Shift Change for Approval",
                  },
                ]
              : []),
          ],
        },
        ...(timekeepingChildren.length
          ? [
              {
                label: "Timekeeping",
                children: timekeepingChildren,
              },
            ]
          : []),
        { path: "/payslipviewer", label: "Payslip" },
        ...(portalAccess.overtime
          ? !canApprove
            ? [{ path: "/overtime", label: "Overtime" }]
            : [
                {
                  label: "Overtime",
                  children: [
                    { path: "/overtime", label: "Overtime Application" },
                    {
                      path: "/overtimeapproval",
                      label: "Overtime for Approval",
                    },
                  ],
                },
              ]
          : []),
        ...(portalAccess.leave
          ? [{ label: "Leave", children: leaveChildren }]
          : []),
        ...(portalAccess.officialBusiness
          ? !canApprove
            ? [
                {
                  path: "/official-business",
                  label: "Official Business",
                },
              ]
            : [
                {
                  label: "Official Business",
                  children: [
                    {
                      path: "/official-business",
                      label: "Official Business Application",
                    },
                    {
                      path: "/OfficialBusinessApproval",
                      label: "Official Business for Approval",
                    },
                  ],
                },
              ]
          : []),
        ...(portalAccess.offset
          ? !canApprove
            ? [{ path: "/offsetApplication", label: "Offset" }]
            : [
                {
                  label: "Offset",
                  children: [
                    {
                      path: "/offsetApplication",
                      label: "Offset Application",
                    },
                    {
                      path: "/offsetApproval",
                      label: "Offset for Approval",
                    },
                  ],
                },
              ]
          : []),
      ]
    : [];

  return (
    <>
      {/* Company bar */}
      <div className="fixed left-0 top-0 z-40 flex h-[30px] w-full items-center justify-center bg-blue-900 px-3 text-white shadow-sm select-none">
        <span className="max-w-full truncate text-center text-[13px] font-bold tracking-wide sm:text-sm lg:text-[15px]">
          {companyName}
        </span>
      </div>

      {/* Main navbar */}
      <header className="fixed left-0 top-[30px] z-40 w-full border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md select-none">
        <div className="mx-auto flex h-[50px] w-full items-center justify-between gap-2 px-2 sm:px-3 lg:px-4 xl:px-5">
          {/* Left: sidebar + branding */}
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-blue-800 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <FontAwesomeIcon
                icon={isSidebarOpen ? faXmark : faBars}
                className="text-[18px]"
              />
            </button>

            <button
              type="button"
              onClick={() => navigateTo("/dashboard")}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Go to dashboard"
            >
              <img
                src="/naysa_logo.png"
                className="h-[38px] w-[62px] shrink-0 object-contain sm:h-[42px] sm:w-[70px]"
                alt="Naysa Logo"
              />
              <span className="whitespace-nowrap text-[12px] font-bold text-blue-800 min-[420px]:inline sm:text-[15px] xl:text-sm">
                Employee Portal
              </span>
            </button>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
            <div className="flex min-w-0 items-center justify-center gap-1 xl:gap-2 2xl:gap-3">
              {navItems.map((item, index) => {
                const parentActive = item.children
                  ? isParentActive(item.children)
                  : false;

                return (
                  <div key={`${item.label}-${index}`} className="group relative">
                    {item.children ? (
                      <>
                        <button
                          type="button"
                          className={`flex items-center gap-1 rounded-xl px-2 py-2 text-[12px] font-semibold transition-all xl:px-2.5 xl:text-[13px] 2xl:px-3 2xl:text-sm ${
                            parentActive
                              ? "bg-blue-50 text-blue-900"
                              : "text-blue-800 hover:bg-blue-50 hover:text-blue-900"
                          }`}
                        >
                          <span className="whitespace-nowrap">{item.label}</span>
                          <FontAwesomeIcon
                            icon={faChevronDown}
                            className="text-[9px] opacity-70 transition-transform duration-200 group-hover:rotate-180"
                          />
                        </button>

                        <div className="invisible absolute left-1/2 top-full z-50 min-w-[220px] -translate-x-1/2 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/10">
                            {item.children.map((child, idx) => (
                              <button
                                type="button"
                                key={`${child.path}-${idx}`}
                                onClick={() => navigateTo(child.path)}
                                className={`block w-full whitespace-nowrap px-4 py-2.5 text-left text-sm transition-colors ${
                                  isActive(child.path)
                                    ? "bg-blue-100 font-semibold text-blue-900"
                                    : "text-slate-700 hover:bg-blue-100 hover:text-blue-900"
                                }`}
                              >
                                {child.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigateTo(item.path)}
                        className={`rounded-xl px-2 py-2 text-[12px] font-semibold transition-all xl:px-2.5 xl:text-[13px] 2xl:px-3 2xl:text-sm ${
                          isActive(item.path)
                            ? "bg-blue-100 text-blue-900"
                            : "text-blue-800 hover:bg-blue-100 hover:text-blue-900"
                        }`}
                      >
                        <span className="whitespace-nowrap">{item.label}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Right: profile + mobile menu */}
          <div
            ref={dropdownRef}
            className="relative flex shrink-0 items-center gap-1 sm:gap-2"
          >
            <button
              type="button"
              onClick={toggleDropdown}
              className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Open profile menu"
              aria-expanded={isDropdownOpen}
            >
              <div className="hidden max-w-[120px] text-right xl:block xl:max-w-[180px]">
                <p className="text-[9px] font-semibold text-slate-700">
                  {employeeName}
                </p>
                <p className="text-[9px] text-slate-400">My Account</p>
              </div>

              <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-blue-100 bg-slate-100 shadow-sm sm:h-10 sm:w-10">
                <img
                  src={user?.empNo ? `/${user.empNo}.jpg` : "/Default.jpg"}
                  alt="Profile"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/Default.jpg";
                  }}
                  className="h-full w-full object-cover"
                />
              </div>
            </button>

            <button
              type="button"
              onClick={toggleMobileMenu}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 xl:hidden"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              <FontAwesomeIcon
                icon={isMobileMenuOpen ? faXmark : faBars}
                className="text-[19px]"
              />
            </button>

            {/* Profile dropdown */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-[48px] z-[70] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                <div className="border-b border-slate-100 px-4 py-3 2xl:hidden">
                  <p className="truncate text-[10px] font-semibold text-slate-800">
                    {employeeName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">My Account</p>
                </div>

                <div className="py-1.5">
                  {isHr && (
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-blue-800 transition-colors hover:bg-blue-50"
                      onClick={() => navigateTo("/employee-access-settings")}
                    >
                      Settings
                    </button>
                  )}

                  <button
                    type="button"
                    className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile/tablet menu backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-[88px] z-40 bg-slate-900/20 backdrop-blur-[1px] xl:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile/tablet navigation */}
      <aside
        className={`fixed left-0 top-[88px] z-50 w-full border-t border-slate-100 bg-white shadow-xl transition-all duration-200 ease-out xl:hidden ${
          isMobileMenuOpen
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-2 opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        {/*
          IMPORTANT:
          max-height keeps the menu inside the device viewport.
          overflow-y-auto adds a vertical scrollbar whenever the menu is taller
          than the available screen height.
        */}
        <div
          className="max-h-[calc(100dvh-88px)] overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4"
          style={{
            scrollbarWidth: "thin",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 pb-[max(12px,env(safe-area-inset-bottom))]">
            {navItems.map((item, index) => {
              const parentActive = item.children
                ? isParentActive(item.children)
                : false;

              return (
                <div key={`${item.label}-${index}`}>
                  {item.children ? (
                    <div
                      className={`overflow-hidden rounded-xl border ${
                        parentActive
                          ? "border-blue-200 bg-blue-50/40"
                          : "border-slate-100 bg-slate-50/60"
                      }`}
                    >
                      <div
                        className={`px-3 py-2.5 text-[13px] font-bold sm:px-4 sm:text-sm ${
                          parentActive ? "text-blue-900" : "text-blue-800"
                        }`}
                      >
                        {item.label}
                      </div>

                      <div className="border-t border-slate-100 bg-white px-2 py-1.5 sm:px-3">
                        {item.children.map((child, idx) => (
                          <button
                            type="button"
                            key={`${child.path}-${idx}`}
                            onClick={() => navigateTo(child.path)}
                            className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors sm:text-sm ${
                              isActive(child.path)
                                ? "bg-blue-50 font-semibold text-blue-900"
                                : "text-slate-700 hover:bg-slate-50 hover:text-blue-900"
                            }`}
                          >
                            <span
                              className={`mr-3 h-1.5 w-1.5 shrink-0 rounded-full ${
                                isActive(child.path)
                                  ? "bg-blue-800"
                                  : "bg-slate-300"
                              }`}
                            />
                            {child.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigateTo(item.path)}
                      className={`flex w-full items-center rounded-xl border px-3 py-3 text-left text-[13px] font-semibold transition-colors sm:px-4 sm:text-sm ${
                        isActive(item.path)
                          ? "border-blue-200 bg-blue-50 text-blue-900"
                          : "border-slate-100 bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-900"
                      }`}
                    >
                      {item.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
