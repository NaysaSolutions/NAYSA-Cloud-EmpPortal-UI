import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import * as faceapi from "face-api.js";
import API_ENDPOINTS, { IMAGE_BASE_URL } from "@/apiConfig.jsx";
import { ChevronDown, ChevronUp, Download, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Timekeeping = ({ onBreakStart }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isLocationRequired, setIsLocationRequired] = useState(true);
  const [isImageCaptureRequired, setIsImageCaptureRequired] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [faceDetectionModelLoaded, setFaceDetectionModelLoaded] = useState(false);
  const [currentUserFaceDescriptor, setCurrentUserFaceDescriptor] = useState(null);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [time, setTime] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [breaktimeIn, setBreakIn] = useState("");
  const [breaktimeOut, setBreakOut] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState({ show: false, message: "" });

  const [userLocation, setUserLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const locationWatchIdRef = useRef(null);
  const lastGoodLocationRef = useRef(null);
  const revGeoCacheRef = useRef(new Map());

  const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));

  const [viewMode, setViewMode] = useState("cards");
  const [expandedRecord, setExpandedRecord] = useState(null);

  const roundCoord = (n, p = 5) => Number(n).toFixed(p);

  const COMPANY_LOCATION = {
    address: "Vernida I Building, 120 Amorsolo Street, Legazpi Village, Makati City, Metro Manila, Philippines",
    coordinates: {
      latitude: 14.555879228816387,
      longitude: 121.01474453024396,
    },
    allowedRadius: 50,
  };

  const reverseGeocode = async (lat, lon) => {
    const key = `${roundCoord(lat, 5)},${roundCoord(lon, 5)}`;
    if (revGeoCacheRef.current.has(key)) return revGeoCacheRef.current.get(key);

    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: { lat, lon, format: "json" },
        timeout: 8000,
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
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c <= radiusMeters;
  };

  const GEO_WATCH_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 15000,
  };

  const ACCEPTABLE_ACCURACY_METERS = 60;

  const startLocationWatch = useCallback(() => {
    if (!navigator.geolocation) return;
    if (locationWatchIdRef.current != null) return;

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const payload = { latitude, longitude, accuracy, ts: Date.now() };

        setUserLocation({ latitude, longitude });
        setLocationAccuracy(accuracy);

        if (
          !lastGoodLocationRef.current ||
          (accuracy != null && accuracy < lastGoodLocationRef.current.accuracy)
        ) {
          lastGoodLocationRef.current = payload;
        }

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

  const {
    data: empBranchLoc = null,
    isLoading: isBranchLoading,
  } = useQuery({
    queryKey: ["emp-branch-location", user?.empNo],
    enabled: !!user?.empNo,
    queryFn: async () => {
      const response = await axios.get(`${API_ENDPOINTS.getEmpBranchLoc}/${user.empNo}`);
      if (response?.data?.success && response?.data?.records?.length > 0) {
        const fetchedLocation = response.data.records[0];
        return {
          address: fetchedLocation.address,
          coordinates: {
            latitude: fetchedLocation.latitude,
            longitude: fetchedLocation.longitude,
          },
          allowedRadius: fetchedLocation.allowedRadius,
          branchname: fetchedLocation.branchname,
          geofence: fetchedLocation.geofence,
        };
      }
      return null;
    },
    refetchOnWindowFocus: false,
  });

  const branchLocation = empBranchLoc || COMPANY_LOCATION;

  useEffect(() => {
    if (empBranchLoc) {
      setIsLocationRequired(!!Number(empBranchLoc.geofence));
    }
  }, [empBranchLoc]);

  useEffect(() => {
    if (!isImageCaptureRequired) return;

    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
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
      } catch (error) {
        console.error("Model loading error:", error);
        Swal.fire("Error", "Face detection models failed to load. Please refresh.", "error");
      }
    };

    loadModels();
  }, [isImageCaptureRequired]);

  useEffect(() => {
    if (!isImageCaptureRequired) return;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
        });
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
        if (isImageCaptureRequired) {
          Swal.fire(
            "Camera Error",
            "Could not access webcam. Please ensure it's connected and permissions are granted.",
            "error"
          );
        }
      }
    };

    if (faceDetectionModelLoaded) {
      initCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [faceDetectionModelLoaded, isImageCaptureRequired]);

  useEffect(() => {
    if (!isImageCaptureRequired) {
      setCurrentUserFaceDescriptor(null);
      return;
    }

    const loadCurrentUserDescriptor = async () => {
      if (!user?.empNo || !faceDetectionModelLoaded) return;

      const empNo = user.empNo;
      const imageUrl = `/images/${empNo}.jpg`;

      try {
        const img = await faceapi.fetchImage(imageUrl);
        const detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          setCurrentUserFaceDescriptor(detection.descriptor);
        } else {
          Swal.fire(
            "Warning",
            "No registered face found for your profile. Please contact HR/Admin.",
            "warning"
          );
        }
      } catch (err) {
        console.warn("Face model not found:", err.message);

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
      }
    };

    loadCurrentUserDescriptor();
  }, [user?.empNo, faceDetectionModelLoaded, isImageCaptureRequired]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
      setCurrentDate(dayjs().tz("Asia/Manila"));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const requestNewImageId = useCallback(async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.getNewImageId);
      if (response.data.success) {
        return response.data.id;
      }
      throw new Error(response.data.message || "Failed to get a new image ID.");
    } catch (err) {
      console.error("Error fetching new image ID:", err);
      return `local_${Date.now()}`;
    }
  }, []);

  const verifyFace = useCallback(
    async (imageDataUrl) => {
      if (!faceDetectionModelLoaded || !currentUserFaceDescriptor) {
        Swal.fire("Error", "Face models or your reference data not loaded.", "error");
        return false;
      }

      try {
        const img = await faceapi.fetchImage(imageDataUrl);
        const detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          Swal.fire("Error", "No face detected in the captured image.", "error");
          return false;
        }

        const faceMatcher = new faceapi.FaceMatcher(currentUserFaceDescriptor, 0.6);
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        if (bestMatch.distance < 0.6) {
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
    },
    [faceDetectionModelLoaded, currentUserFaceDescriptor]
  );

  const saveCapturedFaceImage = useCallback(async (imageDataUrl, imageId) => {
    const response = await axios.post(API_ENDPOINTS.saveImage, {
      imageId,
      imageData: imageDataUrl,
    });

    if (response.data.success) {
      return { id: imageId, path: response.data.path };
    }

    throw new Error(response.data.message || "Failed to save image on server.");
  }, []);

  const trackFaceMovement = async (videoElement) => {
    const result = await faceapi.detectSingleFace(videoElement).withFaceLandmarks();
    return !!result;
  };

  const captureImageProcess = useCallback(
    (type) => {
      return new Promise((resolve, reject) => {
        setCapturing(true);
        setCountdown(3);

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

                try {
                  const isLive = await trackFaceMovement(videoRef.current);
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

                const ctx = canvasRef.current.getContext("2d");
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(
                  videoRef.current,
                  -canvasRef.current.width,
                  0,
                  canvasRef.current.width,
                  canvasRef.current.height
                );
                ctx.restore();

                const imageDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.92);

                try {
                  const isVerified = await verifyFace(imageDataUrl);
                  if (!isVerified) {
                    reject(new Error("Failed to detect Face."));
                    return;
                  }

                  const newImageId = await requestNewImageId();
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
    },
    [verifyFace, requestNewImageId, saveCapturedFaceImage]
  );

  const {
    data: records = [],
    isLoading: isRecordsLoading,
    refetch: refetchDTRRecords,
  } = useQuery({
    queryKey: ["dtr-records", user?.empNo, startDate, endDate],
    enabled: !!user?.empNo && !!startDate && !!endDate,
    queryFn: async () => {
      const response = await axios.get(
        `${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${startDate}/${endDate}`
      );

      if (response.data.success) {
        return response.data.records || [];
      }

      return [];
    },
    refetchOnWindowFocus: false,
  });

  const todayRecord = useMemo(() => {
    return records.find((r) => r.date === dayjs().format("YYYY-MM-DD")) || null;
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const recordDate = dayjs(record.date);
      const isAfterStart = startDate ? recordDate.isSameOrAfter(dayjs(startDate), "day") : true;
      const isBeforeEnd = endDate ? recordDate.isSameOrBefore(dayjs(endDate), "day") : true;
      return isAfterStart && isBeforeEnd;
    });
  }, [records, startDate, endDate]);

  const totalWorkedHours = useMemo(() => {
    return filteredRecords.reduce((total, record) => {
      return total + (Number(record.worked_hrs) || 0);
    }, 0);
  }, [filteredRecords]);

  const upsertTimeEventMutation = useMutation({
    mutationFn: async (eventData) => {
      const response = await axios.post(API_ENDPOINTS.upsertTimeIn, eventData);
      return response.data;
    },
    onSuccess: async (data) => {
      if (data.status === "success") {
        await queryClient.invalidateQueries({ queryKey: ["dtr-records", user?.empNo] });

        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Record saved successfully!",
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
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.message || "Failed to save record.",
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
    },
    onError: (err) => {
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
    },
  });

  const confirmDTRMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axios.post(API_ENDPOINTS.confirmDTR, payload);
      return response.data;
    },
    onSuccess: async (data) => {
      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ["dtr-records", user?.empNo] });

        Swal.fire({
          icon: "success",
          title: "DTR Confirmed",
          text: data.message || "Your DTR has been confirmed.",
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
      } else {
        Swal.fire("Error", data.message || "Unable to confirm DTR.", "error");
      }
    },
    onError: (err) => {
      Swal.fire(
        "Error",
        err.response?.data?.message || err.message || "Unable to confirm DTR.",
        "error"
      );
    },
  });

  const handleTimeEvent = async (type) => {
    if (!user?.empNo) {
      Swal.fire("Error", "Employee number not available. Please log in.", "error");
      return;
    }

    const getPosition = (opts) =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser."));
          return;
        }

        let done = false;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          reject(new Error("Location request timed out."));
        }, Math.max(1000, (opts?.timeout ?? 8000) + 500));

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(pos);
          },
          (err) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            reject(err);
          },
          opts
        );
      });

    const getBestCoords = async () => {
      let pos = await getPosition({
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 15000,
      });

      const a1 = Number(pos?.coords?.accuracy ?? 999999);

      if (a1 > 80) {
        pos = await getPosition({
          enableHighAccuracy: true,
          timeout: 9000,
          maximumAge: 0,
        });
      }

      const { latitude, longitude, accuracy } = pos.coords;
      return { latitude, longitude, accuracy: Number(accuracy ?? 0) };
    };

    try {
      let userCoords = null;
      let address = "N/A";
      let capturedImageInfo = null;
      let reverseGeocodePromise = null;

      if (isLocationRequired) {
        setLoading({ show: true, message: "Getting your location..." });

        try {
          userCoords = await Promise.race([
            getBestCoords(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Location timeout fallback")), 6000)
            ),
          ]);
        } catch (e) {
          console.warn("Location fallback triggered:", e.message);
          userCoords = lastGoodLocationRef.current || null;
        }

        if (!userCoords) {
          setLoading({ show: false, message: "" });
          Swal.fire("Location Error", "Unable to get your current location.", "error");
          return;
        }

        if (Number(branchLocation?.geofence) === 1) {
          const isAllowedLocation = isWithinRadius(
            userCoords.latitude,
            userCoords.longitude,
            branchLocation.coordinates.latitude,
            branchLocation.coordinates.longitude,
            branchLocation.allowedRadius
          );

          if (!isAllowedLocation) {
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

      if (isImageCaptureRequired) {
        setLoading({ show: true, message: `Preparing camera for ${type}...` });
        capturedImageInfo = await captureImageProcess(type);

        if (!capturedImageInfo || !capturedImageInfo.id) {
          setLoading({ show: false, message: "" });
          Swal.fire("Failed", "Image capture or face verification failed.", "error");
          return;
        }
      }

      if (isLocationRequired && reverseGeocodePromise) {
        address = (await reverseGeocodePromise) || "N/A";
        setLocationAddress(address);
      }

      setLoading({ show: false, message: "" });

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

      if (isImageCaptureRequired && capturedImageInfo) {
        if (type === "TIME IN") {
          setTimeIn(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
          timeInImageIdToSend = capturedImageInfo.id;
          timeInImagePath = capturedImageInfo.path;
        } else if (type === "TIME OUT") {
          setTimeOut(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
          timeOutImageIdToSend = capturedImageInfo.id;
          timeOutImagePath = capturedImageInfo.path;
        } else if (type === "BREAK IN") {
          setBreakIn(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
          breakInImageIdToSend = capturedImageInfo.id;
          breakInImagePath = capturedImageInfo.path;
        } else if (type === "BREAK OUT") {
          setBreakOut(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
          breakOutImageIdToSend = capturedImageInfo.id;
          breakOutImagePath = capturedImageInfo.path;
        }
      } else {
        if (type === "TIME IN") setTimeIn(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
        if (type === "TIME OUT") setTimeOut(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
        if (type === "BREAK IN") setBreakIn(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
        if (type === "BREAK OUT") setBreakOut(dayjs().tz("Asia/Manila").format("hh:mm:ss A"));
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
            locationAccuracy: userCoords?.accuracy ?? null,
            locationAddress: address,
          },
        },
      ];

      await upsertTimeEventMutation.mutateAsync(eventData);
    } catch (err) {
      setLoading({ show: false, message: "" });
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
    }
  };

  const handleExport = () => {
    const employeeNumber = String(user?.empno).padStart(10, "0") || "N/A";
    const formattedStartDate = startDate ? dayjs(startDate).format("YYYYMMDD") : "";
    const formattedEndDate = endDate ? dayjs(endDate).format("YYYYMMDD") : "";
    const dateRange =
      formattedStartDate && formattedEndDate ? `${formattedStartDate}-${formattedEndDate}` : "";

    const headerColumns = ["Employee No.", "Employee Name", "Date", "Time In"];
    if (isLocationRequired) headerColumns.push("Time In Location");
    headerColumns.push("Break In", "Break Out", "Time Out");
    if (isLocationRequired) headerColumns.push("Time Out Location");
    headerColumns.push("Worked (hrs)");

    const csvRows = filteredRecords.map((record) => {
      const row = [
        `"${employeeNumber}"`,
        `"${record.empName}"`,
        `"${dayjs(record.date).format("MM/DD/YYYY")}"`,
        `"${record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`,
      ];

      if (isLocationRequired) {
        row.push(`"${record.time_in_address || "N/A"}"`);
      }

      row.push(
        `"${record.break_in ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`,
        `"${record.break_out ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`,
        `"${record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`
      );

      if (isLocationRequired) {
        row.push(`"${record.time_out_address || "N/A"}"`);
      }

      row.push(`"${record.worked_hrs != null ? Number(record.worked_hrs).toFixed(2) : "0.00"}"`);
      return row.join(",");
    });

    const timeOutIndex = headerColumns.indexOf("Time Out Location");
    const totalRow = Array(headerColumns.length).fill("");
    totalRow[timeOutIndex >= 0 ? timeOutIndex : headerColumns.length - 2] = '"Total Hours"';
    totalRow[headerColumns.length - 1] = totalWorkedHours.toFixed(2);

    const csvContent = [
      headerColumns.map((col) => `"${col}"`).join(","),
      ...csvRows,
      totalRow.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `DTR-${employeeNumber}-${dateRange}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    await confirmDTRMutation.mutateAsync({
      empNo: user.empNo,
      startDate,
      endDate,
    });
  };

  const SpinnerOverlay = ({ show, message }) => {
    if (!show) return null;
    return (
      <div className="fixed inset-0 z-[9999] bg-black/40 flex flex-col items-center justify-center">
        <div className="h-12 w-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        {message && <p className="mt-3 text-white text-sm font-medium text-center px-4">{message}</p>}
      </div>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const CardView = ({ filteredRecords }) => {
    const navigate = useNavigate();
    const isBlank = (v) => v == null || String(v).trim() === "";

    const handleAdjustClick = (record) => {
      navigate("/timekeepingAdj", { state: { record } });
    };

    const handleOffsetClick = (record) => {
      navigate("/offsetApplication", { state: { record } });
    };

    return (
      <div className="space-y-2">
        {filteredRecords.map((record, index) => {
          const isFinal = record.stat === "F";
          const hasCompleteTime = !isBlank(record.time_in) && !isBlank(record.time_out);
          const canAdjust = !isFinal && !hasCompleteTime;
          const canOffset = isFinal && hasCompleteTime;

          return (
            <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{formatDate(record.date)}</h3>
                    {isFinal && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                        FINAL
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                  </p>
                </div>

                <div className="text-right">
                  <div className="font-mono text-xs sm:text-sm">
                    {record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"} •{" "}
                    {record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}
                  </div>

                  {canAdjust && (
                    <button
                      onClick={() => handleAdjustClick(record)}
                      className="mt-2 px-3 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md"
                    >
                      Adjust Time
                    </button>
                  )}

                  {canOffset && (
                    <button
                      onClick={() => handleOffsetClick(record)}
                      className="mt-2 ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                    >
                      Apply Offset
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const AccordionView = ({ filteredRecords }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {filteredRecords.map((record, index) => (
        <div key={index} className="border-b border-gray-200 last:border-b-0">
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
                  {record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"} -{" "}
                  {record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-blue-600">
                    {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                  </div>
                </div>
                {expandedRecord === index ? (
                  <ChevronUp size={20} className="text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-400" />
                )}
              </div>
            </div>
          </button>

          {expandedRecord === index && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <div className="space-y-4 pt-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-700 mb-2">Break Time</div>
                  <div className="text-sm text-gray-600">
                    {record.break_in ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"} -{" "}
                    {record.break_out ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}
                  </div>
                </div>

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

                {isLocationRequired && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-3">Locations</div>
                    <div className="space-y-2">
                      <div className="text-[13px] sm:text-sm flex items-start gap-2">
                        <div className="w-16 text-gray-500 flex-shrink-0">In:</div>
                        <div className="text-gray-700">{record.time_in_address || "N/A"}</div>
                      </div>
                      <div className="text-[13px] sm:text-sm flex items-start gap-2">
                        <div className="w-16 text-gray-500 flex-shrink-0">Out:</div>
                        <div className="text-gray-700">{record.time_out_address || "N/A"}</div>
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

    const handleOffsetClick = (record) => {
      navigate("/offsetApplication", { state: { record } });
    };

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <tbody>
              {filteredRecords.map((record, index) => {
                const isFinal = record.stat === "F";
                const hasCompleteTime = record.time_in && record.time_out;
                const isIncomplete = !hasCompleteTime;
                const canOffset = isFinal && hasCompleteTime;

                return (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{dayjs(record.date).format("MM/DD/YYYY")}</td>
                    <td className="px-3 py-2">
                      {record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : "Missing"} -{" "}
                      {record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : "Missing"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {record.worked_hrs ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}

                      {isIncomplete && !isFinal && (
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="ml-2 px-2 py-1 text-xs bg-yellow-500 text-white rounded"
                        >
                          Adjust
                        </button>
                      )}

                      {canOffset && (
                        <button
                          onClick={() => handleOffsetClick(record)}
                          className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded"
                        >
                          Offset
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const FullTableView = ({ filteredRecords }) => {
    const isBlank = (v) => v == null || String(v).trim() === "";

    const handleAdjustClick = (record) => {
      navigate("/timekeepingAdj", { state: { record } });
    };

    const calculateColSpan = () => {
      let colSpan = 6;
      if (isLocationRequired) colSpan += 2;
      return colSpan;
    };

    return (
      <div className="mt-4 p-2 bg-white rounded-lg shadow-lg overflow-x-auto">
        <h2 className="text-base font-bold mb-4">Daily Time Record Summary</h2>

        <table className="min-w-full table-auto border-collapse">
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

                    <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                      {isFinal || !showAdjIn ? (
                        record.time_in ? dayjs(record.time_in, "HH:mm").format("hh:mm A") : ""
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

                    <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                      {record.break_in ? dayjs(record.break_in, "HH:mm").format("hh:mm A") : "N/A"} -{" "}
                      {record.break_out ? dayjs(record.break_out, "HH:mm").format("hh:mm A") : "N/A"}
                    </td>

                    <td className="px-1 py-1 text-[6px] md:text-xs whitespace-nowrap">
                      {isFinal || !showAdjOut ? (
                        record.time_out ? dayjs(record.time_out, "HH:mm").format("hh:mm A") : ""
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

                    <td className="px-1 py-1 text-[6px] md:text-xs text-right font-medium whitespace-nowrap">
                      {record.worked_hrs != null ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={calculateColSpan()} className="text-center py-4 text-gray-500">
                  No records found for the selected date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const FullSummaryView = ({ filteredRecords }) => {
    const isBlank = (v) => v == null || String(v).trim() === "";

    const handleAdjustClick = (record) => {
      navigate("/timekeepingAdj", { state: { record } });
    };

    const handleOffsetClick = (record) => {
      navigate("/offsetApplication", { state: { record } });
    };

    return (
      <div className="mt-4 p-2 bg-white rounded-lg shadow-lg overflow-x-auto">
        <table className="min-w-full table-auto border-collapse">
          <tbody>
            {filteredRecords.map((record, index) => {
              const isFinal = record.stat === "F";
              const hasCompleteTime = !isBlank(record.time_in) && !isBlank(record.time_out);
              const canOffset = isFinal && hasCompleteTime;

              return (
                <tr key={index} className="border-b">
                  <td className="px-3 py-2">{dayjs(record.date).format("MM/DD/YYYY")}</td>
                  <td className="px-3 py-2">
                    {record.time_in ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A") : ""}
                  </td>
                  <td className="px-3 py-2">
                    {record.time_out ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A") : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {record.worked_hrs ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}

                    {!isFinal && !hasCompleteTime && (
                      <button
                        onClick={() => handleAdjustClick(record)}
                        className="ml-2 px-2 py-1 text-xs bg-yellow-500 text-white rounded"
                      >
                        Adjust
                      </button>
                    )}

                    {canOffset && (
                      <button
                        onClick={() => handleOffsetClick(record)}
                        className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded"
                      >
                        Offset
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[70px] p-4 sm:p-6 bg-gray-100 min-h-screen">
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

          <div className="w-full grid grid-cols-2 gap-4">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("TIME IN")}
              disabled={
                isImageCaptureRequired
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.time_in
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
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.break_in ||
                    !todayRecord?.time_in
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
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.break_out ||
                    !todayRecord?.break_in
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
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.time_out ||
                    !todayRecord?.time_in
                  : !!todayRecord?.time_out || !todayRecord?.time_in
              }
            >
              Time Out
            </button>
          </div>
        </div>

        <div className="w-full md:w-1/3 p-4 bg-white rounded-lg shadow-md flex flex-col">
          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">{branchLocation.branchname}</span>
          </p>

          <p className="text-gray-800 text-[14px] md:text-sm mb-6">
            <span className="font-bold">Branch Location:</span> {branchLocation.address}
          </p>

          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Time In:</span>{" "}
            {todayRecord?.time_in ? dayjs(todayRecord.time_in).format("hh:mm:ss A") : "Not Recorded"}
          </p>

          {isLocationRequired && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span> {todayRecord?.time_in_address || "Not Recorded"}
            </p>
          )}

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break In:</span>{" "}
            {todayRecord?.break_in ? dayjs(todayRecord.break_in).format("hh:mm:ss A") : "Not Recorded"}
          </p>

          {isLocationRequired && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span> {todayRecord?.break_in_address || "Not Recorded"}
            </p>
          )}

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break Out:</span>{" "}
            {todayRecord?.break_out ? dayjs(todayRecord.break_out).format("hh:mm:ss A") : "Not Recorded"}
          </p>

          {isLocationRequired && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span> {todayRecord?.break_out_address || "Not Recorded"}
            </p>
          )}

          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-bold">🕐 Time Out:</span>{" "}
            {todayRecord?.time_out ? dayjs(todayRecord.time_out).format("hh:mm:ss A") : "Not Recorded"}
          </p>

          {isLocationRequired && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span> {todayRecord?.time_out_address || "Not Recorded"}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
        <div className="mb-6">
          <h1 className="text-base font-bold mb-4">Daily Time Record</h1>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:max-w-xl w-full">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-w-0 text-[16px] h-10 px-3 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
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

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:justify-end">
              <button
                onClick={handleExport}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Export
              </button>

              <button
                onClick={() => navigate("/offsetApplication", { state: { fromDTR: true } })}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Offset Application
              </button>

              <button
                onClick={() => navigate("/timekeepingAdj")}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                DTR Adjustment
              </button>

              <button
                onClick={handleDtrConfirmation}
                disabled={confirmDTRMutation.isPending}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                DTR Confirmation
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "cards"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "table"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => setViewMode("tableSummary")}
              className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "tableSummary"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode("summary")}
              className={`flex-grow px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "summary"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Table
            </button>
          </div>
        </div>

        {isRecordsLoading ? (
          <div className="py-8 text-center text-gray-500">Loading records...</div>
        ) : (
          <>
            {viewMode === "cards" && <CardView filteredRecords={filteredRecords} />}
            {viewMode === "accordion" && <AccordionView filteredRecords={filteredRecords} />}
            {viewMode === "table" && <CompactTableView filteredRecords={filteredRecords} />}
            {viewMode === "tableSummary" && <FullTableView filteredRecords={filteredRecords} />}
            {viewMode === "summary" && <FullSummaryView filteredRecords={filteredRecords} />}

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
          </>
        )}
      </div>

      <SpinnerOverlay show={loading.show || upsertTimeEventMutation.isPending} message={loading.message} />
    </div>
  );
};

export default Timekeeping;