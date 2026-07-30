import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import dayjs from "dayjs";
import html2pdf from "html2pdf.js";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CircleX,
  Clock3,
  FileText,
  FileSpreadsheet,
  FilterX,
  LayoutGrid,
  List,
  RefreshCw,
  RotateCcw,
  Search,
  Table2,
  User,
  Users,
  X,
} from "lucide-react";
import API_ENDPOINTS from "../apiConfig";
import { useAuth } from "./AuthContext";
import { useSidebarStore } from "./useSidebarStore";

const monthStart = () => dayjs().startOf("month").format("YYYY-MM-DD");
const monthEnd = () => dayjs().endOf("month").format("YYYY-MM-DD");
const text = (value) => String(value ?? "").trim();
const lower = (value) => text(value).toLowerCase();
const upper = (value) => text(value).toUpperCase();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatNumber = (value) => number(value).toFixed(2);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatEmployeeNoExport = (value) => {
  const clean = text(value);
  if (!clean) return "";
  return /^\d+$/.test(clean) ? clean.padStart(10, "0") : clean;
};

const buildExportTableHtml = (
  title,
  subtitle,
  exportRows,
  fontSize = 11,
  { excelMode = false } = {},
) => {
  const headers = Object.keys(exportRows[0] || {});
  const autoFilterLastRow = exportRows.length + 4;
  const autoFilterLastColumn = headers.length;
  const isTextColumn = (header) => header === "Employee No";
  const isDateTimeTextColumn = (header) => ["Time In", "Time Out", "Approval Date"].includes(header);
  const getColumnWidth = (header) => {
    const widths = {
      "Employee Name": 200,
      "Branch": 200,
      "Time In": 155,
      "Time Out": 155,
      "Approval Date": 155,
      "Leave Remarks": 230,
      "Approval Remarks": 230,
      "Approved By": 200,
    };

    return widths[header] || null;
  };
  const isGrandTotalRow = (row) => row?.["Employee No"] === "Grand Total";
  const renderCell = (row, header) => {
    const textStyle = isTextColumn(header) || isDateTimeTextColumn(header) ? 'mso-number-format:"\\@";' : "";
    const noWrapStyle = isDateTimeTextColumn(header) ? "white-space: nowrap;" : "";
    const totalStyle = isGrandTotalRow(row) ? "font-weight: 700;" : "";

    const value = row[header];
    const displayValue =
      excelMode && (isTextColumn(header) || isDateTimeTextColumn(header)) && value
        ? `="${String(value).replace(/"/g, '""')}"`
        : value;

    return `<td style="${textStyle}${noWrapStyle}${totalStyle}">${escapeHtml(displayValue)}</td>`;
  };

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(title)}</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                <x:AutoFilter x:Range="R4C1:R${autoFilterLastRow}C${autoFilterLastColumn}"/>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml><![endif]-->
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          p { font-size: 11px; margin: 0 0 20px; color: #475569; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: ${fontSize}px; }
          th { border: 1px solid #cbd5e1; background: #e2e8f0; padding: 4px; text-align: left; font-weight: 700; }
          td { border: 1px solid #e2e8f0; padding: 4px; vertical-align: top; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <table>
          <colgroup>
            ${headers
              .map((header) => {
                const width = getColumnWidth(header);
                return width ? `<col style="width: ${width}px;" />` : "<col />";
              })
              .join("")}
          </colgroup>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${exportRows
              .map(
                (row) =>
                  `<tr>${headers
                    .map((header) => renderCell(row, header))
                    .join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
};

const downloadExcelHtml = (filename, html) => {
  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MM/DD/YYYY") : text(value);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid()
    ? parsed.format("MM/DD/YYYY hh:mm A")
    : text(value);
};

const formatDateTimeExport = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid()
    ? parsed.format("MM/DD/YYYY h:mm:ss a")
    : text(value);
};

const formatReportDate = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MMMM D, YYYY") : text(value);
};

const formatReportDateRange = (start, end) =>
  `${formatReportDate(start)} to ${formatReportDate(end)}`;

const properCase = (value) => {
  const clean = text(value);
  if (!clean) return "-";
  return clean
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const findFirstValue = (object, keys, depth = 0) => {
  if (!object || typeof object !== "object" || depth > 5) return "";
  const normalizedKeys = keys.map((key) => key.toLowerCase());

  for (const key of Object.keys(object)) {
    if (normalizedKeys.includes(key.toLowerCase())) {
      const value = object[key];
      if (value !== undefined && value !== null && text(value)) return value;
    }
  }

  for (const value of Object.values(object)) {
    if (value && typeof value === "object") {
      const found = findFirstValue(value, keys, depth + 1);
      if (text(found)) return found;
    }
  }

  return "";
};

const getUserEmpNo = (user) =>
  text(
    findFirstValue(user, [
      "empNo",
      "empno",
      "EMP_NO",
      "EMPNO",
      "employeeNo",
      "employee_no",
      "userCode",
      "USER_CODE",
    ]),
  );

const getUserName = (user) =>
  text(
    findFirstValue(user, [
      "empName",
      "EMPNAME",
      "emp_name",
      "employeeName",
      "userName",
      "name",
    ]),
  );

const getUserHrFlag = (user) =>
  upper(findFirstValue(user, ["hr", "isHr", "hr_flag", "HR_FLAG", "hrFlag"]));

const getUserApprover = (user) =>
  text(findFirstValue(user, ["approver", "APPROVER", "appFlag", "APP_FLAG"]));

const parseJson = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const extractRows = (value) => {
  const parsed = parseJson(value);
  if (parsed !== value) return extractRows(parsed);

  if (Array.isArray(value)) {
    if (value.length === 1 && value[0] && typeof value[0] === "object") {
      const nested =
        extractRows(value[0].result) ||
        extractRows(value[0].RESULT) ||
        extractRows(value[0].data) ||
        extractRows(value[0].records);
      if (nested) return nested;
    }

    const flattened = value.flatMap((item) => {
      if (!item || typeof item !== "object") return [item];
      const nested = extractRows(item.result) || extractRows(item.RESULT);
      return nested || [item];
    });

    return flattened;
  }

  if (!value || typeof value !== "object") return null;

  if (value.success === false) {
    throw new Error(value.message || "Unable to load leave records.");
  }

  return (
    extractRows(value.data) ||
    extractRows(value.records) ||
    extractRows(value.result) ||
    extractRows(value.RESULT)
  );
};

const normalizeStatus = (value) => {
  const status = lower(value);
  if (status.includes("disapproved") || status.includes("rejected")) {
    return "Disapproved";
  }
  if (status.includes("cancel")) return "Cancelled";
  if (status.includes("approve")) return "Approved";
  if (status.includes("pending") || !status) return "Pending";
  return properCase(value);
};

const normalizeRow = (row, index) => {
  const empNo = text(row.empNo || row.empno || row.EMP_NO || row.EMPNO);
  const leaveStart = row.leaveStart || row.leavestart || row.LEAVE_START;
  const leaveEnd = row.leaveEnd || row.leaveend || row.LEAVE_END;
  const leaveStatus = normalizeStatus(
    row.leaveStatus || row.leavestatus || row.LEAVE_STATUS,
  );
  const lvStamp = text(row.lvStamp || row.lv_stamp || row.LV_STAMP);

  return {
    id: `${empNo || "employee"}-${text(leaveStart)}-${lvStamp || index}-${index}`,
    empNo,
    empName: text(row.empName || row.emp_name || row.EMPNAME || row.EMP_NAME),
    branchName: text(
      row.branchName || row.branchname || row.BRANCH_NAME || row.branch_name || row.branchDescription || row.branch_desc,
    ),
    department: text(
      row.department || row.Department || row.DEPARTMENT || row.deptName,
    ),
    leaveStart,
    leaveEnd,
    leaveDay: text(row.leaveDay || row.leaveday || row.LEAVE_DAY),
    leaveCode: text(row.leaveCode || row.leave_code || row.LEAVE_CODE),
    leaveDesc: text(row.leaveDesc || row.leave_desc || row.LEAVE_DESC),
    leaveHrs: number(row.leaveHrs ?? row.leavehrs ?? row.LEAVE_HRS),
    leaveDays: number(row.leaveDays ?? row.leavedays ?? row.LEAVE_DAYS),
    appHrs: number(row.appHrs ?? row.app_hrs ?? row.APP_HRS),
    appDays: number(row.appDays ?? row.app_days ?? row.APP_DAYS),
    leaveRemarks: text(
      row.leaveRemarks || row.leaveremarks || row.LEAVE_REMARKS,
    ),
    appRemarks: text(row.appRemarks || row.app_remarks || row.APP_REMARKS),
    leaveStatus,
    lvStamp,
    fileDate: row.fileDate || row.file_date || row.FILE_DATE,
    appUser: text(row.appUser || row.app_user || row.APP_USER),
    appDateTime:
      row.appDateTime || row.app_datetime || row.APP_DATETIME || row.app1_date,
    raw: row,
  };
};

const statusClass = (status) => {
  switch (normalizeStatus(status)) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "Pending":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "Disapproved":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "Cancelled":
      return "bg-slate-100 text-slate-700 ring-slate-300";
    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
};

const METRIC_ACCENTS = {
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
};

const MetricCard = ({
  label,
  value,
  icon: Icon,
  accent = "blue",
  active = false,
  onClick,
  subtitle,
}) => {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        {Icon && (
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              METRIC_ACCENTS[accent] || METRIC_ACCENTS.blue
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="text-xl font-bold text-blue-900">{value}</div>
      {subtitle && <div className="mt-0.5 text-[10px] text-gray-500">{subtitle}</div>}
    </>
  );

  const className = `rounded-xl border bg-white p-3.5 text-left shadow-sm transition sm:p-4 ${
    active
      ? "border-blue-500 ring-2 ring-blue-100"
      : "border-gray-200 hover:border-blue-200 hover:shadow-md"
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

const DateInput = ({ value, onChange, min }) => (
  <div className="relative">
    <input
      type="date"
      value={value}
      min={min}
      onChange={onChange}
      className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-10 text-xs text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700" aria-hidden="true" />
  </div>
);

const columns = [
  { key: "empNo", label: "Employee No", minWidth: 110 },
  { key: "empName", label: "Employee Name", minWidth: 220 },
  { key: "branchName", label: "Branch", minWidth: 150 },
  { key: "department", label: "Department", minWidth: 150 },
  { key: "fileDate", label: "Filed Date", minWidth: 120 },
  { key: "leaveStart", label: "Start Date", minWidth: 105 },
  { key: "leaveEnd", label: "End Date", minWidth: 105 },
  { key: "leaveDay", label: "Day", minWidth: 105 },
  { key: "leaveCode", label: "Leave Type", minWidth: 105 },
  { key: "leaveDesc", label: "Description", minWidth: 180 },
  { key: "leaveDays", label: "Requested Days", minWidth: 120, numeric: true },
  { key: "leaveHrs", label: "Requested Hours", minWidth: 125, numeric: true },
  { key: "appDays", label: "Approved Days", minWidth: 120, numeric: true },
  { key: "appHrs", label: "Approved Hours", minWidth: 125, numeric: true },
  { key: "leaveStatus", label: "Status", minWidth: 110 },
  { key: "leaveRemarks", label: "Leave Remarks", minWidth: 260 },
  { key: "appRemarks", label: "Approval Remarks", minWidth: 260 },
  { key: "appUser", label: "Approved By", minWidth: 160 },
  { key: "appDateTime", label: "Approval Date", minWidth: 165 },
];

const dateKeys = new Set(["leaveStart", "leaveEnd", "fileDate"]);
const dateTimeKeys = new Set(["appDateTime"]);
const numericKeys = new Set(["leaveDays", "leaveHrs", "appDays", "appHrs"]);

const getDisplayValue = (row, key) => {
  if (dateKeys.has(key)) return formatDate(row[key]);
  if (dateTimeKeys.has(key)) return formatDateTime(row[key]);
  if (numericKeys.has(key)) return formatNumber(row[key]);
  if (key === "leaveStatus") return normalizeStatus(row[key]);
  return text(row[key]) || "-";
};

const compareRows = (left, right, key, direction) => {
  const multiplier = direction === "desc" ? -1 : 1;

  if (numericKeys.has(key)) {
    return (number(left[key]) - number(right[key])) * multiplier;
  }

  if (dateKeys.has(key) || dateTimeKeys.has(key)) {
    const leftTime = dayjs(left[key]).isValid() ? dayjs(left[key]).valueOf() : 0;
    const rightTime = dayjs(right[key]).isValid() ? dayjs(right[key]).valueOf() : 0;
    return (leftTime - rightTime) * multiplier;
  }

  return (
    getDisplayValue(left, key).localeCompare(getDisplayValue(right, key), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * multiplier
  );
};

const groupOptions = [
  { value: "none", label: "No Grouping" },
  { value: "empName", label: "Employee" },
  { value: "branchName", label: "Branch" },
  { value: "leaveCode", label: "Leave Type" },
  { value: "leaveStatus", label: "Status" },
  { value: "leaveMonth", label: "Leave Month" },
];

const getGroupValue = (row, groupBy) => {
  switch (groupBy) {
    case "empName":
      return `${row.empName || "Unknown Employee"} (${row.empNo || "No Employee No"})`;
    case "leaveCode":
      return `${row.leaveCode || "No Code"} - ${row.leaveDesc || "No Description"}`;
    case "branchName":
      return row.branchName || "No Branch";
    case "leaveStatus":
      return normalizeStatus(row.leaveStatus);
    case "leaveMonth":
      return dayjs(row.leaveStart).isValid()
        ? dayjs(row.leaveStart).format("MMMM YYYY")
        : "No Leave Month";
    default:
      return "All Records";
  }
};

export default function LeaveMonitoring() {
  const { user } = useAuth();
  const isSidebarOpen = useSidebarStore((state) => state.isOpen);
  const currentEmpNo = getUserEmpNo(user);
  const currentEmpName = getUserName(user) || currentEmpNo;
  const canViewEmployeeLeave =
    getUserApprover(user) === "1" || getUserHrFlag(user) === "Y";

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(monthEnd);
  const [scope, setScope] = useState("MY");
  const [employeeNo, setEmployeeNo] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rows, setRows] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [groupBy, setGroupBy] = useState("none");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [sortConfig, setSortConfig] = useState({
    key: "leaveStart",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [layoutMode, setLayoutMode] = useState("auto");
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined"
      ? 1440
      : window.visualViewport?.width || window.innerWidth,
  );
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [employeeDirectory, setEmployeeDirectory] = useState([]);

  const requestIdRef = useRef(0);
  const recordsSignatureRef = useRef("");

  useEffect(() => {
    if (!canViewEmployeeLeave) {
      setScope("MY");
      setEmployeeNo(currentEmpNo);
    }
  }, [canViewEmployeeLeave, currentEmpNo]);

  useEffect(() => {
    if (scope === "MY") setEmployeeNo(currentEmpNo);
  }, [scope, currentEmpNo]);

  useEffect(() => {
    if (!canViewEmployeeLeave || !currentEmpNo || !API_ENDPOINTS?.getAllDTRHR) return undefined;

    let active = true;
    const loadEmployeeDirectory = async () => {
      try {
        const response = await axios.get(API_ENDPOINTS.getAllDTRHR, {
          params: {
            startDate,
            endDate,
            START_DATE: startDate,
            END_DATE: endDate,
            empno: currentEmpNo,
            EMPNO: currentEmpNo,
            empNo: currentEmpNo,
            EMP_NO: currentEmpNo,
          },
          headers: { Accept: "application/json" },
        });
        const directory = (extractRows(response.data) || [])
          .map((row) => ({
            empNo: text(findFirstValue(row, ["empNo", "empno", "EMP_NO", "employeeNo"])),
            empName: text(findFirstValue(row, ["empName", "emp_name", "EMPNAME", "employeeName", "name"])),
          }))
          .filter((employee) => employee.empNo);
        if (active) setEmployeeDirectory(directory);
      } catch {
        if (active) setEmployeeDirectory([]);
      }
    };

    loadEmployeeDirectory();
    return () => {
      active = false;
    };
  }, [canViewEmployeeLeave, currentEmpNo, startDate, endDate]);

  useEffect(() => {
    const handleResize = () =>
      setViewportWidth(window.visualViewport?.width || window.innerWidth);

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  const sidebarWidth = viewportWidth >= 1024 && isSidebarOpen ? 200 : 0;
  const contentWidth = Math.max(0, viewportWidth - sidebarWidth);
  const detectedDevice =
    contentWidth < 640 ? "mobile" : contentWidth < 1024 ? "tablet" : "desktop";
  const effectiveLayout =
    layoutMode === "auto"
      ? detectedDevice === "desktop"
        ? "table"
        : detectedDevice === "tablet"
          ? "accordion"
          : "card"
      : layoutMode;

  const targetEmployeeNo =
    scope === "MY"
      ? currentEmpNo
      : scope === "ALL" || !text(employeeNo)
        ? "ALL"
        : text(employeeNo);
  const shouldLoadAllEmployees = targetEmployeeNo === "ALL";

  const loadLeaves = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        if (silent) setIsRefreshing(true);
        else {
          setLoading(true);
          setError("");
        }

        if (!startDate || !endDate) {
          throw new Error("Please select Start Date and End Date.");
        }
        if (dayjs(startDate).isAfter(dayjs(endDate), "day")) {
          throw new Error("Start Date must not be greater than End Date.");
        }
        if (!targetEmployeeNo || (shouldLoadAllEmployees && !employeeDirectory.length)) {
          throw new Error(
            scope === "MY"
              ? "Employee No. is missing from the logged-in user."
              : shouldLoadAllEmployees
                ? "No employee directory is available for All Employees."
                : "Please select an Employee No. before loading employee leave.",
          );
        }

        const endpoint =
          text(API_ENDPOINTS?.getLeaveInquiry) || "/api/getLVInquiry";

        const employeeTargets = shouldLoadAllEmployees
          ? Array.from(new Set(employeeDirectory.map((employee) => text(employee.empNo)).filter(Boolean)))
          : [targetEmployeeNo];
        const responses = await Promise.all(
          employeeTargets.map((employee) => axios.post(
            endpoint,
            {
              EMP_NO: employee,
              START_DATE: startDate,
              END_DATE: endDate,
              // Always retrieve all statuses so the status cards remain accurate.
              STAT: null,
            },
            { headers: { Accept: "application/json" } },
          )),
        );

        const nextRows = responses.flatMap((response) => extractRows(response.data) || []).map(normalizeRow);
        const nextSignature = JSON.stringify(nextRows);

        if (
          requestId === requestIdRef.current &&
          nextSignature !== recordsSignatureRef.current
        ) {
          recordsSignatureRef.current = nextSignature;
          setRows(nextRows);
        }

        if (requestId === requestIdRef.current) {
          setCurrentPage(1);
          setError("");
        }
      } catch (requestError) {
        if (requestId === requestIdRef.current && !silent) {
          recordsSignatureRef.current = "";
          setRows([]);
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Unable to load leave records.",
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [startDate, endDate, targetEmployeeNo, scope, shouldLoadAllEmployees, employeeDirectory],
  );

  useEffect(() => {
    if (currentEmpNo) loadLeaves();
    // Initial load only. Date changes are applied through the Load button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmpNo]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden || !targetEmployeeNo) return;
      loadLeaves({ silent: true });
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [loadLeaves, targetEmployeeNo]);

  const employeeOptions = useMemo(() => {
    const employees = new Map();

    if (currentEmpNo) {
      employees.set(currentEmpNo, {
        empNo: currentEmpNo,
        empName: currentEmpName || currentEmpNo,
        department: "",
      });
    }
    employeeDirectory.forEach((employee) => {
      if (!employee.empNo || employees.has(employee.empNo)) return;
      employees.set(employee.empNo, {
        empNo: employee.empNo,
        empName: employee.empName || employee.empNo,
      });
    });
    rows.forEach((row) => {
      if (!row.empNo || employees.has(row.empNo)) return;
      employees.set(row.empNo, {
        empNo: row.empNo,
        empName: row.empName || row.empNo,
      });
    });
    return Array.from(employees.values()).sort((left, right) =>
      left.empName.localeCompare(right.empName, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [rows, employeeDirectory, currentEmpNo, currentEmpName]);

  const statusCounts = useMemo(() => {
    const counts = {
      Pending: 0,
      Approved: 0,
      Disapproved: 0,
      Cancelled: 0,
    };

    rows.forEach((row) => {
      const normalized = normalizeStatus(row.leaveStatus);
      if (Object.prototype.hasOwnProperty.call(counts, normalized)) {
        counts[normalized] += 1;
      }
    });

    return counts;
  }, [rows]);

  const pendingAttentionCount = useMemo(
    () =>
      rows.filter((row) => {
        if (normalizeStatus(row.leaveStatus) !== "Pending") return false;
        if (!row.fileDate || !dayjs(row.fileDate).isValid()) return false;
        return dayjs().diff(dayjs(row.fileDate), "day") >= 3;
      }).length,
    [rows],
  );

  const filteredRows = useMemo(() => {
    const keyword = lower(searchText);
    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([, value]) => text(value) !== "",
    );

    return rows.filter((row) => {
      if (
        statusFilter !== "ALL" &&
        normalizeStatus(row.leaveStatus) !== statusFilter
      ) {
        return false;
      }

      if (keyword) {
        const searchable = columns
          .map((column) => getDisplayValue(row, column.key))
          .concat([row.lvStamp])
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(keyword)) return false;
      }

      return activeColumnFilters.every(([key, value]) =>
        lower(getDisplayValue(row, key)).includes(lower(value)),
      );
    });
  }, [rows, statusFilter, searchText, columnFilters]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredRows;
    return [...filteredRows].sort((left, right) =>
      compareRows(left, right, sortConfig.key, sortConfig.direction),
    );
  }, [filteredRows, sortConfig]);

  const groupedRows = useMemo(() => {
    if (groupBy === "none") return [];
    const groups = new Map();

    sortedRows.forEach((row) => {
      const label = getGroupValue(row, groupBy);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row);
    });

    return Array.from(groups.entries()).map(([label, groupRows]) => ({
      id: `${groupBy}:${label}`,
      label,
      rows: groupRows,
      requestedDays: groupRows.reduce((sum, row) => sum + row.leaveDays, 0),
      approvedDays: groupRows.reduce((sum, row) => sum + row.appDays, 0),
    }));
  }, [sortedRows, groupBy]);

  const totals = useMemo(
    () => ({
      requestedDays: filteredRows.reduce((sum, row) => sum + row.leaveDays, 0),
      requestedHours: filteredRows.reduce((sum, row) => sum + row.leaveHrs, 0),
      approvedDays: filteredRows.reduce((sum, row) => sum + row.appDays, 0),
      approvedHours: filteredRows.reduce((sum, row) => sum + row.appHrs, 0),
    }),
    [filteredRows],
  );

  const pageCollection = groupBy === "none" ? sortedRows : groupedRows;
  const totalPages = Math.max(1, Math.ceil(pageCollection.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const firstIndex = (safePage - 1) * rowsPerPage;
  const pageItems = pageCollection.slice(firstIndex, firstIndex + rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchText, columnFilters, groupBy, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleSort = (key) => {
    setSortConfig((previous) => {
      if (previous.key !== key) return { key, direction: "asc" };
      if (previous.direction === "asc") return { key, direction: "desc" };
      if (previous.direction === "desc") return { key: null, direction: null };
      return { key, direction: "asc" };
    });
  };

  const handleReset = () => {
    setStartDate(monthStart());
    setEndDate(monthEnd());
    setScope("MY");
    setEmployeeNo(currentEmpNo);
    setStatusFilter("ALL");
    setSearchText("");
    setColumnFilters({});
    setShowColumnFilters(true);
    setGroupBy("none");
    setExpandedGroups({});
    setExpandedRows({});
    setSortConfig({ key: "leaveStart", direction: "desc" });
    setRowsPerPage(20);
    setCurrentPage(1);
    setLayoutMode("auto");
    setError("");
  };

  const clearAllFilters = () => {
    setStatusFilter("ALL");
    setSearchText("");
    setColumnFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    Boolean(searchText.trim()) ||
    Object.values(columnFilters).some((value) => text(value));

  const toggleStatusCard = (selectedStatus) => {
    setStatusFilter((previous) =>
      previous === selectedStatus ? "ALL" : selectedStatus,
    );
    setCurrentPage(1);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupId]: previous[groupId] === false,
    }));
  };

  const setAllGroupsExpanded = (expanded) => {
    setExpandedGroups(
      Object.fromEntries(groupedRows.map((group) => [group.id, expanded])),
    );
  };

  const toggleRecord = (rowId) => {
    setExpandedRows((previous) => ({
      ...previous,
      [rowId]: !previous[rowId],
    }));
  };

  const buildExportRows = () => {
    const exportRows = [];
    const appendRecord = (row) => {
      exportRows.push(
        Object.fromEntries(
          columns.map((column) => [
            column.label,
            column.key === "empNo"
              ? formatEmployeeNoExport(row[column.key])
              : numericKeys.has(column.key)
              ? number(row[column.key])
              : dateTimeKeys.has(column.key)
                ? formatDateTimeExport(row[column.key])
              : getDisplayValue(row, column.key),
          ]),
        ),
      );
    };

    if (groupBy === "none") {
      sortedRows.forEach(appendRecord);
    } else {
      groupedRows.forEach((group) => {
        group.rows.forEach(appendRecord);
        exportRows.push({
          "Employee No": `${group.label} Subtotal`,
          "Requested Days": Number(group.requestedDays.toFixed(2)),
          "Approved Days": Number(group.approvedDays.toFixed(2)),
        });
      });
    }

    exportRows.push({
      "Employee No": "Grand Total",
      "Requested Days": Number(totals.requestedDays.toFixed(2)),
      "Requested Hours": Number(totals.requestedHours.toFixed(2)),
      "Approved Days": Number(totals.approvedDays.toFixed(2)),
      "Approved Hours": Number(totals.approvedHours.toFixed(2)),
    });

    return exportRows;
  };
  const exportEmployeeLabel =
    targetEmployeeNo === "ALL" ? "All Employees" : targetEmployeeNo;

  const exportExcel = () => {
    if (!canViewEmployeeLeave || !sortedRows.length) return;

    const exportRows = buildExportRows();
    downloadExcelHtml(
      `Leave_Monitoring_${targetEmployeeNo}_${startDate}_to_${endDate}.xls`,
      buildExportTableHtml(
        "Leave Monitoring",
        `${exportEmployeeLabel || "All Employees"} - ${formatReportDateRange(startDate, endDate)}`,
        exportRows,
        10,
        { excelMode: true },
      ),
    );
  };

  const exportPdf = () => {
    if (!sortedRows.length) return;

    const exportRows = buildExportRows();
    const element = document.createElement("div");
    element.innerHTML = buildExportTableHtml(
      "Leave Monitoring",
      `${exportEmployeeLabel || "All Employees"} - ${formatReportDateRange(startDate, endDate)}`,
      exportRows,
      7,
    );

    html2pdf()
      .set({
        margin: 8,
        filename: `Leave_Monitoring_${targetEmployeeNo || "All"}_${startDate}_to_${endDate}.pdf`,
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "pt", format: "letter", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(element)
      .save();
  };

  const renderSortIcon = (column) => {
    if (sortConfig.key !== column.key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-blue-100" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-white" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-white" />
    );
  };

  const renderTableCell = (row, column) => {
    if (column.key === "leaveStatus") {
      return (
        <span
          className={`inline-flex w-[92px] justify-center rounded-xl px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusClass(
            row.leaveStatus,
          )}`}
        >
          {normalizeStatus(row.leaveStatus)}
        </span>
      );
    }

    if (numericKeys.has(column.key)) {
      const approved = column.key.startsWith("app");
      return (
        <span className={`font-bold ${approved ? "text-emerald-800" : "text-blue-900"}`}>
          {formatNumber(row[column.key])}
        </span>
      );
    }

    return getDisplayValue(row, column.key);
  };

  const renderTableRecordRow = (row, rowIndex = 0) => (
    <tr
      key={row.id}
      className="group bg-white transition hover:bg-blue-50/70"
    >
      {columns.map((column) => (
        <td
          key={column.key}
          className={`whitespace-nowrap border-b border-gray-100 px-3 py-2.5 align-middle text-[11px] text-gray-700 ${
            column.numeric ? "text-right" : "text-left"
          } ${
            column.key === "empName"
              ? "sticky left-0 z-[1] max-w-[220px] overflow-hidden bg-white text-ellipsis shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)] transition-colors group-hover:bg-blue-50/70"
              : ""
          }`}
          style={{ minWidth: column.minWidth }}
          title={getDisplayValue(row, column.key)}
        >
          {renderTableCell(row, column)}
        </td>
      ))}
    </tr>
  );

  const renderTableView = () => (
    <div className="max-h-[500px] w-full max-w-full overflow-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[2200px] border-collapse text-left">
        <thead className="sticky top-0 z-20 bg-blue-800 shadow-sm">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap border-b border-blue-900 bg-blue-800 px-2 py-2 text-[11px] font-semibold text-white ${
                  column.numeric ? "text-right" : "text-left"
                } ${
                  column.key === "empName"
                    ? "sticky left-0 z-30 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]"
                    : ""
                }`}
                style={{ minWidth: column.minWidth }}
              >
                <button
                  type="button"
                  onClick={() => handleSort(column.key)}
                  className={`inline-flex w-full items-center gap-1 ${
                    column.numeric ? "justify-end" : "justify-start"
                  }`}
                >
                  <span>{column.label}</span>
                  {renderSortIcon(column)}
                </button>
              </th>
            ))}
          </tr>

          {showColumnFilters && (
            <tr className="bg-blue-50">
              {columns.map((column) => (
                <th
                  key={`filter-${column.key}`}
                  className={`whitespace-nowrap border-b border-blue-100 bg-blue-50 px-2 py-2 ${
                    column.key === "empName"
                      ? "sticky left-0 z-30 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]"
                      : ""
                  }`}
                  style={{ minWidth: column.minWidth }}
                >
                  <input
                    type="text"
                    value={columnFilters[column.key] || ""}
                    onChange={(event) =>
                      setColumnFilters((previous) => ({
                        ...previous,
                        [column.key]: event.target.value,
                      }))
                    }
                    placeholder="Filter"
                    className="h-8 w-full rounded-xl border border-gray-200 bg-white px-2 text-[11px] font-normal text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </th>
              ))}
            </tr>
          )}
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-xs font-medium text-gray-500"
              >
                Loading leave records...
              </td>
            </tr>
          ) : pageItems.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-xs font-medium text-gray-500"
              >
                No leave records found.
              </td>
            </tr>
          ) : groupBy === "none" ? (
            pageItems.map(renderTableRecordRow)
          ) : (
            pageItems.map((group) => {
              const expanded = expandedGroups[group.id] !== false;
              return (
                <Fragment key={group.id}>
                  <tr className="bg-blue-50">
                    <td
                      colSpan={columns.length}
                      className="border-b border-blue-100 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-blue-800" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-blue-800" />
                        )}
                        <span className="font-semibold text-blue-900">
                          {group.label}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                          {group.rows.length} records
                        </span>
                        <span className="ml-auto text-xs font-bold text-blue-900">
                          {formatNumber(group.requestedDays)} requested ·{" "}
                          {formatNumber(group.approvedDays)} approved days
                        </span>
                      </button>
                    </td>
                  </tr>
                  {expanded && group.rows.map(renderTableRecordRow)}
                </Fragment>
              );
            })
          )}
        </tbody>

        {sortedRows.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 bg-blue-50">
            <tr>
              <td colSpan={8} className="px-2 py-2 text-right text-[11px] font-semibold text-blue-900">
                Total:
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold text-blue-900">
                {formatNumber(totals.requestedDays)}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold text-blue-900">
                {formatNumber(totals.requestedHours)}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold text-emerald-800">
                {formatNumber(totals.approvedDays)}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold text-emerald-800">
                {formatNumber(totals.approvedHours)}
              </td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  const renderRecordDetails = (row) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-[11px] font-semibold text-slate-500">Employee</div>
        <div className="mt-1 font-semibold text-slate-800">
          {row.empName || "-"}
        </div>
        <div className="text-[11px] text-slate-500">{row.empNo || "-"}</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-[11px] font-semibold text-slate-500">Branch / Department</div>
        <div className="mt-1 font-medium text-slate-800">{row.branchName || "-"}</div>
        <div className="text-[11px] text-slate-500">{row.department || "-"}</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-[11px] font-semibold text-slate-500">Leave Type</div>
        <div className="mt-1 font-semibold text-slate-800">
          {row.leaveCode || "-"} - {row.leaveDesc || "-"}
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-[11px] font-semibold text-slate-500">Leave Period</div>
        <div className="mt-1 font-semibold text-slate-800">
          {formatDate(row.leaveStart)} – {formatDate(row.leaveEnd)}
        </div>
        <div className="text-[11px] text-slate-500">{row.leaveDay || "-"}</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-[11px] font-semibold text-slate-500">Requested / Approved</div>
        <div className="mt-1 font-semibold text-blue-900">
          {formatNumber(row.leaveDays)} days · {formatNumber(row.leaveHrs)} hours
        </div>
        <div className="text-[11px] font-semibold text-emerald-700">
          {formatNumber(row.appDays)} approved days · {formatNumber(row.appHrs)} approved hours
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
        <div className="text-[11px] font-semibold text-slate-500">Leave Remarks</div>
        <div className="mt-1 text-sm text-slate-800">{row.leaveRemarks || "-"}</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
        <div className="text-[11px] font-semibold text-slate-500">Approval Details</div>
        <div className="mt-1 text-sm text-slate-800">{row.appRemarks || "-"}</div>
        <div className="mt-1 text-[11px] text-slate-500">
          {row.appUser || "No approver"} · {formatDateTime(row.appDateTime)}
        </div>
      </div>
    </div>
  );

  const renderRecordCard = (row) => (
    <article
      key={row.id}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div className="min-w-0">
          <div className="truncate font-bold text-slate-800">
            {row.empName || "Unknown Employee"}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500">
            {row.empNo || "-"} · {row.branchName || "No Branch"} · {row.leaveCode || "No Leave Code"}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusClass(
            row.leaveStatus,
          )}`}
        >
          {normalizeStatus(row.leaveStatus)}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Leave Period</div>
            <div className="mt-0.5 font-semibold text-slate-800">
              {formatDate(row.leaveStart)} – {formatDate(row.leaveEnd)}
            </div>
            <div className="text-[11px] text-slate-500">{row.leaveDay || "-"}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-500">Requested</div>
            <div className="mt-0.5 text-xl font-bold text-blue-800">
              {formatNumber(row.leaveDays)} days
            </div>
            <div className="text-[11px] font-semibold text-blue-700">
              {formatNumber(row.leaveHrs)} hours
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 p-3">
          <div className="text-[11px] font-semibold text-emerald-700">Approved</div>
          <div className="mt-1 font-bold text-emerald-900">
            {formatNumber(row.appDays)} days · {formatNumber(row.appHrs)} hours
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-500">Description</div>
          <div className="mt-1 text-sm font-medium text-slate-800">
            {row.leaveDesc || "-"}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-500">Remarks</div>
          <div className="mt-1 text-xs text-slate-700">{row.leaveRemarks || "-"}</div>
        </div>

        <div className="border-t border-gray-100 pt-3 text-[11px] text-slate-500">
          Filed {formatDate(row.fileDate)} · {row.appUser ? `Processed by ${row.appUser}` : "Not yet processed"}
        </div>
      </div>
    </article>
  );

  const renderCardView = () => {
    if (loading) {
      return <div className="p-12 text-center text-xs text-gray-500">Loading leave records...</div>;
    }
    if (pageItems.length === 0) {
      return <div className="p-12 text-center text-xs text-gray-500">No leave records found.</div>;
    }

    if (groupBy === "none") {
      return (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {pageItems.map(renderRecordCard)}
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        {pageItems.map((group) => {
          const expanded = expandedGroups[group.id] !== false;
          return (
            <section key={group.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 bg-blue-50 px-4 py-3 text-left"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-blue-800" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-blue-800" />
                )}
                <span className="font-semibold text-blue-900">{group.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                  {group.rows.length}
                </span>
                <span className="ml-auto text-xs font-bold text-blue-900">
                  {formatNumber(group.requestedDays)} requested · {formatNumber(group.approvedDays)} approved
                </span>
              </button>
              {expanded && (
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
                  {group.rows.map(renderRecordCard)}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const renderAccordionRow = (row) => {
    const expanded = Boolean(expandedRows[row.id]);
    return (
      <article key={row.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => toggleRecord(row.id)}
          className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-blue-50"
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-800">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-slate-800">
                {row.empName || row.empNo || "Unknown Employee"}
              </span>
              <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 sm:inline-flex ${statusClass(row.leaveStatus)}`}>
                {normalizeStatus(row.leaveStatus)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              {row.leaveCode || "-"} · {formatDate(row.leaveStart)} – {formatDate(row.leaveEnd)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-bold text-blue-800">
              {formatNumber(row.leaveDays)} <span className="text-[10px] font-semibold text-gray-400">days</span>
            </div>
            <div className="text-[10px] font-semibold text-emerald-700">
              {formatNumber(row.appDays)} approved
            </div>
          </div>
        </button>
        {expanded && (
          <div className="space-y-3 border-t border-gray-100 p-4">
            {renderRecordDetails(row)}
          </div>
        )}
      </article>
    );
  };

  const renderAccordionView = () => {
    if (loading) {
      return <div className="p-12 text-center text-xs text-gray-500">Loading leave records...</div>;
    }
    if (pageItems.length === 0) {
      return <div className="p-12 text-center text-xs text-gray-500">No leave records found.</div>;
    }

    if (groupBy === "none") {
      return <div className="space-y-2 p-4">{pageItems.map(renderAccordionRow)}</div>;
    }

    return (
      <div className="space-y-3 p-4">
        {pageItems.map((group) => {
          const expanded = expandedGroups[group.id] !== false;
          return (
            <section key={group.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 bg-blue-50 px-4 py-3 text-left"
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-blue-800" /> : <ChevronRight className="h-4 w-4 text-blue-800" />}
                <span className="font-semibold text-blue-900">{group.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-800">{group.rows.length}</span>
                <span className="ml-auto text-xs font-bold text-blue-900">
                  {formatNumber(group.requestedDays)} requested · {formatNumber(group.approvedDays)} approved
                </span>
              </button>
              {expanded && <div className="space-y-2 p-3">{group.rows.map(renderAccordionRow)}</div>}
            </section>
          );
        })}
      </div>
    );
  };

  const renderDataView = () => {
    if (effectiveLayout === "card") return renderCardView();
    if (effectiveLayout === "accordion") return renderAccordionView();
    return renderTableView();
  };

  const paginationLabel = groupBy === "none" ? "records" : "groups";
  const displayedStart = pageCollection.length === 0 ? 0 : firstIndex + 1;
  const displayedEnd = Math.min(firstIndex + rowsPerPage, pageCollection.length);

  return (
    <div
      className={`ml-0 mt-[80px] min-h-screen w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-gray-100 p-2 sm:p-4 ${
        isSidebarOpen
          ? "lg:ml-[200px] lg:w-[calc(99vw-200px)] lg:max-w-[calc(100vw-200px)]"
          : "lg:ml-0 lg:w-full lg:max-w-[100vw]"
      }`}
    >
      <div className="mx-auto w-full min-w-0 max-w-full space-y-4 transition-all">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Leave Monitoring</h1>
        </div>

        <section className="min-w-0 max-w-full rounded-xl bg-white p-4 shadow-md sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Filter Leave Records</h2>
              <p className="mt-1 text-xs text-gray-500">
                Review leave applications, approved quantities, aging, and approval status in one responsive view.
              </p>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => loadLeaves()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-800 px-2.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:px-4 sm:text-xs"
              >
                <RefreshCw className={`h-4 w-4 shrink-0 ${loading || isRefreshing ? "animate-spin" : ""}`} />
                <span className="truncate">{loading ? "Loading..." : isRefreshing ? "Refreshing..." : "Load"}</span>
              </button>

              {canViewEmployeeLeave ? (
                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={!sortedRows.length}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-800 px-2.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:px-4 sm:text-xs"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  <span className="truncate">Export Excel</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={!sortedRows.length}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-700 px-2.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:px-4 sm:text-xs"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">Export PDF</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-800 px-2.5 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-700 sm:gap-2 sm:px-4 sm:text-xs"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span className="truncate">Reset</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex justify-end sm:hidden">
            <button
              type="button"
              onClick={() => setShowFilters((previous) => !previous)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800"
            >
              {showFilters ? "Hide Filter Options" : "Show Filter Options"}
              {showFilters ? <ChevronDown className="h-4 w-4 rotate-180" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          <div className={`${showFilters ? "block" : "hidden"} sm:block`}>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[10rem_10rem_12rem_minmax(18rem,1fr)_11rem]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Start Date</label>
              <DateInput value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">End Date</label>
              <DateInput value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Leave View</label>
              <select
                value={scope}
                onChange={(event) => {
                  if (!canViewEmployeeLeave) return;
                  const nextScope = event.target.value;
                  setScope(nextScope);
                  setEmployeeNo(nextScope === "MY" ? currentEmpNo : "");
                  setRows([]);
                  recordsSignatureRef.current = "";
                }}
                disabled={!canViewEmployeeLeave}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                <option value="MY">My Leave</option>
                <option value="ALL">All Employees</option>
                <option value="EMPLOYEE">Employee Leave</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Employee Name</label>
              <select
                value={scope === "MY" ? currentEmpNo : employeeNo}
                onChange={(event) => setEmployeeNo(event.target.value)}
                disabled={scope !== "EMPLOYEE" || !canViewEmployeeLeave}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                <option value="">All Employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.empNo} value={employee.empNo}>
                    ({employee.empNo}) - {employee.empName} 
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Status</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Disapproved">Disapproved</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search employee, leave type, dates, status, remarks, or approver..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 2xl:flex">
              <div className="sm:w-[150px]">
                <label className="mb-1 block text-[11px] font-semibold text-gray-600">Group By</label>
                <select
                  value={groupBy}
                  onChange={(event) => {
                    setGroupBy(event.target.value);
                    setExpandedGroups({});
                  }}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {groupOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="sm:w-[140px]">
                <label className="mb-1 block text-[11px] font-semibold text-gray-600">Layout</label>
                <select
                  value={layoutMode}
                  onChange={(event) => setLayoutMode(event.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="auto">Auto Responsive</option>
                  <option value="table">Table</option>
                  <option value="accordion">Accordion</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowColumnFilters((previous) => !previous)}
                className={`mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
                  showColumnFilters
                    ? "border-blue-800 bg-blue-800 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Table2 className="h-4 w-4" />
                Column Filters
              </button>

              <button
                type="button"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
                className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FilterX className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>

          {showColumnFilters && effectiveLayout !== "table" && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-800">Column Filters</div>
                  <div className="text-[11px] text-gray-500">Available in Card and Accordion layouts.</div>
                </div>
                {Object.values(columnFilters).some((value) => text(value)) && (
                  <button
                    type="button"
                    onClick={() => setColumnFilters({})}
                    className="text-[11px] font-semibold text-blue-800 hover:underline"
                  >
                    Clear Column Filters
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {columns.map((column) => (
                  <div key={`responsive-filter-${column.key}`}>
                    <label className="mb-1 block text-[11px] font-semibold text-gray-600">{column.label}</label>
                    <input
                      type="text"
                      value={columnFilters[column.key] || ""}
                      onChange={(event) =>
                        setColumnFilters((previous) => ({
                          ...previous,
                          [column.key]: event.target.value,
                        }))
                      }
                      placeholder={`Filter ${column.label}`}
                      className="h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 xl:grid-cols-4">
            <MetricCard
              label="Pending"
              value={statusCounts.Pending}
              icon={Clock3}
              accent="amber"
              active={statusFilter === "Pending"}
              onClick={() => toggleStatusCard("Pending")}
            />
            <MetricCard
              label="Approved"
              value={statusCounts.Approved}
              icon={CheckCircle2}
              accent="emerald"
              active={statusFilter === "Approved"}
              onClick={() => toggleStatusCard("Approved")}
            />
            <MetricCard
              label="Disapproved"
              value={statusCounts.Disapproved}
              icon={CircleX}
              accent="rose"
              active={statusFilter === "Disapproved"}
              onClick={() => toggleStatusCard("Disapproved")}
            />
            <MetricCard
              label="Cancelled"
              value={statusCounts.Cancelled}
              icon={Ban}
              accent="slate"
              active={statusFilter === "Cancelled"}
              onClick={() => toggleStatusCard("Cancelled")}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 xl:grid-cols-4">
            <MetricCard label="Loaded Records" value={rows.length} icon={Table2} accent="blue" />
            <MetricCard label="Displayed Records" value={filteredRows.length} icon={Users} accent="violet" />
            
            <MetricCard
              label="Requested Days"
              value={formatNumber(totals.requestedDays)}
              icon={CalendarDays}
              accent="blue"
            />
            <MetricCard
              label="Pending 3+ Days"
              value={pendingAttentionCount}
              icon={AlertTriangle}
              accent="rose"
              subtitle="Needs follow-up"
              active={statusFilter === "Pending" && pendingAttentionCount > 0}
              onClick={() => setStatusFilter("Pending")}
            />
          </div>
          
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="min-w-0 overflow-hidden rounded-xl bg-white shadow-lg">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold text-gray-900">Leave Records</div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                Status cards are clickable. Data refreshes automatically every 60 seconds while this page is visible.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {groupBy !== "none" && (
                <>
                  <button
                    type="button"
                    onClick={() => setAllGroupsExpanded(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <ChevronsDown className="h-3.5 w-3.5" />
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllGroupsExpanded(false)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <ChevronsUp className="h-3.5 w-3.5" />
                    Collapse All
                  </button>
                </>
              )}

              <div className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-800">
                {effectiveLayout === "table" && <Table2 className="h-3.5 w-3.5" />}
                {effectiveLayout === "accordion" && <List className="h-3.5 w-3.5" />}
                {effectiveLayout === "card" && <LayoutGrid className="h-3.5 w-3.5" />}
                <span className="hidden capitalize sm:inline">{effectiveLayout}</span>
              </div>
            </div>
          </div>

          {renderDataView()}

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[11px] text-gray-600">
              Showing <b>{displayedStart}-{displayedEnd}</b> of {pageCollection.length} {paginationLabel}
              {groupBy !== "none" && <span className="ml-1">({filteredRows.length} total records)</span>}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-[11px] text-gray-600">
                {groupBy === "none" ? "Rows" : "Groups"} per page
                <select
                  value={rowsPerPage}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  className="h-8 rounded-xl border border-gray-300 bg-white px-2 text-[11px] text-gray-700 outline-none focus:border-blue-500"
                >
                  {[10, 20, 50, 100, 200].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>

              <div className="flex items-center overflow-hidden rounded-xl border border-gray-300 bg-white text-[11px]">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage <= 1}
                  className="h-8 px-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  Previous
                </button>
                <span className="border-x border-gray-300 px-3 py-2 text-gray-600">
                  Page <b>{safePage}</b> of <b>{totalPages}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                  className="h-8 px-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
