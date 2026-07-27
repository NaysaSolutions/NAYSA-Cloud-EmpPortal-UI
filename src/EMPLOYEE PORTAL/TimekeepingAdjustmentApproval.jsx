import React, { useEffect, useMemo, useState, useRef } from "react";
import dayjs from "dayjs";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useAuth } from "./AuthContext.jsx";
import TimekeepingAdjustmentReview from "./TimekeepingAdjustmentReview.jsx";
import Swal from "sweetalert2";
import { cancelApprovedRecord, sendApprovalDecision } from "./approvalBatchUtils";
import { applicationFileDate, approvalUser, approvalDateTime, approvalRemarks, approvalLabels } from "./approvalDisplayUtils";

// ---- Shared UI helpers (same look/feel as OT/Leave/OB) ----------------------

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

const parseDtrRows = (payload) => {
  if (Array.isArray(payload)) return payload;

  const result = payload?.data?.[0]?.result;
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Unable to parse DTR approval result:", error, result);
      return [];
    }
  }

  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.result)) return payload.result;

  return [];
};

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

const TimekeepingAdjustmentApproval = () => {
  const { user } = useAuth();

  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedHistoryRows, setSelectedHistoryRows] = useState([]);

  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [pendingSort, setPendingSort] = useState({ key: "", direction: "asc" });
  const [historySort, setHistorySort] = useState({ key: "", direction: "asc" });

  const selectAllRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    try {
      if (!user?.empNo) return;
      setLoading(true);
      setError(null);

      // Pending
      const inqRes = await fetch(API_ENDPOINTS.getDTRApprInq, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo, STAT: "Pending" }),
      });
      const inq = await inqRes.json();
      const pendingRows = parseDtrRows(inq).filter(
        (r) => (r.dtrStatus || "").toLowerCase() === "pending"
      );
      console.log("Pending Rows:", pendingRows); // Debugging line  
      // History (non-pending)
      const histRes = await fetch(API_ENDPOINTS.getDTRApprHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
          END_DATE: dayjs().add(1, "year").format("YYYY-MM-DD"),
        }),
      });
      const hist = await histRes.json();
      const histRows = parseDtrRows(hist);

      setPending(pendingRows);
      
      setHistory(
        histRows.filter((r) => (r.dtrStatus || "").toLowerCase() !== "pending")
      );
    } catch (e) {
      console.error(e);
      setError("Failed to load approvals.");
      setPending([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empNo]);

  const openReview = (row) => {
    setSelected(row);
    setShowModal(true);
  };

  const isApproved = (row) => (row?.dtrStatus || "").toLowerCase() === "approved";
  const toggle = (setter, index) => setter((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);
  const toggleAll = (rows, selected, setter) => setter(selected.length === rows.length ? [] : rows.map((_, i) => i));
  const runBatch = async (rows, indexes, action) => {
    if (!indexes.length) return;
    const label = action === "cancel" ? "cancel" : action === "approve" ? "approve" : "disapprove";
    const confirm = await Swal.fire({
      title: `${label[0].toUpperCase()}${label.slice(1)} selected?`,
      text: `${label} ${indexes.length} DTR record(s)?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: action === "disapprove" || action === "cancel" ? "#dc2626" : "#2563eb",
    });
    if (!confirm.isConfirmed) return;
    try {
      for (const index of indexes) {
        const row = rows[index];
        if (action === "cancel") await cancelApprovedRecord({ type: "dtr", row });
        else await sendApprovalDecision({ type: "dtr", row, appStat: action === "approve" ? 1 : 0, userEmpNo: user.empNo });
      }
      setSelectedRows([]);
      setSelectedHistoryRows([]);
      await fetchAll();
      Swal.fire({ title: "Success", text: `Selected records were ${label}d.`, icon: "success" });
    } catch (err) {
      Swal.fire({ title: "Error", text: err.message, icon: "error" });
    }
  };

  const matchesDateRange = (row, from, to) => {
    const date = dayjs(row.dtrDate);
    return (!from || !date.isBefore(dayjs(from), "day")) && (!to || !date.isAfter(dayjs(to), "day"));
  };
  const sortValue = (row, key) => key === "employee" ? row.empname : key === "date" ? row.dtrDate : key === "actual" ? row.dtrStart : key === "status" ? row.dtrStatus : row[key] ?? "";
  const sortRows = (rows, config) => !config.key ? rows : [...rows].sort((a, b) => {
    const av = sortValue(a, config.key); const bv = sortValue(b, config.key);
    const comparison = ["date", "actual"].includes(config.key) ? dayjs(av).valueOf() - dayjs(bv).valueOf() : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
    return comparison * (config.direction === "asc" ? 1 : -1);
  });
  const toggleSort = (setter, current, key) => setter({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" });
  const sortIndicator = (config, key) => config.key === key ? (config.direction === "asc" ? " ↑" : " ↓") : "";
  const filteredPending = useMemo(() => sortRows(pending.filter((row) => {
    const q = pendingSearch.trim().toLowerCase();
    return (!q || `${row.empname} ${row.dtrType} ${row.dtrRemarks}`.toLowerCase().includes(q)) && matchesDateRange(row, pendingFrom, pendingTo);
  }), pendingSort), [pending, pendingSearch, pendingFrom, pendingTo, pendingSort]);
  const filteredHistory = useMemo(() => sortRows(history.filter((row) => {
    const q = historySearch.trim().toLowerCase();
    return (!q || `${row.empname} ${row.dtrType} ${row.dtrRemarks}`.toLowerCase().includes(q)) && (historyStatus === "all" || (row.dtrStatus || "").toLowerCase() === historyStatus) && matchesDateRange(row, historyFrom, historyTo);
  }), historySort), [history, historySearch, historyStatus, historyFrom, historyTo, historySort]);
  const clearPendingFilters = () => { setPendingSearch(""); setPendingFrom(""); setPendingTo(""); };
  const clearHistoryFilters = () => { setHistorySearch(""); setHistoryStatus("all"); setHistoryFrom(""); setHistoryTo(""); };
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedRows.length > 0 && selectedRows.length < filteredPending.length;
    }
  }, [selectedRows, filteredPending]);
  useEffect(() => setSelectedRows([]), [pendingSearch, pendingFrom, pendingTo, pendingSort, pending]);
  useEffect(() => setSelectedHistoryRows([]), [historySearch, historyStatus, historyFrom, historyTo, historySort, history]);


  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">
            Timekeeping Adjustment Approval
          </h1>
        </div>

        {/* PENDING */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Pending DTR Adjustments
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredPending.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2 text-xs md:hidden">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={filteredPending.length > 0 && selectedRows.length === filteredPending.length} onChange={() => toggleAll(filteredPending, selectedRows, setSelectedRows)} /> Select all</label>
              <button disabled={!selectedRows.length} onClick={() => runBatch(filteredPending, selectedRows, "disapprove")} className={DisapproveClass}>Disapprove</button>
              <button disabled={!selectedRows.length} onClick={() => runBatch(filteredPending, selectedRows, "approve")} className={ApproveClass}>Approve</button>
            </div>
          </div>
          <div className="mb-4 flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:flex-wrap sm:items-center"><div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500"><FilterIcon className="h-3.5 w-3.5" /> Filters</div><div className="relative min-w-0 flex-1 sm:min-w-[180px]"><SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} placeholder="Search employee, type, or remarks..." className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" /></div><div className="grid w-full grid-cols-1 gap-2 text-xs sm:flex sm:w-auto sm:items-center sm:gap-1.5"><label className="flex items-center gap-1.5 text-slate-500">From<input type="date" value={pendingFrom} onChange={(e) => setPendingFrom(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" /></label><label className="flex items-center gap-1.5 text-slate-500">To<input type="date" value={pendingTo} onChange={(e) => setPendingTo(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" /></label></div>{(pendingSearch || pendingFrom || pendingTo) && <button onClick={clearPendingFilters} className={ClearFilterClass}><XIcon className="h-3.5 w-3.5" /> Clear</button>}</div>
          {error && <p className="text-red-500 text-center">{error}</p>}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">
              Loading…
            </div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {filteredPending.length > 0 ? (
              filteredPending.map((r, i) => (
                <details
                  key={`p-mobile-${i}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">

                      <span className="text-[12px] font-semibold text-slate-800">
                        {r.empname}
                      </span>                  
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(r)}
                      </span>     
                      <span className="text-[10px] text-slate-500">
                        Adj Type: {r.dtrType || "Adjustment"}
                      </span>               
                      <span className="text-[10px] text-slate-500">
                        Adj Date: {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </span>              
                      <span className="text-[10px] text-slate-500">
                        Adj Time: {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-center text-xs gap-2">
                      <input aria-label={`Select ${r.empname}`} type="checkbox" checked={selectedRows.includes(i)} onChange={() => toggle(setSelectedPending, i)} />
                      <span className={badgeClass(r.dtrStatus)}>
                        {r.dtrStatus}
                      </span>
                      <button
                        className={ReviewClass}
                        onClick={() => openReview(r)}
                      >
                        Review
                      </button>
                    </div>

                      
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Employee Remarks">
                      <div>{r.dtrRemarks || "N/A"}</div>
                    </Labeled>
                  </div>
                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">
                No pending requests.
              </div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-center whitespace-nowrap">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={
                        filteredPending.length > 0 &&
                        selectedRows.length === filteredPending.length
                      }
                      onChange={() => toggleAll(filteredPending, selectedRows, setSelectedRows)}
                    />
                  </th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "filingDate")} className="global-th text-left whitespace-nowrap cursor-pointer">Filing Date{sortIndicator(pendingSort, "filingDate")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee{sortIndicator(pendingSort, "employee")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "dtrType")} className="global-th text-left whitespace-nowrap cursor-pointer">Type{sortIndicator(pendingSort, "dtrType")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "date")} className="global-th text-left whitespace-nowrap cursor-pointer">Shift Date{sortIndicator(pendingSort, "date")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "actual")} className="global-th text-left whitespace-nowrap cursor-pointer">Actual Time{sortIndicator(pendingSort, "actual")}</th>
                  <th onClick={() => toggleSort(setPendingSort, pendingSort, "dtrRemarks")} className="global-th text-left whitespace-nowrap cursor-pointer">Remarks{sortIndicator(pendingSort, "dtrRemarks")}</th>
                  <th className="global-th text-center whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="global-tbody">
                {filteredPending.length > 0 ? (
                  filteredPending.map((r, i) => (
                    <tr key={`p-desktop-${i}`} className="global-tr">
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(i)}
                          onChange={() => toggle(setSelectedRows, i)}
                        />
                      </td>

                      <td className="global-td-approval text-left whitespace-nowrap">
                        {applicationFileDate(r)}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.empname}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.dtrType || ""}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left">
                        {r.dtrRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className={ReviewClass}
                          onClick={() => openReview(r)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="7" className="p-2 text-center text-gray-500">
                      No pending requests.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {selectedRows.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2 mb-1 mt-8">
                <button
                  className={DisapproveClass}
                  onClick={() => runBatch(filteredPending, selectedRows, "disapprove")}
                >
                  Disapprove
                </button>

                <button
                  className={ApproveClass}
                  onClick={() => runBatch(filteredPending, selectedRows, "approve")}
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              DTR Approval History
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {filteredHistory.length}
              </span>
            </h2>
            <button disabled={!selectedHistoryRows.length} onClick={() => runBatch(filteredHistory, selectedHistoryRows, "cancel")} className={CancelApprovalClass}>Cancel approved</button>
          </div>
          <div className="mb-4 flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:flex-wrap sm:items-center"><div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500"><FilterIcon className="h-3.5 w-3.5" /> Filters</div><div className="relative min-w-0 flex-1 sm:min-w-[180px]"><SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search employee, type, or remarks..." className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" /></div><select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs sm:w-auto"><option value="all">All statuses</option><option value="approved">Approved</option><option value="disapproved">Disapproved</option><option value="cancelled">Cancelled</option></select><div className="grid w-full grid-cols-1 gap-2 text-xs sm:flex sm:w-auto sm:items-center sm:gap-1.5"><label className="flex items-center gap-1.5 text-slate-500">From<input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" /></label><label className="flex items-center gap-1.5 text-slate-500">To<input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden" /></label></div>{(historySearch || historyFrom || historyTo || historyStatus !== "all") && <button onClick={clearHistoryFilters} className={ClearFilterClass}><XIcon className="h-3.5 w-3.5" /> Clear</button>}</div>

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((r, i) => (
                <details
                  key={`h-mobile-${i}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    
                    <div className="flex flex-col">

                      <span className="text-[12px] font-semibold text-slate-800">
                        {r.empname}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Filing Date: {applicationFileDate(r)}
                      </span>     
                      <span className="text-[10px] text-slate-500">
                        Adj Type: {r.dtrType || "Adjustment"}
                      </span>               
                      <span className="text-[10px] text-slate-500">
                        Adj Date: {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </span>              
                      <span className="text-[10px] text-slate-500">
                        Adj Time: {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                      </span>

                    </div>

                    <div className="flex flex-col items-center text-xs gap-2">
                      {isApproved(r) && <input aria-label={`Select ${r.empname}`} type="checkbox" checked={selectedHistoryRows.includes(i)} onChange={() => toggle(setSelectedHistoryRows, i)} />}
                      <span className={badgeClass(r.dtrStatus)}>{r.dtrStatus}</span>
                    </div>

                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Employee Remarks">{r.dtrRemarks || "N/A"}</Labeled>
                    <Labeled label="Approver Remarks">{approvalRemarks(r)}</Labeled>
                    <Labeled label={approvalLabels(r.dtrStatus).actor}>{approvalUser(r)}</Labeled>
                    <Labeled label={approvalLabels(r.dtrStatus).date}>{approvalDateTime(r)}</Labeled>
                  </div>
                </details>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500">No records.</div>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-center whitespace-nowrap">
                    <input type="checkbox" checked={filteredHistory.filter((r) => r.dtrStatus === "Approved").length > 0 && selectedHistoryRows.length === filteredHistory.filter((r) => r.dtrStatus === "Approved").length} onChange={() => { const approved = filteredHistory.map((r, i) => r.dtrStatus === "Approved" ? i : null).filter((i) => i !== null); setSelectedHistoryRows(selectedHistoryRows.length === approved.length ? [] : approved); }} />
                  </th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "employee")} className="global-th text-left whitespace-nowrap cursor-pointer">Employee{sortIndicator(historySort, "employee")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "dtrType")} className="global-th text-left whitespace-nowrap cursor-pointer">Type{sortIndicator(historySort, "dtrType")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "date")} className="global-th text-left whitespace-nowrap cursor-pointer">Shift Date{sortIndicator(historySort, "date")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "actual")} className="global-th text-left whitespace-nowrap cursor-pointer">Actual Time{sortIndicator(historySort, "actual")}</th>
                  <th onClick={() => toggleSort(setHistorySort, historySort, "dtrRemarks")} className="global-th text-left whitespace-nowrap cursor-pointer">Applicant Remarks{sortIndicator(historySort, "dtrRemarks")}</th>
                  <th className="global-th text-left whitespace-nowrap">
                    Approver Remarks
                  </th>
                  <th className="global-th text-center whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((r, i) => (
                    <tr key={`h-desktop-${i}`} className="global-tr">
                      <td className="global-td-approval text-center">{isApproved(r) && <input type="checkbox" checked={selectedHistoryRows.includes(i)} onChange={() => toggle(setSelectedHistoryRows, i)} />}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.empname}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.dtrType || ""}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600 font-semibold">Filing Date: {applicationFileDate(r)}</div>
                        <div>{r.dtrRemarks || "N/A"}</div>
                      </td>

                      <td className="global-td-approval text-left">
                        <div className="text-xs text-slate-600 font-semibold">Approver's Remarks:</div>
                        <div className="text-xs text-slate-600">{approvalRemarks(r) || "N/A"}</div>
                        <div className="text-xs text-slate-600 font-semibold">{approvalLabels(r.dtrStatus).actor}:</div>
                        <div className="text-xs text-slate-600">{approvalUser(r) || "N/A"}</div>
                        <div className="text-xs text-slate-600 font-semibold">{approvalLabels(r.dtrStatus).date}:</div>
                        <div className="text-xs text-slate-600">{approvalDateTime(r) || "N/A"}</div>
                      </td>

                      <td className="global-td-approval text-center">
                        <div className="flex flex-col items-center justify-center gap-1 whitespace-nowrap">
                          <span className={badgeClass(r.dtrStatus)}>{r.dtrStatus}</span>
                          {isApproved(r) && <button onClick={() => runBatch(filteredHistory, [i], "cancel")} className={CancelClass}>Cancel</button>}
                        </div>
                      </td>


                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-3 text-center text-gray-500">
                      No records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* REVIEW MODAL */}
        {showModal && selected && (
          <TimekeepingAdjustmentReview
            dtrData={selected}
            onClose={() => {
              setShowModal(false);
              setSelected(null);
              // Refresh after approve/disapprove/cancel
              fetchAll();
            }}
            setPending={setPending}
            setHistory={setHistory}
          />
        )}
      </div>
    </div>
  );
};

export default TimekeepingAdjustmentApproval;
