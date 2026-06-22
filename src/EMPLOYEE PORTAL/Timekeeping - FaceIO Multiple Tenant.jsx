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

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const upsertTimeIn = (data) =>
  fetchApi(API_ENDPOINTS.upsertTimeIn, "POST", data);
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
  );
};

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

  const isBlank = (v) => v == null || String(v).trim() === "";

  const CardView = ({ filteredRecords }) => (
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
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {dayjs(record.date).format("MMM DD, YYYY")}
                  </h3>
                  {isFinal ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                      FINAL
                    </span>
                  ) : null}
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

                {canAdjust ? (
                  <button
                    onClick={() => navigate("/timekeepingAdj", { state: { record } })}
                    className="mt-2 inline-block px-3 py-1 text-[10px] sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm transition-all"
                  >
                    Adjust Time
                  </button>
                ) : null}
              </div>
            </div>

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
      </div>
    );
  };

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

          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Time In:</span>{" "}
            {todayRecord?.time_in
              ? dayjs(todayRecord.time_in, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

          {shouldShowLocationData ? (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.time_in_address || "Not Recorded"}
            </p>
          ) : null}

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break In:</span>{" "}
            {todayRecord?.break_in
              ? dayjs(todayRecord.break_in, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

          {shouldShowLocationData ? (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.break_in_address || "Not Recorded"}
            </p>
          ) : null}

          <p className="text-red-800 text-[14px] md:text-lg mb-2">
            <span className="font-extrabold">🕐 Break Out:</span>{" "}
            {todayRecord?.break_out
              ? dayjs(todayRecord.break_out, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

          {shouldShowLocationData ? (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.break_out_address || "Not Recorded"}
            </p>
          ) : null}

          <p className="text-blue-800 text-[14px] md:text-lg mb-2">
            <span className="font-bold">🕐 Time Out:</span>{" "}
            {todayRecord?.time_out
              ? dayjs(todayRecord.time_out, "HH:mm:ss").format("hh:mm:ss A")
              : "Not Recorded"}
          </p>

          {shouldShowLocationData ? (
            <p className="text-gray-800 text-[14px] md:text-sm mb-4">
              <span className="font-bold">📍Location:</span>{" "}
              {todayRecord?.time_out_address || "Not Recorded"}
            </p>
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
              </button>
            </div>
          </div>

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
            </div>
          </div>
        </div>
      </div>

      <SpinnerOverlay show={loading.show} message={loading.message} />
    </div>
  );
};

export default Timekeeping;
