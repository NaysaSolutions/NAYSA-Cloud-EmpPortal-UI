import React, { useState, useEffect } from "react";
import { Tooltip } from "react-tooltip";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Import AuthContext
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faClock } from "@fortawesome/free-solid-svg-icons";
import LeaveCreditModal from "./LeaveCreditModal";
import API_ENDPOINTS from "@/apiConfig.jsx";
import "@/index.css";
import Timekeeping from "./Timekeeping"; // Adjust the path as needed

dayjs.extend(advancedFormat);

const Dashboard = () => {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf("month"));
  const [entryTime, setEntryTime] = useState(null); // Entry Time
  const [breakTime, setBreakTime] = useState(3600); // Default break time in seconds (1 hour)
  const [isCounting, setIsCounting] = useState(false); // Tracks whether the countdown is active
  const [dailyTimeRecord, setDailyTimeRecord] = useState([]); // Store Daily Time Record
  const [leaveCredit, setLeaveCredit] = useState([]); // Store Daily Time Record
  const [loanBalance, setLoanBalance] = useState([]); // Store Daily Time Record
  const [leaveApplication, setLeaveApplication] = useState([]); // Store Leave Applications
  const [otApplication, setOtApplication] = useState([]); // Store Overtime Applications
  const [obApplication, setOfficialBusinessApplication] = useState([]); // Store OB Applications
  const [otApproval, setOtApproval] = useState([]); // Store Overtime Approvals
  const [leaveApproval, setLeaveApproval] = useState([]); // Store Leave Approvals
  const [obApproval, setOfficialBusinessApproval] = useState([]); // Store OB Approvals
  const [holidays, setHolidays] = useState([]);
  const [message, setMessage] = useState(""); // New state for messages
  const [time, setTime] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null); // Error state
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [showBackToTop, setShowBackToTop] = useState(false);

  const DEFAULT_SUM = {
    LVApplicationCount: 0,
    LVApprovalCount: 0,
    OTApplicationCount: 0,
    OTApprovalCount: 0,
    OBApplicationCount: 0,
    OBApprovalCount: 0,
    DTRApplicationCount: 0,
    DTRApprovalCount: 0,
  };

  const [approvalsum, setApprovalsum] = useState(DEFAULT_SUM);


  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (user?.empNo) {
      fetchDashboardData(user.empNo); // Pass empNo explicitly
    }
  }, [user?.empNo]); // Run effect when empNo changes

  const startBreakCountdown = () => {
    setBreakTime(3600); // reset to 1 hour or your desired countdown
    setIsCounting(true); // start the countdown
  };

  <Timekeeping onBreakStart={startBreakCountdown} />;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      };
      setTime(new Intl.DateTimeFormat("en-US", options).format(now));
    };

    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);
  // If no user is logged in, return an empty container
  if (!user) {
    return <div className="p-6">Loading...</div>;
  }

  const fetchDashboardData = async () => {
    if (!user || !user.empNo) return;

    try {
      // Fetch the main dashboard data, which now includes a complete list of leave types
      const dashboardResponse = await fetch(API_ENDPOINTS.dashBoard, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ EMP_NO: user.empNo }),
      });

      const dashboardResult = await dashboardResponse.json();

      if (
        dashboardResult.success &&
        Array.isArray(dashboardResult.data) &&
        dashboardResult.data.length > 0
      ) {
        const employee =
          dashboardResult.data.find((emp) => emp.empNo === user.empNo) ||
          dashboardResult.data[0];

        setUser((prev) => ({
          ...prev,
          approver: employee.approver,
        }));

        // Directly use the leaveCredit array from the API response
        setLeaveCredit(employee.leaveCredit || []);
        setDailyTimeRecord(employee.dailyTimeRecord || []);
        setLoanBalance(employee.loanBalance || []);
        setOtApproval(employee.otApproval || []);
        setLeaveApproval(employee.leaveApproval || []);
        setOfficialBusinessApproval(employee.obApproval || []);
        setHolidays(employee.holidays || []);
        setLeaveApplication(employee.leaveApplication || []);
        setOtApplication(employee.otApplication || []);
        setOfficialBusinessApplication(employee.obApplication || []);

        const raw = employee.approvalsum;
        const one = Array.isArray(raw) ? (raw[0] || DEFAULT_SUM) : (raw || DEFAULT_SUM);

        setApprovalsum({
          LVApplicationCount: Number(one.LVApplicationCount ?? 0),
          LVApprovalCount:  Number(one.LVApprovalCount ?? 0),
          OTApplicationCount: Number(one.OTApplicationCount ?? 0),
          OTApprovalCount:  Number(one.OTApprovalCount ?? 0),
          OBApplicationCount: Number(one.OBApplicationCount ?? 0),
          OBApprovalCount:  Number(one.OBApprovalCount ?? 0),
          DTRApplicationCount: Number(one.DTRApplicationCount ?? 0),
          DTRApprovalCount:  Number(one.DTRApprovalCount ?? 0),
        });

      } else {
        setError("API response format is incorrect or no data found.");
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("An error occurred while fetching the records.");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user.empNo]);

  useEffect(() => {
    console.log("Leave Approval Data:", leaveApproval);
    console.log("OT Approval Data:", otApproval);
    console.log("OB Approval Data:", obApproval);
    console.log("Approval Data:", approvalsum);
  }, [leaveApproval, otApproval, obApproval, approvalsum]);

  // Current Date and Time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let countdown;
    if (isCounting && breakTime > 0) {
      countdown = setInterval(() => {
        setBreakTime((prev) => prev - 1);
      }, 1000);
    }
    if (breakTime <= 0) {
      clearInterval(countdown);
      setIsCounting(false);
      Swal.fire("Time's Up!", "Your break is over.", "warning");
    }
    return () => clearInterval(countdown);
  }, [isCounting, breakTime]);

  // Convert seconds to HH:MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Personal Calendar Navigation
  const handlePrevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, "month"));
  };

  // Generate Calendar Days
  const generateCalendar = () => {
    const startDay = currentMonth.startOf("month").day();
    const daysInMonth = currentMonth.daysInMonth();
    const prevMonthDays = currentMonth.subtract(1, "month").daysInMonth();
    const today = dayjs().date();
    const currentMonthNumber = dayjs().month();

    let days = [];

    // const pendingLeaveDays = new Set();
    // const approvedLeaveDays = new Set();
    const approvedLeaveDays = new Map();
    const pendingLeaveDays = new Map();

    const holidayDays = new Set();

    holidays.forEach((holiday) => {
      const holidayDate = dayjs(holiday.holdate);
      if (holidayDate.month() === currentMonth.month()) {
        holidayDays.add(holidayDate.date());
      }
    });

    leaveApplication.forEach((leave) => {
      const dates = leave.dateapplied.split(" - ");
      let startDate, endDate;

      if (dates.length === 1) {
        startDate = dayjs(dates[0], "MM/DD/YYYY");
        endDate = dayjs(dates[0], "MM/DD/YYYY");
      } else if (dates.length === 2) {
        startDate = dayjs(dates[0], "MM/DD/YYYY");
        endDate = dayjs(dates[1], "MM/DD/YYYY");
      }

      if (startDate && endDate && startDate.isValid() && endDate.isValid()) {
        let current = startDate;
        while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
          if (current.month() === currentMonth.month()) {
            const day = current.date();
            const leaveData = {
              type: leave.leavetype,
              fullDate: current.format("YYYY-MM-DD"),
            };

            if (leave.leavestatus === "Approved") {
              approvedLeaveDays.set(day, leaveData);
            } else if (leave.leavestatus === "Pending") {
              pendingLeaveDays.set(day, leaveData);
            }
          }
          current = current.add(1, "day");
        }
      }
    });

    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, currentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const approved = approvedLeaveDays.get(i);
      const pending = pendingLeaveDays.get(i);

      days.push({
        day: i,
        currentMonth: true,
        isToday: i === today && currentMonth.month() === currentMonthNumber,
        isApprovedLeave: !!approved,
        isPendingLeave: !!pending,
        leaveType: approved?.type || pending?.type || null,
        isHoliday: holidayDays.has(i),
      });
    }

    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        days.push({ day: i, currentMonth: false });
      }
    }

    return days;
  };

  // Calculate totals for stat cards
  // const pendingLeaveCount = leaveApplication.filter(
  //   (leave) => leave.leavestatus === "Pending"
  // ).length;
  // const pendingOtCount = otApplication.filter(
  //   (ot) => ot.otstatus === "Pending"
  // ).length;
  //  const pendingDTRCount = DTRApplication.filter(
  //   (dtr) => dtr.dtrstatus === "Pending"
  // ).length;
  // const pendingLeaveApproval = leaveApproval.filter(
  //   (leave) => leave.leavestatus === "Pending"
  // ).length;
  // const pendingOtApproval = otApproval.filter(
  //   (ot) => ot.otstatus === "Pending"
  // ).length;
  // const pendingObApproval = obApproval.filter(
  //   (ob) => ob.obstatus === "Pending"
  // ).length;


  return (
    <div className="mt-[80px] p-4 bg-gray-100 min-h-screen ml-0 lg:ml-[200px]">
      {/* Header */}
      <div className="flex justify-center sm:justify-between items-start w-full">
        <div className="bg-blue-800 p-3 rounded-lg text-white flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4 w-full shadow-lg">
          {/* Date Section */}
          <div className="text-center sm:text-left">
            <p className="text-sm sm:text-lg font-bold text-white">
              <span className="kanit-text">Today</span>
            </p>
            <h1 className="text-base sm:text-lg md:text-2xl font-extrabold text-white">
              {currentDate.format("MMMM DD, YYYY")}
            </h1>
          </div>

          {/* Entry Time and Break Time Count */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-10 items-center sm:items-start text-center sm:text-left">
            <div>
              <p className="text-sm font-extrabold text-white mb-2">
                Philippine Standard Time
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                {time || "00:00 PM"}
              </p>
            </div>
            {/* <div>
    <p className="text-sm font-extrabold  text-right mb-2">Break Time Count</p>
    <p className="text-xl sm:text-2xl font-bold">
      {formatTime(breakTime)}
    </p>
  </div> */}
            <div className="w-full md:w-auto">
              <button
                className="bg-blue-700 border border-blue-400 text-white font-bold px-5 py-4 rounded-md text-md sm:text-lg hover:bg-blue-800 hover:text-white hover:border-blue-300 w-full sm:w-auto mx-auto"
                onClick={() => navigate("/timekeeping")}
              >
                <FontAwesomeIcon icon={faClock} size="lg" className="mr-2" />
                Timekeeping
              </button>
              
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div
          className="bg-yellow-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
          onClick={() => navigate("/leave")}
        >
          <h3 className="font-bold text-xs md:text-base">
            Pending LV Applications
          </h3>
          <p className="text-xl md:text-2xl">{approvalsum?.LVApplicationCount ?? 0}</p>
        </div>
        <div
          className="bg-yellow-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
          onClick={() => navigate("/overtime")}
        >
          <h3 className="font-bold text-xs md:text-base">
            Pending OT Applications
          </h3>
          <p className="text-xl md:text-2xl">{approvalsum?.OTApplicationCount ?? 0}</p>
        </div>
        <div
          className="bg-yellow-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
          onClick={() => navigate("/Official-Business")}
        >
          <h3 className="font-bold text-xs md:text-base">
            Pending OB Applications
          </h3>
          <p className="text-xl md:text-2xl">{approvalsum?.OBApplicationCount ?? 0}</p>
        </div>
        <div
          className="bg-yellow-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
          onClick={() => navigate("/timekeepingAdj")}
        >
          <h3 className="font-bold text-xs md:text-base">
            Pending DTR Applications
          </h3>
          <p className="text-xl md:text-2xl">{approvalsum?.DTRApplicationCount ?? 0}</p>
        </div>
      </div>

      {user.approver === "1" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div
              className="bg-blue-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
              onClick={() => navigate("/leaveApproval")}
            >
              <h3 className="font-bold text-xs md:text-base">
                Pending LV for my Approval
              </h3>
              <p className="text-xl md:text-2xl">{approvalsum?.LVApprovalCount ?? 0}</p>
            </div>
            <div
              className="bg-blue-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
              onClick={() => navigate("/overtimeApproval")}
            >
              <h3 className="font-bold text-xs md:text-base">
                Pending OT for my Approval
              </h3>
              <p className="text-xl md:text-2xl">{approvalsum?.OTApprovalCount ?? 0}</p>
            </div>
            <div
              className="bg-blue-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
              onClick={() => navigate("/OfficialBusinessApproval")}
            >
              <h3 className="font-bold text-xs md:text-base">
                Pending OB for my Approval
              </h3>
              <p className="text-xl md:text-2xl">{approvalsum?.OBApprovalCount ?? 0}</p>
            </div>
            <div
              className="bg-blue-500 p-4 rounded-lg shadow-lg text-white cursor-pointer select-none"
              onClick={() => navigate("/timekeepingAdjApproval")}
            >
              <h3 className="font-bold text-xs md:text-base">
                Pending DTR for my Approval
              </h3>
              <p className="text-xl md:text-2xl">{approvalsum?.DTRApprovalCount ?? 0}</p>
            </div>
          </div>
        </>
      )}
      {/* Main Content */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2"> */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2">
        {/* Leave Credit Section */}
        <div className="bg-white p-6 sm:p-4 rounded-lg shadow-lg w-full">
          <h2 className="dashboard-text-header">Leave Credit</h2>
          {/* <span className="text-gray-500 text-sm font-normal mt-2 uppercase">Recent Transactions</span> */}

          {/* Table Structure */}
          <div className="mt-4 overflow-x-auto">
            <table className="dashboard-table">
              <thead className="dashboard-thead">
                <tr className="dashboard-thead ">
                  <th className="dashboard-th cursor-pointer text-left">
                    Leave Type
                  </th>
                  <th className="dashboard-th cursor-pointer">Credit</th>
                  <th className="dashboard-th cursor-pointer">Applied</th>
                  <th className="dashboard-th cursor-pointer">Used</th>
                  <th className="dashboard-th cursor-pointer">Remaining</th>
                  <th className="dashboard-th cursor-pointer">Actual</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {leaveCredit.length > 0 ? (
                  leaveCredit.map((leave, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td whitespace-nowrap">
                        {leave.description}
                      </td>
                      <td className="dashboard-td text-center">
                        {leave.credit}
                      </td>
                      <td className="dashboard-td text-center">
                        {leave.applied}
                      </td>
                      <td className="dashboard-td text-center">
                        {leave.availed}
                      </td>
                      <td className="dashboard-td text-center">
                        {leave.rembal}
                      </td>
                      <td className="dashboard-td text-center">
                        {leave.balance}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="p-4 text-center text-gray-600 text-sm"
                    >
                      No leave credits found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* View All Button
    {leaveCredit.length > 0 && (
      <div className="flex justify-end mt-20">
        <button onClick={() => setIsModalOpen(true)} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
          View All <span className="ml-1">→</span>
        </button>
      </div>
    )} */}

          {/* Leave Credit Modal */}
          <LeaveCreditModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            leaveCredit={leaveCredit}
          />
        </div>

        {/* Personal Calendar */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-lg w-full">
          <h2 className="text-base sm:text-base font-semibold mb-2 text-blue-800 text-center">
            Personal Calendar
          </h2>

          {/* Navigation */}
          <div className="flex justify-between items-center mb-2">
            <button onClick={handlePrevMonth} className="text-gray-400">
              ◀
            </button>
            <h3 className="text-sm sm:text-base font-semibold">
              {currentMonth.format("MMMM YYYY")}
            </h3>
            <button onClick={handleNextMonth} className="text-gray-600">
              ▶
            </button>
          </div>

          {/* <div className="items-center justify-center"> */}
          {/* Weekday Names */}
          <div className="grid grid-cols-7 text-center font-semibold text-gray-600 mb-1 ml-6 mx-auto text-[0.80rem] sm:text-[0.80rem] md:text-[0.90rem] lg:text-[15px]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
              (day, idx) => (
                <div
                  key={idx}
                  className="w-8 h-5 flex items-center justify-center "
                >
                  {day}
                </div>
              )
            )}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 text-center mt-2 ml-6 mx-auto text-[0.70rem] sm:text-[0.70rem] md:text-[0.80rem] lg:text-[13px]">
            {generateCalendar().map((day, index) => {
              let baseClasses =
                "w-6 h-6 sm:w-7 <md:w-7></md:w-7> lg:w-7 sm:h-8 md:h-6 lg:h-7 flex items-center justify-center font-semibold";
              let style = "";
              let tooltipText = "";

              if (!day.currentMonth) {
                style = "text-gray-300";
              } else if (day.isToday) {
                style = "bg-gray-300 text-black rounded-full";
              } else if (day.isHoliday) {
                style = "text-red-500 font-bold";
                const holiday = holidays.find(
                  (h) =>
                    dayjs(h.holdate).date() === day.day &&
                    dayjs(h.holdate).month() === currentMonth.month()
                );
                tooltipText = holiday?.holtype || "Holiday";
              } else if (day.isApprovedLeave) {
                style = "bg-blue-300 text-black rounded-full";
                tooltipText = `Approved: ${day.leaveType}`;
              } else if (day.isPendingLeave) {
                style =
                  "text-black rounded-full border border-4 border-yellow-300";
                tooltipText = `Pending: ${day.leaveType}`;
              } else {
                style = "text-gray-700";
              }

              return (
                <React.Fragment key={index}>
                  <div
                    data-tooltip-id={`tooltip-${index}`}
                    data-tooltip-content={tooltipText}
                    className={`${baseClasses} ${style}`}
                  >
                    {day.day}
                  </div>
                  {tooltipText && (
                    <Tooltip
                      id={`tooltip-${index}`}
                      place="top"
                      effect="solid"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* </div> */}

          {/* Calendar Legend */}
          <div className="flex justify-between text-xs md:text-sm mt-4">
            {/* <div className="flex items-center"><span className="w-4 h-4 rounded-lg bg-red-400 inline-block mr-1"></span> Holiday</div> */}
            <div className="flex items-center text-red-500 font-bold">
              <span className="w-4 h-4 rounded-lg bg-red-500 inline-block mr-1"></span>
              Holiday
            </div>
            <div className="flex items-center text-blue-400 font-bold">
              <span className="w-4 h-4 rounded-lg bg-blue-400 inline-block mr-1"></span>{" "}
              Approved Leave
            </div>
            <div className="flex items-center text-yellow-400 font-bold">
              <span className="w-4 h-4 rounded-lg bg-yellow-400 inline-block mr-1"></span>{" "}
              Pending Leave
            </div>
          </div>
        </div>
      </div>

      <hr className="mt-2 mb-2" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2 min-h-screen">
        {/* Daily Time Record Section */}
        <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
          <h2 className="dashboard-text-header">Daily Time Record</h2>
          <span className="dashboard-text-span">Recent Transactions</span>

          {/* Responsive Table */}
          <div className="mt-2 overflow-x-auto flex-grow">
            <table className="dashboard-table">
              <thead className="dashboard-thead">
                <tr className="dashboard-thead">
                  <th className="dashboard-th text-left">Date</th>
                  <th className="dashboard-th text-center">Time In</th>
                  <th className="dashboard-th text-center">Time Out</th>
                  <th className="dashboard-th text-right">Total Hrs</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {dailyTimeRecord.length > 0 ? (
                  dailyTimeRecord.map((record, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td text-left">
                        {dayjs(record.trandate).format("MM/DD/YYYY")}
                      </td>
                      <td className="dashboard-td text-center">
                        {record.time_in
                          ? dayjs(record.time_in).format("hh:mm A")
                          : "N/A"}
                      </td>
                      <td className="dashboard-td text-center">
                        {record.time_out
                          ? dayjs(record.time_out).format("hh:mm A")
                          : "N/A"}
                      </td>
                      <td className="dashboard-td text-right">
                        {record.reg_hrs.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="dashboard-div-norecords">
                        No DTR records found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* View All Button - Fixed on Small Screens */}
          {dailyTimeRecord.length > 0 && (
            <div className="relative flex justify-end">
              <button
                onClick={() => navigate("/timekeeping")}
                className="dashboard-button-viewall"
              >
                View All <span className="ml-1">→</span>
              </button>
            </div>
          )}
        </div>

        {/* Loan Balance Inquiry */}
        {/* <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative"> */}
        {/* <h2 className="text-lg font-semibold mb-2 text-blue-800">My Loan Balance</h2>
  <span className="text-gray-500 text-sm font-normal mt-2 uppercase">Recent Transactions</span> */}

        <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
          <h2 className="dashboard-text-header">My Loan Balance</h2>
          <span className="dashboard-text-span">Recent Transactions</span>

          {/* Responsive Table */}
          <div className="mt-2 overflow-x-auto flex-grow">
            <table className="dashboard-table">
              <thead className="dashboard-thead">
                <tr className="dashboard-thead">
                  <th className="dashboard-th text-left">Loan Type</th>
                  <th className="dashboard-th text-right">Loan Amount</th>
                  <th className="dashboard-th text-right">Balance</th>
                  <th className="dashboard-th text-right">Total Paid</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {loanBalance.length > 0 ? (
                  loanBalance.slice(0, 5).map((loan, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td">{loan.loantype}</td>
                      <td className="dashboard-td text-right">
                        {loan.loanamt.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="dashboard-td text-right">
                        {loan.balance.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="dashboard-td text-right">
                        {loan.totalpaid.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="dashboard-div-norecords">
                        No loan balances found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* View All Button - Fixed on Small Screens
    {loanBalance.length > 0 && (
      <div className="relative flex justify-end">
      <button 
        onClick={() => navigate("/leaveApproval")} 
        className="dashboard-button-viewall"
    >
        View All <span className="ml-1">→</span>
      </button>
    </div>
    )} */}
        </div>

        {/* Overtime Applications */}
        <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
          <h2 className="dashboard-text-header">My Overtime Applications</h2>
          <span className="dashboard-text-span">Recent Transactions</span>

          {/* Responsive Table */}
          <div className="mt-2 overflow-x-auto flex-grow">
            <table className="dashboard-table">
              {/* <thead className="bg-gradient-to-r from-blue-300 to-purple-300 text-black text-xs sm:text-xs md:text-xs lg:text-base"> */}
              <thead className="dashboard-thead">
                <tr>
                  <th className="dashboard-th text-left">OT Date</th>
                  <th className="dashboard-th text-left">OT Type</th>
                  <th className="dashboard-th text-right">Duration</th>
                  <th className="dashboard-th text-center">Status</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {otApplication.length > 0 ? (
                  otApplication.slice(0, 5).map((ot, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td">
                        {dayjs(ot.dateapplied).format("MM/DD/YYYY")}
                      </td>
                      <td className="dashboard-td">{ot.ottype}</td>
                      <td className="dashboard-td text-right">{ot.duration}</td>
                      <td className="dashboard-td text-center">
                        <span
                          className={`inline-block w-[90px] px-2 py-1 rounded-full 
                    ${
                      ot.otstatus === "Pending"
                        ? "bg-yellow-100 text-yellow-600"
                        : ot.otstatus === "Approved"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-red-100 text-red-600"
                    }`}
                        >
                          {ot.otstatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="dashboard-div-norecords">
                        No overtime applications found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* View All Button - Fixed on Small Screens */}
          {otApplication.length > 0 && (
            <div className="relative flex justify-end">
              <button
                onClick={() => navigate("/overtime")}
                className="dashboard-button-viewall"
              >
                View All <span className="ml-1">→</span>
              </button>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
          <h2 className="dashboard-text-header">My Leave Applications</h2>
          <span className="dashboard-text-span">Recent Transactions</span>

          {/* Responsive Table */}
          <div className="mt-2 overflow-x-auto flex-grow">
            <table className="dashboard-table">
              <thead className="dashboard-thead">
                <tr>
                  <th className="dashboard-th text-left">Leave Date</th>
                  <th className="dashboard-th text-left">Leave Type</th>
                  <th className="dashboard-th text-right">Duration</th>
                  <th className="dashboard-th text-center">Status</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {leaveApplication.length > 0 ? (
                  leaveApplication.slice(0, 5).map((leave, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td">{leave.dateapplied}</td>
                      <td className="dashboard-td">{leave.leavetype}</td>
                      <td className="dashboard-td text-right">
                        {leave.duration}
                      </td>
                      <td className="dashboard-td text-center">
                        <span
                          className={`dashboard-td inline-block px-3 py-1 w-[100px] rounded-full
      ${
        leave.leavestatus === "Pending"
          ? "bg-yellow-100 text-yellow-700"
          : leave.leavestatus === "Approved"
          ? "bg-blue-100 text-blue-700"
          : "bg-red-100 text-red-700"
      }`}
                        >
                          {leave.leavestatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="dashboard-div-norecords">
                        No leave applications found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* View All Button - Fixed on Small Screens */}
          {leaveApplication.length > 0 && (
            <div className="relative flex justify-end">
              <button
                onClick={() => navigate("/leave")}
                className="dashboard-button-viewall"
              >
                View All <span className="ml-1">→</span>
              </button>
            </div>
          )}
        </div>

        {/* Official Business Applications */}

        <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
          <h2 className="dashboard-text-header">
            My Official Business Applications
          </h2>
          <span className="dashboard-text-span">Recent Transactions</span>

          {/* Responsive Table */}
          <div className="mt-2 overflow-x-auto flex-grow">
            <table className="dashboard-table">
              <thead className="dashboard-thead">
                <tr>
                  <th className="dashboard-th text-left">OB Date</th>
                  <th className="dashboard-th text-center">Start Datetime</th>
                  <th className="dashboard-th text-center">End Datetime</th>
                  <th className="dashboard-th text-center">Duration</th>
                  <th className="dashboard-th text-center">Status</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {obApplication.length > 0 ? (
                  obApplication.slice(0, 5).map((ob, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td text-nowrap">
                        {dayjs(ob.dateapplied).format("MM/DD/YYYY")}
                      </td>
                      <td className="dashboard-td text-nowrap text-center">
                        {dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="dashboard-td text-nowrap text-center">
                        {dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="dashboard-td text-nowrap text-right">
                        {ob.duration} hr(s)
                      </td>
                      <td className="dashboard-td text-center">
                        <span
                          className={`dashboard-td inline-block px-3 py-1 w-[100px] rounded-full
      ${
        ob.obstatus === "Pending"
          ? "bg-yellow-100 text-yellow-700"
          : ob.obstatus === "Approved"
          ? "bg-blue-100 text-blue-700"
          : "bg-red-100 text-red-700"
      }`}
                        >
                          {ob.obstatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">
                      <div className="dashboard-div-norecords">
                        No official business applications found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* View All Button - Fixed on Small Screens */}
          {obApplication.length > 0 && (
            <div className="relative flex justify-end">
              <button
                onClick={() => navigate("/official-business")}
                className="dashboard-button-viewall"
              >
                View All <span className="ml-1">→</span>
              </button>
            </div>
          )}
        </div>

        {user.approver === "1" && (
          <>
            {/* Overtime Approval */}
            <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
              <h2 className="dashboard-text-header">Overtime for Approval</h2>
              <span className="dashboard-text-span">Recent Transactions</span>

              {/* Responsive Table */}
              <div className="mt-2 overflow-x-auto flex-grow">
                <table className="dashboard-table">
                  <thead className="dashboard-thead">
                    <tr>
                      <th className="dashboard-th text-left">OT Date</th>
                      <th className="dashboard-th text-left">OT Type</th>
                      <th className="dashboard-th text-right">Duration</th>
                      <th className="dashboard-th text-left">Employee Name</th>
                      <th className="dashboard-th text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="dashboard-tbody">
                    {otApproval.length > 0 ? (
                      otApproval.slice(0, 5).map((ot, index) => (
                        <tr
                          key={index}
                          className="dashboard-tbody dashboard-tr"
                        >
                          <td className="dashboard-td text-left">
                            {dayjs(ot.dateapplied).format("MM/DD/YYYY")}
                          </td>
                          <td className="dashboard-td text-left">
                            {ot.ottype}
                          </td>
                          <td className="dashboard-td text-right">
                            {ot.duration}
                          </td>
                          <td className="dashboard-td text-left">
                            {ot.empname}
                          </td>
                          <td className="dashboard-td text-center">
                            <span
                              className={`inline-block w-[90px] px-2 py-1 rounded-full 
                    ${
                      ot.otstatus === "Pending"
                        ? "bg-yellow-100 text-yellow-600"
                        : ot.otstatus === "Approved"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-red-100 text-red-600"
                    }`}
                            >
                              {ot.otstatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6">
                          <div className="dashboard-div-norecords">
                            No overtime records for approval found.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* View All Button - Fixed on Small Screens */}
              {otApproval.length > 0 && (
                <div className="relative flex justify-end">
                  <button
                    onClick={() => navigate("/overtimeApproval")}
                    className="dashboard-button-viewall"
                  >
                    View All <span className="ml-1">→</span>
                  </button>
                </div>
              )}
            </div>

            {/* Leave Approval */}
            <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
              <h2 className="dashboard-text-header">Leave for Approval</h2>
              <span className="dashboard-text-span">Recent Transactions</span>

              {/* Responsive Table */}
              <div className="mt-2 overflow-x-auto flex-grow">
                <table className="dashboard-table">
                  <thead className="dashboard-thead">
                    <tr>
                      <th className="dashboard-th text-left text-nowrap">
                        Leave Date
                      </th>
                      <th className="dashboard-th text-left text-nowrap">
                        Leave Type
                      </th>
                      <th className="dashboard-th text-left text-nowrap">
                        Duration
                      </th>
                      <th className="dashboard-th text-left text-nowrap">
                        Employee
                      </th>
                      <th className="dashboard-th text-center text-nowrap">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="dashboard-tbody">
                    {leaveApproval.length > 0 ? (
                      leaveApproval.map((leave, index) => (
                        <tr
                          key={index}
                          className="dashboard-tbody dashboard-tr"
                        >
                          <td className="dashboard-td">{leave.dateapplied}</td>
                          <td className="dashboard-td">{leave.leavetype}</td>
                          <td className="dashboard-td">{leave.duration}</td>
                          <td className="dashboard-td">{leave.empname}</td>
                          <td className="dashboard-td text-center">
                            <span
                              className={`inline-block w-[90px] px-2 py-1 rounded-full 
            ${
              leave.leavestatus === "Pending"
                ? "bg-yellow-100 text-yellow-600"
                : leave.leavestatus === "Approved"
                ? "bg-blue-100 text-blue-600"
                : "bg-red-100 text-red-600"
            }`}
                            >
                              {leave.leavestatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6">
                          <div className="dashboard-div-norecords">
                            No leave records for approval found.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* View All Button - Fixed on Small Screens */}
              {leaveApproval.length > 0 && (
                <div className="relative flex justify-end">
                  <button
                    onClick={() => navigate("/leaveApproval")}
                    className="dashboard-button-viewall"
                  >
                    View All <span className="ml-1">→</span>
                  </button>
                </div>
              )}
            </div>

            {/* Official Business Approval */}
            <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
              <h2 className="dashboard-text-header">
                Official Business for Approval
              </h2>
              <span className="dashboard-text-span">Recent Transactions</span>

              {/* Responsive Table */}
              <div className="mt-2 overflow-x-auto flex-grow">
                <table className="dashboard-table">
                  <thead className="dashboard-thead">
                    <tr>
                      <th className="dashboard-th">OB Date</th>
                      <th className="dashboard-th">Start Datetime</th>
                      <th className="dashboard-th">End Datetime</th>
                      <th className="dashboard-th">Duration</th>
                      <th className="dashboard-th text-left">Employee</th>
                      <th className="dashboard-th text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="dashboard-tbody">
                    {obApproval.length > 0 ? (
                      obApproval.slice(0, 5).map((ob, index) => (
                        <tr
                          key={index}
                          className="dashboard-tbody dashboard-tr"
                        >
                          <td className="dashboard-td text-nowrap">
                            {dayjs(ob.dateapplied).format("MM/DD/YYYY")}
                          </td>
                          <td className="dashboard-td text-nowrap">
                            {dayjs(ob.obstart).format("MM/DD/YYYY hh:mm a")}
                          </td>
                          <td className="dashboard-td text-nowrap">
                            {dayjs(ob.obend).format("MM/DD/YYYY hh:mm a")}
                          </td>
                          <td className="dashboard-td text-right">
                            {ob.duration} hr(s)
                          </td>
                          <td className="dashboard-td text-nowrap">
                            {ob.empname}
                          </td>
                          <td className="dashboard-td">
                            <span
                              className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-xs sm:text-sm font-medium
                      ${
                        ob.obstatus === "Pending"
                          ? "bg-yellow-100 text-yellow-600"
                          : ob.obstatus === "Approved"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-red-100 text-red-600"
                      }`}
                            >
                              {ob.obstatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6">
                          <div className="dashboard-div-norecords">
                            No official business records for approval found.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* View All Button - Fixed on Small Screens */}
              {obApproval.length > 0 && (
                <div className="relative flex justify-end">
                  <button
                    onClick={() => navigate("/OfficialBusinessApproval")}
                    className="dashboard-button-viewall"
                  >
                    View All <span className="ml-1">→</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition duration-300"
            aria-label="Back to top"
          >
            <FontAwesomeIcon icon={faArrowUp} size="sm" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
