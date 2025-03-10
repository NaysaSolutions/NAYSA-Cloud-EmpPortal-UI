import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Import AuthContext
import { useNavigate } from "react-router-dom";
import LeaveCreditModal from "./LeaveCreditModal";

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
  const [officialBusinessApplication, setOfficialBusinessApplication] = useState([]); // Store OB Applications
  const [otApproval, setOtApproval] = useState([]); // Store Overtime Approvals
  const [leaveApproval, setLeaveApproval] = useState([]); // Store Leave Approvals
  const [officialBusinessApproval, setOfficialBusinessApproval] = useState([]); // Store OB Approvals
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

  useEffect(() => {
    if (!user || !user.empNo) {
      return; // Don't fetch if user or empNo is missing
    }
  
    const fetchDailyRecords = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/dashBoard", {
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
          setOfficialBusinessApproval(parsedData[0]?.officialBusinessApproval || []);
  
          // ✅ Extract Leave Applications
          console.log("Leave Applications:", parsedData[0].leaveApplication);
          setLeaveApplication(parsedData[0]?.leaveApplication || []);
  
          // ✅ Extract Overtime Applications
          console.log("Overtime Applications:", parsedData[0].otApplication);
          setOtApplication(parsedData[0]?.otApplication || []);

          // ✅ Extract Official Business Applications
        console.log("Official Business Applications:", parsedData[0]?.officialBusinessApplication);
        setOfficialBusinessApplication(parsedData[0]?.officialBusinessApplication || []);
        } else {
          setError("API response format is incorrect or no data found.");
        }
      } catch (err) {
        console.error("Error fetching daily time records:", err);
        setError("An error occurred while fetching the records.");
      }
    };
  
    fetchDailyRecords();
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
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, currentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true });
    }
    while (days.length % 7 !== 0) {
      days.push({ day: days.length % 7 + 1, currentMonth: false });
    }
    return days;
  };

  return (
    <div className="ml-80 mt-[120px] p-4 bg-gray-100 min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-start w-[1180px]">
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white flex justify-between items-center mb-6 w-full shadow-lg">
          <div>
            <p className="text-md font-light mb-1 text-[#424554]"><span className="kanit-text">Today</span></p>
            <h1 className="text-4xl font-extrabold text-[#495057]">
              {currentDate.format("MMMM DD, YYYY")}
            </h1>
          </div>
          {/* Entry Time and Break Time Count */}
          <div className="flex space-x-10">
          <div>
      <p className="text-sm font-medium">Philippine Standard Time:</p>
      <p className="text-4xl font-bold">{time || "00:00 PM"}</p>
    </div>
            <div>
              <p className="text-sm font-medium">Break Time Count:</p>
              <p className="text-4xl font-bold">
                {formatTime(breakTime)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-2">
        {/* Daily Time Record Section */}
        <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-lg mx-auto">
      <h2 className="text-lg font-semibold uppercase">Daily Time Record</h2>
      <span className="text-gray-500 text-sm font-normal mt-2 uppercase">Recent Transactions</span>
      
      {/* Table Structure */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200 text-gray-700 text-sm propercase">
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-center">Time In</th>
              <th className="p-2 text-center">Time Out</th>
            </tr>
          </thead>
          <tbody>
            {dailyTimeRecord.length > 0 ? (
              dailyTimeRecord.map((record, index) => (
                <tr key={index} className="border-b hover:bg-gray-100">
                  <td className="p-2 text-left text-sm">
                    {dayjs(record.trandate).format("MM/DD/YYYY")}
                  </td>
                  <td className="p-2 text-center text-sm">
                    {record.time_in ? dayjs(record.time_in).format("hh:mm A") : "N/A"}
                  </td>
                  <td className="p-2 text-center text-sm">
                    {record.time_out ? dayjs(record.time_out).format("hh:mm A") : "N/A"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="p-4 text-center text-gray-600 text-sm">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* View All Button */}
      <div className="flex justify-end mt-20">
        <button className="text-blue-500 text-sm font-medium hover:underline" onClick={() => navigate("/timekeeping")}>
          View All →
        </button>
      </div>
</div>

        {/* Leave Credit */}
        <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-lg mx-auto">
      <h2 className="text-lg font-semibold uppercase">Leave Credit</h2>
      <span className="text-gray-500 text-sm font-normal mt-2 uppercase">Recent Transactions</span>
      
      {/* Table Structure */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200 text-gray-700 text-sm propercase">
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
                <td colSpan="6" className="p-4 text-center text-gray-600 text-sm">
                  No leave credits found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

  {/* Conditionally Render "View All" Button */}
  {leaveCredit.length > 0 && (
    <div className="flex justify-end mt-20">
          <button className="text-blue-500 text-sm font-medium hover:underline"
           onClick={() => setIsModalOpen(true)}>
            View All →
          </button>
        </div>
  )}
   {/* Leave Credit Modal */}
   <LeaveCreditModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        leaveCredit={leaveCredit} 
      />
</div>

        {/* Personal Calendar */}
        <div className="bg-white p-4 rounded-lg shadow h-[400px] w-[360px]">
          <h2 className="text-lg font-semibold mb-4 text-center uppercase">Personal Calendar</h2>
          <div className="flex justify-between items-center mb-2">
            <button onClick={handlePrevMonth} className="text-gray-400">◀</button>
            <h3 className="text-lg font-semibold">{currentMonth.format("MMMM YYYY")}</h3>
            <button onClick={handleNextMonth} className="text-gray-600">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-0 text-center text-gray-600 font-semibold">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0 text-center">
            {generateCalendar().map((item, index) => (
              <div
                key={index}
                className={`p-2 rounded-full ${item.currentMonth ? "text-black" : "text-gray-400"}`}
              >
                {item.day}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm mt-2">
            <div className="flex items-center"><span className="w-2 h-2 bg-red-500 inline-block mr-1"></span> Holiday</div>
            <div className="flex items-center"><span className="w-2 h-2 bg-blue-500 inline-block mr-1"></span> Leave</div>
            <div className="flex items-center"><span className="w-2 h-2 bg-yellow-500 inline-block mr-1"></span> Pending for Approval</div>
          </div>
        </div>
      </div>
      <hr className="mt-6 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-screen">
  {/* Overtime Applications */}
  <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
    <h2 className="text-lg font-semibold mb-4 text-gray-800 uppercase">My Overtime Applications</h2>

    {/* Responsive Table Wrapper */}
    <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg h-full">
        <thead className="bg-gray-200 text-gray-700 text-sm propercase">
          <tr>
            <th className="py-3 px-3 text-left">OT Date</th>
            <th className="py-3 px-3 text-left">OT Type</th>
            <th className="py-3 px-3 text-left">Duration</th>
            <th className="py-3 px-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-sm h-full">
          {otApplication.length > 0 ? (
            otApplication.slice(0, 5).map((ot, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="py-3 px-3">{dayjs(ot.dateapplied).format("MM/DD/YYYY")}</td>
                <td className="py-3 px-3">{ot.ottype}</td>
                <td className="py-3 px-3">{ot.duration}</td>
                <td className="py-3 px-3">
                  <span className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-sm font-medium
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
              <td colSpan="4">
                <div className="h-[400px] flex justify-center items-center text-gray-500">
                  No overtime applications found.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* View All Button */}
    {otApplication.length > 0 && (
      <div className="flex justify-end mt-4">
        <button 
          onClick={() => navigate("/overtime")} 
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
        >
          View All <span className="ml-1">→</span>
        </button>
      </div>
    )}
  </div>





        {/* Leave Applications */}
        
<div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
  <h2 className="text-lg font-semibold mb-4 text-gray-800 uppercase">My Leave Applications</h2>

  {/* Responsive Table */}
  <div className="overflow-x-auto flex-grow">
    <table className="min-w-full border border-gray-200 rounded-lg">
      <thead className="bg-gray-200 text-gray-700 text-sm propercase">
        <tr>
          <th className="py-3 px-3 text-left">Leave Date</th>
          <th className="py-3 px-3 text-left">Leave Type</th>
          <th className="py-3 px-3 text-left">Duration</th>
          <th className="py-3 px-3 text-left">Status</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 text-sm h-full">
        {leaveApplication.length > 0 ? (
          leaveApplication.slice(0, 5).map((leave, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-3 px-3">{dayjs(leave.dateapplied).format("MM/DD/YYYY")}</td>
              <td className="py-3 px-3">{leave.leavetype}</td>
              <td className="py-3 px-3">{leave.duration}</td>
              <td className="py-3 px-3">
                  <span className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-sm font-medium
                    ${ot.otstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                    ot.otstatus === "Approved" ? "bg-green-100 text-green-600" : 
                    "bg-red-100 text-red-600"}`}>
                  {leave.leavestatus}
                </span>
              </td>
            </tr>
          ))
        ) : (
          <tr className="h-full">
            <td colSpan="4">
              <div className="h-[400px] flex justify-center items-center text-gray-500">
                No leave applications found.
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  {/* View All Button */}
  {leaveApplication.length > 0 && (
    <div className="flex justify-end mt-4">
      <button 
        onClick={() => navigate("/leave")} 
        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
      >
        View All <span className="ml-1">→</span>
      </button>
    </div>
  )}
</div>


        {/* Official Business Applications */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
  <h2 className="text-lg font-semibold mb-4 text-gray-800 uppercase">My Official Business Applications</h2>
  
  <div className="overflow-x-auto flex-grow">      
    <table className="min-w-full border border-gray-200 rounded-lg h-full">
  <thead className="bg-gray-200 text-gray-700 text-sm propercase">
        <tr>
          <th className="py-3 px-3">OB Date</th>
          <th className="py-3 px-3">Start Datetime</th>
          <th className="py-3 px-3">End Datetime</th>
          <th className="py-3 px-3">No of Hours</th>
          <th className="py-3 px-3">Status</th>
        </tr>
      </thead>        
      <tbody className="text-gray-700 text-sm h-full">
        {officialBusinessApplication.length > 0 ? (
          officialBusinessApplication.slice(0, 5).map((ob, index) => (              
          <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-3 px-3">{dayjs(ob.dateapplied).format("MM/DD/YYYY")}</td>
                <td className="py-3 px-3">{ob.ottype}</td>
                <td className="py-3 px-3">{ob.duration}</td>
                <td className="py-3 px-3">
                <span className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-sm font-medium
                    ${ot.otstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                    ot.otstatus === "Approved" ? "bg-green-100 text-green-600" : 
                    "bg-red-100 text-red-600"}`}>
                    {ot.otstatus}
                  </span>
                </td>
              </tr>
            ))

        ) : (

 // Centered message when no data is found
<tr className="h-full">
              <td colSpan="4">
                <div className="h-[400px] flex justify-center items-center text-gray-500">
                  No official business applications found.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>


  {/* Conditionally Render "View All" Button */}
  {officialBusinessApplication.length > 0 && (
    <div className="flex justify-start mt-auto items-center">
      <span className="text-gray-500 cursor-pointer text-sm font-normal flex items-center">
        View All
        <span className="ml-1">→</span> 
      </span>
    </div>
  )}
</div>

        {/* Loan Balance Inquiry */}
  <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
  <h2 className="text-lg font-semibold mb-4 text-gray-800 uppercase">Loan Balance Applications</h2>

  {/* Error Handling
  {error && <p className="text-sm text-red-500 mt-4">{error}</p>} */}

  <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg h-full">
        <thead className="bg-gray-200 text-gray-700 text-sm propercase">
        <tr>
          <th className="py-3 px-3 text-left">Loan Type</th>
          <th className="py-3 px-3 text-left">Loan Amount</th>
          <th className="py-3 px-3 text-left">Balance</th>
          <th className="py-3 px-3 text-left">Total Paid</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 text-sm h-full">
        {loanBalance.length > 0 ? (
          loanBalance.slice(0, 5).map((loan, index) => (
            <tr key={index} className="border-b">
              <td className="py-2 px-3">{loan.loantype}</td>
              <td className="py-2 px-3 text-right">0.00</td>
              <td className="py-2 px-3 text-right">{loan.balance}</td>
              <td className="py-2 px-3 text-right">0.00</td>
            </tr>
          ))
        ) : (
          // Centered message when no data is found
          <tr className="h-full">
              <td colSpan="4">
                <div className="h-[400px] flex justify-center items-center text-gray-500">
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


   {/* Overtime Approval */}   

  <div className="bg-white p-6 rounded-lg shadow-md flex flex-col flex-grow">
  <h2 className="text-lg font-semibold mb-4 text-gray-800 uppercase">Overtime for Approval</h2>

  {/* Responsive Table Wrapper */}
  <div className="overflow-x-auto flex-grow">
  <table className="min-w-full border border-gray-200 rounded-lg h-full">
  <thead className="bg-gray-200 text-gray-700 text-sm propercase">
        <tr>
          <th className="py-3 px-4 text-left">OT Date</th>
          <th className="py-3 px-4 text-left">OT Type</th>
          <th className="py-3 px-4 text-left">Duration</th>
          <th className="py-3 px-4 text-left">Employee Name</th>
          <th className="py-3 px-4 text-center">Status</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 text-sm h-full">
        {otApproval.length > 0 ? (
          otApproval.slice(0, 5).map((ot, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-3 px-4">{dayjs(ot.dateapplied).format("MM/DD/YYYY")}</td>
              <td className="py-3 px-4">{ot.ottype}</td>
              <td className="py-3 px-4">{ot.duration}</td>
              <td className="py-3 px-4">{ot.empname}</td>
              <td className="py-3 px-4">
                  <span className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-sm font-medium
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
            <td colSpan="4">
              <div className="h-[400px] flex justify-center items-center text-gray-500">
                No overtime approvals found.
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  {/* View All Button */}
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
  <h2 className="text-lg font-semibold mb-4 text-gray-800 uppercase">Leave for Approval</h2>

  {/* Responsive Table Wrapper */}
  <div className="overflow-x-auto flex-grow">
      <table className="min-w-full border border-gray-200 rounded-lg h-full">
        <thead className="bg-gray-200 text-gray-700 text-sm propercase">
        <tr>
          <th className="py-3 px-3 text-left">Leave Date</th>
          <th className="py-3 px-3 text-left">Leave Type</th>
          <th className="py-3 px-3 text-left">Duration</th>
          <th className="py-3 px-3 text-left">Employee</th>
          <th className="py-3 px-3 text-left">Status</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 text-sm h-full">
        {leaveApproval.length > 0 ? (
          leaveApproval.slice(0, 5).map((leave, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-3 px-3">{dayjs(leave.dateapplied).format("MM/DD/YYYY")}</td>
              <td className="py-3 px-3">{leave.leavetype}</td>
              <td className="py-3 px-3">{leave.duration}</td>
              <td className="py-3 px-3">{leave.empname}</td>
              <td className="py-3 px-3">
                <span className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-sm font-medium
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
              <td colSpan="4">
                <div className="h-[400px] flex justify-center items-center text-gray-500">
                  No leave approvals found found.
                </div>
              </td>
            </tr>
        )}
      </tbody>
    </table>
  </div>

  {/* View All Button */}
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
  <h2 className="text-lg font-semibold mb-4 text-gray-800 uppercase">Official Business for approval</h2>
  
  <div className="overflow-x-auto flex-grow">      
    <table className="min-w-full border border-gray-200 rounded-lg h-full">
  <thead className="bg-gray-200 text-gray-700 text-sm propercase">
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
        {officialBusinessApplication.length > 0 ? (
          officialBusinessApplication.slice(0, 5).map((ob, index) => (              
          <tr key={index} className="border-b hover:bg-gray-50">
              <td className="py-3 px-3">{dayjs(ob.dateapplied).format("MM/DD/YYYY")}</td>
                <td className="py-3 px-3">{ob.ottype}</td>
                <td className="py-3 px-3">{ob.duration}</td>
                <td className="py-3 px-3">
                <span className={`inline-block w-[80px] px-3 py-1 rounded-full text-center text-sm font-medium
                    ${ot.otstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                    ot.otstatus === "Approved" ? "bg-green-100 text-green-600" : 
                    "bg-red-100 text-red-600"}`}>
                    {ot.otstatus}
                  </span>
                </td>
              </tr>
            ))

        ) : (

 // Centered message when no data is found
<tr className="h-full">
              <td colSpan="4">
                <div className="h-[400px] flex justify-center items-center text-gray-500">
                  No official business approvals found.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>


  {/* Conditionally Render "View All" Button */}
  {officialBusinessApplication.length > 0 && (
    <div className="flex justify-start mt-auto items-center">
      <span className="text-gray-500 cursor-pointer text-sm font-normal flex items-center">
        View All
        <span className="ml-1">→</span> 
      </span>
    </div>
  )}
</div>       
    </div>
    </div>
    
  );
};

export default Dashboard;
