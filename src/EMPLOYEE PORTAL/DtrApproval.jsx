import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useAuth } from "./AuthContext.jsx";

const formatDateInput = (date) => dayjs(date).format("YYYY-MM-DD");
const monthStart = () => formatDateInput(dayjs().startOf("month"));
const todayInput = () => formatDateInput(dayjs());

const getValue = (row, keys, fallback = "") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
};

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const extractRows = (payload) => {
  const value = parseMaybeJson(payload);

  if (Array.isArray(value)) {
    if (value.length === 1 && value[0] && typeof value[0] === "object") {
      const nested =
        extractRows(value[0].result) ||
        extractRows(value[0].RESULT) ||
        extractRows(value[0].records) ||
        extractRows(value[0].data);
      if (nested) return nested;
    }

    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      return extractRows(item.result) || extractRows(item.RESULT) || [item];
    });
  }

  if (!value || typeof value !== "object") return null;
  return (
    extractRows(value.records) ||
    extractRows(value.data) ||
    extractRows(value.result) ||
    extractRows(value.RESULT)
  );
};

const normalizeRows = (payload) => extractRows(payload) || [];

const normalizeDtrRow = (row, index) => {
  const empNo = String(
    getValue(row, ["empNo", "empno", "EMPNO", "EMP_NO", "employeeNo"]),
  ).trim();
  const empName = String(
    getValue(row, [
      "empName",
      "EMPNAME",
      "EMP_NAME",
      "employeeName",
      "EMPLOYEE_NAME",
      "name",
    ]),
  ).trim();
  const department = String(
    getValue(row, ["department", "Department", "DEPARTMENT", "deptName", "DEPT_NAME"]),
  ).trim();
  const branchName = String(
    getValue(row, ["branchName", "branchname", "BRANCH_NAME", "branch_code", "branchcode"]),
  ).trim();
  const date = String(getValue(row, ["date", "DATE", "dtrDate", "DTR_DATE"])).trim();
  const timeIn = getValue(row, [
    "timeIn",
    "time_in",
    "TIME_IN",
    "time_in_datetime",
    "TIME_IN_DATETIME",
    "dtrTimeIn",
  ]);
  const timeOut = getValue(row, [
    "timeOut",
    "time_out",
    "TIME_OUT",
    "time_out_datetime",
    "TIME_OUT_DATETIME",
    "dtrTimeOut",
  ]);
  const workedHours = getValue(row, [
    "workedHours",
    "workedHrs",
    "worked_hrs",
    "WORKED_HRS",
    "WORKED_HOURS",
  ]);
  const remarks = String(
    getValue(row, ["remarks", "Remarks", "REMARKS", "status", "STATUS"]),
  ).trim();
  const source = String(getValue(row, ["source", "SOURCE", "type", "TYPE"])).trim();

  return {
    id: `${empNo || "emp"}-${date || "date"}-${source || "dtr"}-${index}`,
    empNo,
    empName,
    department: department || "No Department",
    branchName,
    date,
    day: date ? dayjs(date).format("ddd") : "",
    timeIn,
    timeOut,
    workedHours,
    remarks,
    source,
    raw: row,
  };
};

const formatDate = (value) => (value ? dayjs(value).format("MMM DD, YYYY") : "-");
const formatTime = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("hh:mm A") : String(value);
};

const badgeClass = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("final") || normalized.includes("confirmed")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (normalized.includes("no dtr") || normalized.includes("absent")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  if (normalized.includes("leave")) {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }
  return "bg-blue-50 text-blue-700 ring-blue-200";
};

const checkboxClass = "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500";

const DtrApproval = () => {
  const { user } = useAuth();
  const selectAllRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(todayInput());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const currentEmpNo = user?.empNo || user?.EMPNO || user?.EMP_NO || "";

  const fetchDtrRows = async () => {
    if (!currentEmpNo) return;

    try {
      setLoading(true);
      setError("");

      if (!startDate || !endDate) {
        throw new Error("Please select Start Date and End Date.");
      }

      if (dayjs(startDate).isAfter(dayjs(endDate), "day")) {
        throw new Error("Start Date must not be greater than End Date.");
      }

      if (dayjs(endDate).isAfter(dayjs(), "day")) {
        throw new Error("To Date must not be greater than today.");
      }

      const response = await axios.get(API_ENDPOINTS.getAllDTRHR, {
        params: {
          empNo: currentEmpNo,
          EMP_NO: currentEmpNo,
          startDate,
          START_DATE: startDate,
          endDate,
          END_DATE: endDate,
        },
        headers: { Accept: "application/json" },
      });

      if (response.data?.success === false) {
        throw new Error(response.data.message || "Unable to load DTR records.");
      }

      const nextRows = normalizeRows(response.data).map(normalizeDtrRow);
      setRecords(nextRows);
      setSelectedIds([]);
    } catch (err) {
      setRecords([]);
      setSelectedIds([]);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error_details ||
          err.message ||
          "Failed to load DTR records.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDtrRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmpNo]);

  const departments = useMemo(
    () => [...new Set(records.map((row) => row.department || "No Department"))].sort(),
    [records],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((row) => {
      const matchesDepartment = department === "all" || row.department === department;
      const haystack = [
        row.empNo,
        row.empName,
        row.department,
        row.branchName,
        row.date,
        row.source,
        row.remarks,
      ]
        .join(" ")
        .toLowerCase();

      return matchesDepartment && (!query || haystack.includes(query));
    });
  }, [records, search, department]);

  const groupedRows = useMemo(() => {
    const groups = new Map();
    filteredRows.forEach((row) => {
      if (!groups.has(row.department)) groups.set(row.department, []);
      groups.get(row.department).push(row);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rows]) => ({
        name,
        rows: rows.sort((a, b) => {
          const nameCompare = a.empName.localeCompare(b.empName);
          if (nameCompare !== 0) return nameCompare;
          return dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
        }),
      }));
  }, [filteredRows]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedIds.includes(row.id)),
    [filteredRows, selectedIds],
  );

  const selectedEmployees = useMemo(
    () => [...new Set(selectedRows.map((row) => row.empNo).filter(Boolean))],
    [selectedRows],
  );

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedIds.length > 0 && selectedIds.length < filteredRows.length;
  }, [selectedIds, filteredRows.length]);

  const toggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.length === filteredRows.length ? [] : filteredRows.map((row) => row.id),
    );
  };

  const toggleDepartmentRows = (rows) => {
    const rowIds = rows.map((row) => row.id);
    const allSelected = rowIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      allSelected
        ? prev.filter((id) => !rowIds.includes(id))
        : [...new Set([...prev, ...rowIds])],
    );
  };

  const toggleDepartment = (name) => {
    setExpandedDepartments((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const confirmSelected = async () => {
    if (!selectedEmployees.length) return;

    const result = await Swal.fire({
      title: "Confirm selected DTR?",
      text: `This will mark DTR as FINAL for ${selectedEmployees.length} employee(s) from ${formatDate(startDate)} to ${formatDate(endDate)}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, confirm",
      confirmButtonColor: "#2563eb",
    });

    if (!result.isConfirmed) return;

    try {
      setConfirming(true);
      for (const empNo of selectedEmployees) {
        const response = await axios.post(API_ENDPOINTS.confirmDTR, {
          empNo,
          startDate,
          endDate,
        });

        if (response.data?.success === false) {
          throw new Error(response.data.message || `Unable to confirm DTR for ${empNo}.`);
        }
      }

      await fetchDtrRows();
      Swal.fire({
        title: "Confirmed",
        text: "Selected DTR records were confirmed successfully.",
        icon: "success",
      });
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err.response?.data?.message || err.message || "Unable to confirm selected DTR.",
        icon: "error",
      });
    } finally {
      setConfirming(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setDepartment("all");
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] min-h-screen bg-gray-100 p-4">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">DTR Confirmation</h1>
        </div>

        <div className="mt-4 rounded-lg bg-white p-4 shadow-lg">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                DTR Records
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {filteredRows.length}
                </span>
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Select rows to confirm the represented employee DTR for the active date range.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchDtrRows}
                disabled={loading || confirming}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={confirmSelected}
                disabled={!selectedEmployees.length || confirming}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {confirming ? "Confirming..." : "Confirm Selected"}
              </button>
            </div>
          </div>

          <div className="mb-4 flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="relative min-w-0 flex-1 lg:min-w-[220px]">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee, department, date, or remarks..."
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              From
              <input
                type="date"
                value={startDate}
                max={todayInput()}
                onChange={(event) => setStartDate(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              To Date
              <input
                type="date"
                value={endDate}
                max={todayInput()}
                onChange={(event) => setEndDate(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
              />
            </label>
            {(search || department !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2 font-semibold">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length}
                onChange={toggleAll}
                className={checkboxClass}
              />
              Select all visible
            </label>
            <span>
              {selectedRows.length} row(s), {selectedEmployees.length} employee(s) selected
            </span>
          </div>

          {error && <p className="py-3 text-center text-sm text-red-600">{error}</p>}
          {loading && <div className="py-8 text-center text-sm text-slate-500">Loading DTR records...</div>}

          {!loading && !error && (
            <div className="space-y-3">
              {groupedRows.length > 0 ? (
                groupedRows.map((group) => {
                  const isExpanded = expandedDepartments[group.name] ?? true;
                  const groupSelectedCount = group.rows.filter((row) =>
                    selectedIds.includes(row.id),
                  ).length;
                  const isGroupSelected =
                    group.rows.length > 0 && groupSelectedCount === group.rows.length;
                  const isGroupPartial =
                    groupSelectedCount > 0 && groupSelectedCount < group.rows.length;

                  return (
                    <div key={group.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="flex w-full items-center justify-between gap-3 bg-slate-50 px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isGroupSelected}
                            ref={(element) => {
                              if (element) element.indeterminate = isGroupPartial;
                            }}
                            onChange={() => toggleDepartmentRows(group.rows)}
                            className={`${checkboxClass} shrink-0`}
                            aria-label={`Select ${group.name} department`}
                          />
                          <button
                            type="button"
                            onClick={() => toggleDepartment(group.name)}
                            className="inline-flex min-w-0 items-center gap-2 text-left font-semibold text-slate-800"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                            )}
                            <span className="truncate">{group.name}</span>
                          </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs text-slate-600">
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600">
                            {group.rows.length} records
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <>
                          <div className="block space-y-3 p-3 md:hidden">
                            {group.rows.map((row) => (
                              <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <label className="flex min-w-0 items-start gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(row.id)}
                                      onChange={() => toggleRow(row.id)}
                                      className={`${checkboxClass} mt-0.5`}
                                    />
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-semibold text-slate-800">
                                        {row.empName || row.empNo || "-"}
                                      </span>
                                      <span className="block text-xs text-slate-500">
                                        {row.empNo || "-"} · {formatDate(row.date)}
                                      </span>
                                    </span>
                                  </label>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badgeClass(row.remarks || row.source)}`}>
                                    {row.remarks || row.source || "DTR"}
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <div className="text-slate-500">Time In</div>
                                    <div className="font-semibold text-slate-800">{formatTime(row.timeIn)}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500">Time Out</div>
                                    <div className="font-semibold text-slate-800">{formatTime(row.timeOut)}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500">Hours</div>
                                    <div className="font-semibold text-slate-800">{row.workedHours || "-"}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500">Branch</div>
                                    <div className="font-semibold text-slate-800">{row.branchName || "-"}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-white text-[11px] uppercase tracking-wide text-slate-500">
                                <tr>
                                  <th className="w-10 px-3 py-2"></th>
                                  <th className="px-3 py-2">Employee</th>
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Day</th>
                                  <th className="px-3 py-2">Time In</th>
                                  <th className="px-3 py-2">Time Out</th>
                                  <th className="px-3 py-2">Hours</th>
                                  <th className="px-3 py-2">Branch</th>
                                  <th className="px-3 py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.rows.map((row) => (
                                  <tr key={row.id} className="hover:bg-blue-50/40">
                                    <td className="px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(row.id)}
                                        onChange={() => toggleRow(row.id)}
                                        className={checkboxClass}
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="font-semibold text-slate-800">{row.empName || "-"}</div>
                                      <div className="text-[11px] text-slate-500">{row.empNo || "-"}</div>
                                    </td>
                                    <td className="px-3 py-2 font-medium text-slate-700">{formatDate(row.date)}</td>
                                    <td className="px-3 py-2 text-slate-600">{row.day || "-"}</td>
                                    <td className="px-3 py-2 text-slate-700">{formatTime(row.timeIn)}</td>
                                    <td className="px-3 py-2 text-slate-700">{formatTime(row.timeOut)}</td>
                                    <td className="px-3 py-2 text-slate-700">{row.workedHours || "-"}</td>
                                    <td className="px-3 py-2 text-slate-700">{row.branchName || "-"}</td>
                                    <td className="px-3 py-2">
                                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badgeClass(row.remarks || row.source)}`}>
                                        {row.remarks || row.source || "DTR"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  No DTR records found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DtrApproval;
