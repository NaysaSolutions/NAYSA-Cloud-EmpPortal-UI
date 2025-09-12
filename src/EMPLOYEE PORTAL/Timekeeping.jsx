import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from 'axios';

import dayjs from "dayjs";
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
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


    const [userLocation, setUserLocation] = useState(null);
    const geolocationOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    const [locationAddress, setLocationAddress] = useState("");

    
    const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

    const [viewMode, setViewMode] = useState('cards'); // 'cards', 'accordion', 'table'
    const [expandedRecord, setExpandedRecord] = useState(null);

    const navigate = useNavigate();

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
        address: "Vernida I Building, 120 Amorsolo Street, Legazpi Village, Makati City, Metro Manila, Philippines",
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

                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

                await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);

                console.log(faceapi.nets.ssdMobilenetv1);
                console.log(faceapi.nets.faceLandmark68Net);
                console.log(faceapi.nets.faceRecognitionNet);


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
                console.log('Loading models from:', '/models');
            } catch (error) {
                console.error("❌ Model loading error:", error);
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

        // Adjusted threshold to 0.6 for more reliable matching
        const faceMatcher = new faceapi.FaceMatcher(currentUserFaceDescriptor, 0.6); // Threshold adjusted to 0.6
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        // Logging the face descriptor and best match distance for debugging
        console.log('Best Match Distance:', bestMatch.distance);
        console.log('Detection Descriptor:', detection.descriptor);
        console.log('Registered Face Descriptor:', currentUserFaceDescriptor);

        if (bestMatch.distance < 0.6) {
            console.log(`✅ Face matched with distance: ${bestMatch.distance}`);
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
        // --- MODIFIED: Initialize variables to hold optional data ---
        let userCoords = null;
        let address = "N/A"; // Default value if location is not captured
        let capturedImageInfo = null;

        // --- MODIFIED: Conditionally check for location ---
        if (isLocationRequired) {
            Swal.fire({
                title: "Getting your location...",
                showConfirmButton: false,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

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
            
            userCoords = await getUserLocation();

            // 📍 Step 2: Reverse Geocode & Check Radius
            address = await reverseGeocode(userCoords.latitude, userCoords.longitude);
            setLocationAddress(address);

            // empBranchLoc.geofence
            console.log('Branch Location for Geofencing:', branchLocation.geofence);
            if (Number(branchLocation.geofence) === 1) { 
            const isAllowedLocation = isWithinRadius(
                userCoords.latitude,
                userCoords.longitude,
                branchLocation.coordinates.latitude,
                branchLocation.coordinates.longitude,
                branchLocation.allowedRadius
            );

            if (!isAllowedLocation) {
                Swal.fire({
                    title: "Location Error",
                    html: `
                        <p>You are not within the allowed location range.</p><br/>
                        <p><strong>📍Current Location:</strong><br/> ${address}</p><br/>
                        <p><strong>📍Assigned Location:</strong><br/> ${branchLocation.address}</p>
                    `,
                    icon: "error",
                    confirmButtonText: "Okay",
                });
                return; // Stop execution if location is not allowed
            }
        }
        Swal.close(); // Close location loading indicator
    }

        // --- MODIFIED: Conditionally capture and verify face ---
        if (isImageCaptureRequired) {
            // 📸 Step 4: Capture & Verify Face
            Swal.fire({
                title: `Please look at the camera for ${type}...`,
                text: "Preparing for capture...",
                showConfirmButton: false,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            capturedImageInfo = await captureImageProcess(type);
            if (!capturedImageInfo || !capturedImageInfo.id) {
                Swal.fire("Failed", "Image capture or face verification failed.", "error");
                return;
            }
        }
        
        Swal.close(); // Close any open Swal dialog

        // 🕒 Step 5: Prepare time data
        const currentTime = dayjs().format("HH:mm:ss");
        const currentDateStr = dayjs().format("YYYY-MM-DD");

        let timeInImageIdToSend = null;
        let timeOutImageIdToSend = null;
        let breakInImageIdToSend = null;
        let breakOutImageIdToSend = null;

        let timeInImagePath = null;
        let timeOutImagePath = null;
        let breakInImagePath = null;
        let breakOutImagePath = null;

        // --- MODIFIED: Only assign image info if it was captured ---
        if (isImageCaptureRequired && capturedImageInfo) {
            if (type === "TIME IN") {
                setTimeIn(dayjs().format("hh:mm:ss A"));
                timeInImageIdToSend = capturedImageInfo.id;
                timeInImagePath = capturedImageInfo.path;
            } else if (type === "TIME OUT") {
                setTimeOut(dayjs().format("hh:mm:ss A"));
                timeOutImageIdToSend = capturedImageInfo.id;
                timeOutImagePath = capturedImageInfo.path;
            } else if (type === "BREAK IN") {
                setBreakIn(dayjs().format("hh:mm:ss A"));
                breakInImageIdToSend = capturedImageInfo.id;
                breakInImagePath = capturedImageInfo.path;
            } else if (type === "BREAK OUT") {
                setBreakOut(dayjs().format("hh:mm:ss A"));
                breakOutImageIdToSend = capturedImageInfo.id;
                breakOutImagePath = capturedImageInfo.path;
            }
        } else {
             // If image capture is not required, just set the time display
            if (type === "TIME IN") setTimeIn(dayjs().format("hh:mm:ss A"));
            if (type === "TIME OUT") setTimeOut(dayjs().format("hh:mm:ss A"));
            if (type === "BREAK IN") setBreakIn(dayjs().format("hh:mm:ss A"));
            if (type === "BREAK OUT") setBreakOut(dayjs().format("hh:mm:ss A"));
        }


        // 📝 Step 6: Send data to backend
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
                    // --- MODIFIED: Use optional chaining to safely access coordinates ---
                    latitude: userCoords?.latitude ?? null,
                    longitude: userCoords?.longitude ?? null,
                    locationAddress: address
                },
            },
        ];

        console.log("Upsert Payload:", eventData);
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

    const fetchDTRRecords = useCallback(async () => {
        if (!user?.empNo || !startDate || !endDate) return;

        try {
            const response = await axios.get(`${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${startDate}/${endDate}`);
            
            if (response.data.success) {
                setRecords(response.data.records);
                const today = response.data.records.find(r => r.date === dayjs().format("YYYY-MM-DD"));
                setTodayRecord(today);
            }
            console.log("Successfully loaded:", records);
        } catch (error) {
            console.error("Error fetching DTR records:", error);
        }
    }, [user?.empNo, startDate, endDate]);

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
        //     row.push(`"${record.time_in_image_id ? `${IMAGE_BASE_URL}/${record.time_in_image_id}.jpeg` : "N/A"}"`);
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
        //     row.push(`"${record.time_out_image_id ? `${IMAGE_BASE_URL}/${record.time_out_image_id}.jpeg` : "N/A"}"`);
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


// Card View Component
const CardView = ({ filteredRecords }) => (
  <div className="space-y-2">
    {filteredRecords.map((record, index) => (
      <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200">
        {/* Card Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{formatDate(record.date)}</h3>
            <p className="text-sm text-gray-600">{record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">IN • OUT</div>
            <div className="font-mono text-xs sm:text-sm">
              {record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"} • {record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-3">
          {/* Break Times */}
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-600">Break</span>
            <span className="font-mono text-xs sm:text-sm">
              {record.break_in ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"} • {record.break_out ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}
            </span>
          </div>

          {/* Images and Locations */}
          {isImageCaptureRequired && (
            <div className="flex gap-3 flex-wrap">
              {/* Time In Image and Location */}
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Camera size={12} />
                  Time In
                </div>

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

                {isLocationRequired && (
                  <>
                    {record.time_in_address && (
                    <div className="flex-1 block items-start gap-2 mt-2 md:hidden">
                        <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="text-xs text-gray-500">Time In Location</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="text-[11px] text-gray-700">{record.time_in_address || 'N/A'}</div>
                        </div>
                    </div>
                    )}
                  </>
                )}
                
              </div>

               <div className="hidden flex-1 md:block">
                {isLocationRequired && (
                  <>
                    {record.time_in_address && (
                      <div className="flex gap-2">
                        <MapPin size={14} className="text-green-500" />
                        <div className="flex-1">
                            <div className="text-xs text-gray-500">Time In Location</div>
                            <div className="text-sm text-gray-700">{record.time_in_address || 'N/A'}</div>
                        </div>
                    </div>
                    )}
                  </>
                )}               
              </div>


              {/* Time Out Image and Location */}
              <div className="flex-1">

                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Camera size={12} />
                Time Out
                </div>

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



                {isLocationRequired && (
                  <>
                    {record.time_out_address && (
                    <div className="flex-1 block items-start gap-2 mt-2 md:hidden">
                        <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="text-xs text-gray-500">Time Out Location</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="text-[11px] text-gray-700">{record.time_out_address || 'N/A'}</div>
                        </div>
                    </div>
                    )}
                  </>
                )}

              </div>

               <div className="hidden flex-1 md:block">
                {isLocationRequired && (
                  <>
                    {record.time_out_address && (
                      <div className="flex gap-2 mt-2">
                        <MapPin size={14} className="text-red-500" />
                        <div className="flex-1">
                            <div className="text-xs text-gray-500">Time Out Location</div>
                            <div className="text-sm text-gray-700">{record.time_out_address || 'N/A'}</div>
                        </div>
                    </div>
                    )}
                  </>
                )}               
              </div>

            </div>
          )}
          
        </div>
      </div>
    ))}
  </div>
);

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
              <div className="font-semibold text-gray-900">{formatDate(record.date)}</div>
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
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Time Out</div>
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


// Compact Table View with date range filtering
const CompactTableView = ({ filteredRecords }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-3">
                    <div className="text-[12px] sm:text-sm font-medium text-gray-900">
                      {dayjs(record.date).format("MM/DD/YYYY")}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="text-[11px] sm:text-xs text-gray-600 space-y-1">
                      <div>In: {dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")}</div>
                      <div>Out: {dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")}</div>
                      <div className="text-[11px] sm:text-xs text-gray-400">
                        Break: {dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A")} - {dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A")}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="text-[11px] sm:text-sm font-semibold text-blue-600">
                      {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-2 py-3 text-center text-gray-500">
                  No records found for the selected date range.
                </td>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.length === 0 && (
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
const FullTableView = ({ filteredRecords }) => {
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
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-medium whitespace-nowrap">Date</th>
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-medium whitespace-nowrap">Time In</th>
            {isLocationRequired && (
              <th className="px-1 py-2 text-left text-[7px] md:text-sm font-medium whitespace-nowrap">Location</th>
            )}
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-medium whitespace-nowrap">Break Time</th>
            <th className="px-1 py-2 text-left text-[7px] md:text-sm font-medium whitespace-nowrap">Time Out</th>
            {isLocationRequired && (
              <th className="px-1 py-2 text-left text-[7px] md:text-sm font-medium whitespace-nowrap">Location</th>
            )}
            <th className="px-1 py-2 text-right text-[7px] md:text-sm font-medium whitespace-nowrap">Total hrs</th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record, index) => (
              <tr key={index}>
                <td className="px-1 py-1 text-[6px] md:text-xs">{dayjs(record.date).format("MM/DD/YYYY")}</td>
                <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                  {record.time_in ? dayjs(record.time_in, "HH:mm").format("hh:mm A") : "N/A"}
                </td>
                {isLocationRequired && (
                  <td className="px-1 py-1 text-[6px] md:text-xs max-w-[200px] break-words">
                    {record.time_in_address || "N/A"}
                  </td>
                )}
                <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                  {record.break_in ? dayjs(record.break_in, "HH:mm").format("hh:mm A") : "N/A"} - {record.break_out ? dayjs(record.break_out, "HH:mm").format("hh:mm A") : "N/A"}
                </td>
                <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                  {record.time_out ? dayjs(record.time_out, "HH:mm").format("hh:mm A") : "N/A"}
                </td>
                {isLocationRequired && (
                  <td className="px-1 py-1 text-[6px] md:text-xs max-w-[200px] break-words">
                    {record.time_out_address || "N/A"}
                  </td>
                )}
                <td className="px-1 py-1 text-[6px] md:text-xs text-right font-medium whitespace-nowrap">
                  {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                </td>
              </tr>
            ))
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
    
  <div className="ml-0 lg:ml-[200px] mt-[70px] p-4 sm:p-6 bg-gray-100 min-h-screen">
    {/* Header */}
    <div className="bg-blue-800 p-3 rounded-lg text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 w-full shadow-lg">
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

<div className="flex flex-col md:flex-row justify-center gap-6 w-full">

    <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-md flex-1">
        {/* Camera */}
        {isImageCaptureRequired && (
            <div className="relative w-full max-w-[320px] mb-4">
                <video
                    ref={videoRef}
                    width={320}
                    height={240}
                    autoPlay
                    playsInline
                    muted
                    className="bg-black rounded-lg shadow-md transform scale-x-[-1]"
                />
                <canvas ref={canvasRef} width={320} height={240} className="hidden" />

                {capturing && (
                    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-white text-9xl font-bold z-50">
                        {countdown > 0 ? countdown : "📸"}
                    </div>
                )}
            </div>
        )}

        {/* Buttons */}
        <div className="w-full grid grid-cols-2 gap-4">
            <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("TIME IN")}
            disabled={
                isImageCaptureRequired
                ? (capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor || !!todayRecord?.time_in)
                : !!todayRecord?.time_in
            }
            >
            Time In
            </button>
            <button
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("BREAK IN")}
            disabled={
                isImageCaptureRequired
                ? (capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor || !!todayRecord?.break_in || !todayRecord?.time_in)
                : !!todayRecord?.break_in || !todayRecord?.time_in
            }
            >
            Break In
            </button>
            <button
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("BREAK OUT")}
            disabled={
                isImageCaptureRequired
                ? (capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor || !!todayRecord?.break_out || !todayRecord?.break_in)
                : !!todayRecord?.break_out || !todayRecord?.break_in
            }
            >
            Break Out
            </button>
            <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
            onClick={() => handleTimeEvent("TIME OUT")}
            disabled={
                isImageCaptureRequired
                ? (capturing || !faceDetectionModelLoaded || !currentUserFaceDescriptor || !!todayRecord?.time_out || !todayRecord?.time_in)
                : !!todayRecord?.time_out || !todayRecord?.time_in
            }
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
<div className="flex flex-wrap sm:flex-nowrap gap-4 mb-4">
  {/* Start Date */}
  <div className="flex-1 min-w-[150px]">
    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
    <input
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      className="w-full px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>

  {/* End Date */}
  <div className="flex-1 min-w-[150px]">
    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
    <input
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      className="w-full px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>

  {/* Export Button */}
  <div className="flex-2 sm:w-auto sm:flex sm:items-end sm:ml-4">
    <button
      onClick={handleExport}
      className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
    >
      <Download size={16} />
      Export
    </button>
  </div>

    {/* Filing Button */}
  <div className="flex-2 sm:w-auto sm:flex sm:items-end sm:ml-4">
    <button
      onClick={() => navigate("/timekeepingAdj")}
      className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
    >
      DTR Adjustment
    </button>
  </div>

      {/* Approval Button */}
  <div className="flex-2 sm:w-auto sm:flex sm:items-end sm:ml-4">
    <button
      onClick={() => navigate("/timekeepingAdjApproval")}
      className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
    >
      DTR Approval
    </button>
  </div>

</div>

          {/* View Mode Toggle */}
            <div className="flex gap-2 mb-4">
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
            <button
                onClick={() => setViewMode('accordion')}
                className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === 'accordion'
                    ? 'bg-blue-600 text-white border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
                Accordion
            </button>
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
                Summary
            </button>
            </div>


        </div>

        {/* Content */}
        {viewMode === 'cards' && <CardView filteredRecords={filteredRecords} />}
        {/* {viewMode === 'cards' && <CardView filteredRecords={filteredRecords} isImageCaptureRequired={isImageCaptureRequired} isLocationRequired={isLocationRequired} IMAGE_BASE_URL={IMAGE_BASE_URL} />} */}
        {viewMode === 'accordion' && <AccordionView filteredRecords={filteredRecords} />}
        {viewMode === 'table' && <CompactTableView filteredRecords={filteredRecords} />}
        {viewMode === 'tableSummary' && <FullTableView filteredRecords={filteredRecords} />}
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
    
  </div>
);

};


export default Timekeeping;
