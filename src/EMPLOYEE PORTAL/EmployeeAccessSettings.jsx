import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilterX,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useAuth } from "./AuthContext";

const ACCESS_FIELDS = [
  ["portalLV", "Leave"],
  ["portalOB", "Official Business"],
  ["portalOT", "Overtime"],
  ["portalOffSet", "Offset"],
  ["portalTK", "Timekeeping"],
  ["portalDTR", "DTR"],
  ["geofence", "Geofence"],
  ["portalDTRConfirm", "DTR Confirm"],
];

const ROLE_FIELDS = [
  ["approver", "Approver"],
  ["mgrFlag", "Manager"],
  ["supFlag", "Supervisor"],
];

const EMPTY_FILTERS = {
  branch: "",
  payrollGroup: "",
  department: "",
  employeeStatus: "",
  position: "",
  employee: "",
};

const enabled = (value) =>
  ["1", "y", "yes", "true"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );

const field = (row, name) => {
  const normalizedName = String(name)
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  const key = Object.keys(row || {}).find(
    (item) => item.toLowerCase() === name.toLowerCase()
  );

  const matchingKey =
    key ||
    Object.keys(row || {}).find(
      (item) =>
        item.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalizedName
    );

  return matchingKey ? row[matchingKey] : undefined;
};

const pick = (row, ...names) =>
  names
    .map((name) => field(row, name))
    .find((value) => value != null && String(value).trim() !== "") || "";

const empNoOf = (row) => pick(row, "empNo", "empno", "employeeNo");
const empNameOf = (row) => pick(row, "empName", "emp_name", "employeeName");
const employeeLabel = (row) => `${empNoOf(row)} - ${empNameOf(row)}`;

export default function EmployeeAccessSettings() {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState("none");
  const [collapsed, setCollapsed] = useState([]);
  const [changes, setChanges] = useState({});
  const [mobileExpanded, setMobileExpanded] = useState([]);

  const isHr = enabled(user?.hrFlag ?? user?.hrflag);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.employeePortalSettings, {
        headers: { Accept: "application/json" },
      });

      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        throw new Error(
          payload?.message || "Unable to load employee access settings."
        );
      }

      setRows(
        Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : []
      );
      setChanges({});
    } catch (error) {
      toast.error(error.message || "Unable to load employee access settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isHr) load();
    else setLoading(false);
  }, [isHr, load]);

  const valueOf = (row, name) =>
    changes[empNoOf(row)]?.[name] ?? field(row, name);

  const update = (row, name, value) => {
    const empNo = empNoOf(row);

    setChanges((current) => ({
      ...current,
      [empNo]: {
        ...(current[empNo] || {}),
        [name]: value,
      },
    }));
  };

  const choices = useMemo(
    () => ({
      branches: [
        ...new Set(rows.map((row) => pick(row, "branchName", "branch"))),
      ]
        .filter(Boolean)
        .sort(),
      payrollGroups: [
        ...new Set(
          rows.map((row) =>
            pick(row, "payGroupName", "payrollGroup", "payGroup")
          )
        ),
      ]
        .filter(Boolean)
        .sort(),
      departments: [
        ...new Set(rows.map((row) => pick(row, "deptName", "department"))),
      ]
        .filter(Boolean)
        .sort(),
      employeeStatuses: [
        ...new Set(
          rows.map((row) =>
            pick(row, "empStatName", "employeeStatus", "empStat")
          )
        ),
      ]
        .filter(Boolean)
        .sort(),
      positions: [
        ...new Set(rows.map((row) => pick(row, "positionName", "position"))),
      ]
        .filter(Boolean)
        .sort(),
      employees: rows
        .map((row) => ({ value: empNoOf(row), label: employeeLabel(row) }))
        .filter((item) => item.value)
        .sort((a, b) => a.label.localeCompare(b.label)),
      approvers: rows.filter((row) => enabled(valueOf(row, "approver"))),
      managers: rows.filter((row) => enabled(valueOf(row, "mgrFlag"))),
      supervisors: rows.filter((row) => enabled(valueOf(row, "supFlag"))),
    }),
    [rows, changes]
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const haystack = [
          employeeLabel(row),
          pick(row, "branchName", "branch"),
          pick(row, "deptName", "department"),
          pick(row, "payGroupName", "payrollGroup", "payGroup"),
          pick(row, "positionName", "position"),
        ]
          .join(" ")
          .toLowerCase();

        return (
          (!search || haystack.includes(search.toLowerCase())) &&
          (!filters.branch ||
            pick(row, "branchName", "branch") === filters.branch) &&
          (!filters.payrollGroup ||
            pick(row, "payGroupName", "payrollGroup", "payGroup") ===
              filters.payrollGroup) &&
          (!filters.department ||
            pick(row, "deptName", "department") === filters.department) &&
          (!filters.employeeStatus ||
            pick(row, "empStatName", "employeeStatus", "empStat") ===
              filters.employeeStatus) &&
          (!filters.position ||
            pick(row, "positionName", "position") === filters.position) &&
          (!filters.employee || empNoOf(row) === filters.employee)
        );
      }),
    [rows, search, filters]
  );

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", rows: filtered }];

    const names = {
      branch: ["branchName", "branch"],
      payrollGroup: ["payGroupName", "payrollGroup", "payGroup"],
      department: ["deptName", "department"],
      employeeStatus: ["empStatName", "employeeStatus", "empStat"],
      position: ["positionName", "position"],
    };

    const result = filtered.reduce((acc, row) => {
      const key = pick(row, ...(names[groupBy] || [])) || "Unspecified";
      (acc[key] ||= []).push(row);
      return acc;
    }, {});

    return Object.entries(result).map(([key, groupRows]) => ({
      key,
      rows: groupRows,
    }));
  }, [filtered, groupBy]);

  const save = async () => {
    const updates = Object.entries(changes).map(([empNo, values]) => ({
      empNo,
      ...values,
    }));

    if (!updates.length) return toast.info("No changes to save.");

    setSaving(true);

    try {
      const response = await fetch(API_ENDPOINTS.updateEmployeePortalSettings, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ employees: updates }),
      });

      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        throw new Error(
          payload?.message || "Unable to save employee access settings."
        );
      }

      toast.success("Employee access settings saved.");
      await load();
    } catch (error) {
      toast.error(error.message || "Unable to save employee access settings.");
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilters(EMPTY_FILTERS);
    setGroupBy("none");
    setCollapsed([]);
  };

  const toggleGroup = (key) => {
    setCollapsed((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const toggleMobileEmployee = (empNo) => {
    setMobileExpanded((current) =>
      current.includes(empNo)
        ? current.filter((item) => item !== empNo)
        : [...current, empNo]
    );
  };

  const changedCount = Object.keys(changes).length;
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  if (!isHr) {
    return (
      <div className="mt-[80px] p-3 sm:p-4 lg:ml-[200px]">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
          HR access is required to manage employee portal settings.
        </div>
      </div>
    );
  }

  const Select = ({ name, options, label: title }) => (
    <label className="min-w-0 text-xs font-semibold text-slate-600">
      {title}
      <select
        value={filters[name]}
        onChange={(e) =>
          setFilters((current) => ({
            ...current,
            [name]: e.target.value,
          }))
        }
        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">All {title}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );

  const Toggle = ({ row, name, title, compact = false }) => {
    const isOn = enabled(valueOf(row, name));

    return (
      <button
        type="button"
        title={title}
        aria-label={`${title}: ${isOn ? "Enabled" : "Disabled"}`}
        aria-pressed={isOn}
        onClick={() => update(row, name, isOn ? "N" : "Y")}
        className={`relative shrink-0 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          compact ? "h-6 w-11" : "h-7 w-12"
        } ${isOn ? "bg-blue-700" : "bg-slate-300"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            compact ? "h-5 w-5" : "h-6 w-6"
          } ${isOn ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    );
  };

  const PersonSelect = ({ row, name, people, title, compact = false }) => (
    <select
      title={title}
      value={valueOf(row, name) || ""}
      onChange={(e) => update(row, name, e.target.value)}
      className={`w-full rounded-lg border border-slate-200 bg-white text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
        compact ? "h-8 min-w-[145px] px-2 text-[10px]" : "h-10 px-3 text-sm"
      }`}
    >
      <option value="">Not assigned</option>
      {people.map((person) => {
        const empNo = empNoOf(person);
        return (
          <option key={empNo} value={empNo}>
            {employeeLabel(person)}
          </option>
        );
      })}
    </select>
  );

  const MobileEmployeeCard = ({ row }) => {
    const empNo = empNoOf(row);
    const expanded = mobileExpanded.includes(empNo);
    const isChanged = Boolean(changes[empNo]);

    return (
      <article
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
          isChanged ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleMobileEmployee(empNo)}
          className="flex w-full items-start justify-between gap-3 p-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800">
                {empNo}
              </span>
              {isChanged && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Unsaved
                </span>
              )}
            </div>
            <h3 className="mt-2 truncate text-sm font-bold text-slate-900">
              {empNameOf(row)}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {pick(row, "branchName", "branch") || "No branch"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {[pick(row, "branchName", "branch"), pick(row, "deptName", "department")]
                .filter(Boolean)
                .join(" • ") || "No organization assigned"}
            </p>
          </div>
          <span className="mt-1 rounded-full bg-slate-100 p-1.5 text-slate-600">
            {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </span>
        </button>

        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50/70 p-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck size={15} className="text-blue-700" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                  Portal Access
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACCESS_FIELDS.map(([name, title]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <span className="pr-3 text-xs font-medium text-slate-700">
                      {title}
                    </span>
                    <Toggle row={row} name={name} title={title} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2">
                <Users size={15} className="text-violet-700" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                  Employee Role
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ROLE_FIELDS.map(([name, title]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <span className="pr-3 text-xs font-medium text-slate-700">
                      {title}
                    </span>
                    <Toggle row={row} name={name} title={title} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-700">
                Approval Routing
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  Approver 1
                  <div className="mt-1.5">
                    <PersonSelect row={row} name="approver1" people={choices.approvers} title="Approver 1" />
                  </div>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Approver 2
                  <div className="mt-1.5">
                    <PersonSelect row={row} name="approver2" people={choices.approvers} title="Approver 2" />
                  </div>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Approver 3
                  <div className="mt-1.5">
                    <PersonSelect row={row} name="approver3" people={choices.approvers} title="Approver 3" />
                  </div>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Manager
                  <div className="mt-1.5">
                    <PersonSelect row={row} name="manager" people={choices.managers} title="Manager" />
                  </div>
                </label>
                <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                  Supervisor
                  <div className="mt-1.5">
                    <PersonSelect row={row} name="supervisor" people={choices.supervisors} title="Supervisor" />
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <main className="mt-[80px] min-h-screen bg-slate-100/80 px-2 py-3 sm:px-3 lg:ml-[200px] lg:p-4">
      <div className="mx-auto max-w-[1900px] space-y-3 sm:space-y-4">
        {/* Header */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-blue-600 text-white shadow-lg">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-white/10 p-2 backdrop-blur-sm">
                  <Settings2 size={21} />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold sm:text-xl">
                    Employee Access Settings
                  </h1>
                  <p className="mt-0.5 text-xs text-blue-100 sm:text-sm">
                    Portal rights, employee roles, and approval assignments.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] sm:text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  {rows.length} Employees
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  {filtered.length} Displayed
                </span>
                {changedCount > 0 && (
                  <span className="rounded-full bg-amber-300 px-3 py-1.5 font-bold text-amber-950">
                    {changedCount} Unsaved
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading || saving}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50 sm:flex-none"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !changedCount}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                <Save size={16} />
                {saving ? "Saving..." : `Save (${changedCount})`}
              </button>
            </div>
          </div>
        </section>

        {/* Search / Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">Employee
                <select value={filters.employee} onChange={(e) => setFilters((current) => ({ ...current, employee: e.target.value }))} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option value="">All Employees</option>
                  {choices.employees.map((employee) => <option key={employee.value} value={employee.value}>{employee.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Search Employee
                <div className="relative mt-1.5"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Employee no., name, branch, department or position..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:w-[850px] xl:grid-cols-3">
              <Select name="branch" label="Branch" options={choices.branches} />
              <Select name="payrollGroup" label="Payroll Group" options={choices.payrollGroups} />
              <Select name="department" label="Department" options={choices.departments} />
              <Select name="employeeStatus" label="Employee Status" options={choices.employeeStatuses} />
              <Select name="position" label="Position" options={choices.positions} />
              <label className="min-w-0 text-xs font-semibold text-slate-600">
              <span>Group By</span>
              <select
                value={groupBy}
                onChange={(e) => {
                  setGroupBy(e.target.value);
                  setCollapsed([]);
                }}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="none">No Grouping</option>
                <option value="branch">Branch</option>
                <option value="payrollGroup">Payroll Group</option>
                <option value="department">Department</option>
                <option value="employeeStatus">Employee Status</option>
                <option value="position">Position</option>
              </select>
            </label>
            </div>
          </div>

          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <span className="text-xs text-slate-500">
                Showing <strong className="text-slate-700">{filtered.length}</strong> of {rows.length}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!activeFilterCount && groupBy === "none"}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                <FilterX size={15} />
                Clear
              </button>
            </div>
          </div>
        </section>

        {/* Mobile / Tablet card view */}
        <section className="space-y-3 xl:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              <RefreshCw className="mx-auto mb-3 animate-spin" size={22} />
              Loading employee access settings...
            </div>
          ) : !filtered.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              No employees match the current filters.
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.key} className="space-y-2">
                {groupBy !== "none" && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-blue-900">
                      {collapsed.includes(group.key) ? (
                        <ChevronRight size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                      <span className="truncate">{group.key}</span>
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-blue-700">
                      {group.rows.length}
                    </span>
                  </button>
                )}

                {!collapsed.includes(group.key) &&
                  group.rows.map((row) => (
                    <MobileEmployeeCard key={empNoOf(row)} row={row} />
                  ))}
              </div>
            ))
          )}
        </section>

        {/* Desktop table */}
        <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:block">
          <div className="overflow-auto">
            <table className="w-full min-w-[1500px] text-xs">
              <thead className="sticky top-0 z-10 bg-blue-900 text-left text-white">
                <tr>
                  <th className="sticky left-0 z-40 min-w-[200px] bg-blue-900 px-3 py-3">
                    Employee
                  </th>
                  <th className="border-l border-blue-700 px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-blue-100">
                    Portal Access
                  </th>
                  <th className="border-l border-blue-700 px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-blue-100">
                    Roles
                  </th>
                  <th colSpan={2} className="border-l border-blue-700 px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-blue-100">
                    Approval Routing
                  </th>
                </tr>
                <tr className="bg-blue-800">
                  <th className="sticky left-0 z-40 bg-blue-800 px-3 py-2 text-[10px] text-blue-100">
                    No. / Name
                  </th>
                  <th className="min-w-[200px] border-l border-blue-700 px-2 py-2 text-center text-[10px] text-blue-100">Portal Access</th>
                  <th className="min-w-[120px] border-l border-blue-700 px-2 py-2 text-center text-[10px] text-blue-100">Roles</th>
                  <th className="min-w-[220px] border-l border-blue-700 px-2 py-2 text-blue-100">Approvers</th>
                  <th className="min-w-[200px] px-2 py-2 text-blue-100">Manager / Supervisor</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-slate-500">
                      Loading employee access settings...
                    </td>
                  </tr>
                ) : !filtered.length ? (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-slate-500">
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  grouped.flatMap((group) => [
                    groupBy !== "none" && (
                      <tr key={`group-${group.key}`} className="bg-blue-50">
                        <td colSpan="5" className="p-0">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.key)}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-bold text-blue-900"
                          >
                            {collapsed.includes(group.key) ? (
                              <ChevronRight size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                            {group.key}
                            <span className="font-normal text-slate-500">
                              ({group.rows.length})
                            </span>
                          </button>
                        </td>
                      </tr>
                    ),

                    !collapsed.includes(group.key) &&
                      group.rows.map((row) => {
                        const empNo = empNoOf(row);
                        const isChanged = Boolean(changes[empNo]);

                        return (
                          <tr
                            key={empNo}
                            className={`border-t border-slate-100 transition hover:bg-slate-50 ${
                              isChanged ? "bg-amber-50/40" : ""
                            }`}
                          >
                            <td className={`sticky left-0 z-10 px-3 py-2.5 ${isChanged ? "bg-amber-50" : "bg-white"}`}>
                              <div className="flex items-start gap-2">
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800">{empNo}</div>
                                  <div className="mt-0.5 max-w-[210px] truncate text-[11px] font-medium text-slate-600" title={empNameOf(row)}>
                                    {empNameOf(row)}
                                  </div>
                                  <div className="mt-0.5 max-w-[210px] truncate text-[10px] font-semibold text-blue-700" title={pick(row, "branchName", "branch")}>
                                    {pick(row, "branchName", "branch") || "No designation"}
                                  </div>
                                  <div className="mt-1 flex max-w-[220px] flex-wrap gap-1 text-[9px] font-semibold text-slate-500">
                                    {[pick(row, "positionName", "position"), pick(row, "payGroupName", "payrollGroup", "payGroup"), pick(row, "deptName", "department")].filter(Boolean).map((value) => <span key={value} className="rounded bg-slate-100 px-1.5 py-0.5">{value}</span>)}
                                  </div>
                                </div>
                                {isChanged && (
                                  <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                    EDITED
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="border-l border-slate-100 px-3 py-2.5">
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                {ACCESS_FIELDS.map(([name, title]) => (
                                  <label key={name} className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600"><span className="truncate" title={title}>{title}</span><Toggle row={row} name={name} title={title} compact /></label>
                                ))}
                              </div>
                            </td>

                            <td className="border-l border-slate-100 px-3 py-2.5">
                              <div className="space-y-1">
                                {ROLE_FIELDS.map(([name, title]) => (
                                  <label key={name} className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600"><span>{title}</span><Toggle row={row} name={name} title={title} compact /></label>
                                ))}
                              </div>
                            </td>

                            <td className="border-l border-slate-100 px-2 py-2">
                              <div className="space-y-1">
                                {[["approver1", "Approver 1"], ["approver2", "Approver 2"], ["approver3", "Approver 3"]].map(([name, title]) => (
                                  <label key={name} className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-1 text-[10px] font-semibold text-slate-500"><span>{title}</span><PersonSelect row={row} name={name} people={choices.approvers} title={title} compact /></label>
                                ))}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="space-y-1">
                                <label className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-1 text-[10px] font-semibold text-slate-500"><span>Manager</span><PersonSelect row={row} name="manager" people={choices.managers} title="Manager" compact /></label>
                                <label className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-1 text-[10px] font-semibold text-slate-500"><span>Supervisor</span><PersonSelect row={row} name="supervisor" people={choices.supervisors} title="Supervisor" compact /></label>
                              </div>
                            </td>
                          </tr>
                        );
                      }),
                  ])
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Mobile sticky save bar */}
      {changedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-2 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1 pl-1">
              <div className="text-xs font-bold text-slate-800">
                {changedCount} employee{changedCount !== 1 ? "s" : ""} modified
              </div>
              <div className="text-[11px] text-slate-500">Changes are not saved yet.</div>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {changedCount > 0 && <div className="h-16 xl:hidden" />}
    </main>
  );
}
