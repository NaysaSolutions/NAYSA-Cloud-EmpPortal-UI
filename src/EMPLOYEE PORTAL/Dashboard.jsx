import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Import AuthContext

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
  const [error, setError] = useState(null); // Error state
  const { user } = useAuth(); // Get user data from AuthContext

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
    
        // Log the raw API response to verify it
        console.log("Raw API Response:", result);
    
        // Check if we have valid data and parse the 'result' field
        if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          // The 'result' field is a string, so we need to parse it
          const parsedData = JSON.parse(result.data[0].result);
       

          console.log("Parsed Employee Summary:", parsedData);
        


          // Check if dailyTimeRecord exists and is an array    
          console.log("Daily Time Record:", parsedData[0].dailyTimeRecord);       
          const dailyRecords = parsedData[0]?.dailyTimeRecord; 
          if (dailyRecords && Array.isArray(dailyRecords)) {
            setDailyTimeRecord(dailyRecords);
          } else {
            setError("No daily time records found.");
          }


          
          // Check if Leave Credit exists and is an array 
          console.log("Leave Credit:", parsedData[0].leaveCredit);       
          const leaveCredits = parsedData[0]?.leaveCredit; 
          if (leaveCredits && Array.isArray(leaveCredits)) {
            setLeaveCredit(leaveCredits);
          } else {
            setError("No leave Credit records found.");
          }


          
          
          // Check if Loan Balance exists and is an array 
          console.log("Loan Balance:", parsedData[0].loanBalance);       
          const loanBalances = parsedData[0]?.loanBalance; 
          if (loanBalances && Array.isArray(loanBalances)) {
            setLoanBalance(loanBalances);
          } else {
            setError("No loan balance records found.");
          }



        } else {
          setError("API response format is incorrect or no data found.");
        }
      } catch (err) {
        console.error("Error fetching daily time records:", err);
        setError("An error occurred while fetching the records.");
      }
    };
    
    fetchDailyRecords();
  }, [user.empNo]);  // This effect depends on user.empNo
  
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

  const handleTimeIn = () => {
    setEntryTime(dayjs().format("hh:mm A"));
  };

  const handleBreakIn = () => {
    setIsCounting(true);
  };

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
    <div className="ml-80 mt-[120px] p-6 bg-gray-100 min-h-screen">
      {/* Controls */}
      <div className="flex justify-between mb-5">
        <div className="space-x-2">
          <button
            className="bg-green-500 px-4 py-2 text-white rounded"
            onClick={handleTimeIn}
          >
            Time In
          </button>
          <button className="bg-green-500 px-4 py-2 text-white rounded"
          onClick={handleBreakIn}>
            Break In
          </button>
        </div>
        <div className="space-x-2">
          <button className="bg-red-500 px-4 py-2 text-white rounded">
            Time Out
          </button>
          <button className="bg-red-500 px-4 py-2 text-white rounded">
            Break Out
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start w-[1000px]">
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white flex justify-between items-center mb-6 w-full shadow-lg">
          <div>
            <p className="text-sm font-light mb-1 text-[#424554]">Today</p>
            <h1 className="text-4xl font-extrabold text-[#424554]">
              {currentDate.format("DD MMMM YYYY")}
            </h1>
          </div>
          {/* Entry Time and Break Time Count */}
          <div className="flex space-x-10">
            <div>
              <p className="text-sm font-medium">Entry Time:</p>
              <p className="text-4xl font-bold">
                {entryTime || "00:00 PM"} {/* Display Entry Time  */}
              </p>
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
      <div className="grid grid-cols-3 gap-5">
        {/* Daily Time Record Section */}
        <div className="bg-white p-4 rounded-lg shadow h-[360px] w-[350px] flex flex-col">
          <h2 className="text-lg font-semibold">Daily Time Record</h2>
          <span className="text-gray-500 text-sm font-normal mt-4">Recent Transactions</span>

          {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

          {/* Display Daily Time Records */}
          <div className="space-y-4 mt-5 flex-grow overflow-y-auto">
            {dailyTimeRecord.length > 0 ? (
              dailyTimeRecord.map((record, index) => (
                <div key={index} className="flex justify-between items-center border-b pb-2">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div>
                      <p className="text-sm font-semibold">
                        {dayjs(record.trandate).format("MMMM D, YYYY")}
                      </p>
                      <p className="text-xs">Time In: {record.time_in ? dayjs(record.time_in).format("hh:mm A") : "N/A"}</p>
                      <p className="text-xs">Time Out: {record.time_out ? dayjs(record.time_out).format("hh:mm A") : "N/A"}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600 mt-4">No records found.</p>
            )}
        </div>
  <div className="flex justify-end mt-auto items-center">
    <span className="text-gray-500 cursor-pointer text-sm font-normal flex items-center">
      View All
      <span className="ml-1">→</span> 
    </span>
  </div>
</div>


        {/* Leave Credit */}
<div className="bg-white p-4 rounded-lg shadow h-[360px] w-[350px] flex flex-col">
  <h2 className="text-xl font-semibold">Leave Credit</h2>
  <span className="text-gray-500 cursor-pointer text-sm font-normal mt-4">Recent Transactions</span>
  <div className="space-y-2 mt-5 flex-grow">
    {[
      { type: "Vacation Leave", value: 12 },
      { type: "Sick Leave", value: 12 },
      { type: "Personal Leave", value: 6 },
      { type: "Emergency Leave", value: 4.87 },
      { type: "Maternity Leave", value: 1 },
      { type: "Paternity Leave", value: 1 },
    ].map((leave, index) => (
      <div key={index} className="flex items-center">
        <div className="w-32 text-sm">{leave.type}</div>
        <div className="flex-grow bg-gray-200 h-3 rounded-lg overflow-hidden">
          <div
            className={`bg-red-400 h-full`}
            style={{ width: `${(leave.value / 10) * 100}%` }}
          ></div>
        </div>
        <div className="w-8 text-sm text-right">{leave.value}</div>
      </div>
    ))}
  </div>
  <div className="flex justify-end mt-auto items-center">
    <span className="text-gray-500 cursor-pointer text-sm font-normal flex items-center">
      View All
      <span className="ml-1">→</span> 
    </span>
  </div>
</div>

        {/* Personal Calendar */}
        <div className="bg-white p-4 rounded-lg shadow h-[360px] w-[350px]">
          <h2 className="text-xl font-semibold mb-4 text-center">Personal Calendar</h2>
          <div className="flex justify-between items-center mb-2">
            <button onClick={handlePrevMonth} className="text-gray-400">◀</button>
            <h3 className="text-lg font-semibold">{currentMonth.format("MMMM YYYY")}</h3>
            <button onClick={handleNextMonth} className="text-gray-600">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-0 text-center text-gray-600 font-semibold">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(day => (
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
          <div className="flex justify-between text-xs mt-2">
            <div className="flex items-center"><span className="w-2 h-2 bg-red-500 inline-block mr-1"></span> Holiday</div>
            <div className="flex items-center"><span className="w-2 h-2 bg-blue-500 inline-block mr-1"></span> Leave</div>
            <div className="flex items-center"><span className="w-2 h-2 bg-yellow-500 inline-block mr-1"></span> Pending for Approval</div>
          </div>
        </div>
      </div>
      <hr className="mt-6 mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        {/* Overtime Applications */}
        <div className="bg-white p-4 rounded-lg shadow w-[550px]">
          <h2 className="text-xl font-semibold mb-4">My Overtime Applications</h2>
          <table className="w-full text-sm text-left">
            <thead className="text-[#747474]">
              <tr>
                <th className="py-2">Date of Application</th>
                <th className="py-2">Application Type</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">03/07/2021</td>
                <td>Year-End Process</td>
                <td>3 HRS</td>
                <td className="min-w-[80px] bg-yellow-100 text-yellow-500 px-3 py-1 rounded-full text-center">Pending</td>
              </tr>
              <tr>
                <td className="py-2">01/07/2022</td>
                <td>Late Entry</td>
                <td>1 HRS</td>
                <td className="min-w-[80px] bg-red-100 text-red-500 px-3 py-1 rounded-full text-center">Rejected</td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-500">Recent Transaction</span>
            <span className="text-sm text-gray-500 flex items-center cursor-pointer">
              View All <span className="ml-1">→</span>
            </span>
          </div>
        </div>

        {/* Leave Applications */}
        <div className="bg-white p-4 rounded-lg shadow w-[550px]">
          <h2 className="text-xl font-semibold mb-4">My Leave Applications</h2>
          <table className="w-full text-sm text-left">
            <thead className="text-[#747474]">
              <tr>
                <th className="py-2">Date of Application</th>
                <th className="py-2">Application Type</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">03/07/2021</td>
                <td>Casual Leave</td>
                <td>02 Days</td>
                <td className="min-w-[80px] bg-yellow-100 text-yellow-500 px-3 py-1 rounded-full text-center">Pending</td>
              </tr>
              <tr>
                <td className="py-2">01/07/2022</td>
                <td>Late Entry</td>
                <td>01 Days</td>
                <td className="min-w-[80px] bg-red-100 text-red-500 px-3 py-1 rounded-full text-center">Rejected</td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-500">Recent Transaction</span>
            <span className="text-sm text-gray-500 flex items-center cursor-pointer">
              View All <span className="ml-1">→</span>
            </span>
          </div>
        </div>

        {/* Official Business Applications */}
        <div className="bg-white p-4 rounded-lg shadow w-[550px]">
          <h2 className="text-xl font-semibold mb-4">My Official Business Applications</h2>
          <table className="w-full text-sm text-left">
            <thead className="text-text-[#747474]">
              <tr>
                <th className="py-2">Date of Application</th>
                <th className="py-2">Application Type</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">03/07/2021</td>
                <td>Client Onsite</td>
                <td>02 Days</td>
                <td className="min-w-[80px] bg-yellow-100 text-yellow-500 px-3 py-1 rounded-full text-center">Pending</td>
              </tr>
              <tr>
                <td className="py-2">01/07/2022</td>
                <td>Late Entry</td>
                <td>01 Days</td>
                <td className="min-w-[80px] bg-red-100 text-red-500 px-3 py-1 rounded-full text-center">Rejected</td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-500">Recent Transaction</span>
            <span className="text-sm text-gray-500 flex items-center cursor-pointer">
              View All <span className="ml-1">→</span>
            </span>
          </div>
        </div>

        {/* Loan Balance Inquiry */}
        <div className="bg-white p-4 rounded-lg shadow w-[550px]">
          <h2 className="text-xl font-semibold mb-4">Loan Balance Inquiry</h2>
          <span className="text-sm text-gray-500">Recent Transaction</span>
          <div className="mt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">SSS Loan</span>
              <span className="text-lg font-semibold">₱90,000</span>
            </div>
            <p className="text-gray-500 text-sm">₱10,000 (Monthly Deduction)</p>
          </div>
          <div className="flex justify-between items-center mt-4">
            <span></span>
            <span className="text-sm text-gray-500 flex items-center cursor-pointer">
              View All <span className="ml-1">→</span>
            </span>
          </div>
    </div>
    
    <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
  {/* Overtime Approval */}
  <div className="bg-white p-4 rounded-lg shadow w-[550px]">
    <h2 className="text-xl font-semibold mb-4">Overtime for Approval</h2>
    <table className="w-full text-sm text-left">
      <thead className="text-[#747474]">
        <tr>
          <th className="py-2">Date of Application</th>
          <th className="py-2">Application Type</th>
          <th className="py-2">Duration</th>
          <th className="py-2">Employee</th>
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b">
          <td className="py-2">03/07/2021</td>
          <td>Year-End Process</td>
          <td>3 HRS</td>
          <td>Jomel Mendoza</td>
          <td className="min-w-[80px] bg-yellow-100 text-yellow-500 px-3 py-1 rounded-full text-center">Pending</td>
        </tr>
        <tr> 
          <td className="py-2">01/07/2022</td>
          <td>Late Entry</td>
          <td>1 HRS</td>
          <td>Gerard Mendoza</td>
          <td className="min-w-[80px] bg-green-100 text-green-500 px-3 py-1 rounded-full text-center">Approved</td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Leave Approval */}
  <div className="bg-white p-4 ml-[290px] rounded-lg shadow w-[550px]">
    <h2 className="text-xl font-semibold mb-4">Leave for Approval</h2>
    <table className="w-full text-sm text-left">
      <thead className="text-[#747474]">
        <tr>
          <th className="py-2">Date of Application</th>
          <th className="py-2">Application Type</th>
          <th className="py-2">Duration</th>
          <th className="py-2">Employee</th>
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b">
          <td className="py-2">02/15/2023</td>
          <td>Project Deadline</td>
          <td>2 HRS</td>
          <td>Jomel Mendoza</td>
          <td className="min-w-[80px] bg-yellow-100 text-yellow-500 px-3 py-1 rounded-full text-center">Pending</td>
        </tr>
        <tr>
          <td className="py-2">04/12/2023</td>
          <td>Extra Hours</td>
          <td>1.5 HRS</td>
          <td>Gerard Mendoza</td>
          <td className="min-w-[80px] bg-green-100 text-green-500 px-3 py-1 rounded-full text-center">Approved</td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Official Business Approval */}
  <div className="bg-white p-4 rounded-lg shadow w-[550px]">
    <h2 className="text-xl font-semibold mb-4">Official Business for Approval</h2>
    <table className="w-full text-sm text-left">
      <thead className="text-[#747474]">
        <tr>
          <th className="py-2">Date of Application</th>
          <th className="py-2">Leave Type</th>
          <th className="py-2">Duration</th>
          <th className="py-2">Employee</th>
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b">
          <td className="py-2">02/15/2023</td>
          <td>Project Deadline</td>
          <td>2 HRS</td>
          <td>Jomel Mendoza</td>
          <td className="min-w-[80px] bg-yellow-100 text-yellow-500 px-3 py-1 rounded-full text-center">Pending</td>
        </tr>
        <tr>
          <td className="py-2">04/12/2023</td>
          <td>Extra Hours</td>
          <td>1.5 HRS</td>
          <td>Gerard Mendoza</td>
          <td className="min-w-[80px] bg-green-100 text-green-500 px-3 py-1 rounded-full text-center">Approved</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>            
    </div>
    </div>
  );
};

export default Dashboard;
