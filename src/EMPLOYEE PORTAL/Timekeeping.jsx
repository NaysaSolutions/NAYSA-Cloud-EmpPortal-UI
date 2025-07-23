import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";

const Timekeeping = ({ onBreakStart }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [time, setTime] = useState("");
  const [timeInImage, setTimeInImage] = useState(null);
  const [timeOutImage, setTimeOutImage] = useState(null);
  const [capturing, setCapturing] = useState({
    timeIn: false,
    timeOut: false
  });
  const [countdown, setCountdown] = useState({
    timeIn: 0,
    timeOut: 0
  });
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [breakIn, setBreakIn] = useState("");
  const [breakOut, setBreakOut] = useState("");
  const [timeInLocation, setTimeInLocation] = useState(null);
  const [timeOutLocation, setTimeOutLocation] = useState(null);
  const [records, setRecords] = useState([]);
  const [fetchRecords, setFetchRecords] = useState([]);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const videoRefOut = useRef(null);
  const canvasRef = useRef(null);
  const streamRefIn = useRef(null);
  const streamRefOut = useRef(null);
  

  const API_KEY = "pk.65e557ad74cdce625f80adf6d5534600";
  
  const COMPANY_LOCATION = {
    address: "1st floor, Rufino Building, Pres. L. Katigbak Street, C.M. Recto Ave, Brgy. 9, Lipa City, Batangas",
    coordinates: {
      latitude: 13.9411,
      longitude: 121.1622
    },
    allowedRadius: 500 // meters
  };

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(dayjs().format("hh:mm:ss A"));
      setCurrentDate(dayjs());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch records when user changes
  useEffect(() => {
    if (user?.empNo) {
      fetchDTRRecords();
    }
  }, [user]);

  // Initialize Time In camera on mount
  useEffect(() => {
    const initTimeInCamera = async () => {
      try {
        const constraints = { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRefIn.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Time In camera error:", err);
      }
    };

    initTimeInCamera();

    return () => {
      if (streamRefIn.current) {
        streamRefIn.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Initialize Time Out camera when Time In is captured
  useEffect(() => {
    if (timeInImage && !timeOutImage) {
      const initTimeOutCamera = async () => {
        try {
          const constraints = { video: true };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRefOut.current = stream;
          if (videoRefOut.current) videoRefOut.current.srcObject = stream;
        } catch (err) {
          console.error("Time Out camera error:", err);
        }
      };

      initTimeOutCamera();
    }

    return () => {
      if (streamRefOut.current) {
        streamRefOut.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [timeInImage, timeOutImage]);

  // Helper function to calculate distance between two coordinates (in meters)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Get current location with geocoding
  const getCurrentLocation = async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords;
            const address = await reverseGeocode(latitude, longitude);
            
            resolve({
              coordinates: {
                latitude,
                longitude,
                accuracy
              },
              address,
              timestamp: new Date().toLocaleString()
            });
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // Reverse geocode using LocationIQ
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://us1.locationiq.com/v1/reverse.php?key=${API_KEY}&lat=${lat}&lon=${lng}&format=json`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.display_name) {
        throw new Error("No address found");
      }

      return {
        fullAddress: data.display_name,
        exactAddress: data.address?.road || '',
        streetNumber: data.address?.house_number || '',
        street: data.address?.road || '',
        building: data.address?.building || '',
        neighborhood: data.address?.neighbourhood || '',
        city: data.address?.city || data.address?.town || data.address?.village || '',
        state: data.address?.state || '',
        country: data.address?.country || '',
        postalCode: data.address?.postcode || '',
        isExact: !!data.address?.road,
        mapUrl: `https://www.google.com/maps?q=${lat},${lng}`
      };
    } catch (error) {
      console.error("Geocoding error:", error);
      return await fallbackGeocode(lat, lng);
    }
  };

  // Fallback geocoding
  const fallbackGeocode = async (lat, lng) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    return {
      fullAddress: data.display_name,
      precise: false 
    };
  };

  // Capture image with countdown
  const captureImage = async (type) => {
  const cameraType = type === "TIME IN" ? "timeIn" : "timeOut";

  setCapturing(prev => ({ ...prev, [cameraType]: true }));
  setCountdown(prev => ({ ...prev, [cameraType]: 3 }));

  const interval = setInterval(() => {
    setCountdown(prev => {
      const newCount = prev[cameraType] - 1;

      if (newCount === 0) {
        clearInterval(interval);
        const canvas = canvasRef.current;
        const video = type === "TIME IN" ? videoRef.current : videoRefOut.current;

        if (canvas && video) {
          const context = canvas.getContext("2d");
          context.save();
          context.scale(-1, 1);
          context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          context.restore();

          const capturedImage = canvas.toDataURL("image/jpeg", 0.92);

          if (type === "TIME IN") {
            setTimeInImage({ url: capturedImage });
          } else {
            setTimeOutImage({ url: capturedImage });
          }

          // Optionally register time here (e.g., update your backend or state)
        }

        setCapturing(prev => ({ ...prev, [cameraType]: false }));
      }

      return { ...prev, [cameraType]: newCount };
    });
  }, 1000);
};


const saveImageToServer = async (imageId, imageData) => {
  try {
    const response = await fetch('https://api.nemarph.com:81/api/saveImage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId,
        imageData
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save image');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

  // Handle time in/out events
  const handleTimeEvent = async (type) => {
    try {
      // First verify location
      const location = await getCurrentLocation();
      const distance = calculateDistance(
        location.coordinates.latitude,
        location.coordinates.longitude,
        COMPANY_LOCATION.coordinates.latitude,
        COMPANY_LOCATION.coordinates.longitude
      );

      // Calculate effective distance accounting for GPS accuracy
      const effectiveDistance = Math.max(0, distance - location.coordinates.accuracy);

      if (effectiveDistance > COMPANY_LOCATION.allowedRadius) {
        await Swal.fire({
          icon: 'error',
          title: 'Location Restricted',
          html: `You must be within ${COMPANY_LOCATION.allowedRadius}m of:<br>
                <strong>${COMPANY_LOCATION.address}</strong><br><br>
                Your current distance: <strong>${Math.round(distance)}m</strong><br>
                GPS accuracy: ±${Math.round(location.coordinates.accuracy)}m`
        });
        return;
      }

      // Only proceed if location is valid
      const currentTime = dayjs().format("hh:mm:ss A");
      const currentDate = dayjs().format("YYYY-MM-DD");

      // Update state
      if (type === "TIME IN") {
        setTimeIn(currentTime);
        setTimeInLocation(location);
        captureImage("TIME IN");
      } else if (type === "TIME OUT") {
        setTimeOut(currentTime);
        setTimeOutLocation(location);
        captureImage("TIME OUT");
      } else if (type === "BREAK IN") {
        setBreakIn(currentTime);
        handleBreakIn();
      } else if (type === "BREAK OUT") {
        setBreakOut(currentTime);
      }

      console.log("Sending to API:", {
  user,
  currentDate,
  currentTime,
  location,
  type
});


      // Update API
      await upsertTimeInAPI({
        user,
        currentDate,
        currentTime,
        location,
        type
      });

      Swal.fire('Success', `${type} recorded successfully`, 'success');
      fetchDTRRecords();

    } catch (error) {
      console.error("Error during handleTimeEvent:", error);
      Swal.fire('Error', error.message || 'An error occurred', 'error');
    }
  };

  // Break handler
  const handleBreakIn = () => {
    if (onBreakStart) {
      onBreakStart();
    }
  };


  const fullDateTime = (date, time) => {
  if (!date || !time) return null;
  
  // Parse the date (YYYY-MM-DD format)
  const datePart = dayjs(date, 'YYYY-MM-DD');
  if (!datePart.isValid()) return null;

  // Parse the time (hh:mm:ss A format)
  const timePart = dayjs(time, 'hh:mm:ss A');
  if (!timePart.isValid()) return null;

  // Combine them
  return datePart
    .hour(timePart.hour())
    .minute(timePart.minute())
    .second(timePart.second())
    .format('YYYY-MM-DD HH:mm:ss');
};

  

  // API call to record time event
 const upsertTimeInAPI = async ({ user, currentDate, currentTime, location, type }) => {
  if (!user?.empNo || !currentDate || !currentTime) {
    console.error("Missing required time-in data", {
      empNo: user?.empNo,
      currentDate,
      currentTime
    });
    throw new Error("Invalid data: Missing empNo, date, or time.");
  }

  // Create payload matching backend expectations
  const eventData = {
    empNo: user.empNo,
    detail: {
      empNo: user.empNo,
      empName: user.empName || "Admin",
      date: currentDate,
      timeIn: type === "TIME IN" ? currentTime : null,
      timeInImageId: type === "TIME IN" ? timeInImage?.id : null,
      BreakIn: type === "BREAK IN" ? currentTime : null,
      BreakOut: type === "BREAK OUT" ? currentTime : null,
      timeOut: type === "TIME OUT" ? currentTime : null,
      timeOutImageId: type === "TIME OUT" ? timeOutImage?.id : null
    }
  };

  console.log("Sending eventData:", JSON.stringify(eventData, null, 2));

  try {
    const response = await fetch('https://api.nemarph.com:81/api/upsertTimeIn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API response not OK:", response.status, errorText);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log("API response:", result);

    if (result.status !== 'success') {
      console.error("API returned error status:", result);
      throw new Error(result.message || 'Failed to record time event');
    }

    return result;
  } catch (error) {
    console.error("API call failed:", error);
    throw new Error(error.message || 'An error occurred while processing the request');
  }
};

// Add this function near your other API functions
const getNewImageId = async () => {
  try {
    const response = await fetch('https://api.nemarph.com:81/api/getNewImageId', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to get new image ID');
    }

    const result = await response.json();
    return result.new_id;
  } catch (error) {
    console.error('Error getting new image ID:', error);
    throw error;
  }
};


  // Fetch DTR records
  const fetchDTRRecords = async () => {
    try {
      const response = await fetch("https://api.nemarph.com:81/api/getDTR", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user?.empNo }),
      });

      const result = await response.json();
      if (!result.success || !result.data || !Array.isArray(result.data)) {
        throw new Error(result.message || "Invalid data format received");
      }

      setFetchRecords(result.data);
    } catch (error) {
      console.error("Error fetching records:", error.message);
      setFetchRecords([]);
      setError(error.message);
    }
  };

  // Restart camera
  const restartCamera = async (type) => {
    try {
      if (type === "TIME IN") {
        if (streamRefIn.current) {
          streamRefIn.current.getTracks().forEach(track => track.stop());
        }
        setTimeInImage(null);
        setTimeIn("");
        setTimeInLocation(null);
        
        const constraints = { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRefIn.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } else if (type === "TIME OUT") {
        if (streamRefOut.current) {
          streamRefOut.current.getTracks().forEach(track => track.stop());
        }
        setTimeOutImage(null);
        setTimeOut("");
        setTimeOutLocation(null);
        
        const constraints = { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRefOut.current = stream;
        if (videoRefOut.current) videoRefOut.current.srcObject = stream;
      }
    } catch (err) {
      console.error(`Error restarting ${type} camera:`, err);
      Swal.fire('Error', `Failed to restart ${type} camera`, 'error');
    }
  };

  // Format date/time for display
  const formatDateTime = (dateTime) => {
  if (!dateTime) return "N/A";
  
  try {
    // Convert to Philippine time (UTC+8)
    const phTime = new Date(dateTime).toLocaleString("en-US", {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    return phTime;
  } catch (error) {
    console.error("Error formatting time:", error);
    return "N/A";
  }
};

  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[260px] mt-[110px] p-4 sm:p-6 bg-gray-100 min-h-screen">
      <div className="max-w-[1150px] mx-auto px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 w-full shadow-lg">
          {/* Date Section */}
          <div className="text-center sm:text-left">
            <p className="text-sm sm:text-lg font-light text-white">
              <span className="kanit-text">Today</span>
            </p>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white">
              {currentDate.format("MMMM DD, YYYY")}
            </h1>
          </div>

          {/* Time Section */}
          <div>
            <p className="text-sm text-center sm:text-left font-extrabold text-white mb-2">Philippine Standard Time:</p>
            <p className="text-xl text-center sm:text-left sm:text-4xl font-bold">{time || "00:00 PM"}</p>
          </div>

          {/* Button Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              className={`${
                timeIn
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              } text-white font-bold py-2 px-4 rounded shadow-md transition duration-300`}
              onClick={() => handleTimeEvent("TIME IN")}
              disabled={!!timeIn}
            >
              TIME IN
            </button>
            <button
              className={`${
                !timeIn
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              } text-white font-bold py-2 px-4 rounded shadow-md transition duration-300`}
              onClick={() => handleTimeEvent("TIME OUT")}
              disabled={!timeIn}
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

        {/* Content Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Time In Section */}
          <div className="flex flex-col items-center">
            <label className="mb-2 font-semibold">Time In:</label>
            <input
              type="datetime"
              className="border p-2 rounded shadow-md text-center w-full max-w-xs"
              value={timeIn}
              readOnly
            />
            
            <h2 className="text-lg font-semibold mb-4 mt-4"></h2>
            {timeInImage?.url ? (
              <img
                src={timeInImage?.url}
                alt="Time In Capture"
                className="w-full max-w-[500px] h-[400px] rounded shadow-lg object-cover"
              />
            ) : (
              <div className="relative w-full max-w-[500px] h-[400px]">
                <video
                  ref={videoRef}
                  className="w-full h-full rounded shadow-lg transform scale-x-[-1] object-cover"
                  autoPlay
                  muted
                />
                {capturing.timeIn && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-4xl font-bold">
                    {countdown.timeIn}
                  </div>
                )}
              </div>
            )}

            {/* RE-TAKE Button for Time In */}
            <button
              onClick={() => restartCamera("TIME IN")}
              className={`mt-4 py-2 px-4 rounded shadow-md transition duration-300 ${
                timeInImage ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={!timeInImage}
            >
              RE-TAKE
            </button>

            {timeInLocation && (
              <div className="mt-2 text-sm bg-gray-100 p-2 rounded w-full max-w-md">
                <p className="font-semibold">Time In Location:</p>
                <p>{timeInLocation.address.fullAddress}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Distance: {Math.round(calculateDistance(
                    timeInLocation.coordinates.latitude,
                    timeInLocation.coordinates.longitude,
                    COMPANY_LOCATION.coordinates.latitude,
                    COMPANY_LOCATION.coordinates.longitude
                  ))}m from company
                </p>
              </div>
            )}

            <div className="flex flex-col items-center mt-8 w-full">
              <label className="mb-2 font-semibold">Break In:</label>
              <input
                type="datetime"
                className="border p-2 rounded shadow-md text-center w-full max-w-xs"
                value={breakIn}
                readOnly
              />
            </div>
          </div>

          {/* Time Out Section */}
          <div className="flex flex-col items-center">
            <label className="mb-2 font-semibold">Time Out:</label>
            <input
              type="datetime"
              className="border p-2 rounded shadow-md text-center w-full max-w-xs"
              value={timeOut}
              readOnly
            />
            
            <h2 className="text-lg font-semibold mb-4 mt-4"></h2>
            {timeOutImage?.url ? (
              <img
                src={timeOutImage?.url}
                alt="Time Out Capture"
                className="w-full max-w-[500px] h-[400px] rounded shadow-lg object-cover"
              />
            ) : (
              <div className="relative w-full max-w-[500px] h-[400px]">
                {timeIn ? (
                  <video
                    ref={videoRefOut}
                    className="w-full h-full rounded shadow-lg transform scale-x-[-1] object-cover"
                    autoPlay
                    muted
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300 rounded shadow-lg">
                    <p className="text-gray-500">Complete Time In first</p>
                  </div>
                )}
                {capturing.timeOut && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-4xl font-bold">
                    {countdown.timeOut}
                  </div>
                )}
              </div>
            )}

            {/* RE-TAKE Button for Time Out */}
            <button
              onClick={() => restartCamera("TIME OUT")}
              className={`mt-4 py-2 px-4 rounded shadow-md transition duration-300 ${
                timeOutImage ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={!timeOutImage}
            >
              RE-TAKE
            </button>

            {timeOutLocation && (
              <div className="mt-2 text-sm bg-gray-100 p-2 rounded w-full max-w-md">
                <p className="font-semibold">Time Out Location:</p>
                <p>{timeOutLocation.address.fullAddress}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Distance: {Math.round(calculateDistance(
                    timeOutLocation.coordinates.latitude,
                    timeOutLocation.coordinates.longitude,
                    COMPANY_LOCATION.coordinates.latitude,
                    COMPANY_LOCATION.coordinates.longitude
                  ))}m from company
                </p>
              </div>
            )}

            <div className="flex flex-col items-center mt-8 w-full">
              <label className="mb-2 font-semibold">Break Out:</label>
              <input
                type="datetime"
                className="border p-2 rounded shadow-md text-center w-full max-w-xs"
                value={breakOut}
                readOnly
              />
            </div>
          </div>
        </div>
        
        {/* Hidden Canvas for Image Capture */}
        <canvas ref={canvasRef} width="300" height="200" style={{ display: "none" }}></canvas>
        
        {/* Timekeeping History Table */}
        <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <h2 className="text-lg font-semibold mb-4">DTR History</h2>
          
          {error && <p className="text-red-500 text-center">{error}</p>}
          
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-center border">
  <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-300 to-purple-300 text-black">
    <tr>
      <th className="px-4 py-2">Date</th>
      <th className="px-4 py-2">Time In</th>
      <th className="px-4 py-2">Time Out</th>
      <th className="px-4 py-2">Break In</th>
      <th className="px-4 py-2">Break Out</th>
    </tr>
  </thead>
  <tbody className="global-tbody">
    {fetchRecords.length > 0 ? (
      fetchRecords.map((record, index) => (
        <tr key={index} className="global-tr">
          <td className="px-4 py-2 border">{dayjs(record.trandate).format("MM/DD/YYYY")}</td>
          <td className="px-4 py-2 border">{formatDateTime(record.time_in)}</td>
          <td className="px-4 py-2 border">{formatDateTime(record.time_out)}</td>
          <td className="px-4 py-2 border">{formatDateTime(record.break_in)}</td>
          <td className="px-4 py-2 border">{formatDateTime(record.break_out)}</td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
          No Daily Time Record found.
        </td>
      </tr>
    )}
  </tbody>
</table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timekeeping;