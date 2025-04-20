import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2"; // SweetAlert2 library for displaying alerts.
import { useAuth } from "./AuthContext"; //  access authentication details, such as the logged-in user.

const Timekeeping = () => {
  const { user } = useAuth(); // Extracting the user object from the authentication context to get details like employee number.
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [time, setTime] = useState("");
  const [timeInImage, setTimeInImage] = useState(null);
  const [timeOutImage, setTimeOutImage] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [breakIn, setBreakIn] = useState("");
  const [breakOut, setBreakOut] = useState("");
  const [activeCapture, setActiveCapture] = useState(null);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [fetchRecords, setFetchRecords] = useState([]); // Store fetched data
  const [jsonData, setJsonData] = useState(null);
  const videoRef = useRef(null);
  const videoRefOut = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(dayjs().format("hh:mm:ss A"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.empNo) {
      fetchDTRRecords(); // ✅ Correct function call
    }
 }, [user]);
 

  // Search State
    const [searchFields, setSearchFields] = useState({
      trandate: "",
      time_in: "",
      time_out: "",
      break_in: "",
      break_out: ""
    });
    
    const formatDateTime = (dateTime) => {
      return dateTime
        ? new Date(dateTime).toLocaleString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "N/A";
    };
    
  
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;
    const totalPages = Math.ceil(filteredApplications.length / recordsPerPage);
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord);

    const fetchDTRRecords = async () => {
      try {
        const response = await fetch("https://api.nemarph.com:81/api/getDTR", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ EMP_NO: user?.empNo }),
        });
    
        const result = await response.json();
        console.log("API Response:", result);
    
        if (!result.success || !result.data || !Array.isArray(result.data)) {
          throw new Error(result.message || "Invalid data format received");
        }
    
        setFetchRecords(result.data); // Correctly setting data without unnecessary parsing
      } catch (error) {
        console.error("Error fetching records:", error.message);
        setFetchRecords([]); // Prevent undefined state
        setError(error.message);
      }
    };
    
  
  // Initialize Camera
  const startCamera = async () => {
    try {
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream; // Save the stream so we can stop it later
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Capture Image with Countdown
  const captureImage = (type) => {
    setCapturing(true);
    setActiveCapture(type);
    setCountdown(3);
  
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          const canvas = canvasRef.current;
          const video = videoRef.current;
  
          if (canvas && video) {
            const context = canvas.getContext("2d");
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const capturedImage = canvas.toDataURL("image/png");
  
            if (type === "TIME IN") setTimeInImage(capturedImage);
            else if (type === "TIME OUT") setTimeOutImage(capturedImage);
            else if (type === "BREAK IN") setBreakIn(capturedImage);
            else if (type === "BREAK OUT") setBreakOut(capturedImage);
          }
  
          setCapturing(false);
          setActiveCapture(null);
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeEvent = (type) => {
    const currentTime = dayjs().format("hh:mm:ss A");
  
    if (type === "TIME IN" && !timeIn) {
      setTimeIn(currentTime);
      captureImage(type); // Only capture for TIME IN
    }
    if (type === "TIME OUT" && !timeOut) {
      setTimeOut(currentTime);
      captureImage(type); // Only capture for TIME OUT
    }
    if (type === "BREAK IN" && !breakIn) {
      setBreakIn(currentTime); // Just record time, no image capture
    }
    if (type === "BREAK OUT" && !breakOut) {
      setBreakOut(currentTime); // Just record time, no image capture
    }
  };
  
  const startCameraForTimeOut = async () => {
    try {
      if (videoRefOut.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        videoRefOut.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing Time Out camera:", err);
    }
  };

  // Restart Camera
  const restartCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error restarting camera:", err);
    }
  };

  // Sorting Function
  const sortData = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  
    const sortedData = [...fetchRecords].sort((a, b) => {
      const valA = a[key] || "";
      const valB = b[key] || "";
  
      if (key === "trandate") {
        // Ensure proper date parsing
        return direction === "asc"
          ? dayjs(valA, "YYYY-MM-DD").unix() - dayjs(valB, "YYYY-MM-DD").unix()
          : dayjs(valB, "YYYY-MM-DD").unix() - dayjs(valA, "YYYY-MM-DD").unix();
      } else {
        return direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
    });
  
    setFetchRecords(sortedData);
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
  
  return (    
  // <div className="ml-[260px] mt-[110px] p-6 bg-gray-100 min-h-screen">
         
         <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[260px] mt-[110px] p-4 sm:p-6 bg-gray-100 min-h-screen">
      {/* <div className="mx-auto"> */}
     
     {/* Header */}
<div className="max-w-[1150px] mx-auto px-4">
  <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 w-full shadow-lg">
    {/* Date Section */}
    <div>
      <p className="text-md font-light mb-1 text-[#424554]">Today</p>
      <h1 className="text-3xl md:text-4xl font-extrabold text-[#495057]">
        {currentDate.format("MMMM DD YYYY")}
      </h1>
    </div>

    {/* Time Section */}
    <div className="flex flex-col items-start md:items-center">
      <p className="text-sm font-medium">Philippine Standard Time:</p>
      <p className="text-3xl md:text-4xl font-bold">{time}</p>
    </div>

    {/* Button Section */}
    <div className="flex flex-wrap gap-2 justify-center md:justify-end">
      <button
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded shadow-md transition duration-300"
        onClick={() => handleTimeEvent("TIME IN")}
      >
        TIME IN
      </button>
      <button
        className={`${
          !timeInImage
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600"
        } text-white font-bold py-2 px-4 rounded shadow-md transition duration-300`}
        onClick={() => handleTimeEvent("TIME OUT")}
        disabled={!timeInImage}
      >
        TIME OUT
      </button>
      <button
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded shadow-md transition duration-300"
        onClick={() => handleTimeEvent("BREAK IN")}
      >
        BREAK IN
      </button>
      <button
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded shadow-md transition duration-300"
        onClick={() => handleTimeEvent("BREAK OUT")}
      >
        BREAK OUT
      </button>
    </div>
  </div>
</div>


      {/* Content Section */}
      <div className="grid grid-cols-2 gap-10">
        {/* Time In */}
        <div className="flex flex-col items-center">
          <label className="mb-2 font-semibold">Time In:</label>
          <input
            type="text"
            className="border p-2 rounded shadow-md text-center"
            value={timeIn} readOnly
          />
          <h2 className="text-lg font-semibold mb-4 mt-4"></h2>
          {timeInImage ? (
            <img
              src={timeInImage}
              alt="Time In Capture"
              className="w-[300px] h-[200px] rounded shadow-lg"
            />
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-[300px] h-[200px] rounded shadow-lg transform scale-x-[-1]"
                autoPlay
                muted
              />
              {capturing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-4xl font-bold">
                  {countdown}
                </div>
              )}
            </div>
          )}
          {/* RE-TAKE Button for Time In */}
          <button
  onClick={() => startCamera("TIME IN")}
  className={`mt-4 py-2 px-4 rounded shadow-md transition duration-300 ${
    timeInImage ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-400 cursor-not-allowed"
  }`}
  disabled={!timeInImage}
>
  RE-TAKE
</button>
<div className="flex flex-col items-center mt-4">
          <label className="mb-2 font-semibold">Break In:</label>
          <input
            type="text"
            className="border p-2 rounded shadow-md text-center"
            value={breakIn} readOnly
          />
          </div>
        </div>

        {/* Time Out Section */}
<div className="flex flex-col items-center">
          <label className="mb-2 font-semibold">Time Out:</label>
          <input
            type="text"
            className="border p-2 rounded shadow-md text-center"
            value={timeOut} readOnly
          />
          <h2 className="text-lg font-semibold mb-4 mt-4"></h2>
  {timeOutImage ? (
    <img
      src={timeOutImage}
      alt="Time Out Capture"
      className="w-[300px] h-[200px] rounded shadow-lg"
    />
  ) : (
    <div className="relative">
      {!timeInImage ? (
        <div className="w-[300px] h-[200px] flex items-center justify-center bg-gray-300 rounded shadow-lg">
          <p className="text-gray-500">Camera Disabled</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-[300px] h-[200px] rounded shadow-lg transform scale-x-[-1]"
          autoPlay
          muted
        />
      )}

{capturing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-4xl font-bold">
          {countdown}
        </div>
      )}
    </div>
  )}

  {/* RE-TAKE Button for Time Out */}
  <button
  onClick={() => startCamera("TIME OUT")}
  className={`mt-4 py-2 px-4 rounded shadow-md transition duration-300 ${
    timeOutImage ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-400 cursor-not-allowed"
  }`}
  disabled={!timeOutImage}
>
  RE-TAKE
</button>
  <div className="flex flex-col items-center mt-4">
          <label className="mb-2 font-semibold">Break Out:</label>
          <input
            type="text"
            className="border p-2 rounded shadow-md text-center"
            value={breakOut} readOnly
          />
          </div>
</div>
      </div>
      
      {/* Hidden Canvas for Image Capture */}
      <canvas ref={canvasRef} width="300" height="200" style={{ display: "none" }}></canvas>
      {/* Timekeeping History Table */}
              <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
                <h2 className="text-lg font-semibold mb-4">History</h2>
      
                {error && <p className="text-red-500 text-center">{error}</p>}
      
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-center border border-gray-200 rounded-lg shadow-md">
                    <thead className="text-gray-700 propercase bg-gray-100">
                      <tr>
                        {[
                          { key: "trandate", label: "Date" },
                          { key: "time_in", label: "Time In" },
                          { key: "time_out", label: "Time Out" },
                          { key: "break_in", label: "Break In" },
                          { key: "break_out", label: "Break Out" },
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
  {fetchRecords.length > 0 ? (
    fetchRecords.map((record, index) => (
      <tr key={index} className="bg-white hover:bg-gray-100 text-gray-700 transition">
        <td className="px-4 py-2 border">{dayjs(record.trandate).format("MM/DD/YYYY")}</td>
        <td className="px-4 py-2 border">{formatDateTime(record.time_in)}</td>
<td className="px-4 py-2 border">{formatDateTime(record.time_out)}</td>
<td className="px-4 py-2 border">{formatDateTime(record.break_in)}</td>
<td className="px-4 py-2 border">{formatDateTime(record.break_out)}</td>
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
        No Daily Time Record found.
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
  );
};

export default Timekeeping;