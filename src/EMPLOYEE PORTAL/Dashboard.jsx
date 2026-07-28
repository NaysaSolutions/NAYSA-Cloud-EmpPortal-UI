import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Tooltip } from "react-tooltip";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useAuth } from "./AuthContext"; 
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faClock } from "@fortawesome/free-solid-svg-icons";
import LeaveCreditModal from "./LeaveCreditModal";
import API_ENDPOINTS from "@/apiConfig.jsx";
import "@/index.css";

dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TIMEZONE = "Asia/Manila";
const SERVER_TIME_SYNC_INTERVAL_MS = 300000;
const toDashboardNumber = (value) => {
  const numericValue = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const formatDashboardNumber = (value, digits = 2) =>
  toDashboardNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const parseDashboardDate = (value) => {
  if (!value) return null;

  const parsed = dayjs(
    String(value).trim(),
    ["YYYY-MM-DD", "YYYY/MM/DD", "MM/DD/YYYY", "M/D/YYYY", "MM-DD-YYYY", "M-D-YYYY"],
    true
  );

  if (parsed.isValid()) return parsed;

  const fallback = dayjs(value);
  return fallback.isValid() ? fallback : null;
};

const getHolidayDate = (holiday) =>
  parseDashboardDate(
    holiday?.holdate ||
      holiday?.holDate ||
      holiday?.holidayDate ||
      holiday?.date ||
      holiday?.HOL_DATE ||
      holiday?.HOLDATE
  );

const getHolidayName = (holiday) =>
  String(
    holiday?.holtype ||
      holiday?.holidayName ||
      holiday?.description ||
      holiday?.HOLTYPE ||
      "Holiday"
  ).trim();

const getLeaveDateRange = (leave) => {
  const rawDate = String(leave?.dateapplied || leave?.leaveDate || "").trim();
  const [startRaw, endRaw] = rawDate.split(" - ");
  const startDate = parseDashboardDate(startRaw);
  const endDate = parseDashboardDate(endRaw || startRaw);

  if (!startDate || !endDate || !startDate.isValid() || !endDate.isValid()) {
    return null;
  }

  return { startDate, endDate };
};

const formatCalendarDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "N/A";
  if (startDate.isSame(endDate, "day")) return startDate.format("MMM DD, YYYY");
  return `${startDate.format("MMM DD")} - ${endDate.format("MMM DD, YYYY")}`;
};

const parseServerDateTime = (value) => {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    return value < 1000000000000 ? value * 1000 : value;
  }

  const rawValue = String(value).trim();
  const hasExplicitTimezone =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue) || /\b(?:GMT|UTC)\b/i.test(rawValue);
  const parsed = hasExplicitTimezone
    ? dayjs(rawValue)
    : dayjs.tz(rawValue, PH_TIMEZONE);

  return parsed.isValid() ? parsed.valueOf() : null;
};

const getServerTimestampFromPayload = (payload, response) => {
  const candidates = [
    payload?.philippineStandardTime,
    payload?.philippine_standard_time,
    payload?.serverTime,
    payload?.server_time,
    payload?.currentDateTime,
    payload?.current_datetime,
    payload?.datetime,
    payload?.timestamp,
    response?.headers?.get?.("date"),
  ];

  for (const candidate of candidates) {
    const timestamp = parseServerDateTime(candidate);
    if (timestamp) return timestamp;
  }

  return null;
};

const DEFAULT_SUM = Object.freeze({
  LVApplicationCount: 0,
  LVApprovalCount: 0,
  OTApplicationCount: 0,
  OTApprovalCount: 0,
  OBApplicationCount: 0,
  OBApprovalCount: 0,
  DTRApplicationCount: 0,
  DTRApprovalCount: 0,
});

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const Dashboard = () => {
  const trustedClockRef = useRef(null);
  const trustedMonthInitializedRef = useRef(false);

  const [currentDate, setCurrentDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf("month"));
  const [dailyTimeRecord, setDailyTimeRecord] = useState([]);
  const [leaveCredit, setLeaveCredit] = useState([]);
  const [loanBalance, setLoanBalance] = useState([]);
  const [leaveApplication, setLeaveApplication] = useState([]);
  const [otApplication, setOtApplication] = useState([]);
  const [obApplication, setOfficialBusinessApplication] = useState([]);
  const [otApproval, setOtApproval] = useState([]);
  const [leaveApproval, setLeaveApproval] = useState([]);
  const [obApproval, setOfficialBusinessApproval] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [time, setTime] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeTab, setActiveTab] = useState("leave");
  const [activeApproverTab, setActiveApproverTab] = useState("leave");
  const [approvalsum, setApprovalsum] = useState(DEFAULT_SUM);

  const { user, setUser, authLoading } = useAuth();
  const navigate = useNavigate();

  const getTrustedPhilippineNow = useCallback(() => {
    const trustedClock = trustedClockRef.current;

    if (
      !trustedClock ||
      !Number.isFinite(trustedClock.serverTimestamp) ||
      !Number.isFinite(trustedClock.performanceTimestamp)
    ) {
      return null;
    }

    return dayjs(
      trustedClock.serverTimestamp +
        (performance.now() - trustedClock.performanceTimestamp)
    ).tz(PH_TIMEZONE);
  }, []);

  const syncPhilippineClock = useCallback(async () => {
    const requestedAt = performance.now();

    try {
      const response = await fetch(`${API_ENDPOINTS.serverTime}?t=${requestedAt}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const receivedAt = performance.now();

      if (!response.ok) {
        throw new Error(`Server time request failed (${response.status}).`);
      }

      const payload = await response.json().catch(() => ({}));
      const serverTimestamp = getServerTimestampFromPayload(payload, response);

      if (!serverTimestamp) {
        throw new Error("Server date/time was not available.");
      }

      trustedClockRef.current = {
        serverTimestamp:
          serverTimestamp + Math.round((receivedAt - requestedAt) / 2),
        performanceTimestamp: receivedAt,
      };

      const trustedNow = getTrustedPhilippineNow();

      if (!trustedNow) {
        throw new Error("Unable to start trusted Philippine Standard Time clock.");
      }

      setCurrentDate(trustedNow);
      setTime(trustedNow.format("hh:mm:ss A"));

      if (!trustedMonthInitializedRef.current) {
        setCurrentMonth(trustedNow.startOf("month"));
        trustedMonthInitializedRef.current = true;
      }
    } catch (clockError) {
      trustedClockRef.current = null;
      setCurrentDate(null);
      setTime("");
      console.error("Dashboard Philippine Standard Time sync failed:", clockError);
    }
  }, [getTrustedPhilippineNow]);

  const fetchDashboardData = useCallback(async () => {
    const empNo = user?.empNo;

    if (!empNo) {
      setIsDashboardLoading(false);
      return;
    }

    setIsDashboardLoading(true);
    setError(null);

    try {
      const dashboardResponse = await fetch(API_ENDPOINTS.dashBoard, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ EMP_NO: empNo }),
      });

      if (!dashboardResponse.ok) {
        throw new Error(`Dashboard request failed (${dashboardResponse.status}).`);
      }

      const dashboardResult = await dashboardResponse.json();

      if (
        !dashboardResult?.success ||
        !Array.isArray(dashboardResult.data) ||
        dashboardResult.data.length === 0
      ) {
        throw new Error("No dashboard data was returned for this employee.");
      }

      const employee =
        dashboardResult.data.find((item) => item.empNo === empNo) ||
        dashboardResult.data[0];

      setUser((previousUser) => {
        if (previousUser?.approver === employee.approver) return previousUser;

        return {
          ...(previousUser || {}),
          approver: employee.approver,
        };
      });

      setLeaveCredit(employee.leaveCredit || []);
      setDailyTimeRecord(employee.dailyTimeRecord || []);
      setLoanBalance(employee.loanBalance || []);
      setOtApproval(employee.otApproval || []);
      setLeaveApproval(employee.leaveApproval || []);
      setOfficialBusinessApproval(employee.obApproval || []);
      setHolidays(employee.holidays || []);
      setLeaveApplication(employee.leaveApplication || []);
      setOtApplication(employee.otApplication || []);
      setOfficialBusinessApplication(employee.obApplication || []);

      const rawSummary = employee.approvalsum;
      const summary = Array.isArray(rawSummary)
        ? rawSummary[0] || DEFAULT_SUM
        : rawSummary || DEFAULT_SUM;

      setApprovalsum({
        LVApplicationCount: Number(summary.LVApplicationCount ?? 0),
        LVApprovalCount: Number(summary.LVApprovalCount ?? 0),
        OTApplicationCount: Number(summary.OTApplicationCount ?? 0),
        OTApprovalCount: Number(summary.OTApprovalCount ?? 0),
        OBApplicationCount: Number(summary.OBApplicationCount ?? 0),
        OBApprovalCount: Number(summary.OBApprovalCount ?? 0),
        DTRApplicationCount: Number(summary.DTRApplicationCount ?? 0),
        DTRApprovalCount: Number(summary.DTRApprovalCount ?? 0),
      });
    } catch (requestError) {
      console.error("Error fetching dashboard data:", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "An error occurred while fetching dashboard records."
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }, [setUser, user?.empNo]);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchDashboardData();
    }
  }, [authLoading, fetchDashboardData]);

  useEffect(() => {
    syncPhilippineClock();

    const syncInterval = window.setInterval(
      syncPhilippineClock,
      SERVER_TIME_SYNC_INTERVAL_MS
    );

    const clockInterval = window.setInterval(() => {
      const trustedNow = getTrustedPhilippineNow();

      if (!trustedNow) return;

      setCurrentDate(trustedNow);
      setTime(trustedNow.format("hh:mm:ss A"));
    }, 1000);

    return () => {
      window.clearInterval(syncInterval);
      window.clearInterval(clockInterval);
    };
  }, [getTrustedPhilippineNow, syncPhilippineClock]);

  const handlePrevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, "month"));
  };

  const generateCalendar = () => {
    const startDay = currentMonth.startOf("month").day();
    const daysInMonth = currentMonth.daysInMonth();
    const prevMonthDays = currentMonth.subtract(1, "month").daysInMonth();
    const trustedToday = currentDate;
    const today = trustedToday?.date();

    let days = [];
    const approvedLeaveDays = new Map();
    const pendingLeaveDays = new Map();
    const holidayDays = new Map();

    holidays.forEach((holiday) => {
      const holidayDate = getHolidayDate(holiday);
      if (holidayDate?.isValid() && holidayDate.isSame(currentMonth, "month")) {
        holidayDays.set(holidayDate.format("YYYY-MM-DD"), holiday);
      }
    });

    leaveApplication.forEach((leave) => {
      const range = getLeaveDateRange(leave);
      const startDate = range?.startDate;
      const endDate = range?.endDate;

      if (startDate && endDate && startDate.isValid() && endDate.isValid()) {
        let current = startDate;
        while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
          if (current.isSame(currentMonth, "month")) {
            const day = current.date();
            const leaveData = {
              type: leave.leavetype,
              fullDate: current.format("YYYY-MM-DD"),
            };

            if (leave.leavestatus === "Approved") {
              approvedLeaveDays.set(day, leaveData);
            } else if (leave.leavestatus === "Pending") {
              pendingLeaveDays.set(day, leaveData);
            }
          }
          current = current.add(1, "day");
        }
      }
    });

    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, currentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const approved = approvedLeaveDays.get(i);
      const pending = pendingLeaveDays.get(i);
      const currentCalendarDate = currentMonth.date(i);
      const calendarDateKey = currentCalendarDate.format("YYYY-MM-DD");
      const holiday = holidayDays.get(calendarDateKey);

      days.push({
        day: i,
        currentMonth: true,
        dateKey: calendarDateKey,
        holiday,
        isToday:
          trustedToday &&
          i === today &&
          currentCalendarDate.isSame(trustedToday, "day"),
        isApprovedLeave: !!approved,
        isPendingLeave: !!pending,
        leaveType: approved?.type || pending?.type || null,
        isHoliday: !!holiday,
      });
    }

    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        days.push({ day: i, currentMonth: false });
      }
    }

    return days;
  };

  const leaveCreditInsights = useMemo(() => {
    const rows = leaveCredit.map((leave, index) => {
      const description =
        String(leave?.description || leave?.lvdesc || leave?.lvtype || `Leave ${index + 1}`).trim();
      const credit = toDashboardNumber(leave?.credit);
      const applied = toDashboardNumber(leave?.applied);
      const used = toDashboardNumber(leave?.availed);
      const remaining = toDashboardNumber(leave?.rembal);
      const actual = toDashboardNumber(leave?.balance);
      const available = actual > 0 ? actual : remaining > 0 ? remaining : 0;

      return {
        description,
        credit,
        applied,
        used,
        remaining,
        actual,
        available,
      };
    });

    const totals = rows.reduce(
      (sum, leave) => ({
        credit: sum.credit + leave.credit,
        used: sum.used + leave.used,
        remaining: sum.remaining + leave.available,
        applied: sum.applied + leave.applied,
      }),
      { credit: 0, used: 0, remaining: 0, applied: 0 }
    );

    const utilization = totals.credit > 0 ? (totals.used / totals.credit) * 100 : 0;
    const chartData = rows
      .filter((leave) => leave.used > 0 || leave.available > 0)
      .map((leave) => ({
        name: leave.description,
        used: leave.used,
        available: leave.available,
      }));
    const chartMaxValue = Math.max(
      1,
      ...chartData.flatMap((leave) => [leave.used, leave.available])
    );
    const lowBalanceCount = rows.filter(
      (leave) => (leave.actual || leave.remaining) > 0 && (leave.actual || leave.remaining) <= 1
    ).length;

    return {
      rows,
      totals,
      utilization,
      chartData,
      chartMaxValue,
      lowBalanceCount,
    };
  }, [leaveCredit]);

  const personalCalendarLists = useMemo(() => {
    const today = currentDate?.startOf("day");

    if (!today) {
      return {
        upcomingHolidays: [],
        upcomingLeaves: [],
        pendingLeaves: [],
      };
    }

    const upcomingHolidays = holidays
      .map((holiday) => {
        const date = getHolidayDate(holiday);
        return date?.isValid()
          ? {
              date,
              name: getHolidayName(holiday),
            }
          : null;
      })
      .filter((holiday) => holiday && !holiday.date.isBefore(today, "day"))
      .sort((left, right) => left.date.valueOf() - right.date.valueOf())
      .slice(0, 10);

    const leaveRows = leaveApplication
      .map((leave) => {
        const range = getLeaveDateRange(leave);
        if (!range) return null;

        return {
          startDate: range.startDate,
          endDate: range.endDate,
          type: leave?.leavetype || "Leave",
          status: String(leave?.leavestatus || "").trim(),
          duration: leave?.duration || "",
        };
      })
      .filter(Boolean);

    const upcomingLeaves = leaveRows
      .filter(
        (leave) =>
          leave.status.toLowerCase() === "approved" &&
          !leave.endDate.isBefore(today, "day")
      )
      .sort((left, right) => left.startDate.valueOf() - right.startDate.valueOf())
      .slice(0, 10);

    const pendingLeaves = leaveRows
      .filter((leave) => leave.status.toLowerCase() === "pending")
      .sort((left, right) => {
        const leftIsLate = left.endDate.isBefore(today, "day");
        const rightIsLate = right.endDate.isBefore(today, "day");

        if (leftIsLate !== rightIsLate) return leftIsLate ? -1 : 1;

        return left.startDate.valueOf() - right.startDate.valueOf();
      })
      .map((leave) => ({
        ...leave,
        isLateFiled: leave.endDate.isBefore(today, "day"),
      }))
      .slice(0, 10);

    return {
      upcomingHolidays,
      upcomingLeaves,
      pendingLeaves,
    };
  }, [currentDate, holidays, leaveApplication]);

  const loanBalanceInsights = useMemo(() => {
    const rows = loanBalance.map((loan, index) => {
      const loanType =
        String(loan?.loantype || loan?.loanType || loan?.description || `Loan ${index + 1}`).trim();
      const loanAmount = toDashboardNumber(loan?.loanamt || loan?.loanAmount);
      const totalPaid = toDashboardNumber(loan?.totalpaid || loan?.totalPaid);
      const balance = toDashboardNumber(loan?.balance);

      return {
        loanType,
        loanAmount,
        totalPaid,
        balance,
      };
    });

    const chartRows = rows.filter(
      (loan) => loan.loanAmount > 0 || loan.totalPaid > 0 || loan.balance > 0
    );
    const maxValue = Math.max(
      1,
      ...chartRows.flatMap((loan) => [loan.loanAmount, loan.totalPaid, loan.balance])
    );

    return {
      rows,
      chartRows,
      maxValue,
    };
  }, [loanBalance]);

  const dtrTrendData = useMemo(() => {
    return dailyTimeRecord
      .slice(0, 7)
      .reverse()
      .map((record) => {
        const hours = toDashboardNumber(record?.reg_hrs);
        const recordDate = parseDashboardDate(record?.trandate);

        return {
          date: recordDate?.isValid() ? recordDate.format("ddd") : "—",
          fullDate: recordDate?.isValid() ? recordDate.format("MMM DD") : "Unknown date",
          hours,
          isUnderTime: hours > 0 && hours < 8,
          heightPct: Math.min(Math.max((hours / 12) * 100, 0), 100),
        };
      });
  }, [dailyTimeRecord]);

  const unifiedRequestStats = useMemo(() => {
    const statuses = [
      ...leaveApplication.map((request) => normalizeStatus(request?.leavestatus)),
      ...otApplication.map((request) => normalizeStatus(request?.otstatus)),
      ...obApplication.map((request) => normalizeStatus(request?.obstatus)),
    ];

    const pending = statuses.filter((status) => status === "pending").length;
    const approved = statuses.filter((status) => status === "approved").length;
    const rejected = statuses.filter(
      (status) => status === "rejected" || status === "declined" || status === "disapproved"
    ).length;
    const total = pending + approved + rejected;

    return {
      total,
      pending,
      approved,
      rejected,
      pendingPct: total > 0 ? (pending / total) * 100 : 0,
      approvedPct: total > 0 ? (approved / total) * 100 : 0,
      rejectedPct: total > 0 ? (rejected / total) * 100 : 0,
    };
  }, [leaveApplication, otApplication, obApplication]);

  const employeeDisplayName =
    user?.empName || user?.employeeName || user?.name || user?.userName || user?.empname || "Employee";

  const requestSummaryCards = [
    {
      code: "LV",
      label: "Leave Applications",
      count: approvalsum?.LVApplicationCount ?? 0,
      route: "/leave",
    },
    {
      code: "OT",
      label: "Overtime Applications",
      count: approvalsum?.OTApplicationCount ?? 0,
      route: "/overtime",
    },
    {
      code: "OB",
      label: "Official Business Applications",
      count: approvalsum?.OBApplicationCount ?? 0,
      route: "/official-business",
    },
    {
      code: "DTR",
      label: "DTR Adjustments Applications",
      count: approvalsum?.DTRApplicationCount ?? 0,
      route: "/timekeepingAdj",
    },
  ];

  const approvalSummaryCards = [
    {
      code: "LV",
      label: "Leave for Approval",
      count: approvalsum?.LVApprovalCount ?? 0,
      route: "/leaveApproval",
    },
    {
      code: "OT",
      label: "Overtime for Approval",
      count: approvalsum?.OTApprovalCount ?? 0,
      route: "/overtimeApproval",
    },
    {
      code: "OB",
      label: "Official Business for Approval",
      count: approvalsum?.OBApprovalCount ?? 0,
      route: "/OfficialBusinessApproval",
    },
    {
      code: "DTR",
      label: "DTR Adustments for Approval",
      count: approvalsum?.DTRApprovalCount ?? 0,
      route: "/timekeepingAdjApproval",
    },
  ];

  if (authLoading) {
    return (
      <div className="mt-[80px] min-h-screen bg-slate-100 p-4 lg:ml-[200px]">
        <div className="mx-auto max-w-[1600px] animate-pulse space-y-4">
          <div className="h-40 rounded-2xl bg-slate-200" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-28 rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-[80px] min-h-screen bg-slate-100/80 p-3 sm:p-4 lg:ml-[200px] lg:p-4">
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-blue-900 to-blue-600 p-5 text-white shadow-xl sm:p-4">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-blue-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-semibold text-blue-50 backdrop-blur">
                Welcome to Employee Portal Dashboard !
              </div>
              {/* <p className="text-sm font-medium text-blue-100">Welcome back, {employeeDisplayName}</p> */}
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {currentDate ? currentDate.format("dddd, MMMM DD, YYYY") : "Verifying Philippine date…"}
              </h1>
              {/* <p className="mt-2 max-w-2xl text-sm text-blue-100/90">
                Review attendance, leave credits, requests, and approvals from one place.
              </p> */}
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto xl:items-stretch">
              <div className="min-w-[230px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100">
                      Philippine Standard Time
                    </p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums">
                      {time || "Syncing time…"}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                    <FontAwesomeIcon icon={faClock} />
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/timekeeping")}
                className="inline-flex min-h-[72px] items-center justify-center rounded-2xl bg-white px-5 py-3 text-lg font-bold text-blue-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30"
              >
                <FontAwesomeIcon icon={faClock} className="mr-2" />
                Open Timekeeping
              </button>
            </div>
          </div>

          {isDashboardLoading && (
            <div className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-blue-50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-300" />
              Updating dashboard data…
            </div>
          )}
        </section>

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Dashboard data could not be loaded.</p>
              <p className="text-red-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white transition hover:bg-red-800"
            >
              Try Again
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-blue-100 bg-white p-3 sm:p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 sm:text-lg mb-1">My pending requests</h2>
              <p className="text-xs text-slate-500 sm:text-xs">Open applications that may still need action.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {requestSummaryCards.map((card) => (
              <button
                type="button"
                key={card.code}
                onClick={() => navigate(card.route)}
                className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-blue-100 px-2 text-xs font-extrabold text-blue-900">
                    {card.code}
                  </span>
                  <span className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700">→</span>
                </div>
                <p className="mt-4 text-3xl font-extrabold tabular-nums text-slate-950">{card.count}</p>
                <p className="mt-1 text-wrap text-xs font-semibold text-slate-600 sm:text-sm" title={card.label}>
                  My {card.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        {user?.approver === "1" && (
          <section className="rounded-2xl border border-blue-100 bg-white p-3 sm:p-4">
            <div className="mb-3">
              <h2 className="text-base font-extrabold text-blue-950 sm:text-lg mb-1">For my approval</h2>
              <p className="text-xs text-slate-500 sm:text-xs">Pending employee requests assigned to you.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {approvalSummaryCards.map((card) => (
                <button
                  type="button"
                  key={card.code}
                  onClick={() => navigate(card.route)}
                  className="group rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-blue-800 px-2 text-xs font-extrabold text-white">
                      {card.code}
                    </span>
                    <span className="text-slate-300 transition group-hover:text-blue-700">→</span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold tabular-nums text-blue-950">{card.count}</p>
                  <p className="mt-1 text-wrap text-xs font-semibold text-slate-600 sm:text-sm" title={card.label}>
                    {card.label}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Leave Credit Section */}
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="dashboard-text-header">Leave Credit</h2>
              <span className="dashboard-text-span">Available credits by leave type</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
              >
                View Details
              </button> */}
              <button
                type="button"
                onClick={() => navigate("/leave")}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                File Leave
              </button>
            </div>
          </div>


          <div className="mt-4 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(420px,1fr)_minmax(420px,0.95fr)]">
            <div className="h-full rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-blue-900">Used vs Available</p>
                  <p className="text-xs text-gray-500">Leave credit usage by type</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase text-gray-500">Used Rate</p>
                  <p className="text-sm font-bold text-blue-900">
                    {formatDashboardNumber(leaveCreditInsights.utilization, 1)}%
                  </p>
                </div>
              </div>

              <div className="mt-4 w-full">
                {leaveCreditInsights.chartData.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-end gap-4 text-[11px] font-semibold text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-yellow-600" />
                        Used
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-blue-800" />
                        Available
                      </span>
                    </div>

                    {leaveCreditInsights.chartData.map((leave) => {
                      const usedWidth = `${Math.max(
                        2,
                        (leave.used / leaveCreditInsights.chartMaxValue) * 100
                      )}%`;
                      const availableWidth = `${Math.max(
                        2,
                        (leave.available / leaveCreditInsights.chartMaxValue) * 100
                      )}%`;

                      return (
                        <div key={leave.name} className="grid grid-cols-[96px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr]">
                          <div className="min-w-0">
                            <p className="truncate text-xs text-wrap font-semibold text-gray-700" title={leave.name}>
                              {leave.name}
                            </p>
                          </div>
                          <div className="space-y-[-1px]">
                            <div className="flex items-center gap-2">
                              <div className="h-3 flex-1 rounded-full bg-yellow-100">
                                <div
                                  className="h-3 rounded-full bg-yellow-600"
                                  style={{ width: usedWidth }}
                                  title={`Used: ${formatDashboardNumber(leave.used)} day(s)`}
                                />
                              </div>
                              <span className="w-12 text-right text-[10px] font-semibold text-yellow-700">
                                {formatDashboardNumber(leave.used)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-3 flex-1 rounded-full bg-blue-100">
                                <div
                                  className="h-3 rounded-full bg-blue-800"
                                  style={{ width: availableWidth }}
                                  title={`Available: ${formatDashboardNumber(leave.available)} day(s)`}
                                />
                              </div>
                              <span className="w-12 text-right text-[10px] font-semibold text-blue-800">
                                {formatDashboardNumber(leave.available)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-48 items-center justify-center text-center text-sm text-gray-500">
                    No leave credits to chart.
                  </div>
                )}
              </div>
            </div>

            <div className="flex h-full min-w-0 flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase text-blue-700">Total Credit</p>
                  <p className="mt-1 text-[14px] sm:text-lg font-bold text-blue-900">
                    {formatDashboardNumber(leaveCreditInsights.totals.credit)}
                  </p>
                </div>
                <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase text-green-700">Total Available</p>
                  <p className="mt-1 text-[14px] sm:text-lg font-bold text-green-800">
                    {formatDashboardNumber(leaveCreditInsights.totals.remaining)}
                  </p>
                </div>
                <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-3">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase text-yellow-700">Total Used</p>
                  <p className="mt-1 text-[14px] sm:text-lg font-bold text-yellow-700">
                    {formatDashboardNumber(leaveCreditInsights.totals.used)}
                  </p>
                </div>
              </div>

              {/* Table Structure */}
              <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="dashboard-table">
                <thead className="dashboard-thead">
                  <tr className="dashboard-thead ">
                    <th className="dashboard-th cursor-pointer text-left">
                      Leave Type
                    </th>
                    <th className="dashboard-th cursor-pointer">Credit</th>
                    <th className="dashboard-th cursor-pointer">Applied</th>
                    <th className="dashboard-th cursor-pointer">Used</th>
                    <th className="dashboard-th cursor-pointer">Remaining</th>
                    <th className="dashboard-th cursor-pointer">Actual</th>
                  </tr>
                </thead>
                <tbody className="dashboard-tbody">
                  {leaveCreditInsights.rows.length > 0 ? (
                    leaveCreditInsights.rows.map((leave, index) => (
                      <tr key={index} className="dashboard-tbody dashboard-tr">
                        <td className="dashboard-td whitespace-nowrap">
                          {leave.description}
                        </td>
                        <td className="dashboard-td text-center">
                          {formatDashboardNumber(leave.credit)}
                        </td>
                        <td className="dashboard-td text-center">
                          {formatDashboardNumber(leave.applied)}
                        </td>
                        <td className="dashboard-td text-center">
                          {formatDashboardNumber(leave.used)}
                        </td>
                        <td className="dashboard-td text-center">
                          {formatDashboardNumber(leave.remaining)}
                        </td>
                        <td className="dashboard-td text-center">
                          {formatDashboardNumber(leave.actual)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="p-4 text-center text-gray-600 text-sm"
                      >
                        No leave credits found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          <LeaveCreditModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            leaveCredit={leaveCredit}
          />
        </div>

        {/* Personal Calendar */}
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 lg:col-span-2">

          <div className="mb-4">
            <h2 className="dashboard-text-header">Personal Calendar</h2>
            <span className="dashboard-text-span">Holidays, approved leave, and pending leave</span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,330px)_1fr] lg:items-start">
            <div>
          {/* Navigation */}
          <div className="flex justify-between items-center mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-800"
              aria-label="Previous month"
            >
              ◀
            </button>
            <h3 className="text-sm font-bold text-slate-800">
              {currentMonth.format("MMMM YYYY")}
            </h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-800"
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 text-center font-semibold text-gray-600 mb-1 mx-auto text-[0.80rem] sm:text-[0.80rem] md:text-[0.90rem] lg:text-[13px]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day, idx) => (
                <div
                  key={idx}
                  className="h-5 flex items-center justify-center "
                >
                  {day}
                </div>
              ),
            )}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 text-center mt-2 mx-auto text-[0.70rem] sm:text-[0.70rem] md:text-[0.80rem] lg:text-[11px]">
            {generateCalendar().map((day, index) => {
              let baseClasses =
                "aspect-square w-full max-w-9 mx-auto flex items-center justify-center font-semibold";
              let style = "";
              let tooltipText = "";

              if (!day.currentMonth) {
                style = "text-gray-300";
              } else if (day.isToday) {
                style = "bg-gray-300 text-black rounded-full";
              } else if (day.isHoliday) {
                style = "text-red-500 font-bold";
                tooltipText = getHolidayName(day.holiday);
              } else if (day.isApprovedLeave) {
                style = "bg-blue-300 text-black rounded-full";
                tooltipText = `Approved: ${day.leaveType}`;
              } else if (day.isPendingLeave) {
                style =
                  "text-black rounded-full border border-4 border-yellow-300";
                tooltipText = `Pending: ${day.leaveType}`;
              } else {
                style = "text-gray-700";
              }

              return (
                <div
                  key={`${day.dateKey || "outside"}-${index}`}
                  data-tooltip-id="dashboard-calendar-tooltip"
                  data-tooltip-content={tooltipText || undefined}
                  className={`${baseClasses} ${style}`}
                >
                  {day.day}
                </div>
              );
            })}
          </div>
          <Tooltip id="dashboard-calendar-tooltip" place="top" />

          {/* Calendar Legend */}
          <div className="flex flex-wrap justify-center gap-4 text-[11px] md:text-xs mt-4">
            <div className="flex items-center text-red-500 font-bold">
              <span className="w-4 h-4 rounded-xl bg-red-500 inline-block mr-1"></span>
              Holiday
            </div>
            <div className="flex items-center text-blue-400 font-bold">
              <span className="w-4 h-4 rounded-xl bg-blue-400 inline-block mr-1"></span>{" "}
              Approved Leave
            </div>
            <div className="flex items-center text-yellow-400 font-bold">
              <span className="w-4 h-4 rounded-xl bg-yellow-400 inline-block mr-1"></span>{" "}
              Pending Leave
            </div>
          </div>
            </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-[minmax(300px,1.2fr)_minmax(210px,0.9fr)_minmax(210px,0.9fr)]">
            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase text-red-700">
                  Upcoming Holidays
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-red-600">
                  {personalCalendarLists.upcomingHolidays.length}
                </span>
              </div>
              {personalCalendarLists.upcomingHolidays.length > 0 ? (
                <div className="space-y-2.5">
                  {personalCalendarLists.upcomingHolidays.map((holiday, index) => (
                    <div key={`${holiday.date.format("YYYY-MM-DD")}-${holiday.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_55px_70px] items-center gap-2 text-[10px] sm:text-[10px]">
                      <span className="min-w-0 truncate font-medium text-gray-800">
                        {holiday.name}
                      </span>
                      <span className="text-center font-semibold text-red-700">
                        {holiday.date.format("dddd")}
                      </span>
                      <span className="text-right font-semibold text-red-700">
                        {holiday.date.format("MMM DD, YYYY")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No upcoming holidays found.</p>
              )}
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase text-blue-700">
                  Upcoming Leaves
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  {personalCalendarLists.upcomingLeaves.length}
                </span>
              </div>
              {personalCalendarLists.upcomingLeaves.length > 0 ? (
                <div className="space-y-2">
                  {personalCalendarLists.upcomingLeaves.map((leave, index) => (
                    <div key={`${leave.startDate.format("YYYY-MM-DD")}-${leave.type}-${index}`} className="flex items-center justify-between gap-3 text-[10px] sm:text-[10px]">
                      <span className="min-w-0 truncate font-medium text-gray-800">
                        {leave.type}
                      </span>
                      <span className="shrink-0 font-semibold text-blue-700">
                        {formatCalendarDateRange(leave.startDate, leave.endDate)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No upcoming approved leaves.</p>
              )}
            </div>

            <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase text-yellow-700">
                  Pending Leaves
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                  {personalCalendarLists.pendingLeaves.length}
                </span>
              </div>
              {personalCalendarLists.pendingLeaves.length > 0 ? (
                <div className="space-y-2">
                  {personalCalendarLists.pendingLeaves.map((leave, index) => (
                    <div key={`${leave.startDate.format("YYYY-MM-DD")}-${leave.type}-${index}`} className="flex items-center justify-between gap-3 text-[10px] sm:text-[10px]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium text-gray-800">
                          {leave.type}
                        </span>
                        {leave.isLateFiled && (
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                            Late Filed
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-yellow-700">
                        {formatCalendarDateRange(leave.startDate, leave.endDate)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No pending leaves found.</p>
              )}
            </div>
          </div>
          </div>
          </div>
        </div>

        {/* <div className="grid grid-cols-1 gap-4"> */}
        
        {/* Daily Time Record Section */}
        <div className="relative flex flex-grow flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="dashboard-text-header">Daily Time Record</h2>
          <span className="dashboard-text-span">Recent Transactions</span>

          <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {/* DTR Trend Chart */}
            <div className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-4">
              <p className="text-sm font-bold text-blue-900">Weekly Attendance Trend</p>
              <p className="text-xs text-gray-500">Regular hours rendered over the last 7 transactions</p>
            </div>
            
            {dtrTrendData.length > 0 ? (
              <div className="flex h-40 items-end justify-between gap-2 px-2 sm:px-2">
                {dtrTrendData.map((data, index) => (
                  <div key={`${data.fullDate}-${index}`} className="group flex h-full w-full max-w-[42px] flex-col items-center gap-2">
                    <div
                      className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-t-xl bg-blue-100"
                      title={`${data.fullDate}: ${formatDashboardNumber(data.hours)} hours`}
                    >
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          data.isUnderTime ? "bg-yellow-500" : "bg-blue-800"
                        } group-hover:opacity-80`}
                        style={{ height: `${Math.max(data.heightPct, data.hours > 0 ? 4 : 0)}%` }}
                      />
                      <span className="absolute top-1 hidden rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 shadow-sm group-hover:block">
                        {formatDashboardNumber(data.hours, 1)}h
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-600">{data.date}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                No attendance trend available.
              </div>
            )}
            </div>

            <div className="min-w-0 overflow-x-auto">
              <table className="dashboard-table">
              <thead className="dashboard-thead">
                <tr className="dashboard-thead">
                  <th className="dashboard-th text-left">Date</th>
                  <th className="dashboard-th text-center">Time In</th>
                  <th className="dashboard-th text-center">Time Out</th>
                  <th className="dashboard-th text-right">Total Hrs</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {dailyTimeRecord.length > 0 ? (
                  dailyTimeRecord.map((record, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td text-left">
                        {dayjs(record.trandate).format("MM/DD/YYYY")}
                      </td>
                      <td className="dashboard-td text-center">
                        {record.time_in
                          ? dayjs(record.time_in).format("MM/DD/YYYY hh:mm A")
                          : "N/A"}
                      </td>
                      <td className="dashboard-td text-center">
                        {record.time_out
                          ? dayjs(record.time_out).format("MM/DD/YYYY hh:mm A")
                          : "N/A"}
                      </td>
                      <td className="dashboard-td text-right">
                        {(record.reg_hrs || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="dashboard-div-norecords">
                        No DTR records found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </div>

          {dailyTimeRecord.length > 0 && (
            <div className="relative flex justify-end">
              <button
                onClick={() => navigate("/timekeeping")}
                className="dashboard-button-viewall text-blue-800 hover:text-blue-900"
              >
                View All <span className="ml-1">→</span>
              </button>
            </div>
          )}
        </div>

        {/* Loan Balance Inquiry */}
        <div className="relative flex flex-grow flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="dashboard-text-header">My Loan Balance</h2>
          <span className="dashboard-text-span">Recent Transactions</span>

          <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="min-w-0 overflow-x-auto">
              <table className="dashboard-table">
              <thead className="dashboard-thead">
                <tr className="dashboard-thead">
                  <th className="dashboard-th text-left">Loan Type</th>
                  <th className="dashboard-th text-right">Loan Amount</th>
                  <th className="dashboard-th text-right">Balance</th>
                  <th className="dashboard-th text-right">Total Paid</th>
                </tr>
              </thead>
              <tbody className="dashboard-tbody">
                {loanBalanceInsights.rows.length > 0 ? (
                  loanBalanceInsights.rows.slice(0, 5).map((loan, index) => (
                    <tr key={index} className="dashboard-tbody dashboard-tr">
                      <td className="dashboard-td">{loan.loanType}</td>
                      <td className="dashboard-td text-right">
                        {formatDashboardNumber(loan.loanAmount)}
                      </td>
                      <td className="dashboard-td text-right">
                        {formatDashboardNumber(loan.balance)}
                      </td>
                      <td className="dashboard-td text-right">
                        {formatDashboardNumber(loan.totalPaid)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="dashboard-div-norecords">
                        No loan balances found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>

            <div className="min-w-0 rounded-xl border border-gray-200 bg-slate-50 p-3">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-blue-900">Loan Repayment</p>
                <p className="text-xs text-gray-500">Loan amount, paid amount, and remaining balance</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-800" />
                  Loan Amount
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-green-700" />
                  Total Paid
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-600" />
                  Balance
                </span>
              </div>
            </div>

            {loanBalanceInsights.chartRows.length > 0 ? (
              <div className="space-y-3">
                {loanBalanceInsights.chartRows.slice(0, 5).map((loan) => {
                  const loanAmountWidth = `${Math.max(
                    2,
                    (loan.loanAmount / loanBalanceInsights.maxValue) * 100
                  )}%`;
                  const totalPaidWidth = `${Math.max(
                    2,
                    (loan.totalPaid / loanBalanceInsights.maxValue) * 100
                  )}%`;
                  const balanceWidth = `${Math.max(
                    2,
                    (loan.balance / loanBalanceInsights.maxValue) * 100
                  )}%`;

                  return (
                    <div key={loan.loanType} className="grid grid-cols-[96px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr]">
                      <p className="truncate text-[10px] sm:text-[11px] text-wrap font-semibold text-gray-700" title={loan.loanType}>
                        {loan.loanType}
                      </p>
                      <div className="space-y-[-1px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 rounded-full bg-blue-100">
                            <div className="h-2.5 rounded-full bg-blue-800" style={{ width: loanAmountWidth }} />
                          </div>
                          <span className="w-20 text-right text-[10px] font-semibold text-blue-800">
                            {formatDashboardNumber(loan.loanAmount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 rounded-full bg-green-100">
                            <div className="h-2.5 rounded-full bg-green-700" style={{ width: totalPaidWidth }} />
                          </div>
                          <span className="w-20 text-right text-[10px] font-semibold text-green-700">
                            {formatDashboardNumber(loan.totalPaid)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 rounded-full bg-red-100">
                            <div className="h-2.5 rounded-full bg-red-600" style={{ width: balanceWidth }} />
                          </div>
                          <span className="w-20 text-right text-[10px] font-semibold text-red-700">
                            {formatDashboardNumber(loan.balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-32 items-center justify-center text-center text-sm text-gray-500">
                No loan balances to chart.
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Unified My Applications Tabbed Component */}
        <div className="relative flex w-full flex-grow flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          
          {/* Status Ring Block */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-4">
            <p className="text-sm font-bold text-blue-900">Recent Requests Overview</p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="bg-blue-600 transition-all duration-500" style={{ width: `${unifiedRequestStats.approvedPct}%` }} title={`Approved: ${unifiedRequestStats.approved}`} />
              <div className="bg-yellow-400 transition-all duration-500" style={{ width: `${unifiedRequestStats.pendingPct}%` }} title={`Pending: ${unifiedRequestStats.pending}`} />
              <div className="bg-red-500 transition-all duration-500" style={{ width: `${unifiedRequestStats.rejectedPct}%` }} title={`Rejected: ${unifiedRequestStats.rejected}`} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-blue-950">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" /> Approved ({unifiedRequestStats.approved})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-400" /> Pending ({unifiedRequestStats.pending})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Rejected ({unifiedRequestStats.rejected})</span>
              <span className="ml-auto text-slate-500">Total: {unifiedRequestStats.total}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
            {/* Tab Navigation */}
            <div className="flex space-x-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab("leave")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                  activeTab === "leave"
                    ? "bg-blue-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                }`}
              >
                Leave Applications
              </button>
              <button
                onClick={() => setActiveTab("ot")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                  activeTab === "ot"
                    ? "bg-blue-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                }`}
              >
                Overtime Applications
              </button>
              <button
                onClick={() => setActiveTab("ob")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                  activeTab === "ob"
                    ? "bg-blue-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                }`}
              >
                Official Business Applications
              </button>
            </div>

            {/* Dynamic Action Button */}
            <button
              onClick={() => {
                if (activeTab === "leave") navigate("/leave");
                if (activeTab === "ot") navigate("/overtime");
                if (activeTab === "ob") navigate("/official-business");
              }}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 whitespace-nowrap"
            >
              File {activeTab === "leave" ? "Leave" : activeTab === "ot" ? "Overtime" : "Official Business"}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto flex-grow">
            {/* LEAVE TABLE */}
            {activeTab === "leave" && (
              <table className="dashboard-table">
                <thead className="dashboard-thead">
                  <tr>
                    <th className="dashboard-th text-left">Leave Date</th>
                    <th className="dashboard-th text-left">Leave Type</th>
                    <th className="dashboard-th text-right">Duration</th>
                    <th className="dashboard-th text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="dashboard-tbody">
                  {leaveApplication.length > 0 ? (
                    leaveApplication.slice(0, 5).map((leave, index) => (
                      <tr key={`leave-${index}`} className="dashboard-tbody dashboard-tr">
                        <td className="dashboard-td">{leave.dateapplied}</td>
                        <td className="dashboard-td">{leave.leavetype}</td>
                        <td className="dashboard-td text-right">{leave.duration}</td>
                        <td className="dashboard-td text-center">
                          <span className={`dashboard-td inline-block px-3 py-1 w-[100px] rounded-full ${
                            leave.leavestatus === "Pending" ? "bg-yellow-100 text-yellow-700" : 
                            leave.leavestatus === "Approved" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                          }`}>
                            {leave.leavestatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4"><div className="dashboard-div-norecords">No leave applications found.</div></td></tr>
                  )}
                </tbody>
              </table>
            )}

            {/* OT TABLE */}
            {activeTab === "ot" && (
              <table className="dashboard-table">
                <thead className="dashboard-thead">
                  <tr>
                    <th className="dashboard-th text-left">OT Date</th>
                    <th className="dashboard-th text-left">OT Type</th>
                    <th className="dashboard-th text-right">Duration</th>
                    <th className="dashboard-th text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="dashboard-tbody">
                  {otApplication.length > 0 ? (
                    otApplication.slice(0, 5).map((ot, index) => (
                      <tr key={`ot-${index}`} className="dashboard-tbody dashboard-tr">
                        <td className="dashboard-td">{dayjs(ot.dateapplied).format("MM/DD/YYYY")}</td>
                        <td className="dashboard-td">{ot.ottype}</td>
                        <td className="dashboard-td text-right">{ot.duration}</td>
                        <td className="dashboard-td text-center">
                          <span className={`inline-block w-[90px] px-2 py-1 rounded-full ${
                            ot.otstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                            ot.otstatus === "Approved" ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"
                          }`}>
                            {ot.otstatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4"><div className="dashboard-div-norecords">No overtime applications found.</div></td></tr>
                  )}
                </tbody>
              </table>
            )}

            {/* OB TABLE */}
            {activeTab === "ob" && (
              <table className="dashboard-table">
                <thead className="dashboard-thead">
                  <tr>
                    <th className="dashboard-th text-left">OB Date</th>
                    <th className="dashboard-th text-center">Start Datetime</th>
                    <th className="dashboard-th text-center">End Datetime</th>
                    <th className="dashboard-th text-right">Duration</th>
                    <th className="dashboard-th text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="dashboard-tbody">
                  {obApplication.length > 0 ? (
                    obApplication.slice(0, 5).map((ob, index) => (
                      <tr key={`ob-${index}`} className="dashboard-tbody dashboard-tr">
                        <td className="dashboard-td text-nowrap">{dayjs(ob.dateapplied).format("MM/DD/YYYY")}</td>
                        <td className="dashboard-td text-nowrap text-center">{dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")}</td>
                        <td className="dashboard-td text-nowrap text-center">{dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")}</td>
                        <td className="dashboard-td text-nowrap text-right">{ob.duration} hr(s)</td>
                        <td className="dashboard-td text-center">
                          <span className={`dashboard-td inline-block px-3 py-1 w-[100px] rounded-full ${
                            ob.obstatus === "Pending" ? "bg-yellow-100 text-yellow-700" : 
                            ob.obstatus === "Approved" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                          }`}>
                            {ob.obstatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5"><div className="dashboard-div-norecords">No official business applications found.</div></td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="relative flex justify-end mt-2">
            <button
              onClick={() => {
                if (activeTab === "leave") navigate("/leave");
                if (activeTab === "ot") navigate("/overtime");
                if (activeTab === "ob") navigate("/official-business");
              }}
              className="dashboard-button-viewall text-blue-800 hover:text-blue-900 font-semibold text-sm"
            >
              View All <span className="ml-1">→</span>
            </button>
          </div>
        </div>

        {/* Unified Approvals Tabbed Component */}
        {user?.approver === "1" && (
          <div className="relative flex w-full flex-grow flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
            
            <div className="mb-4">
              <h2 className="dashboard-text-header">For My Approval</h2>
              <span className="dashboard-text-span">Pending employee requests</span>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
              {/* Tab Navigation */}
              <div className="flex space-x-2 overflow-x-auto">
                <button
                  onClick={() => setActiveApproverTab("leave")}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                    activeApproverTab === "leave"
                      ? "bg-blue-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                  }`}
                >
                  Leave for Approval
                </button>
                <button
                  onClick={() => setActiveApproverTab("ot")}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                    activeApproverTab === "ot"
                      ? "bg-blue-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                  }`}
                >
                  Overtime for Approval
                </button>
                <button
                  onClick={() => setActiveApproverTab("ob")}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                    activeApproverTab === "ob"
                      ? "bg-blue-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                  }`}
                >
                  Official Business for Approval
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto flex-grow">
              
              {/* LEAVE APPROVAL TABLE */}
              {activeApproverTab === "leave" && (
                <table className="dashboard-table">
                  <thead className="dashboard-thead">
                    <tr>
                      <th className="dashboard-th text-left text-nowrap">Leave Date</th>
                      <th className="dashboard-th text-left text-nowrap">Leave Type</th>
                      <th className="dashboard-th text-left text-nowrap">Duration</th>
                      <th className="dashboard-th text-left text-nowrap">Employee</th>
                      <th className="dashboard-th text-center text-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="dashboard-tbody">
                    {leaveApproval.length > 0 ? (
                      leaveApproval.slice(0, 5).map((leave, index) => (
                        <tr key={`ap-leave-${index}`} className="dashboard-tbody dashboard-tr">
                          <td className="dashboard-td">{leave.dateapplied}</td>
                          <td className="dashboard-td">{leave.leavetype}</td>
                          <td className="dashboard-td">{leave.duration}</td>
                          <td className="dashboard-td text-wrap">{leave.empname}</td>
                          <td className="dashboard-td text-center">
                            <span className={`inline-block w-[90px] px-2 py-1 rounded-full ${
                              leave.leavestatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                              leave.leavestatus === "Approved" ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"
                            }`}>
                              {leave.leavestatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5"><div className="dashboard-div-norecords">No leave records for approval found.</div></td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* OT APPROVAL TABLE */}
              {activeApproverTab === "ot" && (
                <table className="dashboard-table">
                  <thead className="dashboard-thead">
                    <tr>
                      <th className="dashboard-th text-left">OT Date</th>
                      <th className="dashboard-th text-left">OT Type</th>
                      <th className="dashboard-th text-right">Duration</th>
                      <th className="dashboard-th text-left">Employee</th>
                      <th className="dashboard-th text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="dashboard-tbody">
                    {otApproval.length > 0 ? (
                      otApproval.slice(0, 5).map((ot, index) => (
                        <tr key={`ap-ot-${index}`} className="dashboard-tbody dashboard-tr">
                          <td className="dashboard-td text-left">{dayjs(ot.dateapplied).format("MM/DD/YYYY")}</td>
                          <td className="dashboard-td text-left text-nowrap">{ot.ottype}</td>
                          <td className="dashboard-td text-right">{ot.duration}</td>
                          <td className="dashboard-td text-left text-wrap">{ot.empname}</td>
                          <td className="dashboard-td text-center">
                            <span className={`inline-block w-[90px] px-2 py-1 rounded-full ${
                              ot.otstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                              ot.otstatus === "Approved" ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"
                            }`}>
                              {ot.otstatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5"><div className="dashboard-div-norecords">No overtime records for approval found.</div></td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* OB APPROVAL TABLE */}
              {activeApproverTab === "ob" && (
                <table className="dashboard-table">
                  <thead className="dashboard-thead">
                    <tr>
                      <th className="dashboard-th">OB Date</th>
                      <th className="dashboard-th">Start Datetime</th>
                      <th className="dashboard-th">End Datetime</th>
                      <th className="dashboard-th">Duration</th>
                      <th className="dashboard-th text-left">Employee</th>
                      <th className="dashboard-th text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="dashboard-tbody">
                    {obApproval.length > 0 ? (
                      obApproval.slice(0, 5).map((ob, index) => (
                        <tr key={`ap-ob-${index}`} className="dashboard-tbody dashboard-tr">
                          <td className="dashboard-td text-nowrap">{dayjs(ob.dateapplied).format("MM/DD/YYYY")}</td>
                          <td className="dashboard-td text-nowrap">{dayjs(ob.obstart).format("MM/DD/YYYY hh:mm a")}</td>
                          <td className="dashboard-td text-nowrap">{dayjs(ob.obend).format("MM/DD/YYYY hh:mm a")}</td>
                          <td className="dashboard-td text-right">{ob.duration} hr(s)</td>
                          <td className="dashboard-td text-wrap">{ob.empname}</td>
                          <td className="dashboard-td text-center">
                            <span className={`inline-block w-[90px] px-2 py-1 rounded-full ${
                              ob.obstatus === "Pending" ? "bg-yellow-100 text-yellow-600" : 
                              ob.obstatus === "Approved" ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"
                            }`}>
                              {ob.obstatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="6"><div className="dashboard-div-norecords">No official business records for approval found.</div></td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="relative flex justify-end mt-2">
              <button
                onClick={() => {
                  if (activeApproverTab === "leave") navigate("/leaveApproval");
                  if (activeApproverTab === "ot") navigate("/overtimeApproval");
                  if (activeApproverTab === "ob") navigate("/OfficialBusinessApproval");
                }}
                className="dashboard-button-viewall text-blue-800 hover:text-blue-900 font-semibold text-sm"
              >
                View All <span className="ml-1">→</span>
              </button>
            </div>
          </div>
        )}

        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 bg-blue-800 text-white p-3 rounded-full shadow-lg hover:bg-blue-900 transition duration-300"
            aria-label="Back to top"
          >
            <FontAwesomeIcon icon={faArrowUp} size="sm" />
          </button>
        )}
        </div>
      </div>
    // </div>
  );
};

export default Dashboard;
