import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useLocation } from "react-router-dom";
import { loadFaceIO } from "@/utils/faceioLoader";

const FACEIO_PUBLIC_ID = import.meta.env.VITE_FACEIO_PUBLIC_ID || "";
// console.log("FACEIO PUBLIC ID:", import.meta.env.VITE_FACEIO_PUBLIC_ID);

export default function TimekeepingFaceEnrollment() {
  const { state } = useLocation();
  const user = state?.user || null;
  const employeeData = state?.employeeData || user || null;

  const faceioRef = useRef(null);
  const didInitRef = useRef(false);

  const [isChecking, setIsChecking] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const [enrolledFacialId, setEnrolledFacialId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [faceioReady, setFaceioReady] = useState(false);

  const empNo = useMemo(() => {
    return (
      employeeData?.EMPNO ||
      employeeData?.empno ||
      employeeData?.emp_no ||
      employeeData?.EMP_NO ||
      employeeData?.empNo ||
      user?.EMPNO ||
      user?.empno ||
      user?.EMP_NO ||
      user?.empNo ||
      ""
    );
  }, [employeeData, user]);

  const empName = useMemo(() => {
    return (
      employeeData?.EMPNAME ||
      employeeData?.empname ||
      employeeData?.emp_name ||
      employeeData?.EMP_NAME ||
      employeeData?.empName ||
      user?.EMPNAME ||
      user?.empname ||
      user?.EMP_NAME ||
      user?.empName ||
      ""
    );
  }, [employeeData, user]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token") || "";
    return {
      Accept: "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  }, []);

  const getFaceIOErrorDetails = useCallback((error) => {
  const rawCode =
    typeof error === "number"
      ? error
      : error?.code ?? error?.errorCode ?? error?.status ?? null;

  const fioMap =
    typeof window !== "undefined" && typeof window.fioErrCode === "object"
      ? window.fioErrCode
      : typeof globalThis !== "undefined" && typeof globalThis.fioErrCode === "object"
      ? globalThis.fioErrCode
      : null;

  let errorName = null;

  if (fioMap && rawCode !== null && rawCode !== undefined) {
    const matched = Object.entries(fioMap).find(([, value]) => value === rawCode);
    if (matched) {
      errorName = matched[0];
    }
  }

  const manualCodeMap = {
    7: {
      errorName: "FACE_DUPLICATION",
      message: "This face is already enrolled in FACEIO. Please delete the previous enrollment first.",
    },
  };

  if (!errorName && rawCode in manualCodeMap) {
    return {
      rawCode,
      errorName: manualCodeMap[rawCode].errorName,
      message: manualCodeMap[rawCode].message,
    };
  }

  const friendlyMessages = {
    FACE_DUPLICATION: "This face is already enrolled in FACEIO. Please delete the previous enrollment first.",
    MINORS_NOT_ALLOWED:
      "Enrollment is blocked by FACEIO because minors are not allowed for this application.",
    PERMISSION_REFUSED: "Camera permission was denied.",
    TERMS_NOT_ACCEPTED: "FACEIO terms were not accepted.",
    SESSION_IN_PROGRESS: "Another FACEIO session is already in progress.",
    TIMEOUT: "The enrollment timed out. Please try again.",
    NO_FACES_DETECTED: "No face was detected. Please face the camera clearly.",
    MANY_FACES: "Multiple faces were detected. Make sure only one face is visible.",
    FACE_MISMATCH: "FACEIO detected inconsistent facial vectors. Please retry.",
    PAD_ATTACK: "Possible spoofing attempt detected. Use a live face only.",
    NETWORK_IO: "A network error occurred while contacting FACEIO.",
    PROCESSING_ERR: "FACEIO encountered a server-side processing error.",
    UNAUTHORIZED: "Your FACEIO application is not authorized for this request.",
    UI_NOT_READY: "FACEIO widget is not ready yet.",
    TOO_MANY_REQUESTS: "Too many FACEIO requests were made. Please try again later.",
    EMPTY_ORIGIN: "The Origin or Referer header is missing.",
    FORBIDDEN_ORIGIN: "This domain is not allowed in your FACEIO console settings.",
    FORBIDDEN_COUNTRY: "This country is not allowed in your FACEIO console settings.",
    ABORTED_BY_USER: "The FACEIO enrollment was cancelled.",
    UNIQUE_PIN_REQUIRED: "A unique PIN is required by FACEIO.",
  };

  return {
    rawCode,
    errorName,
    message:
      (errorName && friendlyMessages[errorName]) ||
      (typeof error === "string" ? error : null) ||
      error?.message ||
      (rawCode !== null && rawCode !== undefined
        ? `FACEIO enrollment failed with code ${rawCode}.`
        : "FACEIO enrollment failed."),
  };
}, []);

  const initializeFaceIO = useCallback(async () => {
    if (!FACEIO_PUBLIC_ID) {
      setFaceioReady(false);
      setStatusMessage("FACEIO public ID is missing in your frontend .env.");
      return null;
    }

    try {
      setStatusMessage("Loading FACEIO...");

      const FaceIOClass = await loadFaceIO();

      if (typeof FaceIOClass !== "function") {
        throw new Error("FACEIO constructor is not available.");
      }

      if (!faceioRef.current) {
        faceioRef.current = new FaceIOClass(FACEIO_PUBLIC_ID);
      }

      setFaceioReady(true);
      setStatusMessage("FACEIO is ready.");
      return faceioRef.current;
    } catch (error) {
      console.error("FACEIO INIT ERROR:", error);
      faceioRef.current = null;
      setFaceioReady(false);
      setStatusMessage(error?.message || "FACEIO failed to initialize.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    initializeFaceIO();
  }, [initializeFaceIO]);

  const ensureFaceIO = useCallback(async () => {
    if (faceioRef.current) return faceioRef.current;

    const instance = await initializeFaceIO();
    if (!instance) {
      throw new Error("FACEIO is not ready.");
    }

    return instance;
  }, [initializeFaceIO]);

  const fetchEnrollmentStatus = useCallback(async () => {
    if (!empNo) {
      setAlreadyEnrolled(false);
      setEnrolledFacialId("");
      setStatusMessage("No employee number found.");
      return;
    }

    setIsChecking(true);

    try {
      const response = await axios.get(
        `${API_ENDPOINTS.faceioCheck}/${encodeURIComponent(empNo)}`,
        {
          headers: getAuthHeaders(),
          withCredentials: true,
        }
      );

      const data = response?.data ?? {};

      setAlreadyEnrolled(!!data?.hasFace);
      setEnrolledFacialId(data?.facialId || "");

      if (faceioReady) {
        setStatusMessage(data?.hasFace ? "FACEIO enrollment found." : "No FACEIO enrollment yet.");
      } else {
        setStatusMessage((prev) => prev || "FACEIO not ready.");
      }
    } catch (error) {
      console.warn("Unable to check FACEIO enrollment status:", error);
      setAlreadyEnrolled(false);
      setEnrolledFacialId("");
      setStatusMessage(
        error?.response?.data?.message || "Unable to check FACEIO enrollment status."
      );
    } finally {
      setIsChecking(false);
    }
  }, [empNo, faceioReady, getAuthHeaders]);

  useEffect(() => {
    fetchEnrollmentStatus();
  }, [fetchEnrollmentStatus]);

  const handleEnroll = useCallback(async () => {
    if (!empNo) {
      Swal.fire({
        icon: "warning",
        title: "Missing Employee Number",
        text: "Unable to enroll because employee number is blank.",
      });
      return;
    }

    try {
      setIsEnrolling(true);

      const faceio = await ensureFaceIO();

      const result = await faceio.enroll({
        locale: "auto",
        payload: {
          empNo,
          empName,
        },
      });

      const facialId = result?.facialId || result?.facial_id || result?.facialID || "";

      if (!facialId) {
        throw new Error("FACEIO did not return a facial ID.");
      }

      const saveResponse = await axios.post(
        API_ENDPOINTS.faceioEnroll,
        { empNo, facialId },
        {
          headers: getAuthHeaders(),
          withCredentials: true,
        }
      );

      if (!saveResponse?.data?.success) {
        throw new Error(saveResponse?.data?.message || "Unable to save FACEIO enrollment.");
      }

      setAlreadyEnrolled(true);
      setEnrolledFacialId(facialId);
      setStatusMessage("FACEIO enrolled successfully.");

      Swal.fire({
        icon: "success",
        title: "Enrollment Successful",
        text: "FACEIO enrollment has been saved.",
      });
    } catch (error) {
  const parsed = getFaceIOErrorDetails(error);
  console.error("FACEIO ENROLL ERROR:", error);
  console.error("FACEIO ENROLL PARSED:", parsed);
  console.error(
    "FACEIO fioErrCode map:",
    typeof window !== "undefined" ? window.fioErrCode : undefined
  );

  if (typeof parsed.rawCode === "number" && parsed.rawCode === 7) {
  Swal.fire({
    icon: "warning",
    title: "FACEIO Warning",
    text: parsed.message,
  });
  return;
}

  Swal.fire({
  icon: "error",
  title: "Enrollment Failed",
  text:
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    parsed.message ||
    "Unable to complete FACEIO enrollment.",
});
}finally {
      setIsEnrolling(false);
      fetchEnrollmentStatus();
    }
  }, [empNo, empName, ensureFaceIO, fetchEnrollmentStatus, getAuthHeaders, getFaceIOErrorDetails]);



const handleDeleteEnrollment = useCallback(async () => {
  if (!empNo) {
    Swal.fire({
      icon: "warning",
      title: "Missing Employee Number",
      text: "Unable to delete because employee number is blank.",
    });
    return;
  }

  let facialIdToDelete = (enrolledFacialId || "").trim();

  if (!facialIdToDelete) {
    const inputResult = await Swal.fire({
      icon: "question",
      title: "Enter Facial ID",
      text: "No local FACEIO facial ID was found. Enter the previous FACEIO facial ID to force delete from cloud.",
      input: "text",
      inputPlaceholder: "Enter facial ID",
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "Facial ID is required.";
        }
      },
    });

    if (!inputResult.isConfirmed) return;
    facialIdToDelete = inputResult.value.trim();
  }

  const confirm = await Swal.fire({
    icon: "warning",
    title: "Delete FACEIO Enrollment?",
    html: `
      <div style="text-align:left">
        <div><strong>Employee No:</strong> ${empNo}</div>
        <div><strong>Facial ID:</strong> ${facialIdToDelete}</div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Yes, Delete",
    cancelButtonText: "Cancel",
  });

  if (!confirm.isConfirmed) return;

  try {
    setIsDeleting(true);

    const response = await axios.post(
      API_ENDPOINTS.faceioDelete,
      {
        empNo,
        facialId: facialIdToDelete,
      },
      {
        headers: getAuthHeaders(),
        withCredentials: true,
      }
    );

    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Unable to delete FACEIO enrollment.");
    }

    setAlreadyEnrolled(false);
    setEnrolledFacialId("");
    setStatusMessage("FACEIO enrollment deleted successfully.");

    Swal.fire({
      icon: "success",
      title: "Deleted",
      text: "FACEIO enrollment has been removed.",
    });
  } catch (error) {
    console.error("FACEIO DELETE ERROR:", error);

    Swal.fire({
      icon: "error",
      title: "Delete Failed",
      text:
        error?.response?.data?.message ||
        error?.message ||
        "Unable to delete FACEIO enrollment.",
    });
  } finally {
    setIsDeleting(false);
    fetchEnrollmentStatus();
  }
}, [empNo, enrolledFacialId, fetchEnrollmentStatus, getAuthHeaders]);

  return (
    <div className="ml-0 lg:ml-[200px] mt-[70px] p-4 sm:p-6 bg-gray-100 min-h-screen">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-800">FACEIO Enrollment</h2>
        <p className="text-sm text-slate-500">
          Manage biometric facial enrollment for employee timekeeping.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Employee No
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{empNo || "-"}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Employee Name
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{empName || "-"}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Enrollment Status
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                alreadyEnrolled
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {isChecking
                ? "Checking..."
                : alreadyEnrolled
                ? "Already Enrolled"
                : "Not Enrolled"}
            </span>

            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                faceioReady
                  ? "bg-blue-100 text-blue-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {faceioReady ? "FACEIO Ready" : "FACEIO Not Ready"}
            </span>

            {enrolledFacialId ? (
              <span className="text-xs text-slate-500">
                Facial ID: <span className="font-medium text-slate-700">{enrolledFacialId}</span>
              </span>
            ) : null}
          </div>

          {statusMessage ? (
            <div className="mt-2 text-sm text-slate-600">{statusMessage}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={fetchEnrollmentStatus}
          disabled={isChecking || isEnrolling || isDeleting}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? "Checking..." : "Refresh Status"}
        </button>

        <button
          type="button"
          onClick={initializeFaceIO}
          disabled={isChecking || isEnrolling || isDeleting}
          className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reinitialize FACEIO
        </button>

        <button
          type="button"
          onClick={handleEnroll}
          disabled={
            !empNo || !faceioReady || isChecking || isEnrolling || isDeleting || alreadyEnrolled
          }
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEnrolling
            ? "Enrolling..."
            : alreadyEnrolled
            ? "Already Enrolled"
            : "Enroll FACEIO"}
        </button>

        <button
  type="button"
  onClick={handleDeleteEnrollment}
  disabled={!empNo || isChecking || isEnrolling || isDeleting}
  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {isDeleting ? "Deleting..." : "Delete Enrollment"}
</button>
      </div>
    </div>
  );
}