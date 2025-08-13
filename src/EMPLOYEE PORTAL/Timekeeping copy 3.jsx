import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from 'axios';
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Assuming AuthContext provides user data
import * as faceapi from 'face-api.js';

const API_BASE_URL = 'http://localhost:8000';
const API_ENDPOINTS = {
  upsertTimeIn: `${API_BASE_URL}/api/upsertTimeIn`,
  saveImage: `${API_BASE_URL}/api/saveImage`,
  getNewImageId: `${API_BASE_URL}/api/getNewImageId`,
  getDTRRecords: `${API_BASE_URL}/api/dtrRecords`,
};

// Company location details for geo-fencing
const COMPANY_LOCATION = {
  address: "7th Floor Vernida 1 Building, 120 Amorsolo Street, Legazpi Village, Makati City, Metro Manila, Philippines",
  coordinates: {
    latitude: 14.5560416,
    longitude: 121.0148294
  },
  allowedRadius: 500 // meters
};

const Timekeeping = () => {
  const { user } = useAuth();

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // State
  const [faceDetectionModelLoaded, setFaceDetectionModelLoaded] = useState(false);
  const [currentUserFaceDescriptor, setCurrentUserFaceDescriptor] = useState(null);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [time, setTime] = useState("");
  const [records, setRecords] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [locationAddress, setLocationAddress] = useState("");
  const [todayRecord, setTodayRecord] = useState(null);
  const [livenessInstruction, setLivenessInstruction] = useState("");


  // --- Geo-location Helpers ---
  const getUserLocation = useCallback(() =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (err) => reject(new Error(`Location access denied. Code: ${err.code}`)),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }), []);

  const reverseGeocode = useCallback(async (lat, lon) => {
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: { lat, lon, format: "json" }
      });
      return response.data.display_name || "Unknown location";
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
      return "Unknown location";
    }
  }, []);

  const isWithinRadius = (lat1, lon1, lat2, lon2, radiusMeters) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c <= radiusMeters;
  };


  // --- Liveness Detection & Face Verification ---
  const trackFaceMovement = useCallback(async (videoElement) => {
    // Simplified Liveness check: ensure a face is detected and it moves slightly.
    const results = await Promise.all([
      faceapi.detectSingleFace(videoElement).withFaceLandmarks(),
      new Promise(resolve => setTimeout(resolve, 300)).then(() => faceapi.detectSingleFace(videoElement).withFaceLandmarks())
    ]);

    const [result1, result2] = results;

    if (!result1 || !result2) {
      setLivenessInstruction("No face detected. Please face the camera.");
      return false;
    }

    const distance = faceapi.euclideanDistance(result1.landmarks.positions, result2.landmarks.positions);

    if (distance > 5) { // A small threshold for movement
      setLivenessInstruction("✅ Liveness check passed!");
      return true;
    } else {
      setLivenessInstruction("❌ Please move your head slightly.");
      return false;
    }
  }, []);

  const verifyFace = useCallback(async (imageDataUrl) => {
    if (!faceDetectionModelLoaded || !currentUserFaceDescriptor) {
      throw new Error("Face models or your reference data not loaded.");
    }
    const img = await faceapi.fetchImage(imageDataUrl);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      throw new Error("No face detected in the captured image.");
    }
    const faceMatcher = new faceapi.FaceMatcher(currentUserFaceDescriptor, 0.4);
    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

    if (bestMatch.distance > 0.4) {
      throw new Error("Face does not match your registered profile.");
    }
    return true;
  }, [faceDetectionModelLoaded, currentUserFaceDescriptor]);

  const saveCapturedFaceImage = useCallback(async (imageDataUrl, imageId) => {
    const response = await axios.post(API_ENDPOINTS.saveImage, {
      imageId: imageId,
      imageData: imageDataUrl,
    });
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to save image on server.');
    }
    return { id: imageId, path: response.data.path };
  }, []);


  // --- Main Timekeeping Logic ---
  const handleTimeEvent = async (type) => {
    if (!user?.empNo || capturing) return;

    setCapturing(true);
    Swal.fire({
      title: `Processing your ${type} request...`,
      text: "Please look at the camera. Verifying your location and identity.",
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // Step 1: Get location and reverse geocode
      const userCoords = await getUserLocation();
      const address = await reverseGeocode(userCoords.latitude, userCoords.longitude);
      setLocationAddress(address);

      if (!isWithinRadius(userCoords.latitude, userCoords.longitude, COMPANY_LOCATION.coordinates.latitude, COMPANY_LOCATION.coordinates.longitude, COMPANY_LOCATION.allowedRadius)) {
        throw new Error("You are not within the allowed office location.");
      }

      // Step 2: Liveness check and capture
      Swal.update({ title: "Checking for liveness..." });
      const isLive = await trackFaceMovement(videoRef.current);
      if (!isLive) throw new Error("Liveness check failed. Please move your head.");
      
      Swal.update({ title: "Capturing image..." });
      const ctx = canvasRef.current.getContext("2d");
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, -canvasRef.current.width, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.restore();
      const imageDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.92);

      // Step 3: Face verification
      Swal.update({ title: "Verifying face..." });
      await verifyFace(imageDataUrl);

      // Step 4: Save image and get ID
      Swal.update({ title: "Saving image..." });
      const newImageId = await axios.get(API_ENDPOINTS.getNewImageId).then(res => res.data.id);
      const savedImageInfo = await saveCapturedFaceImage(imageDataUrl, newImageId);

      // Step 5: Send data to backend
      Swal.update({ title: "Submitting record..." });
      const eventData = [{
        empNo: user.empNo,
        detail: {
          date: dayjs().format("YYYY-MM-DD"),
          timeIn: type === "TIME IN" ? dayjs().format("HH:mm:ss") : null,
          timeOut: type === "TIME OUT" ? dayjs().format("HH:mm:ss") : null,
          breakIn: type === "BREAK IN" ? dayjs().format("HH:mm:ss") : null,
          breakOut: type === "BREAK OUT" ? dayjs().format("HH:mm:ss") : null,
          imageId: savedImageInfo.id,
          imagePath: savedImageInfo.path,
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          locationAddress: address,
        },
      }];
      const response = await axios.post(API_ENDPOINTS.upsertTimeIn, eventData);

      if (response.data.status === "success") {
        Swal.fire("Success", `${type} recorded successfully!`, "success");
        fetchDTRRecords();
      } else {
        throw new Error(response.data.message || `Failed to record ${type}.`);
      }
    } catch (err) {
      Swal.fire("Error", err.message || "An unexpected error occurred.", "error");
    } finally {
      setCapturing(false);
    }
  };


  // --- Data Fetching ---
  const fetchDTRRecords = useCallback(async () => {
    if (!user?.empNo) return;
    try {
      const response = await axios.get(`${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${dayjs().format("YYYY-MM-DD")}`);
      if (response.data.success) {
        setRecords(response.data.records);
        const today = response.data.records.find(r => r.date === dayjs().format("YYYY-MM-DD"));
        setTodayRecord(today);
      }
    } catch (error) {
      console.error("Error fetching DTR records:", error);
    }
  }, [user?.empNo]);


  // --- Effects ---
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setFaceDetectionModelLoaded(true);
        console.log("✅ Face-API.js models loaded successfully");
      } catch (error) {
        console.error("❌ Model loading error:", error);
        Swal.fire("Error", "Face detection models failed to load.", "error");
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    const loadCurrentUserDescriptor = async () => {
      if (!user?.empNo || !faceDetectionModelLoaded) return;
      const imageUrl = `/images/${user.empNo}.jpg`;
      try {
        const img = await faceapi.fetchImage(imageUrl);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        if (detection) setCurrentUserFaceDescriptor(detection.descriptor);
        else Swal.fire("Warning", "No registered face found for your profile.", "warning");
      } catch (err) {
        console.error(`Error loading reference image for ${user.empNo}:`, err);
        Swal.fire("Error", "Failed to load your face reference data.", "error");
      }
    };
    loadCurrentUserDescriptor();
  }, [user?.empNo, faceDetectionModelLoaded]);

  useEffect(() => {
    const initCamera = async () => {
      if (!faceDetectionModelLoaded) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        streamRef.current = stream;
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
        Swal.fire("Camera Error", "Could not access webcam.", "error");
      }
    };
    initCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [faceDetectionModelLoaded]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(dayjs());
      setTime(dayjs().format("hh:mm:ss A"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchDTRRecords();
  }, [fetchDTRRecords]);


  // --- UI Rendering ---
  return (
    <div className="ml-0 lg:ml-[200px] mt-[70px] p-4 sm:p-6 bg-gray-100 min-h-screen flex flex-col items-center">
      <div className="bg-blue-800 p-3 rounded-lg text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 w-full shadow-lg">
        <div className="text-center sm:text-left">
          <p className="text-sm sm:text-lg font-light kanit-text">Today</p>
          <h1 className="text-base sm:text-lg md:text-2xl font-extrabold">{currentTime.format("MMMM DD, YYYY")}</h1>
        </div>
        <div className="text-center sm:text-left">
          <p className="text-xs font-extrabold mb-2">Philippine Standard Time</p>
          <p className="text-lg sm:text-2xl font-bold">{time || "00:00 PM"}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-center gap-6 w-full">
        {/* Camera and Controls Panel */}
        <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-md flex-1">
          <div className="relative w-full max-w-[320px] mb-4">
            <video ref={videoRef} width={320} height={240} autoPlay playsInline muted className="bg-black rounded-lg w-full" />
            <canvas ref={canvasRef} width={320} height={240} className="hidden" />
            {capturing && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-white text-3xl font-bold rounded-lg">
                {countdown > 0 ? countdown : "📸"}
              </div>
            )}
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">{livenessInstruction}</p>
          <div className="w-full grid grid-cols-2 gap-4">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("TIME IN")}
              disabled={capturing || !faceDetectionModelLoaded || todayRecord?.time_in}
            >
              Time In
            </button>
            <button
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("BREAK IN")}
              disabled={capturing || !todayRecord?.time_in || todayRecord?.break_in}
            >
              Break In
            </button>
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("BREAK OUT")}
              disabled={capturing || !todayRecord?.break_in || todayRecord?.break_out}
            >
              Break Out
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("TIME OUT")}
              disabled={capturing || !todayRecord?.time_in || todayRecord?.time_out}
            >
              Time Out
            </button>
          </div>
        </div>

        {/* Today's Record Summary Panel */}
        <div className="w-full md:w-1/3 p-4 bg-white rounded-lg shadow-md flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold mb-4">Today's Summary</h2>
            <p className="text-gray-700 text-base mb-2">
              <span className="font-semibold">Time In:</span> {todayRecord?.time_in ? dayjs(todayRecord.time_in).format("hh:mm:ss A") : "Not Recorded"}
            </p>
            <p className="text-gray-700 text-base mb-2">
              <span className="font-semibold">Time Out:</span> {todayRecord?.time_out ? dayjs(todayRecord.time_out).format("hh:mm:ss A") : "Not Recorded"}
            </p>
            <p className="text-gray-700 text-base mb-2">
              <span className="font-semibold">Break In:</span> {todayRecord?.break_in ? dayjs(todayRecord.break_in).format("hh:mm:ss A") : "Not Recorded"}
            </p>
            <p className="text-gray-700 text-base mb-2">
              <span className="font-semibold">Break Out:</span> {todayRecord?.break_out ? dayjs(todayRecord.break_out).format("hh:mm:ss A") : "Not Recorded"}
            </p>
          </div>
          <div className="mt-4">
            <p className="text-gray-600 text-sm">📍 Current Location:</p>
            <p className="text-gray-800 text-sm font-semibold">{locationAddress || "Awaiting location..."}</p>
          </div>
        </div>
      </div>

      {/* Daily Time Record Table */}
      {records.length > 0 && (
        <div className="mt-8 p-4 bg-white rounded-lg shadow-md overflow-x-auto w-full">
          <h2 className="text-xl font-bold mb-4">Daily Time Record History</h2>
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-2 text-left text-xs md:text-sm">Date</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Time In</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Time In Capture</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Time In Address</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Time Out</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Time Out Capture</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Time Out Address</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Break In</th>
                <th className="px-2 py-2 text-left text-xs md:text-sm">Break Out</th>
                <th className="px-2 py-2 text-right text-xs md:text-sm">Worked Hours</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={index} className="border-b">
                  <td className="px-2 py-1 text-xs">{dayjs(record.date).format("MM/DD/YYYY")}</td>
                  <td className="px-2 py-1 text-xs">{record.time_in ? dayjs(record.time_in).format("hh:mm A") : "N/A"}</td>
                   <td className="px-2 py-1 text-xs">
                  {record.time_in_image_id && (
                    <img
                      src={`http://localhost:8000/storage/timekeeping_images/${record.time_in_image_id}.jpeg`}
                      alt="Time In"
                      className="rounded-md"
                      style={{ width: "90px", height: "80px" }}
                    />
                  )}
                </td>
                  <td className="px-2 py-1 text-xs">{record.time_in_address || "N/A"}</td>

                  <td className="px-2 py-1 text-xs">{record.time_out ? dayjs(record.time_out).format("hh:mm A") : "N/A"}</td>
                <td className="px-2 py-1 text-xs">
                  {record.time_out_image_id && (
                    <img
                      src={`http://localhost:8000/storage/timekeeping_images/${record.time_out_image_id}.jpeg`}
                      alt="Time In"
                      className="rounded-md"
                      style={{ width: "90px", height: "80px" }}
                    />
                  )}
                </td>
                
                  <td className="px-2 py-1 text-xs">{record.time_OUT_address || "N/A"}</td>
                  <td className="px-2 py-1 text-xs">{record.break_in ? dayjs(record.break_in).format("hh:mm A") : "N/A"}</td>
                  <td className="px-2 py-1 text-xs">{record.break_out ? dayjs(record.break_out).format("hh:mm A") : "N/A"}</td>
                  <td className="px-2 py-1 text-xs text-right">
                    {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0"}
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