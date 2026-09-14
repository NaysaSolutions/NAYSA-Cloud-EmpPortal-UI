import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { CalendarDays } from "lucide-react";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { getAccessRights } from "./accessRights";
 
const resultRows = (result) => {
  const raw = result?.data?.[0]?.result ?? result?.data;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

const isValidDateValue = (value) => {
  if (!value) return false;

  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
         dayjs(value).isValid();
};

const readJsonResponse = async (response, endpointName) => {
  const body = await response.text();

  let result = null;

  try {
    result = body ? JSON.parse(body) : null;
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
      `${endpointName} failed (${response.status}).`
    );
  }

  if (!result) {
    throw new Error(
      `${endpointName} returned invalid JSON.`
    );
  }

  return result;
};

  // const { isApprover, isHr, isManager, canApprove, canConfirmDtr,
  //   canViewDtrMonitoring, canViewLeaveMonitoring, canManageEmployeeShifts,
  //   canApproveEmployeeShifts } = getAccessRights(user);

const hasHrAccess = (user) => getAccessRights(user).isHr;
const hasApproverAccess = (user) => getAccessRights(user).isApprover;
const canManage = (user) => getAccessRights(user).isManager;
const hasManagerAccess = (user) => getAccessRights(user).isManager;
const hasSupervisorAccess = (user) => getAccessRights(user).isSupervisor;

const fmt = (value, withTime = false) => value && dayjs(value).isValid() ? dayjs(value).format(withTime ? "MM/DD/YYYY hh:mm A" : "MM/DD/YYYY") : "-";
const shiftTypeLabel = (value) => ({ DS: "Day Shift", MS: "Mid Shift", NS: "Night Shift" }[String(value ?? "").trim().toUpperCase()] || value || "-");
const isRestDay = (row) => String(row?.rd ?? row?.RD ?? "").trim().toUpperCase() === "Y";
const DateInput = ({ value, onChange, min, required = false }) => (
  <div className="relative">
    <input type="date" value={value} min={min} required={required} onChange={onChange} className="h-10 w-full min-w-0 appearance-none rounded-xl border border-gray-200 px-3 pr-10 text-sm focus:border-blue-500 focus:ring-blue-500" />
    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700" aria-hidden="true" />
  </div>
);
const TEMPLATE_SHEETS = ["Sheet1", "Payroll Period", "Employee Masterdata", "Shift Code"];
const TEMPLATE_HEADERS = ["Employee No", "Employee Name", "Payroll Period", "Date", "RD Flag", "Shift Code", "Working Hours"];
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
  const hrAccess = hasHrAccess(user);
  const approverAccess = hasApproverAccess(user);
  const mgrAccess = hasManagerAccess(user);
  const supAccess = hasSupervisorAccess(user);
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [rows, setRows] = useState([]); const [shifts, setShifts] = useState([]); const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [changeShiftType, setChangeShiftType] = useState("Duty");
  const [shiftCode, setShiftCode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [uploadRows, setUploadRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [scheduleView, setScheduleView] = useState("MY");
  const [selectedEmployeeNo, setSelectedEmployeeNo] = useState("");
  const [groupBy, setGroupBy] = useState("none");
  const [collapsedGroups, setCollapsedGroups] = useState([]);
  const [scheduleFilters, setScheduleFilters] = useState({ restDay: "all", shiftType: "all", shiftCode: "all", branch: "all", department: "all", payrollGroup: "all", employeeStatus: "all" });
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const handleFromChange = (event) => {
    const nextFrom = event.target.value;

    setFrom(nextFrom);

    /*
    * If input is temporarily blank while being edited,
    * don't modify To date.
    */
    if (!nextFrom) {
      return;
    }

    if (
      to &&
      dayjs(to).isValid() &&
      dayjs(to).isBefore(dayjs(nextFrom), "day")
    ) {
      setTo(nextFrom);
    }
  };
 
  const load = async () => {
    /*
    * Do NOT call API while the user is still editing
    * either date input.
    */
    if (!user?.empNo) return;

    if (!isValidDateValue(from) || !isValidDateValue(to)) {
      return;
    }

    if (dayjs(to).isBefore(dayjs(from), "day")) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        EMP_NO: String(user.empNo).trim(),
        START_DATE: from,
        END_DATE: to,
        VIEW: scheduleView,
        HR_FLAG: hrAccess ? "Y" : "N",
        MGR_FLAG: mgrAccess ? "Y" : "N",
        SUP_FLAG: supAccess ? "Y" : "N",
        APPROVER: approverAccess ? "Y" : "N",
      };

      console.log("Employee Shift Request:", payload);

      const [scheduleResponse, shiftResponse] = await Promise.all([
        fetch(API_ENDPOINTS.employeeShifts, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(payload),
        }),

        fetch(API_ENDPOINTS.shiftCodes, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: "{}",
        }),
      ]);

      const [scheduleResult, shiftResult] = await Promise.all([
        readJsonResponse(
          scheduleResponse,
          "Employee shifts"
        ),

        readJsonResponse(
          shiftResponse,
          "Shift codes"
        ),
      ]);

      console.log(
        "Employee Shift Response:",
        scheduleResult
      );

      setRows(
        Array.isArray(scheduleResult?.data)
          ? scheduleResult.data
          : []
      );

      setShifts(
        Array.isArray(shiftResult?.data)
          ? shiftResult.data
          : []
      );

    } catch (error) {
      console.error(
        "Unable to load employee shifts:",
        error
      );

      Swal.fire(
        "Unable to load shifts",
        error.message || "Please try again.",
        "error"
      );

    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!user?.empNo) return;

    if (!isValidDateValue(from)) return;
    if (!isValidDateValue(to)) return;

    if (dayjs(to).isBefore(dayjs(from), "day")) {
      return;
    }

    load();

  }, [
    user?.empNo,
    scheduleView,
    hrAccess,
    approverAccess,
  ]); // eslint-disable-line react-hooks/exhaustive-deps


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
 
  const filterOptions = useMemo(() => {
    const codeOptions = (valueOf, labelOf) => Array.from(new Map(rows.map((row) => {
      const value = String(valueOf(row) ?? "").trim();
      const label = String(labelOf(row) ?? value).trim();
      return value ? [value, { value, label: label || value }] : null;
    }).filter(Boolean)).values()).sort((a, b) => a.label.localeCompare(b.label));
    return {
      shiftTypes: [...new Set(rows.map((row) => String(row.shiftType ?? row.shift_type ?? "").trim()).filter(Boolean))].sort(),
      shiftCodes: codeOptions((row) => row.shiftCode ?? row.shift_code, (row) => row.shiftDesc ?? row.shift_desc),
      branches: codeOptions((row) => row.branchCode ?? row.branchcode ?? row.branch, (row) => row.branchName),
      departments: codeOptions((row) => row.deptCode ?? row.dept_code ?? row.department, (row) => row.deptName),
      payrollGroups: codeOptions((row) => row.payGroup ?? row.pay_group ?? row.payrollGroup, (row) => row.payGroupName),
      employeeStatuses: codeOptions((row) => row.empStat ?? row.emp_stat ?? row.employeeStatus, (row) => row.empStatName),
    };
  }, [rows]);
  const employeeOptions = useMemo(() => Array.from(new Map(rows.map((row) => {
    const empNo = String(row.empNo ?? row.empno ?? "").trim();
    return [empNo, { empNo, empName: row.empName ?? row.emp_name ?? "" }];
  }).filter(([empNo]) => empNo)).values()).sort((a, b) => String(a.empName).localeCompare(String(b.empName))), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const restDay = isRestDay(row);
    const rowShiftType = String(row.shiftType ?? row.shift_type ?? "").trim();
    const rowShiftCode = String(row.shiftCode ?? row.shift_code ?? "").trim();
    const rowEmpNo = String(row.empNo ?? row.empno ?? "").trim();
    const rowBranch = String(row.branchCode ?? row.branchcode ?? row.branch ?? "").trim();
    const rowDepartment = String(row.deptCode ?? row.dept_code ?? row.department ?? "").trim();
    const rowPayrollGroup = String(row.payGroup ?? row.pay_group ?? row.payrollGroup ?? "").trim();
    const rowEmployeeStatus = String(row.empStat ?? row.emp_stat ?? row.employeeStatus ?? "").trim();
    return (scheduleFilters.restDay === "all" || (scheduleFilters.restDay === "rest" ? restDay : !restDay))
      && (scheduleFilters.shiftType === "all" || rowShiftType === scheduleFilters.shiftType)
      && (scheduleFilters.shiftCode === "all" || rowShiftCode === scheduleFilters.shiftCode)
      && (scheduleFilters.branch === "all" || rowBranch === scheduleFilters.branch)
      && (scheduleFilters.department === "all" || rowDepartment === scheduleFilters.department)
      && (scheduleFilters.payrollGroup === "all" || rowPayrollGroup === scheduleFilters.payrollGroup)
      && (scheduleFilters.employeeStatus === "all" || rowEmployeeStatus === scheduleFilters.employeeStatus)
      && (scheduleView !== "EMPLOYEE" || !selectedEmployeeNo || rowEmpNo === selectedEmployeeNo);
  }), [rows, scheduleFilters, scheduleView, selectedEmployeeNo]);
  const setScheduleFilter = (key, value) => setScheduleFilters((current) => ({ ...current, [key]: value }));
  const clearScheduleFilters = () => setScheduleFilters({ restDay: "all", shiftType: "all", shiftCode: "all", branch: "all", department: "all", payrollGroup: "all", employeeStatus: "all" });
  const handleScheduleViewChange = (value) => { setScheduleView(value); setSelectedEmployeeNo(value === "MY" ? user?.empNo ?? "" : ""); };
  const groupLabel = (row) => {
    const branch = row.branchName ?? row.branchCode ?? row.branchcode ?? row.branch ?? "Unassigned";
    const department = row.deptName ?? row.deptCode ?? row.dept_code ?? row.department ?? "Unassigned";
    const payrollGroup = row.payGroupName ?? row.payGroup ?? row.pay_group ?? row.payrollGroup ?? "Unassigned";
    const employeeStatus = row.empStatName ?? row.empStat ?? row.emp_stat ?? row.employeeStatus ?? "Unassigned";
    if (groupBy === "employee") return `${row.empNo ?? row.empno ?? ""} - ${row.empName ?? row.emp_name ?? ""}`.trim();
    if (groupBy === "branch") return branch;
    if (groupBy === "department") return department;
    if (groupBy === "payrollGroup") return payrollGroup;
    if (groupBy === "employeeStatus") return employeeStatus;
    if (groupBy === "restDay") return isRestDay(row) ? "Rest Day" : "Duty Day";
    if (groupBy === "shiftType") return shiftTypeLabel(row.shiftType ?? row.shift_type);
    if (groupBy === "shiftCode") {
      const code = row.shiftCode ?? row.shift_code ?? ""; const description = row.shiftDesc ?? row.shift_desc ?? "";
      return code ? `${code}${description ? ` - ${description}` : ""}` : "Rest Day";
    }
    return "";
  };
  const groupedRows = useMemo(() => {
    if (groupBy === "none") return filteredRows.map((row) => ({ row }));
    const groups = new Map();
    filteredRows.forEach((row) => { const label = groupLabel(row) || "Unassigned"; if (!groups.has(label)) groups.set(label, []); groups.get(label).push(row); });
    return Array.from(groups.entries()).flatMap(([label, groupRows]) => {
      const collapsed = collapsedGroups.includes(label);
      const totalWorkHrs = groupRows.reduce((total, row) => total + (Number(row.workHrs ?? row.work_hrs ?? 0) || 0), 0);
      return [{ label, count: groupRows.length, totalWorkHrs, collapsed }, ...(collapsed ? [] : groupRows.map((row) => ({ row })) )];
    });
  }, [filteredRows, groupBy, collapsedGroups]);
  const groupLabels = useMemo(() => groupedRows.filter((item) => item.label).map((item) => item.label), [groupedRows]);
  const toggleGroup = (label) => setCollapsedGroups((groups) => groups.includes(label) ? groups.filter((group) => group !== label) : [...groups, label]);
  const expandAllGroups = () => setCollapsedGroups([]);
  const collapseAllGroups = () => setCollapsedGroups(groupLabels);
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
      const hasTemplateStructure = TEMPLATE_SHEETS.every((sheetName) => book.SheetNames.includes(sheetName));
      const worksheet = book.Sheets.Sheet1;
      const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" })[0] || [];
      if (!hasTemplateStructure || !TEMPLATE_HEADERS.every((header) => headers.includes(header))) {
        setUploadRows([]); setFileName("");
        Swal.fire("Invalid upload template", "Please use the Employee Schedule Template downloaded from this page.", "warning");
        event.target.value = "";
        return;
      }
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true }).map((row) => {
        const parsedDate = dayjs(row["Date"]);
        return {
          // Upload contract: ONLY these six fields are accepted from the workbook.
          empNo: String(row["Employee No"] ?? "").trim(),
          cutOff: String(row["Payroll Period"] ?? "").trim(),
          date: parsedDate.isValid() ? parsedDate.format("YYYY-MM-DD") : "",
          rd: String(row["RD Flag"] ?? "").trim().toUpperCase(),
          shiftCode: String(row["Shift Code"] ?? "").trim(),
          workHrs: Number(row["Working Hours"] ?? 0),
        };
      });

      const validRows = data.filter((row) => row.empNo && row.cutOff && row.date);
      const invalidRows = data.filter((row) => row.empNo || row.cutOff || row.date || row.shiftCode)
        .filter((row) => !row.empNo || !row.cutOff || !row.date || Number.isNaN(row.workHrs));

      if (invalidRows.length) {
        setUploadRows([]);
        setFileName("");
        Swal.fire(
          "Invalid template data",
          `${invalidRows.length} row(s) have an invalid Employee No., Payroll Period, Date, or Working Hours.`,
          "warning"
        );
        event.target.value = "";
        return;
      }

      setUploadRows(validRows);
    }; reader.readAsArrayBuffer(file);
  };
  const downloadTemplate = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.employeeShiftTemplateData, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo })
      });

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          response.ok
            ? "The template service returned an unexpected response."
            : `Template service is not available (HTTP ${response.status}).`
        );
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Unable to load template reference data.");
      }

      const data = result.data ?? {};
      const payrollPeriods = Array.isArray(data.payrollPeriods) ? data.payrollPeriods : [];
      const employees = Array.isArray(data.employees) ? data.employees : [];
      const shiftCodes = Array.isArray(data.shiftCodes) ? data.shiftCodes : [];

      const workbook = XLSX.utils.book_new();

      // Keep the same 4-sheet structure as the supplied sample template.
      const uploadSheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);

      const payrollSheet = XLSX.utils.json_to_sheet(
        payrollPeriods.map((row) => ({
          "Year": row.year ?? "",
          "Cut Off Code": row.cutOff ?? "",
          "Cut Off Name": row.cutOffName ?? "",
          "Frequency": row.frequency ?? "",
          "Start Date": row.startDate ? dayjs(row.startDate).toDate() : "",
          "End Date": row.endDate ? dayjs(row.endDate).toDate() : ""
        }))
      );

      const employeeSheet = XLSX.utils.json_to_sheet(
        employees.map((row) => ({
          "Employee No": row.empNo ?? "",
          "Employee Name": row.empName ?? "",
          "Payroll Frequency": row.payFreq ?? "",
          "Employee Status": row.empStat ?? "",
          "Department": row.department ?? "",
          "Branch": row.branch ?? "",
        }))
      );

      const shiftSheet = XLSX.utils.json_to_sheet(
        shiftCodes.map((row) => ({
          "Shift Code": row.shiftCode ?? "",
          "Shift Name": row.shiftDesc ?? "",
          "Shift Type": row.shiftType ?? "",
          "Work Hours": Number(row.workHrs ?? 8)
        }))
      );

      // Practical column widths matching the supplied sample.
      uploadSheet["!cols"] = [
        { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 28 }, { wch: 14 },
        { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 16 }
      ];
      payrollSheet["!cols"] = [
        { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }
      ];
      employeeSheet["!cols"] = [
        { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 30 }
      ];
      shiftSheet["!cols"] = [
        { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 14 }
      ];

      XLSX.utils.book_append_sheet(workbook, uploadSheet, "Sheet1");
      XLSX.utils.book_append_sheet(workbook, payrollSheet, "Payroll Period");
      XLSX.utils.book_append_sheet(workbook, employeeSheet, "Employee Masterdata");
      XLSX.utils.book_append_sheet(workbook, shiftSheet, "Shift Code");

      XLSX.writeFile(workbook, "Employee Schedule Template.xlsx", {
        cellDates: true,
        bookType: "xlsx"
      });
    } catch (templateError) {
      console.error(templateError);
      Swal.fire(
        "Unable to download template",
        templateError.message || "Please try again.",
        "error"
      );
    }
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
        <div className="flex w-full flex-wrap items-end gap-3 xl:w-auto xl:gap-4">
          <label className="w-[calc(50%-0.375rem)] text-sm text-gray-600 xl:w-40">
            <span className="mb-1 block text-xs text-gray-500">From</span>
            <DateInput value={from} onChange={handleFromChange} />
          </label>
          <label className="w-[calc(50%-0.375rem)] text-sm text-gray-600 xl:w-40">
            <span className="mb-1 block text-xs text-gray-500">To</span>
            <DateInput value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="flex w-full overflow-hidden rounded-xl border border-slate-300 xl:w-auto">
            {[["prev", "Last Month"], ["this", "This Month"], ["next", "Next Month"]].map(([key, label]) => (
              <button type="button" key={key} onClick={() => setPreset(key)}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors xl:flex-none ${activePreset === key ? "bg-blue-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
          <button
            type="button"
            className="flex h-10 w-[calc(100%-0.5rem)] items-center justify-center gap-1.5 rounded-xl bg-blue-800 px-3 text-sm font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50 xl:w-auto xl:px-4"
            onClick={load}
            disabled={
              loading ||
              !isValidDateValue(from) ||
              !isValidDateValue(to) ||
              dayjs(to).isBefore(dayjs(from), "day")
            }
          >
            <Icon.Refresh
              className={`h-4 w-5 ${
                loading ? "animate-spin" : ""
              }`}
            />

            {loading ? "Loading" : "Refresh"}
          </button>
 
        {/* <div className="flex h-10 w-[calc(50%-0.5rem)] items-center justify-center rounded-xl bg-blue-50 px-2 text-center text-xs font-medium text-blue-800 xl:w-auto xl:px-3 xl:text-sm">Schedule date range</div> */}
      </div>
 
      <div className="border-b border-slate-200 p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Filter Employee Shift</h2>
          {/* <p className="text-sm text-slate-500">Narrow the selected schedule by rest day, shift type, or shift code.</p> */}
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={clearScheduleFilters}>Clear Filters</button>{groupBy !== "none" && <><button type="button" className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50" onClick={expandAllGroups}>Expand All</button><button type="button" className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50" onClick={collapseAllGroups}>Collapse All</button></>}<button type="button" className="rounded-xl bg-blue-800 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-900 md:hidden" onClick={() => setShowMobileFilters((visible) => !visible)}>{showMobileFilters ? "Hide Filters" : "Filter Options"}</button></div>
        </div>
        <div className={`${showMobileFilters ? "grid" : "hidden"} gap-3 md:grid md:grid-cols-2 xl:grid-cols-4`}>
          {canManage && <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Employee Shift View</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleView} onChange={(e) => handleScheduleViewChange(e.target.value)}><option value="MY">My Shift Schedule</option><option value="EMPLOYEE">Employee Shift Schedule</option></select></label>}
          {canManage && scheduleView === "EMPLOYEE" && <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Employee</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={selectedEmployeeNo} onChange={(e) => setSelectedEmployeeNo(e.target.value)}><option value="">All Employees</option>{employeeOptions.map((employee) => <option key={employee.empNo} value={employee.empNo}>{employee.empNo} - {employee.empName}</option>)}</select></label>}
          {canManage && <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Branch</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.branch} onChange={(e) => setScheduleFilter("branch", e.target.value)}><option value="all">All Branches</option>{filterOptions.branches.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>}
          {canManage && <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Department</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.department} onChange={(e) => setScheduleFilter("department", e.target.value)}><option value="all">All Departments</option>{filterOptions.departments.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>}
          {canManage && <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Payroll Group</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.payrollGroup} onChange={(e) => setScheduleFilter("payrollGroup", e.target.value)}><option value="all">All Payroll Groups</option>{filterOptions.payrollGroups.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>}
          {canManage && <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Employee Status</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.employeeStatus} onChange={(e) => setScheduleFilter("employeeStatus", e.target.value)}><option value="all">All Employee Statuses</option>{filterOptions.employeeStatuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>}
          <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Rest Day</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.restDay} onChange={(e) => setScheduleFilter("restDay", e.target.value)}><option value="all">All Days</option><option value="working">Working Days</option><option value="rest">Rest Days</option></select></label>
          <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Shift Type</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.shiftType} onChange={(e) => setScheduleFilter("shiftType", e.target.value)}><option value="all">All Shift Types</option>{filterOptions.shiftTypes.map((value) => <option key={value} value={value}>{shiftTypeLabel(value)}</option>)}</select></label>
          <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Shift Code</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={scheduleFilters.shiftCode} onChange={(e) => setScheduleFilter("shiftCode", e.target.value)}><option value="all">All Shift Codes</option>{filterOptions.shiftCodes.map(({ value, label }) => <option key={value} value={value}>{value}{label && label !== value ? ` - ${label}` : ""}</option>)}</select></label>
          <label className="text-xs sm:text-sm text-slate-600"><span className="mb-1 block text-xs font-medium">Group By</span><select className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm" value={groupBy} onChange={(e) => { setGroupBy(e.target.value); setCollapsedGroups([]); }}><option value="none">No Grouping</option><option value="employee">Employee</option><option value="branch">Branch</option><option value="department">Department</option><option value="payrollGroup">Payroll Group</option><option value="employeeStatus">Employee Status</option><option value="restDay">Rest Day</option><option value="shiftType">Shift Type</option><option value="shiftCode">Shift Code</option></select></label>
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
        {groupedRows.map((item, index) => {
          if (item.label) return <div key={`mobile-group-${item.label}`} className="flex items-center justify-between gap-2 rounded-xl bg-blue-800 px-3 py-2 text-sm font-semibold text-white"><span>{item.label} <span className="ml-1 text-xs font-normal text-blue-100">({item.count}) · {item.totalWorkHrs.toFixed(2)} hrs</span></span><button type="button" className="rounded-lg border border-blue-300 px-2 py-1 text-xs" onClick={() => toggleGroup(item.label)}>{item.collapsed ? "Expand" : "Collapse"}</button></div>;
          const row = item.row;
          const rowDate = row.date ?? row.shiftDate;
          const today = isToday(rowDate);
          const restDay = isRestDay(row);
          return (
            <div key={`mobile-${row.empNo ?? row.empno}-${rowDate}-${index}`} className={`rounded-xl border p-4 shadow-sm ${today ? "border-blue-200 bg-blue-50/50" : restDay ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Employee No: {row.empNo ?? row.empno ?? "-"}</p>
                  {canManage && <p className="mb-1 text-xs font-medium text-slate-500">{row.empName ?? row.emp_name ?? row.empNo}</p>}
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
              <th className="p-3">Employee No</th>
              {canManage && 
              <th className="p-3">Employee</th>}
              <th className="p-3">Shift Date</th>
              <th className="p-3">Shift Day</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3">Shift Type</th>
              <th className="p-3">Shift Code</th>
              <th className="p-3">Schedule</th>
              <th className="p-3">Remarks</th>
              <th className="p-3 text-right">Work Hours</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-slate-100">
                <td colSpan={canManage ? 10 : 9} className="p-3">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                </td>
              </tr>
            ))}
            {groupedRows.map((item, index) => {
              if (item.label) return <tr key={`group-${item.label}`} className="bg-blue-50"><td colSpan={canManage ? 10 : 9} className="border-y border-blue-100 px-3 py-2 text-sm font-semibold text-blue-900"><div className="flex items-center justify-between gap-3"><span>{item.label} <span className="text-xs font-normal text-blue-700">({item.count}) · Work Hours: {item.totalWorkHrs.toFixed(2)}</span></span><button type="button" className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-800" onClick={() => toggleGroup(item.label)}>{item.collapsed ? "Expand" : "Collapse"}</button></div></td></tr>;
              const row = item.row;
              const rowDate = row.date ?? row.shiftDate;
              const today = isToday(rowDate);
              const restDay = isRestDay(row);
              return (
                <tr
                  className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${today ? "bg-blue-50" : restDay ? "bg-red-50/40" : ""}`}
                  key={`${row.empNo ?? row.empno}-${row.date}-${index}`}
                >
                  <td className="text-xs p-2 text-gray-700">{row.empNo ?? row.empno ?? "-"}</td>
                  {canManage && <td className="text-xs p-2 text-gray-700">{row.empName ?? row.emp_name ?? row.empNo}</td>}
                  <td className="text-xs p-2">
                    <span className={`font-medium ${today ? "text-blue-800" : "text-gray-800"}`}>{fmt(rowDate)}</span>
                    {today && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">TODAY</span>}
                  </td>
                  <td className="text-xs p-2 text-gray-500">{row.day}</td>
                  <td className="text-xs p-2 text-center">
                    {restDay
                      ? <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">Rest Day</span>
                      : <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">Duty</span>}
                  </td>
                  <td className="text-xs p-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${shiftTypeStyle(row.shiftType ?? row.shift_type)}`}>
                      {shiftTypeLabel(row.shiftType ?? row.shift_type)}
                    </span>
                  </td>
                  <td className="text-xs p-2 font-medium text-gray-800">{row.shiftCode ?? row.shift_code ?? "-"}</td>

                  <td className="text-xs p-2 text-gray-600">{fmt(row.shiftIn ?? row.shift_in, true)} - {fmt(row.shiftOut ?? row.shift_out, true)}</td>
                  <td className="text-xs p-2">
                    {row.changeShiftRemarks
                      ? <div className="max-w-xs">
                          <p className="text-xs text-slate-700">{row.changeShiftRemarks}</p>
                          {/* {row.changeShiftType && <p className="mt-1 text-xs font-medium text-blue-700">{row.changeShiftType}</p>} */}
                        </div>
                      : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="text-xs p-2 text-right font-medium text-gray-800">{row.workHrs ?? row.work_hrs ?? 0}</td>
                </tr>
              );
            })}
            {!loading && !filteredRows.length && (
              <tr>
                <td colSpan={canManage ? 10 : 9} className="p-10 text-center">
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
 
      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold text-blue-900">HR / Approver Shift Upload</h2><p className="text-sm text-gray-500">Use the downloaded template. Only Employee No, Payroll Period, Date, RD Flag, Shift Code, and Working Hours are uploaded.</p></div><button type="button" onClick={downloadTemplate} className="rounded-xl border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">Download Template</button></div>
 
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
 
