import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import * as faceapi from "face-api.js";
import API_ENDPOINTS, { IMAGE_BASE_URL } from "@/apiConfig.jsx";
import fetchApi from "@/fetchApi.js";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Camera,
  Download,
  Image as ImageIcon,
  CircleCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const upsertTimeIn = (data) =>
  fetchApi(API_ENDPOINTS.upsertTimeIn, "POST", data);

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
const SERVER_TIME_SYNC_INTERVAL_MS = 300000;

const parseServerDateTime = (value) => {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    return value < 1000000000000 ? value * 1000 : value;
  }

  const rawValue = String(value).trim();
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue) ||
    /\b(?:GMT|UTC)\b/i.test(rawValue);
  const parsed = hasExplicitTimezone
    ? dayjs(rawValue)
    : dayjs.tz(rawValue, PH_TIMEZONE);

  return parsed.isValid() ? parsed.valueOf() : null;
};

const getServerTimestampFromResponse = (response) => {
  const data = response?.data || {};
  const candidates = [
    data.philippineStandardTime,
    data.philippine_standard_time,
    data.serverTime,
    data.server_time,
    data.currentDateTime,
    data.current_datetime,
    data.datetime,
    data.timestamp,
    response?.headers?.date,
  ];

  for (const candidate of candidates) {
    const timestamp = parseServerDateTime(candidate);
    if (timestamp) return timestamp;
  }

  return null;
};

const getFirstNonBlankValue = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];

    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
};

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
  const pendingTimekeepingImagesRef = useRef(new Map());
  const trustedClockRef = useRef(null);
  const trustedDateRangeInitializedRef = useRef(false);

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

const normalizeEnabledFlag = (value, defaultValue = 1) => {
  if (value == null || String(value).trim() === "") {
    return defaultValue;
  }

  const textValue = String(value).trim().toUpperCase();

  if (["1", "Y", "YES", "TRUE", "T", "ON"].includes(textValue)) {
    return 1;
  }

  if (["0", "N", "NO", "FALSE", "F", "OFF"].includes(textValue)) {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
};

const isGeotaggingEnabled = () => true;

const isGeofenceEnabled = (branchLocation) =>
  normalizeEnabledFlag(branchLocation?.geofence, 1) === 1;

const isLocationCaptureRequired = () => true;

const isLocationValidationRequired = (branchLocation) =>
  isGeofenceEnabled(branchLocation);

const validateGeofenceLocation = (userCoords, branchLocation) => {
  if (!isGeofenceEnabled(branchLocation)) {
    return {
      allowed: true,
      message: "Geofence validation is disabled.",
      distance: 0,
      allowedRadius: 0,
      accuracy: Number(userCoords?.accuracy ?? 0),
    };
  }

  if (!branchLocation) {
    return {
      allowed: false,
      message: "Assigned location is not loaded. Please contact HR/Admin.",
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

  const [currentDate, setCurrentDate] = useState(null);
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
  const [clockSyncStatus, setClockSyncStatus] = useState("syncing");

  const [userLocation, setUserLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [viewMode, setViewMode] = useState("cards");
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [empBranchLoc, setEmpBranchLoc] = useState(null);
  const [employeeShiftSchedule, setEmployeeShiftSchedule] = useState(
    getFirstNonBlankValue(user, [
      "shiftSchedule",
      "shift_schedule",
      "SHIFT_SCHEDULE",
      "schedule",
      "SCHEDULE",
    ])
  );

  const roundCoord = (n, p = 5) => Number(n).toFixed(p);

  const branchLocation = empBranchLoc;
  const shouldShowLocationAddress = branchLocation
    ? isGeotaggingEnabled(branchLocation)
    : isLocationRequired;
  const shouldShowGeofenceDetails = branchLocation
    ? isGeofenceEnabled(branchLocation)
    : isLocationRequired;
  const isClockSynced = clockSyncStatus === "synced";

  const getTrustedPhilippineNow = useCallback(() => {
    const trustedClock = trustedClockRef.current;

    if (
      !trustedClock ||
      !Number.isFinite(trustedClock.serverTimestamp) ||
      !Number.isFinite(trustedClock.performanceTimestamp)
    ) {
      return null;
    }

    return dayjs(
      trustedClock.serverTimestamp +
        (performance.now() - trustedClock.performanceTimestamp)
    ).tz(PH_TIMEZONE);
  }, []);

  const syncPhilippineClock = useCallback(async () => {
    setClockSyncStatus("syncing");

    const requestedAt = performance.now();

    try {
      const response = await axios.get(API_ENDPOINTS.serverTime, {
        params: { t: String(requestedAt) },
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        timeout: 8000,
        validateStatus: () => true,
      });
      const receivedAt = performance.now();
      const serverTimestamp = getServerTimestampFromResponse(response);

      if (!serverTimestamp) {
        throw new Error(
          "Server date/time was not available. Please expose serverTime JSON or the Date response header."
        );
      }

      const networkAdjustedServerTimestamp =
        serverTimestamp + Math.round((receivedAt - requestedAt) / 2);

      trustedClockRef.current = {
        serverTimestamp: networkAdjustedServerTimestamp,
        performanceTimestamp: receivedAt,
      };

      const trustedNow = getTrustedPhilippineNow();

      if (!trustedNow) {
        throw new Error("Unable to start trusted Philippine Standard Time clock.");
      }

      setCurrentDate(trustedNow);
      setTime(trustedNow.format("hh:mm:ss A"));

      if (!trustedDateRangeInitializedRef.current) {
        setStartDate(trustedNow.startOf("month").format("YYYY-MM-DD"));
        setEndDate(trustedNow.endOf("month").format("YYYY-MM-DD"));
        trustedDateRangeInitializedRef.current = true;
      }

      setClockSyncStatus("synced");
    } catch (error) {
      trustedClockRef.current = null;
      setClockSyncStatus("failed");
      console.error("Philippine Standard Time sync failed:", error);
    }
  }, [getTrustedPhilippineNow]);

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
          geotagging: 1,
          geofence: normalizeEnabledFlag(
            fetchedLocation.geofence ??
              fetchedLocation.GEOFENCE ??
              fetchedLocation.geofencing ??
              fetchedLocation.GEOFENCING,
            1
          ),
        };

        const locationCaptureRequired = isLocationCaptureRequired(formattedLocation);
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
        setIsLocationRequired(locationCaptureRequired);

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
    if (!user?.empNo) return;

    let cancelled = false;

    const fetchEmployeeShiftSchedule = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.dashBoard, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ EMP_NO: user.empNo }),
        });
        const result = await response.json();
        const employee = Array.isArray(result?.data) ? result.data[0] : null;
        const shiftSchedule = getFirstNonBlankValue(employee, [
          "shiftSchedule",
          "shift_schedule",
          "SHIFT_SCHEDULE",
          "schedule",
          "SCHEDULE",
        ]);

        if (!cancelled && shiftSchedule) {
          setEmployeeShiftSchedule(shiftSchedule);
        }
      } catch (error) {
        console.warn("Unable to fetch employee shift schedule:", error);
      }
    };

    fetchEmployeeShiftSchedule();

    return () => {
      cancelled = true;
    };
  }, [user?.empNo]);

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
    syncPhilippineClock();

    const syncInterval = setInterval(
      syncPhilippineClock,
      SERVER_TIME_SYNC_INTERVAL_MS
    );

    const interval = setInterval(() => {
      const trustedNow = getTrustedPhilippineNow();

      if (!trustedNow) return;

      setTime(trustedNow.format("hh:mm:ss A"));
      setCurrentDate(trustedNow);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [getTrustedPhilippineNow, syncPhilippineClock]);

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

      return {
        ...savedImageInfo,
        previewUrl: imageDataUrl,
      };
    } finally {
      setCapturing(false);
      setCountdown(0);
    }
  },
  [requestNewImageId, saveCapturedFaceImage, verifyFace]
);

  const getNormalizedRecordDate = useCallback((record) => {
    const rawDate =
      record?.date ||
      record?.dtrDate ||
      record?.DTR_DATE ||
      record?.DTRDATE ||
      record?.DATE ||
      record?.recordDate ||
      record?.record_date ||
      record?.dateTime ||
      record?.date_time;

    if (!rawDate) return null;

    const parsedDate = dayjs(rawDate);
    return parsedDate.isValid()
      ? parsedDate.tz(PH_TIMEZONE).format("YYYY-MM-DD")
      : null;
  }, []);

  const isValueBlank = useCallback((value) => {
    return value == null || String(value).trim() === "";
  }, []);

  const getDtrActualDateTimeValue = useCallback((record, type) => {
    const keys =
      type === "timeIn"
        ? [
            "time_in_datetime",
            "timeInDateTime",
            "TIME_IN_DATETIME",
            "time_in_date_time",
            "TIME_IN_DATE_TIME",
            "actual_time_in",
            "actualTimeIn",
            "ACTUAL_TIME_IN",
            "dtrTimeIn",
            "DTR_TIME_IN",
            "datetime_in",
            "date_time_in",
            "in_datetime",
            "time_in_full",
            "time_in",
            "timeIn",
          ]
        : [
            "time_out_datetime",
            "timeOutDateTime",
            "TIME_OUT_DATETIME",
            "time_out_date_time",
            "TIME_OUT_DATE_TIME",
            "actual_time_out",
            "actualTimeOut",
            "ACTUAL_TIME_OUT",
            "dtrTimeOut",
            "DTR_TIME_OUT",
            "datetime_out",
            "date_time_out",
            "out_datetime",
            "time_out_full",
            "time_out",
            "timeOut",
          ];

    for (const key of keys) {
      const value = record?.[key];

      if (!isValueBlank(value)) return String(value).trim();
    }

    return "";
  }, [isValueBlank]);

  const getDtrActualDateValue = useCallback((record, type) => {
    const keys =
      type === "timeIn"
        ? [
            "time_in_date",
            "timeInDate",
            "TIME_IN_DATE",
            "actual_time_in_date",
            "actualTimeInDate",
          ]
        : [
            "time_out_date",
            "timeOutDate",
            "TIME_OUT_DATE",
            "actual_time_out_date",
            "actualTimeOutDate",
          ];

    for (const key of keys) {
      const value = record?.[key];

      if (!isValueBlank(value)) return String(value).trim();
    }

    return "";
  }, [isValueBlank]);

  const parseDtrDateTime = useCallback((dateValue, timeValue) => {
    const rawTime = String(timeValue || "").trim();

    if (!rawTime) return null;

    if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(rawTime)) {
      const parsed = dayjs(rawTime);
      return parsed.isValid() ? parsed : null;
    }

    const rawDate = String(dateValue || "").trim();
    const parsedDate = dayjs(rawDate);

    if (!parsedDate.isValid()) return null;

    const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);

    if (!timeMatch) return null;

    let hours = Number(timeMatch[1]);
    const minutes = timeMatch[2];
    const seconds = timeMatch[3] || "00";
    const meridiem = timeMatch[4]?.toUpperCase();

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const normalizedTime = `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
    const parsedDateTime = dayjs(`${parsedDate.format("YYYY-MM-DD")} ${normalizedTime}`);

    return parsedDateTime.isValid() ? parsedDateTime : null;
  }, []);

  const formatDtrActualDateTime = useCallback(
    (record, type) => {
      const actualDate = getDtrActualDateValue(record, type);
      const actualValue = getDtrActualDateTimeValue(record, type);
      const recordDate = actualDate || getNormalizedRecordDate(record) || record?.date;
      let parsedDateTime = parseDtrDateTime(recordDate, actualValue);

      if (
        type === "timeOut" &&
        parsedDateTime &&
        !actualDate &&
        !/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(actualValue)
      ) {
        const parsedTimeIn = parseDtrDateTime(
          getDtrActualDateValue(record, "timeIn") ||
            getNormalizedRecordDate(record) ||
            record?.date,
          getDtrActualDateTimeValue(record, "timeIn")
        );

        if (parsedTimeIn && parsedDateTime.isBefore(parsedTimeIn)) {
          parsedDateTime = parsedDateTime.add(1, "day");
        }
      }

      return parsedDateTime ? parsedDateTime.format("MM/DD/YYYY hh:mm a") : "N/A";
    },
    [
      getDtrActualDateTimeValue,
      getDtrActualDateValue,
      getNormalizedRecordDate,
      parseDtrDateTime,
    ]
  );

  const getRecordShiftTimeIn = useCallback((record) => {
    return getFirstNonBlankValue(record, [
      "shift_time_in",
      "shiftTimeIn",
      "SHIFT_TIME_IN",
      "SHIFTTIMEIN",
      "shiftIn",
      "shift_in",
      "sched_in",
      "schedIn",
      "SCHED_IN",
      "schedule_in",
      "scheduleIn",
      "SCHEDULE_IN",
      "time_in_sched",
      "timeInSched",
      "TIME_IN_SCHED",
    ]);
  }, []);

  const getEmployeeShiftTimeIn = useCallback(() => {
    const directShiftIn = getFirstNonBlankValue(user, [
      "shift_time_in",
      "shiftTimeIn",
      "SHIFT_TIME_IN",
      "SHIFTTIMEIN",
      "shiftIn",
      "shift_in",
      "sched_in",
      "schedIn",
      "SCHED_IN",
    ]);

    if (directShiftIn) return directShiftIn;

    const shiftSchedule =
      employeeShiftSchedule ||
      getFirstNonBlankValue(user, [
        "shiftSchedule",
        "shift_schedule",
        "SHIFT_SCHEDULE",
        "schedule",
        "SCHEDULE",
      ]);

    return String(shiftSchedule || "").split(/\s*-\s*/)[0]?.trim() || "";
  }, [employeeShiftSchedule, user]);

  const getRecordShiftTimeInDateTime = useCallback(
    (record) => {
      const recordDate = getNormalizedRecordDate(record);
      const shiftTimeIn = getRecordShiftTimeIn(record);

      if (!recordDate || isValueBlank(shiftTimeIn)) return null;

      const rawShiftTime = String(shiftTimeIn).trim();
      const directDateTime = dayjs(rawShiftTime);

      if (directDateTime.isValid() && /\d{4}-\d{2}-\d{2}/.test(rawShiftTime)) {
        return directDateTime.tz(PH_TIMEZONE);
      }

      const timeMatch = rawShiftTime.match(
        /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i
      );

      if (!timeMatch) return null;

      let hours = Number(timeMatch[1]);
      const minute = timeMatch[2];
      const second = timeMatch[3] || "00";
      const meridiem = timeMatch[4]?.toUpperCase();

      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      const normalizedTime = `${String(hours).padStart(2, "0")}:${minute}:${second}`;
      const shiftDateTime = dayjs.tz(
        `${recordDate} ${normalizedTime}`,
        PH_TIMEZONE
      );

      return shiftDateTime.isValid() ? shiftDateTime : null;
    },
    [getNormalizedRecordDate, getRecordShiftTimeIn, isValueBlank]
  );

  const getShiftTimeInDateTime = useCallback(
    (recordDate, shiftTimeIn) => {
      if (!recordDate || isValueBlank(shiftTimeIn)) return null;

      const rawShiftTime = String(shiftTimeIn).trim();
      const directDateTime = dayjs(rawShiftTime);

      if (directDateTime.isValid() && /\d{4}-\d{2}-\d{2}/.test(rawShiftTime)) {
        return directDateTime.tz(PH_TIMEZONE);
      }

      const timeMatch = rawShiftTime.match(
        /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i
      );

      if (!timeMatch) return null;

      let hours = Number(timeMatch[1]);
      const minutes = timeMatch[2];
      const seconds = timeMatch[3] || "00";
      const meridiem = timeMatch[4]?.toUpperCase();

      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      const normalizedTime = `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
      const shiftDateTime = dayjs.tz(
        `${recordDate} ${normalizedTime}`,
        PH_TIMEZONE
      );

      return shiftDateTime.isValid() ? shiftDateTime : null;
    },
    [isValueBlank]
  );

  const getActiveTimekeepingRecord = useCallback(
    (nextRecords) => {
      const now = getTrustedPhilippineNow();

      if (!now) return null;

      const todayStr = now.format("YYYY-MM-DD");
      const today =
        nextRecords.find((record) => getNormalizedRecordDate(record) === todayStr) ||
        null;

      const openPreviousRecords = nextRecords
        .filter((record) => {
          const recordDate = getNormalizedRecordDate(record);

          return (
            recordDate &&
            recordDate < todayStr &&
            !isValueBlank(getDtrActualDateTimeValue(record, "timeIn")) &&
            isValueBlank(getDtrActualDateTimeValue(record, "timeOut"))
          );
        })
        .sort((a, b) => {
          const dateA = getNormalizedRecordDate(a) || "";
          const dateB = getNormalizedRecordDate(b) || "";

          return dateB.localeCompare(dateA);
        });

      const openPreviousRecord = openPreviousRecords[0] || null;

      if (!openPreviousRecord) return today;

      const openRecordDate = getNormalizedRecordDate(openPreviousRecord);
      const openShiftTimeIn =
        getRecordShiftTimeInDateTime(openPreviousRecord) ||
        getShiftTimeInDateTime(openRecordDate, getEmployeeShiftTimeIn());
      const nextShiftTimeIn = openShiftTimeIn
        ? openShiftTimeIn.add(1, "day")
        : null;

      if (nextShiftTimeIn && now.isBefore(nextShiftTimeIn)) {
        return openPreviousRecord;
      }

      const todayShiftTimeIn = getShiftTimeInDateTime(
        todayStr,
        getRecordShiftTimeIn(today) || getEmployeeShiftTimeIn()
      );

      if (todayShiftTimeIn && now.isBefore(todayShiftTimeIn)) {
        return openPreviousRecord;
      }

      return today;
    },
    [
      getNormalizedRecordDate,
      getDtrActualDateTimeValue,
      getEmployeeShiftTimeIn,
      getRecordShiftTimeIn,
      getRecordShiftTimeInDateTime,
      getShiftTimeInDateTime,
      getTrustedPhilippineNow,
      isValueBlank,
    ]
  );

  const applyPendingTimekeepingImages = useCallback(
    (nextRecords) => {
      if (pendingTimekeepingImagesRef.current.size === 0) {
        return nextRecords;
      }

      return nextRecords.map((record) => {
        const recordDate = getNormalizedRecordDate(record);

        if (!recordDate) return record;

        const timeInImage = pendingTimekeepingImagesRef.current.get(
          `${recordDate}:TIME IN`
        );
        const timeOutImage = pendingTimekeepingImagesRef.current.get(
          `${recordDate}:TIME OUT`
        );

        if (!timeInImage && !timeOutImage) return record;

        return {
          ...record,
          ...(timeInImage
            ? {
                time_in_image_path:
                  record.time_in_image_path ||
                  record.timeInImagePath ||
                  record.TIME_IN_IMAGE_PATH ||
                  record.time_in_image ||
                  timeInImage.previewUrl ||
                  timeInImage.path,
                time_in_image_id:
                  record.time_in_image_id ||
                  record.timeInImageId ||
                  record.TIME_IN_IMAGE_ID ||
                  timeInImage.id,
              }
            : {}),
          ...(timeOutImage
            ? {
                time_out_image_path:
                  record.time_out_image_path ||
                  record.timeOutImagePath ||
                  record.TIME_OUT_IMAGE_PATH ||
                  record.time_out_image ||
                  timeOutImage.previewUrl ||
                  timeOutImage.path,
                time_out_image_id:
                  record.time_out_image_id ||
                  record.timeOutImageId ||
                  record.TIME_OUT_IMAGE_ID ||
                  timeOutImage.id,
              }
            : {}),
        };
      });
    },
    [getNormalizedRecordDate]
  );

  const fetchDTRRecords = useCallback(async () => {
    if (!user?.empNo || !startDate || !endDate) return;

    try {
      const response = await axios.get(
        `${API_ENDPOINTS.getDTRRecords}/${user.empNo}/${startDate}/${endDate}`
      );

      const payload =
        response?.data?.records ||
        response?.data?.data ||
        response?.data?.result ||
        [];

      const nextRecords = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.records)
          ? payload.records
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      const recordsWithPendingImages = applyPendingTimekeepingImages(nextRecords);

      setRecords(recordsWithPendingImages);
      setTodayRecord(getActiveTimekeepingRecord(recordsWithPendingImages));
    } catch (error) {
      console.error("Error fetching DTR records:", error);
    }
  }, [
    user?.empNo,
    startDate,
    endDate,
    getActiveTimekeepingRecord,
    applyPendingTimekeepingImages,
  ]);

  useEffect(() => {
    fetchDTRRecords();
  }, [fetchDTRRecords]);

  useEffect(() => {
    if (!isClockSynced) return;
    setTodayRecord(getActiveTimekeepingRecord(records));
  }, [getActiveTimekeepingRecord, isClockSynced, records]);

  const showSuccessToast = (title = "Success", description = "") => {
  toast.success(title, {
    description,
    duration: 3000,
  });
};

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

  const trustedNow = getTrustedPhilippineNow();

  if (!trustedNow) {
    await syncPhilippineClock();
  }

  const syncedNow = getTrustedPhilippineNow();

  if (!syncedNow) {
    showErrorToast(
      "Time Sync Required",
      "Unable to verify Philippine Standard Time from the server. Please check your connection and try again."
    );
    isProcessingTimeEventRef.current = false;
    return;
  }

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

    const geotaggingEnabled = isGeotaggingEnabled(branchLocation);
    const geofenceEnabled = isGeofenceEnabled(branchLocation);

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
          const geoErrorResult = await reverseGeocode(
            userCoords.latitude,
            userCoords.longitude
          );
          address =
            geoErrorResult?.actualCapturedLocation ||
            geoErrorResult?.fullMapAddress ||
            "Unable to resolve address";
        } catch {
          address = "Unable to resolve address";
        }

        setLocationAddress(geotaggingEnabled ? address : "");

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

      if (geotaggingEnabled) {
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
      if (geotaggingEnabled && reverseGeocodePromise) {
        const gpsResult = await reverseGeocodePromise;

        actualCapturedLocation = gpsResult.actualCapturedLocation || "N/A";
        nearestMapLandmark = gpsResult.nearestLandmark || "N/A";
        address = actualCapturedLocation;

        setLocationAddress(actualCapturedLocation);
      } else {
        actualCapturedLocation = "N/A";
        nearestMapLandmark = "N/A";
        address = "N/A";

        setLocationAddress("");
      }

      verifiedAssignedBranch = branchLocation?.address || "N/A";
      gpsAccuracy = userCoords?.accuracy ?? null;
      distanceFromBranch = locationCheck?.distance ?? null;
    }

    const currentTime = syncedNow.format("HH:mm:ss");
    const currentDateStr = syncedNow.format("YYYY-MM-DD");
    const eventDateStr =
      type === "TIME OUT"
        ? getNormalizedRecordDate(todayRecord) || currentDateStr
        : currentDateStr;
    const displayTime = syncedNow.format("hh:mm:ss A");

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
          date: eventDateStr,

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
          locationAddress: geotaggingEnabled ? actualCapturedLocation : "N/A",

          actualCapturedLocation: geotaggingEnabled ? actualCapturedLocation : "N/A",
          nearestMapLandmark: geotaggingEnabled ? nearestMapLandmark : "N/A",
          verifiedAssignedBranch,
          distanceFromBranch,

          branchcode: branchLocation?.branchcode ?? null,
          branchname: branchLocation?.branchname ?? null,
          branchAddress: verifiedAssignedBranch,
          allowedRadius: branchLocation?.allowedRadius ?? null,
          geotagging: geotaggingEnabled ? 1 : 0,
          geofence: geofenceEnabled ? 1 : 0,
        },
      },
    ];

    console.log("Upsert Payload:", eventData);

    setLoading({ show: true, message: `Saving ${type}...` });

    const response = await axios.post(API_ENDPOINTS.upsertTimeIn, eventData);

    if (response.data.status === "success") {
      if (
        capturedImageInfo &&
        (type === "TIME IN" || type === "TIME OUT")
      ) {
        pendingTimekeepingImagesRef.current.set(`${eventDateStr}:${type}`, {
          id: capturedImageInfo.id,
          path: capturedImageInfo.path,
          previewUrl: capturedImageInfo.previewUrl,
        });
      }

      const applySavedEventToRecord = (record) => {
        const recordDate = getNormalizedRecordDate(record);

        if (recordDate !== eventDateStr) return record;

        const nextRecord = { ...record };

        if (type === "TIME IN") {
          nextRecord.time_in = currentTime;
          nextRecord.time_in_date = currentDateStr;
          nextRecord.time_in_datetime = `${currentDateStr} ${currentTime}`;
          nextRecord.time_in_address = geotaggingEnabled
            ? actualCapturedLocation
            : "N/A";

          if (capturedImageInfo) {
            nextRecord.time_in_image_path =
              capturedImageInfo.previewUrl || capturedImageInfo.path;
            nextRecord.time_in_image_id = capturedImageInfo.id;
          }
        }

        if (type === "TIME OUT") {
          nextRecord.time_out = currentTime;
          nextRecord.time_out_date = currentDateStr;
          nextRecord.time_out_datetime = `${currentDateStr} ${currentTime}`;
          nextRecord.time_out_address = geotaggingEnabled
            ? actualCapturedLocation
            : "N/A";

          if (capturedImageInfo) {
            nextRecord.time_out_image_path =
              capturedImageInfo.previewUrl || capturedImageInfo.path;
            nextRecord.time_out_image_id = capturedImageInfo.id;
          }
        }

        return nextRecord;
      };

      const createSavedEventRecord = () =>
        applySavedEventToRecord({
          empNo: user.empNo,
          empName: user.empName || user.empname || user.name || "",
          date: eventDateStr,
          branchcode: branchLocation?.branchcode ?? null,
          branchname: branchLocation?.branchname ?? null,
        });

      setRecords((previousRecords) => {
        const hasMatchingRecord = previousRecords.some(
          (record) => getNormalizedRecordDate(record) === eventDateStr
        );

        if (!hasMatchingRecord) {
          const nextRecords = [createSavedEventRecord(), ...previousRecords];
          setTodayRecord(getActiveTimekeepingRecord(nextRecords));
          return nextRecords;
        }

        const nextRecords = previousRecords.map(applySavedEventToRecord);
        setTodayRecord(getActiveTimekeepingRecord(nextRecords));
        return nextRecords;
      });

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

  const handleExport = () => {
    const employeeNumber = String(user?.empNo || user?.empno || "").padStart(10, "0") || "N/A";
    const employeeName = records[0]?.empName || records[0]?.empname || "N/A";

    const formattedStartDate = startDate ? dayjs(startDate).format("YYYYMMDD") : "";
    const formattedEndDate = endDate ? dayjs(endDate).format("YYYYMMDD") : "";
    const dateRange =
      formattedStartDate && formattedEndDate
        ? `${formattedStartDate}-${formattedEndDate}`
        : "";

    const headerColumns = ["Employee No.", "Employee Name", "Date", "Time In"];

    if (shouldShowLocationAddress) headerColumns.push("Time In Location");

    headerColumns.push("Break In", "Break Out", "Time Out");

    if (shouldShowLocationAddress) headerColumns.push("Time Out Location");

    headerColumns.push("Worked (hrs)");

    const csvRows = filteredRecords.map((record) => {
      const row = [
        `"${employeeNumber}"`,
        `"${record.empName || record.empname || employeeName}"`,
        `"${dayjs(record.date).format("MM/DD/YYYY")}"`,
        `"${record.time_in ? formatDtrActualDateTime(record, "timeIn") : "N/A"}"`,
      ];

      if (shouldShowLocationAddress) {
        row.push(`"${record.time_in_address || "N/A"}"`);
      }

      row.push(
        `"${record.break_in ? dayjs(record.break_in, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`,
        `"${record.break_out ? dayjs(record.break_out, "HH:mm:ss").format("hh:mm:ss A") : "N/A"}"`,
        `"${record.time_out ? formatDtrActualDateTime(record, "timeOut") : "N/A"}"`
      );

      if (shouldShowLocationAddress) {
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
                    <h3 className="text-sm lg:text-xl font-bold text-gray-900">
                      {dayjs(record.date).format("MMMM D, YYYY")}
                    </h3>
                    {isFinal && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                        FINAL
                      </span>
                    )}
                  </div>
                  <p className="text-base text-gray-500 font-medium">
                    {record.worked_hrs != null
                      ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                      : "0.00 hrs"}
                  </p>
                </div>

                <div className="text-right">
                  {/* <div className="text-[10px] lg:text-[11px] text-gray-400 uppercase tracking-widest mb-1 font-bold">
                    IN • OUT
                  </div> */}
                  <div className="font-mono text-sm lg:text-base font-semibold text-gray-800">
                    {record.time_in
                      ? formatDtrActualDateTime(record, "timeIn")
                      : "N/A"}{" "}
                    {/* •{" "}
                    {record.time_out
                      ? formatDtrActualDateTime(record, "timeOut")
                      : "N/A"} */}
                  </div>
                  <div className="font-mono text-sm lg:text-base font-semibold text-gray-800">
                    {/* {record.time_in
                      ? formatDtrActualDateTime(record, "timeIn")
                      : "N/A"}{" "}
                    •{" "} */}
                    {record.time_out
                      ? formatDtrActualDateTime(record, "timeOut")
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

                  {shouldShowLocationAddress && (
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
                    {shouldShowLocationAddress && record.time_out_address ? (
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
                            className="w-32 lg:w-40 py-2 text-xs bg-blue-800 hover:bg-blue-700 text-white rounded-xl transition-all font-bold shadow-sm"
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
                  {record.time_in
                    ? formatDtrActualDateTime(record, "timeIn")
                    : "N/A"}{" "}
                  -{" "}
                  {record.time_out
                    ? formatDtrActualDateTime(record, "timeOut")
                    : "N/A"}
                </div>
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
              </div>
            </div>
          </button>

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

                {shouldShowLocationAddress && (
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
              ? formatDtrActualDateTime(record, "timeIn")
              : "Missing";
            const timeOutDisplay = record.time_out
              ? formatDtrActualDateTime(record, "timeOut")
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
                <div className="text-xs text-gray-800 font-medium">
                  {dayjs(record.date).format("MM/DD/YYYY")}
                </div>

                <div className="flex justify-center">
                  <div className="flex flex-col text-xs space-y-2">
                    <div className="text-gray-500">
                      <span className="inline-block w-16">Time In:</span>
                      <span className={!record.time_in ? "text-red-500 font-medium" : "text-gray-800 whitespace-nowrap"}> {timeInDisplay}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      <span className="inline-block w-16">Time Out:</span>
                      <span className={!record.time_out ? "text-red-500 font-medium" : "text-gray-800 whitespace-nowrap"}> {timeOutDisplay}
                      </span>
                    </div>
                  <div className="text-gray-500">
                      <span className="inline-block w-16">Break Time:</span>
                      <span className="text-gray-800 text-[12px] whitespace-nowrap"> {breakInDisplay} - {breakOutDisplay}
                      </span>
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
                      className="px-2 py-4 text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium shadow-sm transition-colors"
                    >
                      Adjust Time
                    </button>
                  )}

                  {canOffset && (
                    <button
                      onClick={() => handleOffsetClick(record)}
                      className="px-3 py-1 text-[11px] bg-blue-800 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition-colors"
                    >
                      Offset
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const FullTableView = ({ filteredRecords }) => {
    const isBlank = (v) => v == null || String(v).trim() === "";
    const colSpan = 5 + (shouldShowLocationAddress ? 2 : 0);

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
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record, index) => {
              const isFinal = record.stat === "F";
              const showAdjIn = isBlank(record.time_in);
              const showAdjOut = isBlank(record.time_out);

              return (
                <div key={index} className="p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-900">
                        {dayjs(record.date).format("MM/DD/YYYY")}
                      </span>
                      {isFinal && (
                        <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-600 border border-green-200">
                          FINAL
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-blue-600">
                      {record.worked_hrs != null
                        ? `${Number(record.worked_hrs).toFixed(2)} hrs`
                        : "0.00 hrs"}
                    </span>
                  </div>

                  <Row
                    label="Time In:"
                    value={
                      !showAdjIn ? (
                        formatDtrActualDateTime(record, "timeIn")
                      ) : isFinal ? (
                        "N/A"
                      ) : (
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="px-10 py-1 text-[11px] bg-yellow-500 text-white rounded"
                        >
                          Adjust
                        </button>
                      )
                    }
                  />

                  {shouldShowLocationAddress && (
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
                        formatDtrActualDateTime(record, "timeOut")
                      ) : isFinal ? (
                        "N/A"
                      ) : (
                        <button
                          onClick={() => handleAdjustClick(record)}
                          className="px-10 py-1 text-[11px] bg-yellow-500 text-white rounded"
                        >
                          Adjust
                        </button>
                      )
                    }
                  />

                  {shouldShowLocationAddress && (
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
                {shouldShowLocationAddress && <th className="px-3 py-3">Location In</th>}
                <th className="px-3 py-3 whitespace-nowrap">Break</th>
                <th className="px-3 py-3 whitespace-nowrap">Time Out</th>
                {shouldShowLocationAddress && <th className="px-3 py-3">Location Out</th>}
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
                            formatDtrActualDateTime(record, "timeIn")
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
                      {shouldShowLocationAddress && (
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
                            formatDtrActualDateTime(record, "timeOut")
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
                      {shouldShowLocationAddress && (
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
                          formatDtrActualDateTime(record, "timeIn")
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
                          formatDtrActualDateTime(record, "timeOut")
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
                      ? formatDtrActualDateTime(record, "timeIn")
                      : "N/A"}
                  </div>
                  <div className="text-xs text-gray-700">
                    Time Out:{" "}
                    {record.time_out
                      ? formatDtrActualDateTime(record, "timeOut")
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
    <div className="ml-0 lg:ml-[200px] mt-[70px] p-2 sm:p-4 bg-gray-100 min-h-screen">

      <div className="bg-blue-800 mt-2 px-3 py-2 sm:p-3 rounded-xl text-white flex flex-row items-center justify-between gap-3 mb-3 w-full shadow-lg">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-light leading-none">Today</p>
          <h1 className="text-sm sm:text-lg md:text-2xl font-extrabold leading-tight truncate">
            {currentDate ? currentDate.format("MMMM DD, YYYY") : "Verifying..."}
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

      {clockSyncStatus !== "synced" && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {clockSyncStatus === "syncing"
            ? "Verifying server time..."
            : "Philippine Standard Time could not be verified from the server. Timekeeping buttons are disabled until sync is restored."}
        </div>
      )}

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
              className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("TIME IN")}
              disabled={
                !isClockSynced ||
                (isImageCaptureRequired
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.time_in
                  : !!todayRecord?.time_in)
              }
            >
              Time In
            </button>

            <button
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("BREAK IN")}
              disabled={
                !isClockSynced ||
                (isImageCaptureRequired
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.break_in ||
                    !todayRecord?.time_in
                  : !!todayRecord?.break_in || !todayRecord?.time_in)
              }
            >
              Break In
            </button>

            <button
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("BREAK OUT")}
              disabled={
                !isClockSynced ||
                (isImageCaptureRequired
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.break_out ||
                    !todayRecord?.break_in
                  : !!todayRecord?.break_out || !todayRecord?.break_in)
              }
            >
              Break Out
            </button>

            <button
              className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              onClick={() => handleTimeEvent("TIME OUT")}
              disabled={
                !isClockSynced ||
                (isImageCaptureRequired
                  ? capturing ||
                    !faceDetectionModelLoaded ||
                    !currentUserFaceDescriptor ||
                    !!todayRecord?.time_out ||
                    !todayRecord?.time_in
                  : !!todayRecord?.time_out || !todayRecord?.time_in)
              }
            >
              Time Out
            </button>
          </div>
        </div>

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

          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
              shouldShowLocationAddress
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-gray-50 text-gray-500 border border-gray-200"
            }`}>
              Geotagging: {shouldShowLocationAddress ? "ON" : "OFF"}
            </span>
            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
              shouldShowGeofenceDetails
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-gray-50 text-gray-500 border border-gray-200"
            }`}>
              Geofence: {shouldShowGeofenceDetails ? "ON" : "OFF"}
            </span>
          </div>

          {shouldShowGeofenceDetails && (
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

          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Time In:</span>{" "}
            {todayRecord?.time_in
              ? formatDtrActualDateTime(todayRecord, "timeIn")
              : "Not Recorded"}
          </p>

          {shouldShowLocationAddress && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.time_in_address || "Not Recorded"}
            </p>
          )}

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break In:</span>{" "}
            {todayRecord?.break_in
              ? dayjs(todayRecord.break_in, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

          {shouldShowLocationAddress && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.break_in_address || "Not Recorded"}
            </p>
          )}

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break Out:</span>{" "}
            {todayRecord?.break_out
              ? dayjs(todayRecord.break_out, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

          {shouldShowLocationAddress && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.break_out_address || "Not Recorded"}
            </p>
          )}

          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-bold">🕐 Time Out:</span>{" "}
            {todayRecord?.time_out
              ? formatDtrActualDateTime(todayRecord, "timeOut")
              : "Not Recorded"}
          </p>

          {shouldShowLocationAddress && (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.time_out_address || "Not Recorded"}
            </p>
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
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-w-0 sm:w-48 lg:w-64 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 appearance-none"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    End Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full min-w-0 sm:w-48 lg:w-64 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 appearance-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0">
                <button
                  onClick={handleExport}
                  className="flex-1 sm:flex-none h-10 px-3 bg-green-700 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  <Download size={18} />
                  Export
                </button>

                {/* <button
                  onClick={() => navigate("/offsetApplication", { state: { fromDTR: true } })}
                  className="flex-1 sm:flex-none h-10 px-4 bg-blue-800 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  Offset Application
                </button> */}

                <button
                  onClick={() => navigate("/timekeepingAdj")}
                  className="flex-1 sm:flex-none h-10 px-3 bg-blue-800 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  DTR Adjustment
                </button>

                <button
                  onClick={handleDtrConfirmation}
                  className="flex-1 sm:flex-none h-10 px-3 bg-blue-800 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  <CircleCheck size={20} className="text-white inline mr-2" />DTR Confirmation
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-0 border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("cards")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "cards"
                    ? "bg-blue-800 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                }`}
              >
                Cards
              </button>

              <button
                onClick={() => setViewMode("table")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-blue-800 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                }`}
              >
                Compact
              </button>

              <button
                onClick={() => setViewMode("tableSummary")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "tableSummary"
                    ? "bg-blue-800 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                }`}
              >
                Summary
              </button>

              <button
                onClick={() => setViewMode("summary")}
                className={`py-2 text-sm font-medium transition-all ${
                  viewMode === "summary"
                    ? "bg-blue-800 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Table
              </button>
            </div>
          </div>

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
            </div>
          </div>
        </div>
      </div>

      <SpinnerOverlay show={loading.show} message={loading.message} />
    </div>
  );
};

export default Timekeeping;
