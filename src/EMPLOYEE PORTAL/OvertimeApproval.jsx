import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import OvertimeReview from "./OvertimeReview";
import API_ENDPOINTS from "@/apiConfig.jsx";
import Swal from "sweetalert2";
import { cancelApprovedRecord, sendApprovalDecision } from "./approvalBatchUtils";
import { applicationFileDate, approvalUser, approvalDateTime, approvalRemarks, approvalLabels } from "./approvalDisplayUtils";


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

const Labeled = ({ label, children }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
    <div className="text-[13px] sm:text-sm font-medium text-slate-800">{children}</div>
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

const OvertimeApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingOvertime, setPendingOvertime] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [selectedOvertime, setSelectedOvertime] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPending, setSelectedPending] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [pendingSearch, setPendingSearch] = useState(""); const [pendingFrom, setPendingFrom] = useState(""); const [pendingTo, setPendingTo] = useState("");
  const [historySearch, setHistorySearch] = useState(""); const [historyStatus, setHistoryStatus] = useState("all"); const [historyFrom, setHistoryFrom] = useState(""); const [historyTo, setHistoryTo] = useState("");
  const [pendingSort, setPendingSort] = useState({ key: "", direction: "asc" }); const [historySort, setHistorySort] = useState({ key: "", direction: "asc" });

  const fetchOvertimeApprovals = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = dayjs().format("YYYY-MM-DD");
      const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

      // Pending
      const pendingResponse = await fetch(API_ENDPOINTS.OvertimeHistoryApplication, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: startDate,
          END_DATE: "2030-01-01",
        }),
      });

      const pendingText = await pendingResponse.text();
      let pendingResult = JSON.parse(pendingText);

      if (pendingResult.success && pendingResult.data.length > 0) {
        const allRecords = JSON.parse(pendingResult.data[0].result) || [];
        const pendingOnly = allRecords.filter((r) => r.otStatus === "Pending");
        setPendingOvertime(pendingOnly);
      } else {
        setPendingOvertime([]);
      }

      // History
      const historyResponse = await fetch(API_ENDPOINTS.approvedOvertimeHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo, START_DATE: startDate, END_DATE: today }),
      });

      const historyResult = await historyResponse.json();
      if (historyResult.success && historyResult.data.length > 0) {
        const parsed = JSON.parse(historyResult.data[0].result) || [];
        setHistory(parsed.filter((r) => r.otStatus !== "Pending"));
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Error fetching overtime approval data:", err);
      setError("An error occurred while fetching overtime approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.empNo) {
      fetchOvertimeApprovals();
    }
  }, [user?.empNo]);

  const handleReviewClick = (overtime) => {
    setSelectedOvertime(overtime);
    setShowModal(true);
  };

  const isApproved = (row) => (row?.otStatus || "").toLowerCase() === "approved";
  const toggle = (setter, index) => setter((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);
  const toggleAll = (rows, selected, setter) => setter(selected.length === rows.length ? [] : rows.map((_, i) => i));
  const runBatch = async (rows, indexes, action) => {
    if (!indexes.length) return;
    const label = action === "cancel" ? "cancel" : action === "approve" ? "approve" : "disapprove";
    const confirm = await Swal.fire({ title: `${label[0].toUpperCase()}${label.slice(1)} selected?`, text: `${label} ${indexes.length} overtime record(s)?`, icon: "question", showCancelButton: true, confirmButtonColor: action === "disapprove" || action === "cancel" ? "#dc2626" : "#2563eb" });
    if (!confirm.isConfirmed) return;
    try {
      for (const index of indexes) {
        const row = rows[index];
        if (action === "cancel") await cancelApprovedRecord({ type: "ot", row });
        else await sendApprovalDecision({ type: "ot", row, appStat: action === "approve" ? 1 : 0, userEmpNo: user.empNo });
      }
      setSelectedPending([]); setSelectedHistory([]);
      await fetchOvertimeApprovals();
      Swal.fire({ title: "Success", text: `Selected records were ${label}d.`, icon: "success" });
    } catch (err) { Swal.fire({ title: "Error", text: err.message, icon: "error" }); }
  };

  const matchesDateRange = (row, from, to) => { const date = dayjs(row.otDate); return (!from || !date.isBefore(dayjs(from), "day")) && (!to || !date.isAfter(dayjs(to), "day")); };
  const sortValue = (row, key) => key === "employee" ? row.empName : key === "hours" ? Number(row.otHrs) || 0 : key === "date" ? row.otDate : key === "status" ? row.otStatus : row[key] ?? "";
  const sortRows = (rows, config) => !config.key ? rows : [...rows].sort((a, b) => { const av = sortValue(a, config.key); const bv = sortValue(b, config.key); const comparison = config.key === "hours" ? av - bv : config.key === "date" ? dayjs(av).valueOf() - dayjs(bv).valueOf() : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }); return comparison * (config.direction === "asc" ? 1 : -1); });
  const toggleSort = (setter, current, key) => setter({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" });
  const sortIndicator = (config, key) => config.key === key ? (config.direction === "asc" ? " ↑" : " ↓") : "";
  const filteredPending = useMemo(() => sortRows(pendingOvertime.filter((row) => { const q = pendingSearch.trim().toLowerCase(); return (!q || `${row.empName} ${row.otRemarks}`.toLowerCase().includes(q)) && matchesDateRange(row, pendingFrom, pendingTo); }), pendingSort), [pendingOvertime, pendingSearch, pendingFrom, pendingTo, pendingSort]);
  const filteredHistory = useMemo(() => sortRows(history.filter((row) => { const q = historySearch.trim().toLowerCase(); return (!q || `${row.empName} ${row.otRemarks}`.toLowerCase().includes(q)) && (historyStatus === "all" || (row.otStatus || "").toLowerCase() === historyStatus) && matchesDateRange(row, historyFrom, historyTo); }), historySort), [history, historySearch, historyStatus, historyFrom, historyTo, historySort]);
  const clearPendingFilters = () => { setPendingSearch(""); setPendingFrom(""); setPendingTo(""); }; 
  const clearHistoryFilters = () => { setHistorySearch(""); setHistoryStatus("all"); setHistoryFrom(""); setHistoryTo(""); };
  useEffect(() => { setSelectedPending([]); }, [pendingSearch, pendingFrom, pendingTo, pendingSort, pendingOvertime]); useEffect(() => { setSelectedHistory([]); }, [historySearch, historyStatus, historyFrom, historyTo, historySort, history]);

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Overtime Approval</h1>
        </div>

        {/* Pending Overtime */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base sm:text-lg  font-bold flex items-center gap-2">
              Pending Overtime Applications
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredPending.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={filteredPending.length > 0 && selectedPending.length === filteredPending.length} onChange={() => toggleAll(filteredPending, selectedPending, setSelectedPending)} /> Select all</label>
              <button disabled={!selectedPending.length} onClick={() => runBatch(filteredPending, selectedPending, "disapprove")} className={DisapproveClass}>Disapprove</button>
              <button disabled={!selectedPending.length} onClick={() => runBatch(filteredPending, selectedPending, "approve")} className={ApproveClass}>Approve</button>
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
            {(pendingSearch || pendingFrom || pendingTo) && (
              <button onClick={clearPendingFilters} className={ClearFilterClass}>
                <XIcon className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {error && <p className="text-red-500 text-center">{error}</p>}

          {/* Loading State */}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {filteredPending.length > 0 ? (
              filteredPending.map((overtime, idx) => (
                <details
                  key={`p-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      
                      <span className="text-[12px] font-semibold text-slate-800">
                        {overtime.empName}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(overtime)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        OT Date: {dayjs(overtime.otDate).format("MM/DD/YYYY")}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        OT Type: {overtime.otDesc}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        OT Hrs: {overtime.appHrs} hr(s)
                      </span>
                      
                    </div>
                    <div className="mt-3 flex flex-col items-center text-xs gap-2">
                      <input aria-label={`Select ${overtime.empName}`} type="checkbox" checked={selectedPending.includes(idx)} onChange={() => toggle(setSelectedPending, idx)} />
                      <span className={badgeClass(overtime.otStatus)}>
                        {overtime.otStatus}
                      </span>
                      <button
                        className={ReviewClass}
                        onClick={() => handleReviewClick(overtime)}
                      >
                        Review
                      </button>
                    </div>

                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Remarks">{overtime.otRemarks || "N/A"}</Labeled>
                  </div>

                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">No pending overtime applications.</div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-xl ">
            <table className="min-w-full text-center text-sm lg:text-base border ">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-center whitespace-nowrap"><input type="checkbox" checked={filteredPending.length > 0 && selectedPending.length === filteredPending.length} onChange={() => toggleAll(filteredPending, selectedPending, setSelectedPending)} /></th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "fileDate")} className="global-th text-left whitespace-nowrap cursor-pointer">Filing Date{sortIndicator(pendingSort, "fileDate")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee Name{sortIndicator(pendingSort, "employee")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "date")} className="global-th text-left whitespace-nowrap cursor-pointer">OT Date{sortIndicator(pendingSort, "date")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "hours")} className="global-th text-right whitespace-nowrap cursor-pointer">No. of Hours{sortIndicator(pendingSort, "hours")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "otDesc")} className="global-th text-left whitespace-nowrap cursor-pointer">OT Type{sortIndicator(pendingSort, "otDesc")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "otRemarks")} className="global-th text-left whitespace-nowrap cursor-pointer">Remarks{sortIndicator(pendingSort, "otRemarks")}</th>
                  <th className="global-th text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {filteredPending.length > 0 ? (
                  filteredPending.map((overtime, index) => (
                    <tr key={`p-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-center"><input type="checkbox" checked={selectedPending.includes(index)} onChange={() => toggle(setSelectedPending, index)} /></td>
                      <td className="global-td-approval text-left whitespace-nowrap">{applicationFileDate(overtime)}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">{overtime.empName}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(overtime.otDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">{overtime.otHrs} hr(s)</td>
                      <td className="global-td-approval text-left whitespace-nowrap">{overtime.otDesc}</td>
                      <td className="global-td-approval text-left">{overtime.otRemarks || "N/A"}</td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className={ReviewClass}
                          onClick={() => handleReviewClick(overtime)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="6" className="p-2 text-center text-gray-500">
                      No pending overtime applications.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overtime Approval History */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base sm:text-lg  font-bold flex items-center gap-2">
              Overtime Approval History
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredHistory.length}
              </span>
            </h2>
            <button disabled={!selectedHistory.length} onClick={() => runBatch(filteredHistory, selectedHistory, "cancel")} className={CancelApprovalClass}>Cancel approved</button>
          </div>
          <div className="mb-4 flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:flex-wrap sm:items-center"><div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500"><FilterIcon className="h-3.5 w-3.5" /> Filters</div><div className="relative min-w-0 flex-1 sm:min-w-[180px]"><SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search employee or remarks..." className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" /></div><select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs sm:w-auto"><option value="all">All statuses</option><option value="approved">Approved</option><option value="disapproved">Disapproved</option><option value="cancelled">Cancelled</option></select><div className="grid w-full grid-cols-1 gap-2 text-xs sm:flex sm:w-auto sm:items-center sm:gap-1.5"><label className="flex items-center gap-1.5 text-slate-500">From<input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" /></label><label className="flex items-center gap-1.5 text-slate-500">To<input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" /></label></div>{(historySearch || historyFrom || historyTo || historyStatus !== "all") && <button onClick={clearHistoryFilters} className={ClearFilterClass}><XIcon className="h-3.5 w-3.5" /> Clear</button>}</div>

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((record, idx) => (
                <details
                  key={`h-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">

                    <div className="flex flex-col">
                      
                      <span className="text-[12px] font-semibold text-slate-800">
                        {record.empName}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(record)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        OT Date: {dayjs(record.otDate).format("MM/DD/YYYY")}
                      </span>                    
                      <span className="text-[10px] text-slate-500">
                        OT Type: {record.otDesc}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        OT Hrs: {record.appHrs} hr(s)
                      </span>

                    </div>      
                                  
                    <div className="flex flex-col items-center text-xs gap-2">
                      {isApproved(record) && <input aria-label={`Select ${record.empName}`} type="checkbox" checked={selectedHistory.includes(idx)} onChange={() => toggle(setSelectedHistory, idx)} />}
                      <span className={badgeClass(record.otStatus)}>{record.otStatus}</span>
                    </div>

                  </summary>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">                   
                    <Labeled label="Employee Remarks">{record.otRemarks || "N/A"}</Labeled>
                    <Labeled label="Approver's Remarks">{approvalRemarks(record)}</Labeled>
                    <Labeled label={approvalLabels(record.otStatus).actor}>{approvalUser(record)}</Labeled>
                    <Labeled label={approvalLabels(record.otStatus).date}>{approvalDateTime(record)}</Labeled>
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
                  <th className="global-th text-center whitespace-nowrap"><input type="checkbox" checked={filteredHistory.filter((r) => r.otStatus === "Approved").length > 0 && selectedHistory.length === filteredHistory.filter((r) => r.otStatus === "Approved").length} onChange={() => { const approved = filteredHistory.map((r, i) => r.otStatus === "Approved" ? i : null).filter((i) => i !== null); setSelectedHistory(selectedHistory.length === approved.length ? [] : approved); }} /></th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee Name{sortIndicator(historySort, "employee")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "date")} className="global-th text-left whitespace-nowrap cursor-pointer">OT Date{sortIndicator(historySort, "date")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "hours")} className="global-th text-right whitespace-nowrap cursor-pointer">Approved Hours{sortIndicator(historySort, "hours")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "otDesc")} className="global-th text-left whitespace-nowrap cursor-pointer">OT Type{sortIndicator(historySort, "otDesc")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "otRemarks")} className="global-th text-left whitespace-nowrap min-w-[160px]">Remarks{sortIndicator(historySort, "otRemarks")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "appRemarks")} className="global-th text-left whitespace-nowrap min-w-[160px]">Approver's Remarks{sortIndicator(historySort, "appRemarks")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "status")} className="global-th text-center whitespace-nowrap cursor-pointer">Status{sortIndicator(historySort, "status")}</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((record, index) => (
                    <tr key={`h-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-center">{record.otStatus === "Approved" && <input type="checkbox" checked={selectedHistory.includes(index)} onChange={() => toggle(setSelectedHistory, index)} />}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">{record.empName}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(record.otDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">{record.appHrs} hr(s)</td>
                      <td className="global-td-approval text-left whitespace-nowrap">{record.otDesc}</td>
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600 font-semibold">Filing Date: {applicationFileDate(record)}</div>
                        <div>{record.otRemarks || "N/A"}</div>
                      </td>
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600 font-semibold">Approver's Remarks:</div>
                        <div className="text-xs text-slate-600">{approvalRemarks(record) || "N/A"}</div>
                        <div className="text-xs text-slate-600 font-semibold">{approvalLabels(record.otStatus).actor}:</div>
                        <div className="text-xs text-slate-600">{approvalUser(record) || "N/A"}</div>
                        <div className="text-xs text-slate-600 font-semibold">{approvalLabels(record.otStatus).date}:</div>
                        <div className="text-xs text-slate-600">{approvalDateTime(record) || "N/A"}</div>
                      </td>
                      
                      <td className="global-td-approval text-center">
                        <div className="flex flex-col items-center justify-center gap-1 whitespace-nowrap">
                          <span className={badgeClass(record.otStatus)}>{record.otStatus}</span>
                          {isApproved(record) && <button onClick={() => runBatch(filteredHistory, [index], "cancel")} className={CancelClass}>Cancel</button>}
                        </div>
                      </td>
                      
                   
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-3 text-center text-gray-500">
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
          <OvertimeReview
            overtimeData={selectedOvertime}
            onClose={() => {
              setShowModal(false);
              fetchOvertimeApprovals();
            }}
            refreshData={fetchOvertimeApprovals}
          />
        )}
      </div>
    </div>
  );
};

export default OvertimeApproval;
