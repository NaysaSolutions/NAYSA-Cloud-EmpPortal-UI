import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { CalendarDays } from "lucide-react";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";
 
const resultRows = (result) => {
  const raw = result?.data?.[0]?.result ?? result?.data;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};
const canManage = (user) => ["1", "y", "yes", "true"].includes(String(user?.hrFlag ?? user?.hrflag ?? user?.approver ?? "").toLowerCase());
const fmt = (value, withTime = false) => value && dayjs(value).isValid() ? dayjs(value).format(withTime ? "MM/DD/YYYY hh:mm A" : "MM/DD/YYYY") : "-";
const shiftTypeLabel = (value) => ({ DS: "Day Shift", MS: "Mid Shift", NS: "Night Shift" }[String(value ?? "").trim().toUpperCase()] || value || "-");
const isRestDay = (row) => String(row?.rd ?? row?.RD ?? "").trim().toUpperCase() === "Y";
const DateInput = ({ value, onChange, min, required = false }) => (
  <div className="relative">
    <input type="date" value={value} min={min} required={required} onChange={onChange} className="h-10 w-full min-w-0 appearance-none rounded-xl border border-gray-200 px-3 pr-10 text-sm focus:border-blue-500 focus:ring-blue-500" />
    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700" aria-hidden="true" />
  </div>
);
const isToday = (value) => value && dayjs(value).isValid() && dayjs(value).isSame(dayjs(), "day");
const shiftTypeStyle = (value) => ({
  DS: "bg-blue-50 text-blue-800 ring-blue-200",
  MS: "bg-sky-50 text-sky-800 ring-sky-200",
  NS: "bg-indigo-50 text-indigo-800 ring-indigo-200",
}[String(value ?? "").trim().toUpperCase()] || "bg-slate-50 text-slate-600 ring-slate-200");
 
// Icons kept inline (no extra dependencies) so this drops into the existing app untouched.
const Icon = {
  Refresh: (props) => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke="currentColor" {...props}>
      <path d="M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15a8 8 0 0 0 14.7 2.5M19.5 9A8 8 0 0 0 4.8 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Upload: (props) => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke="currentColor" {...props}>
      <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  File: (props) => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke="currentColor" {...props}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinejoin="round" />
    </svg>
  ),
  Check: (props) => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" {...props}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
 
export default function EmployeeShift() {
  const { user } = useAuth();
  const manager = canManage(user);
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [rows, setRows] = useState([]); const [shifts, setShifts] = useState([]); const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [changeShiftType, setChangeShiftType] = useState("Duty");
  const [shiftCode, setShiftCode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [uploadRows, setUploadRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [scheduleFilters, setScheduleFilters] = useState({ restDay: "all", shiftType: "all", shiftCode: "all" });
  const [showMobileFilters, setShowMobileFilters] = useState(false);
 
  const load = async () => {
    if (!user?.empNo) return;
    setLoading(true);
    try {
      const [scheduleResponse, shiftResponse] = await Promise.all([
        fetch(API_ENDPOINTS.employeeShifts, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ EMP_NO: user.empNo, START_DATE: from, END_DATE: to, ALL: manager ? "Y" : "N" }) }),
        fetch(API_ENDPOINTS.shiftCodes, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
      ]);
      const [scheduleResult, shiftResult] = await Promise.all([scheduleResponse.json(), shiftResponse.json()]);
      setRows(resultRows(scheduleResult)); setShifts(resultRows(shiftResult));
    } catch (error) { console.error(error); Swal.fire("Unable to load shifts", "Please try again.", "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.empNo, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
 
  const setPreset = (preset) => {
    const base = dayjs();
    const target = preset === "prev" ? base.subtract(1, "month") : preset === "next" ? base.add(1, "month") : base;
    setFrom(target.startOf("month").format("YYYY-MM-DD"));
    setTo(target.endOf("month").format("YYYY-MM-DD"));
  };
  const activePreset = useMemo(() => {
    const base = dayjs();
    if (from === base.startOf("month").format("YYYY-MM-DD") && to === base.endOf("month").format("YYYY-MM-DD")) return "this";
    if (from === base.subtract(1, "month").startOf("month").format("YYYY-MM-DD") && to === base.subtract(1, "month").endOf("month").format("YYYY-MM-DD")) return "prev";
    if (from === base.add(1, "month").startOf("month").format("YYYY-MM-DD") && to === base.add(1, "month").endOf("month").format("YYYY-MM-DD")) return "next";
    return "custom";
  }, [from, to]);
 
  const filterOptions = useMemo(() => ({
    shiftTypes: [...new Set(rows.map((row) => String(row.shiftType ?? row.shift_type ?? "").trim()).filter(Boolean))].sort(),
    shiftCodes: [...new Set(rows.map((row) => String(row.shiftCode ?? row.shift_code ?? "").trim()).filter(Boolean))].sort(),
  }), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const restDay = isRestDay(row);
    const rowShiftType = String(row.shiftType ?? row.shift_type ?? "").trim();
    const rowShiftCode = String(row.shiftCode ?? row.shift_code ?? "").trim();
    return (scheduleFilters.restDay === "all" || (scheduleFilters.restDay === "rest" ? restDay : !restDay))
      && (scheduleFilters.shiftType === "all" || rowShiftType === scheduleFilters.shiftType)
      && (scheduleFilters.shiftCode === "all" || rowShiftCode === scheduleFilters.shiftCode);
  }), [rows, scheduleFilters]);
  const setScheduleFilter = (key, value) => setScheduleFilters((current) => ({ ...current, [key]: value }));
  const clearScheduleFilters = () => setScheduleFilters({ restDay: "all", shiftType: "all", shiftCode: "all" });
  const stats = useMemo(() => {
    const restDays = filteredRows.filter(isRestDay).length;
    const totalHrs = filteredRows.reduce((sum, row) => sum + (Number(row.workHrs ?? row.work_hrs ?? 0) || 0), 0);
    return { scheduled: filteredRows.length, restDays, dutyDays: filteredRows.length - restDays, totalHrs };
  }, [filteredRows]);
 
  const selected = useMemo(() => rows.find((row) => String(row.date ?? row.shiftDate).slice(0, 10) === date && String(row.empNo ?? row.empno) === String(user?.empNo)), [rows, date, user?.empNo]);
  const shiftDisplay = (code, description) => code ? `${code}${description ? ` - ${description}` : ""}` : "Not scheduled";
  const currentShiftDisplay = shiftDisplay(selected?.shiftCode ?? selected?.shift_code, selected?.shiftDesc ?? selected?.shift_desc);
  const requestedShift = useMemo(() => shifts.find((shift) => String(shift.shiftCode ?? shift.code) === String(shiftCode)), [shifts, shiftCode]);
  const requestedShiftDisplay = changeShiftType === "Rest Day"
    ? "Rest Day"
    : shiftDisplay(shiftCode, requestedShift?.shiftDesc ?? requestedShift?.shift_desc ?? requestedShift?.description);

  const submitChange = async (event) => {
    event.preventDefault();

    if (!date || !changeShiftType || !remarks.trim() || (changeShiftType === "Duty" && !shiftCode)) {
      return Swal.fire(
        "Incomplete form",
        changeShiftType === "Duty"
          ? "Select a date, change shift type, requested shift, and provide a reason."
          : "Select a date, change shift type, and provide a reason.",
        "warning"
      );
    }

    const currentShiftCode = String(selected?.shiftCode ?? selected?.shift_code ?? "").trim();

    if (changeShiftType === "Duty" && currentShiftCode && currentShiftCode.toUpperCase() === String(shiftCode).trim().toUpperCase() && !isRestDay(selected)) {
      return Swal.fire("No shift change", "The requested shift is the same as your current scheduled shift. Please select a different shift.", "warning");
    }

    if (changeShiftType === "Rest Day" && isRestDay(selected)) {
      return Swal.fire("No shift change", "The selected date is already a Rest Day.", "warning");
    }

    const confirm = await Swal.fire({
      title: "Submit shift change?",
      html: `<b>${fmt(date)}</b><br/><br/>
             <span style="color:#64748b">Change Shift Type</span><br/><b>${changeShiftType}</b><br/><br/>
             <span style="color:#64748b">Current Schedule</span><br/>${isRestDay(selected) ? "Rest Day" : currentShiftDisplay}<br/><br/>
             <span style="color:#64748b">Requested Schedule</span><br/><b>${requestedShiftDisplay}</b>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Submit"
    });

    if (!confirm.isConfirmed) return;

    try {
      const response = await fetch(API_ENDPOINTS.upsertShiftChange, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json_data: {
            empNo: user.empNo,
            detail: [{
              shiftDate: date,
              changeShiftType,
              currentShiftCode: selected?.shiftCode ?? selected?.shift_code ?? "",
              requestedShiftCode: changeShiftType === "Duty" ? shiftCode : "",
              remarks: remarks.trim()
            }]
          }
        })
      });

      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(result.message || "Unable to submit shift change.");

      setRemarks("");
      setShiftCode("");
      setChangeShiftType("Duty");
      await Swal.fire("Submitted", "Your shift change was sent for approval.", "success");
      load();
    } catch (error) {
      console.error(error);
      Swal.fire("Unable to submit", error.message || "Please try again.", "error");
    }
  };
  const importSheet = (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const book = XLSX.read(loadEvent.target.result, { type: "array", cellDates: true });
      const data = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: "" }).map((row) => ({ empNo: row.EMPNO ?? row.EmpNo ?? row["Employee No"], shiftDate: dayjs(row.DATE ?? row.Date ?? row["Shift Date"]).format("YYYY-MM-DD"), shiftCode: row.SHIFT_CODE ?? row.ShiftCode ?? row["Shift Code"], rd: row.RD ?? "" }));
      setUploadRows(data.filter((row) => row.empNo && row.shiftDate));
    }; reader.readAsArrayBuffer(file);
  };
  const clearUpload = () => { setUploadRows([]); setFileName(""); };
  const upload = async () => {
    if (!uploadRows.length) return;
    const response = await fetch(API_ENDPOINTS.uploadEmployeeShifts, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empNo: user.empNo, detail: uploadRows }) });
    const result = await response.json(); if (!response.ok || result.status !== "success") return Swal.fire("Upload failed", result.message || "Please check the file.", "error");
    clearUpload(); await Swal.fire("Uploaded", `${result.count ?? uploadRows.length} employee shift(s) saved.`, "success"); load();
  };
 
  return <div className="ml-0 lg:ml-[200px] mt-[80px] min-h-screen bg-slate-50 p-4">
    <div className="global-div-header-ui">
      <h1 className="global-div-headertext-ui">Employee Shift</h1>
    </div>
 
    {/* Schedule */}
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="w-40 text-sm text-gray-600">
            <span className="mb-1 block text-xs text-gray-500">From</span>
            <DateInput value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="w-40 text-sm text-gray-600">
            <span className="mb-1 block text-xs text-gray-500">To</span>
            <DateInput value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="flex overflow-hidden rounded-xl border border-slate-300">
            {[["prev", "Last Month"], ["this", "This Month"], ["next", "Next Month"]].map(([key, label]) => (
              <button type="button" key={key} onClick={() => setPreset(key)}
                className={`px-3 py-2.5 text-xs font-medium transition-colors ${activePreset === key ? "bg-blue-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900" onClick={load} disabled={loading}>
            <Icon.Refresh className={`h-4 w-5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
 
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">Schedule date range</div>
      </div>
 
      <div className="border-b border-slate-200 p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Filter Employee Shift</h2>
          {/* <p className="text-sm text-slate-500">Narrow the selected schedule by rest day, shift type, or shift code.</p> */}
          </div>
          <div className="flex gap-2"><button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={clearScheduleFilters}>Clear Filters</button><button type="button" className="rounded-xl bg-blue-800 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-900 md:hidden" onClick={() => setShowMobileFilters((visible) => !visible)}>{showMobileFilters ? "Hide Filters" : "Filter Options"}</button></div>
        </div>
        <div className={`${showMobileFilters ? "grid" : "hidden"} gap-3 md:grid md:grid-cols-3`}>
          <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Rest Day</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.restDay} onChange={(e) => setScheduleFilter("restDay", e.target.value)}><option value="all">All Days</option><option value="working">Working Days</option><option value="rest">Rest Days</option></select></label>
          <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Shift Type</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.shiftType} onChange={(e) => setScheduleFilter("shiftType", e.target.value)}><option value="all">All Shift Types</option>{filterOptions.shiftTypes.map((value) => <option key={value} value={value}>{shiftTypeLabel(value)}</option>)}</select></label>
          <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Shift Code</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.shiftCode} onChange={(e) => setScheduleFilter("shiftCode", e.target.value)}><option value="all">All Shift Codes</option>{filterOptions.shiftCodes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-500">Total Days</p><p className="mt-1 text-xl sm:text-2xl font-bold text-blue-800">{stats.scheduled}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-500">Rest Days</p><p className="mt-1 text-xl sm:text-2xl font-bold text-red-700">{stats.restDays}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-500">Total Duty Days</p><p className="mt-1 text-xl sm:text-2xl font-bold text-green-700">{stats.dutyDays}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-500">Total Hours</p><p className="mt-1 text-xl sm:text-2xl font-bold text-blue-800">{stats.totalHrs.toFixed(1)}</p></div>
        </div>
      </div>
      <div className="space-y-3 p-3 md:hidden">
        {loading && !rows.length && Array.from({ length: 3 }).map((_, i) => (
          <div key={`mobile-skeleton-${i}`} className="h-40 animate-pulse rounded-xl bg-slate-100" />
        ))}
        {filteredRows.map((row, index) => {
          const rowDate = row.date ?? row.shiftDate;
          const today = isToday(rowDate);
          const restDay = isRestDay(row);
          return (
            <div key={`mobile-${row.empNo ?? row.empno}-${rowDate}-${index}`} className={`rounded-xl border p-4 shadow-sm ${today ? "border-blue-200 bg-blue-50/50" : restDay ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {manager && <p className="mb-1 text-xs font-medium text-slate-500">{row.empName ?? row.emp_name ?? row.empNo}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{fmt(rowDate)}</p>
                    {today && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">TODAY</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{row.day}</p>
                </div>
                {restDay
                  ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">Rest Day</span>
                  : <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">Duty</span>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Shift Code</p>
                  <p className="mt-1 font-medium text-slate-800">{row.shiftCode ?? row.shift_code ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Shift Type</p>
                  <p className="mt-1 font-medium text-slate-800">{shiftTypeLabel(row.shiftType ?? row.shift_type)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Schedule</p>
                  <p className="mt-1 text-slate-700">{restDay ? "-" : `${fmt(row.shiftIn ?? row.shift_in, true)} - ${fmt(row.shiftOut ?? row.shift_out, true)}`}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Work Hours</p>
                  <p className="mt-1 font-semibold text-slate-800">{row.workHrs ?? row.work_hrs ?? 0}</p>
                </div>
              </div>

              {row.changeShiftRemarks && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Change Shift</p>
                    {row.changeShiftType && <span className="text-[11px] font-semibold text-blue-700">{row.changeShiftType}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{row.changeShiftRemarks}</p>
                </div>
              )}
            </div>
          );
        })}
        {!loading && !filteredRows.length && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">No shift records for this range.</p>
          </div>
        )}
      </div>

      <div className="hidden overflow-auto md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-blue-900 bg-blue-800 text-left text-xs font-semibold text-white">
              {manager && <th className="p-3">Employee</th>}
              <th className="p-3">Shift Date</th>
              <th className="p-3">Shift Day</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3">Shift Code</th>
              <th className="p-3">Shift Type</th>
              <th className="p-3">Schedule</th>
              <th className="p-3">Remarks</th>
              <th className="p-3 text-right">Work Hours</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-slate-100">
                <td colSpan={manager ? 9 : 8} className="p-3">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                </td>
              </tr>
            ))}
            {filteredRows.map((row, index) => {
              const rowDate = row.date ?? row.shiftDate;
              const today = isToday(rowDate);
              const restDay = isRestDay(row);
              return (
                <tr
                  className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${today ? "bg-blue-50" : restDay ? "bg-red-50/40" : ""}`}
                  key={`${row.empNo ?? row.empno}-${row.date}-${index}`}
                >
                  {manager && <td className="p-3 text-gray-700">{row.empName ?? row.emp_name ?? row.empNo}</td>}
                  <td className="p-3">
                    <span className={`font-medium ${today ? "text-blue-800" : "text-gray-800"}`}>{fmt(rowDate)}</span>
                    {today && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">TODAY</span>}
                  </td>
                  <td className="p-3 text-gray-500">{row.day}</td>
                  <td className="p-3 text-center">
                    {restDay
                      ? <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">Rest Day</span>
                      : <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">Duty</span>}
                  </td>
                  <td className="p-3 font-medium text-gray-800">{row.shiftCode ?? row.shift_code ?? "-"}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${shiftTypeStyle(row.shiftType ?? row.shift_type)}`}>
                      {shiftTypeLabel(row.shiftType ?? row.shift_type)}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{fmt(row.shiftIn ?? row.shift_in, true)} - {fmt(row.shiftOut ?? row.shift_out, true)}</td>
                  <td className="p-3">
                    {row.changeShiftRemarks
                      ? <div className="max-w-xs">
                          <p className="text-sm text-slate-700">{row.changeShiftRemarks}</p>
                          {row.changeShiftType && <p className="mt-1 text-[11px] font-medium text-blue-700">{row.changeShiftType}</p>}
                        </div>
                      : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="p-3 text-right font-medium text-gray-800">{row.workHrs ?? row.work_hrs ?? 0}</td>
                </tr>
              );
            })}
            {!loading && !filteredRows.length && (
              <tr>
                <td colSpan={manager ? 9 : 8} className="p-10 text-center">
                  <p className="text-gray-500">No shift records for this range.</p>
                  <p className="text-xs text-gray-400">Try a different date range or check back later.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
 
    {/* Actions */}
    <div className="mt-4 space-y-4">
      <form className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" onSubmit={submitChange}>
        <h2 className="font-semibold text-blue-900">Shift Change Application</h2>
        <p className="mb-4 text-sm text-gray-500">Request a different shift for a specific date and send it for approval.</p>
 
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm text-gray-600">
            <span className="mb-1 block text-xs font-medium text-gray-500">Shift Date</span>
            <DateInput required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <div className="text-sm text-gray-600">
            <span className="mb-1 block text-xs font-medium text-gray-500">Change Shift Type</span>
            <div className="grid h-11 grid-cols-2 overflow-hidden rounded-xl border border-slate-300 bg-slate-50 p-1">
              {["Duty", "Rest Day"].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => {
                    setChangeShiftType(type);
                    if (type === "Rest Day") setShiftCode("");
                  }}
                  className={`rounded-lg px-3 text-sm font-semibold transition ${changeShiftType === type ? "bg-blue-800 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <label className="text-sm text-gray-600">
            <span className="mb-1 block text-xs font-medium text-gray-500">Requested Shift</span>
            <select
              required={changeShiftType === "Duty"}
              disabled={changeShiftType === "Rest Day"}
              className="block h-11 w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              value={shiftCode}
              onChange={(e) => setShiftCode(e.target.value)}
            >
              <option value="">{changeShiftType === "Rest Day" ? "Not applicable for Rest Day" : "Select shift"}</option>
              {shifts.map((shift) => (
                <option key={shift.shiftCode ?? shift.code} value={shift.shiftCode ?? shift.code}>{shift.shiftCode ?? shift.code} - {shift.shiftDesc ?? shift.description}</option>
              ))}
            </select>
          </label>
        </div>
 
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
          <span className="text-gray-500">Current:</span>
          <span className="font-medium text-gray-800">{isRestDay(selected) ? "Rest Day" : currentShiftDisplay}</span>
          <span className="text-gray-400">→</span>
          <span className="font-medium text-blue-700">{requestedShiftDisplay}</span>
        </div>
 
        <label className="mt-4 block text-sm text-gray-600">
          <span className="mb-1 block text-xs text-gray-500">Reason</span>
          <textarea required className="mt-1 block w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" rows="3" placeholder="Briefly explain why you're requesting this change" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </label>
 
        <button className="mt-4 w-full rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 sm:w-auto">Submit for Approval</button>
      </form>
 
      {manager && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-blue-900">HR / Approver Shift Upload</h2>
          <p className="mb-4 text-sm text-gray-500">Upload an .xlsx or .csv file with EMPNO, DATE, SHIFT_CODE, and optional RD columns.</p>
 
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30">
            <Icon.Upload className="h-6 w-6 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Click to choose a file</span>
            <span className="text-xs text-gray-400">.xlsx, .xls, or .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importSheet} className="hidden" />
          </label>
 
          {fileName && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <Icon.File className="h-4 w-4 text-gray-400" />
                <span className="truncate">{fileName}</span>
              </div>
              <button type="button" onClick={clearUpload} className="text-xs font-medium text-gray-400 hover:text-red-600">Remove</button>
            </div>
          )}
 
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            {uploadRows.length
              ? <><Icon.Check className="h-4 w-4 text-emerald-600" /><span className="text-emerald-700">{uploadRows.length} valid row{uploadRows.length === 1 ? "" : "s"} ready to upload.</span></>
              : <span className="text-gray-400">No file selected.</span>}
          </div>
 
          <button disabled={!uploadRows.length} className="mt-4 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40" onClick={upload}>
            Upload Employee Shifts
          </button>
        </div>
      )}
    </div>
  </div>;
}
 
