import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  FileSpreadsheet,
  FilterX,
  Image as ImageIcon,
  Layers3,
  LayoutGrid,
  List,
  Monitor,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  Table2,
  Tablet,
  User,
  Users,
  X,
} from "lucide-react";
import API_ENDPOINTS, { IMAGE_BASE_URL } from "../apiConfig";
import { useAuth } from "./AuthContext";

const getToday = () => new Date();

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const firstDayOfMonth = () => {
  const today = getToday();
  return formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
};

const lastDayOfMonth = () => {
  const today = getToday();
  return formatDateInput(
    new Date(today.getFullYear(), today.getMonth() + 1, 0),
  );
};

const normalizeText = (value) => String(value ?? "").trim();
const normalizeFlag = (value) => normalizeText(value).toUpperCase();
const safeLower = (value) => normalizeText(value).toLowerCase();
const normalizeEndpoint = (endpoint) => String(endpoint || "").trim();

const resolveApiEndpoint = (configuredEndpoint, fallbackPath) => {
  const configured = normalizeEndpoint(configuredEndpoint);
  if (configured) return configured;

  const cleanFallbackPath = fallbackPath.startsWith("/")
    ? fallbackPath
    : `/${fallbackPath}`;

  const knownEndpoint = normalizeEndpoint(
    API_ENDPOINTS?.upsertTimeIn ||
      API_ENDPOINTS?.saveImage ||
      API_ENDPOINTS?.getNewImageId ||
      API_ENDPOINTS?.getDTRRecords,
  );

  if (knownEndpoint) {
    if (/\/api\//i.test(knownEndpoint)) {
      return knownEndpoint.replace(
        /\/api\/[^/?#]+.*$/i,
        `/api${cleanFallbackPath}`,
      );
    }

    return knownEndpoint.replace(/\/[^/?#]+.*$/i, cleanFallbackPath);
  }

  return `/api${cleanFallbackPath}`;
};

const getApiAssetOrigin = () => {
  const endpoint = normalizeEndpoint(
    API_ENDPOINTS?.getAllDTRHR ||
      API_ENDPOINTS?.getAllDTR ||
      API_ENDPOINTS?.getDTRRecords ||
      API_ENDPOINTS?.saveImage,
  );

  if (!endpoint || typeof window === "undefined") return "";

  try {
    return new URL(endpoint, window.location.origin).origin;
  } catch {
    return "";
  }
};

const unwrapUser = (value) => {
  if (!value) return null;
  if (value?.user) return unwrapUser(value.user);
  if (value?.data?.user) return unwrapUser(value.data.user);
  if (value?.authUser) return unwrapUser(value.authUser);
  if (value?.employee) return unwrapUser(value.employee);
  return value;
};

const getStorageObject = (storage, key) => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return unwrapUser(JSON.parse(raw));
  } catch {
    return null;
  }
};

const findFirstValue = (obj, possibleKeys, depth = 0) => {
  if (!obj || typeof obj !== "object" || depth > 5) return "";

  const lowerKeys = possibleKeys.map((key) => key.toLowerCase());

  for (const key of Object.keys(obj)) {
    if (lowerKeys.includes(key.toLowerCase())) {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findFirstValue(value, possibleKeys, depth + 1);
      if (found !== undefined && found !== null && String(found).trim() !== "") {
        return found;
      }
    }
  }

  return "";
};

const getUserEmpNo = (user) =>
  findFirstValue(user, [
    "empno",
    "EMPNO",
    "empNo",
    "EMP_NO",
    "employeeNo",
    "EMPLOYEE_NO",
    "employee_no",
    "EmployeeNo",
    "userCode",
    "USER_CODE",
    "userid",
    "USERID",
    "user_id",
  ]);

const getUserName = (user) =>
  findFirstValue(user, [
    "empName",
    "EMPNAME",
    "emp_name",
    "employeeName",
    "EMPLOYEE_NAME",
    "userName",
    "USERNAME",
    "name",
    "NAME",
  ]);

const getUserHrFlag = (user) =>
  normalizeFlag(
    findFirstValue(user, [
      "hr_flag",
      "HR_FLAG",
      "hrFlag",
      "HrFlag",
      "hrflag",
    ]),
  );

const getKnownStoredUser = () => {
  const keys = [
    "authUser",
    "user",
    "currentUser",
    "loginUser",
    "auth",
    "employee",
    "userData",
    "naysaUser",
    "employeeData",
    "portalUser",
    "empData",
    "loginData",
    "profile",
  ];

  for (const key of keys) {
    const fromLocal = getStorageObject(localStorage, key);
    if (fromLocal) return fromLocal;

    const fromSession = getStorageObject(sessionStorage, key);
    if (fromSession) return fromSession;
  }

  return null;
};

const scanStorageForUser = () => {
  const scan = (storage) => {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        const value = getStorageObject(storage, key);
        if (!value) continue;

        if (getUserEmpNo(value) || getUserHrFlag(value)) return value;
      }
    } catch {
      return null;
    }

    return null;
  };

  return scan(localStorage) || scan(sessionStorage);
};

const getLoggedUser = () => getKnownStoredUser() || scanStorageForUser() || {};

const getValue = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return fallback;
};

const parseHours = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const text = normalizeText(value).replace(/,/g, "");
  if (!text) return 0;

  if (/^\d+:\d{1,2}$/.test(text)) {
    const [hours, minutes] = text.split(":").map(Number);
    return (Number.isFinite(hours) ? hours : 0) +
      (Number.isFinite(minutes) ? minutes : 0) / 60;
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

const formatHours = (value) => parseHours(value).toFixed(2);

const parseDateValue = (value) => {
  if (!value) return null;
  const raw = String(value).split("T")[0];
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateDisplay = (value) => {
  const date = parseDateValue(value);
  if (!date) return normalizeText(value) || "-";

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const formatDayName = (value) => {
  const date = parseDateValue(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

const formatTimeOnly = (value) => {
  if (!value) return "-";

  const text = String(value).trim();
  const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);

  if (timeMatch) {
    const rawHours = Number(timeMatch[1]);
    const minutes = timeMatch[2] || "00";
    const seconds = timeMatch[3] || "00";
    const meridiem = timeMatch[4]?.toUpperCase();
    const hours24 =
      meridiem === "PM" && rawHours < 12
        ? rawHours + 12
        : meridiem === "AM" && rawHours === 12
          ? 0
          : rawHours;
    const displayHours = hours24 % 12 || 12;
    const displayMeridiem = hours24 >= 12 ? "PM" : "AM";

    return `${String(displayHours).padStart(2, "0")}:${minutes}:${seconds} ${displayMeridiem}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text || "-";

  return date.toLocaleTimeString("en-US", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const preserveAcronym = (word) => {
  const acronym = word.toUpperCase();
  if (["DTR", "HR", "OT", "AWOL", "AM", "PM"].includes(acronym)) {
    return acronym;
  }
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
};

const properCase = (value) => {
  const text = normalizeText(value);
  if (!text) return "-";
  return text
    .split(/(\s+|[-/])/)
    .map((part) => (/^\s+$|^[-/]$/.test(part) ? part : preserveAcronym(part)))
    .join("");
};

const getRecordText = (record, keys = []) => {
  for (const key of keys) {
    const value = record?.[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const getUniqueImageCandidates = (values = []) =>
  [...new Set(values.filter((value) => normalizeText(value)))];

const buildTimekeepingImageCandidates = (
  imagePath,
  imageId,
  record = {},
  assetOrigin = "",
) => {
  const configuredBase = normalizeText(IMAGE_BASE_URL);
  const cleanBase = (
    configuredBase ||
    (assetOrigin ? `${assetOrigin}/images/timekeeping_images` : "/images/timekeeping_images")
  ).replace(/\/+$/, "");

  const appBase = cleanBase
    .replace(/\/images\/timekeeping_images$/i, "")
    .replace(/\/storage\/timekeeping_images$/i, "")
    .replace(/\/timekeeping_images$/i, "")
    .replace(/\/images$/i, "");

  const candidates = [];

  const addCandidate = (value) => {
    const cleanValue = normalizeText(value);
    if (!cleanValue) return;
    candidates.push(cleanValue.replace(/([^:]\/)\/+/g, "$1"));
  };

  const normalizePath = (value) => {
    if (value == null) return "";

    let path = String(value).trim();
    if (!path) return "";

    if (/^(https?:|data:|blob:)/i.test(path)) return path;

    path = path.replace(/\\/g, "/").replace(/^\/+/, "");

    const publicIndex = path.toLowerCase().indexOf("public/");
    if (publicIndex >= 0) {
      path = path.substring(publicIndex + "public/".length);
    }

    const storageIndex = path
      .toLowerCase()
      .indexOf("storage/timekeeping_images/");
    if (storageIndex >= 0) {
      return `${appBase}/${path.substring(storageIndex)}`;
    }

    const imagesIndex = path
      .toLowerCase()
      .indexOf("images/timekeeping_images/");
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

  if (normalizeText(imagePath)) {
    let rawPath = String(imagePath)
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

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
    } else if (!/^(https?:|data:|blob:)/i.test(rawPath)) {
      addCandidate(`${appBase}/storage/timekeeping_images/${rawPath}`);
      addCandidate(`${appBase}/images/timekeeping_images/${rawPath}`);
    }
  }

  const cleanImageId = normalizeText(imageId).replace(/\.(jpeg|jpg|png)$/i, "");

  if (cleanImageId) {
    const branchCode = getRecordText(record, [
      "branchcode",
      "branchCode",
      "BRANCHCODE",
      "BRANCH_CODE",
      "branch_code",
    ]);
    const recordEmpNo = getRecordText(record, [
      "empno",
      "empNo",
      "EMPNO",
      "EMP_NO",
      "employeeNo",
      "EMPLOYEE_NO",
    ]);
    const empValues = getUniqueImageCandidates([
      recordEmpNo,
      recordEmpNo ? String(recordEmpNo).padStart(10, "0") : "",
    ]);

    if (branchCode && empValues.length > 0) {
      empValues.forEach((empValue) => {
        ["jpeg", "jpg", "png"].forEach((extension) => {
          addCandidate(
            `${appBase}/storage/timekeeping_images/${branchCode}/${empValue}/${cleanImageId}.${extension}`,
          );
          addCandidate(
            `${cleanBase}/${branchCode}/${empValue}/${cleanImageId}.${extension}`,
          );
          addCandidate(
            `${appBase}/images/timekeeping_images/${branchCode}/${empValue}/${cleanImageId}.${extension}`,
          );
        });
      });
    }

    ["jpeg", "jpg", "png"].forEach((extension) => {
      addCandidate(
        `${appBase}/storage/timekeeping_images/${cleanImageId}.${extension}`,
      );
      addCandidate(`${cleanBase}/${cleanImageId}.${extension}`);
      addCandidate(
        `${appBase}/images/timekeeping_images/${cleanImageId}.${extension}`,
      );
    });
  }

  return getUniqueImageCandidates(candidates);
};
const normalizeDtrRow = (row, index, assetOrigin) => {
  const source = normalizeText(getValue(row, ["source", "SOURCE", "type", "TYPE"]));
  const empNo = normalizeText(getValue(row, ["empno", "EMPNO", "empNo", "EMP_NO"]));
  const empName = normalizeText(
    getValue(row, ["empName", "EMPNAME", "emp_name", "EMP_NAME"]),
  );
  const department = normalizeText(
    getValue(row, ["Department", "department", "DEPARTMENT", "deptName", "DEPT_NAME"]),
  );
  const date = normalizeText(getValue(row, ["date", "DATE", "dtrDate", "DTR_DATE"]));
  const timeIn = getValue(row, ["time_in", "TIME_IN", "timeIn", "TIMEIN"]);
  const timeOut = getValue(row, ["time_out", "TIME_OUT", "timeOut", "TIMEOUT"]);
  const workedHours = parseHours(
    getValue(row, ["worked_hrs", "WORKED_HRS", "workedHrs", "WORKED_HOURS"], 0),
  );
  const remarks = normalizeText(
    getValue(row, ["REMARKS", "remarks", "Remarks", "status", "STATUS"]),
  );

  const day = normalizeText(
    getValue(row, ["day", "Day"]),
  );

  const timeInImagePath = getValue(row, [
    "time_in_image_path",
    "TIME_IN_IMAGE_PATH",
    "timeInImagePath",
    "time_in_image",
    "TIME_IN_IMAGE",
    "timeInImage",
    "time_in_photo",
    "TIME_IN_PHOTO",
    "timeInPhoto",
    "time_in_picture",
    "TIME_IN_PICTURE",
    "image_in",
    "IMAGE_IN",
    "in_image",
    "IN_IMAGE",
    "time_in_file",
    "TIME_IN_FILE",
    "image_timein",
    "IMAGE_TIMEIN",
    "img_in",
    "IMG_IN",
    "in_filename",
    "IN_FILENAME",
  ]);

  const timeInImageId = getValue(row, [
    "time_in_image_id",
    "TIME_IN_IMAGE_ID",
    "timeInImageId",
    "timeInImageID",
    "time_in_imageid",
    "TIME_IN_IMAGEID",
  ]);

  const timeOutImagePath = getValue(row, [
    "time_out_image_path",
    "TIME_OUT_IMAGE_PATH",
    "timeOutImagePath",
    "time_out_image",
    "TIME_OUT_IMAGE",
    "timeOutImage",
    "time_out_photo",
    "TIME_OUT_PHOTO",
    "timeOutPhoto",
    "time_out_picture",
    "TIME_OUT_PICTURE",
    "image_out",
    "IMAGE_OUT",
    "out_image",
    "OUT_IMAGE",
    "time_out_file",
    "TIME_OUT_FILE",
    "image_timeout",
    "IMAGE_TIMEOUT",
    "img_out",
    "IMG_OUT",
    "out_filename",
    "OUT_FILENAME",
  ]);

  const timeOutImageId = getValue(row, [
    "time_out_image_id",
    "TIME_OUT_IMAGE_ID",
    "timeOutImageId",
    "timeOutImageID",
    "time_out_imageid",
    "TIME_OUT_IMAGEID",
  ]);

  const timeInImageCandidates = buildTimekeepingImageCandidates(
    timeInImagePath,
    timeInImageId,
    row,
    assetOrigin,
  );
  const timeOutImageCandidates = buildTimekeepingImageCandidates(
    timeOutImagePath,
    timeOutImageId,
    row,
    assetOrigin,
  );

  return {
    __id: `${empNo || "employee"}-${date || "date"}-${source || "source"}-${index}`,
    source,
    empNo,
    empName,
    department,
    date,
    day,
    timeIn,
    timeOut,
    workedHours,
    remarks,
    timeInImageId: normalizeText(timeInImageId),
    timeOutImageId: normalizeText(timeOutImageId),
    timeInImage: timeInImageCandidates[0] || "",
    timeInImageFallbacks: timeInImageCandidates.slice(1),
    timeOutImage: timeOutImageCandidates[0] || "",
    timeOutImageFallbacks: timeOutImageCandidates.slice(1),
    raw: row,
  };
};

const getSourceBadgeClass = (source) => {
  const value = safeLower(source);
  if (value.includes("no dtr")) return "bg-red-50 text-red-700 ring-red-200";
  if (value.includes("official")) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (value.includes("leave")) return "bg-violet-50 text-violet-700 ring-violet-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
};

const getRemarksBadgeClass = (remarks) => {
  const value = safeLower(remarks);
  if (!value) return "bg-slate-50 text-slate-500 ring-slate-200";
  if (value.includes("confirmed") || value.includes("approved")) {
    return "bg-green-50 text-green-700 ring-green-200";
  }
  if (value.includes("pending")) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (value.includes("adjustment")) return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
};

const DateInput = ({ value, onChange }) => (
  <div className="relative">
    <input
      type="date"
      value={value}
      onChange={onChange}
      className="dtr-date-input h-10 w-full rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
    />
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
        <path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      </svg>
    </span>
  </div>
);

const PhotoThumb = ({
  src,
  fallbackSrcs = [],
  label,
  onOpen,
  size = "md",
}) => {
  const candidates = useMemo(
    () => getUniqueImageCandidates([src, ...(fallbackSrcs || [])]),
    [src, fallbackSrcs],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => setCandidateIndex(0), [src, fallbackSrcs]);

  const sizeClass = size === "lg" ? "h-20 w-20" : "h-12 w-12";
  const currentSrc = candidates[candidateIndex] || "";
  const failed = candidates.length === 0 || candidateIndex >= candidates.length;

  if (!currentSrc || failed) {
    return (
      <div
        className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400`}
        title={`${label}: No picture`}
      >
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.(currentSrc, label)}
      className={`${sizeClass} group relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400`}
      title={`View ${label}`}
    >
      <img
        src={currentSrc}
        alt={label}
        loading="lazy"
        onError={() => setCandidateIndex((index) => index + 1)}
        className="h-full w-full object-cover transition group-hover:scale-105"
      />
      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[8px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
        View
      </span>
    </button>
  );
};

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      {Icon && <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />}
    </div>
    <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
  </div>
);

const columns = [
  { key: "source", label: "Type", minWidth: 120 },
  { key: "empNo", label: "Employee No", minWidth: 120 },
  { key: "empName", label: "Employee Name", minWidth: 220 },
  { key: "department", label: "Department", minWidth: 170 },
  { key: "date", label: "Date", minWidth: 120 },
  { key: "day", label: "Day", minWidth: 110 },
  { key: "timeIn", label: "Time In", minWidth: 135 },
  { key: "timeInImage", label: "Time In Photo", minWidth: 105, filterable: false, sortable: false },
  { key: "timeOut", label: "Time Out", minWidth: 135 },
  { key: "timeOutImage", label: "Time Out Photo", minWidth: 110, filterable: false, sortable: false },
  { key: "workedHours", label: "Worked Hours", minWidth: 125, numeric: true },
  { key: "remarks", label: "Remarks", minWidth: 190 },
];

const getDisplayValue = (row, key) => {
  switch (key) {
    case "source":
      return properCase(row.source);
    case "date":
      return formatDateDisplay(row.date);
    case "day":
      return row.day || "-";
    case "timeIn":
      return formatTimeOnly(row.timeIn);
    case "timeOut":
      return formatTimeOnly(row.timeOut);
    case "workedHours":
      return formatHours(row.workedHours);
    case "remarks":
      return properCase(row.remarks);
    default:
      return normalizeText(row[key]) || "-";
  }
};

const compareRows = (left, right, key, direction) => {
  const multiplier = direction === "desc" ? -1 : 1;

  if (key === "workedHours") {
    return (left.workedHours - right.workedHours) * multiplier;
  }

  if (key === "date") {
    const leftTime = parseDateValue(left.date)?.getTime() || 0;
    const rightTime = parseDateValue(right.date)?.getTime() || 0;
    return (leftTime - rightTime) * multiplier;
  }

  return getDisplayValue(left, key).localeCompare(getDisplayValue(right, key), undefined, {
    numeric: true,
    sensitivity: "base",
  }) * multiplier;
};

const groupOptions = [
  { value: "none", label: "No Grouping" },
  { value: "empName", label: "Employee" },
  { value: "department", label: "Department" },
  { value: "date", label: "Date" },
  { value: "day", label: "Day" },
  { value: "source", label: "Type" },
];

const getGroupValue = (row, groupBy) => {
  switch (groupBy) {
    case "empName":
      return `${row.empName || "Unknown Employee"} (${row.empNo || "No Employee No"})`;
    case "department":
      return row.department || "No Department";
    case "date":
      return formatDateDisplay(row.date);
    case "day":
      return row.day || "No Day";
    case "source":
      return properCase(row.source || "No Type");
    default:
      return "All Records";
  }
};

export default function DTRMonitoring() {
  const { user: authUser } = useAuth();

  const resolvedUser = useMemo(
    () => unwrapUser(authUser) || getLoggedUser() || {},
    [authUser],
  );
  const currentEmpNo = normalizeText(getUserEmpNo(resolvedUser));
  const currentUserName = normalizeText(getUserName(resolvedUser));
  const currentHrFlag = normalizeFlag(getUserHrFlag(resolvedUser));
  const isHrUser = currentHrFlag === "Y";

  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(lastDayOfMonth());
  const [records, setRecords] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [employeeScope, setEmployeeScope] = useState("MY");
  const [selectedEmployeeNo, setSelectedEmployeeNo] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [groupBy, setGroupBy] = useState("none");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [layoutMode, setLayoutMode] = useState("auto");
  const [deviceMode, setDeviceMode] = useState("auto");
  const [windowWidth, setWindowWidth] = useState(
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);

  const isFetchingRef = useRef(false);
  const recordsSignatureRef = useRef("");
  const assetOrigin = useMemo(() => getApiAssetOrigin(), []);

  useEffect(() => {
    if (!isHrUser) {
      setEmployeeScope("MY");
      setSelectedEmployeeNo("");
    }
  }, [isHrUser]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const detectedDevice =
    windowWidth < 640 ? "mobile" : windowWidth < 1024 ? "tablet" : "desktop";
  const effectiveDevice = deviceMode === "auto" ? detectedDevice : deviceMode;
  const effectiveLayout =
    layoutMode === "auto"
      ? effectiveDevice === "desktop"
        ? "table"
        : effectiveDevice === "tablet"
          ? "accordion"
          : "card"
      : layoutMode;

  const previewWidthClass =
    deviceMode === "mobile"
      ? "mx-auto max-w-[430px]"
      : deviceMode === "tablet"
        ? "mx-auto max-w-[900px]"
        : "mx-auto max-w-[1100px]";

  const normalizedRows = useMemo(
    () => records.map((row, index) => normalizeDtrRow(row, index, assetOrigin)),
    [records, assetOrigin],
  );

  const employeeOptions = useMemo(() => {
    const employees = new Map();

    normalizedRows.forEach((row) => {
      if (!row.empNo) return;
      if (!employees.has(row.empNo)) {
        employees.set(row.empNo, {
          empNo: row.empNo,
          empName: row.empName || row.empNo,
          department: row.department,
        });
      }
    });

    return Array.from(employees.values()).sort((left, right) =>
      left.empName.localeCompare(right.empName, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [normalizedRows]);

  const sourceOptions = useMemo(() => {
    const values = new Set();
    normalizedRows.forEach((row) => {
      if (row.source) values.add(row.source);
    });
    return ["ALL", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [normalizedRows]);

  const scopeFilteredRows = useMemo(() => {
    if (employeeScope === "MY") {
      if (!currentEmpNo) return [];
      return normalizedRows.filter(
        (row) => safeLower(row.empNo) === safeLower(currentEmpNo),
      );
    }

    if (selectedEmployeeNo) {
      return normalizedRows.filter(
        (row) => safeLower(row.empNo) === safeLower(selectedEmployeeNo),
      );
    }

    return normalizedRows;
  }, [normalizedRows, employeeScope, currentEmpNo, selectedEmployeeNo]);

  const filteredRows = useMemo(() => {
    const keyword = safeLower(searchText);
    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([, value]) => normalizeText(value) !== "",
    );

    return scopeFilteredRows.filter((row) => {
      if (
        sourceFilter !== "ALL" &&
        safeLower(row.source) !== safeLower(sourceFilter)
      ) {
        return false;
      }

      if (keyword) {
        const searchable = [
          row.source,
          row.empNo,
          row.empName,
          row.department,
          row.date,
          row.day,
          row.timeIn,
          row.timeOut,
          row.workedHours,
          row.remarks,
        ]
          .map((value) => normalizeText(value))
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(keyword)) return false;
      }

      return activeColumnFilters.every(([key, value]) =>
        safeLower(getDisplayValue(row, key)).includes(safeLower(value)),
      );
    });
  }, [scopeFilteredRows, sourceFilter, searchText, columnFilters]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredRows;
    return [...filteredRows].sort((left, right) =>
      compareRows(left, right, sortConfig.key, sortConfig.direction),
    );
  }, [filteredRows, sortConfig]);

  const groupedRows = useMemo(() => {
    if (groupBy === "none") return [];

    const groups = new Map();

    sortedRows.forEach((row) => {
      const label = getGroupValue(row, groupBy);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row);
    });

    return Array.from(groups.entries())
      .map(([label, rows]) => ({
        id: `${groupBy}:${label}`,
        label,
        rows,
        workedHours: rows.reduce((total, row) => total + row.workedHours, 0),
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [sortedRows, groupBy]);

  const totalWorkedHours = useMemo(
    () => filteredRows.reduce((total, row) => total + row.workedHours, 0),
    [filteredRows],
  );

  const withDtrCount = useMemo(
    () =>
      filteredRows.filter((row) => {
        const source = safeLower(row.source);
        return source && !source.includes("no dtr");
      }).length,
    [filteredRows],
  );

  const noDtrCount = useMemo(
    () => filteredRows.filter((row) => safeLower(row.source).includes("no dtr")).length,
    [filteredRows],
  );

  const pageCollection = groupBy === "none" ? sortedRows : groupedRows;
  const totalPages = Math.max(1, Math.ceil(pageCollection.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const firstIndex = (safePage - 1) * rowsPerPage;
  const pageItems = pageCollection.slice(firstIndex, firstIndex + rowsPerPage);

  useEffect(() => setCurrentPage(1), [
    employeeScope,
    selectedEmployeeNo,
    sourceFilter,
    searchText,
    columnFilters,
    groupBy,
    rowsPerPage,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const fetchAllDTR = useCallback(
    async ({ silent = false } = {}) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        if (silent) setIsRefreshing(true);
        else {
          setLoading(true);
          setError("");
        }

        if (!startDate || !endDate) {
          throw new Error("Please select Start Date and End Date.");
        }

        if (new Date(startDate) > new Date(endDate)) {
          throw new Error("Start Date must not be greater than End Date.");
        }

        const fallbackPath = isHrUser ? "/getAllDTRHR" : "/getAllDTR";
        const selectedEndpoint = resolveApiEndpoint(
          isHrUser ? API_ENDPOINTS?.getAllDTRHR : API_ENDPOINTS?.getAllDTR,
          fallbackPath,
        );

        if (!selectedEndpoint) {
          throw new Error(
            "DTR Monitoring API endpoint is missing. Please check apiConfig.jsx.",
          );
        }

        if (!currentEmpNo) {
          throw new Error(
            "Employee No. is missing from the logged-in user. Cannot load DTR records.",
          );
        }

        const params = {
          startDate,
          endDate,
          START_DATE: startDate,
          END_DATE: endDate,
          // For getAllDTRHR, this is the logged-in HR/approver employee number.
          // The selected employee dropdown is applied to the returned rows locally.
          empNo: currentEmpNo,
          EMP_NO: currentEmpNo,
        };

        const response = await axios.get(selectedEndpoint, {
          params,
          headers: { Accept: "application/json" },
        });

        const payload = response.data;
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          throw new Error(
            `Invalid API response from ${selectedEndpoint}. Check the Laravel route /api${fallbackPath}.`,
          );
        }

        if (!payload.success) {
          throw new Error(
            payload.message ||
              payload.error_details ||
              `Failed to fetch DTR records from ${selectedEndpoint}.`,
          );
        }

        const rows = payload.records || payload.data || [];
        const nextRows = Array.isArray(rows) ? rows : [];
        const nextSignature = JSON.stringify(nextRows);

        if (nextSignature !== recordsSignatureRef.current) {
          recordsSignatureRef.current = nextSignature;
          setRecords(nextRows);
        }
      } catch (err) {
        console.error("Error fetching DTR records:", {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        });

        if (!silent) {
          recordsSignatureRef.current = "";
          setRecords([]);
          setError(
            err.response?.data?.message ||
              err.response?.data?.error_details ||
              err.message ||
              "Failed to fetch DTR records. Please try again later.",
          );
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [startDate, endDate, isHrUser, currentEmpNo],
  );

  useEffect(() => {
    fetchAllDTR();
    // Initial load only. Date changes are applied when Load is clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      fetchAllDTR({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [fetchAllDTR]);

  const handleReset = () => {
    setStartDate(firstDayOfMonth());
    setEndDate(lastDayOfMonth());
    setSearchText("");
    setSourceFilter("ALL");
    setEmployeeScope("MY");
    setSelectedEmployeeNo("");
    setColumnFilters({});
    setShowColumnFilters(true);
    setGroupBy("none");
    setExpandedGroups({});
    setExpandedRows({});
    setSortConfig({ key: "date", direction: "asc" });
    setRowsPerPage(20);
    setCurrentPage(1);
    setLayoutMode("auto");
    setDeviceMode("auto");
    setError("");
  };

  const handleSort = (key, sortable = true) => {
    if (!sortable) return;

    setSortConfig((previous) => {
      if (previous.key !== key) return { key, direction: "asc" };
      if (previous.direction === "asc") return { key, direction: "desc" };
      if (previous.direction === "desc") return { key: null, direction: null };
      return { key, direction: "asc" };
    });
  };

  const clearAllFilters = () => {
    setSearchText("");
    setSourceFilter("ALL");
    setSelectedEmployeeNo("");
    setColumnFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(searchText.trim()) ||
    sourceFilter !== "ALL" ||
    Boolean(selectedEmployeeNo) ||
    Object.values(columnFilters).some((value) => normalizeText(value) !== "");

  const setAllGroupsExpanded = (expanded) => {
    setExpandedGroups(
      Object.fromEntries(groupedRows.map((group) => [group.id, expanded])),
    );
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupId]: previous[groupId] === false,
    }));
  };

  const toggleRecord = (rowId) => {
    setExpandedRows((previous) => ({
      ...previous,
      [rowId]: !previous[rowId],
    }));
  };

  const openPhoto = (src, label) => setPhotoPreview({ src, label });

  const exportExcel = () => {
    if (!sortedRows.length) return;

    const exportRows = [];

    const appendRecord = (row) => {
      exportRows.push({
        Type: properCase(row.source),
        "Employee No": row.empNo,
        "Employee Name": row.empName,
        Department: row.department,
        Date: formatDateDisplay(row.date),
        Day: row.day,
        "Time In": formatTimeOnly(row.timeIn),
        "Time Out": formatTimeOnly(row.timeOut),
        "Worked Hours": Number(row.workedHours.toFixed(2)),
        Remarks: properCase(row.remarks),
      });
    };

    if (groupBy === "none") {
      sortedRows.forEach(appendRecord);
    } else {
      groupedRows.forEach((group) => {
        group.rows.forEach(appendRecord);
        exportRows.push({
          Type: `${group.label} Subtotal`,
          "Employee No": "",
          "Employee Name": "",
          Department: "",
          Date: "",
          Day: "",
          "Time In": "",
          "Time Out": "",
          "Worked Hours": Number(group.workedHours.toFixed(2)),
          Remarks: "",
        });
      });
    }

    exportRows.push({
      Type: "Grand Total",
      "Employee No": "",
      "Employee Name": "",
      Department: "",
      Date: "",
      Day: "",
      "Time In": "",
      "Time Out": "",
      "Worked Hours": Number(totalWorkedHours.toFixed(2)),
      Remarks: "",
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const headers = Object.keys(exportRows[0]);
    const workedHoursColumnIndex = headers.indexOf("Worked Hours");

    if (workedHoursColumnIndex >= 0) {
      for (let rowIndex = 2; rowIndex <= exportRows.length + 1; rowIndex += 1) {
        const address = XLSX.utils.encode_cell({
          r: rowIndex - 1,
          c: workedHoursColumnIndex,
        });
        const cell = worksheet[address];
        if (cell && cell.v !== "" && cell.v !== null && cell.v !== undefined) {
          const numericValue = Number(cell.v);
          if (Number.isFinite(numericValue)) {
            cell.t = "n";
            cell.v = numericValue;
            cell.z = "0.00";
          }
        }
      }
    }

    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 14 },
      { wch: 30 },
      { wch: 24 },
      { wch: 13 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 15 },
      { wch: 28 },
    ];
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DTR Monitoring");
    XLSX.writeFile(
      workbook,
      `DTR_Monitoring_${startDate}_to_${endDate}.xlsx`,
    );
  };

  const renderSortIcon = (column) => {
    if (column.sortable === false) return null;
    if (sortConfig.key !== column.key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-sky-700" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-sky-700" />
    );
  };

  const renderTableCell = (row, column) => {
    switch (column.key) {
      case "source":
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getSourceBadgeClass(
              row.source,
            )}`}
          >
            {properCase(row.source)}
          </span>
        );
      case "timeInImage":
        return (
          <PhotoThumb
            src={row.timeInImage}
            fallbackSrcs={row.timeInImageFallbacks}
            label={`${row.empName || row.empNo} Time In`}
            onOpen={openPhoto}
          />
        );
      case "timeOutImage":
        return (
          <PhotoThumb
            src={row.timeOutImage}
            fallbackSrcs={row.timeOutImageFallbacks}
            label={`${row.empName || row.empNo} Time Out`}
            onOpen={openPhoto}
          />
        );
      case "workedHours":
        return <span className="font-bold text-slate-800">{formatHours(row.workedHours)}</span>;
      case "remarks":
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getRemarksBadgeClass(
              row.remarks,
            )}`}
          >
            {properCase(row.remarks)}
          </span>
        );
      default:
        return getDisplayValue(row, column.key);
    }
  };

  const renderTableRecordRow = (row) => (
    <tr key={row.__id} className="transition hover:bg-sky-50/40">
      {columns.map((column) => (
        <td
          key={column.key}
          className={`border-b border-slate-100 px-3 py-2.5 align-middle text-xs text-slate-600 ${
            column.numeric ? "text-right" : "text-left"
          }`}
          style={{ minWidth: column.minWidth }}
        >
          {renderTableCell(row, column)}
        </td>
      ))}
    </tr>
  );

  const renderTableView = () => (
    <div className="max-h-[68vh] w-full overflow-auto">
      <table className="w-full min-w-[1580px] border-collapse text-left">
        <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`border-b border-slate-200 px-3 py-3 text-xs font-semibold text-slate-700 ${
                  column.numeric ? "text-right" : "text-left"
                }`}
                style={{ minWidth: column.minWidth }}
              >
                <button
                  type="button"
                  disabled={column.sortable === false}
                  onClick={() => handleSort(column.key, column.sortable !== false)}
                  className={`inline-flex w-full items-center gap-1.5 ${
                    column.numeric ? "justify-end" : "justify-start"
                  } disabled:cursor-default`}
                >
                  <span>{column.label}</span>
                  {renderSortIcon(column)}
                </button>
              </th>
            ))}
          </tr>

          {showColumnFilters && (
            <tr className="bg-white">
              {columns.map((column) => (
                <th
                  key={`filter-${column.key}`}
                  className="border-b border-slate-200 px-2 py-2"
                  style={{ minWidth: column.minWidth }}
                >
                  {column.filterable === false ? (
                    <div className="h-8 rounded-lg bg-slate-100" />
                  ) : (
                    <input
                      type="text"
                      value={columnFilters[column.key] || ""}
                      onChange={(event) =>
                        setColumnFilters((previous) => ({
                          ...previous,
                          [column.key]: event.target.value,
                        }))
                      }
                      placeholder={`Filter ${column.label}`}
                      className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  )}
                </th>
              ))}
            </tr>
          )}
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                Loading DTR records...
              </td>
            </tr>
          ) : pageItems.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                No DTR records found.
              </td>
            </tr>
          ) : groupBy === "none" ? (
            pageItems.map(renderTableRecordRow)
          ) : (
            pageItems.map((group) => {
              const expanded = expandedGroups[group.id] !== false;
              return (
                <Fragment key={group.id}>
                  <tr className="bg-sky-50">
                    <td colSpan={columns.length} className="border-b border-sky-100 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-sky-700" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-sky-700" />
                        )}
                        <span className="font-semibold text-sky-900">{group.label}</span>
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          {group.rows.length} records
                        </span>
                        <span className="ml-auto text-sm font-bold text-sky-900">
                          {formatHours(group.workedHours)} hrs
                        </span>
                      </button>
                    </td>
                  </tr>
                  {expanded && group.rows.map(renderTableRecordRow)}
                  <tr className="bg-slate-50">
                    <td colSpan={10} className="border-b border-slate-200 px-3 py-2 text-right text-xs font-semibold text-slate-600">
                      Subtotal Worked Hours
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-right text-sm font-bold text-slate-800">
                      {formatHours(group.workedHours)}
                    </td>
                    <td className="border-b border-slate-200" />
                  </tr>
                </Fragment>
              );
            })
          )}
        </tbody>

        {sortedRows.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 bg-gray-100">
            <tr>
              <td colSpan={10} className="px-1 py-1 text-right text-xs font-semibold">
                Total Worked Hours
              </td>
              <td className="px-2 py-2 text-right text-xs font-bold">
                {formatHours(totalWorkedHours)}
              </td>
              <td className="px-1 py-1" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  const renderRecordDetails = (row) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-500">Employee</div>
        <div className="mt-1 font-semibold text-slate-800">{row.empName || "-"}</div>
        <div className="text-xs text-slate-500">{row.empNo || "-"}</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-500">Department</div>
        <div className="mt-1 font-medium text-slate-800">{row.department || "-"}</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-500">Time In</div>
        <div className="mt-2 flex items-center gap-3">
          <PhotoThumb
            src={row.timeInImage}
            fallbackSrcs={row.timeInImageFallbacks}
            label={`${row.empName || row.empNo} Time In`}
            onOpen={openPhoto}
            size="lg"
          />
          <div className="font-semibold text-slate-800">{formatTimeOnly(row.timeIn)}</div>
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-500">Time Out</div>
        <div className="mt-2 flex items-center gap-3">
          <PhotoThumb
            src={row.timeOutImage}
            fallbackSrcs={row.timeOutImageFallbacks}
            label={`${row.empName || row.empNo} Time Out`}
            onOpen={openPhoto}
            size="lg"
          />
          <div className="font-semibold text-slate-800">{formatTimeOnly(row.timeOut)}</div>
        </div>
      </div>
    </div>
  );

  const renderRecordCard = (row) => (
    <article key={row.__id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <div className="truncate font-bold text-slate-800">{row.empName || "Unknown Employee"}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {row.empNo || "-"} · {row.department || "No Department"}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getSourceBadgeClass(row.source)}`}>
          {properCase(row.source)}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">Date</div>
            <div className="mt-0.5 font-semibold text-slate-800">{formatDateDisplay(row.date)}</div>
            <div className="text-xs text-slate-500">{row.day}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500">Worked Hours</div>
            <div className="mt-0.5 text-2xl font-bold text-sky-800">{formatHours(row.workedHours)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-500">Time In</div>
            <div className="mt-2 flex flex-col items-center gap-2 text-center">
              <PhotoThumb
                src={row.timeInImage}
            fallbackSrcs={row.timeInImageFallbacks}
                label={`${row.empName || row.empNo} Time In`}
                onOpen={openPhoto}
                size="lg"
              />
              <span className="text-xs font-semibold text-slate-700">{formatTimeOnly(row.timeIn)}</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-500">Time Out</div>
            <div className="mt-2 flex flex-col items-center gap-2 text-center">
              <PhotoThumb
                src={row.timeOutImage}
            fallbackSrcs={row.timeOutImageFallbacks}
                label={`${row.empName || row.empNo} Time Out`}
                onOpen={openPhoto}
                size="lg"
              />
              <span className="text-xs font-semibold text-slate-700">{formatTimeOnly(row.timeOut)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">Remarks</div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getRemarksBadgeClass(row.remarks)}`}>
            {properCase(row.remarks)}
          </span>
        </div>
      </div>
    </article>
  );

  const renderCardView = () => {
    if (loading) return <div className="p-12 text-center text-sm text-slate-500">Loading DTR records...</div>;
    if (pageItems.length === 0) return <div className="p-12 text-center text-sm text-slate-500">No DTR records found.</div>;

    if (groupBy === "none") {
      return <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{pageItems.map(renderRecordCard)}</div>;
    }

    return (
      <div className="space-y-4 p-4">
        {pageItems.map((group) => {
          const expanded = expandedGroups[group.id] !== false;
          return (
            <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 bg-sky-50 px-4 py-3 text-left"
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-sky-700" /> : <ChevronRight className="h-4 w-4 text-sky-700" />}
                <span className="font-semibold text-sky-900">{group.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-sky-700">{group.rows.length}</span>
                <span className="ml-auto text-sm font-bold text-sky-900">{formatHours(group.workedHours)} hrs</span>
              </button>
              {expanded && (
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.rows.map(renderRecordCard)}
                </div>
              )}
              <div className="border-t border-slate-200 px-4 py-2 text-right text-sm font-semibold text-slate-700">
                Subtotal Worked Hours: <span className="font-bold">{formatHours(group.workedHours)}</span>
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderAccordionRow = (row) => {
    const expanded = Boolean(expandedRows[row.__id]);
    return (
      <article key={row.__id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => toggleRecord(row.__id)}
          className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"
        >
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-sky-700" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-slate-800">{row.empName || row.empNo || "Unknown Employee"}</div>
            <div className="mt-0.5 text-xs text-slate-500">{formatDateDisplay(row.date)} · {row.day} · {properCase(row.source)}</div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-xs text-slate-500">{formatTimeOnly(row.timeIn)} – {formatTimeOnly(row.timeOut)}</div>
            <div className="font-bold text-sky-800">{formatHours(row.workedHours)} hrs</div>
          </div>
        </button>
        {expanded && (
          <div className="space-y-3 border-t border-slate-100 p-4">
            {renderRecordDetails(row)}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getRemarksBadgeClass(row.remarks)}`}>{properCase(row.remarks)}</span>
              <span className="font-bold text-slate-800">Worked Hours: {formatHours(row.workedHours)}</span>
            </div>
          </div>
        )}
      </article>
    );
  };

  const renderAccordionView = () => {
    if (loading) return <div className="p-12 text-center text-sm text-slate-500">Loading DTR records...</div>;
    if (pageItems.length === 0) return <div className="p-12 text-center text-sm text-slate-500">No DTR records found.</div>;

    if (groupBy === "none") {
      return <div className="space-y-2 p-4">{pageItems.map(renderAccordionRow)}</div>;
    }

    return (
      <div className="space-y-3 p-4">
        {pageItems.map((group) => {
          const expanded = expandedGroups[group.id] !== false;
          return (
            <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 bg-sky-50 px-4 py-3 text-left"
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-sky-700" /> : <ChevronRight className="h-4 w-4 text-sky-700" />}
                <span className="font-semibold text-sky-900">{group.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-sky-700">{group.rows.length}</span>
                <span className="ml-auto text-sm font-bold text-sky-900">{formatHours(group.workedHours)} hrs</span>
              </button>
              {expanded && <div className="space-y-2 p-3">{group.rows.map(renderAccordionRow)}</div>}
              <div className="border-t border-slate-200 px-4 py-2 text-right text-sm font-semibold text-slate-700">
                Subtotal Worked Hours: <span className="font-bold">{formatHours(group.workedHours)}</span>
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderDataView = () => {
    if (effectiveLayout === "card") return renderCardView();
    if (effectiveLayout === "accordion") return renderAccordionView();
    return renderTableView();
  };

  const paginationLabel = groupBy === "none" ? "records" : "groups";
  const displayedStart = pageCollection.length === 0 ? 0 : firstIndex + 1;
  const displayedEnd = Math.min(firstIndex + rowsPerPage, pageCollection.length);

  return (
    <div className="ml-0 mt-[80px] min-h-screen overflow-x-hidden bg-gray-100 p-2 sm:p-4 lg:ml-[200px]">
      <div className={`min-w-0 space-y-4 transition-all ${previewWidthClass}`}>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">DTR Monitoring</h1>
              <p className="mt-1 text-sm text-slate-500">
                Review attendance, worked hours, and timekeeping photos in one responsive view.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => fetchAllDTR()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading || isRefreshing ? "animate-spin" : ""}`} />
                {loading ? "Loading..." : isRefreshing ? "Refreshing..." : "Load"}
              </button>

              <button
                type="button"
                onClick={exportExcel}
                disabled={!sortedRows.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export to Excel
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Start Date</label>
              <DateInput value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">End Date</label>
              <DateInput value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">DTR View</label>
              <select
                value={employeeScope}
                onChange={(event) => {
                  setEmployeeScope(event.target.value);
                  setSelectedEmployeeNo("");
                }}
                disabled={!isHrUser}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
              >
                <option value="MY">My DTR</option>
                {isHrUser && <option value="EMPLOYEE">Employee DTR</option>}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Employee Name</label>
              <select
                value={selectedEmployeeNo}
                onChange={(event) => setSelectedEmployeeNo(event.target.value)}
                disabled={!isHrUser || employeeScope !== "EMPLOYEE"}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
              >
                <option value="">All Employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.empNo} value={employee.empNo}>
                    {employee.empName} ({employee.empNo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source === "ALL" ? "All Types" : properCase(source)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search employee, department, date, type, time, or remarks..."
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Group By</label>
                <select
                  value={groupBy}
                  onChange={(event) => {
                    setGroupBy(event.target.value);
                    setExpandedGroups({});
                  }}
                  className="h-10 w-full min-w-[150px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {groupOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Layout</label>
                <select
                  value={layoutMode}
                  onChange={(event) => setLayoutMode(event.target.value)}
                  className="h-10 w-full min-w-[140px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="auto">Auto Responsive</option>
                  <option value="table">Table</option>
                  <option value="accordion">Accordion</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowColumnFilters((previous) => !previous)}
                className={`mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                  showColumnFilters
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                title="Show or hide per-column filters"
              >
                <Table2 className="h-4 w-4" />
                Column Filters
              </button>

              <button
                type="button"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
                className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FilterX className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Responsive Preview:</span>
              {[
                { value: "auto", label: "Auto", icon: Layers3 },
                { value: "desktop", label: "Desktop", icon: Monitor },
                { value: "tablet", label: "Tablet", icon: Tablet },
                { value: "mobile", label: "Mobile", icon: Smartphone },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeviceMode(value)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
                    deviceMode === value
                      ? "border-sky-300 bg-white text-sky-700 shadow-sm"
                      : "border-transparent text-slate-600 hover:bg-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold ring-1 ring-slate-200">
                Device: {properCase(effectiveDevice)}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold ring-1 ring-slate-200">
                Layout: {properCase(effectiveLayout)}
              </span>
              {employeeScope === "MY" && (
                <span className="rounded-full bg-white px-2.5 py-1 font-semibold ring-1 ring-slate-200">
                  {currentUserName || currentEmpNo || "Current User"}
                </span>
              )}
            </div>
          </div>

          {showColumnFilters && effectiveLayout !== "table" && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-700">Column Filters</div>
                  <div className="text-xs text-slate-500">Available in Card and Accordion layouts.</div>
                </div>
                {Object.values(columnFilters).some((value) => normalizeText(value) !== "") && (
                  <button
                    type="button"
                    onClick={() => setColumnFilters({})}
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    Clear Column Filters
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {columns
                  .filter((column) => column.filterable !== false)
                  .map((column) => (
                    <div key={`responsive-filter-${column.key}`}>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                        {column.label}
                      </label>
                      <input
                        type="text"
                        value={columnFilters[column.key] || ""}
                        onChange={(event) =>
                          setColumnFilters((previous) => ({
                            ...previous,
                            [column.key]: event.target.value,
                          }))
                        }
                        placeholder={`Filter ${column.label}`}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard label="Loaded Records" value={records.length} icon={Layers3} />
            <MetricCard label="Displayed Records" value={filteredRows.length} icon={Users} />
            <MetricCard label="With DTR" value={withDtrCount} icon={User} />
            <MetricCard label="No DTR" value={noDtrCount} icon={FilterX} />
            <MetricCard label="Total Worked Hours" value={formatHours(totalWorkedHours)} icon={Table2} />
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">DTR Records</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Photos are displayed on-screen but are excluded from Excel export.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {groupBy !== "none" && (
                <>
                  <button
                    type="button"
                    onClick={() => setAllGroupsExpanded(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronsDown className="h-3.5 w-3.5" />
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllGroupsExpanded(false)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronsUp className="h-3.5 w-3.5" />
                    Collapse All
                  </button>
                </>
              )}

              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" title="Current layout">
                <Table2 className={`h-4 w-4 ${effectiveLayout === "table" ? "text-sky-700" : "text-slate-400"}`} />
                <List className={`h-4 w-4 ${effectiveLayout === "accordion" ? "text-sky-700" : "text-slate-400"}`} />
                <LayoutGrid className={`h-4 w-4 ${effectiveLayout === "card" ? "text-sky-700" : "text-slate-400"}`} />
              </div>
            </div>
          </div>

          {renderDataView()}

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs text-slate-600">
              Showing <b>{displayedStart}-{displayedEnd}</b> of {pageCollection.length} {paginationLabel}
              {groupBy !== "none" && (
                <span className="ml-1">({filteredRows.length} total records)</span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                {groupBy === "none" ? "Rows" : "Groups"} per page
                <select
                  value={rowsPerPage}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-500"
                >
                  {[10, 20, 50, 100, 200].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>

              <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage <= 1}
                  className="h-8 px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Previous
                </button>
                <span className="border-x border-slate-300 px-3 py-2 text-slate-600">
                  Page <b>{safePage}</b> of <b>{totalPages}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                  className="h-8 px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {photoPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={photoPreview.label}
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              className="absolute right-5 top-5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Close picture preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={photoPreview.src}
              alt={photoPreview.label}
              className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
            />
            <div className="px-2 pb-1 pt-3 text-center text-sm font-semibold text-slate-700">
              {photoPreview.label}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dtr-date-input::-webkit-calendar-picker-indicator {
          display: none;
          opacity: 0;
        }

        .dtr-date-input::-webkit-inner-spin-button,
        .dtr-date-input::-webkit-clear-button {
          display: none;
        }
      `}</style>
    </div>
  );
}