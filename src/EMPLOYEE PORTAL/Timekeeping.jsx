import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS, { IMAGE_BASE_URL } from "@/apiConfig.jsx";
import fetchApi from "@/fetchApi.js";
import { Download, MapPin, Camera, Image as ImageIcon, CalendarDays, Filter, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loadFaceIO } from "@/utils/faceioLoader";

import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import * as faceapi from "face-api.js";
import API_ENDPOINTS, { IMAGE_BASE_URL } from "@/apiConfig.jsx";
import fetchApi from "@/fetchApi.js";
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Camera,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const upsertTimeIn = (data) =>
  fetchApi(API_ENDPOINTS.upsertTimeIn, "POST", data);
<<<<<<< Updated upstream

export const saveImage = (data) =>
  fetchApi(API_ENDPOINTS.saveImage, "POST", data);

export const getNewImageIdApi = (data) =>
  fetchApi(API_ENDPOINTS.getNewImageId, "POST", data);

export const getDTRRecords = (data) =>
  fetchApi(API_ENDPOINTS.getDTRRecords, "POST", data);

export const getEmpBranchLoc = (empNo) =>
  fetchApi(`${API_ENDPOINTS.getEmpBranchLoc}/${empNo}`, "GET");

const PH_TIMEZONE = "Asia/Manila";
const ACCEPTABLE_ACCURACY_METERS = 300;
const LOCATION_CACHE_MAX_AGE_MS = 120000;
const LOCATION_QUICK_TIMEOUT_MS = 3500;
const LOCATION_WATCH_TIMEOUT_MS = 8000;

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;

  const latitude1 = Number(lat1);
  const longitude1 = Number(lon1);
  const latitude2 = Number(lat2);
  const longitude2 = Number(lon2);

  if (
    Number.isNaN(latitude1) ||
    Number.isNaN(longitude1) ||
    Number.isNaN(latitude2) ||
    Number.isNaN(longitude2)
  ) {
    return null;
  }

  const dLat = toRad(latitude2 - latitude1);
  const dLon = toRad(longitude2 - longitude1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latitude1)) *
      Math.cos(toRad(latitude2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const getBrowserPosition = (options) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const formatPositionCoords = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: Number(position.coords.accuracy ?? 999999),
  ts: Date.now(),
});

const Timekeeping = ({ onBreakStart }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const locationWatchIdRef = useRef(null);
  const lastGoodLocationRef = useRef(null);
  const revGeoCacheRef = useRef(new Map());

  const isProcessingTimeEventRef = useRef(false);

  const getBestCoords = async ({ forceFresh = false } = {}) => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser.");
    }

    const targetAccuracy = Math.min(
      ACCEPTABLE_ACCURACY_METERS,
      isMobileDevice() ? 100 : 300
    );
    const cached = lastGoodLocationRef.current;
    const cacheIsFresh =
      cached && Date.now() - cached.ts <= LOCATION_CACHE_MAX_AGE_MS;

    if (
      !forceFresh &&
      cacheIsFresh &&
      cached.accuracy <= targetAccuracy
    ) {
      console.log("Using cached app location:", cached);
      return cached;
    }

    try {
      const quickPosition = await getBrowserPosition({
        enableHighAccuracy: true,
        timeout: LOCATION_QUICK_TIMEOUT_MS,
        maximumAge: forceFresh ? 0 : LOCATION_CACHE_MAX_AGE_MS,
      });
      const quickCoords = formatPositionCoords(quickPosition);

      console.log("Quick location reading:", quickCoords);

      lastGoodLocationRef.current = quickCoords;
      setUserLocation({
        latitude: quickCoords.latitude,
        longitude: quickCoords.longitude,
      });
      setLocationAccuracy(quickCoords.accuracy);

      if (quickCoords.accuracy <= targetAccuracy) {
        return quickCoords;
      }
    } catch (error) {
      console.warn("Quick location unavailable:", error.code, error.message);
    }

    if (
      !forceFresh &&
      cacheIsFresh &&
      cached.accuracy <= Math.max(targetAccuracy, ACCEPTABLE_ACCURACY_METERS)
    ) {
      console.log("Using warm app location after quick attempt:", cached);
      return cached;
    }

    return new Promise((resolve, reject) => {
      let bestCoords =
        lastGoodLocationRef.current &&
        Date.now() - lastGoodLocationRef.current.ts <= LOCATION_CACHE_MAX_AGE_MS
          ? lastGoodLocationRef.current
          : null;
      let watchId = null;
      let settled = false;

      const cleanup = () => {
        if (watchId !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchId);
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();

        if (bestCoords) {
          settled = true;
          console.log("Using best available fresh location:", bestCoords);
          resolve(bestCoords);
        } else {
          settled = true;
          reject(new Error("Unable to get your location."));
        }
      }, isMobileDevice() ? LOCATION_WATCH_TIMEOUT_MS : LOCATION_WATCH_TIMEOUT_MS + 2000);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (settled) return;

          const coords = formatPositionCoords(position);

          console.log("Fresh location reading:", coords);

          if (!bestCoords || coords.accuracy < bestCoords.accuracy) {
            bestCoords = coords;
            lastGoodLocationRef.current = coords;
          }

          if (coords.accuracy <= targetAccuracy) {
            settled = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve(coords);
          }
        },
        (error) => {
          console.warn("Location watch error:", error.code, error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: isMobileDevice() ? LOCATION_WATCH_TIMEOUT_MS : LOCATION_WATCH_TIMEOUT_MS + 2000,
          maximumAge: forceFresh ? 0 : LOCATION_CACHE_MAX_AGE_MS,
        }
      );
    });
  };

const isLocationValidationRequired = (branchLocation) => {
  const geotagging = Number(branchLocation?.geotagging ?? 1);
  const geofence = Number(branchLocation?.geofence ?? 1);

  return geotagging === 1 && geofence === 1;
};

const validateGeofenceLocation = (userCoords, branchLocation) => {
  if (!branchLocation) {
    return {
      allowed: false,
      message: "Assigned location is not loaded. Please contact HR/Admin.",
    };
  }

  const geotagging = Number(branchLocation.geotagging ?? 1);
  const geofence = Number(branchLocation.geofence ?? 1);

  if (geotagging !== 1 || geofence !== 1) {
    return {
      allowed: true,
      message: "Location validation is disabled.",
      distance: 0,
      allowedRadius: 0,
      accuracy: Number(userCoords?.accuracy ?? 0),
    };
  }

  const assignedLat = Number(branchLocation.coordinates?.latitude);
  const assignedLng = Number(branchLocation.coordinates?.longitude);
  const allowedRadius = Number(branchLocation.allowedRadius ?? 50);

  const userLat = Number(userCoords?.latitude);
  const userLng = Number(userCoords?.longitude);
  const accuracy = Number(userCoords?.accuracy ?? 999999);

  const distance = getDistanceInMeters(
    userLat,
    userLng,
    assignedLat,
    assignedLng
  );

  if (distance === null) {
    return {
      allowed: false,
      message: "Unable to calculate location distance.",
    };
  }

  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const maxAllowedAccuracy = mobile
    ? Math.max(allowedRadius * 2, 100)
    : Math.max(allowedRadius * 10, 500);

  if (distance <= allowedRadius) {
    return {
      allowed: true,
      message: "Location verified.",
      distance,
      allowedRadius,
      accuracy,
    };
  }

  if (accuracy > maxAllowedAccuracy) {
    return {
      allowed: false,
      message: `Location accuracy is too low. Required accuracy: ${Math.round(maxAllowedAccuracy)} meters.`,
      distance,
      allowedRadius,
      accuracy,
    };
  }

  return {
    allowed: false,
    message: `You are outside your assigned ${allowedRadius} meters radius.`,
    distance,
    allowedRadius,
    accuracy,
  };
};

  const [isLocationRequired, setIsLocationRequired] = useState(true);
  const [isImageCaptureRequired, setIsImageCaptureRequired] = useState(true);

  const [faceDetectionModelLoaded, setFaceDetectionModelLoaded] = useState(false);
  const [currentUserFaceDescriptor, setCurrentUserFaceDescriptor] = useState(null);

  const [currentDate, setCurrentDate] = useState(dayjs().tz(PH_TIMEZONE));
  const [time, setTime] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [breaktimeIn, setBreakIn] = useState("");
  const [breaktimeOut, setBreakOut] = useState("");

  const [records, setRecords] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);

  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState({ show: false, message: "" });

  const [userLocation, setUserLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  const [startDate, setStartDate] = useState(
    dayjs().tz(PH_TIMEZONE).startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState(
    dayjs().tz(PH_TIMEZONE).endOf("month").format("YYYY-MM-DD")
  );

  const [viewMode, setViewMode] = useState("cards");
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [empBranchLoc, setEmpBranchLoc] = useState(null);

  const roundCoord = (n, p = 5) => Number(n).toFixed(p);

  const branchLocation = empBranchLoc;

  const reverseGeocode = async (lat, lon) => {
  const key = `${roundCoord(lat, 5)},${roundCoord(lon, 5)}`;

  if (revGeoCacheRef.current.has(key)) {
    return revGeoCacheRef.current.get(key);
  }

  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat,
          lon,
          format: "json",
          addressdetails: 1,
          zoom: 18,
        },
        timeout: 8000,
      }
    );

    const data = response.data || {};
    const address = data.address || {};

    const nearestLandmark =
      data.name ||
      address.building ||
      address.amenity ||
      address.shop ||
      address.tourism ||
      address.office ||
      "N/A";

    const streetLine = [address.house_number, address.road]
      .filter(Boolean)
      .join(" ");

    const actualCapturedParts = [
      streetLine,
      address.neighbourhood || address.suburb || address.village,
      address.city_district || address.district,
      address.city || address.municipality,
      address.state,
      address.postcode,
      address.country,
    ].filter(Boolean);

    const actualCapturedLocation =
      actualCapturedParts.length > 0
        ? [...new Set(actualCapturedParts)].join(", ")
        : data.display_name || "Unknown location";

    const result = {
      actualCapturedLocation,
      nearestLandmark,
      fullMapAddress: data.display_name || "Unknown location",
    };

    revGeoCacheRef.current.set(key, result);
    return result;
  } catch (err) {
    console.error("Reverse geocoding failed:", err);

    return {
      actualCapturedLocation: "Unknown location",
      nearestLandmark: "N/A",
      fullMapAddress: "Unknown location",
    };
  }
};


  const startLocationWatch = useCallback(() => {
    if (!navigator.geolocation) return;
    if (locationWatchIdRef.current != null) return;

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        const payload = {
          latitude,
          longitude,
          accuracy: Number(accuracy ?? 999999),
          ts: Date.now(),
        };

        console.log("Background fresh location:", payload);

        setUserLocation({ latitude, longitude });
        setLocationAccuracy(payload.accuracy);

        if (
          !lastGoodLocationRef.current ||
          payload.accuracy < lastGoodLocationRef.current.accuracy ||
          Date.now() - lastGoodLocationRef.current.ts > LOCATION_CACHE_MAX_AGE_MS
        ) {
          lastGoodLocationRef.current = payload;
        }

        // Stop watching once GPS is accurate enough for a 50-meter geofence.
        if (payload.accuracy <= 50) {
          navigator.geolocation.clearWatch(locationWatchIdRef.current);
          locationWatchIdRef.current = null;
        }
      },
      (err) => {
        console.warn("watchPosition error:", err.code, err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: LOCATION_WATCH_TIMEOUT_MS,
        maximumAge: LOCATION_CACHE_MAX_AGE_MS,
      }
    );
  }, []);


  useEffect(() => {
    if (!isLocationRequired) return;

    let cancelled = false;

    const initializeFreshLocation = () => {
      if (!cancelled) {
        startLocationWatch();
      }
    };

    initializeFreshLocation();

    return () => {
      cancelled = true;

      if (locationWatchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    };
  }, [isLocationRequired, startLocationWatch]);

  const fetchEmpBranchLoc = useCallback(async () => {
    if (!user?.empNo) return;

    const toNumberOrNull = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    try {
      const response = await getEmpBranchLoc(user.empNo);

      if (response.success && response.records && response.records.length > 0) {
        const fetchedLocation = response.records[0];

        const formattedLocation = {
          address: fetchedLocation.address ?? fetchedLocation.ADDRESS ?? "",
          branchcode:
            fetchedLocation.branchcode ??
            fetchedLocation.BRANCHCODE ??
            fetchedLocation.branchCode ??
            fetchedLocation.BRANCH_CODE ??
            "",
          branchname:
            fetchedLocation.branchname ??
            fetchedLocation.BRANCHNAME ??
            fetchedLocation.branchName ??
            fetchedLocation.BRANCH_NAME ??
            "",
          coordinates: {
            latitude: toNumberOrNull(
              fetchedLocation.latitude ??
                fetchedLocation.LATITUDE ??
                fetchedLocation.Latitude ??
                fetchedLocation.lat ??
                fetchedLocation.LAT
            ),
            longitude: toNumberOrNull(
              fetchedLocation.longitude ??
                fetchedLocation.LONGITUDE ??
                fetchedLocation.Longitude ??
                fetchedLocation.lng ??
                fetchedLocation.LNG ??
                fetchedLocation.long ??
                fetchedLocation.LONG
            ),
          },
          allowedRadius: Number(
            fetchedLocation.allowedRadius ??
              fetchedLocation.ALLOWEDRADIUS ??
              fetchedLocation.allowed_radius ??
              fetchedLocation.ALLOWED_RADIUS ??
              50
          ),
          geotagging: Number(
            fetchedLocation.geotagging ??
              fetchedLocation.GEOTAGGING ??
              fetchedLocation.geoTagging ??
              fetchedLocation.GEO_TAGGING ??
              fetchedLocation.geotag ??
              fetchedLocation.GEO_TAG ??
              1
          ),
          geofence: Number(
            fetchedLocation.geofence ??
              fetchedLocation.GEOFENCE ??
              fetchedLocation.geofencing ??
              fetchedLocation.GEOFENCING ??
              1
          ),
        };

        const locationValidationRequired = isLocationValidationRequired(formattedLocation);

        if (
          locationValidationRequired &&
          (!Number.isFinite(formattedLocation.coordinates.latitude) ||
            !Number.isFinite(formattedLocation.coordinates.longitude))
        ) {
          console.error("Invalid branch coordinates from API:", fetchedLocation);
          setEmpBranchLoc(null);
          setIsLocationRequired(true);
          showErrorToast(
            "Branch Location Error",
            "Invalid branch latitude/longitude. Please check branch setup."
          );
          return;
        }

        setEmpBranchLoc(formattedLocation);
        setIsLocationRequired(locationValidationRequired);

        console.log("Employee Branch Location:", formattedLocation);
      } else {
        setEmpBranchLoc(null);
        setIsLocationRequired(true);
        console.warn("No branch location records found. No hardcoded fallback will be used.");
      }
    } catch (error) {
      setEmpBranchLoc(null);
      setIsLocationRequired(true);
      console.error("Error fetching employee branch location:", error);
    }
  }, [user?.empNo]);

  useEffect(() => {
    fetchEmpBranchLoc();
  }, [fetchEmpBranchLoc]);

  useEffect(() => {
    console.log("Current Branch Location:", branchLocation);
  }, [branchLocation]);

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
        console.log("Face-API.js models loaded successfully");
      } catch (error) {
        console.error("Model loading error:", error);
        showErrorToast("Error", "Face detection models failed to load. Please refresh.");
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
        showErrorToast("Camera Error", "Could not access webcam. Please ensure it is connected and permissions are granted.");
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
          console.log(`Loaded face descriptor for employee: ${empNo}`);
        } else {
          showWarningToast(
  "Warning",
  "No registered face found for your profile. Please contact HR/Admin."
);
        }
      } catch (err) {
        console.warn("Face model not found:", err.message);

        showWarningToast(
  "Face Model Not Found",
  "You can still time-in/out but photo capture will be skipped."
);

        setIsImageCaptureRequired(false);
        setCurrentUserFaceDescriptor(null);
      }
    };

    loadCurrentUserDescriptor();
  }, [user?.empNo, faceDetectionModelLoaded, isImageCaptureRequired]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(dayjs().tz(PH_TIMEZONE).format("hh:mm:ss A"));
      setCurrentDate(dayjs().tz(PH_TIMEZONE));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const trackFaceMovement = async (videoElement) => {
    const result = await faceapi.detectSingleFace(videoElement).withFaceLandmarks();
    return !!result;
  };

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
        showErrorToast("Error", "No face detected in the captured image.");
        return false;
      }

      try {
        const img = await faceapi.fetchImage(imageDataUrl);
        const detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          showErrorToast("Error", "No face detected in the captured image.");
          return false;
        }

        const faceMatcher = new faceapi.FaceMatcher(currentUserFaceDescriptor, 0.6);
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        console.log("Best Match Distance:", bestMatch.distance);

        if (bestMatch.distance < 0.6) {
          return true;
        }

        showErrorToast("Access Denied", "Face does not match your registered profile.");
        return false;
      } catch (err) {
        console.error("Error during face verification:", err);
        showErrorToast("Verification Error", err.message);
        return false;
      }
    },
    [faceDetectionModelLoaded, currentUserFaceDescriptor]
=======
export const getDTRRecords = (data) =>
  fetchApi(API_ENDPOINTS.getDTRRecords, "POST", data);
export const getEmpBranchLoc = (empNo) =>
  fetchApi(`${API_ENDPOINTS.getEmpBranchLoc}/${empNo}`, "GET");

const MANILA_TZ = "Asia/Manila";
const ACCEPTABLE_ACCURACY_METERS = 60;
const CAMERA_CAPTURE_DELAY_MS = 450;

const resolveTenantCode = (user) => {
  const candidates = [
    user?.tenantCode,
    user?.tenant_code,
    user?.tenant,
    user?.companyCode,
    user?.company_code,
    user?.compCode,
    user?.comp_code,
    user?.code,
    typeof localStorage !== "undefined" ? localStorage.getItem("tenant") : null,
    typeof localStorage !== "undefined" ? localStorage.getItem("tenantCode") : null,
    typeof localStorage !== "undefined" ? localStorage.getItem("companyCode") : null,
  ];

  const match = candidates.find((value) => String(value || "").trim() !== "");
  return match ? String(match).trim() : null;
};

const toAbsoluteImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return path;
  return `/${String(path).replace(/^\/+/, "")}`;
};

const buildImageCandidates = (imageId, imagePath) => {
  const candidates = [];
  const absolutePath = toAbsoluteImageUrl(imagePath);

  if (absolutePath) candidates.push(absolutePath);

  if (imageId) {
    candidates.push(
      `${IMAGE_BASE_URL}/${imageId}.jpg`,
      `${IMAGE_BASE_URL}/${imageId}.jpeg`,
      `${IMAGE_BASE_URL}/${imageId}.png`
    );
  }

  return [...new Set(candidates.filter(Boolean))];
};

const HistoryImage = ({
  imageId,
  imagePath,
  alt,
  className = "rounded-lg w-full h-[110px] sm:h-[160px] object-cover",
}) => {
  const candidates = useMemo(
    () => buildImageCandidates(imageId, imagePath),
    [imageId, imagePath]
  );
  const [srcIndex, setSrcIndex] = useState(0);

  useEffect(() => {
    setSrcIndex(0);
  }, [imageId, imagePath]);

  if (candidates.length === 0) {
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

const SpinnerOverlay = ({ show, message }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex flex-col items-center justify-center">
      <div className="h-12 w-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      {message ? (
        <p className="mt-3 text-white text-sm font-medium text-center px-4">
          {message}
        </p>
      ) : null}
    </div>
>>>>>>> Stashed changes
  );

  const saveCapturedFaceImage = useCallback(
  async (imageDataUrl, imageId) => {
    try {
      const branchCode = branchLocation?.branchcode || "NO_BRANCH";
      const empNo = user?.empNo || "NO_EMPLOYEE";

      const response = await axios.post(API_ENDPOINTS.saveImage, {
        imageId,
        imageData: imageDataUrl,
        branchCode,
        empNo,
      });

      if (response.data.success) {
        return {
          id: imageId,
          path: response.data.path,
        };
      }

      throw new Error(response.data.message || "Failed to save image on server.");
    } catch (err) {
      console.error("Error saving image:", err);
      throw new Error(`Error saving image: ${err.message}`);
    }
  },
  [branchLocation?.branchcode, user?.empNo]
);

  const captureImageProcess = useCallback(
  async (type) => {
    setCapturing(true);
    setCountdown(3);

    try {
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setCountdown(0);

      if (
        !canvasRef.current ||
        !videoRef.current ||
        videoRef.current.readyState < 2
      ) {
        throw new Error("Camera not ready. Please wait and try again.");
      }

      const isLive = await trackFaceMovement(videoRef.current);

      if (!isLive) {
        showErrorToast(
          "Liveness Check Failed",
          "Please move your head slightly. Try again."
        );
        throw new Error("Liveness check failed.");
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

      const isVerified = await verifyFace(imageDataUrl);

      if (!isVerified) {
        throw new Error("Failed to verify face.");
      }

      const newImageId = await requestNewImageId();

      const savedImageInfo = await saveCapturedFaceImage(
        imageDataUrl,
        newImageId
      );

      return savedImageInfo;
    } finally {
      setCapturing(false);
      setCountdown(0);
    }
  },
  [requestNewImageId, saveCapturedFaceImage, verifyFace]
);

  const fetchDTRRecords = useCallback(async () => {
    if (!user?.empNo || !startDate || !endDate) return;

    try {
      const response = await axios.get(
        `${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${startDate}/${endDate}`
      );

      if (response.data.success) {
        const nextRecords = response.data.records || [];
        setRecords(nextRecords);

        const today = nextRecords.find(
          (record) => record.date === dayjs().tz(PH_TIMEZONE).format("YYYY-MM-DD")
        );

        setTodayRecord(today || null);
      }
    } catch (error) {
      console.error("Error fetching DTR records:", error);
    }
  }, [user?.empNo, startDate, endDate]);

  useEffect(() => {
    fetchDTRRecords();
  }, [fetchDTRRecords]);

  const showSuccessToast = (title = "Success", description = "") => {
  toast.success(title, {
    description,
    duration: 3000,
  });
};

<<<<<<< Updated upstream
const showErrorToast = (title = "Error", description = "") => {
  toast.error(title, {
    description,
    duration: 4000,
  });
};

const showWarningToast = (title = "Warning", description = "") => {
  toast.warning(title, {
    description,
    duration: 4000,
  });
};

const showConfirmToast = ({
  title = "Confirm Action",
  description = "",
  confirmText = "Yes",
  cancelText = "Cancel",
}) => {
  return new Promise((resolve) => {
    let resolved = false;

    const toastId = toast.warning(title, {
      description,
      duration: Infinity,
      action: {
        label: confirmText,
        onClick: () => {
          resolved = true;
          toast.dismiss(toastId);
          resolve(true);
        },
      },
      cancel: {
        label: cancelText,
        onClick: () => {
          resolved = true;
          toast.dismiss(toastId);
          resolve(false);
        },
      },
      onDismiss: () => {
        if (!resolved) resolve(false);
      },
    });
  });
};

  const handleTimeEvent = async (type) => {
  if (isProcessingTimeEventRef.current) {
    console.warn("Duplicate time event ignored:", type);
    return;
  }

  isProcessingTimeEventRef.current = true;

  if (!user?.empNo) {
    showErrorToast("Error", "Employee number not available. Please log in.");
    isProcessingTimeEventRef.current = false;
    return;
  }

  try {
    let userCoords = null;
let address = "N/A";
let actualCapturedLocation = "N/A";
let nearestMapLandmark = "N/A";
let verifiedAssignedBranch = "N/A";
let gpsAccuracy = null;
let distanceFromBranch = null;
let locationCheck = null;
let capturedImageInfo = null;
let reverseGeocodePromise = null;

    if (isLocationRequired) {
      setLoading({ show: true, message: "Getting your location..." });

      try {
        userCoords = await getBestCoords();
      } catch (error) {
        console.warn("Location error:", error.message);

        const fallbackCoords = lastGoodLocationRef.current;

        if (
          fallbackCoords &&
          fallbackCoords.accuracy <= ACCEPTABLE_ACCURACY_METERS &&
          Date.now() - fallbackCoords.ts <= 60000
        ) {
          userCoords = fallbackCoords;
        } else {
          showErrorToast(
            "Location Error",
            "Unable to get an accurate location. Please enable location services and try again."
          );
          return;
        }
      }

      locationCheck = validateGeofenceLocation(userCoords, branchLocation);

      console.log("Location Validation:", {
        allowed: locationCheck.allowed,
        message: locationCheck.message,
        distance: Math.round(locationCheck.distance ?? 0),
        allowedRadius: locationCheck.allowedRadius,
        accuracy: Math.round(locationCheck.accuracy ?? 0),
        userLocation: userCoords,
        branchLocation,
      });

      if (!locationCheck.allowed) {
        try {
          address = await reverseGeocode(
            userCoords.latitude,
            userCoords.longitude
          );
        } catch {
          address = "Unable to resolve address";
        }

        setLocationAddress(address);

        showErrorToast(
          "Location Not Allowed",
          <div className="space-y-1 text-sm leading-snug">
            <p>{locationCheck.message}</p>

            <div className="mt-2 border-t border-gray-200 pt-2">
              <p>
                <span className="font-semibold">Distance:</span>{" "}
                {Math.round(locationCheck.distance ?? 0)} meters
              </p>
              <p>
                <span className="font-semibold">Allowed Radius:</span>{" "}
                {locationCheck.allowedRadius ?? 0} meters
              </p>
              <p>
                <span className="font-semibold">Accuracy:</span>{" "}
                {Math.round(locationCheck.accuracy ?? 0)} meters
              </p>
              <p>
                <span className="font-semibold">Phone GPS:</span>{" "}
                {userCoords?.latitude}, {userCoords?.longitude}
              </p>
              <p>
                <span className="font-semibold">Branch GPS:</span>{" "}
                {branchLocation?.coordinates?.latitude}, {branchLocation?.coordinates?.longitude}
              </p>
            </div>
          </div>
        );

        return;
      }

      setLoading({ show: true, message: "Resolving address..." });

      reverseGeocodePromise = (async () => {
  try {
    const geoResult = await reverseGeocode(
      userCoords.latitude,
      userCoords.longitude
    );

    return geoResult || {
      actualCapturedLocation: "N/A",
      nearestLandmark: "N/A",
      fullMapAddress: "N/A",
    };
  } catch {
    return {
      actualCapturedLocation: "N/A",
      nearestLandmark: "N/A",
      fullMapAddress: "N/A",
    };
  }
})();
    }

    if (isImageCaptureRequired) {
      setLoading({ show: false, message: "" });

capturedImageInfo = await captureImageProcess(type);

      if (!capturedImageInfo?.id) {
        showErrorToast("Failed", "Image capture or face verification failed.");
        return;
      }
    }

    if (isLocationRequired) {
  const gpsResult = await reverseGeocodePromise;

  actualCapturedLocation = gpsResult.actualCapturedLocation || "N/A";
  nearestMapLandmark = gpsResult.nearestLandmark || "N/A";
  verifiedAssignedBranch = branchLocation?.address || "N/A";

  gpsAccuracy = userCoords?.accuracy ?? null;
  distanceFromBranch = locationCheck?.distance ?? null;

  // Main address shown in existing screens can remain the actual GPS address
  address = actualCapturedLocation;

  setLocationAddress(actualCapturedLocation);
}

    const now = dayjs().tz(PH_TIMEZONE);
    const currentTime = now.format("HH:mm:ss");
    const currentDateStr = now.format("YYYY-MM-DD");
    const displayTime = now.format("hh:mm:ss A");

    let timeInImageIdToSend = null;
    let timeOutImageIdToSend = null;
    let breakInImageIdToSend = null;
    let breakOutImageIdToSend = null;

    let timeInImagePath = null;
    let timeOutImagePath = null;
    let breakInImagePath = null;
    let breakOutImagePath = null;

    if (capturedImageInfo) {
      if (type === "TIME IN") {
        timeInImageIdToSend = capturedImageInfo.id;
        timeInImagePath = capturedImageInfo.path;
      }

      if (type === "TIME OUT") {
        timeOutImageIdToSend = capturedImageInfo.id;
        timeOutImagePath = capturedImageInfo.path;
      }

      if (type === "BREAK IN") {
        breakInImageIdToSend = capturedImageInfo.id;
        breakInImagePath = capturedImageInfo.path;
      }

      if (type === "BREAK OUT") {
        breakOutImageIdToSend = capturedImageInfo.id;
        breakOutImagePath = capturedImageInfo.path;
      }
    }

    if (type === "TIME IN") setTimeIn(displayTime);
    if (type === "TIME OUT") setTimeOut(displayTime);
    if (type === "BREAK IN") setBreakIn(displayTime);
    if (type === "BREAK OUT") setBreakOut(displayTime);

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
accuracy: gpsAccuracy,
locationAddress: actualCapturedLocation,

actualCapturedLocation,
nearestMapLandmark,
verifiedAssignedBranch,
distanceFromBranch,

branchcode: branchLocation?.branchcode ?? null,
branchname: branchLocation?.branchname ?? null,
branchAddress: verifiedAssignedBranch,
allowedRadius: branchLocation?.allowedRadius ?? null,
        },
=======
const Timekeeping = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tenantCode = useMemo(() => resolveTenantCode(user), [user]);

  const getCurrentManila = useCallback(() => dayjs().tz(MANILA_TZ), []);

  const [isLocationRequired, setIsLocationRequired] = useState(true);
  const [isImageCaptureRequired, setIsImageCaptureRequired] = useState(true);

  const isSubmittingRef = useRef(false);
  const faceioRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const lastGoodLocationRef = useRef(null);
  const revGeoCacheRef = useRef(new Map());
  const cameraStreamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceioAuthInProgressRef = useRef(false);

  const [faceioReady, setFaceioReady] = useState(false);
  const [faceioStatus, setFaceioStatus] = useState({
    ready: false,
    message: "Initializing FACEIO...",
  });

  const [currentDate, setCurrentDate] = useState(getCurrentManila());
  const [time, setTime] = useState(getCurrentManila().format("hh:mm:ss A"));

  const [records, setRecords] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [loading, setLoading] = useState({ show: false, message: "" });

  const [userLocation, setUserLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  const [startDate, setStartDate] = useState(
    getCurrentManila().startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState(
    getCurrentManila().endOf("month").format("YYYY-MM-DD")
  );
  const [draftStartDate, setDraftStartDate] = useState(
    getCurrentManila().startOf("month").format("YYYY-MM-DD")
  );
  const [draftEndDate, setDraftEndDate] = useState(
    getCurrentManila().endOf("month").format("YYYY-MM-DD")
  );

  const [viewMode, setViewMode] = useState("cards");
  const [empBranchLoc, setEmpBranchLoc] = useState(null);

  const COMPANY_LOCATION = useMemo(
    () => ({
      address: "No Location Setup Found",
      coordinates: {
        latitude: 14.555879228816387,
        longitude: 121.01474453024396,
>>>>>>> Stashed changes
      },
      allowedRadius: 50,
      branchname: "Assigned Branch",
      geofence: false,
    }),
    []
  );

  const branchLocation = empBranchLoc || COMPANY_LOCATION;

  const roundCoord = useCallback((n, p = 5) => Number(n).toFixed(p), []);

  const ensureFaceIOMountPoint = useCallback(() => {
    if (typeof document === "undefined") return null;

    let modal = document.getElementById("faceio-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "faceio-modal";
      document.body.appendChild(modal);
    }

    return modal;
  }, []);

  const purgeFaceIOArtifacts = useCallback(() => {
    if (typeof document === "undefined") return;

    const selectors = [
      "#faceio-modal",
      '[id^="faceio-"]',
      ".faceio-overlay",
      ".faceio-modal",
      'iframe[src*="faceio"]',
      'iframe[title*="faceio" i]',
    ];

<<<<<<< Updated upstream
    console.log("Upsert Payload:", eventData);

    setLoading({ show: true, message: `Saving ${type}...` });

    const response = await axios.post(API_ENDPOINTS.upsertTimeIn, eventData);

    if (response.data.status === "success") {
      showSuccessToast("Success", `${type} recorded successfully!`);
      fetchDTRRecords();
    } else {
      showErrorToast(
        "Error",
        response.data.message || `Failed to record ${type}.`
      );
    }
  } catch (err) {
    console.error("Timekeeping save error:", {
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });

    showErrorToast(
      "Error",
      err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "An unexpected error occurred."
    );
  } finally {
    setLoading({ show: false, message: "" });
    setCapturing(false);
    isProcessingTimeEventRef.current = false;
  }
};

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const recordDate = dayjs(record.date);
      const isAfterStart = startDate
        ? recordDate.isSameOrAfter(dayjs(startDate), "day")
        : true;
      const isBeforeEnd = endDate
        ? recordDate.isSameOrBefore(dayjs(endDate), "day")
        : true;
      return isAfterStart && isBeforeEnd;
    });
  }, [records, startDate, endDate]);

  const totalWorkedHours = useMemo(() => {
    return filteredRecords.reduce((total, record) => {
      return total + (Number(record.worked_hrs) || 0);
    }, 0);
  }, [filteredRecords]);
=======
    document.querySelectorAll(selectors.join(", ")).forEach((node) => {
      if (node.id === "faceio-modal") {
        node.innerHTML = "";
      } else {
        node.remove();
      }
    });

    document.body.style.overflow = "";
  }, []);

  const parseFaceIOErrorCode = useCallback((error) => {
    const rawCode =
      error?.code ??
      error?.errCode ??
      error?.errorCode ??
      error?.name ??
      null;

    return rawCode == null ? "" : String(rawCode).trim().toUpperCase();
  }, []);

  const isFaceIOSessionBusyError = useCallback(
    (error) => {
      const code = parseFaceIOErrorCode(error);
      const raw = String(
        error?.message || error?.details || error?.reason || ""
      ).toUpperCase();

      return (
        code.includes("SESSION_IN_PROGRESS") ||
        raw.includes("SESSION_IN_PROGRESS") ||
        raw.includes("ANOTHER AUTHENTICATION OR ENROLLMENT OPERATION IS PROCESSING")
      );
    },
    [parseFaceIOErrorCode]
  );

  const getFaceIOErrorMessage = useCallback(
    (error) => {
      if (!error) return "Face verification failed.";

      const code = parseFaceIOErrorCode(error);
      const message =
        error?.message ||
        error?.details ||
        error?.reason ||
        error?.toString?.() ||
        "Face verification failed.";

      const normalized = String(message).toLowerCase();

      if (code.includes("PAD_ATTACK") || normalized.includes("pad_attack")) {
        return "Fake picture or video detected. Please use a live face in front of the camera.";
      }
      if (
        code.includes("SESSION_IN_PROGRESS") ||
        normalized.includes("session_in_progress")
      ) {
        return "Face verification is already open. Please close the existing FACEIO window and try again.";
      }
      if (normalized.includes("permission")) {
        return "Camera permission was denied. Please allow camera access and try again.";
      }
      if (normalized.includes("cancel")) {
        return "Face verification was cancelled.";
      }
      if (normalized.includes("network")) {
        return "FACEIO could not reach the server. Please check your internet connection and try again.";
      }
      if (normalized.includes("timeout")) {
        return "FACEIO verification timed out. Please try again.";
      }
      if (normalized.includes("not ready")) {
        return "FACEIO is still loading. Please wait a moment and try again.";
      }
      if (normalized.includes("no faces")) {
        return "No face was detected. Please face the camera clearly and try again.";
      }
      if (normalized.includes("many faces")) {
        return "Multiple faces were detected. Only one face should be visible during verification.";
      }

      return message;
    },
    [parseFaceIOErrorCode]
  );

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause?.();
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera is not supported by this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });

    cameraStreamRef.current = stream;

    if (!videoRef.current) {
      throw new Error("Video preview is not ready.");
    }

    videoRef.current.srcObject = stream;

    await new Promise((resolve) => {
      videoRef.current.onloadedmetadata = () => resolve();
    });

    await videoRef.current.play();
  }, [stopCamera]);

  const captureSnapshotBase64 = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      throw new Error("Camera preview is not ready.");
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  const initializeFaceIO = useCallback(async () => {
    const publicId = import.meta.env.VITE_FACEIO_PUBLIC_ID;

    if (!publicId) {
      faceioRef.current = null;
      setFaceioReady(false);
      setFaceioStatus({
        ready: false,
        message:
          "FACEIO Public ID is missing. Add VITE_FACEIO_PUBLIC_ID to your UI .env file.",
      });
      return false;
    }

    try {
      setFaceioStatus({ ready: false, message: "Loading FACEIO..." });

      const FaceIOClass = await loadFaceIO();

      if (typeof FaceIOClass !== "function") {
        throw new Error("FACEIO SDK is not available as a constructor.");
      }

      ensureFaceIOMountPoint();
      purgeFaceIOArtifacts();
      faceioRef.current = new FaceIOClass(publicId);
      setFaceioReady(true);
      setFaceioStatus({
        ready: true,
        message:
          "FACEIO is ready. A secure verification widget will open when you click a timekeeping button.",
      });
      return true;
    } catch (error) {
      console.error("FACEIO init error:", error);
      faceioRef.current = null;
      setFaceioReady(false);
      setFaceioStatus({
        ready: false,
        message: getFaceIOErrorMessage(error),
      });
      return false;
    }
  }, [getFaceIOErrorMessage]);

  const resetFaceIO = useCallback(async () => {
    try {
      if (faceioRef.current?.restartSession) {
        faceioRef.current.restartSession();
      }
    } catch (error) {
      console.warn("FACEIO restartSession failed:", error);
    }

    purgeFaceIOArtifacts();
    faceioRef.current = null;
    setFaceioReady(false);
    setFaceioStatus({ ready: false, message: "Resetting FACEIO..." });
    return initializeFaceIO();
  }, [initializeFaceIO, purgeFaceIOArtifacts]);

  const reverseGeocode = useCallback(
    async (lat, lon) => {
      const key = `${roundCoord(lat, 5)},${roundCoord(lon, 5)}`;
      if (revGeoCacheRef.current.has(key)) {
        return revGeoCacheRef.current.get(key);
      }

      try {
        const response = await axios.get(
          "https://nominatim.openstreetmap.org/reverse",
          {
            params: { lat, lon, format: "json" },
            timeout: 8000,
          }
        );

        const name = response?.data?.display_name || "Unknown location";
        revGeoCacheRef.current.set(key, name);
        return name;
      } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return "Unknown location";
      }
    },
    [roundCoord]
  );

  const isWithinRadius = useCallback((lat1, lon1, lat2, lon2, radiusMeters) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c <= radiusMeters;
  }, []);

  const startLocationWatch = useCallback(() => {
    if (!navigator.geolocation) return;
    if (locationWatchIdRef.current != null) return;

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const payload = {
          latitude,
          longitude,
          accuracy,
          ts: Date.now(),
        };

        setUserLocation({ latitude, longitude });
        setLocationAccuracy(accuracy);

        if (
          !lastGoodLocationRef.current ||
          (accuracy != null && accuracy < lastGoodLocationRef.current.accuracy)
        ) {
          lastGoodLocationRef.current = payload;
        }

        if (
          accuracy != null &&
          accuracy <= ACCEPTABLE_ACCURACY_METERS &&
          locationWatchIdRef.current != null
        ) {
          navigator.geolocation.clearWatch(locationWatchIdRef.current);
          locationWatchIdRef.current = null;
        }
      },
      (err) => {
        console.warn("watchPosition error:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      }
    );
  }, []);

  const fetchEmpBranchLoc = useCallback(async () => {
    if (!user?.empNo) return;

    try {
      const response = await getEmpBranchLoc(user.empNo);

      if (
        response?.success &&
        Array.isArray(response.records) &&
        response.records.length > 0
      ) {
        const fetched = response.records[0];

        setEmpBranchLoc({
          address: fetched.address,
          coordinates: {
            latitude: Number(fetched.latitude),
            longitude: Number(fetched.longitude),
          },
          allowedRadius: Number(fetched.allowedRadius ?? 50),
          branchname: fetched.branchname || "Assigned Branch",
          geofence:
            fetched.geofence === true ||
            fetched.geofence === 1 ||
            fetched.geofence === "1",
        });
      } else {
        setEmpBranchLoc(null);
      }
    } catch (error) {
      console.error("Error fetching employee branch location:", error);
      setEmpBranchLoc(null);
    }
  }, [user?.empNo]);

  const fetchDTRRecords = useCallback(async () => {
    if (!user?.empNo || !startDate || !endDate) return;

    try {
      const response = await axios.get(
        `${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${startDate}/${endDate}`
      );

      if (response?.data?.success) {
        const nextRecords = Array.isArray(response.data.records)
          ? response.data.records
          : [];

        setRecords(nextRecords);

        const todayStr = getCurrentManila().format("YYYY-MM-DD");
        const today = nextRecords.find((r) => r.date === todayStr) || null;
        setTodayRecord(today);
      }
    } catch (error) {
      console.error("Error fetching DTR records:", error);
    }
  }, [user?.empNo, startDate, endDate, getCurrentManila]);

  const authenticateWithFaceIO = useCallback(async () => {
    if (!isImageCaptureRequired) {
      return {
        skipped: true,
        facialId: null,
        payload: null,
        details: null,
      };
    }

    if (faceioAuthInProgressRef.current) {
      throw new Error("Face verification is already in progress.");
    }

    faceioAuthInProgressRef.current = true;

    try {
      ensureFaceIOMountPoint();
      purgeFaceIOArtifacts();

      if (!faceioRef.current) {
        const ready = await resetFaceIO();
        if (!ready || !faceioRef.current) {
          throw new Error("FACEIO is not ready yet.");
        }
      } else if (faceioRef.current?.restartSession) {
        try {
          faceioRef.current.restartSession();
        } catch (restartError) {
          console.warn("FACEIO restartSession warning:", restartError);
        }
      }

      const result = await faceioRef.current.authenticate({
        locale: "auto",
        permissionTimeout: 20,
        idleTimeout: 20,
        replyTimeout: 35,
      });

      purgeFaceIOArtifacts();

      return {
        skipped: false,
        facialId: result?.facialId || result?.userData?.facialId || null,
        payload: result?.payload || result?.userData?.payload || null,
        details: result,
      };
    } catch (error) {
      purgeFaceIOArtifacts();

      if (isFaceIOSessionBusyError(error)) {
        await resetFaceIO();
      } else if (parseFaceIOErrorCode(error).includes("PAD_ATTACK")) {
        await resetFaceIO();
      }

      throw error;
    } finally {
      faceioAuthInProgressRef.current = false;
    }
  }, [
    ensureFaceIOMountPoint,
    isFaceIOSessionBusyError,
    isImageCaptureRequired,
    parseFaceIOErrorCode,
    purgeFaceIOArtifacts,
    resetFaceIO,
  ]);

  const getBestCoords = useCallback(async () => {
    const getPosition = (opts) =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by this browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });

    const normalizeCoords = (pos) => ({
      latitude:
        pos?.coords?.latitude != null ? Number(pos.coords.latitude) : null,
      longitude:
        pos?.coords?.longitude != null ? Number(pos.coords.longitude) : null,
      accuracy:
        pos?.coords?.accuracy != null ? Number(pos.coords.accuracy) : null,
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
        } catch (gpsErr) {
          console.warn(
            "High-accuracy GPS lookup failed, using best available location.",
            gpsErr
          );
        }
      }

      return normalizeCoords(pos);
    } catch (err) {
      const cached = lastGoodLocationRef.current;

      if (cached?.latitude != null && cached?.longitude != null) {
        return {
          latitude: cached?.latitude != null ? Number(cached.latitude) : null,
          longitude: cached?.longitude != null ? Number(cached.longitude) : null,
          accuracy: cached?.accuracy != null ? Number(cached.accuracy) : null,
        };
      }

      throw err;
    }
  }, []);

  useEffect(() => {
    fetchEmpBranchLoc();
  }, [fetchEmpBranchLoc]);

  useEffect(() => {
    setIsLocationRequired(empBranchLoc ? empBranchLoc.geofence === true : true);
  }, [empBranchLoc]);

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

  useEffect(() => {
    let active = true;

    if (!isImageCaptureRequired) {
      setFaceioReady(false);
      setFaceioStatus({
        ready: true,
        message: "Face verification is disabled.",
      });
      return () => {
        active = false;
      };
    }

    (async () => {
      const ready = await initializeFaceIO();
      if (!active && ready) {
        faceioRef.current = null;
      }
    })();

    return () => {
      active = false;
      purgeFaceIOArtifacts();
    };
  }, [isImageCaptureRequired, initializeFaceIO, purgeFaceIOArtifacts]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = getCurrentManila();
      setCurrentDate(now);
      setTime(now.format("hh:mm:ss A"));
    }, 1000);

    return () => clearInterval(interval);
  }, [getCurrentManila]);

  useEffect(() => {
    fetchDTRRecords();
  }, [fetchDTRRecords]);

  useEffect(() => {
    return () => {
      stopCamera();
      purgeFaceIOArtifacts();
    };
  }, [stopCamera, purgeFaceIOArtifacts]);

  const defaultDateRange = useCallback(() => ({
    start: getCurrentManila().startOf("month").format("YYYY-MM-DD"),
    end: getCurrentManila().endOf("month").format("YYYY-MM-DD"),
  }), [getCurrentManila]);

  const isGeofenceEnabled = useMemo(
    () =>
      branchLocation?.geofence === true ||
      branchLocation?.geofence === 1 ||
      branchLocation?.geofence === "1",
    [branchLocation]
  );

  const shouldShowLocationData = true;

  const applyDateFilter = useCallback(() => {
    if (!draftStartDate || !draftEndDate) {
      Swal.fire("Error", "Please select Start Date and End Date.", "error");
      return;
    }

    if (dayjs(draftStartDate).isAfter(dayjs(draftEndDate), "day")) {
      Swal.fire("Error", "Start Date cannot be later than End Date.", "error");
      return;
    }

    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
  }, [draftStartDate, draftEndDate]);

  const resetDateFilter = useCallback(() => {
    const nextRange = defaultDateRange();
    setDraftStartDate(nextRange.start);
    setDraftEndDate(nextRange.end);
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
  }, [defaultDateRange]);

  const setTodayFilter = useCallback(() => {
    const today = getCurrentManila().format("YYYY-MM-DD");
    setDraftStartDate(today);
    setDraftEndDate(today);
    setStartDate(today);
    setEndDate(today);
  }, [getCurrentManila]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const recordDate = dayjs(record.date);
      const isAfterStart = startDate
        ? recordDate.isSameOrAfter(dayjs(startDate), "day")
        : true;
      const isBeforeEnd = endDate
        ? recordDate.isSameOrBefore(dayjs(endDate), "day")
        : true;

      return isAfterStart && isBeforeEnd;
    });
  }, [records, startDate, endDate]);

  const totalWorkedHours = useMemo(() => {
    return filteredRecords.reduce(
      (total, record) => total + (Number(record.worked_hrs) || 0),
      0
    );
  }, [filteredRecords]);

  const faceReady = !isImageCaptureRequired || faceioReady;

  const actionState = useMemo(
    () => ({
      canTimeIn: !loading.show && faceReady && !todayRecord?.time_in,
      canBreakIn:
        !loading.show && faceReady && !!todayRecord?.time_in && !todayRecord?.break_in,
      canBreakOut:
        !loading.show && faceReady && !!todayRecord?.break_in && !todayRecord?.break_out,
      canTimeOut:
        !loading.show && faceReady && !!todayRecord?.time_in && !todayRecord?.time_out,
    }),
    [loading.show, faceReady, todayRecord]
  );

  const handleTimeEvent = useCallback(
    async (type) => {
      if (!user?.empNo) {
        Swal.fire("Error", "Employee number is missing.", "error");
        return;
      }

      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      let userCoords = null;
      let address = "N/A";
      let capturedImageBase64 = null;
      let verifiedFace = {
        facialId: null,
        payloadEmpNo: null,
        payloadTenantCode: null,
      };

      try {
        const locationTask = (async () => {
          try {
            // setLoading({ show: true, message: "Getting your location..." });
            setLoading({ show: false, message: "" });

            const coords = await getBestCoords();
            setUserLocation({
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
            setLocationAccuracy(coords.accuracy);

            const hasBranchCoords =
              branchLocation?.coordinates?.latitude != null &&
              branchLocation?.coordinates?.longitude != null;

            if (hasBranchCoords && isGeofenceEnabled) {
              const isAllowedLocation = isWithinRadius(
                coords.latitude,
                coords.longitude,
                Number(branchLocation.coordinates.latitude),
                Number(branchLocation.coordinates.longitude),
                Number(branchLocation.allowedRadius || 50)
              );

              if (!isAllowedLocation) {
                const outsideAddress = await reverseGeocode(
                  coords.latitude,
                  coords.longitude
                );
                setLocationAddress(outsideAddress);
                throw new Error(
                  `You are outside the allowed work location. Current location: ${outsideAddress}`
                );
              }
            }

            const resolvedAddress = await reverseGeocode(
              coords.latitude,
              coords.longitude
            );
            setLocationAddress(resolvedAddress);

            return {
              coords,
              address: resolvedAddress || "N/A",
            };
          } catch (locationError) {
            if (isGeofenceEnabled) {
              throw locationError;
            }

            console.warn("Location capture warning:", locationError);
            const fallbackAddress = "Location unavailable";
            setLocationAddress(fallbackAddress);
            return {
              coords: null,
              address: fallbackAddress,
            };
          }
        })();

        if (isImageCaptureRequired) {
          if (!faceioReady) {
            const ok = await resetFaceIO();
            if (!ok) {
              throw new Error("FACEIO is not ready yet. Please try again in a moment.");
            }
          }

          setLoading({ show: true, message: "Preparing camera..." });
          await startCamera();
          await new Promise((resolve) => setTimeout(resolve, CAMERA_CAPTURE_DELAY_MS));
          
          // capturedImageBase64 = captureSnapshotBase64();
          capturedImageBase64 = captureSnapshotBase64();

          if (!capturedImageBase64) {
            throw new Error("Unable to capture image from camera.");
          }

          stopCamera();
          setLoading({ show: false, message: "" });

          Swal.fire({
            toast: true,
            position: "top",
            icon: "info",
            title: `Verifying your face for ${type}...`,
            showConfirmButton: false,
            timer: 1800,
            timerProgressBar: true,
          });

          const faceioResult = await authenticateWithFaceIO();

          if (!faceioResult?.skipped && !faceioResult?.facialId) {
            throw new Error("FACEIO verification failed.");
          }

          const payloadEmpNo = String(
            faceioResult?.payload?.empNo ||
              faceioResult?.payload?.employeeNo ||
              ""
          ).trim();

          if (payloadEmpNo && String(payloadEmpNo) !== String(user.empNo)) {
            throw new Error("FACEIO verified a different employee profile.");
          }

          capturedImageBase64 = capturedImageBase64 || null;

          verifiedFace = {
            facialId: String(faceioResult?.facialId || "").trim() || null,
            payloadEmpNo: payloadEmpNo || null,
            payloadTenantCode: String(
              faceioResult?.payload?.tenantCode ||
              faceioResult?.payload?.tenant_code ||
              faceioResult?.payload?.companyCode ||
              faceioResult?.payload?.company_code ||
              ""
            ).trim() || null,
          };
        }

        const locationResult = await locationTask;
        userCoords = locationResult?.coords ?? null;
        address = locationResult?.address ?? "N/A";

        const nowManila = getCurrentManila();
        const currentTime = nowManila.format("HH:mm:ss");
        const currentDateStr = nowManila.format("YYYY-MM-DD");

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

              timeInImageId: null,
              timeOutImageId: null,
              breakInImageId: null,
              breakOutImageId: null,

              timeInImagePath: null,
              timeOutImagePath: null,
              breakInImagePath: null,
              breakOutImagePath: null,

              timeInImageBase64:
                type === "TIME IN" ? capturedImageBase64 : null,
              timeOutImageBase64:
                type === "TIME OUT" ? capturedImageBase64 : null,
              breakInImageBase64:
                type === "BREAK IN" ? capturedImageBase64 : null,
              breakOutImageBase64:
                type === "BREAK OUT" ? capturedImageBase64 : null,

              latitude: userCoords?.latitude ?? null,
              longitude: userCoords?.longitude ?? null,
              locationAccuracy: userCoords?.accuracy ?? null,
              locationAddress: address,

              faceioFacialId: verifiedFace.facialId,
              faceioPayloadEmpNo: verifiedFace.payloadEmpNo,
              faceioTenantCode: tenantCode,
              faceioPayloadTenantCode: verifiedFace.payloadTenantCode,
              faceioVerifiedAt: nowManila.toISOString(),
            },
          },
        ];

        console.log("Upsert Payload:", eventData);

        setLoading({ show: true, message: `Saving ${type}...` });

        const response = await axios.post(API_ENDPOINTS.upsertTimeIn, eventData, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
          withCredentials: true,
        });

        if (response?.data?.status !== "success") {
          throw new Error(response?.data?.message || `Unable to ${type}.`);
        }

        Swal.fire({
          icon: "success",
          title: "Success",
          text: response?.data?.message || `${type} recorded successfully.`,
          toast: true,
          position: "top",
          timer: 3500,
          timerProgressBar: true,
          showConfirmButton: false,
        });

        await fetchDTRRecords();
      } catch (error) {
        console.error(`${type} error:`, error);

        const message =
          error?.response?.data?.message ||
          getFaceIOErrorMessage(error) ||
          `Unable to complete ${type}.`;

        Swal.fire({
          icon: "error",
          title: "Error",
          text: message,
        });
      } finally {
        stopCamera();
        setLoading({ show: false, message: "" });
        isSubmittingRef.current = false;
      }
    },
    [
      user,
      isImageCaptureRequired,
      faceioReady,
      startCamera,
      stopCamera,
      captureSnapshotBase64,
      authenticateWithFaceIO,
      getBestCoords,
      branchLocation,
      isWithinRadius,
      reverseGeocode,
      getCurrentManila,
      fetchDTRRecords,
      getFaceIOErrorMessage,
      resetFaceIO,
      isGeofenceEnabled,
    ]
  );

  const handleExport = useCallback(() => {
    const employeeNumber = String(user?.empNo || "").padStart(10, "0") || "N/A";
    const formattedStartDate = startDate
      ? dayjs(startDate).format("YYYYMMDD")
      : "";
    const formattedEndDate = endDate ? dayjs(endDate).format("YYYYMMDD") : "";
    const dateRange =
      formattedStartDate && formattedEndDate
        ? `${formattedStartDate}-${formattedEndDate}`
        : "";

    const headerColumns = [
      "Employee No.",
      "Employee Name",
      "Date",
      "Time In",
      "Time In Location",
      "Break In",
      "Break Out",
      "Time Out",
      "Time Out Location",
      "Worked (hrs)",
    ];

    const csvRows = filteredRecords.map((record) => {
      const row = [
        `"${employeeNumber}"`,
        `"${record.empName || ""}"`,
        `"${dayjs(record.date).format("MM/DD/YYYY")}"`,
        `"${
          record.time_in
            ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
            : "N/A"
        }"`,
      ];

      row.push(`"${record.time_in_address || "N/A"}"`);

      row.push(
        `"${
          record.break_in
            ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A")
            : "N/A"
        }"`,
        `"${
          record.break_out
            ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A")
            : "N/A"
        }"`,
        `"${
          record.time_out
            ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
            : "N/A"
        }"`
      );

      row.push(`"${record.time_out_address || "N/A"}"`);

      row.push(
        `"${
          record.worked_hrs != null ? Number(record.worked_hrs).toFixed(2) : "0.00"
        }"`
      );

      return row.join(",");
    });

    const totalRow = Array(headerColumns.length).fill("");
    totalRow[headerColumns.length - 2] = `"Total Hours"`;
    totalRow[headerColumns.length - 1] = totalWorkedHours.toFixed(2);

    const csvContent = [
      headerColumns.map((col) => `"${col}"`).join(","),
      ...csvRows,
      totalRow.join(","),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `DTR-${employeeNumber}-${dateRange}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [
    user?.empNo,
    startDate,
    endDate,
    filteredRecords,
    totalWorkedHours,
  ]);

  const handleDtrConfirmation = useCallback(async () => {
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
      )} to ${dayjs(endDate).format(
        "MMM DD, YYYY"
      )}. You may no longer edit these entries.`,
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

      if (response?.data?.success) {
        Swal.fire({
          icon: "success",
          title: "DTR Confirmed",
          text: response.data.message || "Your DTR has been confirmed.",
          toast: true,
          position: "top",
          timer: 3500,
          timerProgressBar: true,
          showConfirmButton: false,
        });

        fetchDTRRecords();
      } else {
        Swal.fire(
          "Error",
          response?.data?.message || "Unable to confirm DTR.",
          "error"
        );
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.message || err?.message || "Unable to confirm DTR.",
        "error"
      );
    }
  }, [user?.empNo, startDate, endDate, fetchDTRRecords]);
>>>>>>> Stashed changes

  const handleExport = () => {
    const employeeNumber = String(user?.empNo || user?.empno || "").padStart(10, "0") || "N/A";
    const employeeName = records[0]?.empName || records[0]?.empname || "N/A";

<<<<<<< Updated upstream
    const formattedStartDate = startDate ? dayjs(startDate).format("YYYYMMDD") : "";
    const formattedEndDate = endDate ? dayjs(endDate).format("YYYYMMDD") : "";
    const dateRange =
      formattedStartDate && formattedEndDate
        ? `${formattedStartDate}-${formattedEndDate}`
        : "";

    const headerColumns = ["Employee No.", "Employee Name", "Date", "Time In"];

    if (isLocationRequired) headerColumns.push("Time In Location");

    headerColumns.push("Break In", "Break Out", "Time Out");

    if (isLocationRequired) headerColumns.push("Time Out Location");

    headerColumns.push("Worked (hrs)");

    const csvRows = filteredRecords.map((record) => {
      const row = [
        `"${employeeNumber}"`,
        `"${record.empName || record.empname || employeeName}"`,
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

    const totalRow = Array(headerColumns.length).fill("");
    totalRow[headerColumns.length - 2] = '"Total Hours"';
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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
=======
  const CardView = ({ filteredRecords }) => (
    <div className="space-y-2">
      {filteredRecords.map((record, index) => {
        const isFinal = record.stat === "F";
        const canAdjust =
          !isFinal && (isBlank(record.time_in) || isBlank(record.time_out));
>>>>>>> Stashed changes

  const handleDtrConfirmation = async () => {
    if (!user?.empNo) {
      Swal.fire("Error", "Employee number not available. Please log in.", "error");
      return;
    }

    if (!startDate || !endDate) {
      Swal.fire("Error", "Please select Start Date and End Date.", "error");
      return;
    }

    const confirm = await showConfirmToast({
  title: "Confirm DTR",
  description: `This will mark your DTR as FINAL from ${dayjs(startDate).format(
    "MMM DD, YYYY"
  )} to ${dayjs(endDate).format(
    "MMM DD, YYYY"
  )}. You may no longer edit these entries.`,
  confirmText: "Yes, confirm",
  cancelText: "No, cancel",
});

if (!confirm) return;

    if (!confirm.isConfirmed) return;

    try {
      const response = await axios.post(API_ENDPOINTS.confirmDTR, {
        empNo: user.empNo,
        startDate,
        endDate,
      });

      if (response.data.success) {
        showSuccessToast(
  "DTR Confirmed",
  response.data.message || "Your DTR has been confirmed."
);

        fetchDTRRecords();
      } else {
        showErrorToast("Error", response.data.message || "Unable to confirm DTR.");
      }
    } catch (err) {
      showErrorToast("Error", err.response?.data?.message || err.message || "Unable to confirm DTR.");
    }
  };

  const SpinnerOverlay = ({ show, message }) => {
    if (!show) return null;

    return (
      <div className="fixed inset-0 z-[9999] bg-black/40 flex flex-col items-center justify-center">
        <div className="h-12 w-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        {message && (
          <p className="mt-3 text-white text-sm font-medium text-center px-4">
            {message}
          </p>
        )}
      </div>
    );
  };

  const getRecordValue = (record, keys = []) => {
    for (const key of keys) {
      const value = record?.[key];

      if (value != null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }

    return "";
  };

  const getUniqueValues = (values = []) => [
    ...new Set(values.filter((value) => value && String(value).trim() !== "")),
  ];

  const buildTimekeepingImageCandidates = (imagePath, imageId, record = {}) => {
    const cleanBase = String(IMAGE_BASE_URL || "").replace(/\/+$/, "");
    const appBase = cleanBase
      .replace(/\/images\/timekeeping_images$/i, "")
      .replace(/\/storage\/timekeeping_images$/i, "")
      .replace(/\/timekeeping_images$/i, "")
      .replace(/\/images$/i, "");

    const candidates = [];
    const addCandidate = (value) => {
      if (value) candidates.push(value.replace(/([^:]\/)\/+/g, "$1"));
    };

    const normalizePath = (value) => {
      if (value == null) return "";

      let path = String(value).trim();
      if (!path) return "";

      if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:")
      ) {
        return path;
      }

      path = path.replace(/\\/g, "/").replace(/^\/+/, "");

      const publicIndex = path.toLowerCase().indexOf("public/");
      if (publicIndex >= 0) {
        path = path.substring(publicIndex + "public/".length);
      }

      const storageIndex = path.toLowerCase().indexOf("storage/timekeeping_images/");
      if (storageIndex >= 0) {
        return `${appBase}/${path.substring(storageIndex)}`;
      }

      const imagesIndex = path.toLowerCase().indexOf("images/timekeeping_images/");
      if (imagesIndex >= 0) {
        return `${appBase}/${path.substring(imagesIndex)}`;
      }

      if (/^timekeeping_images\//i.test(path)) {
        return `${appBase}/storage/${path}`;
      }

      if (/^(storage|images)\//i.test(path)) {
        return `${appBase}/${path}`;
      }

      return `${cleanBase}/${path}`;
    };

    addCandidate(normalizePath(imagePath));

    if (imagePath != null && String(imagePath).trim() !== "") {
      let rawPath = String(imagePath).trim().replace(/\\/g, "/").replace(/^\/+/, "");
      const publicIndex = rawPath.toLowerCase().indexOf("public/");

      if (publicIndex >= 0) {
        rawPath = rawPath.substring(publicIndex + "public/".length);
      }

      if (/^timekeeping_images\//i.test(rawPath)) {
        addCandidate(`${appBase}/images/${rawPath}`);
      } else if (/^storage\/timekeeping_images\//i.test(rawPath)) {
        addCandidate(rawPath.replace(/^storage\//i, `${appBase}/images/`));
      } else if (/^images\/timekeeping_images\//i.test(rawPath)) {
        addCandidate(rawPath.replace(/^images\//i, `${appBase}/storage/`));
      } else if (
        !rawPath.startsWith("http://") &&
        !rawPath.startsWith("https://") &&
        !rawPath.startsWith("data:")
      ) {
        addCandidate(`${appBase}/storage/timekeeping_images/${rawPath}`);
        addCandidate(`${appBase}/images/timekeeping_images/${rawPath}`);
      }
    }

    const cleanImageId = imageId != null ? String(imageId).trim() : "";

    if (cleanImageId) {
      const branchCode = getRecordValue(record, [
        "branchcode",
        "branchCode",
        "BRANCHCODE",
        "BRANCH_CODE",
      ]);
      const recordEmpNo = getRecordValue(record, [
        "empno",
        "empNo",
        "EMPNO",
        "EMP_NO",
      ]);
      const fallbackEmpNo = user?.empNo || user?.empno || "";
      const empValues = getUniqueValues([
        recordEmpNo,
        recordEmpNo ? String(recordEmpNo).padStart(10, "0") : "",
        fallbackEmpNo,
        fallbackEmpNo ? String(fallbackEmpNo).padStart(10, "0") : "",
      ]);

      if (branchCode && empValues.length > 0) {
        empValues.forEach((empValue) => {
          addCandidate(`${appBase}/storage/timekeeping_images/${branchCode}/${empValue}/${cleanImageId}.jpeg`);
          addCandidate(`${appBase}/storage/timekeeping_images/${branchCode}/${empValue}/${cleanImageId}.jpg`);
          addCandidate(`${cleanBase}/${branchCode}/${empValue}/${cleanImageId}.jpeg`);
          addCandidate(`${cleanBase}/${branchCode}/${empValue}/${cleanImageId}.jpg`);
          addCandidate(`${appBase}/images/timekeeping_images/${branchCode}/${empValue}/${cleanImageId}.jpeg`);
          addCandidate(`${appBase}/images/timekeeping_images/${branchCode}/${empValue}/${cleanImageId}.jpg`);
        });
      }

      // Old timekeeping photos were served from Laravel's storage path.
      addCandidate(`${appBase}/storage/timekeeping_images/${cleanImageId}.jpeg`);
      addCandidate(`${appBase}/storage/timekeeping_images/${cleanImageId}.jpg`);
      addCandidate(`${cleanBase}/${cleanImageId}.jpeg`);
      addCandidate(`${cleanBase}/${cleanImageId}.jpg`);
      addCandidate(`${appBase}/images/timekeeping_images/${cleanImageId}.jpeg`);
      addCandidate(`${appBase}/images/timekeeping_images/${cleanImageId}.jpg`);
    }

    return getUniqueValues(candidates);
  };

  const getTimekeepingImageUrl = (imagePath, imageId, record = {}) =>
    buildTimekeepingImageCandidates(imagePath, imageId, record)[0] || "";

  const getTimekeepingImageFallbacks = (imagePath, imageId, record = {}) =>
    buildTimekeepingImageCandidates(imagePath, imageId, record).slice(1);

  const handleTimekeepingImageError = (event, label = "Timekeeping") => {
    const fallbackSrcs = event.currentTarget.dataset.fallbackSrcs
      ? JSON.parse(event.currentTarget.dataset.fallbackSrcs)
      : [];
    const fallbackIndex = Number(event.currentTarget.dataset.fallbackIndex || 0);

    if (fallbackIndex < fallbackSrcs.length) {
      event.currentTarget.dataset.fallbackIndex = String(fallbackIndex + 1);
      event.currentTarget.src = fallbackSrcs[fallbackIndex];
      return;
    }

    console.log(`${label} image failed. Tried all paths. Last src:`, event.currentTarget.src);
  };

  const CardView = ({ filteredRecords }) => {
    const isBlank = (v) => v == null || String(v).trim() === "";

    const handleAdjustClick = (record) => {
      navigate("/timekeepingAdj", { state: { record } });
    };

    const handleOffsetClick = (record) => {
      navigate("/offsetApplication", { state: { record } });
    };

    return (
      <div className="space-y-4">
        {filteredRecords.map((record, index) => {
          const isFinal = record.stat === "F";
          const hasCompleteTime = !isBlank(record.time_in) && !isBlank(record.time_out);
          const canAdjust = !isFinal && !hasCompleteTime;
          const canOffset = isFinal && hasCompleteTime;
          const timeInImagePath = getRecordValue(record, [
            "time_in_image_path",
            "timeInImagePath",
            "TIME_IN_IMAGE_PATH",
            "time_in_image",
            "timeInImage",
          ]);
          const timeInImageId = getRecordValue(record, [
            "time_in_image_id",
            "timeInImageId",
            "TIME_IN_IMAGE_ID",
            "time_in_imageid",
            "timeInImageID",
          ]);
          const timeOutImagePath = getRecordValue(record, [
            "time_out_image_path",
            "timeOutImagePath",
            "TIME_OUT_IMAGE_PATH",
            "time_out_image",
            "timeOutImage",
          ]);
          const timeOutImageId = getRecordValue(record, [
            "time_out_image_id",
            "timeOutImageId",
            "TIME_OUT_IMAGE_ID",
            "time_out_imageid",
            "timeOutImageID",
          ]);
          const timeInImageUrl = getTimekeepingImageUrl(
            timeInImagePath,
            timeInImageId,
            record
          );
          const timeOutImageUrl = getTimekeepingImageUrl(
            timeOutImagePath,
            timeOutImageId,
            record
          );

          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4 lg:p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                      {dayjs(record.date).format("MMM D, YYYY")}
                    </h3>
                    {isFinal && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                        FINAL
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    {record.worked_hrs != null
                      ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                      : "0.00 hrs"}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[10px] lg:text-[11px] text-gray-400 uppercase tracking-widest mb-1 font-bold">
                    IN • OUT
                  </div>
                  <div className="font-mono text-sm lg:text-base font-semibold text-gray-800">
                    {record.time_in
                      ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
                      : "N/A"}{" "}
                    •{" "}
                    {record.time_out
                      ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
                      : "N/A"}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-2 mb-6 flex justify-between items-center border border-gray-100">
                <span className="text-sm text-gray-500">Break</span>
                <span className="text-sm font-medium text-gray-700 font-mono">
                  {record.break_in
                    ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm A")
                    : "N/A"}
                  {" • "}
                  {record.break_out
                    ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm A")
                    : "N/A"}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-6 lg:gap-x-12">
                <div className="flex flex-row gap-4 lg:gap-6">
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase font-bold tracking-wide">
                      <Camera size={14} /> Time In
                    </div>
                    {timeInImageUrl ? (
  <img
    src={timeInImageUrl}
    alt="Time In"
    className="w-32 lg:w-40 aspect-square object-cover rounded-xl border border-gray-100 shadow-sm"
    data-fallback-srcs={JSON.stringify(
      getTimekeepingImageFallbacks(timeInImagePath, timeInImageId, record)
    )}
    data-fallback-index="0"
    onError={(e) => handleTimekeepingImageError(e, "Time In")}
  />
) : (
  <div className="flex items-center justify-center w-32 lg:w-40 aspect-square bg-gray-50 rounded-xl border border-dashed border-gray-200">
    <ImageIcon size={24} className="text-gray-300" />
  </div>
)}
                  </div>

                  {isLocationRequired && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase font-bold tracking-wide">
                        <MapPin size={14} className="text-green-500" /> Time In Location
                      </div>
                      <p className="text-xs lg:text-[13px] text-gray-600 leading-relaxed font-medium max-w-[200px] lg:max-w-xs">
                        {record.time_in_address || "N/A"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-row gap-4 lg:gap-6">
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase font-bold tracking-wide">
                      <Camera size={14} /> Time Out
                    </div>
                    {timeOutImageUrl ? (
  <img
    src={timeOutImageUrl}
    alt="Time Out"
    className="w-32 lg:w-40 aspect-square object-cover rounded-xl border border-gray-100 shadow-sm"
    data-fallback-srcs={JSON.stringify(
      getTimekeepingImageFallbacks(timeOutImagePath, timeOutImageId, record)
    )}
    data-fallback-index="0"
    onError={(e) => handleTimekeepingImageError(e, "Time Out")}
  />
) : (
  <div className="flex items-center justify-center w-32 lg:w-40 aspect-square bg-gray-50 rounded-xl border border-dashed border-gray-200">
    <ImageIcon size={24} className="text-gray-300" />
  </div>
)}
                  </div>

                  <div className="flex flex-col gap-2 flex-1">
                    {isLocationRequired && record.time_out_address ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 uppercase font-bold tracking-wide">
                          <MapPin size={14} className="text-red-400" /> Time Out Location
                        </div>
                        <p className="text-xs lg:text-[13px] text-gray-600 leading-relaxed font-medium max-w-[200px] lg:max-w-xs">
                          {record.time_out_address}
                        </p>
                      </>
                    ) : (
                      <div className="mt-auto flex gap-2">
                        {canAdjust && (
                          <button
                            onClick={() => handleAdjustClick(record)}
                            className="w-32 lg:w-40 py-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-all font-bold shadow-sm"
                          >
                            Adjust Time
                          </button>
                        )}
                        {canOffset && (
                          <button
                            onClick={() => handleOffsetClick(record)}
                            className="w-32 lg:w-40 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold shadow-sm"
                          >
                            Offset
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const AccordionView = ({ filteredRecords }) => (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {filteredRecords.map((record, index) => (
        <div key={index} className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => setExpandedRecord(expandedRecord === index ? null : index)}
            className="w-full p-4 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
          >
<<<<<<< Updated upstream
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-gray-900">{formatDate(record.date)}</div>
                  {record.stat === "F" && (
=======
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {dayjs(record.date).format("MMM DD, YYYY")}
                  </h3>
                  {isFinal ? (
>>>>>>> Stashed changes
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                      FINAL
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-gray-600">
                  {record.time_in
                    ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
                    : "N/A"}{" "}
                  -{" "}
                  {record.time_out
                    ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
                    : "N/A"}
                </div>
<<<<<<< Updated upstream
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-blue-600">
                    {record.worked_hrs != null
                      ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                      : "0.00 hrs"}
                  </div>
                </div>
                {expandedRecord === index ? (
                  <ChevronUp size={20} className="text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-400" />
                )}
=======

                {canAdjust ? (
                  <button
                    onClick={() => navigate("/timekeepingAdj", { state: { record } })}
                    className="mt-2 inline-block px-3 py-1 text-[10px] sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                  >
                    Adjust Time
                  </button>
                ) : null}
>>>>>>> Stashed changes
              </div>
            </div>
          </button>

<<<<<<< Updated upstream
          {expandedRecord === index && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <div className="space-y-4 pt-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-700 mb-2">Break Time</div>
                  <div className="text-sm text-gray-600">
                    {record.break_in
                      ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A")
                      : "N/A"}{" "}
                    -{" "}
                    {record.break_out
                      ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A")
                      : "N/A"}
                  </div>
                </div>

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
    const handleAdjustClick = (record) => {
      navigate("/timekeepingAdj", { state: { record } });
    };

    const handleOffsetClick = (record) => {
      navigate("/offsetApplication", { state: { record } });
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-col">
          {filteredRecords.map((record, index) => {
            const isFinal = record.stat === "F";
            const hasCompleteTime = record.time_in && record.time_out;
            const isIncomplete = !hasCompleteTime;
            const canOffset = isFinal && hasCompleteTime;

            const timeInDisplay = record.time_in
              ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
              : "Missing";
            const timeOutDisplay = record.time_out
              ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
              : "Missing";
            const breakInDisplay = record.break_in
              ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A")
              : "N/A";
            const breakOutDisplay = record.break_out
              ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A")
              : "N/A";

            return (
              <div
                key={index}
                className="grid grid-cols-3 gap-4 items-center p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm text-gray-800 font-medium">
                  {dayjs(record.date).format("MM/DD/YYYY")}
                </div>

                <div className="flex justify-center">
                  <div className="flex flex-col text-xs space-y-1">
                    <div className="text-gray-500">
                      <span className="inline-block w-8">In:</span>
                      <span className={!record.time_in ? "text-red-500 font-medium" : "text-gray-800"}>
                        {timeInDisplay}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      <span className="inline-block w-8">Out:</span>
                      <span className={!record.time_out ? "text-red-500 font-medium" : "text-gray-800"}>
                        {timeOutDisplay}
                      </span>
                    </div>
                    <div className="text-gray-400 mt-1">
                      Break: {breakInDisplay} - {breakOutDisplay}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-center space-y-1.5">
                  <div className="text-sm font-semibold text-blue-600">
                    {record.worked_hrs ? `${Number(record.worked_hrs).toFixed(2)} hrs` : "0.00 hrs"}
                  </div>

                  {isIncomplete && !isFinal && (
                    <button
                      onClick={() => handleAdjustClick(record)}
                      className="px-3 py-1 text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium shadow-sm transition-colors"
                    >
                      Adjust Time
                    </button>
                  )}

                  {canOffset && (
                    <button
                      onClick={() => handleOffsetClick(record)}
                      className="px-3 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition-colors"
                    >
                      Offset
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
=======
            <div className="p-4 space-y-3">
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

              {isImageCaptureRequired ? (
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Camera size={12} />
                      Time In
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="w-[140px] sm:w-[190px]">
                        <HistoryImage
                          imageId={record.time_in_image_id}
                          imagePath={record.time_in_image_path}
                          alt="Time In"
                          className="rounded-lg w-[140px] h-[120px] sm:w-[190px] sm:h-[180px] object-cover"
                        />
                      </div>

                      {shouldShowLocationData ? (
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            <MapPin
                              size={14}
                              className="text-green-500 mt-0.5 flex-shrink-0"
                            />
                            <div>
                              <div className="text-xs text-gray-500">
                                Time In Location
                              </div>
                              <div className="text-sm text-gray-700 break-words">
                                {record.time_in_address || "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Camera size={12} />
                      Time Out
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="w-[140px] sm:w-[190px]">
                        <HistoryImage
                          imageId={record.time_out_image_id}
                          imagePath={record.time_out_image_path}
                          alt="Time Out"
                          className="rounded-lg w-[140px] h-[120px] sm:w-[190px] sm:h-[180px] object-cover"
                        />
                      </div>

                      {shouldShowLocationData ? (
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            <MapPin
                              size={14}
                              className="text-red-500 mt-0.5 flex-shrink-0"
                            />
                            <div>
                              <div className="text-xs text-gray-500">
                                Time Out Location
                              </div>
                              <div className="text-sm text-gray-700 break-words">
                                {record.time_out_address || "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  const CompactTableView = ({ filteredRecords }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">
                Date
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700">
                Time Details
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700">
                Hours
              </th>
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
                        {isFinal ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                            FINAL
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-2 py-3 align-top">
                      <div className="text-[11px] sm:text-xs text-gray-600 space-y-1">
                        <div>
                          In:&nbsp;
                          {record.time_in ? (
                            dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
                          ) : (
                            <span className="text-red-500 font-semibold">Missing</span>
                          )}
                        </div>
                        <div>
                          Out:&nbsp;
                          {record.time_out ? (
                            dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
                          ) : (
                            <span className="text-red-500 font-semibold">Missing</span>
                          )}
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

                      {isIncomplete && !isFinal ? (
                        <button
                          onClick={() =>
                            navigate("/timekeepingAdj", { state: { record } })
                          }
                          className="mt-1 inline-block px-2 py-1 text-[11px] sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                        >
                          Adjust Time
                        </button>
                      ) : null}
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

  const FullTableView = ({ filteredRecords }) => {
    const calculateColSpan = () => {
      let colSpan = 6;
      if (shouldShowLocationData) colSpan += 2;
      return colSpan;
    };

    return (
      <div className="mt-4 p-2 bg-white rounded-lg shadow-lg overflow-x-auto">
        <h2 className="text-base font-bold mb-4">Daily Time Record Summary</h2>

        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="border-b">
              <th className="px-1 py-2 text-left text-[9px] md:text-sm font-semibold whitespace-nowrap">
                Shift Date
              </th>
              <th className="px-1 py-2 text-left text-[9px] md:text-sm font-semibold whitespace-nowrap">
                Time In
              </th>
              {shouldShowLocationData ? (
                <th className="px-1 py-2 text-left text-[9px] md:text-sm font-semibold whitespace-nowrap">
                  Time In Location
                </th>
              ) : null}
              <th className="px-1 py-2 text-left text-[9px] md:text-sm font-semibold whitespace-nowrap">
                Break Time
              </th>
              <th className="px-1 py-2 text-left text-[9px] md:text-sm font-semibold whitespace-nowrap">
                Time Out
              </th>
              {shouldShowLocationData ? (
                <th className="px-1 py-2 text-left text-[9px] md:text-sm font-semibold whitespace-nowrap">
                  Time Out Location
                </th>
              ) : null}
              <th className="px-1 py-2 text-right text-[9px] md:text-sm font-semibold whitespace-nowrap">
                Total hrs
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record, index) => {
                const isFinal = record.stat === "F";
                const showAdjIn = isBlank(record.time_in);
                const showAdjOut = isBlank(record.time_out);

                return (
                  <tr key={index} className="border-b">
                    <td className="px-1 py-1 text-[8px] md:text-xs">
                      <div className="flex items-center gap-1">
                        <span>{dayjs(record.date).format("MM/DD/YYYY")}</span>
                        {isFinal ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[8px] font-semibold text-green-600 border border-green-200">
                            FINAL
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-1 py-1 text-[8px] md:text-xs whitespace-nowrap">
                      {isFinal || !showAdjIn ? (
                        record.time_in
                          ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm A")
                          : ""
                      ) : (
                        <button
                          onClick={() =>
                            navigate("/timekeepingAdj", { state: { record } })
                          }
                          className="inline-block px-2 py-1 text-[10px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                        >
                          Adjust Time
                        </button>
                      )}
                    </td>

                    {shouldShowLocationData ? (
                      <td className="px-1 py-1 text-[8px] md:text-xs max-w-[220px] break-words">
                        {record.time_in_address || "N/A"}
                      </td>
                    ) : null}

                    <td className="px-1 py-1 text-[8px] md:text-xs whitespace-nowrap">
                      {record.break_in
                        ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm A")
                        : "N/A"}{" "}
                      -{" "}
                      {record.break_out
                        ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm A")
                        : "N/A"}
                    </td>

                    <td className="px-1 py-1 text-[8px] md:text-xs whitespace-nowrap">
                      {isFinal || !showAdjOut ? (
                        record.time_out
                          ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm A")
                          : ""
                      ) : (
                        <button
                          onClick={() =>
                            navigate("/timekeepingAdj", { state: { record } })
                          }
                          className="inline-block px-2 py-1 text-[10px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                        >
                          Adjust Time
                        </button>
                      )}
                    </td>

                    {shouldShowLocationData ? (
                      <td className="px-1 py-1 text-[8px] md:text-xs max-w-[220px] break-words">
                        {record.time_out_address || "N/A"}
                      </td>
                    ) : null}

                    <td className="px-1 py-1 text-[8px] md:text-xs text-right font-medium whitespace-nowrap">
                      {record.worked_hrs != null
                        ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                        : "0.00 hrs"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={calculateColSpan()}
                  className="text-center py-4 text-gray-500"
                >
                  No records found for the selected date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
>>>>>>> Stashed changes
      </div>
    );
  };

<<<<<<< Updated upstream
  const FullTableView = ({ filteredRecords }) => {
    const isBlank = (v) => v == null || String(v).trim() === "";
    const colSpan = 5 + (isLocationRequired ? 2 : 0);

    const handleAdjustClick = (record) => {
      navigate("/timekeepingAdj", { state: { record } });
    };

    const Row = ({ label, value }) => (
      <div className="flex gap-2 text-xs">
        <span className="w-20 shrink-0 font-semibold text-gray-500">{label}</span>
        <span className="text-gray-800 break-words">{value}</span>
      </div>
    );

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-4 mb-6">
        <div className="p-3 sm:p-5 border-b border-gray-100">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">Daily Time Record Summary</h2>
        </div>

        <div className="sm:hidden divide-y divide-gray-100">
=======
  const FullSummaryView = ({ filteredRecords }) => (
    <div className="mt-4 p-2 bg-white rounded-lg shadow-lg overflow-x-auto">
      <h2 className="text-base font-bold mb-4">Daily Time Record Summary</h2>

      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-1 py-2 text-left text-[10px] md:text-sm font-semibold whitespace-nowrap">
              Shift Date
            </th>
            <th className="px-1 py-2 text-left text-[10px] md:text-sm font-semibold whitespace-nowrap">
              Time In
            </th>
            <th className="px-1 py-2 text-left text-[10px] md:text-sm font-semibold whitespace-nowrap">
              Time Out
            </th>
            <th className="px-1 py-2 text-right text-[10px] md:text-sm font-semibold whitespace-nowrap">
              Total hrs
            </th>
          </tr>
        </thead>
        <tbody>
>>>>>>> Stashed changes
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record, index) => {
              const isFinal = record.stat === "F";
              const showAdjIn = isBlank(record.time_in);
              const showAdjOut = isBlank(record.time_out);

              return (
<<<<<<< Updated upstream
                <div key={index} className="p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-900">
                        {dayjs(record.date).format("MM/DD/YYYY")}
                      </span>
                      {isFinal && (
                        <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-600 border border-green-200">
=======
                <tr key={index} className="border-b">
                  <td className="px-1 py-1 text-[8px] md:text-xs">
                    <div className="flex items-center gap-1">
                      <span>{dayjs(record.date).format("MM/DD/YYYY")}</span>
                      {isFinal ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[8px] font-semibold text-green-600 border border-green-200">
>>>>>>> Stashed changes
                          FINAL
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs font-semibold text-blue-600">
                      {record.worked_hrs != null
                        ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                        : "0.00 hrs"}
                    </span>
                  </div>

<<<<<<< Updated upstream
                  <Row
                    label="Time In:"
                    value={
                      !showAdjIn ? (
                        dayjs(record.time_in, "HH:mm:ss").format("hh:mm:ss A")
                      ) : isFinal ? (
                        "N/A"
                      ) : (
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="px-2 py-0.5 text-[10px] bg-yellow-500 text-white rounded"
                        >
                          Adjust
                        </button>
                      )
                    }
                  />

                  {isLocationRequired && (
                    <Row label="In Loc:" value={record.time_in_address || "N/A"} />
                  )}

                  <Row
                    label="Break:"
                    value={`${record.break_in ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm A") : "N/A"} – ${
                      record.break_out ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm A") : "N/A"
                    }`}
                  />

                  <Row
                    label="Time Out:"
                    value={
                      !showAdjOut ? (
                        dayjs(record.time_out, "HH:mm:ss").format("hh:mm:ss A")
                      ) : isFinal ? (
                        "N/A"
                      ) : (
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="px-2 py-0.5 text-[10px] bg-yellow-500 text-white rounded"
                        >
                          Adjust
                        </button>
                      )
                    }
                  />

                  {isLocationRequired && (
                    <Row label="Out Loc:" value={record.time_out_address || "N/A"} />
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-center py-8 text-xs text-gray-500">No records found.</p>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-bold text-gray-900 bg-gray-50">
                <th className="px-3 py-3 whitespace-nowrap">Shift Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Time In</th>
                {isLocationRequired && <th className="px-3 py-3">Location In</th>}
                <th className="px-3 py-3 whitespace-nowrap">Break</th>
                <th className="px-3 py-3 whitespace-nowrap">Time Out</th>
                {isLocationRequired && <th className="px-3 py-3">Location Out</th>}
                <th className="px-3 py-3 text-right whitespace-nowrap">Total hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-800">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record, index) => {
                  const isFinal = record.stat === "F";
                  const showAdjIn = isBlank(record.time_in);
                  const showAdjOut = isBlank(record.time_out);

                  return (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span>{dayjs(record.date).format("MM/DD/YYYY")}</span>
                          {isFinal && (
                            <span className="w-max rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-600 border border-green-200">
                              FINAL
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {isFinal || !showAdjIn ? (
                          record.time_in ? (
                            dayjs(record.time_in, "HH:mm:ss").format("hh:mm A")
                          ) : (
                            "N/A"
                          )
                        ) : (
                          <button
                            onClick={() => handleAdjustClick(record)}
                            className="px-2 py-1 text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                          >
                            Adjust Time
                          </button>
                        )}
                      </td>
                      {isLocationRequired && (
                        <td className="px-3 py-3 align-top max-w-[200px] break-words leading-relaxed text-gray-700">
                          {record.time_in_address || "N/A"}
                        </td>
                      )}
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {record.break_in
                          ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm A")
                          : "N/A"}{" "}
                        –{" "}
                        {record.break_out
                          ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm A")
                          : "N/A"}
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {isFinal || !showAdjOut ? (
                          record.time_out ? (
                            dayjs(record.time_out, "HH:mm:ss").format("hh:mm A")
                          ) : (
                            "N/A"
                          )
                        ) : (
                          <button
                            onClick={() => handleAdjustClick(record)}
                            className="px-2 py-1 text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                          >
                            Adjust Time
                          </button>
                        )}
                      </td>
                      {isLocationRequired && (
                        <td className="px-3 py-3 align-top max-w-[200px] break-words leading-relaxed text-gray-700">
                          {record.time_out_address || "N/A"}
                        </td>
                      )}
                      <td className="px-3 py-3 align-top text-right whitespace-nowrap font-semibold text-blue-600">
                        {record.worked_hrs != null
                          ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                          : "0.00 hrs"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={colSpan} className="text-center py-8 text-gray-500">
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

  const FullSummaryView = ({ filteredRecords }) => {
    const isBlank = (v) => v == null || String(v).trim() === "";

    const handleAdjustClick = (record) => {
      navigate("/timekeepingAdj", { state: { record } });
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-4 mb-6">
        <div className="p-3 sm:p-5 border-b border-gray-100">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">Daily Time Record Summary</h2>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-bold text-gray-900 bg-gray-50">
                <th className="px-3 py-3 whitespace-nowrap">Shift Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Time In</th>
                <th className="px-3 py-3 whitespace-nowrap">Time Out</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Total hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-800">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record, index) => {
                  const isFinal = record.stat === "F";
                  const showAdjIn = isBlank(record.time_in);
                  const showAdjOut = isBlank(record.time_out);
                  const dateStr = dayjs(record.date).format("MM/DD/YYYY");

                  return (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-3 align-top whitespace-nowrap text-gray-900">
                        {dateStr}
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {!showAdjIn ? (
                          `${dateStr} ${dayjs(record.time_in, "HH:mm:ss").format("hh:mm A")}`
                        ) : isFinal ? (
                          "N/A"
                        ) : (
                          <button
                            onClick={() => handleAdjustClick(record)}
                            className="px-2 py-1 text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                          >
                            Adjust Time
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {!showAdjOut ? (
                          `${dateStr} ${dayjs(record.time_out, "HH:mm:ss").format("hh:mm A")}`
                        ) : isFinal ? (
                          "N/A"
                        ) : (
                          <button
                            onClick={() => handleAdjustClick(record)}
                            className="px-2 py-1 text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                          >
                            Adjust Time
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right whitespace-nowrap font-semibold text-blue-600">
                        {record.worked_hrs != null
                          ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                          : "0.00 hrs"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500">
                    No records found for the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden divide-y divide-gray-100">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record, index) => {
              const dateStr = dayjs(record.date).format("MM/DD/YYYY");

              return (
                <div key={index} className="p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900">{dateStr}</span>
                    <span className="text-xs font-semibold text-blue-600">
                      {record.worked_hrs != null
                        ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                        : "0.00 hrs"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-700">
                    Time In:{" "}
                    {record.time_in
                      ? dayjs(record.time_in, "HH:mm:ss").format("hh:mm A")
                      : "N/A"}
                  </div>
                  <div className="text-xs text-gray-700">
                    Time Out:{" "}
                    {record.time_out
                      ? dayjs(record.time_out, "HH:mm:ss").format("hh:mm A")
                      : "N/A"}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center py-8 text-xs text-gray-500">No records found.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[70px] p-4 sm:p-6 bg-gray-100 min-h-screen">
      <div className="bg-blue-800 p-3 rounded-xl text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 w-full shadow-lg">
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
        <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-md flex-1">
          {isImageCaptureRequired && (
            <div className="relative w-full max-w-[320px] mb-4">
              <video
                ref={videoRef}
                width={320}
                height={240}
                autoPlay
                playsInline
                muted
                className="bg-black rounded-xl shadow-md transform scale-x-[-1]"
              />
              <canvas ref={canvasRef} width={320} height={240} className="hidden" />

              {capturing && (
  <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl pointer-events-none">
    {countdown > 0 ? (
      <span className="text-7xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
        {countdown}
      </span>
    ) : (
      <span className="text-3xl font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
        Smile!
      </span>
    )}
  </div>
)}
            </div>
          )}

          <div className="w-full grid grid-cols-2 gap-4">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
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
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
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
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
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
=======
                  <td className="px-1 py-1 text-[8px] md:text-xs whitespace-nowrap">
                    {isFinal || !showAdjIn ? (
                      record.time_in
                        ? dayjs(record.time_in, "HH:mm:ss").format("MM/DD/YYYY hh:mm A")
                        : ""
                    ) : (
                      <button
                        onClick={() =>
                          navigate("/timekeepingAdj", { state: { record } })
                        }
                        className="inline-block px-2 py-1 text-[10px] md:text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                      >
                        Adjust Time
                      </button>
                    )}
                  </td>

                  <td className="px-1 py-1 text-[8px] md:text-xs whitespace-nowrap">
                    {isFinal || !showAdjOut ? (
                      record.time_out
                        ? dayjs(record.time_out, "HH:mm:ss").format("MM/DD/YYYY hh:mm A")
                        : ""
                    ) : (
                      <button
                        onClick={() =>
                          navigate("/timekeepingAdj", { state: { record } })
                        }
                        className="inline-block px-2 py-1 text-[10px] md:text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                      >
                        Adjust Time
                      </button>
                    )}
                  </td>

                  <td className="px-1 py-1 text-[8px] md:text-xs text-right font-medium whitespace-nowrap">
                    {record.worked_hrs != null
                      ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                      : "0.00 hrs"}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-500">
                No records found for the selected date range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] sm:mt-[70px] p-3 sm:p-4 bg-gray-100 min-h-screen">
      <div className="hidden">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      <div className="bg-blue-800 px-3 py-2 sm:p-3 rounded-lg text-white flex flex-row items-center justify-between gap-3 mb-3 w-full shadow-lg">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-light leading-none">Today</p>
          <h1 className="text-sm sm:text-lg md:text-2xl font-extrabold leading-tight truncate">
            {currentDate.format("MMMM DD, YYYY")}
          </h1>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[9px] sm:text-xs font-extrabold leading-none mb-1">
            Philippine Standard Time
          </p>
          <p className="text-base sm:text-2xl font-bold leading-none">
            {time || "00:00 PM"}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-center gap-4 w-full">
        <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-md flex-1">
          {isImageCaptureRequired ? (
            <div className="w-full mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-base">Face Verification</div>
                  <div className="text-xs sm:text-sm text-blue-700 mt-1">
                    FACEIO will open its secure widget when you click a timekeeping button.
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                    faceioStatus.ready
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {faceioStatus.ready ? "READY" : "WAITING"}
                </span>
              </div>

              <div className="mt-3 text-sm">{faceioStatus.message}</div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetFaceIO}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  Reset Face Verification
                </button>
                <button
                  type="button"
                  onClick={() => setIsImageCaptureRequired((prev) => !prev)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  {isImageCaptureRequired ? "Disable Face Check" : "Enable Face Check"}
                </button>
              </div>

              <div className="mt-2 text-xs text-blue-700">
                Make sure this employee has already been enrolled in FACEIO and that
                the enrolled payload is mapped to the same employee number.
              </div>
            </div>
          ) : null}

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
>>>>>>> Stashed changes
            >
              Break Out
            </button>

            <button
<<<<<<< Updated upstream
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
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
=======
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-lg shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("TIME OUT")}
              disabled={!actionState.canTimeOut}
>>>>>>> Stashed changes
            >
              Time Out
            </button>
          </div>
        </div>

<<<<<<< Updated upstream
        <div className="w-full md:w-1/3 p-4 bg-white rounded-xl shadow-md flex flex-col">
          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">
              {branchLocation?.branchname || "Assigned Location Not Loaded"}
            </span>
          </p>

          <p className="text-gray-800 text-[14px] md:text-sm mb-2">
            <span className="font-bold">Branch Location:</span>{" "}
            {branchLocation?.address || "N/A"}
          </p>

          {isLocationRequired && (
            <p className="text-gray-800 text-[12px] md:text-sm mb-6">
              <span className="font-bold">Allowed Radius:</span>{" "}
              {branchLocation?.allowedRadius ?? "N/A"} meters
              {locationAccuracy != null && (
                <>
                  {" "}
                  | <span className="font-bold">Current Accuracy:</span>{" "}
                  {Math.round(locationAccuracy)} meters
                </>
              )}
            </p>
          )}

=======
        <div className="w-full md:w-1/3 p-4 bg-white rounded-lg shadow-md flex flex-col">
          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">
              {branchLocation.branchname || "Assigned Branch"}
            </span>
          </p>

          <p className="text-gray-800 text-[14px] md:text-sm mb-6">
            <span className="font-bold">Branch Location:</span>{" "}
            {branchLocation.address}
          </p>

>>>>>>> Stashed changes
          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Time In:</span>{" "}
            {todayRecord?.time_in
              ? dayjs(todayRecord.time_in, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

<<<<<<< Updated upstream
          {isLocationRequired && (
=======
          {shouldShowLocationData ? (
>>>>>>> Stashed changes
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.time_in_address || "Not Recorded"}
            </p>
<<<<<<< Updated upstream
          )}
=======
          ) : null}
>>>>>>> Stashed changes

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break In:</span>{" "}
            {todayRecord?.break_in
              ? dayjs(todayRecord.break_in, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

<<<<<<< Updated upstream
          {isLocationRequired && (
=======
          {shouldShowLocationData ? (
>>>>>>> Stashed changes
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.break_in_address || "Not Recorded"}
            </p>
<<<<<<< Updated upstream
          )}
=======
          ) : null}
>>>>>>> Stashed changes

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break Out:</span>{" "}
            {todayRecord?.break_out
              ? dayjs(todayRecord.break_out, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

<<<<<<< Updated upstream
          {isLocationRequired && (
=======
          {shouldShowLocationData ? (
>>>>>>> Stashed changes
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.break_out_address || "Not Recorded"}
            </p>
<<<<<<< Updated upstream
          )}
=======
          ) : null}
>>>>>>> Stashed changes

          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-bold">🕐 Time Out:</span>{" "}
            {todayRecord?.time_out
              ? dayjs(todayRecord.time_out, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

<<<<<<< Updated upstream
          {isLocationRequired && (
=======
          {shouldShowLocationData ? (
>>>>>>> Stashed changes
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.time_out_address || "Not Recorded"}
            </p>
<<<<<<< Updated upstream
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-white rounded-xl shadow-md">
        <div>
          <div className="mb-6">
            <h1 className="text-lg font-bold mb-4 text-gray-900">Daily Time Record</h1>

            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="w-full sm:w-48 lg:w-64 h-10 pl-9 pr-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-[14px] text-gray-700 outline-none bg-white cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="w-full sm:w-48 lg:w-64 h-10 pl-9 pr-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-[14px] text-gray-700 outline-none bg-white cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0">
                <button
                  onClick={handleExport}
                  className="flex-1 sm:flex-none h-10 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  <Download size={16} />
                  Export
                </button>

                {/* <button
                  onClick={() => navigate("/offsetApplication", { state: { fromDTR: true } })}
                  className="flex-1 sm:flex-none h-10 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  Offset Application
                </button> */}

                <button
                  onClick={() => navigate("/timekeepingAdj")}
                  className="flex-1 sm:flex-none h-10 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  DTR Adjustment
                </button>

                <button
                  onClick={handleDtrConfirmation}
                  className="flex-1 sm:flex-none h-10 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  DTR Confirmation
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-0 border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("cards")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "cards"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                }`}
              >
                Cards
              </button>

              <button
                onClick={() => setViewMode("table")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                }`}
              >
                Compact
              </button>

              <button
                onClick={() => setViewMode("tableSummary")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "tableSummary"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                }`}
              >
                Summary
              </button>

              <button
                onClick={() => setViewMode("summary")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "summary"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Table
=======
          ) : null}

          {userLocation ? (
            <div className="mt-2 text-xs text-gray-500">
              Current coords: {userLocation.latitude}, {userLocation.longitude}
              {locationAccuracy != null
                ? ` • Accuracy: ${Math.round(locationAccuracy)}m`
                : ""}
            </div>
          ) : null}

          {locationAddress ? (
            <div className="mt-1 text-xs text-gray-500 break-words">
              Current address: {locationAddress}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
        <div className="mb-6">
          <h1 className="text-base font-bold mb-4">Daily Time Record</h1>

          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="w-full xl:max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                <CalendarDays size={16} />
                Date Filter
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={draftStartDate}
                    max={draftEndDate || undefined}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    className="w-full min-w-0 text-[16px] h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={draftEndDate}
                    min={draftStartDate || undefined}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    className="w-full min-w-0 text-[16px] h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyDateFilter}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Filter size={15} />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={setTodayFilter}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={resetDateFilter}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 flex items-center gap-2"
                >
                  <RotateCcw size={15} />
                  This Month
                </button>
                <div className="text-xs text-gray-500 self-center sm:ml-auto">
                  Applied: {dayjs(startDate).format("MMM DD, YYYY")} - {dayjs(endDate).format("MMM DD, YYYY")}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto xl:justify-end">
              <button
                onClick={handleExport}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Export
              </button>

              <button
                onClick={() =>
                  navigate("/timekeepingFaceEnroll", {
                    state: {
                      employeeData: user,
                      user: user,
                    },
                  })
                }
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Face Enrollment
              </button>

              <button
                onClick={() => navigate("/timekeepingAdj")}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                DTR Adjustment
              </button>

              <button
                onClick={handleDtrConfirmation}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                DTR Confirmation
>>>>>>> Stashed changes
              </button>
            </div>
          </div>

<<<<<<< Updated upstream
          {viewMode === "cards" && CardView({ filteredRecords })}
          {viewMode === "accordion" && <AccordionView filteredRecords={filteredRecords} />}
          {viewMode === "table" && <CompactTableView filteredRecords={filteredRecords} />}
          {viewMode === "tableSummary" && <FullTableView filteredRecords={filteredRecords} />}
          {viewMode === "summary" && <FullSummaryView filteredRecords={filteredRecords} />}

          <div className="mt-6 bg-blue-50 p-2 rounded-xl">
            <div className="flex justify-between items-center">
              <div className="px-2 py-1 text-xs md:text-sm font-bold text-gray-700">
                Total Hours:
              </div>
              <div className="px-2 py-1 text-right text-xs md:text-sm font-bold text-gray-900">
                {totalWorkedHours.toFixed(2)} hrs
              </div>
=======
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "cards"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Cards
            </button>

            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "table"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Compact
            </button>

            <button
              onClick={() => setViewMode("tableSummary")}
              className={`px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "tableSummary"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Detailed
            </button>

            <button
              onClick={() => setViewMode("summary")}
              className={`px-3 py-2 text-sm rounded-md font-medium ${
                viewMode === "summary"
                  ? "bg-blue-600 text-white border border-blue-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Simple
            </button>
          </div>
        </div>

        {viewMode === "cards" ? <CardView filteredRecords={filteredRecords} /> : null}
        {viewMode === "table" ? (
          <CompactTableView filteredRecords={filteredRecords} />
        ) : null}
        {viewMode === "tableSummary" ? (
          <FullTableView filteredRecords={filteredRecords} />
        ) : null}
        {viewMode === "summary" ? (
          <FullSummaryView filteredRecords={filteredRecords} />
        ) : null}

        <div className="mt-6 bg-blue-50 p-2 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="px-2 py-1 text-xs md:text-sm font-bold text-gray-700">
              Total Hours:
            </div>
            <div className="px-2 py-1 text-right text-xs md:text-sm font-bold text-gray-900">
              {totalWorkedHours.toFixed(2)} hrs
>>>>>>> Stashed changes
            </div>
          </div>
        </div>
      </div>

      <SpinnerOverlay show={loading.show} message={loading.message} />
    </div>
  );
};

export default Timekeeping;
