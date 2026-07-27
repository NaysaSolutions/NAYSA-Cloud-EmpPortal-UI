import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import OBReview from "./OBReview.jsx";
import API_ENDPOINTS from "@/apiConfig.jsx";
import Swal from "sweetalert2";
import { cancelApprovedRecord, sendApprovalDecision } from "./approvalBatchUtils";
import { applicationFileDate, approvalRemarks, approvalUser, approvalDateTime, approvalLabels } from "./approvalDisplayUtils";

// ---- Shared UI helpers (same as OT/Leave) -----------------------------------
const badgeClass = (status) => {
  const base =
    "inline-flex justify-center items-center text-xs w-[100px] py-1.5 rounded-xl font-semibold";
  switch ((status || "").toLowerCase()) {
    case "approved":
      return `${base} bg-blue-100 text-blue-700`;
    case "disapproved":
      return `${base} bg-red-100 text-red-700`;
    case "pending":
      return `${base} bg-amber-100 text-amber-700`;
    case "cancelled":
      return `${base} bg-gray-200 text-gray-700`;
    default:
      return `${base} bg-slate-100 text-slate-700`;
  }
};

const CancelClass = "mt-2 inline-flex justify-center items-center text-xs w-[100px] py-1.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors";
const DisapproveClass = "inline-flex justify-center items-center text-xs w-[100px] py-2 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const ApproveClass = "inline-flex justify-center items-center text-xs w-[100px] py-2 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const CancelApprovalClass = "self-start rounded-xl font-semibold bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const ReviewClass = "text-[12px] bg-blue-600 font-semibold text-white w-[100px] py-1 sm:py-0.5 rounded-xl hover:bg-blue-700 transition-colors";
const ClearFilterClass = "inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors";

const Labeled = ({ label, children }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <div className="text-[13px] sm:text-sm font-medium text-slate-800">
      {children}
    </div>
  </div>
);

// Small inline icons so we don't add a new dependency
const SearchIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const XIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const FilterIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

// -----------------------------------------------------------------------------

const OfficialBusinessApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingOBs, setPendingOBs] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedOB, setSelectedOB] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPending, setSelectedPending] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);

  // ---- Filters ----------------------------------------------------------
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");

  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [pendingSort, setPendingSort] = useState({ key: "", direction: "asc" });
  const [historySort, setHistorySort] = useState({ key: "", direction: "asc" });

  const fetchOBApprovals = async () => {
    try {
      if (!user?.empNo) return;
      setLoading(true);
      setError(null);

      const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

      const response = await fetch(
        API_ENDPOINTS.approvedOfficialBusinessHistory,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: startDate,
            END_DATE: "2030-01-01",
          }),
        }
      );

      const data = await response.json();
      if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
        const parsed = JSON.parse(data.data[0].result || "[]");

        const seen = new Set();
        const unique = parsed.filter((r) => {
          const key = r.obStamp || `${r.empname}-${r.obstart}-${r.obend}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const pending = unique.filter((r) => (r.obstatus || "") === "Pending");
        const nonPending = unique.filter((r) => (r.obstatus || "") !== "Pending");

        setPendingOBs(pending);
        setHistory(nonPending);
      } else {
        setPendingOBs([]);
        setHistory([]);
      }
    } catch (err) {
      console.error("Error fetching OB approvals:", err);
      setError("An error occurred while fetching OB approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOBApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empNo]);

  const handleReviewClick = (ob) => {
    setSelectedOB(ob);
    setShowModal(true);
  };

  const isApproved = (row) => (row?.obstatus || "").toLowerCase() === "approved";
  const toggle = (setter, index) => setter((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);

  const runBatch = async (rows, indexes, action) => {
    if (!indexes.length) return;
    const label = action === "cancel" ? "cancel" : action === "approve" ? "approve" : "disapprove";
    const confirm = await Swal.fire({ title: `${label[0].toUpperCase()}${label.slice(1)} selected?`, text: `${label} ${indexes.length} official business record(s)?`, icon: "question", showCancelButton: true, confirmButtonColor: action === "approve" ? "#2563eb" : "#dc2626" });
    if (!confirm.isConfirmed) return;
    try {
      for (const index of indexes) {
        const row = rows[index];
        if (action === "cancel") await cancelApprovedRecord({ type: "ob", row });
        else await sendApprovalDecision({ type: "ob", row, appStat: action === "approve" ? 1 : 0, userEmpNo: user.empNo });
      }
      setSelectedPending([]); setSelectedHistory([]); await fetchOBApprovals();
      Swal.fire({ title: "Success", text: `Selected records were ${label}d.`, icon: "success" });
    } catch (err) { Swal.fire({ title: "Error", text: err.message, icon: "error" }); }
  };

  // ---- Filtering logic ---------------------------------------------------
  const matchesDateRange = (row, from, to) => {
    if (!from && !to) return true;
    const start = dayjs(row.obstart);
    const end = dayjs(row.obend);
    if (from && end.isBefore(dayjs(from), "day")) return false;
    if (to && start.isAfter(dayjs(to), "day")) return false;
    return true;
  };

  const sortValue = (row, key) => {
    if (key === "fileDate") return row?.fileDate ?? row?.filedate ?? row?.FILE_DATE ?? row?.file_date ?? "";
    if (key === "employee") return row?.empname ?? "";
    if (key === "duration") return Number(row?.duration) || 0;
    if (key === "status") return row?.obstatus ?? "";
    return row?.[key] ?? "";
  };

  const sortRows = (rows, config) => {
    if (!config.key) return rows;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, config.key);
      const bv = sortValue(b, config.key);
      const numeric = config.key === "duration" || config.key === "fileDate" || config.key === "obstart" || config.key === "obend";
      const comparison = numeric
        ? (config.key === "duration" ? av - bv : dayjs(av).valueOf() - dayjs(bv).valueOf())
        : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
      return comparison * (config.direction === "asc" ? 1 : -1);
    });
  };

  const toggleSort = (setter, current, key) => setter({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" });
  const sortIndicator = (config, key) => config.key === key ? (config.direction === "asc" ? " ↑" : " ↓") : "";

  const filteredPendingOBs = useMemo(() => {
    const q = pendingSearch.trim().toLowerCase();
    return sortRows(pendingOBs.filter((ob) => {
      const matchesSearch = !q || (ob.empname || "").toLowerCase().includes(q) || (ob.obRemarks || "").toLowerCase().includes(q);
      return matchesSearch && matchesDateRange(ob, pendingFrom, pendingTo);
    }), pendingSort);
  }, [pendingOBs, pendingSearch, pendingFrom, pendingTo, pendingSort]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return sortRows(history.filter((rec) => {
      const matchesSearch = !q || (rec.empname || "").toLowerCase().includes(q) || (rec.obRemarks || "").toLowerCase().includes(q);
      const matchesStatus = historyStatus === "all" || (rec.obstatus || "").toLowerCase() === historyStatus;
      return matchesSearch && matchesStatus && matchesDateRange(rec, historyFrom, historyTo);
    }), historySort);
  }, [history, historySearch, historyStatus, historyFrom, historyTo, historySort]);

  // Reset selections whenever the underlying filtered set changes shape,
  // so stale indices never get sent to runBatch.
  useEffect(() => { setSelectedPending([]); }, [pendingSearch, pendingFrom, pendingTo, pendingOBs, pendingSort]);
  useEffect(() => { setSelectedHistory([]); }, [historySearch, historyStatus, historyFrom, historyTo, history, historySort]);

  const pendingFiltersActive = pendingSearch || pendingFrom || pendingTo;
  const historyFiltersActive = historySearch || historyStatus !== "all" || historyFrom || historyTo;

  const clearPendingFilters = () => { setPendingSearch(""); setPendingFrom(""); setPendingTo(""); };
  const clearHistoryFilters = () => { setHistorySearch(""); setHistoryStatus("all"); setHistoryFrom(""); setHistoryTo(""); };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Official Business Approval</h1>
        </div>

        {/* PENDING */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-xl">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              Pending Official Business Applications
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredPendingOBs.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={filteredPendingOBs.length > 0 && selectedPending.length === filteredPendingOBs.length} onChange={() => setSelectedPending(selectedPending.length === filteredPendingOBs.length ? [] : filteredPendingOBs.map((_, i) => i))} /> Select all</label>
              <button disabled={!selectedPending.length} onClick={() => runBatch(filteredPendingOBs, selectedPending, "disapprove")} className={DisapproveClass}>Disapprove</button>
              <button disabled={!selectedPending.length} onClick={() => runBatch(filteredPendingOBs, selectedPending, "approve")} className={ApproveClass}>Approve</button>
            </div>
          </div>

          {/* Filter bar */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              <FilterIcon className="w-3.5 h-3.5" /> Filters
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                placeholder="Search employee or remarks..."
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">From</span>
              <input type="date" value={pendingFrom} onChange={(e) => setPendingFrom(e.target.value)} className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" />
              <span className="text-slate-500">To</span>
              <input type="date" value={pendingTo} onChange={(e) => setPendingTo(e.target.value)} className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" />
            </div>
            {pendingFiltersActive && (
              <button onClick={clearPendingFilters} className={ClearFilterClass}>
                <XIcon className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {error && <p className="text-red-500 text-center">{error}</p>}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {filteredPendingOBs.length > 0 ? (
              filteredPendingOBs.map((ob, idx) => (
                <details
                  key={`p-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">
                        {ob.empname}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(ob)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        OB Date: {dayjs(ob.obdate).format("MM/DD/YYYY")} – {ob.obday}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")} –{" "}
                        {dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Duration: {ob.duration} hr(s)
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-center text-xs gap-2">
                      <input aria-label={`Select ${ob.empname}`} type="checkbox" checked={selectedPending.includes(idx)} onChange={() => toggle(setSelectedPending, idx)} />
                      <span className={badgeClass(ob.obstatus)}>{ob.obstatus}</span>
                      <button
                        className={ReviewClass}
                        onClick={() => handleReviewClick(ob)}
                      >
                        Review
                      </button>
                    </div>
                    
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Remarks">{ob.obRemarks || "N/A"}</Labeled>
                  </div>
                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">
                {pendingFiltersActive ? "No results match your filters." : "No pending Official Business applications."}
              </div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-xl">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-center whitespace-nowrap"><input type="checkbox" checked={filteredPendingOBs.length > 0 && selectedPending.length === filteredPendingOBs.length} onChange={() => setSelectedPending(selectedPending.length === filteredPendingOBs.length ? [] : filteredPendingOBs.map((_, i) => i))} /></th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "fileDate")} className="global-th text-left whitespace-nowrap cursor-pointer">Filing Date{sortIndicator(pendingSort, "fileDate")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee Name{sortIndicator(pendingSort, "employee")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "obstart")} className="global-th text-left whitespace-nowrap cursor-pointer">Start{sortIndicator(pendingSort, "obstart")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "obend")} className="global-th text-left whitespace-nowrap cursor-pointer">End{sortIndicator(pendingSort, "obend")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "duration")} className="global-th text-right whitespace-nowrap cursor-pointer">Duration{sortIndicator(pendingSort, "duration")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "obRemarks")} className="global-th text-left whitespace-nowrap cursor-pointer">Remarks{sortIndicator(pendingSort, "obRemarks")}</th>
                  <th className="global-th text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {filteredPendingOBs.length > 0 ? (
                  filteredPendingOBs.map((ob, index) => (
                    <tr key={`p-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-center"><input type="checkbox" checked={selectedPending.includes(index)} onChange={() => toggle(setSelectedPending, index)} /></td>
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600"></div>
                        <div>{applicationFileDate(ob)}</div>
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {ob.empname}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")}
                      </td>                
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {ob.duration} hr(s)
                      </td>
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600"></div>
                        <div>{ob.obRemarks || "N/A"}</div>
                      </td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className={ReviewClass}
                          onClick={() => handleReviewClick(ob)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="8" className="p-2 text-center text-gray-500">
                      {pendingFiltersActive ? "No results match your filters." : "No pending Official Business applications."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-xl">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base sm:text-lg  font-bold flex items-center gap-2">
              Official Business Approval History
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredHistory.length}
              </span>
            </h2>
            <button disabled={!selectedHistory.length} onClick={() => runBatch(filteredHistory, selectedHistory, "cancel")} className={CancelApprovalClass}>
              Cancel Approved
            </button>
          </div>

          {/* Filter bar */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              <FilterIcon className="w-3.5 h-3.5" /> Filters
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search employee or remarks..."
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="disapproved">Disapproved</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">From</span>
              <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" />
              <span className="text-slate-500">To</span>
              <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" />
            </div>
            {historyFiltersActive && (
              <button onClick={clearHistoryFilters} className={ClearFilterClass}>
                <XIcon className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((rec, idx) => (
                <details
                  key={`h-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      
                      <span className="text-[12px] font-semibold text-slate-800">
                        {rec.empname}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(rec)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        OB Date: {dayjs(rec.obdate).format("MM/DD/YYYY")} – {rec.obday}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {dayjs(rec.obstart).format("MM/DD/YYYY hh:mm A")} –{" "}
                        {dayjs(rec.obend).format("MM/DD/YYYY hh:mm A")}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Duration: {rec.duration} hr(s)
                      </span>
                    </div>
                 
                    <div className="flex flex-col items-center text-xs gap-2">
                      {isApproved(rec) && <input aria-label={`Select ${rec.empname}`} type="checkbox" checked={selectedHistory.includes(idx)} onChange={() => toggle(setSelectedHistory, idx)} />}
                      <span className={badgeClass(rec.obstatus)}>{rec.obstatus}</span>
                    </div>

                  </summary>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Employee Remarks">{rec.obRemarks || "N/A"}</Labeled>
                    <Labeled label="Approver's Remarks">{approvalRemarks(rec) || "N/A"}</Labeled>
                    <Labeled label={approvalLabels(rec.obstatus).actor}>{approvalUser(rec) || "N/A"}</Labeled>
                    <Labeled label={approvalLabels(rec.obstatus).date}>{approvalDateTime(rec) || "N/A"}</Labeled>
                  </div>
                </details>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500">
                {historyFiltersActive ? "No results match your filters." : "No approved or disapproved records found."}
              </div>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-xl">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-center whitespace-nowrap"><input type="checkbox" checked={filteredHistory.filter(isApproved).length > 0 && selectedHistory.length === filteredHistory.filter(isApproved).length} onChange={() => { const approved = filteredHistory.map((r, i) => isApproved(r) ? i : null).filter((i) => i !== null); setSelectedHistory(selectedHistory.length === approved.length ? [] : approved); }} /></th>
                  {/* <th onClick={() => toggleSort(setHistorySort, historySort, "fileDate")} className="global-th text-left whitespace-nowrap cursor-pointer">Filing Date{sortIndicator(historySort, "fileDate")}</th> */}
                  <th onClick={() => toggleSort(setHistorySort, historySort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee Name{sortIndicator(historySort, "employee")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "duration")} className="global-th text-right whitespace-nowrap cursor-pointer">Duration{sortIndicator(historySort, "duration")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "obstart")} className="global-th text-left whitespace-nowrap cursor-pointer">Date{sortIndicator(historySort, "obstart")}</th>
                  {/* <th onClick={() => toggleSort(setHistorySort, historySort, "obend")} className="global-th text-left whitespace-nowrap cursor-pointer">End{sortIndicator(historySort, "obend")}</th> */}
                  <th onClick={() => toggleSort(setHistorySort, historySort, "obRemarks")} className="global-th text-left text-wrap min-w-[180px] cursor-pointer">Remarks{sortIndicator(historySort, "obRemarks")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "appRemarks")} className="global-th text-left text-wrap min-w-[180px] cursor-pointer">Approver's Remarks{sortIndicator(historySort, "appRemarks")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "status")} className="global-th text-center whitespace-nowrap cursor-pointer">Status{sortIndicator(historySort, "status")}</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((rec, index) => (
                    <tr key={`h-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-center">{isApproved(rec) && <input type="checkbox" checked={selectedHistory.includes(index)} onChange={() => toggle(setSelectedHistory, index)} />}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {rec.empname}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {rec.duration} hr(s)
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        <div className="text-xs text-slate-600 font-semibold">Filing Date: {dayjs(rec.fileDate).format("MM/DD/YYYY")} </div>
                        <div className="text-xs text-slate-600 font-medium">OB Date: {dayjs(rec.obdate).format("MM/DD/YYYY")} </div>
                        <div className="text-xs text-slate-600">{dayjs(rec.obstart).format("MM/DD/YYYY hh:mm A")}</div>
                        <div className="text-xs text-slate-600">{dayjs(rec.obend).format("MM/DD/YYYY hh:mm A")}</div>
                      </td>
                      
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600">{rec.obRemarks || "N/A"}</div>
                      </td>
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600 font-semibold">Approver's Remarks:</div>
                        <div className="text-xs text-slate-600">{approvalRemarks(rec) || "N/A"}</div>
                        <div className="text-xs text-slate-600 font-semibold">{approvalLabels(rec.obstatus).actor}:</div>
                        <div className="text-xs text-slate-600">{approvalUser(rec) || "N/A"}</div>
                        <div className="text-xs text-slate-600 font-semibold">{approvalLabels(rec.obstatus).date}:</div>
                        <div className="text-xs text-slate-600">{approvalDateTime(rec) || "N/A"}</div>
                      </td>
                      <td className="global-td-approval text-center">
                        <div className="flex flex-col items-center justify-center gap-1 whitespace-nowrap">
                          <span className={badgeClass(rec.obstatus)}>{rec.obstatus}</span>
                          {isApproved(rec) && <button onClick={() => runBatch(filteredHistory, [index], "cancel")} className={CancelClass}>Cancel</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="p-3 text-center text-gray-500">
                      {historyFiltersActive ? "No results match your filters." : "No approved or disapproved records found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OB REVIEW MODAL */}
      {showModal && selectedOB && (
        <OBReview
          obData={selectedOB}
          onClose={() => {
            setShowModal(false);
            setSelectedOB(null);
            fetchOBApprovals();
          }}
        />
      )}
    </div>
  );
};

export default OfficialBusinessApproval;
