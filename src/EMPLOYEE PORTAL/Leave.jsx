import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";
import axios from "axios";
import { approvalUser, approvalDateTime, approvalRemarks, applicationFileDate, approvalLabels } from "./approvalDisplayUtils";


const Leave = () => {
  const { user } = useAuth();

  // --- Data ---
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [error, setError] = useState(null);
  const applicationsRequestRef = useRef(0);

  // --- Form state ---
  const [selectedStartDate, setSelectedStartDate] = useState("");
  const [selectedEndDate, setSelectedEndDate] = useState("");
  const [leaveHours, setLeaveHours] = useState("");
  const [leaveDays, setLeaveDays] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [remarks, setRemarks] = useState("");

  // --- Sorting ---
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // --- View Mode ---
  // 'card' | 'accordion' | 'table'
  const [viewMode, setViewMode] = useState("card");
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const setByScreen = () => setViewMode(mq.matches ? "table" : "card");
    setByScreen();
    mq.addEventListener("change", setByScreen);
    return () => mq.removeEventListener("change", setByScreen);
  }, []);

  // --- Filters (defaults to current month) ---
  const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");
  const monthEnd = dayjs().endOf("month").format("YYYY-MM-DD");
  const [searchFields, setSearchFields] = useState({
    leaveDateStart: monthStart,
    leaveDateEnd: monthEnd,
    leaveDays: "",
    leaveType: "",
    leaveDesc: "",
    leaveRemarks: "",
    appRemarks: "",
    leaveStatus: "",
  });

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 6;
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage) || 1;
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord);

  // constants (adjust if your policy differs)
  const WORK_HOURS_PER_DAY = 8;

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [leaveBalDays, setLeaveBalDays] = useState(0);
  const [leaveBalHours, setLeaveBalHours] = useState(0);

  // optional: simple validation message
  const [balanceError, setBalanceError] = useState("");


useEffect(() => {
  let alive = true;

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);

      const res = await fetch(API_ENDPOINTS.leaveTypes, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          // If you use a tenant header, include it:
          // "X-Company-DB": selectedCompanyCode,
        },
        body: JSON.stringify({ EMP_NO: user.empNo }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
      }

      const payload = await res.json(); // this is what axios's { data } was

      if (!alive) return;

      if (payload?.success && Array.isArray(payload.data)) {
        const seen = new Set();
        const cleaned = payload.data
          .filter(r => r?.lvtype && r?.lvdesc)
          .filter(r => (seen.has(r.lvtype) ? false : seen.add(r.lvtype)))
          .sort((a, b) => a.lvdesc.localeCompare(b.lvdesc));

        setLeaveTypes(cleaned);
      } else {
        setLeaveTypes([]);
      }
    } catch (err) {
      if (alive) {
        console.error("Error fetching leave types:", err);
        setLeaveTypes([]);
      }
    } finally {
      if (alive) setLoading(false);
    }
  };

  if (user?.empNo) fetchLeaveTypes();
  return () => { alive = false; };
}, [user?.empNo]);




  // --- Fetch ---
  useEffect(() => {
    if (!user?.empNo) return;

    const fetchLeaveApplications = async () => {
      const requestId = ++applicationsRequestRef.current;
      try {
        const response = await fetch(API_ENDPOINTS.fetchLeaveApplications, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: searchFields.leaveDateStart,
            END_DATE: searchFields.leaveDateEnd,
          }),
        });
        const result = await response.json();
        if (requestId !== applicationsRequestRef.current) return;

        if (result?.success && result?.data?.length > 0) {
          const rawRows = result.data[0]?.result;
          const parsed = Array.isArray(rawRows)
            ? rawRows
            : JSON.parse(rawRows || "[]");
          setError(null);
          setLeaveApplications(parsed);
          setFilteredApplications(parsed);
        } else {
          setLeaveApplications([]);
          setFilteredApplications([]);
          setError(null);
        }
      } catch (err) {
        if (requestId !== applicationsRequestRef.current) return;
        console.error("Error fetching leave applications:", err);
        setError((currentError) =>
          leaveApplications.length > 0 ? null : "An error occurred while fetching leave applications."
        );
      }
    };

    fetchLeaveApplications();
    return () => {
      applicationsRequestRef.current += 1;
    };
  }, [user?.empNo, searchFields.leaveDateStart, searchFields.leaveDateEnd]);

  // --- Init defaults ---
  useEffect(() => {
    const today = dayjs().format("YYYY-MM-DD");
    setSelectedStartDate(today);
    setSelectedEndDate(today);
  }, []);



  // --- Derived options from data ---
  const typeOptions = useMemo(() => {
    const set = new Set();
    leaveApplications.forEach((x) => x?.leaveCode && set.add(x.leaveCode));
    return Array.from(set).sort();
  }, [leaveApplications]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    leaveApplications.forEach((x) => x?.leaveStatus && set.add(x.leaveStatus));
    return Array.from(set).sort();
  }, [leaveApplications]);

  // --- Filter application list whenever filters or data change ---
  useEffect(() => {
    let filtered = [...leaveApplications];

    // Date range: keep rows if any overlap with [leaveDateStart..leaveDateEnd]
    const hasStart = !!searchFields.leaveDateStart;
    const hasEnd = !!searchFields.leaveDateEnd;
    if (hasStart || hasEnd) {
      filtered = filtered.filter((row) => {
        const start = dayjs(row.leaveStart).format("YYYY-MM-DD");
        const end = dayjs(row.leaveEnd).format("YYYY-MM-DD");
        const afterStart = hasStart ? end >= searchFields.leaveDateStart : true; // overlaps interval
        const beforeEnd = hasEnd ? start <= searchFields.leaveDateEnd : true;
        return afterStart && beforeEnd;
      });
    }

    if (searchFields.leaveDays) {
      filtered = filtered.filter((r) =>
        String(r.leaveDays ?? "").toLowerCase().includes(String(searchFields.leaveDays).toLowerCase())
      );
    }
    if (searchFields.leaveType) {
      filtered = filtered.filter((r) => (r?.leaveCode || "") === searchFields.leaveType);
    }
    if (searchFields.leaveStatus) {
      filtered = filtered.filter((r) => (r?.leaveStatus || "") === searchFields.leaveStatus);
    }
    if (searchFields.leaveRemarks) {
      filtered = filtered.filter((r) => String(r.leaveRemarks ?? "").toLowerCase().includes(searchFields.leaveRemarks.toLowerCase()));
    }
    if (searchFields.appRemarks) {
      filtered = filtered.filter((r) => String(r.appRemarks ?? "").toLowerCase().includes(searchFields.appRemarks.toLowerCase()));
    }

    setFilteredApplications(filtered);
    setCurrentPage(1);
  }, [searchFields, leaveApplications]);

  // --- Sorting ---
  const FIELD_MAP = {
    startDate: "leaveStart",
    endDate: "leaveEnd",
    durationDays: "leaveDays",
    type: "leaveCode",
    remark: "leaveRemarks",
    appRemarks: "appRemarks",
    status: "leaveStatus",
  };

  const sortData = (uiKey) => {
    const key = FIELD_MAP[uiKey] || uiKey;
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });

    const sorted = [...filteredApplications].sort((a, b) => {
      if (key === "leaveStart" || key === "leaveEnd") {
        const av = dayjs(a[key]).valueOf();
        const bv = dayjs(b[key]).valueOf();
        return direction === "asc" ? av - bv : bv - av;
      }
      if (key === "leaveDays") {
        const av = parseFloat(a.leaveDays ?? 0);
        const bv = parseFloat(b.leaveDays ?? 0);
        return direction === "asc" ? av - bv : bv - av;
      }
      const av = String(a[key] ?? "");
      const bv = String(b[key] ?? "");
      return direction === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    setFilteredApplications(sorted);
  };

  const getSortIndicator = (uiKey) => {
    const key = FIELD_MAP[uiKey] || uiKey;
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };
  
  // Search Function
  const handleSearchChange = (e, key) => {
  const { value } = e.target;
  setSearchFields((prev) => ({ ...prev, [key]: value }));
};
  // --- Form helpers ---
  const calculateDaysFromHours = (h) => (h ? (Number(h) / 8).toFixed(2) : "");

  // const handleHoursChange = (e) => {
  //   const h = e.target.value;
  //   setLeaveHours(h);
  //   setLeaveDays(calculateDaysFromHours(h));
  // };

  // const handleDaysChange = (e) => {
  //   const d = e.target.value;
  //   setLeaveDays(d);
  //   setLeaveHours(d ? String(Number(d) * 8) : "");
  // };

  const handleDaysChange = (e) => {
  const d = Number(e.target.value || 0);
  let h = Number((d * WORK_HOURS_PER_DAY).toFixed(2));
  const { d: d2, h: h2 } = clampRequestToBalance(d, h);
  setLeaveDays(d2);
  setLeaveHours(h2);
};

const handleHoursChange = (e) => {
  const h = Number(e.target.value || 0);
  let d = Number((h / WORK_HOURS_PER_DAY).toFixed(2)); // keep decimals if needed
  const { d: d2, h: h2 } = clampRequestToBalance(d, h);
  setLeaveHours(h2);
  setLeaveDays(d2);
};

const FMT = "YYYY-MM-DD";

// treat input as a raw string while typing
const isCompleteISO = (v) => typeof v === "string" && v.length === 10;

const handleStartDateChange = (value) => {
  setSelectedStartDate(value);

  // If end date is complete and now earlier, align on the fly
  if (isCompleteISO(value) && isCompleteISO(selectedEndDate)) {
    const start = dayjs(value, FMT, true);
    const end   = dayjs(selectedEndDate, FMT, true);
    if (start.isValid() && end.isValid() && end.isBefore(start, "day")) {
      setSelectedEndDate(value);
    }
  }
};

// onChange: don't block typing; only set and optionally soft-sync
const handleEndDateChange = (value) => {
  setSelectedEndDate(value);
};

// onBlur (or on Enter): enforce final validation
const validateEndDate = () => {
  const start = dayjs(selectedStartDate, FMT, true);
  const end   = dayjs(selectedEndDate, FMT, true);

  // if incomplete or invalid, don't nag while typing; just snap if start exists
  if (!isCompleteISO(selectedEndDate) || !end.isValid()) {
    if (start.isValid()) setSelectedEndDate(selectedStartDate);
    return;
  }

  if (start.isValid() && end.isBefore(start, "day")) {
    Swal.fire({
      icon: "warning",
      title: "Invalid End Date",
      text: "End date cannot be earlier than start date.",
    });
    setSelectedEndDate(selectedStartDate);
  }
};


  // call this when the select changes
const handleLeaveTypeChange = (e) => {
  const val = e.target.value;
  setLeaveType(val);

  // find selected row from the cached /leaveTypes
  const sel = leaveTypes.find(x => x.lvtype === val);

  if (sel) {
    const days = Number(sel.balance ?? 0);
    // use balancehrs if provided, else derive from days
    const hours = sel.balancehrs != null
      ? Number(sel.balancehrs)
      : Number((days * WORK_HOURS_PER_DAY).toFixed(2));

    setLeaveBalDays(days);
    setLeaveBalHours(hours);

    // (optional) reset request counts on change
    setLeaveDays(1);
    setLeaveHours(8);
    setBalanceError("");
  } else {
    setLeaveBalDays(1);
    setLeaveBalHours(8);
    setLeaveDays(1);
    setLeaveHours(8);
    setBalanceError("");
  }
};

const clampRequestToBalance = (days, hours) => {
  // if either exceeds balance, clamp and set a note
  let d = days, h = hours;
  let msg = "";

  if (d > leaveBalDays) {
    d = leaveBalDays;
    msg = "Requested days exceed available balance. Reset to maximum balance.";
  }
  if (h > leaveBalHours) {
    h = leaveBalHours;
    msg = "Requested hours exceed available balance. Reset to maximum balance.";
  }
  setBalanceError(msg);
  return { d, h };
};





    // --- Auto-compute Days/Hours from Start–End range (8 hrs/day, inclusive) ---
  useEffect(() => {
    if (!selectedStartDate || !selectedEndDate) return;

    const start = dayjs(selectedStartDate);
    const end = dayjs(selectedEndDate);

    if (end.isBefore(start)) return; // already handled by validation

    const inclusiveDays = end.diff(start, "day") + 1; // e.g., Sep 1–1 = 1 day
    const hours = inclusiveDays * 8;

    setLeaveDays(String(inclusiveDays));
    setLeaveHours(String(hours));
  }, [selectedStartDate, selectedEndDate]);


  const handleSubmit = async () => {
  // --- Required field validation ---
  const missing = [
    !selectedStartDate ? "Leave Start Date" : null,
    !selectedEndDate ? "Leave End Date" : null,
    !leaveType ? "Leave Type" : null,
    !remarks.trim() ? "Remarks" : null,
  ].filter(Boolean);

  if (missing.length) {
    await Swal.fire({
      icon: "warning",
      title: "Incomplete Form",
      html: `Please fill all required fields.<br><small>Missing: <b>${missing.join(", ")}</b></small>`
    });
    return;
  }

  // --- Date validation ---
  const FMT = "YYYY-MM-DD";
  const start = dayjs(selectedStartDate, FMT, true);
  const end   = dayjs(selectedEndDate, FMT, true);

  if (end.isBefore(start, "day")) {
    await Swal.fire({
      icon: "warning",
      title: "Invalid End Date",
      text: "End date cannot be earlier than start date."
    });
    return;
  }

  // --- Build payload ---
  const payload = {
    json_data: {
      empNo: user.empNo,
      detail: [{
        leaveStart: selectedStartDate,
        leaveEnd: selectedEndDate,
        leaveCode: leaveType,
        leaveRemarks: remarks.trim(),
        leaveHours: leaveHours ? parseFloat(leaveHours) : 0,
        leaveDays: leaveDays ? parseFloat(leaveDays) : 0,
      }],
    },
  };

  const escapeHTML = (str = "") =>
    str.replace(/[&<>'"]/g, (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag)
    );

  const display = {
    startDay: start.format("dddd"),
    startDate: start.format("MM/DD/YYYY"),
    endDay: end.format("dddd"),
    endDate: end.format("MM/DD/YYYY"),
    typeText: leaveType,
    days: (leaveDays && !isNaN(leaveDays))
      ? Number(leaveDays).toFixed(2)
      : (end.diff(start, "day") + 1).toFixed(2),
    hours: (leaveHours && !isNaN(leaveHours))
      ? Number(leaveHours).toFixed(2)
      : "",
  };

  // --- Step 1: Confirmation before save ---
  const confirm = await Swal.fire({
    icon: "question",
    title: "Confirm Leave Application",
    html: `
      <div style="text-align:left;">
        <table style="width:100%; font-size:14px;">
          <tr><td style="width:140px;"><b>Leave Type:</b></td><td>${escapeHTML(display.typeText)}</td></tr>
          <tr><td><b>Start:</b></td><td>${display.startDay}, ${display.startDate}</td></tr>
          <tr><td><b>End:</b></td><td>${display.endDay}, ${display.endDate}</td></tr>
          <tr><td><b>Total Days:</b></td><td>${display.days}</td></tr>
          ${display.hours ? `<tr><td><b>Total Hours:</b></td><td>${display.hours}</td></tr>` : ""}
          <tr><td><b>Remarks:</b></td><td>${escapeHTML(remarks.trim())}</td></tr>
        </table>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Yes",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#6b7280",
    customClass: {
      popup: "swal-sm-popup",
      title: "swal-sm-title",
      confirmButton: "swal-sm-confirm",
      cancelButton: "swal-sm-cancel",
    },
  });

  if (!confirm.isConfirmed) return; // ✅ Stop if cancelled

  // --- Step 2: Proceed with Save ---
  try {
    const res = await fetch(API_ENDPOINTS.saveLeaveApplication, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok || result?.status !== "success") {
      await Swal.fire({
        icon: "error",
        title: "Failed!",
        text: "Failed to submit leave. Please try again.",
      });
      return;
    }

    // --- Step 3: Success with details ---
    await Swal.fire({
      icon: "success",
      title: '<span style="font-size:18px; font-weight:600;">Leave Application Submitted</span>',
      html: `
        <div style="text-align:left;">
          <table style="width:100%; font-size:14px;">
            <tr><td style="width:140px;"><b>Leave Type:</b></td><td>${escapeHTML(display.typeText)}</td></tr>
            <tr><td><b>Start:</b></td><td>${display.startDay}, ${display.startDate}</td></tr>
            <tr><td><b>End:</b></td><td>${display.endDay}, ${display.endDate}</td></tr>
            <tr><td><b>Total Days:</b></td><td>${display.days}</td></tr>
            ${display.hours ? `<tr><td><b>Total Hours:</b></td><td>${display.hours}</td></tr>` : ""}
            <tr><td><b>Remarks:</b></td><td>${escapeHTML(remarks.trim())}</td></tr>
          </table>
        </div>
      `,
      confirmButtonText: "Close",
      confirmButtonColor: "#3085d6",
      customClass: {
        popup: "swal-sm-popup",
        title: "swal-sm-title",
        confirmButton: "swal-sm-confirm",
      },
    });

    // --- Reset form + refresh listing ---
    const today = dayjs().format("YYYY-MM-DD");
    // setApplicationDate(today);
    setSelectedStartDate(today);
    setSelectedEndDate(today);
    setLeaveType("");
    setRemarks("");
    setLeaveHours("");
    setLeaveDays("");

    try {
      const response = await fetch(API_ENDPOINTS.fetchLeaveApplications, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: searchFields.leaveDateStart,
          END_DATE: searchFields.leaveDateEnd,
        }),
      });
      const refresh = await response.json();
      if (refresh?.success && refresh?.data?.length > 0) {
        const parsed = JSON.parse(refresh.data[0].result) || [];
        setLeaveApplications(parsed);
        setFilteredApplications(parsed);
      }
    } catch (e) {
      console.error("Error refreshing leave list:", e);
    }
  } catch (err) {
    console.error("Error submitting leave:", err);
    await Swal.fire({
      icon: "error",
      title: "Error!",
      text: "An error occurred while submitting. Please check your connection and try again.",
    });
  }
};





  

  // Put below your fetchLeaveApplications() effect or with other helpers

  const refreshLeaveList = async () => {
    const r = await fetch(API_ENDPOINTS.fetchLeaveApplications, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        EMP_NO: user.empNo,
        START_DATE: searchFields.leaveDateStart,
        END_DATE: searchFields.leaveDateEnd,
      }),
    });
    const jj = await r.json();
    const rows =
      jj?.success && jj.data?.length
        ? JSON.parse(jj.data[0].result || "[]")
        : [];
    setLeaveApplications(rows);
    setFilteredApplications(rows);
  };

  // Try a few likely stamp keys coming from API rows
// Heuristic finder: try common keys and then scan any key that looks like a stamp/id/guid
const getLeaveStamp = (row) => {
  if (!row) return null;
  // Try common/likely names first (adjust order as you learn the real one)
  const candidates = [
    row.lvStamp, row.leaveStamp, row.LV_STAMP, row.LVSTAMP,
    row.lvId, row.leaveId, row.LeaveID, row.id, row.ID, row.guid, row.GUID,
    row.appStamp, row.docStamp, row.transStamp, row.tranStamp, row.lvTranStamp
  ].filter(Boolean);
  if (candidates.length) return candidates[0];

  // Fallback: scan keys for something that contains "stamp" or ends with "id"/"guid"
  for (const [k, v] of Object.entries(row)) {
    const lk = String(k).toLowerCase();
    if (lk.includes("stamp") || lk === "id" || lk.endsWith("id") || lk.endsWith("guid")) {
      if (v) return v;
    }
  }
  return null;
};


  const cancelLeaveApplication = async (entry) => {
  if (!(entry?.leaveStatus || entry?.status) || !["Pending", "Approved"].includes(entry?.leaveStatus || entry?.status)) return;

  const lvStamp = getLeaveStamp(entry);
  if (!lvStamp) {
    await Swal.fire({
      icon: "error",
      title: "Missing Identifier",
      text: "Cannot cancel: leave stamp (lvStamp) not found in this row.",
    });
    return;
  }

  // ---- Helpers ----
  const escapeHTML = (str = "") =>
    String(str).replace(/[&<>'"]/g, (t) =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[t] || t)
    );

  // Try to be flexible with backend field names
  const startRaw = entry.leaveStart || entry.startDate || entry.dateFrom || entry.leave_start;
  const endRaw   = entry.leaveEnd   || entry.endDate   || entry.dateTo   || entry.leave_end;
  const typeRaw  = entry.leaveCode  || entry.leaveType || entry.type     || entry.leave_code;
  const daysRaw  = entry.leaveDays  || entry.days;
  const hoursRaw = entry.leaveHours || entry.hours;
  const remarks  = entry.leaveRemarks || entry.remarks || "";

  const start = dayjs(startRaw);
  const end   = dayjs(endRaw);

  const display = {
    type: typeRaw ? String(typeRaw) : "—",
    startDay: start.isValid() ? start.format("dddd") : "—",
    startDate: start.isValid() ? start.format("MM/DD/YYYY") : escapeHTML(startRaw ?? "—"),
    endDay: end.isValid() ? end.format("dddd") : "—",
    endDate: end.isValid() ? end.format("MM/DD/YYYY") : escapeHTML(endRaw ?? "—"),
    days: (daysRaw !== undefined && daysRaw !== null && !Number.isNaN(Number(daysRaw)))
      ? Number(daysRaw).toFixed(2)
      : (start.isValid() && end.isValid() ? (end.diff(start, "day") + 1).toFixed(2) : "—"),
    hours: (hoursRaw !== undefined && hoursRaw !== null && !Number.isNaN(Number(hoursRaw)))
      ? Number(hoursRaw).toFixed(2)
      : "",
    remarks: remarks ? escapeHTML(String(remarks)) : "—",
    stamp: escapeHTML(String(lvStamp)),
  };

  // ---- Confirmation with details ----
  const conf = await Swal.fire({
    icon: "warning",
    title: "Cancel this application?",
    html: `
      <div style="text-align:left;">
        <p style="margin:0 0 8px; font-size:13px;">This will mark your leave request as <b>Cancelled</b>.</p>
        <table style="width:100%; font-size:14px;">
          <tr><td style="width:160px;"><b>Leave Type:</b></td><td>${escapeHTML(display.type)}</td></tr>
          <tr><td><b>Start:</b></td><td>${display.startDay}, ${display.startDate}</td></tr>
          <tr><td><b>End:</b></td><td>${display.endDay}, ${display.endDate}</td></tr>
          <tr><td><b>Total Days:</b></td><td>${display.days}</td></tr>
          ${display.hours ? `<tr><td><b>Total Hours:</b></td><td>${display.hours}</td></tr>` : ""}
          <tr><td><b>Remarks:</b></td><td>${display.remarks}</td></tr>
        </table>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Yes",
    cancelButtonText: "No",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    customClass: {
      popup: "swal-sm-popup",
      title: "swal-sm-title",
      confirmButton: "swal-sm-confirm",
      cancelButton: "swal-sm-cancel",
    },
  });
  if (!conf.isConfirmed) return;

  // ---- Proceed with cancel ----
  try {
    const payload = { json_data: { empNo: user.empNo, lvStamp } };

    const res = await fetch(API_ENDPOINTS.cancelLeaveApplication, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.status !== "success") {
      throw new Error(j?.message || "Cancel failed");
    }

    // ---- Success with details ----
    await Swal.fire({
      icon: "success",
      title: '<span style="font-size:18px; font-weight:600;">Leave Application Cancelled</span>',
      html: `
        <div style="text-align:left;">
          <table style="width:100%; font-size:14px;">
            <tr><td style="width:160px;"><b>Leave Type:</b></td><td>${escapeHTML(display.type)}</td></tr>
            <tr><td><b>Start:</b></td><td>${display.startDay}, ${display.startDate}</td></tr>
            <tr><td><b>End:</b></td><td>${display.endDay}, ${display.endDate}</td></tr>
            <tr><td><b>Total Days:</b></td><td>${display.days}</td></tr>
            ${display.hours ? `<tr><td><b>Total Hours:</b></td><td>${display.hours}</td></tr>` : ""}
            <tr><td><b>Remarks:</b></td><td>${display.remarks}</td></tr>
          </table>
        </div>
      `,
      confirmButtonText: "Close",
      confirmButtonColor: "#3085d6",
      customClass: {
        popup: "swal-sm-popup",
        title: "swal-sm-title",
        confirmButton: "swal-sm-confirm",
      },
    });

    await refreshLeaveList();
  } catch (e) {
    await Swal.fire({ icon: "error", title: "Error", text: e.message || "Failed to cancel leave." });
  }
};



  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[200px] mt-[80px] p-2 sm:p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        {/* Header */}
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">My Leave Applications</h1>
        </div>

        {/* Form Card */}
        <div className="mt-4 bg-white p-4 sm:p-6 shadow-md rounded-xl text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

            {/* Leave Type */}
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Leave Type</span>
              <select
                className="w-full p-2 border rounded-xl"
                value={leaveType}
                onChange={handleLeaveTypeChange}
                disabled={loading}
              >
                <option value="">Select Leave Type</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.lvtype} value={lt.lvtype}>
                    {lt.lvdesc}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="block font-semibold mb-1">Leave Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedStartDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  onBlur={(e) => handleStartDateChange(e.target.value)}  // optional: re-check on blur
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="block font-semibold mb-1">Leave End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedEndDate}
                  min={selectedStartDate || undefined}
                  onChange={(e) => handleEndDateChange(e.target.value)}  // allow free typing
                  onBlur={validateEndDate}                               // validate when done
                  onKeyDown={(e) => { if (e.key === "Enter") validateEndDate(); }}
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
            </div>


          </div>

        {/* Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          
          <div className="flex flex-col">
            <span className="block font-semibold mb-1 text-red-600 font-semibold">Available Balance (days)</span>
            <input
              type="number"
              className="w-full p-2 border rounded-xl text-red-600 font-semibold"
              min="0"
              step="0.01"
              value={leaveBalDays}
              readOnly
              disabled
            />
          </div>
          <div className="flex flex-col">
            <span className="block font-semibold mb-1 text-red-600 font-semibold">Available Balance (hrs)</span>
            <input
              type="number"
              className="w-full p-2 border rounded-xl text-red-600 font-semibold"
              min="0"
              step="0.25"
              value={leaveBalHours}
              readOnly
              disabled
            />
          </div>
        {/* </div> */}

          {/* Requested */}

          {/* <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4"> */}
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Number of Days</span>
              <input type="number" className="w-full p-2 border rounded-xl" min="0" step="1" value={leaveDays} onChange={handleDaysChange} placeholder="Enter leave days" />
            </div>
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Number of Hours</span>
              <input type="number" className="w-full p-2 border rounded-xl" min="0" step="0.5" value={leaveHours} onChange={handleHoursChange} placeholder="Enter leave hours" />
            </div>
          </div>

      {/* Optional inline validation */}
      {balanceError && (
        <div className="mt-2 text-sm text-red-600">{balanceError}</div>
      )}



          <div className="mt-6">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows="4" className="w-full p-2 border rounded-xl" placeholder="Enter Remarks"></textarea>
          </div>

          <div className="mt-4 flex justify-center">
            <button className="bg-blue-800 text-white px-12 py-2 rounded-xl text-md sm:text-base hover:bg-blue-700 w-full sm:w-auto mx-auto" onClick={handleSubmit}>
              Submit
            </button>
          </div>
        </div>

        {/* Quick Filters (like Overtime) */}
        <div className="mt-4 bg-white p-4 shadow-md rounded-xl">
        <h2 className="text-base font-semibold">Filter Leave Applications</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {/* Start */}
          <div className="min-w-0">
            <div className="relative">
              <input
                type="date"
                value={searchFields.leaveDateStart}
                onChange={(e) => setSearchFields((p) => ({ ...p, leaveDateStart: e.target.value }))}
                className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 appearance-none"
              />
            </div>
          </div>

          {/* End */}
          <div className="min-w-0">
            <div className="relative">
              <input
                type="date"
                value={searchFields.leaveDateEnd}
                min={searchFields.leaveDateStart}
                onChange={(e) => setSearchFields((p) => ({ ...p, leaveDateEnd: e.target.value }))}
                className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 appearance-none"
              />
            </div>
          </div>

          {/* Type */}
          <select
            value={searchFields.leaveType}
            onChange={(e) => setSearchFields((p) => ({ ...p, leaveType: e.target.value }))}
            className="w-full px-2 py-2 border rounded-xl text-sm bg-white"
          >
            <option value="">All Leave Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={searchFields.leaveStatus}
            onChange={(e) => setSearchFields((p) => ({ ...p, leaveStatus: e.target.value }))}
            className="w-full px-2 py-2 border rounded-xl text-sm bg-white"
          >
            <option value="">All Status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        </div>

        {/* History Card */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base font-semibold">Leave Application History</h2>
            <div className="inline-flex rounded-xl border overflow-hidden self-start">
              <button className={`px-8 py-2 text-sm ${viewMode === "card" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("card")}>Card</button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "accordion" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("accordion")}>
                Accordion
              </button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "table" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("table")}>Table</button>
            </div>
          </div>

          {error && <p className="text-red-500 text-center mt-2">{error}</p>}

          {/* CARD VIEW */}
          {viewMode === "card" && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentRecords.length > 0 ? (
                currentRecords.map((entry, idx) => {
                  const statusClass =
                  entry.leaveStatus === "Pending"
                    ? "text-yellow-700 bg-yellow-100 font-semibold"
                    : entry.leaveStatus === "Approved"
                    ? "text-blue-700 bg-blue-100 font-semibold"
                    : entry.leaveStatus === "Cancelled"
                    ? "text-gray-700 bg-gray-200 font-semibold"
                    : "text-red-700 bg-red-100 font-semibold";


                  return (
                    <div key={idx} className="border rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="text-sm sm:text-base font-semibold">
                          {applicationFileDate(entry)}
                          {/* {dayjs(entry.leaveStart).isSame(dayjs(entry.leaveEnd), "day")
                          ? dayjs(entry.leaveStart).format("MM/DD/YYYY")
                          : `${dayjs(entry.leaveStart).format("MM/DD/YYYY")} – ${dayjs(entry.leaveEnd).format("MM/DD/YYYY")}`} */}
                        </div>
                        <div className="flex items-center gap-2">
                          {(["Pending", "Approved"].includes(entry?.leaveStatus)) && <button className="inline-flex justify-center items-center text-xs sm:text-sm w-[90px] sm:w-[100px] py-1.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors" onClick={() => cancelLeaveApplication(entry)}>Cancel</button>}
                          <span className={`inline-flex justify-center items-center text-xs sm:text-sm w-[90px] sm:w-[100px] py-1.5 rounded-xl ${statusClass}`}>{entry.leaveStatus || "N/A"}</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[12px] md:text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Filing Date</span>
                          <span className="font-medium">{applicationFileDate(entry)}</span>
                        </div>                        
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Days</span>
                          <span className="font-medium">{entry.leaveDays} day(s)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Hours</span>
                          <span className="font-medium">{entry.leaveHrs} hour(s)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Type</span>
                          <span className="font-medium">{entry.leaveDesc}</span>
                        </div>
                        <br />
                        <div>
                          <div className="text-gray-500 font-semibold mt-2">Employee Remarks</div>
                          <div className="font-normal break-words text-black">{entry.leaveRemarks || "N/A"}</div>
                        </div>
                        <br />
                        <div>
                          <div className="text-gray-500 font-semibold">{approvalLabels(entry.leaveStatus).remarks}</div>
                          <div className="font-normal break-words text-blue-700">{approvalRemarks(entry) || "N/A"}</div>
                          <div className="text-gray-500 font-semibold mt-2">{approvalLabels(entry.leaveStatus).actor}</div>
                          <div className="font-normal break-words text-blue-700">{approvalUser(entry)}</div>
                          <div className="text-gray-500 font-semibold mt-2">{approvalLabels(entry.leaveStatus).date}</div>
                          <div className="font-normal break-words text-blue-700">{approvalDateTime(entry)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center text-gray-500 py-6">No leave applications found.</div>
              )}
            </div>
          )}

          {/* ACCORDION VIEW */}
          {viewMode === "accordion" && (
            <div className="mt-4 divide-y border rounded-xl">
              {currentRecords.length > 0 ? (
                currentRecords.map((entry, idx) => {
                  const statusClass =
                  entry.leaveStatus === "Pending"
                    ? "text-yellow-700 bg-yellow-100 font-semibold"
                    : entry.leaveStatus === "Approved"
                    ? "text-blue-700 bg-blue-100 font-semibold"
                    : entry.leaveStatus === "Cancelled"
                    ? "text-gray-700 bg-gray-200 font-semibold"
                    : "text-red-700 bg-red-100 font-semibold";

                  return (
                    <details key={idx} className="group p-2 text-[12px] md:text-sm">
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <div className="font-medium">
                          {dayjs(entry.leaveStart).format("MM/DD/YYYY")} – {dayjs(entry.leaveEnd).format("MM/DD/YYYY")} • {entry.leaveDays} day(s) • {entry.leaveDesc}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`inline-flex justify-center items-center w-28 py-1 rounded-xl ${statusClass}`}>{entry.leaveStatus || "N/A"}</span>
                          {(["Pending", "Approved"].includes(entry?.leaveStatus)) && <button className="inline-flex justify-center items-center text-sm w-28 py-1 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors" onClick={() => cancelLeaveApplication(entry)}>Cancel</button>}
                        </div>
                      </summary>
                                            <div className="mt-3 space-y-2">
                                              <div><div className="text-gray-500 font-semibold">Filing Date</div><div>{applicationFileDate(entry)}</div></div>
                                              <div><div className="text-gray-500 font-semibold">Remarks</div><div>{entry.leaveRemarks || "N/A"}</div></div>
                                              <div><div className="text-gray-500 font-semibold">{approvalLabels(entry.leaveStatus).remarks}</div><div className="font-normal break-words text-blue-700">{approvalRemarks(entry) || "N/A"}</div></div>
                                              <div><div className="text-gray-500 font-semibold">{approvalLabels(entry.leaveStatus).actor}</div><div className="font-normal break-words text-blue-700">{approvalUser(entry)}</div></div>
                                              <div><div className="text-gray-500 font-semibold">{approvalLabels(entry.leaveStatus).date}</div><div className="font-normal break-words text-blue-700">{approvalDateTime(entry)}</div></div>
                                            </div>
                    </details>
                  );
                })
              ) : (
                <div className="text-center text-gray-500 py-6">No leave applications found.</div>
              )}
            </div>
          )}

          {/* Table View */}
          {viewMode === "table" && (
            <div className="w-full overflow-x-auto mt-4 rounded-xl">
              <table className="w-full text-sm text-center border ">
                <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm lg:text-sm ">
                  <tr>
                    {[
                      { key: "fileDate", label: "Filing Date" },
                      { key: "startDate", label: "Start Date" },
                      { key: "endDate", label: "End Date" },
                      { key: "durationDays", label: "Days" },
                      { key: "durationHours", label: "Hours" },
                      { key: "type", label: "Leave Type" },
                      { key: "remark", label: "Employee's Remarks" },
                      { key: "appRemarks", label: "Approver's Remarks" },
                      { key: "status", label: "Status" },
                    ].map(({ key, label }) => (
                      <th key={key} className="py-2 px-3 cursor-pointer whitespace-nowrap" onClick={() => sortData(key)}>
                        {label} {getSortIndicator(key)}
                      </th>
                    ))}
                  </tr>
                  
  {/* 🔎 Search row (Date range uses the first TWO columns) */}
                  <tr>
                    <td className="px-1 py-2 bg-white whitespace-nowrap"><input className="w-full px-1 py-1 border border-blue-200 rounded-xl text-xs text-gray-800 bg-gray-100 select-none cursor-pointer" placeholder="N/A..." disabled readOnly /></td>
    {/* Start Date (column 1: OT Date) */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="date"
        value={searchFields.leaveDateStart}
        onChange={(e) => handleSearchChange(e, "leaveDateStart")}
        className="w-full px-1 py-1 border border-blue-200 rounded-xl text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
        placeholder="N/A..."
        disabled
        readonly
      />
    </td>

    {/* End Date (column 1: OT Date) */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="date"
        value={searchFields.leaveDateEnd}
        onChange={(e) => handleSearchChange(e, "leaveDateEnd")}
        className="w-full px-1 py-1 border border-blue-200 rounded-xl text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
        placeholder="N/A..."
        disabled
        readonly
      />
    </td>

    {/* Duration  */}
    <td className="px-1 py-2 bg-white whitespace-nowrap ">
      <input
        type="text"
        value={searchFields.durationDays}
        onChange={(e) => handleSearchChange(e, "durationDays")}
        className="w-full px-1 py-1 border border-blue-200 rounded-xl text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
        placeholder="N/A..."
        disabled
        readonly
      />
    </td>

    {/* Duration  */}
    <td className="px-1 py-2 bg-white whitespace-nowrap ">
      <input
        type="text"
        value={searchFields.durationHours}
        onChange={(e) => handleSearchChange(e, "durationHours")}
        className="w-full px-1 py-1 border border-blue-200 rounded-xl text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
        placeholder="N/A..."
        disabled
        readonly
      />
    </td>

    {/* Type */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="text"
        value={searchFields.leaveType}
        onChange={(e) => handleSearchChange(e, "leaveType")}
        className="w-full px-2 py-1 border border-blue-200 rounded-xl text-xs text-gray-800"
        placeholder="Filter..."
      />
    </td>

    {/* Remarks */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="text"
        value={searchFields.leaveRemarks}
        onChange={(e) => handleSearchChange(e, "leaveRemarks")}
        className="w-full px-2 py-1 border border-blue-200 rounded-xl text-xs text-gray-800"
        placeholder="Filter..."
      />
    </td>

    {/* Approver's Remarks */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="text"
        value={searchFields.appRemarks}
        onChange={(e) => handleSearchChange(e, "appRemarks")}
        className="w-full px-2 py-1 border border-blue-200 rounded-xl text-xs text-gray-800"
        placeholder="Filter..."
      />
    </td>

    
                        {/* Status */}
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <select
                        value={searchFields.leaveStatus}
                        onChange={(e) => handleSearchChange(e, "leaveStatus")}
                        className="w-full px-2 py-1 border border-blue-200 rounded-xl text-xs text-gray-800 bg-white"
                      >
                        <option value="">All</option>
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>



  </tr>
                </thead>
                <tbody className="global-tbody">
                  {currentRecords.length > 0 ? (
                    currentRecords.map((entry, index) => {
                    const statusClass =
                    entry.leaveStatus === "Pending"
                      ? "text-yellow-700 bg-yellow-100 font-semibold"
                      : entry.leaveStatus === "Approved"
                      ? "text-blue-700 bg-blue-100 font-semibold"
                      : entry.leaveStatus === "Cancelled"
                      ? "text-gray-700 bg-gray-200 font-semibold"
                      : "text-red-700 bg-red-100 font-semibold";

                      return (
                        <tr key={index} className="global-tr">
                          <td className="global-td whitespace-nowrap w-[50px]">{applicationFileDate(entry)}</td>
                          <td className="global-td whitespace-nowrap w-[50px]">{dayjs(entry.leaveStart).format("MM/DD/YYYY")}</td>
                          <td className="global-td whitespace-nowrap w-[50px]">{dayjs(entry.leaveEnd).format("MM/DD/YYYY")}</td>
                          <td className="global-td whitespace-nowrap text-right w-[70px]">{entry.leaveDays} day(s)</td>
                          <td className="global-td whitespace-nowrap text-right w-[70px]">{entry.leaveHrs} hr(s)</td>
                          <td className="global-td whitespace-nowrap text-left w-[150px]">{entry.leaveDesc}</td>
                          <td className="global-td text-wrap text-left w-[200px] truncate">{entry.leaveRemarks || "N/A"}</td>
                          <td className="global-td text-wrap text-left w-[200px] truncate">
                            <div className="global-td text-slate-600 font-semibold">{approvalLabels(entry.leaveStatus).remarks} </div>
                            <div className="global-td text-blue-700">{entry.appRemarks || "N/A"} </div>
                            <div className="global-td text-slate-600 font-semibold">{approvalLabels(entry.leaveStatus).actor} </div>
                            <div className="global-td text-xs text-blue-700">{approvalUser(entry)} </div>
                            <div className="global-td text-xs text-slate-600 font-semibold">{approvalLabels(entry.leaveStatus).date} </div>
                            <div className="global-td text-xs text-blue-700">{approvalDateTime(entry)} </div>
                          </td>
                          <td className="global-td text-center whitespace-nowrap w-[100px] p-2">
                            <div className="inline-flex flex-col items-center gap-2">
                              <span className={`inline-flex justify-center items-center text-xs w-[85px] py-1.5 rounded-xl ${statusClass}`}>{entry.leaveStatus || "N/A"}</span>
                              {(["Pending", "Approved"].includes(entry?.leaveStatus)) ? 
                              <button className="inline-flex justify-center items-center text-xs w-[85px] py-1.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors  " onClick={() => cancelLeaveApplication(entry)}>Cancel</button> : ""}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-6 text-center text-gray-500">
                        No leave applications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-between items-center mt-2 pt-2">
            <div className="text-xs text-gray-600">
              Showing <b>{filteredApplications.length === 0 ? 0 : indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredApplications.length)}</b> of {filteredApplications.length} entries
            </div>
            <div className="flex items-center text-sm border rounded-xl overflow-hidden">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border-r text-gray-700 hover:bg-blue-200 disabled:text-gray-400 disabled:cursor-not-allowed">
                &lt;
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1 border-r ${currentPage === i + 1 ? "bg-blue-800 text-white" : "text-gray-700 hover:bg-gray-200"}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-gray-700 hover:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leave;
