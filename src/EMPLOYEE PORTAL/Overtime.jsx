import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

const overtimeTypeMap = {
  REG: "Regular Overtime",
  HOL: "Holiday",
  RD: "Rest Day",
  "Regular Day": "Regular Overtime",
};

const OvertimeApplication = () => {
  const { user } = useAuth();

  const [overtimeApplications, setOvertimeApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [error, setError] = useState(null);

  // form
  const [applicationDate, setApplicationDate] = useState("");
  const [otDate, setOTDate] = useState("");
  const [otDay, setOtDay] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [otType, setOtType] = useState("REG");
  const [remarks, setRemarks] = useState("");

  // view / pagination
  const [viewMode, setViewMode] = useState("card"); // card | accordion | table
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // filters / sorting
  const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");
  const monthEnd = dayjs().endOf("month").format("YYYY-MM-DD");
  const [searchFields, setSearchFields] = useState({
    otDateStart: monthStart,
    otDateEnd: monthEnd,
    durationHours: "",
    otType: "",
    otRemarks: "",
    appRemarks: "",
    otStatus: "",
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const FIELD_MAP = { date: "otDate", durationHours: "otHrs", type: "otType", remark: "otRemarks", appRemarks: "appRemarks", status: "otStatus" };

  // helpers
  const getOvertimeTypeLabel = (type) => overtimeTypeMap[type] || type;
  const hasId = (r) => r?.otId ?? r?.id ?? r?.requestId ?? null;

  const isoToUS = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
  };

  // fetch
  useEffect(() => {
    if (!user?.empNo) return;
    const run = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.fetchOvertimeApplications, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
            END_DATE: "2030-01-01",
          }),
        });
        const j = await res.json();
        if (j?.success && j.data?.length) {
          const rows = JSON.parse(j.data[0].result || "[]");
          setOvertimeApplications(rows);
          setFilteredApplications(rows);
        } else {
          setOvertimeApplications([]);
          setFilteredApplications([]);
          setError("No overtime applications found.");
        }
      } catch (e) {
        console.error(e);
        setError("An error occurred while fetching overtime applications.");
      }
    };
    run();
  }, [user?.empNo]);

  
  const refreshOvertimeList = async () => {
  const r = await fetch(API_ENDPOINTS.fetchOvertimeApplications, {
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
  setOvertimeApplications(rows);
  setFilteredApplications(rows);
};


  // form defaults
  useEffect(() => {
    const today = dayjs().format("YYYY-MM-DD");
    setApplicationDate(today);
    setOTDate(today);
    setOtType("REG");
  }, []);

  // day label
  useEffect(() => { if (otDate) setOtDay(dayjs(otDate).format("dddd")); }, [otDate]);

  // unique filter options
  const typeOptions = useMemo(() => {
    const set = new Set();
    overtimeApplications.forEach((a) => {
      const raw = a?.otType; if (!raw) return;
      set.add(raw === "Regular Day" ? "REG" : raw);
    });
    return Array.from(set).sort();
  }, [overtimeApplications]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    overtimeApplications.forEach((a) => { const s = a?.otStatus?.trim(); if (s) set.add(s); });
    return Array.from(set).sort();
  }, [overtimeApplications]);

  // filter
  useEffect(() => {
    let rows = [...overtimeApplications];

    const hasStart = !!searchFields.otDateStart;
    const hasEnd = !!searchFields.otDateEnd;
    if (hasStart || hasEnd) {
      rows = rows.filter((r) => {
        const d = dayjs(r.otDate).format("YYYY-MM-DD");
        return (!hasStart || d >= searchFields.otDateStart) && (!hasEnd || d <= searchFields.otDateEnd);
      });
    }
    if (searchFields.durationHours) rows = rows.filter((r) => String(r.otHrs ?? "").includes(searchFields.durationHours));
    if (searchFields.otType) rows = rows.filter((r) => (r?.otType === "Regular Day" ? "REG" : r?.otType) === searchFields.otType);
    if (searchFields.otRemarks) rows = rows.filter((r) => String(r.otRemarks ?? "").toLowerCase().includes(searchFields.otRemarks.toLowerCase()));
    if (searchFields.appRemarks) rows = rows.filter((r) => String(r.appRemarks ?? "").toLowerCase().includes(searchFields.appRemarks.toLowerCase()));
    if (searchFields.otStatus) rows = rows.filter((r) => (r?.otStatus || "") === searchFields.otStatus);

    // sort
    if (sortConfig.key) {
      const key = sortConfig.key;
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        if (key === "otDate") return (dayjs(a.otDate).valueOf() - dayjs(b.otDate).valueOf()) * dir;
        if (key === "otHrs") return ((+a.otHrs || 0) - (+b.otHrs || 0)) * dir;
        return String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * dir;
      });
    }

    setFilteredApplications(rows);
    setCurrentPage(1);
  }, [searchFields, sortConfig, overtimeApplications]);

  const sortData = (uiKey) => {
    const key = FIELD_MAP[uiKey] || uiKey;
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };
  const getSortIndicator = (uiKey) => { const key = FIELD_MAP[uiKey] || uiKey; return sortConfig.key === key ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""; };

 // --- Overtime Submit with Confirmation + Detailed Swals ---
const handleSubmit = async () => {
  // --- Required field validation ---
  const missing = [
    !otDate ? "OT Date" : null,
    !otType ? "OT Type" : null,
    !remarks.trim() ? "Remarks" : null,
    (overtimeHours === "" || isNaN(overtimeHours)) ? "OT Hours" : null,
  ].filter(Boolean);

  if (missing.length) {
    await Swal.fire({
      icon: "warning",
      title: "Incomplete Form",
      html: `Please fill all required fields.<br><small>Missing: <b>${missing.join(", ")}</b></small>`
    });
    return;
  }

  const hoursNum = Number(overtimeHours);
  if (hoursNum <= 0) {
    await Swal.fire({
      icon: "warning",
      title: "Invalid Hours",
      text: "Overtime hours must be greater than 0."
    });
    return;
  }

  // --- Normalize/derive fields ---
  const FMT = "YYYY-MM-DD";
  const d = dayjs(otDate, FMT, true);
  if (!d.isValid()) {
    await Swal.fire({ icon: "warning", title: "Invalid Date", text: "Please enter a valid OT date (YYYY-MM-DD)." });
    return;
  }

  // derive otDay if empty or mismatched
  const derivedDay = d.format("dddd");
  const finalOtDay = otDay && otDay.trim() ? otDay : derivedDay;

  // --- Payload ---
  const payload = {
    json_data: {
      empNo: user.empNo,
      detail: [{
        otDate,
        otDay: finalOtDay,
        otType,
        otRemarks: remarks.trim(),
        otHrs: hoursNum
      }],
    },
  };

  // --- Helpers for display ---
  const escapeHTML = (str = "") =>
    str.replace(/[&<>'"]/g, (tag) =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[tag] || tag)
    );

  // If you have a mapping (e.g., REG -> Regular OT, ND -> Night Diff), replace here.
  const display = {
    dateDay: d.format("dddd"),
    dateStr: d.format("MM/DD/YYYY"),
    typeText: otType,
    hours: hoursNum.toFixed(2),
  };

  // --- Step 1: Confirmation before save ---
  const confirm = await Swal.fire({
    icon: "question",
    title: "Confirm Overtime Application",
    html: `
      <div style="text-align:left;">
        <table style="width:100%; font-size:14px;">
          <tr><td style="width:140px;"><b>OT Type:</b></td><td>${escapeHTML(display.typeText)}</td></tr>
          <tr><td><b>Date:</b></td><td>${display.dateDay}, ${display.dateStr}</td></tr>
          <tr><td><b>Hours:</b></td><td>${display.hours}</td></tr>
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

  if (!confirm.isConfirmed) return;

  // --- Step 2: Save ---
  try {
    const res = await fetch(API_ENDPOINTS.saveOvertimeApplication, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let j;
    try { j = await res.json(); } catch { /* ignore */ }

    if (!res.ok || j?.status !== "success") {
      await Swal.fire({
        icon: "error",
        title: "Failed!",
        text: (j && j.message) || "Failed to submit overtime. Please try again."
      });
      return;
    }

    // --- Step 3: Success details ---
    await Swal.fire({
      icon: "success",
      title: '<span style="font-size:18px; font-weight:600;">Overtime Application Submitted</span>',
      html: `
        <div style="text-align:left;">
          <table style="width:100%; font-size:14px;">
            <tr><td style="width:140px;"><b>OT Type:</b></td><td>${escapeHTML(display.typeText)}</td></tr>
            <tr><td><b>Date:</b></td><td>${display.dateDay}, ${display.dateStr}</td></tr>
            <tr><td><b>Hours:</b></td><td>${display.hours}</td></tr>
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

    // --- Reset + Refresh (same as your current logic) ---
    setOTDate("");
    setOtDay("");
    setOvertimeHours("");
    setRemarks("");
    setOtType("REG");

    const r = await fetch(API_ENDPOINTS.fetchOvertimeApplications, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        EMP_NO: user.empNo,
        START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
        END_DATE: "2099-12-31"
      })
    });

    const jj = await r.json();
    const rows = jj?.success && jj.data?.length ? JSON.parse(jj.data[0].result || "[]") : [];
    setOvertimeApplications(rows);
    setFilteredApplications(rows);

  } catch (e) {
    console.error(e);
    await Swal.fire({
      icon: "error",
      title: "Error!",
      text: e.message || "An error occurred while submitting."
    });
  }
};


const getStamp = (r) =>
  r?.otStamp || r?.OT_STAMP || r?.stamp || r?.Stamp || r?.guid || r?.OT_STAMP_ID || null;

const cancelApplication = async (entry) => {
  if ((entry?.otStatus || "") !== "Pending") return;

  const otStamp = getStamp(entry);
  if (!otStamp) {
    await Swal.fire({
      title: "Missing identifier",
      text: "Cannot cancel: otStamp was not found in this row.",
      icon: "error",
    });
    return;
  }

  const conf = await Swal.fire({
    title: "Cancel this application?",
    text: "This will mark your pending request as cancelled.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes",
    cancelButtonText: "No",
    customClass: {
      popup: "swal-sm-popup",
      title: "swal-sm-title",
      confirmButton: "swal-sm-confirm",
      cancelButton: "swal-sm-cancel",
    },
  });
  if (!conf.isConfirmed) return;

  try {
    const payload = {
      json_data: {
        empNo: user.empNo,
        otStamp, // <- EXACTLY what your API expects
      },
    };

    const res = await fetch(API_ENDPOINTS.cancelOvertimeApplication, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.status !== "success") {
      throw new Error(j?.message || "Cancel failed");
    }

    await Swal.fire({ title: "Cancelled", text: "Your overtime application was cancelled.", icon: "success" });
    await refreshOvertimeList(); // call your existing fetch logic
  } catch (e) {
    await Swal.fire({ title: "Error", text: e.message, icon: "error" });
  }
};

  // pagination slices
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage) || 1;
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord);

  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[200px] mt-[80px] p-2 sm:p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        {/* Header */}
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">My Overtime Applications</h1>
        </div>

        {/* Form */}
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
              <label className="block font-semibold mb-1">Date of Overtime</label>
              <div className="relative">
                <input
                  type="date"
                  value={otDate}
                  onChange={(e) => setOTDate(e.target.value)}
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
            </div>
            
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Number of Hours</span>
              <input type="number" className="w-full p-2 border rounded" min="0" step="0.5" value={overtimeHours} onChange={(e) => { const v = parseFloat(e.target.value); setOvertimeHours(isNaN(v) || v < 0 ? 0 : v); }} placeholder="Enter Overtime hours" />
            </div>
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Overtime Type</span>
              <select className="w-full p-2 border rounded" value={otType} onChange={(e) => setOtType(e.target.value)}>
                <option value="">Select Overtime Type</option>
                <option value="REG">Regular Overtime</option>
                <option value="HOL">Holiday</option>
                <option value="RD">Rest Day</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows="4" className="w-full p-2 border rounded" placeholder="Enter Remarks" />
          </div>

          <div className="mt-4 flex justify-center">
            <button className="bg-blue-800 text-white px-12 py-2 rounded-md hover:bg-blue-700" onClick={handleSubmit}>Submit</button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 bg-white p-4 shadow-md rounded-lg">
          <h2 className="text-base font-semibold">Filter Overtime Applications</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <div className="relative">
            <input
              type="date"
              value={searchFields.otDateStart}
              onChange={(e) => setSearchFields((p) => ({ ...p, otDateStart: e.target.value }))}
              className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
            />
          </div>
          <div className="relative">
            <input
              type="date"
              value={searchFields.otDateEnd}
              onChange={(e) => setSearchFields((p) => ({ ...p, otDateEnd: e.target.value }))}
              min={searchFields.otDateStart}
              className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
            />
          </div>        
          <select value={searchFields.otType} onChange={(e) => setSearchFields((p) => ({ ...p, otType: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm bg-white">
            <option value="">All Overtime Types</option>
            {typeOptions.map((t) => (<option key={t} value={t}>{getOvertimeTypeLabel(t)}</option>))}
          </select>
          <select value={searchFields.otStatus} onChange={(e) => setSearchFields((p) => ({ ...p, otStatus: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm bg-white">
            <option value="">All Status</option>
            {statusOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        </div>

        {/* History */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base font-semibold">Overtime Application History</h2>
            <div className="inline-flex rounded-lg border overflow-hidden self-start">
              <button className={`px-8 py-2 text-sm ${viewMode === "card" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("card")}>Card</button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "accordion" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("accordion")}>Accordion</button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "table" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("table")}>Table</button>
            </div>
          </div>
          {error && <p className="text-red-500 text-center mt-2">{error}</p>}

          {/* CARD VIEW */}
          {viewMode === "card" && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentRecords.length ? currentRecords.map((entry, idx) => {
                const statusClass = entry.otStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : entry.otStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : entry.otStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
                return (
                  <div key={idx} className="border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm md:text-base">{dayjs(entry.otDate).format("MM/DD/YYYY")}</div>
                      <span className={`inline-flex justify-center items-center text-sm w-28 py-1 rounded-lg ${statusClass}`}>{entry.otStatus || "N/A"}</span>
                    </div>
                    <div className="space-y-1 text-[12px] md:text-sm">
                      <div className="flex justify-between"><span className="text-gray-500 font-semibold">Hours</span><span className="font-medium">{entry.otHrs} hr(s)</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 font-semibold">Type</span><span className="font-medium">{getOvertimeTypeLabel(entry.otType)}</span></div>
                      <div className="mt-2"><div className="text-gray-500 font-semibold">Employee Remarks:</div><div className="font-normal break-words text-black">{entry.otRemarks || "N/A"}</div></div>
                      <div className="mt-2"><div className="text-gray-500 font-semibold">Approver's Remarks:</div><div className="font-normal break-words text-blue-700">{entry.appRemarks || "N/A"}</div></div>
                    </div>
                    {entry?.otStatus === "Pending" && (
                      <div className="mt-3 text-right">
                        <button className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelApplication(entry)}>Cancel</button>
                      </div>
                    )}
                  </div>
                );
              }) : (<div className="col-span-full text-center text-gray-500 py-6">No overtime applications found.</div>)}
            </div>
          )}

          {/* ACCORDION VIEW */}
          {viewMode === "accordion" && (
            <div className="mt-4 divide-y border rounded-lg">
              {currentRecords.length ? currentRecords.map((entry, idx) => {
                const statusClass = entry.otStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : entry.otStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : entry.otStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
                return (
                  <details key={idx} className="group p-2 text-[12px] md:text-sm">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <div className="font-medium">{dayjs(entry.otDate).format("MM/DD/YYYY")} • {entry.otHrs} hr(s) • {getOvertimeTypeLabel(entry.otType)}</div>
                      <span className={`inline-flex justify-center items-center w-28 py-1 rounded-lg ${statusClass}`}>{entry.otStatus || "N/A"}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <div><div className="text-gray-500 font-semibold">Remarks</div><div>{entry.otRemarks || "N/A"}</div></div>
                      <div><div className="text-gray-500 font-semibold">Approver's Remarks</div><div className="text-blue-800">{entry.appRemarks || "N/A"}</div></div>
                      {entry?.otStatus === "Pending" && (
                        <div className="pt-2 text-right"><button className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelApplication(entry)}>Cancel</button></div>
                      )}
                    </div>
                  </details>
                );
              }) : (<div className="text-center text-gray-500 py-6">No overtime applications found.</div>)}
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === "table" && (
            <div className="w-full overflow-x-auto mt-4 rounded-lg">
              <table className="min-w-[900px] w-full text-sm text-center border ">
                <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm">
                  <tr>
                    {[{ key: "date", label: "OT Date" }, { key: "durationHours", label: "Duration" }, { key: "type", label: "Overtime Type" }, { key: "remark", label: "Remarks" }, { key: "appRemarks", label: "Approver's Remarks" }, { key: "status", label: "Status" }, { key: "actions", label: "Actions" }].map(({ key, label }) => (
                      <th key={key} className="py-2 px-3 whitespace-nowrap cursor-pointer" onClick={() => key !== "actions" && sortData(key)}>
                        {label} {key !== "actions" ? getSortIndicator(key) : ""}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {/* <td className="px-1 py-2 bg-white"><input type="date" value={searchFields.otDateStart} onChange={(e) => setSearchFields((p) => ({ ...p, otDateStart: e.target.value }))} className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800" /></td> */}
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <input
                        type="date"
                        value={searchFields.otDateStart}
                        onChange={(e) => setSearchFields((p) => ({ ...p, otDateStart: e.target.value }))}
                        className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-gray-100 select-none cursor-pointer"
                        placeholder="N/A..."
                        disabled
                        readonly
                      />
                    </td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <input className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-gray-100 select-none cursor-pointer" placeholder="N/A..." disabled readonly/>
                    </td>
                    <td className="px-1 py-2 bg-white"><select value={searchFields.otType} onChange={(e) => setSearchFields((p) => ({ ...p, otType: e.target.value }))} className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800"><option value="">All</option>{typeOptions.map((s) => (<option key={s} value={s}>{s}</option>))}</select></td>
                    <td className="px-1 py-2 bg-white"><input type="text" value={searchFields.otRemarks} onChange={(e) => setSearchFields((p) => ({ ...p, otRemarks: e.target.value }))} className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800" placeholder="Filter..." /></td>
                    <td className="px-1 py-2 bg-white"><input type="text" value={searchFields.appRemarks} onChange={(e) => setSearchFields((p) => ({ ...p, appRemarks: e.target.value }))} className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800" placeholder="Filter..." /></td>
                    <td className="px-1 py-2 bg-white"><select value={searchFields.otStatus} onChange={(e) => setSearchFields((p) => ({ ...p, otStatus: e.target.value }))} className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-white"><option value="">All</option>{statusOptions.map((s) => (<option key={s} value={s}>{s}</option>))}</select></td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <input className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-gray-100 select-none cursor-pointer" placeholder="N/A..." disabled readonly/>
                    </td>
                  </tr>
                </thead>
                <tbody className="global-tbody">
                  {currentRecords.length ? currentRecords.map((entry, i) => {
                const statusClass = entry.otStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : entry.otStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : entry.otStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
                    return (
                      <tr key={i} className="global-tr">
                        <td className="global-td whitespace-nowrap">{dayjs(entry.otDate).format("MM/DD/YYYY")}</td>
                        <td className="global-td whitespace-nowrap text-right">{entry.otHrs} hr(s)</td>
                        <td className="global-td whitespace-nowrap text-left">{getOvertimeTypeLabel(entry.otType)}</td>
                        <td className="global-td text-left max-w-[240px] truncate" title={entry.otRemarks || "N/A"}>{entry.otRemarks || "N/A"}</td>
                        <td className="global-td text-left max-w-[240px] truncate" title={entry.appRemarks || "N/A"}>{entry.appRemarks || "N/A"}</td>
                        <td className="global-td text-center whitespace-nowrap"><span className={`inline-flex justify-center items-center text-xs w-28 py-1 rounded-lg ${statusClass}`}>{entry.otStatus || "N/A"}</span></td>
                        <td className="global-td text-center whitespace-nowrap">
                          {entry?.otStatus === "Pending" ? (
                            <button className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelApplication(entry)}>Cancel</button>
                          ) : ("—")}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="7" className="px-4 py-6 text-center text-gray-500">No overtime applications found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-between items-center mt-2 pt-2">
            <div className="text-xs text-gray-600">Showing <b>{Math.min(indexOfFirstRecord + 1, filteredApplications.length)}-{Math.min(indexOfLastRecord, filteredApplications.length)}</b> of {filteredApplications.length} entries</div>
            <div className="flex items-center text-sm border rounded-lg overflow-hidden">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border-r hover:bg-gray-100 disabled:text-gray-400">&lt;</button>
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1 border-r ${currentPage === i + 1 ? "bg-blue-800 text-white" : "hover:bg-gray-100"}`}>{i + 1}</button>
              ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 hover:bg-gray-100 disabled:text-gray-400">&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OvertimeApplication;
