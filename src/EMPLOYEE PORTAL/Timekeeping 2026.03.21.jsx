import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from 'axios';

import dayjs from "dayjs";
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

import Swal from "sweetalert2";
import { useAuth } from "./AuthContext"; // Assuming AuthContext provides user data
import * as faceapi from 'face-api.js';
import API_ENDPOINTS, { IMAGE_BASE_URL ,  MODEL_BASE_URL } from "@/apiConfig.jsx";
import fetchApi from '@/fetchApi.js'; // Assuming the utility is in the same directory
import { ChevronDown, ChevronUp, Calendar, Clock, MapPin, Camera, Download, Image as ImageIcon } from 'lucide-react';

import { useNavigate } from "react-router-dom";

export const upsertTimeIn = (data) => fetchApi(API_ENDPOINTS.upsertTimeIn, 'POST', data);
export const saveImage = (data) => fetchApi(API_ENDPOINTS.saveImage, 'POST', data);
export const getNewImageId = (data) => fetchApi(API_ENDPOINTS.getNewImageId, 'POST', data);
export const getDTRRecords = (data) => fetchApi(API_ENDPOINTS.getDTRRecords, 'POST', data);
export const getEmpBranchLoc = (empNo) => fetchApi(`${API_ENDPOINTS.getEmpBranchLoc}/${empNo}`, 'GET');

const Timekeeping = ({ onBreakStart }) => {
    const { user } = useAuth(); // Get user from AuthContext

    // Add these at the top of your Timekeeping component
    const [isLocationRequired, setIsLocationRequired] = useState(true); // <-- SWITCH 1
    const [isImageCaptureRequired, setIsImageCaptureRequired] = useState(true); // <-- SWITCH 2

    // Refs for DOM elements
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null); // To keep track of the media stream

    // State variables
    const [faceDetectionModelLoaded, setFaceDetectionModelLoaded] = useState(false);
    const [currentUserFaceDescriptor, setCurrentUserFaceDescriptor] = useState(null);
    const [currentUserFaceMatcher, setCurrentUserFaceMatcher] = useState(null);
    const [registeredFaceCount, setRegisteredFaceCount] = useState(0);
    const [faceStatus, setFaceStatus] = useState({
        ready: false,
        message: "Loading face models...",
        threshold: 0.5,
    });
    const faceBusyRef = useRef(false);
    const [livenessChallenge, setLivenessChallenge] = useState(null);
    const [livenessStatus, setLivenessStatus] = useState({
        passed: false,
        running: false,
        message: "A live challenge will be required before capture.",
    });
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [time, setTime] = useState("");
    const [timeIn, setTimeIn] = useState(""); // Display time in
    const [timeOut, setTimeOut] = useState(""); // Display time out
    const [breaktimeIn, setBreakIn] = useState(""); // Display break time in
    const [breaktimeOut, setBreakOut] = useState(""); // Display break time out
    const [records, setRecords] = useState([]); // DTR records for display
    const [capturing, setCapturing] = useState(false); // General capturing state
    const [countdown, setCountdown] = useState(0); // Countdown for image capture
    const [fetchRecords, setFetchRecords] = useState([]);
    const [todayRecord, setTodayRecord] = useState(null);
    const [loading, setLoading] = useState({ show: false, message: "" });


    const [userLocation, setUserLocation] = useState(null);
    const geolocationOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    const [locationAddress, setLocationAddress] = useState("");
    const [locationAccuracy, setLocationAccuracy] = useState(null);
    const locationWatchIdRef = useRef(null);
    const lastGoodLocationRef = useRef(null);
    const revGeoCacheRef = useRef(new Map());
    const roundCoord = (n, p = 5) => Number(n).toFixed(p); // ~1m-10m-ish depending
    const MANILA_TZ = "Asia/Manila";
    const FACE_MATCH_THRESHOLD = 0.52;
    const FACE_PASS_REQUIRED = 2;
    const FACE_CAPTURE_FRAMES = 4;
    const MIN_FACE_BOX_RATIO = 0.11;
    const MIN_EYE_DISTANCE = 36;
    const MAX_YAW_DELTA = 0.30;

    // const LIVENESS_FRAME_COUNT = 16;
    // const LIVENESS_FRAME_DELAY = 120;
    // const BLINK_EAR_OPEN = 0.24;
    // const BLINK_EAR_CLOSED = 0.20;
    // const TURN_YAW_DELTA = 0.085;
    
    const LIVENESS_FRAME_COUNT = 24;
    const LIVENESS_FRAME_DELAY = 60;
    const BLINK_EAR_OPEN = 0.23;
    const BLINK_EAR_CLOSED = 0.19;
    const TURN_YAW_DELTA = 0.07;
    



    
    const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

    const [viewMode, setViewMode] = useState('cards'); // 'cards', 'accordion', 'table'
    const [expandedRecord, setExpandedRecord] = useState(null);

    

    const navigate = useNavigate();

const reverseGeocode = async (lat, lon) => {
  const key = `${roundCoord(lat, 5)},${roundCoord(lon, 5)}`;
  if (revGeoCacheRef.current.has(key)) return revGeoCacheRef.current.get(key);

  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
      params: { lat, lon, format: "json" },
      timeout: 8000,
      headers: {
        // (Optional) Nominatim likes having a descriptive UA; browser may restrict some headers though.
        // "User-Agent": "YourAppName/1.0 (timekeeping)"
      },
    });

    const name = response.data.display_name || "Unknown location";
    revGeoCacheRef.current.set(key, name);
    return name;
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
    return "Unknown location";
  }
};


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

const getLocation = async () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
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
};

const GEO_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 15000, // allow a recent cached value for speed
};

// tweak this based on your needs
const ACCEPTABLE_ACCURACY_METERS = 60;

const startLocationWatch = useCallback(() => {
  if (!navigator.geolocation) return;

  // avoid multiple watches
  if (locationWatchIdRef.current != null) return;

  locationWatchIdRef.current = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const payload = { latitude, longitude, accuracy, ts: Date.now() };

      setUserLocation({ latitude, longitude });
      setLocationAccuracy(accuracy);

      // keep the best one (lowest accuracy meters)
      if (
        !lastGoodLocationRef.current ||
        (accuracy != null && accuracy < lastGoodLocationRef.current.accuracy)
      ) {
        lastGoodLocationRef.current = payload;
      }

      // if it’s already good enough, you can stop watching to save battery
      if (accuracy != null && accuracy <= ACCEPTABLE_ACCURACY_METERS) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    },
    (err) => {
      console.warn("watchPosition error:", err);
    },
    GEO_WATCH_OPTIONS
  );
}, []);

useEffect(() => {
  if (!isLocationRequired) return;

  startLocationWatch();

  return () => {
    if (locationWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
  };
}, [isLocationRequired, startLocationWatch]);




    // NEMAR //
    // Company location details (for potential future geo-fencing)
    // const COMPANY_LOCATION = {
    //     address: "1st floor, Rufino Building, Pres. L. Katigbak Street, C.M. Recto Ave, Brgy. 9, Lipa City, Batangas",
    //     coordinates: { latitude: 13.9411, longitude: 121.1622 },
    //     allowedRadius: 500 // meters
    // };

    // NAYSA //
    // Company location details (for potential future geo-fencing)
    
        const COMPANY_LOCATION = {
        // address: "Vernida I Building, 120 Amorsolo Street, Legazpi Village, Makati City, Metro Manila, Philippines",
        address: "No Loaction Setup Found",
        coordinates: {
            latitude: 14.555879228816387,
            longitude: 121.01474453024396
        },
        allowedRadius: 50, // meters
        // branchname: "Main Branch" // Add this line 💡
    };

    const [empBranchLoc, setEmpBranchLoc] = useState(null);

    // This is already well-structured
        const fetchEmpBranchLoc = useCallback(async () => {
            if (!user?.empNo) return;
            try {
                const response = await getEmpBranchLoc(user.empNo); ;
                if (response.success && response.records && response.records.length > 0) {
                    const fetchedLocation = response.records[0];

                    // Reformat the object to match the expected COMPANY_LOCATION structure
                    const formattedLocation = {
                        address: fetchedLocation.address,
                        coordinates: {
                            latitude: fetchedLocation.latitude,
                            longitude: fetchedLocation.longitude
                        },
                        allowedRadius: fetchedLocation.allowedRadius,
                        branchname: fetchedLocation.branchname,
                        geofence: fetchedLocation.geofence // Ensure this is included
                    };

                    setEmpBranchLoc(formattedLocation);
                    console.log("fetchEmpBranchLoc:", formattedLocation);
                } else {
                    // Optional: Log a message if no records are found
                    console.log("No branch location records found. Using default COMPANY_LOCATION.");
                    setEmpBranchLoc(null); // Ensure state is reset if no data
                }
            } catch (error) {
                console.error("Error fetching employee branch location:", error);
            }
        }, [user?.empNo]);

    useEffect(() => {
        fetchEmpBranchLoc();
    }, [fetchEmpBranchLoc]);


    // Use the fetched data if available, otherwise fallback to the default
    const branchLocation = empBranchLoc || COMPANY_LOCATION;

    useEffect(() => {
        // This console.log will only run when 'branchLocation' changes
        console.log('Current Branch Location:', branchLocation);
    }, [branchLocation]); // Dependency array ensures it only runs when branchLocation updates


    // Add a new useEffect to handle the geofence state change
    useEffect(() => {
        if (empBranchLoc) {
            setIsLocationRequired(empBranchLoc.geofence);
            console.log('Location Required:', empBranchLoc.geofence);
        }
    }, [empBranchLoc]);

    

    useEffect(() => {

        if (!isImageCaptureRequired) {
            return;
         }

        const loadModels = async () => {
            try {
                setFaceStatus({ ready: false, message: "Loading face models...", threshold: FACE_MATCH_THRESHOLD });
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);

                const allLoaded = [
                    faceapi.nets.ssdMobilenetv1,
                    faceapi.nets.tinyFaceDetector,
                    faceapi.nets.faceLandmark68Net,
                    faceapi.nets.faceRecognitionNet,
                ].every((net) => !!net.params);

                if (!allLoaded) {
                    throw new Error("Not all face models were loaded.");
                }

                setFaceDetectionModelLoaded(true);
                setFaceStatus({ ready: false, message: "Loading your registered face...", threshold: FACE_MATCH_THRESHOLD });
                console.log("✅ Face-API.js models loaded successfully");
            } catch (error) {
                console.error("❌ Model loading error:", error);
                setFaceStatus({ ready: false, message: "Face models failed to load.", threshold: FACE_MATCH_THRESHOLD });
                Swal.fire("Error", "Face detection models failed to load. Please refresh.", "error");
            }
        };

        loadModels();
    }, []);

    // --- Webcam Initialization ---
    useEffect(() => {
        
        if (!isImageCaptureRequired) {
            return;
        }

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
                if (isImageCaptureRequired) {
                    Swal.fire("Camera Error", "Could not access webcam. Please ensure it's connected and permissions are granted.", "error");
                }
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

         // Only proceed if image capture is required
        if (!isImageCaptureRequired) {
            // Optionally, reset the descriptor if you want to clear it when not needed
            setCurrentUserFaceDescriptor(null);
            return;
        }

        const loadCurrentUserDescriptor = async () => {
            if (!user?.empNo) {
                console.warn("User or empNo not available to load face descriptor.");
                return;
            }
            if (!faceDetectionModelLoaded) {
                console.warn("Face detection models not loaded yet. Skipping descriptor load.");
                return;
            }

            const empNo = String(user.empNo).trim();
            const candidates = [
                `/images/${empNo}.jpg`,
                `/images/${empNo}.jpeg`,
                `/images/${empNo}.png`,
                `${IMAGE_BASE_URL}/${empNo}.jpg`,
                `${IMAGE_BASE_URL}/${empNo}.jpeg`,
                `${IMAGE_BASE_URL}/${empNo}.png`,
            ];

            try {
                setFaceStatus({ ready: false, message: "Loading your registered face...", threshold: FACE_MATCH_THRESHOLD });
                const descriptorList = [];
                const seen = new Set();
                for (const imageUrl of candidates) {
                    if (!imageUrl || seen.has(imageUrl)) continue;
                    seen.add(imageUrl);
                    try {
                        const img = await faceapi.fetchImage(imageUrl);
                        const detection = await faceapi
                            .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                            .withFaceLandmarks()
                            .withFaceDescriptor();
                        if (detection?.descriptor) {
                            descriptorList.push(detection.descriptor);
                        }
                    } catch (err) {
                        console.debug(`Skipped reference face source: ${imageUrl}`, err?.message || err);
                    }
                }

                if (descriptorList.length > 0) {
                    const labeledDescriptors = new faceapi.LabeledFaceDescriptors(empNo, descriptorList);
                    setCurrentUserFaceDescriptor(descriptorList[0]);
                    setCurrentUserFaceMatcher(new faceapi.FaceMatcher([labeledDescriptors], FACE_MATCH_THRESHOLD));
                    setRegisteredFaceCount(descriptorList.length);
                    setIsImageCaptureRequired(true);
                    setFaceStatus({
                        ready: true,
                        message: `Face ready (${descriptorList.length} reference${descriptorList.length > 1 ? "s" : ""})`,
                        threshold: FACE_MATCH_THRESHOLD,
                    });
                    console.log(`Loaded ${descriptorList.length} face descriptor(s) for employee: ${empNo}`);
                } else {
                    console.warn(`No face detected in any reference image for ${empNo}.`);
                    setCurrentUserFaceDescriptor(null);
                    setCurrentUserFaceMatcher(null);
                    setRegisteredFaceCount(0);
                    setIsImageCaptureRequired(false);
                    setFaceStatus({
                        ready: true,
                        message: "No registered face found. Face verification skipped.",
                        threshold: FACE_MATCH_THRESHOLD,
                    });
                    setLivenessChallenge(null);
                    setLivenessStatus({
                        passed: true,
                        running: false,
                        message: "No registered picture found. Timekeeping buttons remain available.",
                    });
                    Swal.fire({
                        icon: "info",
                        title: "No Registered Picture",
                        text: "No registered picture was found for your profile. Timekeeping buttons will remain available without face verification.",
                        toast: true,
                        timer: 3500,
                        position: "top",
                        showConfirmButton: false,
                    });
                }
            } catch (err) {
                console.warn("Face model not found:", err.message);
                setFaceStatus({ ready: false, message: "Face reference unavailable. Photo capture skipped.", threshold: FACE_MATCH_THRESHOLD });
                Swal.fire({
                    icon: "warning",
                    title: "Face Model Not Found",
                    text: "You can still time-in/out but photo capture will be skipped.",
                    toast: true,
                    timer: 3000,
                    position: "top",
                    showConfirmButton: false,
                });

                setIsImageCaptureRequired(false);
                setCurrentUserFaceDescriptor(null);
                setCurrentUserFaceMatcher(null);
                setRegisteredFaceCount(0);
            }

        };

        if (faceDetectionModelLoaded) {
            loadCurrentUserDescriptor(); // Only call after models are loaded
        }
    }, [user?.empNo, faceDetectionModelLoaded]); // Dependency on faceDetectionModelLoaded and empNo


    // --- Real-time Clock Update ---
    useEffect(() => {
        const interval = setInterval(() => {
            // setTime(dayjs().format("hh:mm:ss A"));
            // setCurrentDate(dayjs());
            setTime(getCurrentManila().format("hh:mm:ss A"));
            setCurrentDate(dayjs().tz("Asia/Manila"));  
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const getCurrentManila = useCallback(() => dayjs().tz(MANILA_TZ), []);

    const detectFaceWithQuality = useCallback(async (source) => {
        const detection = await faceapi
            .detectSingleFace(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            return { ok: false, reason: "No face detected." };
        }

        const box = detection.detection?.box;
        const width = source?.videoWidth || source?.naturalWidth || source?.width || 320;
        const height = source?.videoHeight || source?.naturalHeight || source?.height || 240;
        const areaRatio = box ? (box.width * box.height) / (width * height) : 0;
        const leftEye = detection.landmarks?.getLeftEye?.() || [];
        const rightEye = detection.landmarks?.getRightEye?.() || [];
        const leftEyeCenter = leftEye.length ? leftEye.reduce((a, p) => ({ x: a.x + p.x / leftEye.length, y: a.y + p.y / leftEye.length }), { x: 0, y: 0 }) : null;
        const rightEyeCenter = rightEye.length ? rightEye.reduce((a, p) => ({ x: a.x + p.x / rightEye.length, y: a.y + p.y / rightEye.length }), { x: 0, y: 0 }) : null;
        const eyeDistance = leftEyeCenter && rightEyeCenter
            ? Math.hypot(rightEyeCenter.x - leftEyeCenter.x, rightEyeCenter.y - leftEyeCenter.y)
            : 0;
        const nose = detection.landmarks?.getNose?.() || [];
        const noseTip = nose[3] || nose[0] || null;
        const eyesMidX = leftEyeCenter && rightEyeCenter ? (leftEyeCenter.x + rightEyeCenter.x) / 2 : null;
        const yawDelta = noseTip && eyesMidX && eyeDistance ? Math.abs(noseTip.x - eyesMidX) / eyeDistance : 0;

        if (areaRatio < MIN_FACE_BOX_RATIO) {
            return { ok: false, reason: "Move closer to the camera.", detection, metrics: { areaRatio, eyeDistance, yawDelta } };
        }
        if (eyeDistance < MIN_EYE_DISTANCE) {
            return { ok: false, reason: "Face is too small or blurry.", detection, metrics: { areaRatio, eyeDistance, yawDelta } };
        }
        if (yawDelta > MAX_YAW_DELTA) {
            return { ok: false, reason: "Please face the camera directly.", detection, metrics: { areaRatio, eyeDistance, yawDelta } };
        }

        return { ok: true, detection, metrics: { areaRatio, eyeDistance, yawDelta } };
    }, [MAX_YAW_DELTA, MIN_EYE_DISTANCE, MIN_FACE_BOX_RATIO]);


    const averagePoint = useCallback((pts = []) => {
        if (!pts.length) return null;
        return pts.reduce((acc, p) => ({ x: acc.x + (p.x / pts.length), y: acc.y + (p.y / pts.length) }), { x: 0, y: 0 });
    }, []);

    const distanceBetween = useCallback((a, b) => {
        if (!a || !b) return 0;
        return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
    }, []);

    const eyeAspectRatio = useCallback((eye = []) => {
        if (!eye || eye.length < 6) return 0;
        const vertical1 = distanceBetween(eye[1], eye[5]);
        const vertical2 = distanceBetween(eye[2], eye[4]);
        const horizontal = distanceBetween(eye[0], eye[3]);
        if (!horizontal) return 0;
        return (vertical1 + vertical2) / (2 * horizontal);
    }, [distanceBetween]);

    const getRandomLivenessChallenge = useCallback(() => {
        return {
            code: "blink_or_turn",
            label: "Blink naturally or turn your head slightly left/right",
            primary: "either",
            fallback: "either",
        };
    }, []);

    const pointDistance = (a, b) => {
      if (!a || !b) return 0;
      return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
    };

    const getEyeAspectRatio = (eye = []) => {
      if (!Array.isArray(eye) || eye.length < 6) return 0;

      const A = pointDistance(eye[1], eye[5]);
      const B = pointDistance(eye[2], eye[4]);
      const C = pointDistance(eye[0], eye[3]);

      if (!C) return 0;
      return (A + B) / (2 * C);
    };

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const estimateYawDelta = (landmarks) => {
      try {
        const nose = landmarks?.getNose?.() || [];
        const jaw = landmarks?.getJawOutline?.() || [];
        const leftEye = landmarks?.getLeftEye?.() || [];
        const rightEye = landmarks?.getRightEye?.() || [];

        if (nose.length < 4 || jaw.length < 17 || leftEye.length < 4 || rightEye.length < 4) {
          return 0;
        }

        const noseTip = nose[3] || nose[Math.floor(nose.length / 2)];
        const leftJaw = jaw[0];
        const rightJaw = jaw[16];
        const leftEyeOuter = leftEye[0];
        const rightEyeOuter = rightEye[3];

        const faceLeftX = (leftJaw.x + leftEyeOuter.x) / 2;
        const faceRightX = (rightJaw.x + rightEyeOuter.x) / 2;
        const faceCenterX = (faceLeftX + faceRightX) / 2;
        const faceWidth = Math.max(1, faceRightX - faceLeftX);

        return clamp((noseTip.x - faceCenterX) / faceWidth, -1, 1);
      } catch {
        return 0;
      }
    };

    const detectBlinkFromSamples = (samples) => {
      const ears = samples
        .map((s) => s.ear)
        .filter((v) => Number.isFinite(v));

      if (ears.length < 6) {
        return {
          detected: false,
          reason: "Not enough eye samples.",
          minEar: 0,
          maxEar: 0,
          earRange: 0,
          closedFrames: 0,
          baselineEar: 0,
          dynamicClosedThreshold: 0,
        };
      }

      const minEar = Math.min(...ears);
      const maxEar = Math.max(...ears);
      const earRange = maxEar - minEar;

      const sorted = [...ears].sort((a, b) => a - b);
      const upperHalf = sorted.slice(Math.floor(sorted.length / 2));
      const baselineEar =
        upperHalf.reduce((sum, v) => sum + v, 0) / Math.max(upperHalf.length, 1);

      // adaptive threshold based on user's own open-eye baseline
      const dynamicClosedThreshold = Math.max(
        0.21,
        baselineEar - 0.04
      );

      let state = "waiting_open";
      let closedFrames = 0;
      let detected = false;

      for (let i = 0; i < ears.length; i += 1) {
        const ear = ears[i];

        if (state === "waiting_open") {
          if (ear >= baselineEar - 0.015) {
            state = "waiting_close";
          }
          continue;
        }

        if (state === "waiting_close") {
          if (ear <= dynamicClosedThreshold) {
            closedFrames += 1;
            state = "waiting_reopen";
          }
          continue;
        }

        if (state === "waiting_reopen") {
          if (ear <= dynamicClosedThreshold) {
            closedFrames += 1;
          } else if (ear >= baselineEar - 0.015) {
            detected = closedFrames >= 1 && earRange >= 0.025;
            break;
          }
        }
      }

      return {
        detected,
        reason: detected
          ? "Blink detected."
          : "No clear adaptive open-close-open eye pattern detected.",
        minEar,
        maxEar,
        earRange,
        closedFrames,
        baselineEar,
        dynamicClosedThreshold,
      };
    };

    const analyzeLivenessFrame = useCallback(async (videoElement) => {
      if (!videoElement || videoElement.readyState < 2) return null;

      const detection = await faceapi
        .detectSingleFace(
          videoElement,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks();

      if (!detection?.landmarks || !detection?.detection?.box) {
        return null;
      }

      const landmarks = detection.landmarks;
      const box = detection.detection.box;

      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      const leftEAR = getEyeAspectRatio(leftEye);
      const rightEAR = getEyeAspectRatio(rightEye);
      const ear = (leftEAR + rightEAR) / 2;

      const eyeLeftCenter = leftEye?.length
        ? {
            x: leftEye.reduce((sum, p) => sum + p.x, 0) / leftEye.length,
            y: leftEye.reduce((sum, p) => sum + p.y, 0) / leftEye.length,
          }
        : null;

      const eyeRightCenter = rightEye?.length
        ? {
            x: rightEye.reduce((sum, p) => sum + p.x, 0) / rightEye.length,
            y: rightEye.reduce((sum, p) => sum + p.y, 0) / rightEye.length,
          }
        : null;

      const eyeDistance =
        eyeLeftCenter && eyeRightCenter
          ? pointDistance(eyeLeftCenter, eyeRightCenter)
          : 0;

      const yawDelta = estimateYawDelta(landmarks);

      return {
        ear,
        leftEAR,
        rightEAR,
        yawDelta,
        eyeDistance,
        box: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
      };
    }, []);




    const trackFaceMovement = useCallback(
      async (videoElement) => {
        const challenge = getRandomLivenessChallenge();
        setLivenessChallenge(challenge);
        setLivenessStatus({
          passed: false,
          running: true,
          message: `Liveness check: ${challenge.label}`,
        });

        const samples = [];

        for (let i = 0; i < LIVENESS_FRAME_COUNT; i += 1) {
          const frame = await analyzeLivenessFrame(videoElement);
          if (frame) {
            samples.push(frame);
          }

          if (i < LIVENESS_FRAME_COUNT - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, LIVENESS_FRAME_DELAY)
            );
          }
        }

        if (samples.length < 6) {
          setLivenessStatus({
            passed: false,
            running: false,
            message: "Keep one live face centered in the camera and try again.",
          });
          throw new Error(
            "Live face challenge failed. Keep one face centered in the camera."
          );
        }

        const movementScore = (() => {
          let score = 0;
          for (let i = 1; i < samples.length; i += 1) {
            score += Math.abs((samples[i].box?.x || 0) - (samples[i - 1].box?.x || 0));
            score += Math.abs((samples[i].box?.y || 0) - (samples[i - 1].box?.y || 0));
          }
          return score;
        })();

        if (movementScore > 180) {
          setLivenessStatus({
            passed: false,
            running: false,
            message: "Please keep the camera steady. A moving phone photo can be rejected.",
          });
          throw new Error("Keep the device steady and perform the requested live action.");
        }

        const validEyeDistances = samples
          .map((s) => s.eyeDistance)
          .filter((v) => Number.isFinite(v));

        const avgEyeDistance = validEyeDistances.length
          ? validEyeDistances.reduce((a, b) => a + b, 0) / validEyeDistances.length
          : 0;

        if (avgEyeDistance < 24) {
          setLivenessStatus({
            passed: false,
            running: false,
            message: "Move closer to the camera and keep your face centered.",
          });
          throw new Error("Face is too far from the camera.");
        }

        const blinkResult = detectBlinkFromSamples(samples);

        const yaws = samples
          .map((s) => s.yawDelta)
          .filter((v) => Number.isFinite(v));

        const minYaw = yaws.length ? Math.min(...yaws) : 0;
        const maxYaw = yaws.length ? Math.max(...yaws) : 0;
        const yawRange = maxYaw - minYaw;

        const turnLeftDetected = maxYaw >= TURN_YAW_DELTA;
        const turnRightDetected = minYaw <= -TURN_YAW_DELTA;
        const turnDetected =
          yaws.length >= 4 &&
          yawRange >= 0.035 &&
          (turnLeftDetected || turnRightDetected);

        const blinkDetected = blinkResult.detected;
        const passed = blinkDetected || turnDetected;

        let passMessage = "Live challenge passed.";
        if (blinkDetected && turnDetected) {
          passMessage = "Live challenge passed: blink and head turn detected.";
        } else if (blinkDetected) {
          passMessage = "Live challenge passed: blink detected.";
        } else if (turnDetected) {
          passMessage = `Live challenge passed: head turn detected${
            turnLeftDetected && turnRightDetected
              ? ""
              : turnLeftDetected
              ? " (left)"
              : " (right)"
          }.`;
        }

        console.log("Liveness debug", {
          earSamples: samples.map((s) => Number(s.ear || 0).toFixed(3)),
          yawSamples: samples.map((s) => Number(s.yawDelta || 0).toFixed(3)),
          movementScore,
          avgEyeDistance,
          blinkDetected,
          blinkReason: blinkResult.reason,
          minEar: blinkResult.minEar,
          maxEar: blinkResult.maxEar,
          earRange: blinkResult.earRange,
          closedFrames: blinkResult.closedFrames,
          baselineEar: blinkResult.baselineEar,
          dynamicClosedThreshold: blinkResult.dynamicClosedThreshold,
          minYaw,
          maxYaw,
          yawRange,
          turnLeftDetected,
          turnRightDetected,
          turnDetected,
        });

        if (!passed) {
          const failMessage =
            "Blink or head turn was not detected. Try blinking naturally once or slightly turn your head left/right.";
          setLivenessStatus({
            passed: false,
            running: false,
            message: failMessage,
          });
          throw new Error(failMessage);
        }

        setLivenessStatus({
          passed: true,
          running: false,
          message: passMessage,
        });

        return true;
      },
      [analyzeLivenessFrame, getRandomLivenessChallenge]
    );

    // --- Get New Image ID ---
    const getNewImageId = useCallback(async () => {
        try {
            const response = await axios.get(API_ENDPOINTS.getNewImageId);
            if (response.data.success) {
                return response.data.id;
            }
            console.error('API Error:', response.data.message);
            throw new Error(response.data.message || 'Failed to get a new image ID.');
        } catch (err) {
            console.error('Error fetching new image ID:', err);
            return `local_${Date.now()}`;
        }
    }, []);

    const verifyFace = useCallback(async (imageDataUrl) => {
        if (!faceDetectionModelLoaded || !currentUserFaceMatcher) {
            Swal.fire("Error", "Face models or your reference data not loaded.", "error");
            return { passed: false, reason: "Face reference not ready.", distance: null };
        }

        try {
            const img = await faceapi.fetchImage(imageDataUrl);
            const qualityCheck = await detectFaceWithQuality(img);

            if (!qualityCheck.ok) {
                return {
                    passed: false,
                    reason: qualityCheck.reason || "Face quality check failed.",
                    distance: null,
                };
            }

            const bestMatch = currentUserFaceMatcher.findBestMatch(qualityCheck.detection.descriptor);
            const distance = Number(bestMatch?.distance ?? 1);

            console.log('Best Match Distance:', distance);
            console.log('Registered Face Count:', registeredFaceCount);

            if (distance <= FACE_MATCH_THRESHOLD) {
                return { passed: true, reason: "Face matched.", distance, detection: qualityCheck.detection };
            }

            return {
                passed: false,
                reason: `Face does not match your registered profile. Match distance: ${distance.toFixed(3)}`,
                distance,
                detection: qualityCheck.detection,
            };
        } catch (err) {
            console.error("Error during face verification:", err);
            return { passed: false, reason: err.message || "Verification error.", distance: null };
        }
    }, [currentUserFaceMatcher, detectFaceWithQuality, faceDetectionModelLoaded, registeredFaceCount]);


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
            setCountdown(3);
            setLivenessChallenge(null);
            setLivenessStatus({
                passed: false,
                running: false,
                message: "Waiting to start live challenge...",
            });

            const intervalId = setInterval(() => {
                setCountdown((prevCount) => {
                    const newCount = prevCount - 1;

                    if (newCount === 0) {
                        clearInterval(intervalId);

                        (async () => {
                            try {
                                if (!canvasRef.current || !videoRef.current || videoRef.current.readyState < 2) {
                                    throw new Error("Camera not ready. Please wait and try again.");
                                }

                                await trackFaceMovement(videoRef.current);

                                const ctx = canvasRef.current.getContext("2d");
                                const frameResults = [];

                                for (let i = 0; i < FACE_CAPTURE_FRAMES; i += 1) {
                                    ctx.save();
                                    ctx.scale(-1, 1);
                                    ctx.drawImage(videoRef.current, -canvasRef.current.width, 0, canvasRef.current.width, canvasRef.current.height);
                                    ctx.restore();

                                    const imageDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.92);
                                    const verification = await verifyFace(imageDataUrl);
                                    frameResults.push({ imageDataUrl, verification });

                                    if (i < FACE_CAPTURE_FRAMES - 1) {
                                        await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
                                    }
                                }

                                const passedFrames = frameResults.filter((item) => item.verification?.passed);
                                if (passedFrames.length < FACE_PASS_REQUIRED) {
                                    const bestAttempt = [...frameResults]
                                        .sort((a, b) => (a.verification?.distance ?? 999) - (b.verification?.distance ?? 999))[0];
                                    throw new Error(bestAttempt?.verification?.reason || "Face verification failed. Please try again in better lighting.");
                                }

                                const bestFrame = [...passedFrames]
                                    .sort((a, b) => (a.verification?.distance ?? 999) - (b.verification?.distance ?? 999))[0];

                                const newImageId = await getNewImageId();
                                const savedImageInfo = await saveCapturedFaceImage(bestFrame.imageDataUrl, newImageId);
                                resolve({ ...savedImageInfo, verification: bestFrame.verification, attempts: frameResults.length, type });
                            } catch (e) {
                                reject(e);
                            } finally {
                                setCapturing(false);
                                setCountdown(0);
                            }
                        })();
                    }

                    return newCount;
                });
            }, 1000);
        });
    }, [verifyFace, getNewImageId, trackFaceMovement]);


    const SpinnerOverlay = ({ show, message }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex flex-col items-center justify-center">
      <div className="h-12 w-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
      {message && (
        <p className="mt-3 text-white text-sm font-medium text-center px-4">{message}</p>
      )}
    </div>
  );
};

  
    const handleTimeEvent = async (type) => {
  if (loading.show || capturing || faceBusyRef.current) {
    return;
  }

  if (!user?.empNo) {
    Swal.fire("Error", "Employee number not available. Please log in.", "error");
    return;
  }

  // more forgiving location helper:
  // 1) try cached/fast position first
  // 2) retry with high accuracy
  // 3) fall back to the best watchPosition reading if available
  const getPosition = (opts) =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, opts);
    });

  const getBestCoords = async () => {
    const normalizeCoords = (pos) => ({
      latitude: Number(pos?.coords?.latitude),
      longitude: Number(pos?.coords?.longitude),
      accuracy: Number(pos?.coords?.accuracy ?? 0),
    });

    try {
      let pos = await getPosition({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30000,
      });

      let accuracy = Number(pos?.coords?.accuracy ?? 999999);

      if (accuracy > 80) {
        try {
          pos = await getPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
          accuracy = Number(pos?.coords?.accuracy ?? 999999);
        } catch (gpsErr) {
          console.warn("High-accuracy GPS lookup failed, using best available location.", gpsErr);
        }
      }

      return normalizeCoords(pos);
    } catch (err) {
      const cached = lastGoodLocationRef.current;
      if (cached?.latitude != null && cached?.longitude != null) {
        console.warn("Using cached/watchPosition location after getCurrentPosition failure.", err);
        return {
          latitude: Number(cached.latitude),
          longitude: Number(cached.longitude),
          accuracy: Number(cached.accuracy ?? 0),
        };
      }
      throw err;
    }
  };

  try {
    faceBusyRef.current = true;
    let userCoords = null;
    let address = "N/A";

    let capturedImageInfo = null;

    // =========================
    // 1) LOCATION (FASTER)
    // - do NOT reverseGeocode yet (it’s slow)
    // - geofence check first using coords only
    // =========================
    let reverseGeocodePromise = null;

    if (isLocationRequired) {
      setLoading({ show: true, message: "Getting your location..." });

      userCoords = await getBestCoords();

      // geofence check (no reverse geocode yet)
      if (Number(branchLocation?.geofence) === 1) {
        const isAllowedLocation = isWithinRadius(
          userCoords.latitude,
          userCoords.longitude,
          branchLocation.coordinates.latitude,
          branchLocation.coordinates.longitude,
          branchLocation.allowedRadius
        );

        if (!isAllowedLocation) {
          // only now get readable address for the error message
          try {
            address = await reverseGeocode(userCoords.latitude, userCoords.longitude);
          } catch {
            address = "Unable to resolve address";
          }
          setLocationAddress(address);
          setLoading({ show: false, message: "" });

          const isMobile = window.matchMedia("(max-width: 640px)").matches;

          Swal.fire({
            icon: "error",
            title: "Location Error",
            html: `
              <div class="text-left text-sm leading-snug">
                <p><strong>📍 Current:</strong> ${address}</p>
                <p><strong>🏢 Assigned:</strong> ${branchLocation?.address ?? "N/A"}</p>
                <p class="mt-1 text-xs opacity-80"><strong>Accuracy:</strong> ${Math.round(
                  userCoords.accuracy || 0
                )}m</p>
              </div>
            `,
            toast: true,
            position: "top",
            width: isMobile ? "92vw" : "34rem",
            timer: 5000,
            timerProgressBar: true,
            showConfirmButton: false,
            customClass: {
              container: "!justify-center !items-start",
              popup: "mt-20 p-3 sm:p-4 rounded-xl shadow-lg",
              title: "text-base font-semibold",
              icon: "text-red-500",
            },
          });

          return;
        }
      }

      // start reverse geocode in parallel (don’t block UI)
      setLoading({ show: true, message: "Resolving address..." });
      reverseGeocodePromise = (async () => {
        try {
          const addr = await reverseGeocode(userCoords.latitude, userCoords.longitude);
          return addr || "N/A";
        } catch {
          return "N/A";
        }
      })();
    }

    // =========================
    // 2) IMAGE CAPTURE (RUNS WHILE ADDRESS IS RESOLVING)
    // =========================
    if (isImageCaptureRequired) {
      setLoading({ show: true, message: `Preparing camera for ${type}...` });
      capturedImageInfo = await captureImageProcess(type);

      if (!capturedImageInfo || !capturedImageInfo.id) {
        setLoading({ show: false, message: "" });
        Swal.fire("Failed", "Image capture or face verification failed.", "error");
        return;
      }
    }

    // finish reverse geocode if required
    if (isLocationRequired) {
      address = (await reverseGeocodePromise) || "N/A";
      setLocationAddress(address);
    }

    setLoading({ show: false, message: "" });

    // =========================
    // 3) BUILD PAYLOAD + SAVE
    // =========================
    const nowManila = getCurrentManila();
    const currentTime = nowManila.format("HH:mm:ss");
    const currentDateStr = nowManila.format("YYYY-MM-DD");

    let timeInImageIdToSend = null;
    let timeOutImageIdToSend = null;
    let breakInImageIdToSend = null;
    let breakOutImageIdToSend = null;

    let timeInImagePath = null;
    let timeOutImagePath = null;
    let breakInImagePath = null;
    let breakOutImagePath = null;

    if (isImageCaptureRequired && capturedImageInfo) {
      if (type === "TIME IN") {
        setTimeIn(getCurrentManila().format("hh:mm:ss A"));
        timeInImageIdToSend = capturedImageInfo.id;
        timeInImagePath = capturedImageInfo.path;
      } else if (type === "TIME OUT") {
        setTimeOut(getCurrentManila().format("hh:mm:ss A"));
        timeOutImageIdToSend = capturedImageInfo.id;
        timeOutImagePath = capturedImageInfo.path;
      } else if (type === "BREAK IN") {
        setBreakIn(getCurrentManila().format("hh:mm:ss A"));
        breakInImageIdToSend = capturedImageInfo.id;
        breakInImagePath = capturedImageInfo.path;
      } else if (type === "BREAK OUT") {
        setBreakOut(getCurrentManila().format("hh:mm:ss A"));
        breakOutImageIdToSend = capturedImageInfo.id;
        breakOutImagePath = capturedImageInfo.path;
      }
    } else {
      if (type === "TIME IN") setTimeIn(getCurrentManila().format("hh:mm:ss A"));
      if (type === "TIME OUT") setTimeOut(getCurrentManila().format("hh:mm:ss A"));
      if (type === "BREAK IN") setBreakIn(getCurrentManila().format("hh:mm:ss A"));
      if (type === "BREAK OUT") setBreakOut(getCurrentManila().format("hh:mm:ss A"));
    }

    const eventData = [
      {
        empNo: user.empNo,
        detail: {
          empNo: user.empNo,
          date: currentDateStr,
          timeIn: type === "TIME IN" ? currentTime : null,
          timeOut: type === "TIME OUT" ? currentTime : null,
          breakIn: type === "BREAK IN" ? currentTime : null,
          breakOut: type === "BREAK OUT" ? currentTime : null,

          timeInImageId: timeInImageIdToSend,
          timeOutImageId: timeOutImageIdToSend,
          breakInImageId: breakInImageIdToSend,
          breakOutImageId: breakOutImageIdToSend,

          timeInImagePath,
          timeOutImagePath,
          breakInImagePath,
          breakOutImagePath,

          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
          locationAccuracy: userCoords?.accuracy ?? null, // ✅ extra (safe even if backend ignores)
          locationAddress: address,
        },
      },
    ];

    console.log("Upsert Payload:", eventData);

    setLoading({ show: true, message: `Saving ${type}...` });
    const response = await axios.post(API_ENDPOINTS.upsertTimeIn, eventData);
    setLoading({ show: false, message: "" });

    if (response.data.status === "success") {
      Swal.fire({
        icon: "success",
        title: "Success",
        text: `${type} recorded successfully!`,
        toast: true,
        position: "top",
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
        customClass: {
          popup: "w-auto max-w-sm sm:max-w-md p-3 text-md mt-[150px]",
          title: "text-base font-semibold",
        },
      });
      fetchDTRRecords();
    } else {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: response.data.message || `Failed to record ${type}.`,
        toast: true,
        position: "top",
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
        customClass: {
          popup: "w-auto max-w-sm sm:max-w-md p-3 text-md mt-[150px]",
          title: "text-base font-semibold",
        },
      });
    }
  } catch (err) {
    setLoading({ show: false, message: "" });
    faceBusyRef.current = false;
    Swal.fire({
      icon: "error",
      title: "Error",
      text: err?.message || "An unexpected error occurred.",
      toast: true,
      position: "top",
      timer: 4000,
      timerProgressBar: true,
      showConfirmButton: false,
      customClass: {
        popup: "w-auto max-w-sm sm:max-w-md p-3 text-md mt-[150px]",
        title: "text-base font-semibold",
      },
    });
  } finally {
    faceBusyRef.current = false;
  }
};



    const fetchDTRRecords = useCallback(async () => {
        if (!user?.empNo || !startDate || !endDate) return;

        try {
            const response = await axios.get(`${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${startDate}/${endDate}`);
            
            if (response.data.success) {
                setRecords(response.data.records);
                const today = response.data.records.find(r => r.date === getCurrentManila().format("YYYY-MM-DD"));
                setTodayRecord(today);
            }
            console.log("Successfully loaded:", records);
        } catch (error) {
            console.error("Error fetching DTR records:", error);
        }
    }, [user?.empNo, startDate, endDate, getCurrentManila]);

    useEffect(() => {
        fetchDTRRecords();
    }, [fetchDTRRecords]);

    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            const recordDate = dayjs(record.date);
            const isAfterStart = startDate ? recordDate.isSameOrAfter(dayjs(startDate), 'day') : true;
            const isBeforeEnd = endDate ? recordDate.isSameOrBefore(dayjs(endDate), 'day') : true;
            return isAfterStart && isBeforeEnd;
        });
    }, [records, startDate, endDate]); 


    const totalWorkedHours = useMemo(() => {
        return filteredRecords.reduce((total, record) => {
            return total + (Number(record.worked_hrs) || 0);
        }, 0);
    }, [filteredRecords]);


    const faceReady = !isImageCaptureRequired || (faceDetectionModelLoaded && !!currentUserFaceMatcher && faceStatus.ready);
    const actionState = useMemo(() => ({
        canTimeIn: !capturing && !loading.show && faceReady && !todayRecord?.time_in,
        canBreakIn: !capturing && !loading.show && faceReady && !!todayRecord?.time_in && !todayRecord?.break_in,
        canBreakOut: !capturing && !loading.show && faceReady && !!todayRecord?.break_in && !todayRecord?.break_out,
        canTimeOut: !capturing && !loading.show && faceReady && !!todayRecord?.time_in && !todayRecord?.time_out,
    }), [capturing, loading.show, faceReady, todayRecord]);

    const calculateColSpan = () => {
        let span = 5; // Base columns (Date, Time In, Break In/Out, Time Out)
        if (isImageCaptureRequired) span += 2;
        if (isLocationRequired) span += 2;
        return span;
    };


const handleExport = () => {
    // Get the employee number and name.
    const employeeNumber = String(user?.empno).padStart(10, '0') || 'N/A';
    const employeeName = records[0]?.empName || 'N/A'; // Assuming empName is consistent across all records

    // Format the start and end dates for the filename
    const formattedStartDate = startDate ? dayjs(startDate).format('YYYYMMDD') : '';
    const formattedEndDate = endDate ? dayjs(endDate).format('YYYYMMDD') : '';
    const dateRange = (formattedStartDate && formattedEndDate) ? `${formattedStartDate}-${formattedEndDate}` : '';

    // Prepare the CSV header row
    const headerColumns = ["Employee No.", "Employee Name", "Date", "Time In"];
    // if (isImageCaptureRequired) headerColumns.push("Time In Capture");
    if (isLocationRequired) headerColumns.push("Time In Location");
    headerColumns.push("Break In", "Break Out", "Time Out");
    // if (isImageCaptureRequired) headerColumns.push("Time Out Capture");
    if (isLocationRequired) headerColumns.push("Time Out Location");
    headerColumns.push("Worked (hrs)");

    // Prepare the CSV data rows with employee info in each row
    const csvRows = filteredRecords.map(record => {
        const row = [
            `"${employeeNumber}"`,  // Ensuring the Employee No. is treated as a string
            `"${record.empName}"`,
            `"${dayjs(record.date).format("MM/DD/YYYY")}"`,
            `"${record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`
        ];

        // if (isImageCaptureRequired) {
        //     row.push(`"${record.time_in_image_id ? `${IMAGE_BASE_URL}/${record.time_in_image_id}.jpg` : "N/A"}"`);
        // }
        if (isLocationRequired) {
            row.push(`"${record.time_in_address || "N/A"}"`);
        }

        row.push(
            `"${record.break_in ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`,
            `"${record.break_out ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`,
            `"${record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`
        );

        // if (isImageCaptureRequired) {
        //     row.push(`"${record.time_out_image_id ? `${IMAGE_BASE_URL}/${record.time_out_image_id}.jpg` : "N/A"}"`);
        // }
        if (isLocationRequired) {
            row.push(`"${record.time_out_address || "N/A"}"`);
        }

        row.push(`"${record.worked_hrs != null ? Number(record.worked_hrs).toFixed(2) : "0.00"}"`);
        return row.join(',');
    });

    // Determine the position of the "Time Out" column
    const timeOutIndex = headerColumns.indexOf("Time Out Location");

    // Create the total row with correct alignment
    const totalRow = Array(headerColumns.length).fill('');
    totalRow[timeOutIndex] = '"Total Hours"';
    totalRow[headerColumns.length - 1] = totalWorkedHours.toFixed(2);

    // Combine all parts into a single CSV string
    const csvContent = [
        headerColumns.map(col => `"${col}"`).join(','),
        ...csvRows,
        totalRow.join(',')
    ].join('\n');

    // Create a Blob and trigger a download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `DTR-${employeeNumber}-${dateRange}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


  const formatTime = (time) => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  
  const handleDtrConfirmation = async () => {
  if (!user?.empNo) {
    Swal.fire("Error", "Employee number not available. Please log in.", "error");
    return;
  }

  if (!startDate || !endDate) {
    Swal.fire("Error", "Please select Start Date and End Date.", "error");
    return;
  }

  const confirm = await Swal.fire({
    icon: "warning",
    title: "Confirm DTR",
    text: `This will mark your DTR as FINAL from ${dayjs(startDate).format(
      "MMM DD, YYYY"
    )} to ${dayjs(endDate).format("MMM DD, YYYY")}. You may no longer edit these entries.`,
    showCancelButton: true,
    confirmButtonText: "Yes, confirm",
    cancelButtonText: "No, cancel",
  });

  if (!confirm.isConfirmed) return;

  try {
    const payload = {
      empNo: user.empNo,
      startDate,
      endDate,
    };

    const response = await axios.post(API_ENDPOINTS.confirmDTR, payload);

    if (response.data.success) {
      Swal.fire({
        icon: "success",
        title: "DTR Confirmed",
        text: response.data.message || "Your DTR has been confirmed.",
        toast: true,
        position: "top",
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
        customClass: {
          popup: "w-auto max-w-sm sm:max-w-md p-3 text-md mt-[150px]",
          title: "text-base font-semibold",
        },
      });

      // Refresh records so UI reflects any changes (if you later filter by STAT)
      fetchDTRRecords();
    } else {
      Swal.fire(
        "Error",
        response.data.message || "Unable to confirm DTR.",
        "error"
      );
    }
  } catch (err) {
    Swal.fire(
      "Error",
      err.response?.data?.message || err.message || "Unable to confirm DTR.",
      "error"
    );
  }
};


const buildImageCandidates = (imageId) => {
  if (!imageId) return [];
  return [
    `${IMAGE_BASE_URL}/${imageId}.jpg`,
    `${IMAGE_BASE_URL}/${imageId}.jpeg`,
    `${IMAGE_BASE_URL}/${imageId}.png`,
  ];
};

const HistoryImage = ({ imageId, alt, className = "rounded-lg w-full h-[110px] sm:h-[160px] object-cover" }) => {
  const candidates = useMemo(() => buildImageCandidates(imageId), [imageId]);
  const [srcIndex, setSrcIndex] = useState(0);

  useEffect(() => {
    setSrcIndex(0);
  }, [imageId]);

  if (!imageId) {
    return (
      <div className="flex items-center justify-center w-full h-[110px] sm:h-[160px] bg-gray-100 rounded-lg border border-dashed">
        <ImageIcon size={28} className="text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={candidates[srcIndex]}
      alt={alt}
      className={className}
      onError={() => {
        if (srcIndex < candidates.length - 1) {
          setSrcIndex((prev) => prev + 1);
        }
      }}
    />
  );
};

// Card View Component
// Card View Component
const CardView = ({ filteredRecords }) => {
  const navigate = useNavigate();

  const isBlank = (v) => v == null || String(v).trim() === "";

  const handleAdjustClick = (record) => {
    navigate("/timekeepingAdj", { state: { record } });
  };

  return (
    <div className="space-y-2">
      {filteredRecords.map((record, index) => {
        const isFinal = record.stat === "F";
        const canAdjust =
          !isFinal && (isBlank(record.time_in) || isBlank(record.time_out));

        return (
          <div
            key={index}
            className="bg-white rounded-lg shadow-md border border-gray-200"
          >
            {/* Card Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {formatDate(record.date)}
                  </h3>
                  {isFinal && (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                      FINAL
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {record.worked_hrs != null
                    ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                    : "0.00 hrs"}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">IN • OUT</div>
                <div className="font-mono text-xs sm:text-sm">
                  {record.time_in
                    ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
                    : "N/A"}{" "}
                  •{" "}
                  {record.time_out
                    ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
                    : "N/A"}
                </div>

                {/* Adjust Time button (only when allowed) */}
                {canAdjust && (
                  <button
                    onClick={() => handleAdjustClick(record)}
                    className="mt-2 inline-block px-3 py-1 text-[10px] sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                  >
                    Adjust Time
                  </button>
                )}
              </div>
            </div>

            {/* Card Content */}
            <div className="p-4 space-y-3">
              {/* Break Times */}
              <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Break</span>
                <span className="font-mono text-xs sm:text-sm">
                  {record.break_in
                    ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A")
                    : "N/A"}{" "}
                  •{" "}
                  {record.break_out
                    ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A")
                    : "N/A"}
                </span>
              </div>

              {/* Images and Locations */}
              {isImageCaptureRequired && (
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Time In Block */}
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Camera size={12} />
                      Time In
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Image */}
                      <div>
                        {record.time_in_image_id ? (
                          <div className="relative">
                            <img
                              src={`${IMAGE_BASE_URL}/${record.time_in_image_id}.jpeg`}
                              alt="Time In"
                              className="rounded-lg w-[140px] h-[120px] sm:w-[190px] sm:h-[180px] object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-[140px] h-[120px] sm:w-[190px] sm:h-[180px] bg-gray-100 rounded-lg border border-dashed">
                            <ImageIcon size={32} className="text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Location – beside on desktop, below on mobile */}
                      {isLocationRequired && (
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs text-gray-500">Time In Location</div>
                              <div className="text-sm text-gray-700 break-words">
                                {record.time_in_address || "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time Out Block */}
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Camera size={12} />
                      Time Out
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Image */}
                      <div>
                        {record.time_out_image_id ? (
                          <div className="relative">
                            <img
                              src={`${IMAGE_BASE_URL}/${record.time_out_image_id}.jpeg`}
                              alt="Time Out"
                              className="rounded-lg w-[140px] h-[120px] sm:w-[190px] sm:h-[180px] object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-[140px] h-[120px] sm:w-[190px] sm:h-[180px] bg-gray-100 rounded-lg border border-dashed">
                            <ImageIcon size={32} className="text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Location – beside on desktop, below on mobile */}
                      {isLocationRequired && (
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs text-gray-500">Time Out Location</div>
                              <div className="text-sm text-gray-700 break-words">
                                {record.time_out_address || "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })}
    </div>
  );
};



  // Accordion View Component
const AccordionView = ({ filteredRecords }) => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden">
    {filteredRecords.map((record, index) => (
      <div key={index} className="border-b border-gray-200 last:border-b-0">
        {/* Accordion Header */}
        <button
          onClick={() => setExpandedRecord(expandedRecord === index ? null : index)}
          className="w-full p-4 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-semibold text-gray-900">{formatDate(record.date)}</div>
                {record.stat === "F" && (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                    FINAL
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"} - {record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}          
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-semibold text-blue-600">
                  {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                </div>
              </div>
              {expandedRecord === index ? 
                <ChevronUp size={20} className="text-gray-400" /> : 
                <ChevronDown size={20} className="text-gray-400" />
              }
            </div>
          </div>
        </button>

        {/* Accordion Content */}
        {expandedRecord === index && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="space-y-4 pt-4">
              {/* Break Times */}
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm font-medium text-gray-700 mb-2">Break Time</div>
                <div className="text-sm text-gray-600">
                  {record.break_in ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"} - {record.break_out ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}
                </div>
              </div>

              {/* Images */}
              {isImageCaptureRequired && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Photo Captures</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Time In</div>
<HistoryImage imageId={record.time_in_image_id} alt="Time In" className="rounded-lg w-full h-[120px] sm:h-[180px] object-cover" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Time Out</div>
<HistoryImage imageId={record.time_out_image_id} alt="Time Out" className="rounded-lg w-full h-[120px] sm:h-[180px] object-cover" />
                    </div>
                  </div>
                </div>
              )}

              {/* Location */}
              {isLocationRequired && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Locations</div>
                  <div className="space-y-2">
                    <div className="text-[13px] sm:text-sm flex items-start gap-2">
                      <div className="w-16 text-gray-500 flex-shrink-0">In:</div>
                      <div className="text-gray-700">{record.time_in_address || 'N/A'}</div>
                    </div>
                    <div className="text-[13px] sm:text-sm flex items-start gap-2">
                      <div className="w-16 text-gray-500 flex-shrink-0">Out:</div>
                      <div className="text-gray-700">{record.time_out_address || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
);


const CompactTableView = ({ filteredRecords }) => {
  const navigate = useNavigate();

  const handleAdjustClick = (record) => {
    navigate("/timekeepingAdj", { state: { record } });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">Time Details</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">Hours</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record, index) => {
                const isIncomplete = !record.time_in || !record.time_out;
                const isFinal = record.stat === "F";

                return (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="text-[12px] sm:text-sm font-medium text-gray-900">
                          {dayjs(record.date).format("MM/DD/YYYY")}
                        </div>
                        {isFinal && (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                            FINAL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="text-[11px] sm:text-xs text-gray-600 space-y-1">
                        <div>
                          In:&nbsp;
                          {record.time_in
                            ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
                            : <span className="text-red-500 font-semibold">Missing</span>}
                        </div>
                        <div>
                          Out:&nbsp;
                          {record.time_out
                            ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
                            : <span className="text-red-500 font-semibold">Missing</span>}
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-400">
                          Break:&nbsp;
                          {record.break_in
                            ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A")
                            : "N/A"}{" "}
                          -{" "}
                          {record.break_out
                            ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A")
                            : "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right align-top">
                      <div className="text-[11px] sm:text-sm font-normal text-blue-600">
                        {record.worked_hrs != null
                          ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                          : "0.00 hrs"}
                      </div>
                      {isIncomplete && !isFinal && (
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="mt-1 inline-block px-2 py-1 text-[11px] sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                        >
                          Adjust Time
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="px-2 py-3 text-center text-gray-500">
                  No records found for the selected date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Full Table View Component
// Full Table View Component
const FullTableView = ({ filteredRecords, isImageCaptureRequired, isLocationRequired, handleAdjustClick }) => {
  const isBlank = (v) => v == null || String(v).trim() === "";

  // Function to calculate colspan based on image and location capture requirements
  const calculateColSpan = () => {
    let colSpan = 6; // Base number of columns (excluding Total Hours)
    if (isImageCaptureRequired) colSpan += 1; // If image capture is required
    if (isLocationRequired) colSpan += 1; // If location is required
    return colSpan;
  };

  // Calculate total worked hours
  const totalWorkedHours = filteredRecords.reduce((total, record) => {
    // Ensure worked_hrs is a valid number, defaulting to 0 if not
    const workedHrs = record.worked_hrs != null && !isNaN(record.worked_hrs) ? record.worked_hrs : 0;
    return total + workedHrs;
  }, 0);

  return (
    <div className="mt-4 p-2 bg-white rounded-lg shadow-lg overflow-x-auto">
      <h2 className="text-base font-bold mb-4">Daily Time Record Summary</h2>

      <table className="min-w-full table-auto border-collapse ">
        <thead>
          <tr className="border-b">
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-semibold whitespace-nowrap">Shift Date</th>
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-semibold whitespace-nowrap">Time In</th>
            {isLocationRequired && (
              <th className="px-1 py-2 text-left text-[7px] md:text-sm font-semibold whitespace-nowrap">Location</th>
            )}
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-semibold whitespace-nowrap">Break Time</th>
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-semibold whitespace-nowrap">Time Out</th>
            {isLocationRequired && (
              <th className="px-1 py-2 text-left text-[7px] md:text-sm font-semibold whitespace-nowrap">Location</th>
            )}
            <th className="px-1 py-2 text-right text-[7px] md:text-sm font-semibold whitespace-nowrap">Total hrs</th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record, index) => {
              const isFinal = record.stat === "F";
              const showAdjIn = isBlank(record.time_in);
              const showAdjOut = isBlank(record.time_out);

              return (
                <tr key={index}>
                  {/* Shift Date */}
                  <td className="px-1 py-1 text-[6px] md:text-xs">
                    <div className="flex items-center gap-1">
                      <span>{dayjs(record.date).format("MM/DD/YYYY")}</span>
                      {isFinal && (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[8px] font-semibold text-green-600 border border-green-200">
                          FINAL
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Time In */}
                  <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                    {isFinal || !showAdjIn ? (
                      record.time_in
                        ? dayjs(record.time_in, "HH:mm").format("hh:mm A")
                        : ""
                    ) : (
                      <button
                        onClick={() => handleAdjustClick(record)}
                        className="mt-1 inline-block px-2 py-1 text-[11px] sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                      >
                        Adjust Time
                      </button>
                    )}
                  </td>

                  {isLocationRequired && (
                    <td className="px-1 py-1 text-[6px] md:text-xs max-w-[200px] break-words">
                      {record.time_in_address || "N/A"}
                    </td>
                  )}

                  {/* Break Time */}
                  <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                    {record.break_in ? dayjs(record.break_in, "HH:mm").format("hh:mm A") : "N/A"}{" "}
                    -{" "}
                    {record.break_out ? dayjs(record.break_out, "HH:mm").format("hh:mm A") : "N/A"}
                  </td>

                  {/* Time Out */}
                  <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                    {isFinal || !showAdjOut ? (
                      record.time_out
                        ? dayjs(record.time_out, "HH:mm").format("hh:mm A")
                        : ""
                    ) : (
                      <button
                        onClick={() => handleAdjustClick(record)}
                        className="mt-1 inline-block px-2 py-1 text-[11px] sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                      >
                        Adjust Time
                      </button>
                    )}
                  </td>

                  {isLocationRequired && (
                    <td className="px-1 py-1 text-[6px] md:text-xs max-w-[200px] break-words">
                      {record.time_out_address || "N/A"}
                    </td>
                  )}

                  {/* Total Hours */}
                  <td className="px-1 py-1 text-[6px] md:text-xs text-right font-medium whitespace-nowrap">
                    {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={calculateColSpan() + 1} className="text-center py-4 text-gray-500">
                No records found for the selected date range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};




const FullSummaryView = ({ filteredRecords, isImageCaptureRequired, isLocationRequired }) => {
  const navigate = useNavigate();

  const isBlank = (v) => v == null || String(v).trim() === "";

  const handleAdjustClick = (record) => {
    navigate("/timekeepingAdj", { state: { record } });
  };

  // Function to calculate colspan based on image and location capture requirements
  const calculateColSpan = () => {
    let colSpan = 6; // Base number of columns (excluding Total Hours)
    if (isImageCaptureRequired) colSpan += 1;
    if (isLocationRequired) colSpan += 1;
    return colSpan;
  };

  // Calculate total worked hours
  const totalWorkedHours = filteredRecords.reduce((total, record) => {
    const workedHrs = record.worked_hrs != null && !isNaN(record.worked_hrs) ? record.worked_hrs : 0;
    return total + workedHrs;
  }, 0);

  return (
    <div className="mt-4 p-2 bg-white rounded-lg shadow-lg overflow-x-auto">
      <h2 className="text-base font-bold mb-4">Daily Time Record Summary</h2>

      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-1 py-2 text-left text-[10px] md:text-sm font-semibold whitespace-nowrap">Shift Date</th>
            <th className="px-1 py-2 text-left text-[10px] md:text-sm font-semibold whitespace-nowrap">Time In</th>
            <th className="px-1 py-2 text-left text-[10px] md:text-sm font-semibold whitespace-nowrap">Time Out</th>
            <th className="px-1 py-2 text-right text-[10px] md:text-sm font-semibold whitespace-nowrap">Total hrs</th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record, index) => {
              const showAdjIn = isBlank(record.time_in);
              const showAdjOut = isBlank(record.time_out);
              const isFinal = record.stat === "F";   // ✅ Final flag

              return (
                <tr key={index} className="border-b">
                  {/* Shift Date */}
                  <td className="px-1 py-1 text-[6px] md:text-xs">
                    <div className="flex items-center gap-1">
                      <span>{dayjs(record.date).format("MM/DD/YYYY")}</span>
                      {record.stat === "F" && (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[8px] font-semibold text-green-600 border border-green-200">
                          FINAL
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Time In */}
                  <td className="px-1 py-1 text-[8px] md:text-xs whitespace-nowrap">
                    {isFinal || !showAdjIn ? (
                      record.time_in
                        ? dayjs(record.time_in, "MM/DD/YYYY HH:mm").format("MM/DD/YYYY  hh:mm A")
                        : ""
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="inline-block px-2 py-1 text-[10px] md:text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                          title="Adjust Time In"
                        >
                          Adjust Time
                        </button>
                      </div>
                    )}
                  </td>


                  {/* Time Out */}
                  <td className="px-1 py-1 text-[8px] md:text-xs whitespace-nowrap">
                    {isFinal || !showAdjOut ? (
                      record.time_out
                        ? dayjs(record.time_out, "MM/DD/YYYY HH:mm").format("MM/DD/YYYY  hh:mm A")
                        : ""
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="inline-block px-2 py-1 text-[10px] md:text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                          title="Adjust Time Out"
                        >
                          Adjust Time
                        </button>
                      </div>
                    )}
                  </td>


                  {/* Total Hours */}
                  <td className="px-1 py-1 text-[8px] md:text-xs text-right font-medium whitespace-nowrap">
                    {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                  </td>

                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={calculateColSpan() + 1} className="text-center py-4 text-gray-500">
                No records found for the selected date range.
              </td>
            </tr>
          )}
        </tbody>

      </table>
    </div>
  );
};



return (
    
  <div className="ml-0 lg:ml-[200px] mt-[80px] sm:mt-[70px] p-3 sm:p-4 bg-gray-100 min-h-screen">
    {/* Header */}
    <div className="bg-blue-800 px-3 py-2 sm:p-3 rounded-lg text-white flex flex-row items-center justify-between gap-3 mb-3 w-full shadow-lg">
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-light leading-none">
          <span className="kanit-text">Today</span>
        </p>
        <h1 className="text-sm sm:text-lg md:text-2xl font-extrabold leading-tight truncate">
          {currentDate.format("MMMM DD, YYYY")}
        </h1>
      </div>

      <div className="text-right shrink-0">
        <p className="text-[9px] sm:text-xs font-extrabold leading-none mb-1">Philippine Standard Time</p>
        <p className="text-base sm:text-2xl font-bold leading-none">{time || "00:00 PM"}</p>
      </div>
    </div>

<div className="flex flex-col md:flex-row justify-center gap-4 w-full">

    <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-md flex-1">
        <div className="w-full flex flex-col lg:flex-row lg:items-start lg:gap-4 lg:mb-4">


        {isImageCaptureRequired && (
            <div className="order-1 lg:order-0 max-w-[390px] lg:w-[390px] lg:h-full mb-4 lg:mb-0 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] sm:text-[14px] text-blue-900 space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Face Verification</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] sm:text-[14px] font-bold ${faceStatus.ready ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {faceStatus.ready ? 'READY' : 'WAITING'}
                    </span>
                </div>
                <div>{faceStatus.message}</div>
                <div className="text-[12px] sm:text-[14px] pt-2 sm:pt-4 text-blue-700">
                    Match threshold: {faceStatus.threshold?.toFixed?.(2) ?? FACE_MATCH_THRESHOLD.toFixed(2)} • Registered references: {registeredFaceCount}
                </div>
                <div className="text-[12px] sm:text-[14px] pt-2 sm:pt-4 text-blue-700">
                    Live challenge: {livenessChallenge?.label || "Blink naturally or turn your head slightly left/right"}
                </div>
                <div className={`text-[12px] sm:text-[14px] pt-2 sm:pt-4 ${livenessStatus.passed ? 'text-green-700' : livenessStatus.running ? 'text-amber-700' : 'text-blue-700'}`}>
                    {livenessStatus.message}
                </div>
                <div className="text-[12px] sm:text-[14px] text-blue-700 pt-2 sm:pt-4">
                    Tips: center your face, keep the device steady, and look at the camera in normal lighting.
                </div>
            </div>
        )}

                {isImageCaptureRequired && (
            <div className="order-2 lg:order-1 flex-1">
                <div className="relative w-full max-w-[390px] mx-auto lg:mx-0 mb-4 lg:mb-0">
                    <video
                        ref={videoRef}
                        width={320}
                        height={240}
                        autoPlay
                        playsInline
                        muted
                        className="bg-black rounded-lg shadow-md transform scale-x-[-1] w-full h-auto"
                    />
                    <canvas ref={canvasRef} width={320} height={240} className="hidden" />

                    {capturing && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-7xl sm:text-8xl font-bold z-50 rounded-lg">
                            {countdown > 0 ? countdown : "📸"}
                        </div>
                    )}
                </div>
            </div>
        )}

        </div>

        {/* Buttons */}
        <div className="w-full grid grid-cols-2 gap-4">
            <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("TIME IN")}
            disabled={!actionState.canTimeIn}
            >
            Time In
            </button>
            <button
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("BREAK IN")}
            disabled={!actionState.canBreakIn}
            >
            Break In
            </button>
            <button
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("BREAK OUT")}
            disabled={!actionState.canBreakOut}
            >
            Break Out
            </button>
            <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("TIME OUT")}
            disabled={!actionState.canTimeOut}
            >
            Time Out
            </button>
        </div>

    </div>

  {/* Time In/Out Record */}
  <div className="w-full md:w-1/3 p-4 bg-white rounded-lg shadow-md flex flex-col">

 <p className="text-blue-800 text-[14px] md:text-lg mb-2">
      <span className="font-extrabold">{branchLocation.branchname}</span> 
   </p>

   <p className="text-gray-800 text-[14px] md:text-sm mb-6">
        <span className="font-bold">Branch Location:</span> {branchLocation.address}
    </p>

    <p className="text-blue-800 text-[14px] md:text-lg mb-2">
      <span className="font-extrabold">🕐 Time In:</span> {todayRecord?.time_in ? dayjs(todayRecord.time_in).format("hh:mm:ss A") : "Not Recorded"}
   </p>

    {isLocationRequired && (
    <p className="text-gray-800 text-[14px] md:text-sm mb-4">
        <span className="font-bold">📍Location:</span> {todayRecord?.time_in_address || "Not Recorded"}
    </p>
    )}

<p className="text-red-800 text-[14px] md:text-lg mb-2">
      <span className="font-extrabold">🕐 Break In:</span> {todayRecord?.break_in ? dayjs(todayRecord.break_in).format("hh:mm:ss A") : "Not Recorded"}
   </p>

   {isLocationRequired && (
    <p className="text-gray-800 text-[14px] md:text-sm mb-4">
        <span className="font-bold">📍Location:</span> {todayRecord?.break_in_address || "Not Recorded"}
    </p>
    )}

    <p className="text-red-800 text-[14px] md:text-lg mb-2">
      <span className="font-extrabold">🕐 Break Out:</span> {todayRecord?.break_out ? dayjs(todayRecord.break_out).format("hh:mm:ss A") : "Not Recorded"}
   </p>

   {isLocationRequired && (
    <p className="text-gray-800 text-[14px] md:text-sm mb-4">
        <span className="font-bold">📍Location:</span> {todayRecord?.break_out_address || "Not Recorded"}
    </p>
    )}

    <p className="text-blue-800 text-[14px] md:text-lg mb-2">
      <span className="font-bold">🕐 Time Out:</span> {todayRecord?.time_out ? dayjs(todayRecord.time_out).format("hh:mm:ss A") : "Not Recorded"}
    </p>

    {isLocationRequired && (
    <p className="text-gray-800 text-[14px] md:text-sm mb-4">
        <span className="font-bold">📍Location:</span> {todayRecord?.time_out_address || "Not Recorded"}
    </p>
    )}


  </div>

</div>


    <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
      <div className="">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-base font-bold mb-4">Daily Time Record</h1>
      
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        {/* Left: Date filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:max-w-xl w-full">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-w-0 text-[16px] h-10 px-3 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-w-0 text-[16px] h-10 px-3 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
              />
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:justify-end">
          {/* Export Button */}
          <button
            onClick={handleExport}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Export
          </button>

          {/* DTR Adjustment */}
          <button
            onClick={() => navigate('/timekeepingAdj')}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            DTR Adjustment
          </button>

          {/* DTR Confirmation */}
          <button
            onClick={handleDtrConfirmation}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            DTR Confirmation
          </button>
        </div>
      </div>




          {/* View Mode Toggle */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 mb-4">
            <button
                onClick={() => setViewMode('cards')}
                className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === 'cards'
                    ? 'bg-blue-600 text-white border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
                Cards
            </button>
            {/* <button
                onClick={() => setViewMode('accordion')}
                className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === 'accordion'
                    ? 'bg-blue-600 text-white border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
                Accordion
            </button> */}
            <button
                onClick={() => setViewMode('table')}
                className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === 'table'
                    ? 'bg-blue-600 text-white border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
                Compact
            </button>
            <button
                onClick={() => setViewMode('tableSummary')}
                className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === 'tableSummary'
                    ? 'bg-blue-600 text-white border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
                Detailed
            </button>
            <button
                onClick={() => setViewMode('summary')}
                className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === 'summary'
                    ? 'bg-blue-600 text-white border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
                Simple
            </button>
            </div>


        </div>

        {/* Content */}
        {viewMode === 'cards' && <CardView filteredRecords={filteredRecords} />}
        {/* {viewMode === 'cards' && <CardView filteredRecords={filteredRecords} isImageCaptureRequired={isImageCaptureRequired} isLocationRequired={isLocationRequired} IMAGE_BASE_URL={IMAGE_BASE_URL} />} */}
        {viewMode === 'accordion' && <AccordionView filteredRecords={filteredRecords} />}
        {viewMode === 'table' && <CompactTableView filteredRecords={filteredRecords} />}
        {viewMode === 'tableSummary' && <FullTableView filteredRecords={filteredRecords} />}
        {viewMode === 'summary' && <FullSummaryView filteredRecords={filteredRecords} />}
        {/* Total */}
        <div className="mt-6 bg-blue-50 p-2 rounded-lg">
            <div className="flex justify-between items-center">
                <div className="px-2 py-1 text-xs md:text-sm font-bold text-gray-700">
                Total Hours:
                </div>
                <div className="px-2 py-1 text-right text-xs md:text-sm font-bold text-gray-900">
                {totalWorkedHours.toFixed(2)} hrs
                </div>
            </div>
        </div>

      </div>

    </div>
    <SpinnerOverlay show={loading.show} message={loading.message} />
  </div>
);

};


export default Timekeeping;
