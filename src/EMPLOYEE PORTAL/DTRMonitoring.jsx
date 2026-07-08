import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { FileSpreadsheet, RefreshCw, RotateCcw } from "lucide-react";
import API_ENDPOINTS from "../apiConfig";
import { useAuth } from "./AuthContext";

const today = new Date();

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const firstDayOfMonth = () => {
  return formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
};

const lastDayOfMonth = () => {
  return formatDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0));
};

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeFlag = (value) => {
  return normalizeText(value).toUpperCase();
};

const safeLower = (value) => {
  return normalizeText(value).toLowerCase();
};

const normalizeEndpoint = (endpoint) => String(endpoint || "").trim();

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

    const parsed = JSON.parse(raw);
    return unwrapUser(parsed);
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
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        const value = getStorageObject(storage, key);

        if (!value) continue;

        const empNo = getUserEmpNo(value);
        const hrFlag = getUserHrFlag(value);

        if (empNo || hrFlag) {
          return value;
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  return scan(localStorage) || scan(sessionStorage);
};

const getLoggedUser = () => {
  return getKnownStoredUser() || scanStorageForUser() || {};
};

const getUserEmpNo = (user) => {
  return findFirstValue(user, [
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
};

const getUserHrFlag = (user) => {
  return normalizeFlag(
    findFirstValue(user, [
      "hr_flag",
      "HR_FLAG",
      "hrFlag",
      "HrFlag",
      "hrflag",
    ])
  );
};

const getValue = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      return row[key];
    }
  }

  return fallback;
};

const formatHours = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
};

const formatDayName = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

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

    return `${String(displayHours).padStart(
      2,
      "0"
    )}:${minutes}:${seconds} ${displayMeridiem}`;
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

const getSourceBadgeClass = (source) => {
  const value = safeLower(source);

  if (value.includes("no dtr")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (value.includes("official")) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (value.includes("leave")) {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
};

const getRemarksBadgeClass = (remarks) => {
  const value = safeLower(remarks);

  if (!value) {
    return "bg-slate-50 text-slate-500 ring-slate-200";
  }

  if (value.includes("confirmed")) {
    return "bg-green-50 text-green-700 ring-green-200";
  }

  if (value.includes("pending")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (value.includes("adjustment")) {
    return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  }

  if (value.includes("approved")) {
    return "bg-green-50 text-green-700 ring-green-200";
  }

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

export default function DTRMonitoring() {
  const { user: authUser } = useAuth();

  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(lastDayOfMonth());
  const [records, setRecords] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [empNoFilter, setEmpNoFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isFetchingRef = useRef(false);
  const recordsSignatureRef = useRef("");

  const recordsPerPage = 10;

  const totalWorkedHours = useMemo(() => {
    return records.reduce((sum, row) => {
      const hrs = Number(
        getValue(row, ["worked_hrs", "WORKED_HRS", "workedHrs"], 0)
      );

      return sum + (Number.isNaN(hrs) ? 0 : hrs);
    }, 0);
  }, [records]);

  const sourceOptions = useMemo(() => {
    const uniqueSources = new Set();

    records.forEach((row) => {
      const source = normalizeText(getValue(row, ["source", "SOURCE"]));
      if (source) uniqueSources.add(source);
    });

    return ["ALL", ...Array.from(uniqueSources)];
  }, [records]);

  const filteredRecords = useMemo(() => {
    const keyword = safeLower(searchText);

    return records.filter((row) => {
      const source = normalizeText(getValue(row, ["source", "SOURCE"]));

      const sourceMatched =
        sourceFilter === "ALL" || safeLower(source) === safeLower(sourceFilter);

      const empNo = normalizeText(getValue(row, ["empno", "EMPNO", "empNo"]));
      const empNoMatched =
        !empNoFilter || safeLower(empNo).includes(safeLower(empNoFilter));

      const searchable = [
        getValue(row, ["source", "SOURCE"]),
        getValue(row, ["empno", "EMPNO", "empNo"]),
        getValue(row, ["empName", "EMPNAME", "emp_name"]),
        getValue(row, ["Department", "department", "DEPARTMENT"]),
        getValue(row, ["date", "DATE"]),
        getValue(row, ["time_in", "TIME_IN", "timeIn"]),
        getValue(row, ["time_out", "TIME_OUT", "timeOut"]),
        getValue(row, ["worked_hrs", "WORKED_HRS", "workedHrs"]),
        getValue(row, ["REMARKS", "remarks", "Remarks"]),
      ]
        .join(" ")
        .toLowerCase();

      const keywordMatched = !keyword || searchable.includes(keyword);

      return sourceMatched && empNoMatched && keywordMatched;
    });
  }, [empNoFilter, records, searchText, sourceFilter]);

  const withDtrCount = useMemo(() => {
    return filteredRecords.filter((row) => {
      const source = safeLower(getValue(row, ["source", "SOURCE"]));
      return source && !source.includes("no dtr");
    }).length;
  }, [filteredRecords]);

  const noDtrCount = useMemo(() => {
    return filteredRecords.filter((row) =>
      safeLower(getValue(row, ["source", "SOURCE"])).includes("no dtr")
    ).length;
  }, [filteredRecords]);

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage) || 1;
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredRecords.slice(
    indexOfFirstRecord,
    indexOfLastRecord
  );
  const pageNumbers = useMemo(() => {
    const maxVisiblePages = 7;
    const half = Math.floor(maxVisiblePages / 2);
    const start = Math.max(
      1,
      Math.min(currentPage - half, totalPages - maxVisiblePages + 1)
    );
    const end = Math.min(totalPages, start + maxVisiblePages - 1);

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [empNoFilter, searchText, sourceFilter, records]);

  const fetchAllDTR = useCallback(async ({ silent = false } = {}) => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;

    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const authUserData = unwrapUser(authUser);
      const storageUser = getLoggedUser();
      const currentUser = authUserData || storageUser || {};

      const currentEmpNo = normalizeText(getUserEmpNo(currentUser));
      const currentHrFlag = normalizeFlag(getUserHrFlag(currentUser));

      if (!startDate || !endDate) {
        if (!silent) {
          recordsSignatureRef.current = "";
          setRecords([]);
          setError("Please select Start Date and End Date.");
        }
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        if (!silent) {
          recordsSignatureRef.current = "";
          setRecords([]);
          setError("Start Date must not be greater than End Date.");
        }
        return;
      }

      const selectedEndpoint = normalizeEndpoint(
        currentHrFlag === "Y"
          ? API_ENDPOINTS.getAllDTRHR
          : API_ENDPOINTS.getAllDTR
      );

      const params = {
        startDate,
        endDate,
        START_DATE: startDate,
        END_DATE: endDate,
      };

      if (currentEmpNo) {
        params.empNo = currentEmpNo;
        params.EMP_NO = currentEmpNo;
      }

      if (!silent) {
        console.log("DTR Monitoring API Call:", {
          hrFlag: currentHrFlag || "BLANK/NULL",
          empNo: currentEmpNo || "MISSING",
          endpoint: selectedEndpoint,
          params,
        });
      }

      if (currentHrFlag !== "Y" && !currentEmpNo) {
        throw new Error("Employee No. is missing. Cannot load HR DTR records.");
      }

      const response = await axios.get(selectedEndpoint, { params });

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            response.data?.error_details ||
            "Failed to fetch all DTR records."
        );
      }

      const rows = response.data.records || response.data.data || [];
      const nextRows = Array.isArray(rows) ? rows : [];
      const nextSignature = JSON.stringify(nextRows);

      if (nextSignature !== recordsSignatureRef.current) {
        recordsSignatureRef.current = nextSignature;
        setRecords(nextRows);
      }
    } catch (err) {
      console.error("Error fetching all DTR records:", {
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
            "Failed to fetch all DTR records. Please try again later."
        );
      }
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  }, [authUser, startDate, endDate]);

  const handleReset = () => {
    setStartDate(firstDayOfMonth());
    setEndDate(lastDayOfMonth());
    setSearchText("");
    setEmpNoFilter("");
    setSourceFilter("ALL");
    setCurrentPage(1);
    setError("");
  };

  const exportExcel = () => {
    if (!filteredRecords.length) return;

    const rows = filteredRecords.map((row) => ({
      Type: getValue(row, ["source", "SOURCE"]),
      "Employee No": getValue(row, ["empno", "EMPNO", "empNo"]),
      "Employee Name": getValue(row, ["empName", "EMPNAME", "emp_name"]),
      Department: getValue(row, ["Department", "department", "DEPARTMENT"]),
      Date: getValue(row, ["date", "DATE"]),
      Day: formatDayName(getValue(row, ["date", "DATE"])),
      "Time In": formatTimeOnly(getValue(row, ["time_in", "TIME_IN", "timeIn"])),
      "Time Out": formatTimeOnly(
        getValue(row, ["time_out", "TIME_OUT", "timeOut"])
      ),
      "Worked Hours": formatHours(
        getValue(row, ["worked_hrs", "WORKED_HRS", "workedHrs"])
      ),
      Remarks: getValue(row, ["REMARKS", "remarks", "Remarks"]),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DTR Monitoring");
    XLSX.writeFile(
      workbook,
      `DTR_Monitoring_${startDate}_to_${endDate}.xlsx`
    );
  };

  useEffect(() => {
    fetchAllDTR();
    // Fetch once on page load. Date/filter changes update local state only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      fetchAllDTR({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [fetchAllDTR]);

  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[200px] mt-[80px] p-2 sm:p-4 bg-gray-100 min-h-screen overflow-x-hidden">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">
                DTR Monitoring
              </h1>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => fetchAllDTR()}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {loading ? "Loading..." : "Load"}
              </button>

              <button
                type="button"
                onClick={exportExcel}
                disabled={!filteredRecords.length}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                Export to Excel
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Start Date
              </label>
              <DateInput
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                End Date
              </label>
              <DateInput
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Type
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source === "ALL" ? "All Types" : source}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-1 block whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-500">
                Employee No
              </label>
              <input
                type="text"
                value={empNoFilter}
                onChange={(e) => setEmpNoFilter(e.target.value)}
                placeholder="Filter employee no..."
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            {/* <div className="min-w-0">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search employee, department, source, date, remarks..."
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div> */}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Total Records
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">
                {records.length}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Displayed Records
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">
                {filteredRecords.length}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                With DTR
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">
                {withDtrCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                No DTR
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">
                {noDtrCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Total Worked Hours
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">
                {formatHours(totalWorkedHours)}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-700">
              DTR Records
            </div>
          </div>

          <div className="max-h-[60vh] w-full overflow-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Type
                  </th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">
                    Employee No
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Employee Name
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Department
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Date
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Day
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Time In
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Time Out
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">
                    Worked Hrs
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Remarks
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="px-4 py-10 text-center text-sm font-medium text-slate-500"
                    >
                      Loading DTR records...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="px-4 py-10 text-center text-sm font-medium text-slate-500"
                    >
                      No DTR records found.
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((row, index) => {
                    const source = getValue(row, ["source", "SOURCE"]);
                    const empNoValue = getValue(row, [
                      "empno",
                      "EMPNO",
                      "empNo",
                    ]);
                    const empNameValue = getValue(row, [
                      "empName",
                      "EMPNAME",
                      "emp_name",
                    ]);
                    const department = getValue(row, [
                      "Department",
                      "department",
                      "DEPARTMENT",
                    ]);
                    const rowDate = getValue(row, ["date", "DATE"]);
                    const rowDay = formatDayName(rowDate);
                    const timeIn = getValue(row, [
                      "time_in",
                      "TIME_IN",
                      "timeIn",
                    ]);
                    const timeOut = getValue(row, [
                      "time_out",
                      "TIME_OUT",
                      "timeOut",
                    ]);
                    const workedHours = getValue(row, [
                      "worked_hrs",
                      "WORKED_HRS",
                      "workedHrs",
                    ]);
                    const remarks = getValue(row, [
                      "REMARKS",
                      "remarks",
                      "Remarks",
                    ]);

                    return (
                      <tr
                        key={`${empNoValue}-${rowDate}-${source}-${index}`}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getSourceBadgeClass(
                              source
                            )}`}
                          >
                            {source || "-"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                          {empNoValue || "-"}
                        </td>

                        <td className="min-w-[220px] px-4 py-3 font-medium text-slate-700">
                          {empNameValue || "-"}
                        </td>

                        <td className="min-w-[160px] px-4 py-3 text-slate-600">
                          {department || "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {rowDate || "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {rowDay}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatTimeOnly(timeIn)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatTimeOnly(timeOut)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-700">
                          {formatHours(workedHours)}
                        </td>

                        <td className="min-w-[200px] px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getRemarksBadgeClass(
                              remarks
                            )}`}
                          >
                            {remarks || "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              Showing{" "}
              <b>
                {Math.min(indexOfFirstRecord + 1, filteredRecords.length)}-
                {Math.min(indexOfLastRecord, filteredRecords.length)}
              </b>{" "}
              of {filteredRecords.length} entries
            </div>

            <div className="flex items-center self-start overflow-hidden rounded-xl border text-sm sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border-r hover:bg-gray-100 disabled:text-gray-400"
              >
                &lt;
              </button>
              {pageNumbers[0] > 1 && (
                <span className="px-3 py-1 border-r text-slate-500">...</span>
              )}
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`px-3 py-1 border-r ${
                    currentPage === pageNumber
                      ? "bg-blue-800 text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <span className="px-3 py-1 border-r text-slate-500">...</span>
              )}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 hover:bg-gray-100 disabled:text-gray-400"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
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
