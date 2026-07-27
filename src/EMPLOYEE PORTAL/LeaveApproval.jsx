import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import LeaveReview from "./LeaveReview";
import API_ENDPOINTS from "@/apiConfig.jsx";
import Swal from "sweetalert2";
import { cancelApprovedRecord, sendApprovalDecision } from "./approvalBatchUtils";
import { applicationFileDate, approvalUser, approvalDateTime, approvalRemarks, approvalLabels } from "./approvalDisplayUtils";

// ---- Shared UI helpers (same look/feel as Overtime) -------------------------
const badgeClass = (status) => {
  const base =
    "inline-flex justify-center items-center text-xs w-[100px] py-1 rounded-xl font-semibold";
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

const SearchIcon = (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
const XIcon = (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>;
const FilterIcon = (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;

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

// -----------------------------------------------------------------------------

const LeaveApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPending, setSelectedPending] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [pendingSort, setPendingSort] = useState({ key: "", direction: "asc" });
  const [historySort, setHistorySort] = useState({ key: "", direction: "asc" });

  const fetchLeaveApprovals = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = dayjs().format("YYYY-MM-DD");
      const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

      // --- PENDING -----------------------------------------------------------
      // Prefer a "LeaveHistoryApplication" endpoint (mirrors OT) if you have it.
      // Fallback: use approvedLeaveHistory and filter "Pending".
      const pendingResponse = await fetch(
        API_ENDPOINTS.LeaveHistoryApplication ?? API_ENDPOINTS.LeaveHistoryApplication,
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

      const pendingText = await pendingResponse.text();
      let pendingResult = JSON.parse(pendingText);

      if (pendingResult.success && pendingResult.data?.length > 0) {
        const all = JSON.parse(pendingResult.data[0].result) || [];
        const pendingOnly = all.filter((r) => (r.leaveStatus || "") === "Pending");
        setPendingLeaves(pendingOnly);
      } else {
        setPendingLeaves([]);
      }

      // --- HISTORY (Approved / Disapproved / Cancelled) ----------------------
      const historyResponse = await fetch(API_ENDPOINTS.approvedLeaveHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: startDate,
          END_DATE: today,
        }),
      });

      const historyResult = await historyResponse.json();
      if (historyResult.success && historyResult.data?.length > 0) {
        const parsed = JSON.parse(historyResult.data[0].result) || [];
        setHistory(parsed.filter((r) => (r.leaveStatus || "") !== "Pending"));
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Error fetching leave approvals:", err);
      setError("An error occurred while fetching leave approvals.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (user?.empNo) fetchLeaveApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empNo]);

  const handleReviewClick = (leave) => {
    setSelectedLeave(leave);
    setShowModal(true);
  };

  const isApproved = (row) => (row?.leaveStatus || "").toLowerCase() === "approved";
  const toggle = (setter, index) => setter((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);
  const runBatch = async (rows, indexes, action) => {
    if (!indexes.length) return;
    const label = action === "cancel" ? "cancel" : action === "approve" ? "approve" : "disapprove";
    const confirm = await Swal.fire({ title: `${label[0].toUpperCase()}${label.slice(1)} selected?`, text: `${label} ${indexes.length} leave record(s)?`, icon: "question", showCancelButton: true, confirmButtonColor: action === "approve" ? "#2563eb" : "#dc2626" });
    if (!confirm.isConfirmed) return;
    try {
      for (const index of indexes) {
        const row = rows[index];
        if (action === "cancel") await cancelApprovedRecord({ type: "leave", row });
        else await sendApprovalDecision({ type: "leave", row, appStat: action === "approve" ? 1 : 0, userEmpNo: user.empNo });
      }
      setSelectedPending([]); setSelectedHistory([]); await fetchLeaveApprovals();
      Swal.fire({ title: "Success", text: `Selected records were ${label}d.`, icon: "success" });
    } catch (err) { Swal.fire({ title: "Error", text: err.message, icon: "error" }); }
  };

  const matchesDateRange = (row, from, to) => {
    const start = dayjs(row.leaveStart);
    const end = dayjs(row.leaveEnd);
    return (!from || !end.isBefore(dayjs(from), "day")) && (!to || !start.isAfter(dayjs(to), "day"));
  };
  const sortValue = (row, key) => key === "employee" ? row.empName : key === "start" ? row.leaveStart : key === "end" ? row.leaveEnd : key === "days" || key === "hours" ? Number(row[key === "days" ? "leaveDays" : "leaveHrs"]) || 0 : key === "status" ? row.leaveStatus : row[key] ?? "";
  const sortRows = (rows, config) => !config.key ? rows : [...rows].sort((a, b) => {
    const av = sortValue(a, config.key); const bv = sortValue(b, config.key);
    const comparison = ["start", "end"].includes(config.key) ? dayjs(av).valueOf() - dayjs(bv).valueOf() : typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
    return comparison * (config.direction === "asc" ? 1 : -1);
  });
  const toggleSort = (setter, current, key) => setter({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" });
  const sortIndicator = (config, key) => config.key === key ? (config.direction === "asc" ? " ↑" : " ↓") : "";
  const filteredPending = useMemo(() => sortRows(pendingLeaves.filter((row) => {
    const q = pendingSearch.trim().toLowerCase();
    return (!q || `${row.empName} ${row.leaveRemarks}`.toLowerCase().includes(q)) && matchesDateRange(row, pendingFrom, pendingTo);
  }), pendingSort), [pendingLeaves, pendingSearch, pendingFrom, pendingTo, pendingSort]);
  const filteredHistory = useMemo(() => sortRows(history.filter((row) => {
    const q = historySearch.trim().toLowerCase();
    return (!q || `${row.empName} ${row.leaveRemarks}`.toLowerCase().includes(q)) && (historyStatus === "all" || (row.leaveStatus || "").toLowerCase() === historyStatus) && matchesDateRange(row, historyFrom, historyTo);
  }), historySort), [history, historySearch, historyStatus, historyFrom, historyTo, historySort]);
  const clearPendingFilters = () => { setPendingSearch(""); setPendingFrom(""); setPendingTo(""); };
  const clearHistoryFilters = () => { setHistorySearch(""); setHistoryStatus("all"); setHistoryFrom(""); setHistoryTo(""); };
  useEffect(() => { setSelectedPending([]); }, [pendingSearch, pendingFrom, pendingTo, pendingSort, pendingLeaves]);
  useEffect(() => { setSelectedHistory([]); }, [historySearch, historyStatus, historyFrom, historyTo, historySort, history]);

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Leave Approval</h1>
        </div>

        {/* PENDING */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Pending Leave Applications
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredPending.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={filteredPending.length > 0 && selectedPending.length === filteredPending.length} onChange={() => setSelectedPending(selectedPending.length === filteredPending.length ? [] : filteredPending.map((_, i) => i))} /> Select all</label>
              <button disabled={!selectedPending.length} onClick={() => runBatch(filteredPending, selectedPending, "disapprove")} className={DisapproveClass}>Disapprove</button>
              <button disabled={!selectedPending.length} onClick={() => runBatch(filteredPending, selectedPending, "approve")} className={ApproveClass}>Approve</button>
            </div>
          </div>
          <div className="mb-4 flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500"><FilterIcon className="h-3.5 w-3.5" /> Filters</div>
            <div className="relative min-w-0 flex-1 sm:min-w-[180px]"><SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} placeholder="Search employee or remarks..." className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
            <div className="grid w-full grid-cols-1 gap-2 text-xs sm:flex sm:w-auto sm:items-center sm:gap-1.5"><label className="flex items-center gap-1.5 text-slate-500">From<input type="date" value={pendingFrom} onChange={(e) => setPendingFrom(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" /></label><label className="flex items-center gap-1.5 text-slate-500">To<input type="date" value={pendingTo} onChange={(e) => setPendingTo(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" /></label></div>
            {(pendingSearch || pendingFrom || pendingTo) && <button onClick={clearPendingFilters} className={ClearFilterClass}><XIcon className="h-3.5 w-3.5" /> Clear</button>}
          </div>
          {error && <p className="text-red-500 text-center">{error}</p>}

          {/* Loading */}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {filteredPending.length > 0 ? (
              filteredPending.map((leave, idx) => (
                <details
                  key={`p-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">

                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">
                        {leave.empName}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(leave)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Leave Date: {dayjs(leave.leaveStart).format("MM/DD/YYYY")} –{" "}
                        {dayjs(leave.leaveEnd).format("MM/DD/YYYY")}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Leave Type: {leave.leaveCode}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Leave Days: {leave.leaveDays} day(s) / {leave.leaveHrs} hr(s)
                      </span>
                    </div>                    

                    <div className="mt-3 flex flex-col items-center text-xs gap-2">
                      <input aria-label={`Select ${leave.empName}`} type="checkbox" checked={selectedPending.includes(idx)} onChange={() => toggle(setSelectedPending, idx)} />
                      <span className={badgeClass(leave.leaveStatus)}>
                        {leave.leaveStatus}
                      </span>
                      <button
                        className={ReviewClass}
                        onClick={() => handleReviewClick(leave)}
                      >
                        Review
                      </button>
                    </div>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Remarks">
                      <div>{leave.leaveRemarks || "N/A"}</div>
                    </Labeled>
                  </div>
                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">
                No pending leave applications.
              </div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-xl">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-center whitespace-nowrap"><input type="checkbox" checked={filteredPending.length > 0 && selectedPending.length === filteredPending.length} onChange={() => setSelectedPending(selectedPending.length === filteredPending.length ? [] : filteredPending.map((_, i) => i))} /></th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "fileDate")} className="global-th text-left whitespace-nowrap cursor-pointer">Filing Date{sortIndicator(pendingSort, "fileDate")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee Name{sortIndicator(pendingSort, "employee")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "start")} className="global-th text-left whitespace-nowrap cursor-pointer">Leave Start{sortIndicator(pendingSort, "start")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "end")} className="global-th text-left whitespace-nowrap cursor-pointer">Leave End{sortIndicator(pendingSort, "end")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "days")} className="global-th text-right whitespace-nowrap cursor-pointer">Days{sortIndicator(pendingSort, "days")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "hours")} className="global-th text-right whitespace-nowrap cursor-pointer">Hours{sortIndicator(pendingSort, "hours")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "leaveCode")} className="global-th text-left whitespace-nowrap cursor-pointer">Leave Type{sortIndicator(pendingSort, "leaveCode")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "leaveRemarks")} className="global-th text-left whitespace-nowrap cursor-pointer">Remarks{sortIndicator(pendingSort, "leaveRemarks")}</th>
                  <th className="global-th text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {filteredPending.length > 0 ? (
                  filteredPending.map((leave, index) => (
                    <tr key={`p-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-center"><input type="checkbox" checked={selectedPending.includes(index)} onChange={() => toggle(setSelectedPending, index)} /></td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {applicationFileDate(leave)}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {leave.empName}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(leave.leaveStart).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(leave.leaveEnd).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {leave.leaveDays}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {leave.leaveHrs}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {leave.leaveCode}
                      </td>
                      <td className="global-td-approval text-left">
                        {leave.leaveRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className={ReviewClass}
                          onClick={() => handleReviewClick(leave)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="8" className="p-2 text-center text-gray-500">
                      No pending leave applications.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Leave Approval History
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredHistory.length}
              </span>
            </h2>
            <button disabled={!selectedHistory.length} onClick={() => runBatch(filteredHistory, selectedHistory, "cancel")} className={CancelApprovalClass}>Cancel approved</button>
          </div>
          <div className="mb-4 flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500"><FilterIcon className="h-3.5 w-3.5" /> Filters</div>
            <div className="relative min-w-0 flex-1 sm:min-w-[180px]"><SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search employee or remarks..." className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
            <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 sm:w-auto"><option value="all">All statuses</option><option value="approved">Approved</option><option value="disapproved">Disapproved</option><option value="cancelled">Cancelled</option></select>
            <div className="grid w-full grid-cols-1 gap-2 text-xs sm:flex sm:w-auto sm:items-center sm:gap-1.5"><label className="flex items-center gap-1.5 text-slate-500">From<input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" /></label><label className="flex items-center gap-1.5 text-slate-500">To<input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden" /></label></div>
            {(historySearch || historyFrom || historyTo || historyStatus !== "all") && <button onClick={clearHistoryFilters} className={ClearFilterClass}><XIcon className="h-3.5 w-3.5" /> Clear</button>}
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
                      <span className="text-[13px] font-semibold text-slate-800">
                        {rec.empName}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(rec)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Leave Date: {dayjs(rec.leaveStart).format("MM/DD/YYYY")} –{" "}
                        {dayjs(rec.leaveEnd).format("MM/DD/YYYY")}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Leave Type: {rec.leaveCode}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Leave Days: {rec.leaveDays} day(s) / {rec.leaveHrs} hr(s)
                      </span>
                    </div>                    

                    <div className="flex flex-col items-center text-xs gap-2">
                      {/* <input aria-label={`Select ${rec.empName}`} type="checkbox" checked={selectedHistory.includes(idx)} onChange={() => toggle(setSelectedHistory, idx)} /> */}
                       {isApproved(rec) && <input aria-label={`Select ${rec.empName}`} type="checkbox" checked={selectedHistory.includes(idx)} onChange={() => toggle(setSelectedHistory, idx)} />}
   
                      <span className={badgeClass(rec.leaveStatus)}>{rec.leaveStatus}</span>
                    </div>

                  </summary>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Employee Remarks">{rec.leaveRemarks || "N/A"}</Labeled>
                    <Labeled label="Approver's Remarks">{approvalRemarks(rec)}</Labeled>
                    <Labeled label={approvalLabels(rec.leaveStatus).actor}>{approvalUser(rec)}</Labeled>
                    <Labeled label={approvalLabels(rec.leaveStatus).date}>{approvalDateTime(rec)}</Labeled>
                  </div>
                </details>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500">
                No approved or disapproved records found.
              </div>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-xl">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-center whitespace-nowrap"><input type="checkbox" checked={filteredHistory.filter((r) => r.leaveStatus === "Approved").length > 0 && selectedHistory.length === filteredHistory.filter((r) => r.leaveStatus === "Approved").length} onChange={() => { const approved = filteredHistory.map((r, i) => r.leaveStatus === "Approved" ? i : null).filter((i) => i !== null); setSelectedHistory(selectedHistory.length === approved.length ? [] : approved); }} /></th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee Name{sortIndicator(historySort, "employee")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "start")} className="global-th text-left whitespace-nowrap cursor-pointer">Leave Start{sortIndicator(historySort, "start")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "end")} className="global-th text-left whitespace-nowrap cursor-pointer">Leave End{sortIndicator(historySort, "end")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "days")} className="global-th text-right whitespace-nowrap cursor-pointer">Days{sortIndicator(historySort, "days")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "hours")} className="global-th text-right whitespace-nowrap cursor-pointer">Hours{sortIndicator(historySort, "hours")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "leaveCode")} className="global-th text-left whitespace-nowrap cursor-pointer">Leave Type{sortIndicator(historySort, "leaveCode")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "leaveRemarks")} className="global-th text-left whitespace-nowrap cursor-pointer min-w-[150px]">Remarks{sortIndicator(historySort, "leaveRemarks")}</th>
                  <th className="global-th text-left whitespace-nowrap min-w-[160px]">Approver's Remarks</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "leaveStatus")} className="global-th text-center whitespace-nowrap cursor-pointer">Status{sortIndicator(historySort, "leaveStatus")}</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((rec, index) => (
                    <tr key={`h-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-center">{rec.leaveStatus === "Approved" && <input type="checkbox" checked={selectedHistory.includes(index)} onChange={() => toggle(setSelectedHistory, index)} />}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {rec.empName}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(rec.leaveStart).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(rec.leaveEnd).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {rec.leaveDays}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {rec.leaveHrs}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {rec.leaveCode}
                      </td>
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600 font-semibold">Filing Date: {applicationFileDate(rec)}</div>
                        <div>{rec.leaveRemarks || "N/A"}</div>
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
                        <span className={badgeClass(rec.leaveStatus)}>{rec.leaveStatus}</span>
                        {rec.leaveStatus === "Approved" && <button onClick={() => runBatch(filteredHistory, [index], "cancel")} className={CancelClass}>Cancel</button>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="p-3 text-center text-gray-500">
                      No approved or disapproved records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <LeaveReview
            leaveData={selectedLeave}
            onClose={() => {
              setShowModal(false);
              setSelectedLeave(null);
              // Refresh after action (approve/disapprove/cancel)
              fetchLeaveApprovals();
            }}
            refreshData={fetchLeaveApprovals}
          />
        )}
      </div>
    </div>
  );
};

export default LeaveApproval;
