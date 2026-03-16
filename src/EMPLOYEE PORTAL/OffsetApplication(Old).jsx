import Swal from "sweetalert2";

import API_ENDPOINTS from "@/apiConfig.jsx";
import axios from "axios";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";

const OffsetApplication = () => {
  const { user } = useAuth();

//TanStack Query is server-state management for React: it fetches, 
// caches, refetches, and keeps API data in sync so we don’t manually 
// manage fetch/useEffect/useState refresh logic.

 //1. 
//Manual fetch + setState → useQuery data + cache
  //BEFORE
  //local state to store API results
  //you no longer manage “records state + fetch function + loading state” manually.
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDTR = async () => {
    try {
      if (!user?.empNo) return;

      setLoading(true);

      const response = await axios.get(
        `${API_ENDPOINTS.getDTROffset}/${user.empNo}/${startDate}/${endDate}`,
      );

      setRecords(response.data?.records || []);
    } catch (error) {
      console.error("Failed to reload DTR Offset:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  if (!user?.empNo) return;
  fetchDTR();
}, [user?.empNo]);


//AFTER
//No records state, no fetchDTR, no loading toggles:
const {
  data: dtrRecords = [],
  isLoading: dtrLoading,
  isFetching: dtrFetching,
  isError: dtrError,
  error: dtrErrorObj,
} = useQuery({
  queryKey: ["dtrRecords", user?.empNo, startDate, endDate],
  enabled: !!user?.empNo,
  queryFn: async () => {
    const res = await axios.get(
      `${API_ENDPOINTS.getDTROffset}/${user.empNo}/${startDate}/${endDate}`
    );
    return res.data?.records || [];
  },
  placeholderData: (prev) => prev,
});



//2.
//Manual “load both datasets” useEffect → two independent queries
//Before (manual loadData wrapper)
useEffect(() => {
  if (!user?.empNo) return;

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchDTR(), fetchOffsetHistory()]);
    setLoading(false);
  };

  loadData();
}, [user?.empNo]);

//After: two separate useQuery calls, no manual loading state
const dtrQuery = useQuery({...});
const historyQuery = useQuery({...});



//3.
//Manual refresh after submit/cancel → invalidateQueries
//Before (manual refresh)
//After submit/cancel:
await fetchDTR();
await fetchOffsetHistory();


//After
//you don’t need to call fetch functions or worry about sequence.
//everything that depends on those cached queries updates automatically.
queryClient.invalidateQueries({ queryKey: ["dtrRecords"] });
queryClient.invalidateQueries({ queryKey: ["offsetHistory"] });



//4.Auto-refresh/polling (history approvals)
//Before
//setInterval
//cleanup on unmount
//avoid double intervals
//handle loading flicker
//handle state syncing


//AFTER
refetchInterval: 5000,
refetchIntervalInBackground: true,




//5. Fixing “loading spinner shows again and again” (silent refresh)
//Before
//Because you toggle loading every time you fetch, the spinner always shows.


//After
//isLoading = first load only
//isFetching = background refresh too

const loading = dtrLoading || historyLoading;     // show overlay only once
const syncing = dtrFetching || historyFetching;   // optional small "syncing..."




//6. Removal of “state duplication” for API results
//Before
//records
//timekeepingRecords
//offsetApplications
//filteredApplications
//useEffect 


//After
//Server data stays in TanStack cache (dtrRecords, offsetApplications)
//setRecords(response.data.records)
//setOffsetApplications(mapped)

//UI derivations use useMemo (computed from query data)


//No need to “store again” and keep in sync with effects
//fewer “sync” effects and fewer bug-prone stale state issues.




  const [startDate, setStartDate] = useState(
    dayjs().startOf("month").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(
    dayjs().endOf("month").format("YYYY-MM-DD"),
  );
  const [timekeepingRecords, setTimekeepingRecords] = useState([]);
  

  useEffect(() => {
    console.log("USER OBJECT:", user);
    console.log("DAILY TIME RECORD:", user?.dailyTimeRecord);

    if (user?.dailyTimeRecord?.length > 0) {
      setRecords(user.dailyTimeRecord);
    }
  }, [user?.empNo]);

  useEffect(() => {
    if (!Array.isArray(records)) {
      console.log("records is not array:", records);
      setTimekeepingRecords([]);
      return;
    }

    const mapped = records.map((r, index) => ({
      id: index + 1,
      date: dayjs(r.date).format("YYYY-MM-DD"),
      timeInRaw: r.time_in,
      timeOutRaw: r.time_out,
      timeIn: dayjs(r.time_in).format("hh:mm A"),
      timeOut: dayjs(r.time_out).format("hh:mm A"),

      totalHours: Number(r.worked_hrs || 0),
      totalOT: Number(r.total_ot_hours || 0),

      openingHours: Number(r.ot_before_shift || 0),
      closingHours: Number(r.ot_after_shift || 0),

      appliedBeforeShift: Number(r.applied_before_shift || 0),
      appliedAfterShift: Number(r.applied_after_shift || 0),

      totalApplied: Number(r.total_applied_hrs || 0),

      remainingHours: Number(r.remaining_hrs || 0),
    }));

    setTimekeepingRecords(mapped);
  }, [records]);

  

  useEffect(() => {
    if (!user?.empNo) return;

    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDTR(), fetchOffsetHistory()]);
      setLoading(false);
    };

    loadData();
  }, [user?.empNo]);

  /* ===========================================================  
       STATE
    =========================================================== */
  // TIMEKEEPING FILTER
  const today = dayjs();

  const [tkDateFrom, setTkDateFrom] = useState(
    today.subtract(14, "day").format("YYYY-MM-DD"),
  );

  const [tkDateTo, setTkDateTo] = useState(today.format("YYYY-MM-DD"));
  const [recordFrom, setRecordFrom] = useState("All");

  // OFFSET HISTORY FILTER
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyOffsetType, setHistoryOffsetType] = useState("");

  const [selectedRecord, setSelectedRecord] = useState(null);

  const [offsetDate, setOffsetDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [offsetHours, setOffsetHours] = useState("");
  const [remarks, setRemarks] = useState("");

  const [offsetApplications, setOffsetApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [offsetType, setOffsetType] = useState("Opening");

  const [viewMode, setViewMode] = useState("card");
  const [currentPage, setCurrentPage] = useState(1);

  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const [searchFields, setSearchFields] = useState({
    offsetStatus: "",
  });

  /* ===========================================================
       FILTER VALID TIMEKEEPING
    =========================================================== */
  const validOffsetRecords = useMemo(() => {
    const today = dayjs();
    const cutoffDate = today.subtract(14, "day");

    return timekeepingRecords.filter((r) => {
      const recordDate = dayjs(r.date);

      if (recordDate.isBefore(cutoffDate, "day")) return false;
      if (tkDateFrom && recordDate.isBefore(dayjs(tkDateFrom), "day"))
        return false;
      if (tkDateTo && recordDate.isAfter(dayjs(tkDateTo), "day")) return false;

      return true;
    });
  }, [timekeepingRecords, tkDateFrom, tkDateTo]);
  /* ===========================================================
       SELECT RECORD
    =========================================================== */

  const handleSelectRecord = (row) => {
    // If already selected → deselect
    if (selectedRecord?.id === row.id) {
      setSelectedRecord(null);
      setOffsetHours("");
      setRemarks("");
      setOffsetDate(dayjs().format("YYYY-MM-DD"));
      return;
    }

    // Otherwise select
    setSelectedRecord(row);
    setOffsetHours("");
    setRemarks(
      `Offset from overtime on ${dayjs(row.date).format("MM/DD/YYYY")}`,
    );
  };

  const getRemainingForRow = (row) => {
    return Number(row?.remainingHours || 0);
  };

  const getTotalAvailable = (row) => {
    if (!row) return 0;
    return Number(row.totalOT || 0).toFixed(2);
  };

  const getRemainingBalance = (row) => {
    if (!row) return 0;

    if (offsetType === "Opening") {
      return Math.max(
        Number(row.openingHours) - Number(row.appliedBeforeShift),
        0,
      );
    }

    if (offsetType === "Closing") {
      return Math.max(
        Number(row.closingHours) - Number(row.appliedAfterShift),
        0,
      );
    }

    // If All → use backend remaining
    return Number(row.remainingHours || 0);
  };

  const escapeHTML = (str = "") =>
    str.replace(
      /[&<>'"]/g,
      (tag) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[tag] || tag,
    );

  /* ===========================================================
       SUBMIT OFFSET
    =========================================================== */

  const handleSubmit = async () => {
    if (!selectedRecord) {
      Swal.fire("Select Record", "Please select overtime record.", "warning");
      return;
    }

    if (!offsetDate || !offsetHours || !remarks.trim()) {
      Swal.fire("Incomplete", "Fill all required fields.", "warning");
      return;
    }

    const remaining = getRemainingBalance(selectedRecord);

    if (Number(offsetHours) > remaining) {
      Swal.fire(
        "Exceeded Balance",
        `Remaining balance is ${remaining} hour(s).`,
        "error",
      );
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Confirm Offset Application",
      html: `
    <div style="text-align:left;">
      <table style="width:100%; font-size:14px;">
        <tr>
          <td style="width:140px;"><b>Source Date:</b></td>
          <td>${dayjs(selectedRecord.date).format("MM/DD/YYYY")}</td>
        </tr>
        <tr>
          <td><b>Time From:</b></td>
          <td>${selectedRecord.timeIn}</td>
        </tr>
        <tr>
          <td><b>Time To:</b></td>
          <td>${selectedRecord.timeOut}</td>
        </tr>
        <tr>
          <td><b>Offset Date:</b></td>
          <td>${dayjs(offsetDate).format("MM/DD/YYYY")}</td>
        </tr>
        <tr>
          <td><b>Total Hours:</b></td>
          <td>${offsetHours}</td>
        </tr>
        <tr>
          <td><b>Remaining After:</b></td>
          <td>${computedRemainingBalance} hr(s)</td>
        </tr>
        <tr>
          <td><b>Remarks:</b></td>
          <td>${escapeHTML(remarks.trim())}</td>
        </tr>
      </table>
    </div>
  `,
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      customClass: {
        popup: "swal-sm-popup",
        title: "swal-sm-title",
        confirmButton: "swal-sm-confirm",
        cancelButton: "swal-sm-cancel",
      },
    });

    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);

      const payload = {
        json_data: {
          empNo: user.empNo,
          offsetDate,
          offsetHrs: Number(offsetHours),
          offsetRemarks: remarks,
          offsetType: offsetType,
          sourceDate: selectedRecord.date,
        },
      };

      const response = await axios.post(API_ENDPOINTS.upsertOffset, payload);

      const returnedStamp = response.data?.offsetStamp;

      const newEntry = {
        id: Date.now(),
        sourceDate: selectedRecord.date,
        offsetDate,
        offsetHours: Number(offsetHours),
        remarks,
        offsetStatus: "Pending",
        offsetStamp: returnedStamp,
      };

      Swal.fire("Submitted", "Offset submitted successfully.", "success");

      await fetchDTR();
      await fetchOffsetHistory();

      setOffsetHours("");
      setRemarks("");
      setOffsetDate(dayjs().format("YYYY-MM-DD"));
      setSelectedRecord(null);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to submit offset application.", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ===========================================================
       CANCEL
    =========================================================== */

  const cancelApplication = async (entry) => {
    const display = {
      offsetDate: dayjs(entry.offsetDate).format("MM/DD/YYYY"),
      hours: entry.offsetHours,
      remarks: entry.remarks || "—",
      status: entry.offsetStatus,
    };

    const conf = await Swal.fire({
      icon: "warning",
      title: "Cancel this application?",
      html: `
      <div style="text-align:left;">
        <p style="margin:0 0 8px; font-size:13px;">
          This will mark your pending offset request as <b>Cancelled</b>.
        </p>

        <table style="width:100%; font-size:14px;">
          <tr>
            <td style="width:160px;"><b>Offset Date:</b></td>
            <td>${display.offsetDate}</td>
          </tr>
          <tr>
            <td><b>Total Hours:</b></td>
            <td>${display.hours} hr(s)</td>
          </tr>
          <tr>
            <td><b>Status:</b></td>
            <td>${display.status}</td>
          </tr>
          <tr>
            <td><b>Remarks:</b></td>
            <td>${escapeHTML(display.remarks)}</td>
          </tr>
        </table>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "No",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      customClass: {
        popup: "swal-sm-popup",
        title: "swal-sm-title",
        confirmButton: "swal-sm-confirm",
        cancelButton: "swal-sm-cancel",
      },
    });

    if (!conf.isConfirmed) return;

    try {
      setLoading(true);
      await axios.post(API_ENDPOINTS.cancelOffset, {
        json_data: {
          empNo: user.empNo,
          offsetStamp: entry.offsetStamp,
        },
      });

      setOffsetApplications((prev) =>
        prev.map((r) =>
          r.offsetStamp === entry.offsetStamp
            ? { ...r, offsetStatus: "Cancelled" }
            : r,
        ),
      );

      Swal.fire("Cancelled", "Offset application cancelled.", "success");

      await fetchDTR();
      await fetchOffsetHistory();
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to cancel offset application.", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ===========================================================
       FILTER + SORT HISTORY
    =========================================================== */

  useEffect(() => {
    let rows = [...offsetApplications];

    if (historyDateFrom) {
      rows = rows.filter((r) =>
        dayjs(r.offsetDate).isSameOrAfter(dayjs(historyDateFrom)),
      );
    }

    if (historyDateTo) {
      rows = rows.filter((r) =>
        dayjs(r.offsetDate).isSameOrBefore(dayjs(historyDateTo)),
      );
    }

    if (historyStatus) {
      rows = rows.filter((r) => r.offsetStatus === historyStatus);
    }

    if (historyOffsetType) {
      rows = rows.filter((r) => r.offsetType === historyOffsetType);
    }

    if (sortConfig.key) {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      rows.sort(
        (a, b) =>
          String(a[sortConfig.key]).localeCompare(String(b[sortConfig.key])) *
          dir,
      );
    }

    setFilteredApplications(rows);
    setCurrentPage(1);
  }, [
    offsetApplications,
    sortConfig,
    historyDateFrom,
    historyDateTo,
    historyStatus,
    historyOffsetType,
  ]);

  const sortData = (key) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) =>
    sortConfig.key === key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "";

  /* ===========================================================
       PAGINATION
    =========================================================== */

  const recordsPerPage = 10;

  const totalPages =
    Math.ceil(filteredApplications.length / recordsPerPage) || 1;

  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;

  const currentRecords = filteredApplications.slice(indexOfFirst, indexOfLast);

  const handleClearFilters = () => {
    const today = dayjs();

    setTkDateFrom(today.subtract(14, "day").format("YYYY-MM-DD"));
    setTkDateTo(today.format("YYYY-MM-DD"));
    setRecordFrom("");
  };

  const computedRemainingBalance = useMemo(() => {
    if (!selectedRecord) return 0;

    const available = getRemainingBalance(selectedRecord);
    const entered = Number(offsetHours || 0);

    const remaining = available - entered;

    return remaining > 0 ? Number(remaining.toFixed(2)) : 0;
  }, [selectedRecord, offsetHours, offsetApplications, offsetType]);

  const fetchOffsetHistory = async () => {
  try {
    if (!user?.empNo) return;

    setLoading(true);

    const response = await axios.post(API_ENDPOINTS.getOffsetAppHistory, {
      EMP_NO: user.empNo,
      START_DATE:
        historyDateFrom || dayjs().startOf("month").format("YYYY-MM-DD"),
      END_DATE: historyDateTo || dayjs().endOf("month").format("YYYY-MM-DD"),
    });

    if (response.data.status === "success") {
      const mapped = (response.data.data || []).map((r, index) => ({
        id: index + 1,
        offsetDate: r.offsetDate,
        sourceDate: r.sourceDate,
        offsetHours: Number(r.offsetHrs),
        offsetType: r.offsetType,
        remarks: r.offsetRemarks,
        offsetStatus: r.offsetStatus,
        offsetStamp: r.offsetStamp,
        approverRemarks: r.approverRemarks || null,
      }));

      setOffsetApplications(mapped);
    }
  } catch (error) {
    console.error("Failed to load offset history:", error);
  } finally {
    setLoading(false);
  }
};

  /* ===========================================================
       UI
    =========================================================== */

  return (
    <div className="ml-0 lg:ml-[200px] mt-[70px] lg:mt-[80px] p-2 sm:p-4 bg-gray-100 min-h-screen">
      {/* ✅ LOADING SPINNER */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white px-8 py-5 rounded-xl shadow-xl flex items-center gap-4">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-semibold text-gray-700">
              Loading...
            </span>
          </div>
        </div>
      )}

      <div className="global-div-header-ui">
        <h1 className="global-div-headertext-ui">My Offset Applications</h1>
      </div>

      {/* Filters */}
      <div className="mt-4 bg-white p-4 shadow-md rounded-lg">
        <h2 className="text-base font-semibold">Filter Timekeeping Records</h2>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <div className="relative">
            <input
              type="date"
              value={tkDateFrom}
              onChange={(e) => setTkDateFrom(e.target.value)}
              className="w-full min-w-0 text-sm h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none appearance-none"
            />
          </div>

          <div className="relative">
            <input
              type="date"
              value={tkDateTo}
              onChange={(e) => setTkDateTo(e.target.value)}
              min={tkDateFrom}
              className="w-full min-w-0 text-sm h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none appearance-none"
            />
          </div>

          <select
            value={recordFrom}
            onChange={(e) => setRecordFrom(e.target.value)}
            className="w-full px-2 py-2 border border-gray-200 rounded text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="All">All Records</option>
            <option value="Opening">Opening – Pre-Shift Overtime</option>
            <option value="Closing">Closing – Post-Shift Overtime</option>
          </select>
        </div>
      </div>
      {/* ================= TIMEKEEPING RECORDS ================= */}

      <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Timekeeping Records</h2>
        </div>

        <div className="w-full overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs sm:text-sm text-center border-collapse">
            <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm">
              <tr>
                {[
                  { key: "date", label: "Date" },
                  { key: "timeIn", label: "Time In" },
                  { key: "timeOut", label: "Time Out" },
                  { key: "overtime", label: "Available Hours" },
                  { key: "remaining", label: "Remaining Hours" },
                  { key: "totalHours", label: "Total Hours" },
                  { key: "actions", label: "Actions" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="py-2 px-3 whitespace-nowrap cursor-pointer"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="global-tbody">
              {validOffsetRecords.length ? (
                validOffsetRecords.map((row) => {
                  const remaining = getRemainingForRow(row);
                  const isDisabled = remaining <= 0;
                  const isSelected = selectedRecord?.id === row.id;
                  const displayHours =
                    recordFrom === "Opening"
                      ? row.openingHours
                      : recordFrom === "Closing"
                        ? row.closingHours
                        : row.totalOT;

                  return (
                    <tr
                      key={row.id}
                      className={`
                  global-tr transition-all
                  ${isSelected ? "bg-blue-50 font-semibold" : ""}
                `}
                    >
                      <td className="global-td whitespace-nowrap">
                        {dayjs(row.date).format("MM/DD/YYYY")}
                      </td>

                      <td className="global-td whitespace-nowrap">
                        {row.timeIn}
                      </td>

                      <td className="global-td whitespace-nowrap">
                        {row.timeOut}
                      </td>

                      <td className="global-td text-blue-700 font-semibold whitespace-nowrap">
                        {displayHours.toFixed(2)} hr(s)
                      </td>

                      <td className="global-td text-green-700 font-semibold whitespace-nowrap">
                        {row.remainingHours.toFixed(2)} hr(s)
                      </td>

                      <td className="global-td font-bold whitespace-nowrap">
                        {row.totalHours.toFixed(2)} hr(s)
                      </td>

                      <td className="global-td whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (!isDisabled) {
                              handleSelectRecord(row);
                            }
                          }}
                          disabled={isDisabled}
                          className={`px-3 py-1 text-xs rounded transition-all
      ${
        isDisabled
          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
          : isSelected
            ? "bg-green-600 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
      }
    `}
                        >
                          {isDisabled
                            ? "Fully Consumed"
                            : isSelected
                              ? "Selected"
                              : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No valid overtime records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= SELECTED BIOMETRIC RECORD ================= */}

      <div className="mt-4 bg-white p-6 shadow rounded-lg text-sm">
        <h2 className="text-base font-semibold mb-4">
          Overtime Source Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* DATE */}
          <div>
            <label className="block font-semibold mb-1 text-gray-600">
              Date
            </label>
            <input
              type="text"
              readOnly
              value={
                selectedRecord
                  ? dayjs(selectedRecord.date).format("MM/DD/YYYY")
                  : "—"
              }
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          {/* TIME FROM */}
          <div>
            <label className="block font-semibold mb-1 text-gray-600">
              Time From
            </label>
            <input
              type="text"
              readOnly
              value={selectedRecord ? selectedRecord.timeIn : "—"}
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          {/* TIME TO */}
          <div>
            <label className="block font-semibold mb-1 text-gray-600">
              Time To
            </label>
            <input
              type="text"
              readOnly
              value={selectedRecord ? selectedRecord.timeOut : "—"}
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          {/* AVAILABLE OFFSET */}
          <div>
            <label className="block font-semibold mb-1 text-blue-700">
              Available Offset Hours
            </label>
            <input
              type="text"
              readOnly
              value={
                selectedRecord
                  ? `${getTotalAvailable(selectedRecord)} hr(s)`
                  : "0.00 hr(s)"
              }
              className="w-full p-2 border rounded bg-blue-50 text-blue-800 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* ================= OFFSET APPLICATION DETAILS ================= */}

      <div className="mt-4 bg-white p-6 shadow-md rounded-lg">
        <h2 className="text-base font-semibold mb-5">
          Offset Application Details
        </h2>

        {/* Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Offset Date */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Offset Date <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <input
                type="date"
                value={offsetDate}
                onChange={(e) => setOffsetDate(e.target.value)}
                className="w-full min-w-0 text-sm h-11 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Offset Type <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <select
                value={offsetType}
                onChange={(e) => setOffsetType(e.target.value)}
                className="w-full h-11 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Opening">Opening – Pre-Shift Overtime</option>
                <option value="Closing">Closing – Post-Shift Overtime</option>
              </select>
            </div>
          </div>

          {/* Total Hours */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Total Hours <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.5"
              max={selectedRecord ? getRemainingBalance(selectedRecord) : 0}
              value={offsetHours}
              onChange={(e) => {
                const value = Number(e.target.value);
                const remaining = selectedRecord
                  ? getRemainingBalance(selectedRecord)
                  : 0;

                if (value > remaining) {
                  setOffsetHours(remaining);
                } else {
                  setOffsetHours(value);
                }
              }}
              placeholder="Enter hours"
              className="h-11 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Remaining Balance */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-blue-700 mb-1">
              Remaining Balance
            </label>
            <input
              type="text"
              readOnly
              value={
                selectedRecord
                  ? `${computedRemainingBalance} hr(s)`
                  : "0.00 hr(s)"
              }
              className="h-11 px-3 border border-blue-200 bg-blue-50 rounded-md text-sm font-semibold text-blue-700"
            />
          </div>
        </div>

        {/* Remarks */}
        <div className="mt-5">
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Remarks / Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            rows="4"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <div className="mt-6 text-center">
          <button
            onClick={handleSubmit}
            disabled={!selectedRecord}
            className={`px-10 h-11 rounded-md text-white text-sm font-medium transition
        ${
          selectedRecord
            ? "bg-blue-700 hover:bg-blue-800"
            : "bg-gray-400 cursor-not-allowed"
        }`}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 bg-white p-4 shadow-md rounded-lg">
        <h2 className="text-base font-semibold">
          Filter Timekeeping Records History
        </h2>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <div className="relative">
            <input
              type="date"
              value={tkDateFrom}
              onChange={(e) => setTkDateFrom(e.target.value)}
              className="w-full min-w-0 text-sm h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none appearance-none"
            />
          </div>

          <div className="relative">
            <input
              type="date"
              value={tkDateTo}
              onChange={(e) => setTkDateTo(e.target.value)}
              min={tkDateFrom}
              className="w-full min-w-0 text-sm h-10 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none appearance-none"
            />
          </div>

          <select
            value={historyOffsetType}
            onChange={(e) => setHistoryOffsetType(e.target.value)}
            className="w-full px-2 py-2 border border-gray-200 rounded text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Records</option>
            <option value="Opening">Opening – Pre-Shift Overtime</option>
            <option value="Closing">Closing – Post-Shift Overtime</option>
          </select>

          <select
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value)}
            className="w-full px-2 py-2 border border-gray-200 rounded text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Disapproved">Disapproved</option>
          </select>
        </div>
      </div>

      {/* History */}
      <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold">
            Offset Application History
          </h2>
          <div className="inline-flex rounded-lg border overflow-hidden self-start">
            <button
              className={`px-8 py-2 text-sm ${
                viewMode === "card" ? "bg-blue-800 text-white" : "bg-white"
              }`}
              onClick={() => setViewMode("card")}
            >
              Card
            </button>
            <button
              className={`px-8 py-2 text-sm border-l ${
                viewMode === "accordion" ? "bg-blue-800 text-white" : "bg-white"
              }`}
              onClick={() => setViewMode("accordion")}
            >
              Accordion
            </button>
            <button
              className={`px-8 py-2 text-sm border-l ${
                viewMode === "table" ? "bg-blue-800 text-white" : "bg-white"
              }`}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
          </div>
        </div>

        {/* ================= CARD VIEW ================= */}
        {viewMode === "card" && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {currentRecords.length ? (
              currentRecords.map((entry, idx) => {
                const statusClass =
                  entry.offsetStatus === "Pending"
                    ? "text-yellow-700 bg-yellow-100 font-semibold"
                    : entry.offsetStatus === "Approved"
                      ? "text-blue-700 bg-blue-100 font-semibold"
                      : entry.offsetStatus === "Cancelled"
                        ? "text-gray-700 bg-gray-200 font-semibold"
                        : entry.offsetStatus === "Disapproved"
                          ? "text-red-700 bg-red-100 font-semibold"
                          : "text-gray-500 bg-gray-100";

                return (
                  <div key={idx} className="border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm md:text-base">
                        {dayjs(entry.offsetDate).format("MM/DD/YYYY")}
                      </div>
                      <span
                        className={`inline-flex justify-center items-center text-sm w-28 py-1 rounded-lg ${statusClass}`}
                      >
                        {entry.offsetStatus || "N/A"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-semibold">
                        Offset Type
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          entry.offsetType === "Opening"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {entry.offsetType}
                      </span>
                    </div>

                    <div className="space-y-1 text-[12px] md:text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-semibold">
                          Hours
                        </span>
                        <span className="font-medium">
                          {entry.offsetHours} hr(s)
                        </span>
                      </div>

                      <div className="mt-2">
                        <div className="text-gray-500 font-semibold">
                          Employee Remarks:
                        </div>
                        <div className="font-normal break-words text-black">
                          {entry.remarks || "N/A"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-gray-500 font-semibold">
                        Approver Remarks:
                      </div>
                      <div className="font-normal break-words text-black">
                        {entry.approverRemarks || "—"}
                      </div>
                    </div>

                    {entry?.offsetStatus === "Pending" && (
                      <div className="mt-3 text-right">
                        <button
                          className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                          onClick={() => cancelApplication(entry)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center text-gray-500 py-6">
                No offset applications found.
              </div>
            )}
          </div>
        )}

        {/* ================= ACCORDION VIEW ================= */}
        {viewMode === "accordion" && (
          <div className="mt-4 divide-y border rounded-lg">
            {currentRecords.length ? (
              currentRecords.map((entry, idx) => {
                const statusClass =
                  entry.offsetStatus === "Pending"
                    ? "text-yellow-700 bg-yellow-100 font-semibold"
                    : entry.offsetStatus === "Approved"
                      ? "text-blue-700 bg-blue-100 font-semibold"
                      : entry.offsetStatus === "Cancelled"
                        ? "text-gray-700 bg-gray-200 font-semibold"
                        : "text-red-700 bg-red-100 font-semibold";

                return (
                  <details
                    key={idx}
                    className="group p-2 text-[12px] md:text-sm"
                  >
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <div className="font-medium">
                        {dayjs(entry.offsetDate).format("MM/DD/YYYY")} •{" "}
                        {entry.offsetHours} hr(s)
                      </div>
                      <span
                        className={`inline-flex justify-center items-center w-28 py-1 rounded-lg ${statusClass}`}
                      >
                        {entry.offsetStatus || "N/A"}
                      </span>
                    </summary>

                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="text-gray-500 font-semibold">
                          Employee Remarks
                        </div>
                        <div>{entry.remarks || "N/A"}</div>
                      </div>

                      <div>
                        <div className="text-gray-500 font-semibold">
                          Approver Remarks
                        </div>
                        <div>{entry.approverRemarks || "—"}</div>
                      </div>

                      {entry?.offsetStatus === "Pending" && (
                        <div className="pt-2 text-right">
                          <button
                            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => cancelApplication(entry)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })
            ) : (
              <div className="text-center text-gray-500 py-6">
                No offset applications found.
              </div>
            )}
          </div>
        )}

        {/* ================= TABLE VIEW ================= */}
        {viewMode === "table" && (
          <div className="w-full overflow-x-auto mt-4 rounded-lg border border-gray-200">
            <table className="w-full text-xs sm:text-sm text-center border-collapse">
              <thead className="sticky top-0 z-10 bg-blue-800 text-white text-xs sm:text-sm">
                <tr>
                  {[
                    { key: "offsetDate", label: "Offset Date" },
                    { key: "offsetHours", label: "Duration" },
                    { key: "remarks", label: "Employee Remarks" },
                    { key: "approverRemarks", label: "Approver Remarks" },
                    { key: "offsetStatus", label: "Status" },
                    { key: "actions", label: "Actions" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      className="py-2 px-3 whitespace-nowrap cursor-pointer"
                      onClick={() => key !== "actions" && sortData(key)}
                    >
                      {label} {key !== "actions" ? getSortIndicator(key) : ""}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="global-tbody">
                {currentRecords.length ? (
                  currentRecords.map((entry, i) => {
                    const statusClass =
                      entry.offsetStatus === "Pending"
                        ? "text-yellow-700 bg-yellow-100 font-semibold"
                        : entry.offsetStatus === "Approved"
                          ? "text-blue-700 bg-blue-100 font-semibold"
                          : entry.offsetStatus === "Cancelled"
                            ? "text-gray-700 bg-gray-200 font-semibold"
                            : "text-red-700 bg-red-100 font-semibold";

                    return (
                      <tr key={i} className="global-tr">
                        <td className="global-td whitespace-nowrap">
                          {dayjs(entry.offsetDate).format("MM/DD/YYYY")}
                        </td>
                        <td className="global-td whitespace-nowrap text-right">
                          {entry.offsetHours} hr(s)
                        </td>
                        <td
                          className="global-td text-left max-w-[240px] truncate"
                          title={entry.remarks || "N/A"}
                        >
                          {entry.remarks || "N/A"}
                        </td>
                        <td className="global-td text-center whitespace-nowrap">
                          <span
                            className={`inline-flex justify-center items-center text-xs w-28 py-1 rounded-lg ${statusClass}`}
                          >
                            {entry.offsetStatus || "N/A"}
                          </span>
                        </td>
                        <td className="global-td text-center whitespace-nowrap">
                          {entry?.offsetStatus === "Pending" ? (
                            <button
                              className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                              onClick={() => cancelApplication(entry)}
                            >
                              Cancel
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No offset applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* PAGINATION */}
        {filteredApplications.length > 0 && (
          <div className="flex justify-between items-center mt-4 pt-3 border-t">
            <div className="text-xs text-gray-600">
              Showing{" "}
              <b>
                {Math.min(indexOfFirst + 1, filteredApplications.length)}-
                {Math.min(indexOfLast, filteredApplications.length)}
              </b>{" "}
              of {filteredApplications.length} entries
            </div>

            <div className="flex items-center text-sm border rounded-lg overflow-hidden">
              {/* PREVIOUS */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border-r hover:bg-gray-100 disabled:text-gray-400"
              >
                &lt;
              </button>

              {/* PAGE NUMBERS */}
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 border-r ${
                    currentPage === i + 1
                      ? "bg-blue-800 text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {i + 1}
                </button>
              ))}

              {/* NEXT */}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 hover:bg-gray-100 disabled:text-gray-400"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OffsetApplication;
