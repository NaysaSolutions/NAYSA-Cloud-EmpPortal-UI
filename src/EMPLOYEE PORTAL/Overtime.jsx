import React, { useState, useEffect } from "react"; 
import dayjs from "dayjs"; // dayjs library for working with dates easily.
import Swal from "sweetalert2"; // SweetAlert2 library for displaying alerts.
import { useAuth } from "./AuthContext"; //  access authentication details, such as the logged-in user.

const OvertimeApplication = () => { 

  const { user } = useAuth(); // Extracting the user object from the authentication context to get details like employee number.
  const [overtimeApplications, setOvertimeApplications] = useState([]); // State to store the full list of overtime applications.
  const [applicationDate, setApplicationDate] = useState("");
  const [filteredApplications, setFilteredApplications] = useState([]); // State to store the filtered list of applications based on search or sorting.
  const [otType, setOtType] = useState(""); // Define state for overtime type
  const [otDate, setOTDate] = useState("");// Define state for overtime date
  const [otDay, setOtDay] = useState(""); // Define state for overtime day
  const [overtimeHours, setOvertimeHours] = useState(""); // Define state for overtime hours
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState(null); // State to store any error messages encountered during data fetching.
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" }); // State to manage sorting configuration, tracking which key is sorted and in what direction.
  const [searchFields, setSearchFields] = useState({ 
    date: "",
    // durationDays: "",
    durationHours: "",
    type: "",
    remark: "",
    status: "",
  });

  const [currentPage, setCurrentPage] = useState(1); // State to track the current page number.

  const recordsPerPage = 50; // defining the number of records per page.
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage); // Calculating the total number of pages based on filtered applications.
  const indexOfLastRecord = currentPage * recordsPerPage; // Calculating the index of the last record for the current page.
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage; // Calculating the index of the first record for the current page.
  const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord); // Extracting the current page's records from the filtered applications list.

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
    setApplicationDate(today);
    setOTDate(today);
    setOtType("REG");
  }, []);
  
  useEffect(() => { 

    if (!user || !user.empNo) return; // If the user is not logged in or employee number is unavailable, exit early.

    const fetchOvertimeApplications = async () => { 

      try { 

        const today = dayjs().format("YYYY-MM-DD"); // Getting the current date in "YYYY-MM-DD" format.
        const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD"); // Calculating the date one year ago for filtering applications.
        
        const response = await fetch("http://127.0.0.1:8000/api/getOTApprInq", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ 
            EMP_NO: user.empNo,
            START_DATE: startDate,
            END_DATE: today,
          }),
        });

        const result = await response.json(); 

        console.log("Overtime Applications API Response:", result); 

        if (result.success && result.data.length > 0) {

          const parsedData = JSON.parse(result.data[0].result); 

          setOvertimeApplications(parsedData || []); // Updating the state with the retrieved applications or an empty array if no data.

          setFilteredApplications(parsedData || []); // Initially setting the filtered list to the same as the fetched list.

        } else { 
          setError("No overtime applications found."); 
        }

      } catch (err) { 

        console.error("Error fetching overtime applications:", err); 

        setError("An error occurred while fetching overtime applications."); 
      }
    };

    fetchOvertimeApplications(); 

  }, [user]); // Dependency array ensures that the effect runs whenever `user` changes.

  // Sorting Function
  const sortData = (key) => { // Function to handle sorting of data based on the selected key.

    let direction = "asc"; // Default sorting direction is ascending.

    if (sortConfig.key === key && sortConfig.direction === "asc") { // If already sorted in ascending order, switch to descending.

      direction = "desc"; 
    }

    setSortConfig({ key, direction }); // Updating the sorting configuration state.

    const sortedData = [...filteredApplications].sort((a, b) => { 
    // Sorting a copy of the filteredApplications array.

      if (key === "date") { 
      // If sorting by date, convert values to Unix timestamps for comparison.

        return direction === "asc"
          ? dayjs(a[key]).unix() - dayjs(b[key]).unix()
          : dayjs(b[key]).unix() - dayjs(a[key]).unix();

      } else if (key === "durationHours") { 
      // If sorting by duration hours, convert values to floating-point numbers.

        return direction === "asc"
          ? parseFloat(a[key]) - parseFloat(b[key])
          : parseFloat(b[key]) - parseFloat(a[key]);

      } else { 
      // Default case: Compare as strings using localeCompare.

        return direction === "asc"
          ? a[key]?.toString().localeCompare(b[key]?.toString())
          : b[key]?.toString().localeCompare(a[key]?.toString());
      }
    });

    setFilteredApplications(sortedData); 
    // Updating the state with the sorted applications.
  };

  // Search Function
  const handleSearchChange = (e, key) => { 
  // Function to update search state and filter results dynamically.

    const { value } = e.target; 
    // Extracting the input value.

    setSearchFields((prev) => ({ ...prev, [key]: value })); 
    // Updating the search state with the new value.

    const filtered = overtimeApplications.filter((app) => 
    // Filtering applications based on whether the search key includes the input value.

      app[key]?.toString().toLowerCase().includes(value.toLowerCase())
    );

    setFilteredApplications(filtered); 
    // Updating the filteredApplications state.

    setCurrentPage(1); 
    // Resetting to the first page after filtering.
  };

  // Function to display sort indicator (↑ or ↓)
  const getSortIndicator = (key) => { 
  // Function to return an arrow indicator for sorting.

    if (sortConfig.key !== key) return ""; 
    // If the key is not currently sorted, return an empty string.

    return sortConfig.direction === "asc" ? "↑" : "↓"; // arrow symbol based on sorting direction.
  };

  const handleSubmit = async () => {

    // const OvertimeData = {
    //   json_data: {
    //     empNo: user.empNo,
    //     detail: [
    //       {
    //         otDate: otDate,
    //         otDay: otDay,
    //         otHrs: parseFloat(overtimeHours) || 0,
    //         otRemarks: remarks,
    //         otType: otType,
    //       },
    //     ],
    //   },
    // };

  // Check if any required fields are empty
      if (!otDate || !otDay || !otType || !remarks.trim()) {
        Swal.fire({
            title: "Incomplete Form",
            text: "Please fill in all required fields before submitting.",
            icon: "warning",
            confirmButtonText: "OK",
        });
        return; // Stop execution to prevent API call
    }
    const OvertimeData = {
      json_data: {
          empNo: user.empNo,
          detail: [
              {
                otDate: otDate,
                otDay: otDay,
                otType: otType,
                otRemarks: remarks,
                otHrs: overtimeHours ? parseFloat(overtimeHours) : 0,
              },
          ],
      },
  };
  
    console.log("Sending Overtime Data:", JSON.stringify(OvertimeData, null, 2));
  
    try {
      const response = await fetch("http://127.0.0.1:8000/api/OTupsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(OvertimeData), //  Send correctly formatted JSON
      });
  
      const result = await response.json();
      console.log("API Response:", result); //  Log API response
  
      if (result.status === "success") {
        Swal.fire({
          title: "Success!",
          text: "Overtime application submitted successfully.",
          icon: "success",
          confirmButtonText: "OK",
      }).then(() => {
        // Reset all input fields after successful submission
        setApplicationDate("");
        setOvertimeHours(""); // Reset input field
        setRemarks("");
        setOtType(""); // Reset default type
        
        fetchOvertimeApplications(); // Refresh leave applications list
      });
    } else {
        Swal.fire({
            title: "Failed!",
            text: "Failed to submit overtime. Please try again.",
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
  
useEffect(() => {
  if (otDate) {
    const dayOfWeek = dayjs(otDate).format("dddd"); // Get day name (e.g., Monday)
    setOtDay(dayOfWeek);
  }
}, [otDate]); // Runs whenever otDate changes
  


  return (
    <div className="ml-[260px] mt-[120px] p-6 bg-gray-100 min-h-screen">
      <div className="max-w-[1150px] mx-auto">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold uppercase">My Overtime Applications</h1>
        </div>

        {/* Overtime Details Section */}
        <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <div className="grid grid-cols-3 gap-6">
          <div>
      <span className="block font-semibold mb-1 propercase">Date</span>
      <input 
        type="date" 
        className="w-full p-2 border rounded" 
        value={applicationDate} 
        onChange={(e) => setApplicationDate(e.target.value)} // Allow user to change date if needed
      />
    </div>

<div>
  <span className="block font-semibold mb-1 propercase">Date of Overtime</span>
  <input 
    value={otDate} 
    onChange={(e) => setOTDate(e.target.value)}
    type="date" 
    className="w-full p-2 border rounded"
  />
</div>
{/* <div>
  <span className="block font-semibold mb-1 propercase">Number of Days</span>
  <input 
    type="text"
    className="w-full p-2 border rounded bg-gray-100"
    value={otDay}
    readOnly
  />
</div> */}

<div>
  <span className="block font-semibold mb-1 propercase">Number of Hours</span>
  <input 
    type="number" 
    className="w-full p-2 border rounded"
    min="0" 
    step="0.5"
    value={overtimeHours}
    onChange={(e) => setOvertimeHours(e.target.value)}
    placeholder="Enter Overtime hours"
  />
</div>

            <div>
              <span className="block font-semibold mb-1 uppercase">Overtime Type</span>
              <select
                value={otType} 
                onChange={(e) => setOtType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="REG">Regular Overtime</option>
                <option>Holiday</option>
                <option>Rest Day</option>
              </select>
            </div>
          </div>

          {/* Remarks Section */}
          <div className="mt-6">
            <span className="block font-semibold mb-1 propercase">Remarks</span>
            <textarea
            value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows="4"
              className="w-full p-2 border rounded"
               placeholder="Enter Remarks"
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


        {/* Overtime History Table */}
        <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <h2 className="text-lg font-semibold mb-4 uppercase">Overtime Application History</h2>

          {error && <p className="text-red-500 text-center">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center border border-gray-200 rounded-lg shadow-md">
              <thead className="text-gray-700 propercase bg-gray-100 ">
                <tr>
                  {[
                    { key: "date", label: "OT Date" },
                    // { key: "durationDays", label: "Duration (Days)" },
                    { key: "durationHours", label: "Duration (Hours)" },
                    { key: "type", label: "Overtime Type" },
                    { key: "remark", label: "Remarks" },
                    { key: "status", label: "Status" },
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
                  currentRecords.map((entry, index) => (
                    <tr key={index} className="bg-white hover:bg-gray-100 transition">
                      <td className="px-4 py-2 border">{dayjs(entry.otDate).format("MM/DD/YYYY")}</td>
                      {/* <td className="px-4 py-2 border">{entry.otDay}</td> */}
                      <td className="px-4 py-2 border">{entry.otHrs}</td>
                      <td className="px-4 py-2 border">{entry.otDesc}</td>
                      <td className="px-4 py-2 border">{entry.otRemarks || "N/A"}</td>
                      <td className="px-4 py-2 border text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            entry.otStatus === "Pending"
                              ? "bg-yellow-100 text-yellow-600"
                              : entry.otStatus === "Approved"
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {entry.otStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                      No overtime applications found.
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

export default OvertimeApplication;
