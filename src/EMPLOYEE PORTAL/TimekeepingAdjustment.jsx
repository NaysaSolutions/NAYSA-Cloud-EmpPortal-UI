import React, { useEffect, useMemo, useState, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";


const TimekeepingAdjustment = () => {
  const { user } = useAuth();
  const { state } = useLocation();
  const record = state?.record || null;

  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [error, setError] = useState(null);

  // form
  const [dtrType, setDtrType] = useState("timeIn");
  const [shiftDate, setShiftDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [actualDateTime, setActualDateTime] = useState(dayjs().format("YYYY-MM-DDTHH:mm"));
  const [remarks, setRemarks] = useState("");

  // view / pagination
  const [viewMode, setViewMode] = useState("card");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // filters / sorting
  const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");
  const monthEnd = dayjs().endOf("month").format("YYYY-MM-DD");
  const [filters, setFilters] = useState({
    dateStart: monthStart,
    dateEnd: monthEnd,
    type: "",
    status: "",
    empRemarks: "",
    appRemarks: "",
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const hasId = (r) => r?.dtrId ?? r?.id ?? r?.requestId ?? null;

  const fetchHistory = async () => {
    try {
      const body = JSON.stringify({
        EMP_NO: user.empNo,
        START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
        END_DATE: dayjs().add(1, "year").format("YYYY-MM-DD"),
      });
      const res = await fetch(API_ENDPOINTS.getDTRAppHistory, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const j = await res.json();
      if (j?.success && Array.isArray(j.data) && j.data[0]?.result) {
        const rows = JSON.parse(j.data[0].result);
        setData(rows);
        setFiltered(rows);
      } else { setData([]); setFiltered([]); }
    } catch (e) { setError("Failed to load history."); console.error(e); }
  };

  useEffect(() => { if (user?.empNo) fetchHistory(); }, [user?.empNo]);

  // Auto update actualDateTime when shiftDate changes
  // useEffect(() => {
  //   const currentTime = dayjs(actualDateTime).format("HH:mm");
  //   const newDateTime = dayjs(`${shiftDate}T${currentTime}`).format("YYYY-MM-DDTHH:mm");
  //   setActualDateTime(newDateTime);
  // }, [shiftDate]); // runs every time shiftDate changes

  useEffect(() => {
    if (!shiftDate || !actualDateTime) return;
    const currentTime = dayjs(actualDateTime).format("HH:mm");
    setActualDateTime(dayjs(`${shiftDate}T${currentTime}`).format("YYYY-MM-DDTHH:mm"));
  }, [shiftDate]);

  // const handleSubmit = async () => {
  //   if (!shiftDate || !actualDateTime || !remarks.trim()) { await Swal.fire({ title: "Incomplete", text: "Please fill all fields.", icon: "warning" }); return; }
  //   const payload = { json_data: { empNo: user.empNo, detail: [{ shiftDate: dayjs(shiftDate).format("YYYY-MM-DD"), actualDatetime: dayjs(actualDateTime).format("YYYY-MM-DDTHH:mm:ss"), dtrRemarks: remarks, dtrType }] } };
  //   try {
  //     const res = await fetch(API_ENDPOINTS.upsertDTR, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  //     const ok = res.ok; let j = null; try { j = await res.json(); } catch {}
  //     if (!ok) throw new Error(j?.message || "Request failed");
  //     await Swal.fire({ title: "Submitted", text: "DTR adjustment submitted.", icon: "success" });
  //     setRemarks(""); setActualDateTime(dayjs().format("YYYY-MM-DDTHH:mm")); setDtrType("timeIn"); fetchHistory();
  //   } catch (e) { await Swal.fire({ title: "Error", text: e.message, icon: "error" }); }
  // };

  
  const handleSubmit = async () => {
  if (!shiftDate || !actualDateTime || !remarks.trim()) {
    const missing = [
      !shiftDate ? "Shift Date" : null,
      !actualDateTime ? "Actual Datetime" : null,
      !remarks.trim() ? "Remarks" : null,
    ].filter(Boolean).join(", ");

    await Swal.fire({
      icon: "warning",
      title: "Incomplete",
      html: `Please fill all required fields.<br><small>Missing: <b>${missing}</b></small>`
    });
    return;
  }

  const payload = {
    json_data: {
      empNo: user.empNo,
      detail: [{
        shiftDate: dayjs(shiftDate).format("YYYY-MM-DD"),
        actualDatetime: dayjs(actualDateTime).format("YYYY-MM-DDTHH:mm:ss"),
        dtrRemarks: remarks.trim(),
        dtrType
      }]
    }
  };

  // Safe HTML escape
  const escapeHTML = (str = "") =>
    str.replace(/[&<>'"]/g, tag =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      }[tag] || tag)
    );

  const display = {
    shiftDay: dayjs(shiftDate).format("dddd"),
    shiftDate: dayjs(shiftDate).format("MM/DD/YYYY"),
    actualDatetime: dayjs(actualDateTime).format("MM/DD/YYYY hh:mm A"),
    dtrTypeText: (dtrType || "")
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, c => c.toUpperCase()),
  };

  const typeColor = (() => {
    const t = (dtrType || "").toLowerCase();
    if (t.includes("in")) return "#16a34a";   // green
    if (t.includes("out")) return "#dc2626";  // red
    return "#334155";                         // default slate
  })();

  // --- Step 1: Confirmation Swal ---
  const confirm = await Swal.fire({
    icon: "question",
    title: "Confirm DTR Adjustment",
    html: `
      <div style="text-align:left;">
        <table style="width:100%; font-size:14px;">
          <tr>
            <td><b>DTR Type:</b></td>
            <td>
              <span style="
                display:inline-block; padding:2px 8px; border-radius:9999px;
                font-size:12px; font-weight:600; color:#fff; background:${typeColor};
              ">
                ${display.dtrTypeText}
              </span>
            </td>
          </tr>
          <tr>
            <td style="width:120px;"><b>Shift Day:</b></td>
            <td>${display.shiftDay}</td>
          </tr>
          <tr>
            <td><b>Shift Date:</b></td>
            <td>${display.shiftDate}</td>
          </tr>
          <tr>
            <td><b>Adjustment:</b></td>
            <td>${display.actualDatetime}</td>
          </tr>
          <tr>
            <td><b>Remarks:</b></td>
            <td>${escapeHTML(remarks.trim())}</td>
          </tr>
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

  if (!confirm.isConfirmed) return; // ❌ Stop if cancelled

  // --- Step 2: Proceed with Save ---
  try {
    const res = await fetch(API_ENDPOINTS.upsertDTR, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let body;
    try { body = await res.json(); } catch {
      try { body = { message: await res.text() }; } catch { body = null; }
    }

    if (!res.ok) throw new Error(body?.message || "Request failed");

    // --- Step 3: Success Swal with Details ---
    await Swal.fire({
      icon: "success",
      title: '<span style="font-size:18px; font-weight:600;">DTR Adjustment Submitted</span>',
      html: `
        <div style="text-align:left;">
          <table style="width:100%; font-size:14px;">
            <tr>
              <td><b>DTR Type:</b></td>
              <td>
                <span style="
                  display:inline-block; padding:2px 8px; border-radius:9999px;
                  font-size:12px; font-weight:600; color:#fff; background:${typeColor};
                ">
                  ${display.dtrTypeText}
                </span>
              </td>
            </tr>
            <tr>
              <td style="width:120px;"><b>Shift Day:</b></td>
              <td>${display.shiftDay}</td>
            </tr>
            <tr>
              <td><b>Shift Date:</b></td>
              <td>${display.shiftDate}</td>
            </tr>
            <tr>
              <td><b>Adjustment:</b></td>
              <td>${display.actualDatetime}</td>
            </tr>
            <tr>
              <td><b>Remarks:</b></td>
              <td>${escapeHTML(remarks.trim())}</td>
            </tr>
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

    // --- Step 4: Reset and Refresh ---
    setRemarks("");
    setActualDateTime(dayjs().format("YYYY-MM-DDTHH:mm"));
    setDtrType("timeIn");
    fetchHistory();

  } catch (e) {
    await Swal.fire({
      icon: "error",
      title: "Error",
      html: `
        <div style="text-align:left;">
          <p style="margin:0 0 6px;">${escapeHTML(e.message || "Something went wrong.")}</p>
          <details style="font-size:12px; opacity:.8;">
            <summary>Request Details</summary>
            <pre style="white-space:pre-wrap; margin-top:6px;">
shiftDate: ${payload.json_data.detail[0].shiftDate}
actualDatetime: ${payload.json_data.detail[0].actualDatetime}
dtrType: ${dtrType}
            </pre>
          </details>
        </div>
      `
    });
  }
};




  // CANCEL

  // Stamp helper for precise cancellation payload
  const getDtrStamp = (r) =>
  r?.dtrStamp || r?.DTR_STAMP || r?.stamp || r?.Stamp || r?.guid || null;


  const cancelApplication = async (row) => {
    if ((row?.dtrStatus || "") !== "Pending") return;

    const dtrStamp = getDtrStamp(row);
    if (!dtrStamp) {
      await Swal.fire({
        title: "Missing identifier",
        text: "Cannot cancel: dtrStamp was not found in this row.",
        icon: "error",
      });
      return;
    }

    const conf = await Swal.fire({
      title: "Cancel this application?",
      text: "This will mark your pending DTR adjustment as cancelled.",
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
      const res = await fetch(API_ENDPOINTS.cancelDTR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json_data: { empNo: user.empNo, dtrStamp },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.status !== "success") {
        throw new Error(j?.message || "Cancel failed");
      }

      await Swal.fire({
        title: "Cancelled",
        text: "Your DTR application was cancelled.",
        icon: "success",
      });
      // Reuse your existing loader
      fetchHistory();
    } catch (e) {
      await Swal.fire({ title: "Error", text: e.message, icon: "error" });
    }
  };


  // filter + sort
  useEffect(() => {
    let rows = [...data];
    const hasStart = !!filters.dateStart; const hasEnd = !!filters.dateEnd;
    if (hasStart || hasEnd) rows = rows.filter((r) => { const d = dayjs(r.dtrDate).format("YYYY-MM-DD"); return (!hasStart || d >= filters.dateStart) && (!hasEnd || d <= filters.dateEnd); });
    if (filters.type) rows = rows.filter((r) => (r?.dtrType || "").toLowerCase() === filters.type.toLowerCase());
    if (filters.status) rows = rows.filter((r) => (r?.dtrStatus || "") === filters.status);
    if (filters.empRemarks) rows = rows.filter((r) => String(r.dtrRemarks || "").toLowerCase().includes(filters.empRemarks.toLowerCase()));
    if (filters.appRemarks) rows = rows.filter((r) => String(r.appRemarks || "").toLowerCase().includes(filters.appRemarks.toLowerCase()));

    if (sortConfig.key) {
      const key = sortConfig.key; const dir = sortConfig.direction === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        if (key === "dtrDate") return (dayjs(a.dtrDate).valueOf() - dayjs(b.dtrDate).valueOf()) * dir;
        return String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * dir;
      });
    }

    setFiltered(rows); setCurrentPage(1);
  }, [filters, sortConfig, data]);

  // options
  const typeOptions = useMemo(() => Array.from(new Set(data.map((r) => r?.dtrType).filter(Boolean))).sort(), [data]);
  const statusOptions = useMemo(() => Array.from(new Set(data.map((r) => r?.dtrStatus?.trim()).filter(Boolean))).sort(), [data]);

  // pagination
  const totalPages = Math.ceil(filtered.length / recordsPerPage) || 1;
  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;
  const current = filtered.slice(indexOfFirst, indexOfLast);

  // helper: compose YYYY-MM-DDTHH:mm from date + HH:mm:ss
  const composeLocal = (dateStr, timeStr) =>
    dayjs(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DDTHH:mm");

  // Prefill when navigating from a row (missing IN/OUT)
  useEffect(() => {
    if (!record) return;

    // Shift date from record.date / r.dtrDate if present
    const sourceDate = record.date || record.dtrDate;
    if (sourceDate) {
      const sd = dayjs(sourceDate).format("YYYY-MM-DD");
      setShiftDate(sd);

      const missingIn = !record.time_in && !record.dtrTimeIn;   // support alt field names
      const missingOut = !record.time_out && !record.dtrTimeOut;

      // Prefer scheduled times if available
      const schedIn = record.sched_in || record.schedIn || "08:00:00";
      const schedOut = record.sched_out || record.schedOut || "17:00:00";

      if (missingIn && !missingOut) {
        setDtrType("timeIn");
        setActualDateTime(composeLocal(sd, schedIn));
      } else if (!missingIn && missingOut) {
        setDtrType("timeOut");
        setActualDateTime(composeLocal(sd, schedOut));
      } else if (missingIn && missingOut) {
        setDtrType("timeIn");
        setActualDateTime(composeLocal(sd, schedIn));
      } else {
        // If both exist (manual navigation), default to timeIn using recorded time if present
        const actualIn = record.time_in || record.dtrTimeIn || schedIn;
        setDtrType("timeIn");
        setActualDateTime(composeLocal(sd, actualIn));
      }
    }
  }, [record]);


  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="global-div-header-ui"><h1 className="global-div-headertext-ui">My Timekeeping Adjustments</h1></div>

      {/* FORM */}
      <div className="mt-4 bg-white p-4 sm:p-6 shadow-md rounded-lg text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="font-semibold mb-1">Type</label>
            <select className="w-full p-2 border rounded" value={dtrType} onChange={(e) => setDtrType(e.target.value)}>
              <option value="timeIn">Time In</option>
              <option value="timeOut">Time Out</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="block font-semibold mb-1">Shift Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
          </div>
          <div className="min-w-0">
            <label className="block font-semibold mb-1">Actual Date & Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={actualDateTime}
                  onChange={(e) => setActualDateTime(e.target.value)}
                  className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
                />
              </div>
          </div>
        </div>
        <div className="mt-6">
          <label className="font-semibold mb-1 block">Remarks</label>
          <textarea rows="4" className="w-full p-2 border rounded resize-none" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-center">
          <button className="bg-blue-800 text-white px-12 py-2 rounded-md hover:bg-blue-700" onClick={handleSubmit}>Submit</button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="mt-4 bg-white p-4 shadow-md rounded-lg">
        <h2 className="text-base font-semibold">Filter Timekeeping Adjustments</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <div className="relative">
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters((p) => ({ ...p, dateStart: e.target.value }))}
              className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
            />
          </div>
          <div className="relative">
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters((p) => ({ ...p, dateEnd: e.target.value }))}
              className="w-full min-w-0 text-sm h-10 px-3 pr-10 border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none"
            />
          </div>
        
        
        <select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm bg-white">
          <option value="">All Types</option>
          {typeOptions.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm bg-white">
          <option value="">All Status</option>
          {statusOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <input type="text" placeholder="Search remarks" value={filters.empRemarks} onChange={(e) => setFilters((p) => ({ ...p, empRemarks: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm" />
      </div>
      </div>

      {/* HISTORY */}
       <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold">Timekeeping Application History</h2>
          <div className="inline-flex rounded-lg border overflow-hidden">
            <button className={`px-8 py-2 text-sm ${viewMode === "card" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("card")}>Card</button>
            <button className={`px-8 py-2 text-sm border-l ${viewMode === "accordion" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("accordion")}>Accordion</button>
            <button className={`px-8 py-2 text-sm border-l ${viewMode === "table" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("table")}>Table</button>
          </div>
        </div>

        {/* CARD */}
        {viewMode === "card" && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {current.length ? current.map((r, i) => {
              const badge = r.dtrStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : r.dtrStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : r.dtrStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
              return (
                <div key={i} className="border rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{dayjs(r.dtrDate).format("MM/DD/YYYY")}</div>
                    <span className={`inline-flex justify-center items-center text-sm w-28 py-1 rounded-lg ${badge}`}>{r.dtrStatus || "N/A"}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500 font-semibold">Type</span><span className="font-medium">{r.dtrType}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 font-semibold">Actual</span><span className="font-medium">{dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm a")}</span></div>
                    <div className="mt-2"><div className="text-gray-500 font-semibold">Employee Remarks</div><div className="break-words">{r.dtrRemarks || "N/A"}</div></div>
                    <div className="mt-2"><div className="text-gray-500 font-semibold">Approver's Remarks</div><div className="text-blue-700">{r.appRemarks || "N/A"}</div></div>
                  </div>
                  {r?.dtrStatus === "Pending" && (
                    <div className="mt-3 text-right"><button className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelApplication(r)}>Cancel</button></div>
                  )}
                </div>
              );
            }) : (<div className="col-span-full text-center text-gray-500 py-6">No applications found.</div>)}
          </div>
        )}

        {/* ACCORDION */}
        {viewMode === "accordion" && (
          <div className="mt-4 divide-y border rounded-lg">
            {current.length ? current.map((r, i) => {
              const badge = r.dtrStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : r.dtrStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : r.dtrStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
              return (
                <details key={i} className="group p-2 text-sm">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="font-medium">{dayjs(r.dtrDate).format("MM/DD/YYYY")} • {r.dtrType} • {dayjs(r.dtrStart).format("hh:mm a")}</div>
                    <span className={`inline-flex justify-center items-center w-28 py-1 rounded-lg ${badge}`}>{r.dtrStatus || "N/A"}</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div><div className="text-gray-500 font-semibold">Remarks</div><div>{r.dtrRemarks || "N/A"}</div></div>
                    <div><div className="text-gray-500 font-semibold">Approver's Remarks</div><div className="text-blue-800">{r.appRemarks || "N/A"}</div></div>
                    {r?.dtrStatus === "Pending" && (<div className="pt-2 text-right"><button className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelApplication(r)}>Cancel</button></div>)}
                  </div>
                </details>
              );
            }) : (<div className="text-center text-gray-500 py-6">No applications found.</div>)}
          </div>
        )}

        {/* TABLE */}
        {viewMode === "table" && (
          <div className="w-full overflow-x-auto mt-4 rounded-lg">
            <table className="min-w-[900px] w-full text-sm text-center border">
              <thead className="sticky top-0 z-10 bg-blue-800 text-white">
                <tr>
                  {[{ key: "dtrDate", label: "Shift Date" }, { key: "dtrType", label: "Type" }, { key: "dtrStart", label: "Actual Time" }, { key: "dtrRemarks", label: "Remarks" }, { key: "appRemarks", label: "Approver's Remarks" }, { key: "dtrStatus", label: "Status" }, { key: "actions", label: "Actions" }].map(({ key, label }) => (
                    <th key={key} className="py-2 px-3 whitespace-nowrap cursor-pointer" onClick={() => key !== "actions" && setSortConfig((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" }))}>{label} {sortConfig.key === key ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}</th>
                  ))}
                </tr>
                <tr>
                  <td className="px-1 py-2 bg-white"><input type="date" value={filters.dateStart} onChange={(e) => setFilters((p) => ({ ...p, dateStart: e.target.value }))} className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800" /></td>
                  <td className="px-1 py-2 bg-white text-gray-800"><select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs bg-white"><option value="">All</option>{typeOptions.map((t) => (<option key={t} value={t}>{t}</option>))}</select></td>
                  <td className="px-1 py-2 bg-white"></td>
                  <td className="px-1 py-2 bg-white"><input type="text" value={filters.empRemarks} onChange={(e) => setFilters((p) => ({ ...p, empRemarks: e.target.value }))} className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs" placeholder="Filter..." /></td>
                  <td className="px-1 py-2 bg-white"><input type="text" value={filters.appRemarks} onChange={(e) => setFilters((p) => ({ ...p, appRemarks: e.target.value }))} className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs" placeholder="Filter..." /></td>
                  <td className="px-1 py-2 bg-white text-gray-800"><select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs bg-white"><option value="">All</option>{statusOptions.map((s) => (<option key={s} value={s}>{s}</option>))}</select></td>                   
                  <td className="px-1 py-2 bg-white"></td>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {current.length ? current.map((r, i) => {
              const badge = r.dtrStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : r.dtrStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : r.dtrStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
                  return (
                    <tr key={i} className="global-tr">
                      <td className="global-td whitespace-nowrap">{dayjs(r.dtrDate).format("MM/DD/YYYY")}</td>
                      <td className="global-td whitespace-nowrap">{r.dtrType}</td>
                      <td className="global-td whitespace-nowrap">{dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm a")}</td>
                      <td className="global-td text-left max-w-[240px] truncate" title={r.dtrRemarks || "N/A"}>{r.dtrRemarks || "N/A"}</td>
                      <td className="global-td text-left max-w-[240px] truncate" title={r.appRemarks || "N/A"}>{r.appRemarks || "N/A"}</td>
                      <td className="global-td text-center whitespace-nowrap"><span className={`inline-flex justify-center items-center text-xs w-28 py-1 rounded-lg ${badge}`}>{r.dtrStatus || "N/A"}</span></td>
                      <td className="global-td text-center whitespace-nowrap">{r?.dtrStatus === "Pending" ? (<button className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelApplication(r)}>Cancel</button>) : ("—")}</td>
                    </tr>
                  );
                }) : (<tr><td colSpan="7" className="px-4 py-6 text-center text-gray-500">No applications found.</td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        <div className="flex justify-between items-center mt-2 pt-2">
          <div className="text-xs text-gray-600">Showing <b>{Math.min(indexOfFirst + 1, filtered.length)}-{Math.min(indexOfLast, filtered.length)}</b> of {filtered.length} entries</div>
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
  );
};

export default TimekeepingAdjustment;
