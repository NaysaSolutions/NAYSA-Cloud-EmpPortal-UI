import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Import AuthContext
import { useNavigate } from "react-router-dom";
import LeaveCreditModal from "./LeaveCreditModal";
// import API_ENDPOINTS from "C:/Users/mendo/OneDrive/Desktop/NAYSA-Cloud-EmpPortal-UI/src/apiConfig.jsx";
// import API_ENDPOINTS from "/NAYSA-Solutions Inc/Programming/NAYSA Employee Portal Cloud/NAYSA-Cloud-EmpPortal-UI/src/apiConfig.jsx";
import API_ENDPOINTS from "@/apiConfig.jsx";

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
  const [message, setMessage] = useState(""); // New state for messages
  const [time, setTime] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null); // Error state
  const { user } = useAuth(); // Get user data from AuthContext
  const navigate = useNavigate();


  const defaultLeaveTypes = [
    { description: "Vacation Leave", balance: 0 },
    { description: "Sick Leave", balance: 0 },
    { description: "Personal Leave", balance: 0 },
    { description: "Emergency Leave", balance: 0 },
    { description: "Maternity Leave", balance: 0 },
    { description: "Paternity Leave", balance: 0 },
    { description: "Bereavement Leave", balance: 0 },
    { description: "Birthday Leave", balance: 0 }
  ];


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
    if (!user || !user.empNo) {
      return; // Don't fetch if user or empNo is missing
    }

    try {
      const response = await fetch(API_ENDPOINTS.dashBoard, { // Use dynamic API endpoint here
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo }),
      });

      const result = await response.json();
      console.log("Raw API Response:", result);

      if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const parsedData = JSON.parse(result.data[0].result);
        console.log("Parsed Employee Summary:", parsedData);

        let apiLeaveCredits = parsedData[0]?.leaveCredit || [];

        // Merge API leave credits with default leave types
        const mergedLeaveCredits = defaultLeaveTypes.map((defaultLeave) => {
          const foundLeave = apiLeaveCredits.find(
            (apiLeave) => apiLeave.description === defaultLeave.description
          );
          return foundLeave ? foundLeave : defaultLeave;
        });

        setLeaveCredit(mergedLeaveCredits);
        setDailyTimeRecord(parsedData[0]?.dailyTimeRecord || []);
        setLeaveCredit(parsedData[0]?.leaveCredit || []);
        setLoanBalance(parsedData[0]?.loanBalance || []);
        setOtApproval(parsedData[0]?.otApproval || []);
        setLeaveApproval(parsedData[0]?.leaveApproval || []);
        setOfficialBusinessApproval(parsedData[0]?.obApproval || []);

        // Extract Leave Applications
        console.log("Leave Applications:", parsedData[0].leaveApplication);
        setLeaveApplication(parsedData[0]?.leaveApplication || []);

        // Extract Overtime Applications
        console.log("Overtime Applications:", parsedData[0].otApplication);
        setOtApplication(parsedData[0]?.otApplication || []);

        // Extract Official Business Applications
        console.log("Official Business Applications:", parsedData[0]?.obApplication);
        setOfficialBusinessApplication(parsedData[0]?.obApplication || []);
      } else {
        setError("API response format is incorrect or no data found.");
      }
    } catch (err) {
      console.error("Error fetching daily time records:", err);
      setError("An error occurred while fetching the records.");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user.empNo]); // Dependency on user.empNo

  // Current Date and Time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Break Time Countdown
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
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  
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

    let days = [];

    const pendingLeaveDays = new Set();
    const approvedLeaveDays = new Set();

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
        while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
          if (current.month() === currentMonth.month()) {
            if (leave.leavestatus === 'approved') {
              approvedLeaveDays.add(current.date());
            } else if (leave.leavestatus === 'pending') {
              pendingLeaveDays.add(current.date());
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
      days.push({
        day: i,
        currentMonth: true,
        isPendingLeave: pendingLeaveDays.has(i),
        isApprovedLeave: approvedLeaveDays.has(i),
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

  return (
    // <div className="ml-[260px] mt-[110px] p-4 bg-gray-100 min-h-screen">
      <div className="mt-[110px] p-4 bg-gray-100 min-h-screen ml-0 md:ml-[260px]">


      {/* Header */}
      <div className="flex justify-center sm:justify-between items-start w-full max-w-[2000px] mx-auto px-4">
  {/* <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-4 rounded-lg text-white flex flex-wrap justify-between items-center mb-4 w-full shadow-lg"> */}
  <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-4 rounded-lg text-white flex flex-col sm:flex-row sm:flex-wrap justify-center sm:justify-between items-center gap-4 mb-4 w-full shadow-lg">

  {/* Date Section */}
  <div className="text-center sm:text-left">
      <p className="text-sm sm:text-lg font-light text-[#424554]">
        <span className="kanit-text">Today</span>
      </p>
      <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-[#495057]">
        {currentDate.format("MMMM DD, YYYY")}
      </h1>
    </div>

{/* Entry Time and Break Time Count */}
<div className="flex flex-col sm:flex-row gap-4 sm:gap-10 items-center sm:items-start text-center sm:text-left">
  <div>
    <p className="text-sm font-extrabold text-[#424554] mb-2">Philippine Standard Time:</p>
    <p className="text-xl sm:text-4xl font-bold">{time || "00:00 PM"}</p>
  </div>
  <div>
    <p className="text-sm font-extrabold text-[#424554] mb-2">Break Time Count:</p>
    <p className="text-xl sm:text-4xl font-bold">
      {formatTime(breakTime)}
    </p>
  </div>
</div>
  </div>
</div>

      {/* Main Content */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
  {/* Daily Time Record Section */}
<div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full relative">
  <h2 className="text-lg font-semibold mb-4 text-blue-800">Daily Time Record</h2>
  <span className="text-gray-500 text-sm font-normal mt-2 uppercase">Recent Transactions</span>

  {/* Table Structure */}
  <div className="mt-4 overflow-x-auto">
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-200 text-gray-700 text-sm">
          <th className="p-2 text-left">Date</th>
          <th className="p-2 text-center">Time In</th>
          <th className="p-2 text-center">Time Out</th>
        </tr>
      </thead>
      <tbody>
        {dailyTimeRecord.length > 0 ? (
          dailyTimeRecord.map((record, index) => (
            <tr key={index} className="border-b hover:bg-gray-100">
              <td className="p-2 text-left text-sm">{dayjs(record.trandate).format("MM/DD/YYYY")}</td>
              <td className="p-2 text-center text-sm">{record.time_in ? dayjs(record.time_in).format("hh:mm A") : "N/A"}</td>
              <td className="p-2 text-center text-sm">{record.time_out ? dayjs(record.time_out).format("hh:mm A") : "N/A"}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="3" className="p-4 text-center text-gray-600 text-sm">No records found.</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  {/* Fixed View All Button */}
  <button
    onClick={() => navigate("/timekeeping")}
    className="absolute bottom-4 right-4 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
  >
    View All <span className="ml-1">→</span>
  </button>
</div>

  {/* Leave Credit Section */}
  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full">
    <h2 className="text-lg font-semibold mb-4 text-blue-800">Leave Credit</h2>
    <span className="text-gray-500 text-sm font-normal mt-2 uppercase">Recent Transactions</span>

    {/* Table Structure */}
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200 text-gray-700 text-sm">
            <th className="p-2 text-left">Leave Type</th>
            <th className="p-2 text-center">Credit</th>
            <th className="p-2 text-center">Used</th>
            <th className="p-2 text-center">Actual Balance</th>
          </tr>
        </thead>
        <tbody>
          {leaveCredit.length > 0 ? (
            leaveCredit.map((leave, index) => (
              <tr key={index} className="border-b hover:bg-gray-100">
                <td className="p-2 text-left text-sm">{leave.description}</td>
                <td className="p-2 text-center text-sm">{leave.credit}</td>
                <td className="p-2 text-center text-sm">{leave.availed}</td>
                <td className="p-2 text-center text-sm">{leave.balance}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" className="p-4 text-center text-gray-600 text-sm">No leave credits found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* View All Button */}
    {leaveCredit.length > 0 && (
      <div className="flex justify-end mt-20">
        <button onClick={() => setIsModalOpen(true)} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
          View All <span className="ml-1">→</span>
        </button>
      </div>
    )}

    {/* Leave Credit Modal */}
    <LeaveCreditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} leaveCredit={leaveCredit} />
  </div>

  {/* Personal Calendar */}
<div className="bg-white p-3 sm:p-6 rounded-lg shadow-lg w-full">
  <h2 className="text-md sm:text-lg font-semibold mb-4 text-blue-800 text-center">Personal Calendar</h2>
  
  {/* Navigation */}
  <div className="flex justify-between items-center mb-2">
    <button onClick={handlePrevMonth} className="text-gray-400">◀</button>
    <h3 className="text-md sm:text-lg font-semibold">{currentMonth.format("MMMM YYYY")}</h3>
    <button onClick={handleNextMonth} className="text-gray-600">▶</button>
  </div>

  {/* Weekday Headers */}
  <div className="grid grid-cols-7 grid-rows-6 gap-0.5 sm:gap-1 text-center min-h-[300px]">
    {generateCalendar().map((item, index) => (
      <div
      key={index}
      className={`text-sm sm:text-base p-1 sm:p-2 rounded-full h-[32px] sm:h-[40px] flex items-center justify-center
        ${item.currentMonth ? "text-black" : "text-gray-400"}
        ${item.isApprovedLeave ? "bg-blue-500 text-white font-bold" : ""}
        ${item.isPendingLeave ? "bg-yellow-500 text-white font-bold" : ""}
      `}
      >
        {item.day}
      </div>
    ))}
  </div>

  {/* Calendar Legend */}
  <div className="flex justify-between text-sm sm:text-lg mt-2">
    <div className="flex items-center"><span className="w-2 h-2 bg-red-500 inline-block mr-1"></span> Holiday</div>
    <div className="flex items-center"><span className="w-2 h-2 bg-blue-500 inline-block mr-1"></span> Approved Leave</div>
    <div className="flex items-center"><span className="w-2 h-2 bg-yellow-500 inline-block mr-1"></span> Pending Leave</div>
  </div>
</div>
</div>


      <hr className="mt-6 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 min-h-screen">
  {/* Overtime Applications */}
  <div className="bg-white p-4 rounded-lg shadow-md flex flex-col flex-grow relative">
    <h2 className="text-lg font-semibold mb-4 text-blue-800">My Overtime Applications</h2>

    {/* Responsive Table */}
    <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-blue-300 text-black text-xs sm:text-sm">
          <tr>
            <th className="py-3 px-3 text-left">OT Date</th>
            <th className="py-3 px-3 text-left">OT Type</th>
            <th className="py-3 px-3 text-left">Duration</th>
            <th className="py-3 px-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-xs sm:text-sm">
          {otApplication.length > 0 ? (
            otApplication.slice(0, 5).map((ot, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="py-3 px-3">{dayjs(ot.dateapplied).format("MM/DD/YYYY")}</td>
                <td className="py-3 px-3">{ot.ottype}</td>
                <td className="py-3 px-3">{ot.duration}</td>
                <td className="py-3 px-3">
                  <span className={`inline-block w-[90px] px-3 py-1 rounded-full text-center text-xs sm:text-sm font-medium
                    ${ot.otstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                      ot.otstatus === "Approved" ? "bg-green-100 text-green-600" : 
                      "bg-red-100 text-red-600"}`}>
                    {ot.otstatus}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4">
                <div className="h-[300px] flex justify-center items-center text-gray-500 text-xs sm:text-sm">
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
      <div className="relative md:static flex justify-end">
      <button 
        onClick={() => navigate("/leave")} 
        className="fixed bottom-4 right-4 md:static text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium flex items-center md:mt-4 bg-white shadow-md md:shadow-none px-3 py-2 rounded-full md:rounded-none"
      >
        View All <span className="ml-1">→</span>
      </button>
    </div>
    )}
  </div>

  <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow relative">
  <h2 className="text-lg font-semibold mb-4 text-blue-800">My Leave Applications</h2>

  {/* Responsive Table */}
  <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-blue-300 text-black text-xs sm:text-sm">
        <tr>
          <th className="py-3 px-3 text-left">Leave Date</th>
          <th className="py-3 px-3 text-left">Leave Type</th>
          <th className="py-3 px-3 text-left">Duration</th>
          <th className="py-3 px-3 text-left">Status</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 text-xs sm:text-sm">
        {leaveApplication.length > 0 ? (
          leaveApplication.slice(0, 5).map((leave, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-2 px-2">{leave.dateapplied}</td>
              <td className="py-2 px-2">{leave.leavetype}</td>
              <td className="py-2 px-2">{leave.duration}</td>
              <td className="py-2 px-2">
                <span className={`inline-block w-[90px] px-2 py-1 rounded-full text-center text-xs sm:text-sm font-medium
                  ${leave.leavestatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                    leave.leavestatus === "Approved" ? "bg-green-100 text-green-600" : 
                    "bg-red-100 text-red-600"}`}>
                  {leave.leavestatus}
                </span>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="4">
              <div className="h-[300px] flex justify-center items-center text-gray-500 text-xs sm:text-sm">
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
  <div className="relative md:static flex justify-end">
    <button 
      onClick={() => navigate("/leave")} 
      className="fixed bottom-4 right-4 md:static text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium flex items-center md:mt-4 bg-white shadow-md md:shadow-none px-3 py-2 rounded-full md:rounded-none"
    >
      View All <span className="ml-1">→</span>
    </button>
  </div>
)}

</div>

      {/* Official Business Applications */}
<div className="bg-white p-4 sm:p-6 rounded-lg shadow-md flex flex-col flex-grow">
  <h2 className="text-lg font-semibold mb-4 text-blue-800">My Official Business Applications</h2>

  {/* Responsive Table Container */}
  <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-blue-300 text-black text-xs sm:text-sm">
        <tr>
          <th className="py-3 px-3 text-left">OB Date</th>
          <th className="py-3 px-3 text-center">Start Datetime</th>
          <th className="py-3 px-3 text-center">End Datetime</th>
          <th className="py-3 px-3 text-center">Duration</th>
          <th className="py-3 px-3 text-center">Status</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 text-sm">
        {obApplication.length > 0 ? (
          obApplication.slice(0, 5).map((ob, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-2 px-2">{dayjs(ob.dateapplied).format("MM/DD/YYYY")}</td>
              <td className="py-2 px-2 text-center">{dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")}</td>
              <td className="py-2 px-2 text-center">{dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")}</td>
              <td className="py-2 px-2 text-center">{ob.duration}</td>
              <td className="py-2 px-2 text-center">
                <span className={`inline-block w-[100px] px-2 py-1 rounded-full text-xs sm:text-sm font-medium
                  ${ob.obstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                    ob.obstatus === "Approved" ? "bg-green-100 text-green-600" : 
                    "bg-red-100 text-red-600"}`}>
                  {ob.obstatus}
                </span>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="5">
              <div className="h-40 sm:h-64 flex justify-center items-center text-gray-500">
                No official business applications found.
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  {/* View All Button */}
  {obApplication.length > 0 && (
    <div className="flex justify-end mt-4">
      <button 
        onClick={() => navigate("/official-business")} 
        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
      >
        View All <span className="ml-1">→</span>
      </button>
    </div>
  )}
</div>

{/* Loan Balance Inquiry */}
<div className="bg-white p-4 sm:p-6 rounded-lg shadow-md flex flex-col flex-grow">
  <h2 className="text-lg font-semibold mb-4 text-blue-800">My Loan Balance</h2>

  {/* Responsive Table */}
  <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-blue-300 text-black text-xs sm:text-sm">
        <tr>
          <th className="py-3 px-3 text-left">Loan Type</th>
          <th className="py-3 px-3 text-right">Loan Amount</th>
          <th className="py-3 px-3 text-right">Balance</th>
          <th className="py-3 px-3 text-right">Total Paid</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 text-sm">
        {loanBalance.length > 0 ? (
          loanBalance.slice(0, 5).map((loan, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-2 px-2">{loan.loantype}</td>
              <td className="py-2 px-2 text-right">
                {loan.loanamt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-2 px-2 text-right">
                {loan.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-2 px-2 text-right">
                {loan.totalpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="4">
              <div className="h-40 sm:h-64 flex justify-center items-center text-gray-500">
                No loan balances found.
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  {/* View All Button */}
  {loanBalance.length > 0 && (
    <div className="flex justify-end mt-4">
      <button 
        onClick={() => navigate("/leaveApproval")} 
        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
      >
        View All <span className="ml-1">→</span>
      </button>
    </div>
  )}
</div>



  
{user.approver === "1" && (
  <>
    {/* Overtime Approval */}
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
      <h2 className="text-lg font-semibold mb-4 text-blue-800">Overtime for Approval</h2>
      <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-blue-300 text-black text-xs sm:text-sm">
            <tr>
              <th className="py-2 px-2 text-left">OT Date</th>
              <th className="py-2 px-2 text-left">OT Type</th>
              <th className="py-2 px-2 text-left">Duration (hrs)</th>
              <th className="py-2 px-2 text-left">Employee Name</th>
              <th className="py-2 px-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-xs sm:text-sm h-full">
            {otApproval.length > 0 ? (
              otApproval.slice(0, 5).map((ot, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{dayjs(ot.dateapplied).format("MM/DD/YYYY")}</td>
                  <td className="py-2 px-2">{ot.ottype}</td>
                  <td className="py-2 px-2">{ot.duration}</td>
                  <td className="py-2 px-2">{ot.empname}</td>
                  <td className="py-2 px-2">
                    <span className={`inline-block w-[100px] px-3 py-1 rounded-full text-center text-xs sm:text-sm font-medium
                      ${ot.otstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                      ot.otstatus === "Approved" ? "bg-green-100 text-green-600" : 
                      "bg-red-100 text-red-600"}`}>
                      {ot.otstatus}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="h-full">
                <td colSpan="6">
                  <div className="h-[400px] flex justify-center items-center text-gray-500">
                    No overtime approvals found.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {otApproval.length > 0 && (
        <div className="flex justify-end mt-4">
          <button 
            onClick={() => navigate("/overtimeApproval")} 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
          >
            View All <span className="ml-1">→</span>
          </button>
        </div>
      )}
    </div>

    {/* Leave Approval */}
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
      <h2 className="text-lg font-semibold mb-4 text-blue-800">Leave for Approval</h2>
      <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-blue-300 text-black text-xs sm:text-sm">
            <tr>
              <th className="py-2 px-2 text-left">Leave Date</th>
              <th className="py-2 px-2 text-left">Leave Type</th>
              <th className="py-2 px-2 text-left">Duration (days)</th>
              <th className="py-2 px-2 text-left">Employee</th>
              <th className="py-2 px-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-xs sm:text-sm h-full">
            {leaveApproval.length > 0 ? (
              leaveApproval.slice(0, 5).map((leave, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{leave.dateapplied}</td>
                  <td className="py-2 px-2">{leave.leavetype}</td>
                  <td className="py-2 px-2">{leave.duration}</td>
                  <td className="py-2 px-2">{leave.empname}</td>
                  <td className="py-2 px-2">
                    <span className={`inline-block w-[100px] px-3 py-1 rounded-full text-center text-xs sm:text-sm font-medium
                      ${leave.leavestatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                      leave.leavestatus === "Approved" ? "bg-green-100 text-green-600" : 
                      "bg-red-100 text-red-600"}`}>
                      {leave.leavestatus}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="h-full">
                <td colSpan="6">
                  <div className="h-[400px] flex justify-center items-center text-gray-500">
                    No leave approvals found.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {leaveApproval.length > 0 && (
        <div className="flex justify-end mt-4">
          <button 
            onClick={() => navigate("/leaveApproval")} 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
          >
            View All <span className="ml-1">→</span>
          </button>
        </div>
      )}
    </div>

    {/* Official Business Approval */}
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
      <h2 className="text-lg font-semibold mb-4 text-blue-800">Official Business for Approval</h2>
      <div className="overflow-x-auto flex-grow">      
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-blue-300 text-black text-xs sm:text-sm">
            <tr>
              <th className="py-3 px-3">OB Date</th>
              <th className="py-3 px-3">Start Datetime</th>
              <th className="py-3 px-3">End Datetime</th>
              <th className="py-3 px-3">Duration</th>
              <th className="py-3 px-3">Employee</th>
              <th className="py-3 px-3">Status</th>
            </tr>
          </thead>        
          <tbody className="text-gray-700 text-sm h-full">
            {obApproval.length > 0 ? (
              obApproval.slice(0, 5).map((ob, index) => (              
                <tr key={index} className="border-b hover:bg-gray-50 propercase">
                  <td className="py-3 px-3">{dayjs(ob.dateapplied).format("MM/DD/YYYY")}</td>
                  <td className="py-2 px-2">{dayjs(ob.obstart).format("MM/DD/YYYY hh:mm a")}</td>
                  <td className="py-2 px-2">{dayjs(ob.obend).format("MM/DD/YYYY hh:mm a")}</td>
                  <td className="py-3 px-3 text-right">{ob.duration}</td>
                  <td className="py-3 px-3">{ob.empname}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-xs sm:text-sm font-medium
                      ${ob.obstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                        ob.obstatus === "Approved" ? "bg-green-100 text-green-600" : 
                      "bg-red-100 text-red-600"}`}>
                      {ob.obstatus}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="h-full">
                <td colSpan="6">
                  <div className="h-[400px] flex justify-center items-center text-gray-500">
                    No official business approvals found.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </>
)}

    </div>
    </div>
    
  );
};

export default Dashboard;