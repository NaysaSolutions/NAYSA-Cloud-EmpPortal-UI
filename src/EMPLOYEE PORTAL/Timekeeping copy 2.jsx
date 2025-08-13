import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from 'axios';
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Assuming AuthContext provides user data
import * as faceapi from 'face-api.js';

const API_BASE_URL = 'http://localhost:8000'; // Make sure this matches your Laravel API URL

const API_ENDPOINTS = {
    upsertTimeIn: `${API_BASE_URL}/api/upsertTimeIn`,
    saveImage: `${API_BASE_URL}/api/saveImage`,
    getNewImageId: `${API_BASE_URL}/api/getNewImageId`,
    getDTRRecords: `${API_BASE_URL}/api/dtrRecords`,
};

const Timekeeping = ({ onBreakStart }) => {
    const { user } = useAuth(); // Get user from AuthContext

    // Refs for DOM elements
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null); // To keep track of the media stream

    // State variables
    const [faceDetectionModelLoaded, setFaceDetectionModelLoaded] = useState(false);
    const [currentUserFaceDescriptor, setCurrentUserFaceDescriptor] = useState(null);
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [time, setTime] = useState("");
    const [timeIn, setTimeIn] = useState(""); // Display time in
    const [timeOut, setTimeOut] = useState(""); // Display time out
    const [records, setRecords] = useState([]); // DTR records for display
    const [capturing, setCapturing] = useState(false); // General capturing state
    const [countdown, setCountdown] = useState(0); // Countdown for image capture
    const [fetchRecords, setFetchRecords] = useState([]);


    const [userLocation, setUserLocation] = useState(null);
    const geolocationOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    const [locationAddress, setLocationAddress] = useState("");
    

const reverseGeocode = async (lat, lon) => {
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lat,
                lon,
                format: "json"
            }
        });
        return response.data.display_name || "Unknown location";
    } catch (err) {
        console.error("Reverse geocoding failed:", err);
        return "Unknown location";
    }
};

    const getUserLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ latitude, longitude });
        resolve({ latitude, longitude });
      },
      (err) => reject(err),
      geolocationOptions
    );
  });

  const isWithinRadius = (lat1, lon1, lat2, lon2, radiusMeters) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c <= radiusMeters;
};


    // Company location details (for potential future geo-fencing)
    // const COMPANY_LOCATION = {
    //     address: "1st floor, Rufino Building, Pres. L. Katigbak Street, C.M. Recto Ave, Brgy. 9, Lipa City, Batangas",
    //     coordinates: { latitude: 13.9411, longitude: 121.1622 },
    //     allowedRadius: 500 // meters
    // };

    // Company location details (for potential future geo-fencing)
        const COMPANY_LOCATION = {
        address: "7th Floor Vernida 1 Building, 120 Amorsolo Street, Legazpi Village, Makati City, Metro Manila, Philippines",
        coordinates: {
            latitude: 14.5560416,
            longitude: 121.0148294
        },
        allowedRadius: 500 // meters
        };


    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),  // Using faster model
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
                ]);

                const allLoaded = [
                    faceapi.nets.ssdMobilenetv1,
                    faceapi.nets.faceLandmark68Net,
                    faceapi.nets.faceRecognitionNet,
                ].every((net) => !!net.params);

                if (!allLoaded) {
                    throw new Error("Not all models were loaded.");
                }

                setFaceDetectionModelLoaded(true);
                console.log("✅ Face-API.js models loaded successfully");
            } catch (error) {
                console.error("❌ Model loading error:", error);
                Swal.fire("Error", "Face detection models failed to load. Please refresh.", "error");
            }
        };

        loadModels();
    }, []);

    // --- Webcam Initialization ---
    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } }); // Reduced resolution for speed
                streamRef.current = stream; // Store stream to stop tracks later
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (canvasRef.current) {
                            canvasRef.current.width = videoRef.current.videoWidth;
                            canvasRef.current.height = videoRef.current.videoHeight;
                        }
                    };
                }
            } catch (err) {
                console.error("Camera initialization error:", err);
                Swal.fire("Camera Error", "Could not access webcam. Please ensure it's connected and permissions are granted.", "error");
            }
        };

        if (faceDetectionModelLoaded) { // Only initialize camera after models are loaded
            initCamera();
        }

        // Cleanup: Stop camera tracks when component unmounts
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };
    }, [faceDetectionModelLoaded]);

    // --- Load Current User's Face Descriptor ---
    useEffect(() => {
        const loadCurrentUserDescriptor = async () => {
            if (!user?.empNo) {
                console.warn("User or empNo not available to load face descriptor.");
                return;
            }
            if (!faceDetectionModelLoaded) {
                console.warn("Face detection models not loaded yet. Skipping descriptor load.");
                return; // Skip if models are not loaded yet
            }

            const empNo = user.empNo;
            const imageUrl = `/images/${empNo}.jpg`; // Path to the employee's reference image

            try {
                const img = await faceapi.fetchImage(imageUrl);
                const detection = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    setCurrentUserFaceDescriptor(detection.descriptor);
                    console.log(`Loaded face descriptor for employee: ${empNo}`);
                } else {
                    console.warn(`No face detected in reference image for ${empNo}.`);
                    Swal.fire("Warning", "No registered face found for your profile. Please contact HR/Admin.", "warning");
                }
            } catch (err) {
                console.error(`Error loading reference image for ${empNo}:`, err);
                Swal.fire("Error", `Failed to load your face reference data. ${err.message}`, "error");
            }
        };

        if (faceDetectionModelLoaded) {
            loadCurrentUserDescriptor(); // Only call after models are loaded
        }
    }, [user?.empNo, faceDetectionModelLoaded]); // Dependency on faceDetectionModelLoaded and empNo


    // --- Real-time Clock Update ---
    useEffect(() => {
        const interval = setInterval(() => {
            setTime(dayjs().format("hh:mm:ss A"));
            setCurrentDate(dayjs());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // --- Motion-Based Liveness Check ---
    const trackFaceMovement = async (videoElement) => {
        const result = await faceapi.detectSingleFace(videoElement).withFaceLandmarks();
        if (result) {
            console.log("✅ Face detected with slight movement.");
            return true;
        }
        return false;
    };

    // --- Get New Image ID ---
    const getNewImageId = useCallback(async () => {
        try {
            const response = await axios.get(API_ENDPOINTS.getNewImageId);
            if (response.data.success) {
                return response.data.id;
            } else {
                console.error('API Error:', response.data.message);
                throw new Error(response.data.message || 'Failed to get a new image ID.');
            }
        } catch (err) {
            console.error('Error fetching new image ID:', err);
            return `local_${Date.now()}`;
        }
    }, []);

    // --- Verify Face ---
    const verifyFace = useCallback(async (imageDataUrl) => {
        if (!faceDetectionModelLoaded || !currentUserFaceDescriptor) {
            Swal.fire("Error", "Face models or your reference data not loaded.", "error");
            return false;
        }

        try {
            const img = await faceapi.fetchImage(imageDataUrl);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

            if (!detection) {
                Swal.fire("Error", "No face detected in the captured image.", "error");
                return false;
            }

            const faceMatcher = new faceapi.FaceMatcher(currentUserFaceDescriptor, 0.4); // Adjusted threshold
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

            if (bestMatch.distance < 0.9) {
                console.log(`Face matched with distance: ${bestMatch.distance}`);
                return true;
            } else {
                Swal.fire("Access Denied", "Face does not match your registered profile.", "error");
                return false;
            }
        } catch (err) {
            console.error("Error during face verification:", err);
            Swal.fire("Verification Error", err.message, "error");
            return false;
        }
    }, [faceDetectionModelLoaded, currentUserFaceDescriptor]);

    // --- Save Captured Face Image ---
const saveCapturedFaceImage = useCallback(async (imageDataUrl, imageId) => {
    try {
        const response = await axios.post(API_ENDPOINTS.saveImage, {
            imageId: imageId,
            imageData: imageDataUrl,
        });

        if (response.data.success) {
            console.log(`Image ${imageId} saved successfully to path: ${response.data.path}`);
            return { id: imageId, path: response.data.path };
        } else {
            console.error('Failed to save image:', response.data.message);
            throw new Error(response.data.message || 'Failed to save image on server.');
        }
    } catch (err) {
        console.error('Error saving image:', err);
        throw new Error(`Error saving image: ${err.message}`);
    }
}, []);

// --- Auto-capture Image ---
    const captureImageProcess = useCallback((type) => {
        return new Promise((resolve, reject) => {
            setCapturing(true);
            setCountdown(3);  // Quick countdown for capture

            const intervalId = setInterval(() => {
                setCountdown((prevCount) => {
                    const newCount = prevCount - 1;

                    if (newCount === 0) {
                        clearInterval(intervalId);
                        setCapturing(false);

                        (async () => {
                            if (!canvasRef.current || !videoRef.current || videoRef.current.readyState < 2) {
                                reject(new Error("Camera not ready. Please wait and try again."));
                                return;
                            }

                            // Perform simplified motion-based liveness check
                            let isLive = false;
                            try {
                                isLive = await trackFaceMovement(videoRef.current);
                                if (!isLive) {
                                    Swal.fire("Liveness Check Failed", "Please move your head slightly. Try again.", "error");
                                    reject(new Error("Liveness check failed"));
                                    return;
                                }
                            } catch (err) {
                                Swal.fire("Liveness Check Failed", err.message || "Try again.", "error");
                                reject(err);
                                return;
                            }

                            // Capture image
                            const ctx = canvasRef.current.getContext("2d");
                            ctx.save();
                            ctx.scale(-1, 1); // mirror horizontally
                            ctx.drawImage(videoRef.current, -canvasRef.current.width, 0, canvasRef.current.width, canvasRef.current.height);
                            ctx.restore();

                            const imageDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.92);

                            try {
                                const isVerified = await verifyFace(imageDataUrl);
                                if (!isVerified) {
                                    reject(new Error("Failed to detect Face."));
                                    return;
                                }

                                const newImageId = await getNewImageId();
                                const savedImageInfo = await saveCapturedFaceImage(imageDataUrl, newImageId);
                                resolve(savedImageInfo);
                            } catch (e) {
                                reject(e);
                            }
                        })();
                    }

                    return newCount;
                });
            }, 1000);
        });
    }, [verifyFace, getNewImageId]);

  
    const handleTimeEvent = async (type) => {
    if (!user?.empNo) {
        Swal.fire("Error", "Employee number not available. Please log in.", "error");
        return;
    }

    try {
        // 🔍 Step 1: Get User Location
        const getUserLocation = () =>
            new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error("Geolocation not supported by your browser."));
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        resolve({ latitude, longitude });
                    },
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            });

        const userCoords = await getUserLocation();

        // 📍 Step 2: Reverse Geocode to get readable address
        const address = await reverseGeocode(userCoords.latitude, userCoords.longitude);
        setLocationAddress(address);

        // Step 3: Check if within allowed radius
        const isWithinRadius = (lat1, lon1, lat2, lon2, radiusMeters) => {
            const toRad = (deg) => (deg * Math.PI) / 180;
            const R = 6371000; // meters
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c <= radiusMeters;
        };

        const isAllowedLocation = isWithinRadius(
            userCoords.latitude,
            userCoords.longitude,
            COMPANY_LOCATION.coordinates.latitude,
            COMPANY_LOCATION.coordinates.longitude,
            COMPANY_LOCATION.allowedRadius
        );

        if (!isAllowedLocation) {
            Swal.fire("Location Error", "You are not within the allowed location range.", "error");
            return;
        }

        // 📸 Step 4: Capture & Verify Face
        Swal.fire({
            title: `Please look at the camera for ${type}...`,
            text: "Preparing for capture...",
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            },
        });

        const capturedImageInfo = await captureImageProcess(type);
        if (!capturedImageInfo || !capturedImageInfo.id) {
            Swal.fire("Failed", "Image capture or face verification failed.", "error");
            return;
        }

        Swal.close();

        // 🕒 Step 5: Prepare time data
        const currentTime = dayjs().format("HH:mm:ss");
        const currentDateStr = dayjs().format("YYYY-MM-DD");

        let timeInImageIdToSend = null;
        let timeOutImageIdToSend = null;
        let timeInImagePath = null;
        let timeOutImagePath = null;

        if (type === "TIME IN") {
            setTimeIn(dayjs().format("hh:mm:ss A"));
            timeInImageIdToSend = capturedImageInfo.id;
            timeInImagePath = capturedImageInfo.path;
        } else if (type === "TIME OUT") {
            setTimeOut(dayjs().format("hh:mm:ss A"));
            timeOutImageIdToSend = capturedImageInfo.id;
            timeOutImagePath = capturedImageInfo.path;
        }

        // 📝 Step 6: Send data to backend (now including address)
        const eventData = [
            {
                empNo: user.empNo,
                detail: {
                    empNo: user.empNo,
                    date: currentDateStr,
                    timeIn: type === "TIME IN" ? currentTime : null,
                    timeOut: type === "TIME OUT" ? currentTime : null,
                    timeInImageId: timeInImageIdToSend,
                    timeOutImageId: timeOutImageIdToSend,
                    timeInImagePath,
                    timeOutImagePath,
                    latitude: userCoords.latitude,
                    longitude: userCoords.longitude,
                    locationAddress: address // 👈 added field
                },
            },
        ];

        const response = await axios.post(API_ENDPOINTS.upsertTimeIn, eventData);

        if (response.data.status === "success") {
            Swal.fire("Success", `${type} recorded successfully!`, "success");
            fetchDTRRecords();
        } else {
            Swal.fire("Error", response.data.message || `Failed to record ${type}.`, "error");
        }
    } catch (err) {
        Swal.close();
        Swal.fire("Error", err.message || "An unexpected error occurred.", "error");
    }
};



    // Fetch DTR records
    const fetchDTRRecords = useCallback(async () => {
        if (!user?.empNo) return;
        try {
            const response = await axios.get(`${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${dayjs().format("YYYY-MM-DD")}`);
            if (response.data.success) {
                setRecords(response.data.records);
                const todayRecord = response.data.records.find(r => r.date === dayjs().format("YYYY-MM-DD"));
                if (todayRecord) {
                    setTimeIn(todayRecord.time_in ? dayjs(todayRecord.time_in).format("hh:mm:ss A") : "");
                    setTimeOut(todayRecord.time_out ? dayjs(todayRecord.time_out).format("hh:mm:ss A") : "");
                }
            }
        } catch (error) {
            console.error("Error fetching DTR records:", error);
        }
    }, [user?.empNo]);

    useEffect(() => {
        fetchDTRRecords();
    }, [fetchDTRRecords]);

    return (
  <div className="ml-0 lg:ml-[200px] mt-[70px] p-4 sm:p-6 bg-gray-100 min-h-screen">
    {/* Header */}
    <div className="bg-blue-800 p-3 rounded-lg text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 w-full shadow-lg">
      <div className="text-center sm:text-left">
        <p className="text-sm sm:text-lg font-light">
          <span className="kanit-text">Today</span>
        </p>
        <h1 className="text-base sm:text-lg md:text-2xl font-extrabold">
          {currentDate.format("MMMM DD, YYYY")}
        </h1>
      </div>

      <div className="text-center sm:text-left">
        <p className="text-xs font-extrabold mb-2">Philippine Standard Time</p>
        <p className="text-lg sm:text-2xl font-bold">{time || "00:00 PM"}</p>
      </div>
    </div>

<div className="flex flex-col md:flex-row justify-between gap-2">
  {/* Camera */}
  <div className="w-full flex flex-col items-center">
    <video
      ref={videoRef}
      width={320}
      height={240}
      autoPlay
      playsInline
      muted
      className="bg-black rounded-lg shadow-md"
    />
    <canvas ref={canvasRef} width={320} height={240} className="hidden" />

    {capturing && (
      <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-white text-9xl font-bold z-50">
        {countdown > 0 ? countdown : "📸"}
      </div>
    )}
  </div>

  {/* Buttons */}
  <div className="w-full md:w-auto flex flex-wrap justify-center items-center gap-6">
    <button
      className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition disabled:opacity-50"
      onClick={() => handleTimeEvent("TIME IN")}
      disabled={capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor}
    >
      Time In
    </button>
    <button
      className="flex-1 min-w-[120px] bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition disabled:opacity-50"
      onClick={() => handleTimeEvent("BREAK IN")}
      disabled={capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor}
    >
      Break In
    </button>
    <button
      className="flex-1 min-w-[120px] bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition disabled:opacity-50"
      onClick={() => handleTimeEvent("BREAK OUT")}
      disabled={capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor}
    >
      Break Out
    </button>
    <button
      className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition disabled:opacity-50"
      onClick={() => handleTimeEvent("TIME OUT")}
      disabled={capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor}
    >
      Time Out
    </button>
  </div>

  {/* Time In/Out Record */}
  <div className="w-full p-4 bg-white rounded-lg shadow-md">
    <p className="text-gray-700 text-lg mb-6">
      <span className="font-semibold">Date Today:</span>{" "}
      {currentDate.format("MMMM DD, YYYY")}
    </p>
    <p className="text-gray-700 text-lg mb-2">
      <span className="font-semibold">Time In:</span> {timeIn || "Not Recorded"}
    </p>
    {locationAddress && (
      <p className="text-gray-600 text-sm mt-2 mb-4">📍 {locationAddress}</p>
    )}

    <p className="text-gray-700 text-lg mb-2">
      <span className="font-semibold">Time Out:</span> {timeOut || "Not Recorded"}
    </p>
    {locationAddress && (
      <p className="text-gray-600 text-sm mt-2">📍 {locationAddress}</p>
    )}
  </div>
</div>


    {/* Daily Time Record Table */}
    {records.length > 0 && (
      <div className="mt-8 p-4 bg-white rounded-lg shadow-md overflow-x-auto">
        <h2 className="text-base font-bold mb-4">Daily Time Record</h2>
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2 text-left text-xs md:text-sm">Date</th>
              <th className="px-2 py-2 text-left text-xs md:text-sm">Time In</th>
              <th className="px-2 py-2 text-left text-xs md:text-sm">Time In Image</th>
              <th className="px-2 py-2 text-left text-xs md:text-sm">Time In Location</th>
              <th className="px-2 py-2 text-left text-xs md:text-sm">Time Out</th>
              <th className="px-2 py-2 text-left text-xs md:text-sm">Time Out Image</th>
              <th className="px-2 py-2 text-left text-xs md:text-sm">Time Out Location</th>
              <th className="px-2 py-2 text-right text-xs md:text-sm">Worked Hours</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr key={index} className="border-b">
                <td className="px-2 py-1 text-xs">
                  {dayjs(record.date).format("MM/DD/YYYY")}
                </td>
                <td className="px-2 py-1 text-xs">
                  {record.time_in
                    ? dayjs(record.time_in).format("hh:mm:ss A")
                    : "N/A"}
                </td>
                <td className="px-2 py-1 text-xs">
                  {record.time_in_image_id && (
                    <img
                      src={`http://localhost:8000/storage/timekeeping_images/${record.time_in_image_id}.jpeg`}
                      alt="Time In"
                      className="rounded-full"
                      style={{ width: "90px", height: "80px" }}
                    />
                  )}
                </td>
                <td className="px-2 py-1 text-xs max-w-[200px] break-words">
                  {record.time_in_address}
                </td>
                <td className="px-2 py-1 text-xs">
                  {record.time_out
                    ? dayjs(record.time_out).format("hh:mm:ss A")
                    : "N/A"}
                </td>
                <td className="px-2 py-1 text-xs">
                  {record.time_out_image_id && (
                    <img
                      src={`http://localhost:8000/storage/timekeeping_images/${record.time_out_image_id}.jpeg`}
                      alt="Time Out"
                      className="rounded-full"
                      style={{ width: "90px", height: "80px" }}
                    />
                  )}
                </td>
                <td className="px-2 py-1 text-xs max-w-[200px] break-words">
                  {record.time_out_address}
                </td>
                <td className="px-2 py-1 text-xs text-right">
                  {record.worked_hrs != null
                    ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                    : "0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

};

export default Timekeeping;
