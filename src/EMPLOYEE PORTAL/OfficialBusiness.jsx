import React, { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { FaCalendarAlt } from "react-icons/fa";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

/**
 * Official Business Application — with Cancel Pending
 * - Matches the Overtime UX: view toggles (Card / Accordion / Table)
 * - Filters, sorting, pagination
 * - Submit flow unchanged
 * - NEW: Cancel action for Pending items using { empNo, obStamp }
 */

const FIELD_MAP = {
  obDate: "obDate",
  obStart: "obStart",
  obEnd: "obEnd",
  obHrs: "obHrs",
  obRemarks: "obRemarks",
  appRemarks: "appRemarks",
  obStatus: "obStatus",
};

const OfficialBusiness = () => {
  const { user } = useAuth();

  // ---------- Data/state ----------
  const [applicationDate, setApplicationDate] = useState(""); // yyyy-MM-dd
  const [selectedStartDate, setSelectedStartDate] = useState(null); // Date | string
  const [selectedEndDate, setSelectedEndDate] = useState(null); // Date | string
  const [obHrs, setOBHrs] = useState("0"); // read-only, computed
  const [remarks, setRemarks] = useState("");

  const [obApplications, setOBApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [error, setError] = useState(null);

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // View Mode
  const [viewMode, setViewMode] = useState("card"); // 'card' | 'accordion' | 'table'

  // Date-range defaults to current month
  const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");
  const monthEnd = dayjs().endOf("month").format("YYYY-MM-DD");

  // Filters
  const [searchFields, setSearchFields] = useState({
    obDateStart: monthStart,
    obDateEnd: monthEnd,
    obRemarks: "",
    appRemarks: "",
    obStatus: "",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const totalPages = Math.ceil(filteredApplications.length / recordsPerPage) || 1;
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredApplications.slice(indexOfFirstRecord, indexOfLastRecord);

  // ---------- Helpers ----------
  const toYmd = (d) => (d ? dayjs(d).format("YYYY-MM-DD") : "");
  const toYmdHm = (d) => (d ? dayjs(d).format("YYYY-MM-DDTHH:mm:ss") : "");
  const toDispDate = (d) => (d ? dayjs(d).format("MM/DD/YYYY") : "");
  const toDispDateTime = (d) => (d ? dayjs(d).format("MM/DD/YYYY hh:mm a") : "");

  // Normalize API rows to consistent keys + include obStamp for cancel
  const normalize = (row) => ({
    obDate: row.obDate ?? row.obdate ?? row.OB_DATE ?? row.ob_date ?? null,
    obStart: row.obStart ?? row.ob_start ?? row.OB_START ?? row.startDate ?? null,
    obEnd: row.obEnd ?? row.ob_end ?? row.OB_END ?? row.endDate ?? null,
    obHrs: row.obHrs ?? row.OB_HRS ?? row.ob_hrs ?? row.hours ?? 0,
    obRemarks: row.obRemarks ?? row.OB_REMARKS ?? row.remarks ?? "",
    appRemarks: row.appRemarks ?? row.APP_REMARKS ?? row.approverRemarks ?? "",
    obStatus: (row.obStatus ?? row.OB_STATUS ?? row.status ?? "").toString().trim(),
    // stamp variations we may receive from backend
    obStamp: row.obStamp || row.OB_STAMP || row.ob_stamp || row.stamp || row.guid || null,
  });

  const getObStamp = (r) => r?.obStamp || r?.OB_STAMP || r?.ob_stamp || r?.stamp || r?.guid || null;

  const sortData = (uiKey) => {
    const key = FIELD_MAP[uiKey] || uiKey;
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });

    const sorted = [...filteredApplications].sort((a, b) => {
      const av = a[key];
      const bv = b[key];

      // datetime compare
      if (key === "obDate" || key === "obStart" || key === "obEnd") {
        const ad = dayjs(av).valueOf();
        const bd = dayjs(bv).valueOf();
        return direction === "asc" ? ad - bd : bd - ad;
      }
      // numeric
      if (key === "obHrs") {
        const an = parseFloat(av ?? 0);
        const bn = parseFloat(bv ?? 0);
        return direction === "asc" ? an - bn : bn - an;
      }
      // string
      return direction === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });

    setFilteredApplications(sorted);
  };

  const handleSearchChange = (e, key) => {
    const { value } = e.target;
    setSearchFields((prev) => ({ ...prev, [key]: value }));
  };

  const getSortIndicator = (uiKey) => {
    const key = FIELD_MAP[uiKey] || uiKey;
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  // OB hours
  const calculateObHrs = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    const totalMs = end - start;
    const totalHours = totalMs / (1000 * 60 * 60);
    return parseFloat(totalHours.toFixed(2));
  };

  useEffect(() => {
    const now = new Date();
    setSelectedStartDate(now);
    setSelectedEndDate(now);
  }, []);

  // Recompute hours when either datetime changes
  useEffect(() => {
    if (!selectedStartDate || !selectedEndDate) {
      setOBHrs("0");
      return;
    }
    const hrs = calculateObHrs(selectedStartDate, selectedEndDate);
    setOBHrs(String(hrs.toFixed(2)));
  }, [selectedStartDate, selectedEndDate]);

  // ---------- Fetch ----------
  const fetchOBApplications = async () => {
    if (!user?.empNo) return;
    try {
      const response = await fetch(API_ENDPOINTS.fetchOfficialBusinessApplicationsHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
          END_DATE: "2030-01-01",
        }),
      });
      const result = await response.json();

      if (result?.success && Array.isArray(result.data) && result.data[0]?.result) {
        const parsed = JSON.parse(result.data[0].result) ?? [];
        const normalized = parsed.map(normalize);
        setOBApplications(normalized);
        setFilteredApplications(normalized);
      } else {
        setOBApplications([]);
        setFilteredApplications([]);
      }
    } catch (err) {
      console.error("Error fetching Official Business applications:", err);
      setError("An error occurred while fetching Official Business applications.");
    }
  };

  useEffect(() => {
    const today = dayjs().format("YYYY-MM-DD");
    setApplicationDate(today);

    const mq = window.matchMedia("(min-width: 768px)");
    const setByScreen = () => setViewMode(mq.matches ? "table" : "card");
    setByScreen();
    mq.addEventListener("change", setByScreen);

    fetchOBApplications();

    return () => {
      mq.removeEventListener("change", setByScreen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Apply filters whenever searchFields or data changes
  useEffect(() => {
    let filtered = [...obApplications];

    const hasStart = !!searchFields.obDateStart;
    const hasEnd = !!searchFields.obDateEnd;
    if (hasStart || hasEnd) {
      filtered = filtered.filter((row) => {
        const d = dayjs(row.obDate).format("YYYY-MM-DD");
        const afterStart = hasStart ? d >= searchFields.obDateStart : true;
        const beforeEnd = hasEnd ? d <= searchFields.obDateEnd : true;
        return afterStart && beforeEnd;
      });
    }

    if (searchFields.obRemarks) {
      const q = searchFields.obRemarks.toLowerCase();
      filtered = filtered.filter((row) => String(row.obRemarks ?? "").toLowerCase().includes(q));
    }
    if (searchFields.appRemarks) {
      const q = searchFields.appRemarks.toLowerCase();
      filtered = filtered.filter((row) => String(row.appRemarks ?? "").toLowerCase().includes(q));
    }
    if (searchFields.obStatus) {
      filtered = filtered.filter((row) => (row.obStatus || "") === searchFields.obStatus);
    }

    setFilteredApplications(filtered);
    setCurrentPage(1);
  }, [searchFields, obApplications]);

  // Status options from data
  const statusOptions = useMemo(() => {
    const s = new Set();
    obApplications.forEach((r) => {
      const v = (r?.obStatus || "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [obApplications]);

  const handleDateChange = (field, value) => {
    if (!value) return;
    const dateVal = value instanceof Date ? value : new Date(value);

    if (field === "start") {
      setSelectedStartDate(dateVal);
      if (!selectedEndDate || dateVal.getTime() > selectedEndDate.getTime()) {
        setSelectedEndDate(dateVal);
        setOBHrs("0");
      } else {
        setOBHrs(String(calculateObHrs(dateVal, selectedEndDate)));
      }
    } else if (field === "end") {
      if (selectedStartDate && dateVal.getTime() < selectedStartDate.getTime()) {
        Swal.fire({ icon: "warning", title: "Invalid End Time", text: "End datetime cannot be earlier than start." });
        return;
      }
      setSelectedEndDate(dateVal);
      if (selectedStartDate) setOBHrs(String(calculateObHrs(selectedStartDate, dateVal)));
    }
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!selectedStartDate || !selectedEndDate || !remarks.trim()) {
      Swal.fire({ title: "Incomplete Form", text: "Please fill all required fields", icon: "warning" });
      return;
    }

    const payload = {
      json_data: {
        empNo: user.empNo,
        detail: [
          {
            obDate: applicationDate,
            obStart: toYmdHm(selectedStartDate),
            obEnd: toYmdHm(selectedEndDate),
            obRemarks: remarks,
            obHrs: parseFloat(obHrs) || 0,
          },
        ],
      },
    };

    try {
      const response = await fetch(API_ENDPOINTS.saveOfficialBusinessApplication, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const contentLength = response.headers.get("content-length");
      const result = contentLength && Number(contentLength) > 0 ? await response.json() : { status: "success" };

      if (result.status === "success") {
        Swal.fire({ title: "Success!", text: "OB application submitted successfully.", icon: "success" }).then(() => {
          const now = new Date();
          setSelectedStartDate(now);
          setSelectedEndDate(now);
          setRemarks("");
          setOBHrs("0");
          fetchOBApplications();
        });
      } else {
        throw new Error(result.message || "Unknown error");
      }
    } catch (err) {
      console.error("Error submitting OB application:", err);
      Swal.fire({ title: "Error!", text: err.message || "Failed to submit OB application", icon: "error" });
    }
  };

  // ---------- Cancel (Pending only) ----------
  const cancelOB = async (row) => {
    if ((row?.obStatus || "") !== "Pending") return;

    const obStamp = getObStamp(row);
    if (!obStamp) {
      await Swal.fire({ title: "Missing identifier", text: "Cannot cancel: obStamp was not found in this row.", icon: "error" });
      return;
    }

    const conf = await Swal.fire({
      title: "Cancel this application?",
      text: "This will mark your pending OB request as cancelled.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, cancel it",
    });
    if (!conf.isConfirmed) return;

    try {
      const res = await fetch(API_ENDPOINTS.cancelOfficialBusinessApplication, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json_data: { empNo: user.empNo, obStamp } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.status !== "success") throw new Error(j?.message || "Cancel failed");

      await Swal.fire({ title: "Cancelled", text: "Your OB application was cancelled.", icon: "success" });
      fetchOBApplications();
    } catch (e) {
      await Swal.fire({ title: "Error", text: e.message, icon: "error" });
    }
  };

  // Make the calendar popper the same width as the input (kept from earlier)
  const sameWidthPopper = [
    { name: "sameWidth", enabled: true, phase: "beforeWrite", requires: ["computeStyles"], fn: ({ state }) => { state.styles.popper.width = `${state.rects.reference.width}px`; }, effect: ({ state }) => { state.elements.popper.style.width = `${state.elements.reference.offsetWidth}px`; } },
  ];

  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[200px] mt-[80px] p-2 sm:p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        {/* Header */}
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">My Official Business Applications</h1>
        </div>

        {/* Form */}
        <div className="mt-4 bg-white p-4 sm:p-6 shadow-md rounded-lg text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Application Date */}
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Date</span>
              <div className="relative">
                <input type="date" className="w-full p-2 border rounded" value={applicationDate} onChange={(e) => setApplicationDate(e.target.value)} />
              </div>
            </div>

            {/* Start */}
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Start Datetime</span>
              <div className="relative">
                <DatePicker
                  wrapperClassName="w-full"
                  selected={selectedStartDate}
                  onChange={(d) => handleDateChange("start", d)}
                  showTimeSelect
                  timeFormat="hh:mm"
                  timeIntervals={30}
                  dateFormat="MM/dd/yyyy hh:mm aa"
                  placeholderText="Select Start Datetime"
                  className="w-full p-2 pl-10 border rounded h-[42px]"
                  popperPlacement="bottom-start"
                  portalId="root-portal"
                />
                <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            {/* End */}
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">End Datetime</span>
              <div className="relative">
                <DatePicker
                  wrapperClassName="w-full"
                  selected={selectedEndDate}
                  onChange={(d) => handleDateChange("end", d)}
                  showTimeSelect
                  timeFormat="hh:mm"
                  timeIntervals={30}
                  dateFormat="MM/dd/yyyy hh:mm aa"
                  placeholderText="Select End Datetime"
                  className="w-full p-2 pl-10 border rounded h-[42px]"
                  minDate={selectedStartDate || undefined}
                  popperPlacement="bottom-start"
                  portalId="root-portal"
                />
                <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            {/* Hours (auto) */}
            <div className="flex flex-col">
              <span className="block font-semibold mb-1">Number of Hours</span>
              <input type="number" value={Number(obHrs || 0).toFixed(2)} readOnly className="w-full p-2 border rounded h-[42px] bg-gray-100 cursor-not-allowed" />
            </div>
          </div>

          {/* Remarks */}
          <div className="mt-6">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={4} className="w-full p-2 border rounded" placeholder="Enter Remarks" />
          </div>

          {/* Submit */}
          <div className="mt-4 flex justify-center">
            <button className="bg-blue-800 text-white px-12 py-2 rounded-md hover:bg-blue-700 w-full sm:w-auto" onClick={handleSubmit}>Submit</button>
          </div>
        </div>

        {/* Quick filters */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <input type="date" value={searchFields.obDateStart} onChange={(e) => setSearchFields((p) => ({ ...p, obDateStart: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm" />
          <input type="date" value={searchFields.obDateEnd} onChange={(e) => setSearchFields((p) => ({ ...p, obDateEnd: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm" />
          <select value={searchFields.obStatus} onChange={(e) => setSearchFields((p) => ({ ...p, obStatus: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm bg-white">
            <option value="">All Status</option>
            {statusOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <input type="text" value={searchFields.obRemarks} onChange={(e) => handleSearchChange(e, "obRemarks")} className="w-full px-2 py-2 border rounded text-sm" placeholder="Remarks contains…" />
        </div>

        {/* History block */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          {/* Header + View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base font-semibold">Official Business Application History</h2>
            <div className="inline-flex rounded-lg border overflow-hidden self-start">
              <button className={`px-8 py-2 text-sm ${viewMode === "card" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("card")}>Card</button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "accordion" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("accordion")}>Accordion</button>
              <button className={`px-8 py-2 text-sm border-l ${viewMode === "table" ? "bg-blue-800 text-white" : "bg-white"}`} onClick={() => setViewMode("table")}>Table</button>
            </div>
          </div>

          {error && <p className="text-red-500 text-center mt-2">{error}</p>}

          {/* CARD VIEW */}
          {viewMode === "card" && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentRecords.length > 0 ? (
                currentRecords.map((entry, idx) => {
                  const statusClass = entry.obStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : entry.obStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : entry.obStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
                  return (
                    <div key={idx} className="border rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{toDispDate(entry.obDate)}</div>
                        <span className={`inline-flex justify-center items-center text-sm w-28 py-1 rounded-lg ${statusClass}`}>{entry.obStatus || "N/A"}</span>
                      </div>
                      <div className="space-y-1 text-[12px] md:text-sm">
                        <div className="flex justify-between"><span className="text-gray-500 font-semibold">Start</span><span className="font-medium">{toDispDateTime(entry.obStart)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-semibold">End</span><span className="font-medium">{toDispDateTime(entry.obEnd)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-semibold">Duration</span><span className="font-medium">{entry.obHrs} hr(s)</span></div>
                        <div className="mt-2"><div className="text-gray-500 font-semibold">Employee Remarks:</div><div className="font-normal break-words text-black">{entry.obRemarks || "N/A"}</div></div>
                        <div className="mt-2"><div className="text-gray-500 font-semibold">Approver's Remarks:</div><div className="font-normal break-words text-blue-700">{entry.appRemarks || "N/A"}</div></div>
                      </div>
                      {entry?.obStatus === "Pending" && (
                        <div className="mt-3 text-right">
                          <button className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelOB(entry)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center text-gray-500 py-6">No official business applications found.</div>
              )}
            </div>
          )}

          {/* ACCORDION VIEW */}
          {viewMode === "accordion" && (
            <div className="mt-4 divide-y border rounded-lg">
              {currentRecords.length > 0 ? (
                currentRecords.map((entry, idx) => {
                  const statusClass = entry.obStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : entry.obStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : entry.obStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";
                  return (
                    <details key={idx} className="group p-2 text-[12px] md:text-sm">
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <div className="font-medium">{toDispDate(entry.obDate)} • {toDispDateTime(entry.obStart)} → {toDispDateTime(entry.obEnd)} • {entry.obHrs} hr(s)</div>
                        <span className={`inline-flex justify-center items-center w-28 py-1 rounded-lg ${statusClass}`}>{entry.obStatus || "N/A"}</span>
                      </summary>
                      <div className="mt-3 space-y-2">
                        <div><div className="text-gray-500 font-semibold">Remarks</div><div>{entry.obRemarks || "N/A"}</div></div>
                        <div><div className="text-gray-500 font-semibold">Approver's Remarks</div><div className="text-blue-800">{entry.appRemarks || "N/A"}</div></div>
                        {entry?.obStatus === "Pending" && (
                          <div className="pt-2 text-right"><button className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelOB(entry)}>Cancel</button></div>
                        )}
                      </div>
                    </details>
                  );
                })
              ) : (
                <div className="text-center text-gray-500 py-6">No official business applications found.</div>
              )}
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === "table" && (
            <div className="w-full overflow-x-auto mt-4 rounded-lg">
              <table className="min-w-[1000px] w-full text-sm text-center border ">
                <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm lg:text-sm ">
                  <tr>
                    {[
                      { key: "obDate", label: "OB Date" },
                      { key: "obStart", label: "Start" },
                      { key: "obEnd", label: "End" },
                      { key: "obHrs", label: "Duration" },
                      { key: "obRemarks", label: "Remarks" },
                      { key: "appRemarks", label: "Approver's Remarks" },
                      { key: "obStatus", label: "Status" },
                      { key: "actions", label: "Actions" },
                    ].map(({ key, label }) => (
                      <th key={key} className="py-2 px-3 cursor-pointer whitespace-nowrap" onClick={() => key !== "actions" && sortData(key)}>
                        {label} {key !== "actions" ? getSortIndicator(key) : ""}
                      </th>
                    ))}
                  </tr>

                  {/* Search Row */}
                  <tr>
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <input type="date" value={searchFields.obDateStart} onChange={(e) => handleSearchChange(e, "obDateStart")} className="w-full px-1 py-1 border border-blue-200 rounded-lg text-xs text-gray-800" />
                    </td>                   
                    <td className="px-1 py-2 bg-white whitespace-nowrap"></td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap"></td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap"></td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <input type="text" value={searchFields.obRemarks} onChange={(e) => handleSearchChange(e, "obRemarks")} className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800" placeholder="Filter..." />
                    </td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <input type="text" value={searchFields.appRemarks} onChange={(e) => handleSearchChange(e, "appRemarks")} className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800" placeholder="Filter..." />
                    </td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap">
                      <select value={searchFields.obStatus} onChange={(e) => handleSearchChange(e, "obStatus")} className="w-full px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-800 bg-white">
                        <option value="">All</option>
                        {statusOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </td>
                    <td className="px-1 py-2 bg-white whitespace-nowrap"></td>
                  </tr>
                </thead>

                <tbody className="global-tbody">
                  {currentRecords.length > 0 ? (
                    currentRecords.map((entry, index) => {
                      const badgeClass = entry.obStatus === "Pending" ? "text-yellow-700 bg-yellow-100 font-semibold" : entry.obStatus === "Approved" ? "text-blue-700 bg-blue-100 font-semibold" : entry.obStatus === "Cancelled" ? "text-gray-700 bg-gray-200 font-semibold" : "text-red-700 bg-red-100 font-semibold";

                      return (
                        <tr key={index} className="global-tr">
                          <td className="global-td whitespace-nowrap">{toDispDate(entry.obDate)}</td>
                          <td className="global-td whitespace-nowrap text-left">{toDispDateTime(entry.obStart)}</td>
                          <td className="global-td whitespace-nowrap text-left">{toDispDateTime(entry.obEnd)}</td>
                          <td className="global-td whitespace-nowrap text-right">{entry.obHrs} hr(s)</td>
                          <td className="global-td text-left max-w-[190px] truncate" title={entry.obRemarks || "N/A"}>{entry.obRemarks || "N/A"}</td>
                          <td className="global-td text-left max-w-[190px] truncate" title={entry.appRemarks || "N/A"}>{entry.appRemarks || "N/A"}</td>
                          <td className="global-td text-center whitespace-nowrap"><span className={`inline-flex justify-center items-center text-xs w-28 py-1 rounded-lg ${badgeClass}`}>{entry.obStatus || "N/A"}</span></td>
                          <td className="global-td text-center whitespace-nowrap">
                            {entry?.obStatus === "Pending" ? (
                              <button className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" onClick={() => cancelOB(entry)}>Cancel</button>
                            ) : ("—")}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-6 text-center text-gray-500">No official business applications found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-between items-center mt-2 pt-2">
            <div className="text-xs text-gray-600">Showing <b>{filteredApplications.length ? indexOfFirstRecord + 1 : 0}-{Math.min(indexOfLastRecord, filteredApplications.length)}</b> of {filteredApplications.length} entries</div>
            <div className="flex items-center text-sm border rounded-lg overflow-hidden">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border-r text-gray-700 hover:bg-blue-200 disabled:text-gray-400 disabled:cursor-not-allowed">&lt;</button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1 border-r ${currentPage === i + 1 ? "bg-blue-800 text-white" : "text-gray-700 hover:bg-gray-200"}`}>{i + 1}</button>
              ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-gray-700 hover:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficialBusiness;