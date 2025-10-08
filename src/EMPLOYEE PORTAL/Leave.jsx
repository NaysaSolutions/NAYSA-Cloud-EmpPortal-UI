import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";
import axios from "axios";


const Leave = () => {
  const { user } = useAuth();

  // --- Data ---
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [error, setError] = useState(null);

  // --- Form state ---
  const [applicationDate, setApplicationDate] = useState("");
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
  const recordsPerPage = 10;
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
      try {
        const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");
        const response = await fetch(API_ENDPOINTS.fetchLeaveApplications, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: startDate,
            END_DATE: "2030-01-01",
          }),
        });
        const result = await response.json();
        if (result?.success && result?.data?.length > 0) {
          const parsed = JSON.parse(result.data[0].result) || [];
          setLeaveApplications(parsed);
          setFilteredApplications(parsed);
        } else {
          setLeaveApplications([]);
          setFilteredApplications([]);
          setError("No leave applications found.");
        }
      } catch (err) {
        console.error("Error fetching leave applications:", err);
        setError("An error occurred while fetching leave applications.");
      }
    };

    fetchLeaveApplications();
  }, [user]);

  // --- Init defaults ---
  useEffect(() => {
    const today = dayjs().format("YYYY-MM-DD");
    setApplicationDate(today);
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

  const handleStartDateChange = (value) => {
    setSelectedStartDate(value);
    if (!selectedEndDate || dayjs(value).isAfter(selectedEndDate)) {
      setSelectedEndDate(value);
    }
  };

  const handleEndDateChange = (value) => {
    if (selectedStartDate && dayjs(value).isBefore(selectedStartDate)) {
      Swal.fire({ icon: "warning", title: "Invalid End Date", text: "End date cannot be earlier than start date." });
      return;
    }
    setSelectedEndDate(value);
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
    setLeaveDays(0);
    setLeaveHours(0);
    setBalanceError("");
  } else {
    setLeaveBalDays(0);
    setLeaveBalHours(0);
    setLeaveDays(0);
    setLeaveHours(0);
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
    if (!selectedStartDate || !selectedEndDate || !leaveType || !remarks.trim()) {
      Swal.fire({ title: "Incomplete Form", text: "Please fill in all required fields before submitting.", icon: "warning" });
      return;
    }

    const payload = {
      json_data: {
        empNo: user.empNo,
        detail: [
          {
            leaveStart: selectedStartDate,
            leaveEnd: selectedEndDate,
            leaveCode: leaveType,
            leaveRemarks: remarks,
            leaveHours: leaveHours ? parseFloat(leaveHours) : 0,
            leaveDays: leaveDays ? parseFloat(leaveDays) : 0,
          },
        ],
      },
    };

    try {
      const res = await fetch(API_ENDPOINTS.saveLeaveApplication, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("API Error Response:", t);
        Swal.fire({ title: "Error!", text: "An error occurred with the API. Please try again later.", icon: "error" });
        return;
      }

      const result = await res.json();
      if (result?.status === "success") {
        Swal.fire({ title: "Success!", text: "Leave application submitted successfully.", icon: "success" }).then(async () => {
          // reset
          const today = dayjs().format("YYYY-MM-DD");
          setApplicationDate(today);
          setSelectedStartDate(today);
          setSelectedEndDate(today);
          setLeaveType("");
          setRemarks("");
          setLeaveHours("");
          setLeaveDays("");

          // refresh listing
          try {
            const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");
            const response = await fetch(API_ENDPOINTS.fetchLeaveApplications, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ EMP_NO: user.empNo, START_DATE: startDate, END_DATE: "2030-01-01" }),
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
        });
      } else {
        Swal.fire({ title: "Failed!", text: "Failed to submit leave. Please try again.", icon: "error" });
      }
    } catch (err) {
      console.error("Error submitting leave:", err);
      Swal.fire({ title: "Error!", text: "An error occurred while submitting. Please check your connection and try again.", icon: "error" });
    }
  };

  // Put below your fetchLeaveApplications() effect or with other helpers

  const refreshLeaveList = async () => {
    const r = await fetch(API_ENDPOINTS.fetchLeaveApplications, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        EMP_NO: user.empNo,
        START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
        END_DATE: "2099-12-31",
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
    if ((entry?.leaveStatus || "") !== "Pending") return;

    const lvStamp = getLeaveStamp(entry);
    if (!lvStamp) {
      await Swal.fire({
        title: "Missing identifier",
        text: "Cannot cancel: leave stamp (lvStamp) not found in this row.",
        icon: "error",
      });
      return;
    }

    const conf = await Swal.fire({
      title: "Cancel this application?",
      text: "This will mark your pending leave request as Cancelled.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, cancel it",
    });
    if (!conf.isConfirmed) return;

    try {
      // Mirror your OT payload shape: { json_data: { empNo, lvStamp } }
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

      await Swal.fire({
        title: "Cancelled",
        text: "Your leave application was cancelled.",
        icon: "success",
      });
      await refreshLeaveList();
    } catch (e) {
      await Swal.fire({ title: "Error", text: e.message, icon: "error" });
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
        <div className="mt-4 bg-white p-4 sm:p-6 shadow-md rounded-lg text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

            <div className="min-w-0">
              <label className="block font-semibold mb-1">Filing Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={applicationDate}
                  onChange={(e) => setApplicationDate(e.target.value)}
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="block font-semibold mb-1">Leave Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedStartDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="block font-semibold mb-1">Leave End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedEndDate}
                  min={selectedStartDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
            </div>


            {/* Leave Type */}
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Leave Type</span>
              <select
                className="w-full p-2 border rounded"
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
          </div>

        {/* Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          
          <div className="flex flex-col">
            <span className="block font-semibold mb-1 text-red-600 font-semibold">Available Balance in Days</span>
            <input
              type="number"
              className="w-full p-2 border rounded text-red-600 font-semibold"
              min="0"
              step="0.01"
              value={leaveBalDays}
              readOnly
              disabled
            />
          </div>
          <div className="flex flex-col">
            <span className="block font-semibold mb-1 text-red-600 font-semibold">Available Balance in Hours</span>
            <input
              type="number"
              className="w-full p-2 border rounded text-red-600 font-semibold"
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
              <input type="number" className="w-full p-2 border rounded" min="0" step="1" value={leaveDays} onChange={handleDaysChange} placeholder="Enter leave days" />
            </div>
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Number of Hours</span>
              <input type="number" className="w-full p-2 border rounded" min="0" step="0.5" value={leaveHours} onChange={handleHoursChange} placeholder="Enter leave hours" />
            </div>
          </div>

      {/* Optional inline validation */}
      {balanceError && (
        <div className="mt-2 text-sm text-red-600">{balanceError}</div>
      )}



          <div className="mt-6">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows="4" className="w-full p-2 border rounded" placeholder="Enter Remarks"></textarea>
          </div>

          <div className="mt-4 flex justify-center">
            <button className="bg-blue-800 text-white px-12 py-2 rounded-md text-md sm:text-base hover:bg-blue-700 w-full sm:w-auto mx-auto" onClick={handleSubmit}>
              Submit
            </button>
          </div>
        </div>

        {/* Quick Filters (like Overtime) */}
        <div className="mt-4 bg-white p-4 shadow-md rounded-lg">
        <h2 className="text-base font-semibold">Filter Leave Applications</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {/* Start */}
          <div className="min-w-0">
            <div className="relative">
              <input
                type="date"
                value={searchFields.leaveDateStart}
                onChange={(e) => setSearchFields((p) => ({ ...p, leaveDateStart: e.target.value }))}
                className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
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
                className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
              />
            </div>
          </div>

          {/* Type */}
          <select
            value={searchFields.leaveType}
            onChange={(e) => setSearchFields((p) => ({ ...p, leaveType: e.target.value }))}
            className="w-full px-2 py-2 border rounded text-sm bg-white"
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
            className="w-full px-2 py-2 border rounded text-sm bg-white"
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
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base font-semibold">Leave Application History</h2>
            <div className="inline-flex rounded-lg border overflow-hidden self-start">
              <button className={`px-8 py-2 text-sm ${viewMode === "card" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("card")}>Card</button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "accordion" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("accordion")}>
                Accordion
              </button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "table" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("table")}>Table</button>
            </div>
          </div>

          {error && <p className="text-red-500 text-center mt-2">{error}</p>}

          {/* Card View */}
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
                    <div key={idx} className="border rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-sm md:text-base">
                          {dayjs(entry.leaveStart).format("MM/DD/YYYY")} – {dayjs(entry.leaveEnd).format("MM/DD/YYYY")}
                        </div>
                        <span className={`inline-flex justify-center items-center text-sm w-28 py-1 md:py-2 rounded-lg ${statusClass}`}>
                          {entry.leaveStatus || "N/A"}
                        </span>
                      </div>

                      <div className="space-y-1 text-[12px] md:text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Days</span>
                          <span className="font-medium">{entry.leaveDays} day(s)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Type</span>
                          <span className="font-medium">{entry.leaveDesc}</span>
                        </div>
                        <br />
                        <div>
                          <div className="text-gray-500 font-semibold">Employee Remarks:</div>
                          <div className="font-normal break-words text-black">{entry.leaveRemarks || "N/A"}</div>
                        </div>
                        <br />
                        <div>
                          <div className="text-gray-500 font-semibold">Approver's Remarks:</div>
                          <div className="font-normal break-words text-blue-700">{entry.appRemarks || "N/A"}</div>
                        </div>
                      </div>
                      {/* Existing card body … */}
                      {entry?.leaveStatus === "Pending" && (
                        <div className="mt-3 text-right">
                          <button
                            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => cancelLeaveApplication(entry)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center text-gray-500 py-6">No leave applications found.</div>
              )}
            </div>
          )}

          {/* Accordion View */}
          {viewMode === "accordion" && (
            <div className="mt-4 divide-y border rounded-lg">
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
                        <span className={`inline-flex justify-center items-center w-28 py-1 rounded-lg ${statusClass}`}>{entry.leaveStatus || "N/A"}</span>
                      </summary>
                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="text-gray-500 font-semibold">Remarks</div>
                          <div>{entry.leaveRemarks || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 font-semibold">Approver's Remarks</div>
                          <div className="text-blue-800">{entry.appRemarks || "N/A"}</div>
                        </div>
                      </div>
                      {/* Inside <details> content */}
                      {entry?.leaveStatus === "Pending" && (
                        <div className="pt-2 text-right">
                          <button
                            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => cancelLeaveApplication(entry)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

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
            <div className="w-full overflow-x-auto mt-4 rounded-lg">
              <table className="min-w-[900px] w-full text-sm text-center border">
                <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm">
                  <tr>
                    {[
                      { key: "startDate", label: "Start Date" },
                      { key: "endDate", label: "End Date" },
                      { key: "durationDays", label: "Duration" },
                      { key: "type", label: "Leave Type" },
                      { key: "remark", label: "Remarks" },
                      { key: "appRemarks", label: "Approver's Remarks" },
                      { key: "status", label: "Status" },
                      { key: "actions", label: "Actions" },   // ← add this
                    ].map(({ key, label }) => (
                      <th key={key} className="py-2 px-3 cursor-pointer whitespace-nowrap" onClick={() => sortData(key)}>
                        {label} {getSortIndicator(key)}
                      </th>
                    ))}
                  </tr>
                  
  {/* 🔎 Search row (Date range uses the first TWO columns) */}
  <tr>
    {/* Start Date (column 1: OT Date) */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="date"
        value={searchFields.leaveDateStart}
        onChange={(e) => handleSearchChange(e, "leaveDateStart")}
        className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
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
        className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
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
        className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
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
        className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800"
        placeholder="Filter..."
      />
    </td>

    {/* Remarks */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="text"
        value={searchFields.leaveRemarks}
        onChange={(e) => handleSearchChange(e, "leaveRemarks")}
        className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800"
        placeholder="Filter..."
      />
    </td>

    {/* Approver's Remarks */}
    <td className="px-1 py-2 bg-white whitespace-nowrap">
      <input
        type="text"
        value={searchFields.appRemarks}
        onChange={(e) => handleSearchChange(e, "appRemarks")}
        className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800"
        placeholder="Filter..."
      />
    </td>

    
                        {/* Status */}
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <select
                        value={searchFields.leaveStatus}
                        onChange={(e) => handleSearchChange(e, "leaveStatus")}
                        className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-white"
                      >
                        <option value="">All</option>
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <input className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-gray-100 select-none cursor-pointer" placeholder="N/A..." disabled readonly/>
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
                          <td className="global-td text-center whitespace-nowrap">{dayjs(entry.leaveStart).format("MM/DD/YYYY")}</td>
                          <td className="global-td text-center whitespace-nowrap">{dayjs(entry.leaveEnd).format("MM/DD/YYYY")}</td>
                          <td className="global-td text-right whitespace-nowrap">{entry.leaveDays} day(s)</td>
                          <td className="global-td text-left whitespace-nowrap">{entry.leaveDesc}</td>
                          <td className="global-td text-left max-w-[240px] truncate" title={entry.leaveRemarks || "N/A"}>
                            {entry.leaveRemarks || "N/A"}
                          </td>
                          <td className="global-td text-left max-w-[240px] truncate" title={entry.appRemarks || "N/A"}>
                            {entry.appRemarks || "N/A"}
                          </td>
                          <td className="global-td text-center whitespace-nowrap">
                            <span className={`inline-flex justify-center items-center text-xs w-28 py-1 rounded-lg ${statusClass}`}>
                              {entry.leaveStatus || "N/A"}
                            </span>
                          </td>
                          <td className="global-td text-center whitespace-nowrap">
                            {entry?.leaveStatus === "Pending" ? (
                              <button
                                className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                onClick={() => cancelLeaveApplication(entry)}
                              >
                                Cancel
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
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
            <div className="flex items-center text-sm border rounded-lg overflow-hidden">
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
