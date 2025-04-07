import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "C:/Users/mendo/OneDrive/Desktop/NAYSA-Cloud-EmpPortal-UI/src/apiConfig.jsx";

const Leave = () => {
  const { user } = useAuth();
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [applicationDate, setApplicationDate] = useState("");
  const [selectedStartDate, setSelectedStartDate] = useState("");
  const [selectedEndDate, setSelectedEndDate] = useState("");
  const [leaveHours, setLeaveHours] = useState("");
  const [leaveDays, setLeaveDays] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [remarks, setRemarks] = useState("");

  // Search State
  const [searchFields, setSearchFields] = useState({
    leaveStart: "",
    leaveEnd: "",
    leaveDays: "",
    leaveCode: "",
    leaveRemarks: "",
    leaveStatus: "",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord);

  useEffect(() => {
    if (!user || !user.empNo) return;
    const fetchLeaveApplications = async () => {
      try {
        const today = dayjs().format("YYYY-MM-DD");
        const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");
    
        const response = await fetch(API_ENDPOINTS.fetchLeaveApplications, { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: startDate,
            END_DATE: today,
          }),
        });
    
  
        const result = await response.json();
        console.log("Leave Applications API Response:", result);
  
        if (result.success && result.data.length > 0) {
          const parsedData = JSON.parse(result.data[0].result);
          setLeaveApplications(parsedData || []);
          setFilteredApplications(parsedData || []);
        } else {
          setError("No leave applications found.");
        }
      } catch (err) {
        console.error("Error fetching leave applications:", err);
        setError("An error occurred while fetching leave applications.");
      }
    };
  
    // Initial fetch
    fetchLeaveApplications();
  
    // Set up auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchLeaveApplications();
    }, 10000); // Fetch every 10 seconds
  
    // Cleanup function to clear interval when component unmounts
    return () => clearInterval(interval);
  }, [user]); // Depend on user to re-run when user changes

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
    setApplicationDate(today);
    setSelectedStartDate(today);
    setSelectedEndDate(today);
  }, []);

  // Sorting Function
  const sortData = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sortedData = [...filteredApplications].sort((a, b) => {
      if (key === "leaveStart" || key === "leaveEnd") {
        return direction === "asc"
          ? dayjs(a[key]).unix() - dayjs(b[key]).unix()
          : dayjs(b[key]).unix() - dayjs(a[key]).unix();
      } else if (key === "leaveDays") {
        return direction === "asc"
          ? parseFloat(a[key]) - parseFloat(b[key])
          : parseFloat(b[key]) - parseFloat(a[key]);
      } else {
        return direction === "asc"
          ? a[key]?.toString().localeCompare(b[key]?.toString())
          : b[key]?.toString().localeCompare(a[key]?.toString());
      }
    });

    setFilteredApplications(sortedData);
  };

  // Search Function
  const handleSearchChange = (e, key) => {
    const { value } = e.target;
    setSearchFields((prev) => ({ ...prev, [key]: value }));

    const filtered = leaveApplications.filter((app) =>
      app[key]?.toString().toLowerCase().includes(value.toLowerCase())
    );
    setFilteredApplications(filtered);
    setCurrentPage(1);
  };

  // Function to display sort indicator (↑ or ↓)
  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

   // List of holidays (Modify this array based on your holidays)
   const holidays = ["2025-04-01", "2025-05-04"]; // Example holidays (New Year, Christmas, etc.)


   // Function to calculate leave days excluding weekends & holidays
   const calculateLeaveDays = (startDate, endDate) => {
    if (!startDate || !endDate) return "";
  
    let start = new Date(startDate);
    let end = new Date(endDate);
    let count = 0;
  
    while (start <= end) {
      const day = start.getDay(); // 0 = Sunday, 6 = Saturday
      const formattedDate = start.toISOString().split("T")[0]; // Format YYYY-MM-DD
  
      if (day !== 0 && day !== 6 && !holidays.includes(formattedDate)) {
        count++;
      }
  
      start.setDate(start.getDate() + 1); // Move to the next day
    }
  
    return count;
  };
  
    // Update leave days when start or end date changes
    const handleDateChange = (field, value) => {
      if (field === "start") setSelectedStartDate(value);
      if (field === "end") setSelectedEndDate(value);
  
      if (selectedStartDate && selectedEndDate) {
        const days = calculateLeaveDays(
          field === "start" ? value : selectedStartDate,
          field === "end" ? value : selectedEndDate
        );
        setLeaveDays(days);
        setLeaveHours(days * 8); // Convert days to hours
      }
    };
  
      const handleHoursChange = (e) => {
        const hours = e.target.value;
        setLeaveHours(hours);
        setLeaveDays(hours ? (hours / 8).toFixed(2) : ""); // Convert to days
      };
    
      const handleDaysChange = (e) => {
        const days = e.target.value;
        setLeaveDays(days);
        setLeaveHours(days ? days * 8 : ""); // Convert to hours
      };


  const handleSubmit = async () => {
    // Check if any required fields are empty
    if (!selectedStartDate || !selectedEndDate || !leaveType || !remarks.trim()) {
        Swal.fire({
            title: "Incomplete Form",
            text: "Please fill in all required fields before submitting.",
            icon: "warning",
            confirmButtonText: "OK",
        });
        return; // Stop execution to prevent API call
    }

    const leaveData = {
        json_data: {
            empNo: user.empNo,
            detail: [
                {
                    leaveStart: selectedStartDate,
                    leaveEnd: selectedEndDate,
                    leaveCode: leaveType,
                    leaveRemarks: remarks,
                    leaveHours: leaveHours ? parseFloat(leaveHours) : 0,
                    leaveDays: leaveDays ? parseFloat(leaveDays) : 0,
                },
            ],
        },
    };

    console.log("Sending Leave Data:", JSON.stringify(leaveData, null, 2));

    try {
      const response = await fetch(API_ENDPOINTS.saveLeaveApplication, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveData),
      });

        const result = await response.json();
        console.log("API Response:", result);

        if (result.status === "success") {
            Swal.fire({
                title: "Success!",
                text: "Leave application submitted successfully.",
                icon: "success",
                confirmButtonText: "OK",
            }).then(() => {
                // Reset all input fields after successful submission
                setSelectedStartDate("");
                setSelectedEndDate("");
                setLeaveType("");
                setRemarks("");  // Ensure remarks are cleared
                setLeaveHours("");
                setLeaveDays("");

                fetchLeaveApplications(); // Refresh leave applications list
            });
        } else {
            Swal.fire({
                title: "Failed!",
                text: "Failed to submit leave. Please try again.",
                icon: "error",
                confirmButtonText: "OK",
            });
        }
    } catch (err) {
        console.error("Error submitting leave application:", err);
        Swal.fire({
            title: "Error!",
            text: "An error occurred while submitting. Please check your connection and try again.",
            icon: "error",
            confirmButtonText: "OK",
        });
    }
};


  return (
    <div className="ml-[260px] mt-[120px] p-6 bg-gray-100 min-h-screen">
      <div className="max-w-[1150px] mx-auto">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold">My Leave Applications</h1>
        </div>

        {/* Leave Details Section */}
        <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <div className="grid grid-cols-3 gap-6">
          <div>
      <span className="block font-semibold mb-1 propercase">Date</span>
      <input
        type="date"
        className="w-full p-2 border rounded"
        value={applicationDate}
        onChange={(e) => setApplicationDate(e.target.value)}
      />
    </div>

<div>
  <span className="block font-semibold mb-1 propercase">Start Date</span>
  <input 
  type="date" 
  className="w-full p-2 border rounded" 
  value={selectedStartDate} 
  // onChange={(e) => setSelectedStartDate(e.target.value)} 
  onChange={(e) => handleDateChange("start", e.target.value)}
/>
</div>

<div>
  <span className="block font-semibold mb-1 propercase">End Date</span>
  <input 
  type="date" 
  className="w-full p-2 border rounded" 
  value={selectedEndDate} 
  // onChange={(e) => setSelectedEndDate(e.target.value)} 
  onChange={(e) => handleDateChange("end", e.target.value)}
/>
</div>


            <div>
              <span className="block font-semibold mb-1 propercase">Application Type</span>
              <select
  className="w-full p-2 border rounded"
  value={leaveType}
  onChange={(e) => setLeaveType(e.target.value)}
>
  <option value="">Select Leave Type</option>
  <option value="SL">Sick Leave</option>
  <option value="VL">Vacation Leave</option>
  <option value="VL">Emergency Leave</option>
  <option value="VL">Birthday Leave</option>
  <option value="Maternity Leave">Maternity Leave</option>
</select>

            </div>

           

            <div>
              <span className="block font-semibold mb-1 propercase">Number of Days</span>
              <input 
  type="number" 
  className="w-full p-2 border rounded" 
  value={leaveDays} 
  placeholder="Enter Leave Days"
  // onChange={(e) => setLeaveDays(e.target.value)} 
  onChange={handleDaysChange}
/>
            </div>

            <div>
              <span className="block font-semibold mb-1 propercase">Number of Hours</span>
              <input 
  type="number" 
  className="w-full p-2 border rounded" 
  min="0" 
  step="0.5"
  placeholder="Enter hours"
  value={leaveHours} 
  // onChange={(e) => setLeaveHours(e.target.value)} 
  onChange={handleHoursChange}

/>
            </div>

          </div>

          {/* Remarks Section */}
          <div className="mt-6">
            <span className="block font-semibold mb-1 propercase">Remarks</span>
            <textarea
              onChange={(e) => setRemarks(e.target.value)}
              rows="4"
              className="w-full p-2 border rounded"
              placeholder="Enter Remarks"
              value={remarks}
              required
            ></textarea>
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            onClick={handleSubmit}>
              SUBMIT
            </button>
          </div>
        </div>

        {/* Leave History Table */}
        <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <h2 className="text-lg font-semibold mb-4 uppercase">History</h2>

          {error && <p className="text-red-500 text-center">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center border border-gray-200 rounded-lg shadow-md">
              <thead className="text-gray-700 propercase bg-gray-100">
                <tr>
                  {[
                    { key: "leaveStart", label: "Start Date" },
                    { key: "leaveEnd", label: "End Date" },
                    { key: "leaveDays", label: "Duration" },
                    { key: "leaveCode", label: "Leave Type" },
                    { key: "leaveRemarks", label: "Remarks" },
                    { key: "ApprRemarks", label: "ApprRemarks" },
                    { key: "leaveStatus", label: "Status" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      className="px-4 py-2 border cursor-pointer"
                      onClick={() => sortData(key)}
                    >
                      {label} {getSortIndicator(key)}
                    </th>
                  ))}
                </tr>
                {/* Search Row */}
                <tr>
                  {Object.keys(searchFields).map((key) => (
                    <td key={key} className="px-2 py-1 border">
                      <input
                        type="text"
                        value={searchFields[key]}
                        onChange={(e) => handleSearchChange(e, key)}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentRecords.length > 0 ? (
                  currentRecords.map((leave, index) => (
                    <tr key={index} className="bg-white hover:bg-gray-100 transition">
                      <td className="px-4 py-2 border">{dayjs(leave.leaveStart).format("MM/DD/YYYY")}</td>
                      <td className="px-4 py-2 border">{dayjs(leave.leaveEnd).format("MM/DD/YYYY")}</td>
                      <td className="px-4 py-2 border">{leave.leaveDays} Days</td>
                      <td className="px-4 py-2 border">{leave.leaveCode}</td>
                      <td className="px-4 py-2 border">{leave.leaveRemarks || "N/A"}</td>
                      <td className="px-4 py-2 border">{leave.ApprleaveRemarks || "N/A"}</td>
                      <td className="px-4 py-2 border text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            leave.leaveStatus === "Pending"
                              ? "bg-yellow-100 text-yellow-600"
                              : leave.leaveStatus === "Approved"
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {leave.leaveStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                      No leave applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

           {/* Pagination */}
<div className="flex justify-between items-center mt-4 border-t pt-4">
  {/* Left: Showing Text */}
  <div className="text-sm text-gray-600">
    Showing <b>{indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredApplications.length)}</b> of {filteredApplications.length} entries
  </div>

  {/* Right: Pagination Controls */}
  <div className="flex items-center border rounded-lg overflow-hidden">
    {/* Previous Button */}
    <button
      onClick={() => setCurrentPage(currentPage - 1)}
      disabled={currentPage === 1}
      className="px-3 py-1 border-r text-gray-700 hover:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
    >
      &lt;
    </button>

    {/* Page Numbers */}
    {[...Array(totalPages)].map((_, i) => (
      <button
        key={i}
        onClick={() => setCurrentPage(i + 1)}
        className={`px-3 py-1 border-r ${
          currentPage === i + 1 ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
        }`}
      >
        {i + 1}
      </button>
    ))}

    {/* Next Button */}
    <button
      onClick={() => setCurrentPage(currentPage + 1)}
      disabled={currentPage === totalPages}
      className="px-3 py-1 text-gray-700 hover:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
    >
      &gt;
    </button>
  </div>
</div>


        </div>
      </div>
    </div>
  );
};

export default Leave;
