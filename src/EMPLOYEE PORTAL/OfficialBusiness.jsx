import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"; // already installed
import { FaCalendarAlt } from "react-icons/fa";
import { forwardRef } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
  <div className="relative">
    <input
      type="text"
      readOnly
      className="w-full p-2 pl-10 border rounded"
      value={value}
      onClick={onClick}
      ref={ref}
    />
    <FaCalendarAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-pointer" />
  </div>
));

const officialBusiness = () => {

  // Anj
    const { user } = useAuth();
    const [obApplications, setOBApplications] = useState([]);
    const [filteredApplications, setFilteredApplications] = useState([]);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
    const [applicationDate, setApplicationDate] = useState("");

    // const [selectedStartDate, setSelectedStartDate] = useState("");
    // const [selectedEndDate, setSelectedEndDate] = useState("");
      const [selectedStartDate, setSelectedStartDate] = useState(null);
      const [selectedEndDate, setSelectedEndDate] = useState(null);
      // Add this near the top of your component, with other state declarations
const [holidays, setHolidays] = useState([]);

    const [obHrs, setOBHrs] = useState("0");
    const [remarks, setRemarks] = useState("");

    
   // Anj_Search State
    const [searchFields, setSearchFields] = useState({
      obDate: "",
      // obDay: "",
      obStart: "",
      obEnd: "",
      obHrs: "",
      obRemarks: "",
      appRemarks: "",
      obStatus: "",
    });


  // Anj_Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord);
    
//  useEffect(() => { 

//     if (!user || !user.empNo) return; // If the user is not logged in or employee number is unavailable, exit early.


  //     const fetchOBApplications = async () => {
  //       if (!user || !user.empNo) return;
      
  //         try {
  //         const today = dayjs().format("YYYY-MM-DD");
  //         const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");
      
  //         const response = await fetch(API_ENDPOINTS.fetchOfficialBusinessApplications, {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({
  //             EMP_NO: user.empNo,
  //             START_DATE: startDate,
  //             END_DATE: "2030-01-01"
  //           }),
  //         });
          
  //         const result = await response.json();
  //         console.log("Official Business Applications API Response:", result);

  //     if (result.success && result.data.length > 0) {
  //       const parsedData = JSON.parse(result.data[0].result);
  //       setOBApplications(parsedData || []);
  //       setFilteredApplications(parsedData || []);
  //     } else {
  //       setError("No Official Business applications found.");
  //     }
  //   } catch (err) {
  //     console.error("Error fetching Official Business applications:", err);
  //     setError("An error occurred while fetching Official Business applications.");
  //   }
  // };

//    // Initial fetch
//    fetchOBApplications(); 
  
//    // Set up auto-refresh every 10 seconds
//    const interval = setInterval(() => {
//     fetchOBApplications();
//    }, 10000); // Fetch every 10 seconds
 
//    // Cleanup function to clear interval when component unmounts
//    return () => clearInterval(interval);

  
// }, [user]);

const fetchHolidays = async () => {
  try {
    const response = await fetch(API_ENDPOINTS.fetchHolidays, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    // First check if the response is OK
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if response has content
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) === 0) {
      throw new Error('Empty response received');
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      setHolidays(result.data);
    } else {
      console.warn("No holidays data received, using fallback");
      // Use a fallback set of holidays if API fails
      setHolidays(getFallbackHolidays());
    }
  } catch (err) {
    console.error("Error fetching holidays:", err);
    // Use fallback holidays in case of error
    setHolidays(getFallbackHolidays());
  }
};

// Fallback holidays data
const getFallbackHolidays = () => {
  return [
    "2023-01-01", "2023-01-22", "2023-02-25", "2023-04-06", 
    "2023-04-07", "2023-04-08", "2023-04-09", "2023-05-01",
    "2023-06-28", "2023-08-28", "2023-11-27", "2023-12-25",
    "2024-01-01", "2024-02-10", "2024-03-29", "2024-03-31",
    "2024-04-09", "2024-04-10", "2024-05-01", "2024-06-12",
    "2024-08-26", "2024-11-30", "2024-12-25", "2024-12-30"
  ];
};


const fetchOBApplications = async () => {
  if (!user || !user.empNo) return;

  try {
    const today = dayjs().format("YYYY-MM-DD");
    const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

    const response = await fetch(API_ENDPOINTS.fetchOfficialBusinessApplications, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        EMP_NO: user.empNo,
        START_DATE: startDate,
        END_DATE: "2030-01-01"
      }),
    });

    const result = await response.json();
    console.log("Official Business Applications API Response:", result);

    if (result.success && result.data.length > 0) {
      const parsedData = JSON.parse(result.data[0].result);
      setOBApplications(parsedData || []);
      setFilteredApplications(parsedData || []);
    } else {
      setError("No Official Business applications found.");
    }
  } catch (err) {
    console.error("Error fetching Official Business applications:", err);
    setError("An error occurred while fetching Official Business applications.");
  }
};
  


useEffect(() => {
  if (!user || !user.empNo) return;
  
  fetchOBApplications();
  fetchHolidays(); // Fetch holidays when component mounts

  const interval = setInterval(() => {
    fetchOBApplications();
  }, 10000);

  return () => clearInterval(interval);
}, [user]);


    useEffect(() => {
      const today = new Date().toISOString().split("T")[0];
      // const formattedStart = dayjs(today).toISOString();
      // const formattedEnd = dayjs(today).toISOString();
      const datetimetoday = dayjs().format("YYYY-MM-DD hh:mm"); // e.g., "2025-04-21 14:30:00"
      // const today = new Date();
      setApplicationDate(today);
      setSelectedStartDate(datetimetoday);
      setSelectedEndDate(datetimetoday);
      // setSelectedStartDate(formattedStart);
      // setSelectedEndDate(formattedEnd);
    }, []);

    // Sorting Function
    const sortData = (key) => {
      let direction = "asc";
      if (sortConfig.key === key && sortConfig.direction === "asc") {
        direction = "desc";
      }
      setSortConfig({ key, direction });
  
      const sortedData = [...filteredApplications].sort((a, b) => {
        if (key === "obStart" || key === "obEnd") {
          return direction === "asc"
            ? dayjs(a[key]).unix() - dayjs(b[key]).unix()
            : dayjs(b[key]).unix() - dayjs(a[key]).unix();
        } else if (key === "obHrs") {
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
  
      const filtered = obApplications.filter((app) =>
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
  
  
   const handleSubmit = async () => {
  // Validation checks
  if (!selectedStartDate || !selectedEndDate || !obHrs || !remarks.trim()) {
    Swal.fire({
      title: "Incomplete Form",
      text: "Please fill all required fields",
      icon: "warning",
      confirmButtonText: "OK",
    });
    return;
  }

  // Format dates in local time instead of UTC
  const formattedStart = dayjs(selectedStartDate).format('YYYY-MM-DDTHH:mm:ss');
  const formattedEnd = dayjs(selectedEndDate).format('YYYY-MM-DDTHH:mm:ss');

  const obData = {
    json_data: {
      empNo: user.empNo,
      detail: [{
        obDate: applicationDate,
        obStart: formattedStart,
        obEnd: formattedEnd,
        obRemarks: remarks,
        obHrs: parseFloat(obHrs) || 0,
      }],
    },
  };

  console.log("Sending OB Data:", JSON.stringify(obData, null, 2));

  try {
    const response = await fetch("http://127.0.0.1:8000/api/upsertOB", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obData),
    });

    // First check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    // Try to parse JSON only if there's content
    const contentLength = response.headers.get('content-length');
    const result = contentLength && Number(contentLength) > 0 
      ? await response.json() 
      : { status: "success" }; // Assume success if no content

    if (result.status === "success") {
      Swal.fire({
        title: "Success!",
        text: "OB application submitted successfully.",
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        // Reset form
        const now = dayjs().format("YYYY-MM-DDTHH:mm");
        setSelectedStartDate(now);
        setSelectedEndDate(now);
        setRemarks("");
        setOBHrs("0");
        fetchOBApplications(); // Refresh the list
      });
    } else {
      throw new Error(result.message || "Unknown error occurred");
    }
  } catch (err) {
    console.error("Error submitting OB application:", err);
    Swal.fire({
      title: "Error!",
      text: err.message || "Failed to submit OB application",
      icon: "error",
      confirmButtonText: "OK",
    });
  }
};
  
     // Function to calculate leave days excluding weekends & holidays
     const calculateObHrs = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // If end is before start, return 0
  if (end < start) return 0;

  // Calculate total milliseconds difference
  const totalMs = end - start;

  // Convert milliseconds to hours
  const totalHours = totalMs / (1000 * 60 * 60);

  // Check if it's a weekend or holiday
  const startDay = start.getDay();
  const endDay = end.getDay();
  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  // If it's a weekend or holiday, return 0
  if (startDay === 0 || startDay === 6 || holidays.includes(startDateStr) || 
      endDay === 0 || endDay === 6 || holidays.includes(endDateStr)) {
    return 0;
  }

  // Return the total hours, rounded to 2 decimal places
  return parseFloat(totalHours.toFixed(2));
};
    
    

   const handleDateChange = (field, value) => {
  if (!value) return;

  if (field === "start") {
    setSelectedStartDate(value);

    if (!selectedEndDate || value > selectedEndDate) {
      setSelectedEndDate(value);
      setOBHrs(0); // Reset OB hrs since it's same date
    } else {
      const hours = calculateObHrs(value, selectedEndDate);
      setOBHrs(hours);
    }
  } else if (field === "end") {
    if (selectedStartDate && value < selectedStartDate) {
      Swal.fire({
        icon: "warning",
        title: "Invalid End Time",
        text: "End datetime cannot be earlier than start.",
      });
      return;
    }

    setSelectedEndDate(value);

    if (selectedStartDate) {
      const hours = calculateObHrs(selectedStartDate, value);
      setOBHrs(hours);
    }
  }
};


    // Add this useEffect to fetch holidays (similar to your other data fetches)
useEffect(() => {
  const fetchHolidays = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.fetchHolidays, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ YEAR: new Date().getFullYear() }),
      });
      const result = await response.json();
      if (result.success) {
        setHolidays(result.data.map(h => h.holidate));
      }
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };
  
  fetchHolidays();
}, []);
    
    
    return (
      <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[260px] mt-[110px] p-4 sm:p-6 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        {/* Header Section */}
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">My Official Business Applications</h1>
        </div>
  
                {/* Official Business Details Section */}        
                <div className="mt-6 bg-white p-4 sm:p-6 shadow-md rounded-lg">
  {/* Grid for date/time/hour */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

    {/* Date */}
    <div className="flex flex-col w-full">
      <label className="font-semibold mb-1">Date</label>
      <div className="relative flex flex-col">
        <DatePicker
          selected={applicationDate ? new Date(applicationDate) : null}
          onChange={(date) => setApplicationDate(date)}
          dateFormat="MM/dd/yyyy"
          placeholderText="Select Application Date"
          className="w-full p-2 pl-10 border rounded h-[42px]"
        />
        <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
    </div>

    {/* Start Datetime */}
    <div className="flex flex-col w-full">
      <label className="font-semibold mb-1">Start Datetime</label>
      <div className="relative flex flex-col">
        <DatePicker
  selected={selectedStartDate ? new Date(selectedStartDate) : null}
  onChange={(date) => handleDateChange("start", date)}
  showTimeSelect
  timeFormat="HH:mm"
  timeIntervals={15}
  dateFormat="MM/dd/yyyy hh:mm aa"
  placeholderText="Select Start Datetime"
  className="w-full p-2 pl-10 border rounded h-[42px]"
/>
        <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
    </div>

    {/* End Datetime */}
    <div className="flex flex-col w-full">
      <label className="font-semibold mb-1">End Datetime</label>
      <div className="relative flex flex-col">
        <DatePicker
  selected={selectedEndDate ? new Date(selectedEndDate) : null}
  onChange={(date) => handleDateChange("end", date)}
  showTimeSelect
  timeFormat="HH:mm"
  timeIntervals={15}
  dateFormat="MM/dd/yyyy hh:mm aa"
  placeholderText="Select End Datetime"
  className="w-full p-2 pl-10 border rounded h-[42px]"
  minDate={selectedStartDate || new Date()}
/>
        <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
    </div>

    {/* Number of Hours */}
  <div className="flex flex-col w-full">
    <label className="font-semibold mb-1">Number of Hours</label>
    <input
      type="number"
      value={obHrs}
      readOnly
      className="w-full p-2 border rounded h-[42px] bg-gray-100 cursor-not-allowed"
    />
  </div>

  </div>

  {/* Remarks Section */}
  <div className="mt-6">
    <label className="font-semibold mb-1 block">Remarks</label>
    <textarea
      rows="4"
      value={remarks}
      onChange={(e) => setRemarks(e.target.value)}
      placeholder="Enter Remarks"
      className="w-full p-2 border rounded resize-none"
    />
  </div>

  {/* Submit Button */}
  <div className="mt-6 flex justify-center">
    <button
      className="bg-blue-500 text-white px-12 py-2 rounded-md text-md sm:text-lg hover:bg-blue-600 w-full sm:w-auto"
      onClick={handleSubmit}
    >
      Submit
    </button>
  </div>
</div>


          {/* Official Business History Table */}
          <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Official Business Application History</h2>

          {error && <p className="text-red-500 text-center">{error}</p>}

  {/* Scrollable Table Container */}
  <div className="w-full overflow-x-auto">
  <table className="min-w-[800px] w-full text-sm text-center border">
      <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-300 to-purple-300 text-black text-xs sm:text-sm lg:text-base">
        <tr>
                    {[
                      { key: "obDate", label: "OB Date" },
                      { key: "obStart", label: "Start Date" },
                      { key: "obEnd", label: "End Date" },
                      { key: "obHrs", label: "Duration" },
                      { key: "obRemarks", label: "Remarks" },
                      { key: "appRemarks", label: "Approver's Remarks" },
                      { key: "obStatus", label: "Status" },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        className="py-2 px-3 cursor-pointer whitespace-nowrap"
                        onClick={() => sortData(key)}
                      >
                        {label} {getSortIndicator(key)}
                      </th>
                    ))}
                  </tr>
                  {/* Search Row */}
                  <tr>
                    {Object.keys(searchFields).map((key) => (
                      <td key={key} className="px-2 py-2 whitespace-nowrap">
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
                <tbody className="global-tbody">
                {currentRecords.length > 0 ? (
                  currentRecords.map((officialbusiness, index) => {
                    const textColor =
                    officialbusiness.obstatus === "Pending"
                        ? "global-td-status-pending"
                        : officialbusiness.obstatus === "Approved"
                        ? "global-td-status-approved"
                        : "global-td-status-disapproved";

                    return (
                                  <tr
                        key={index}
                        className={`global-tr ${textColor}`}
                      >
                        <td className="global-td">{dayjs(officialbusiness.obdate).format("MM/DD/YYYY")}</td>
<td className="global-td">{dayjs(officialbusiness.obstart).format("MM/DD/YYYY hh:mm a")}</td>
<td className="global-td">{dayjs(officialbusiness.obend).format("MM/DD/YYYY hh:mm a")}</td>
<td className="global-td">{officialbusiness.obhrs} Hours</td>
<td className="global-td">{officialbusiness.obremarks || "N/A"}</td>
<td className="global-td">{officialbusiness.App_Remarks || "N/A"}</td>
<td className="global-td-status">{officialbusiness.obstatus || "N/A"}</td>

                        {/* <td className="global-td text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              officialbusiness.obStatus === "Pending"
                                ? "bg-yellow-100 text-yellow-600"
                                : officialbusiness.obStatus === "Approved"
                                ? "bg-green-100 text-green-600"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {officialbusiness.obStatus}
                          </span>
                        </td> */}
                    </tr>

);
})
) : (
<tr>
                      <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                        No Official Business applications found.
                      </td>
                    </tr>
  )}
                </tbody>
              </table>
            </div>
  
  
  {/* Pagination */}
  <div className="flex justify-between items-center mt-2 pt-4">
    <div className="text-sm text-gray-600">
      Showing <b>{indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredApplications.length)}</b> of {filteredApplications.length} entries
    </div>
    <div className="flex items-center border rounded-lg overflow-hidden">
      <button
        onClick={() => setCurrentPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 border-r text-gray-700 hover:bg-blue-200 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        &lt;
      </button>
      {[...Array(totalPages)].map((_, i) => (
        <button
          key={i}
          onClick={() => setCurrentPage(i + 1)}
          className={`px-3 py-1 border-r ${
            currentPage === i + 1 ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-200"
          }`}
        >
          {i + 1}
        </button>
      ))}
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
  


export default officialBusiness;
