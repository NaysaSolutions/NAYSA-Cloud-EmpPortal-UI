import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "C:/Users/mendo/OneDrive/Desktop/NAYSA-Cloud-EmpPortal-UI/src/apiConfig.jsx";

const officialBusiness = () => {

  // Gerard
  // const [applicationDate] = useState("January 27, 2025");
  // const [duration] = useState("January 28, 2025");
  // const [OBType, setOBType] = useState("");
  // const [remarks, setRemarks] = useState();

  // Anj
    const { user } = useAuth();
    const [obApplications, setOBApplications] = useState([]);
    const [filteredApplications, setFilteredApplications] = useState([]);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
    const [applicationDate, setApplicationDate] = useState("");
    const [selectedStartDate, setSelectedStartDate] = useState("");
    const [selectedEndDate, setSelectedEndDate] = useState("");
    const [obHrs, setOBHrs] = useState("");
    const [remarks, setRemarks] = useState("");

    
   // Anj_Search State
    const [searchFields, setSearchFields] = useState({
      obDate: "",
      // obDay: "",
      obStart: "",
      obEnd: "",
      obHrs: "",
      obRemarks: "",
      obStatus: "",
    });


  // Anj_Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord);
    
      const fetchOBApplications = async () => {
        try {
          if (!user || !user.empNo) return;
      
          const today = dayjs().format("YYYY-MM-DD");
          const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");
      
          const response = await fetch(API_ENDPOINTS.fetchOfficialBusinessApplications, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              EMP_NO: user.empNo,
              START_DATE: startDate,
              END_DATE: today,
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error: ", errorText);
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
          }
          
      
          const text = await response.text();
          const result = text ? JSON.parse(text) : {};
      
          console.log("Official Business Applications API Response:", result);
      
          if (result.success && result.data && result.data.length > 0) {
            try {
              const parsedData = JSON.parse(result.data[0].result);
              setOBApplications(parsedData || []);
              setFilteredApplications(parsedData || []);
            } catch (parseError) {
              console.error("Error parsing result data:", parseError);
              setOBApplications([]);
              setFilteredApplications([]);
            }
          } else {
            setOBApplications([]);
            setFilteredApplications([]);
            setError(result.message || "No Official Business applications found.");
          }
        } catch (err) {
          console.error("Error fetching Official Business applications:", err);
          setError("An error occurred while fetching Official Business applications.");
          setOBApplications([]);
          setFilteredApplications([]);
        }
      };
    
      // Anj
    useEffect(() => {
      if (!user || !user.empNo) return;
      // Initial fetch
      fetchOBApplications();
    
      // Set up auto-refresh every 10 seconds
      const interval = setInterval(() => {
        fetchOBApplications();
      }, 10000); // Fetch every 10 seconds
    
      // Cleanup function to clear interval when component unmounts
      return () => clearInterval(interval);
    }, [user]); // Depend on user to re-run when user changes
  
    useEffect(() => {
      const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
      setApplicationDate(today);
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
      if (!selectedStartDate || !selectedEndDate) {
        Swal.fire({
          title: "Incomplete Form",
          text: "Please select both start and end dates",
          icon: "warning",
          confirmButtonText: "OK",
        });
        return;
      }
    
      const obData = {
        json_data: {
          empNo: user.empNo,
          detail: [
            {
              obDate: applicationDate,
              obStart: selectedStartDate,
              obEnd: selectedEndDate,
              obRemarks: remarks,
              obHrs: obHrs ? parseFloat(obHrs) : 0,
            },
          ],
        },
      };
    
      console.log("Sending Official Business Data:", obData);
    
      try {
        const response = await fetch(API_ENDPOINTS.saveOfficialBusinessApplication, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(obData),
        });
    
        // Check if response is OK
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error: ", errorText);
          throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }
    
        // Safely parse JSON
        const text = await response.text();
        const result = text ? JSON.parse(text) : {};
    
        console.log("API Response:", result);
    
        if (result.status === "success") {
          Swal.fire({
            title: "Success!",
            text: "Official Business application submitted successfully.",
            icon: "success",
            confirmButtonText: "OK",
          }).then(() => {
            // Reset form
            setSelectedStartDate("");
            setSelectedEndDate("");
            setRemarks("");
            setOBHrs("");
            
            // Refresh data
            fetchOBApplications();
          });
        } else {
          Swal.fire({
            title: "Failed!",
            text: result.message || "Failed to submit Official Business.",
            icon: "error",
            confirmButtonText: "OK",
          });
        }
      } catch (err) {
        console.error("Error submitting Official Business application:", err);
        Swal.fire({
          title: "Error!",
          text: "An error occurred while submitting. Please try again.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    };
  
  
    return (
      <div className="ml-[260px] mt-[110px] p-6 bg-gray-100 min-h-screen">
      <div className="max-w-[1150px] mx-auto">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
            <h1 className="text-3xl font-semibold">My Official Business Applications</h1>
          </div>
  
          {/* Official Business Details Section */}
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
    <span className="block font-semibold mb-1 propercase">Start Datetime</span>
    <input 
    type="datetime-local" 
    className="w-full p-2 border rounded" 
    value={selectedStartDate} 
    onChange={(e) => setSelectedStartDate(e.target.value)} 
  />
  </div>
  
  <div>
    <span className="block font-semibold mb-1 propercase">End Datetime</span>
    <input 
    type="datetime-local" 
    className="w-full p-2 border rounded" 
    value={selectedEndDate} 
    onChange={(e) => setSelectedEndDate(e.target.value)} 
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
    value={obHrs} 
    onChange={(e) => setOBHrs(e.target.value)} 
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

          {/* Official Business History Table */}
          <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
            <h2 className="text-lg font-semibold mb-4 uppercase">History</h2>
  
            {error && <p className="text-red-500 text-center">{error}</p>}
  
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-center border border-gray-200 rounded-lg shadow-md">
                <thead className="text-gray-700 propercase bg-gray-100">
                  <tr>
                    {[
                      { key: "obDate", label: "OB Date" },
                      { key: "obStart", label: "Start Date" },
                      { key: "obEnd", label: "End Date" },
                      { key: "obHrs", label: "Duration" },
                      { key: "obRemarks", label: "Remarks" },
                      { key: "obStatus", label: "Status" },
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
                    currentRecords.map((officialbusiness, index) => (
                      <tr key={index} className="bg-white hover:bg-gray-100 transition">
                        <td className="px-4 py-2 border">{dayjs(officialbusiness.obDate).format("MM/DD/YYYY")}</td>
                        <td className="px-4 py-2 border">{dayjs(officialbusiness.obStart).format("MM/DD/YYYY hh:mm")}</td>
                        <td className="px-4 py-2 border">{dayjs(officialbusiness.obEnd).format("MM/DD/YYYY hh:mm")}</td>
                        <td className="px-4 py-2 border">{officialbusiness.obHrs} Hours</td>
                        <td className="px-4 py-2 border">{officialbusiness.obRemarks || "N/A"}</td>
                        <td className="px-4 py-2 border text-center">
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
                        </td>
                      </tr>
                    ))
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
  


// Gerard
//   const history = [
//     {
//       date: "03/07/2021",
//       durationDays: "01 Day (05 Jul)",
//       durationHours: "8 HRS",
//       type: "Meeting",
//       remark: "Client Onsite Meeting",
//       approverRemark: "",
//       status: "Pending",
//     },
//     {
//         date: "06/07/2024",
//         durationDays: "01 Day (06 June)",
//         durationHours: "8 HRS",
//         type: "Meeting",
//         remark: "Client Onsite Meeting",
//         approverRemark: "",
//         status: "Disapproved",
//     },
//   ];

//   return (
//     <div className="ml-80 mt-[120px] p-6 bg-gray-100 min-h-screen">
//       <div className="w-[1150px]">
//         {/* Header Section */}
//         <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
//           <h1 className="text-3xl font-semibold">My Official Business Application</h1>
//         </div>

//         {/* Overtime Details Section */}
//         <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
//           <div className="grid grid-cols-3 gap-6">
//             <div>
//               <span className="block font-semibold mb-1">Date of Application</span>
//               <div className="w-full p-2 border rounded bg-gray-100">{applicationDate}</div>
//             </div>

//             <div>
//               <span className="block font-semibold mb-1">Duration</span>
//               <div className="w-full p-2 border rounded bg-gray-100">{duration}</div>
//             </div>

//             <div>
//               <span className="block font-semibold mb-1">Application Type</span>
//               <select
//                 value={OBType}
//                 onChange={(e) => setOBType(e.target.value)}
//                 className="w-full p-2 border rounded"
//               >
//                 <option>Meeting</option>
//                 <option>Training</option>
//               </select>
//             </div>
//           </div>

//           {/* Remarks Section */}
//           <div className="mt-6">
//             <span className="block font-semibold mb-1">Remarks</span>
//             <textarea
//               value={remarks}
//               onChange={(e) => setRemarks(e.target.value)}
//               rows="4"
//               className="w-full p-2 border rounded"
//             ></textarea>
//           </div>

//           {/* Submit Button */}
//           <div className="mt-6 flex justify-end">
//             <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
//               SUBMIT
//             </button>
//           </div>
//         </div>

//         {/* Filters Section */}
//         <div className="mt-10 grid grid-cols-4 gap-6 bg-white p-4 shadow-md rounded-lg">
//           <div>
//             <span className="block font-semibold mb-1">Date of Application</span>
//             <input type="text" className="w-full p-2 border rounded" />
//           </div>
//           <div>
//             <span className="block font-semibold mb-1">Duration</span>
//             <input type="text" className="w-full p-2 border rounded" />
//           </div>
//           <div>
//             <span className="block font-semibold mb-1">Application Type</span>
//             <input type="text" className="w-full p-2 border rounded" />
//           </div>
//           <div>
//             <span className="block font-semibold mb-1">Status</span>
//             <input type="text" className="w-full p-2 border rounded" />
//           </div>
//         </div>

//         {/* History Table */}
//         <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
//           <h2 className="text-lg font-semibold mb-4">History</h2>
//           <table className="w-full border-collapse">
//             <thead>
//               <tr className="bg-gray-200 text-left">
//                 <th className="p-2 border">DATE OF APPLICATION</th>
//                 <th className="p-2 border">DURATION (DAYS)</th>
//                 <th className="p-2 border">DURATION (HOURS)</th>
//                 <th className="p-2 border">APPLICATION TYPE</th>
//                 <th className="p-2 border">REMARKS</th>
//                 <th className="p-2 border">APPROVER'S REMARK</th>
//                 <th className="p-2 border">STATUS</th>
//               </tr>
//             </thead>
//             <tbody>
//   {history.map((entry, index) => (
//     <tr key={index} className="border">
//       <td className="p-2 border">{entry.date}</td>
//       <td className="p-2 border">{entry.durationDays}</td>
//       <td className="p-2 border">{entry.durationHours}</td>
//       <td className="p-2 border">{entry.type}</td>
//       <td className="p-2 border">{entry.remark}</td>
//       <td className="p-2 border">{entry.approverRemark}</td>
//       <td className="p-2 border">
//         <span
//           className={`px-3 py-1 rounded-full text-sm font-semibold ${
//             entry.status === "Pending"
//               ? "bg-orange-100 text-orange-500"
//               : "bg-red-100 text-red-500"
//           }`}
//         >
//           {entry.status}
//         </span>
//       </td>
//     </tr>
//   ))}
// </tbody>

//           </table>
//         </div>
//       </div>
//     </div>
//   );
// };

export default officialBusiness;
