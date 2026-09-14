import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Tooltip } from "react-tooltip";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useAuth } from "./AuthContext"; 
import { getAccessRights } from "./accessRights";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faBell, faBullhorn, faCalendarDays, faClock, faEye, faPaperPlane, faPen, faPlus, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import LeaveCreditModal from "./LeaveCreditModal";
import API_ENDPOINTS from "@/apiConfig.jsx";
import "@/index.css";

dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TIMEZONE = "Asia/Manila";
const SERVER_TIME_SYNC_INTERVAL_MS = 300000;
const DEFAULT_DAILY_WORK_HOURS = 8;
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
  ShiftChangeApplicationCount: 0,
  ShiftChangeApprovalCount: 0,
  OffsetApplicationCount: 0,
  OffsetApprovalCount: 0,
});

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
const isEnabledFlag = (value) => ["1", "y", "yes", "true"].includes(normalizeStatus(value));
const normalizeAnnouncement = (announcement, index) => ({
  id: announcement?.id ?? announcement?.announcementId ?? announcement?.announcement_id ?? index,
  title: String(announcement?.title ?? announcement?.subject ?? announcement?.announcement_title ?? "Announcement").trim(),
  message: String(announcement?.message ?? announcement?.body ?? announcement?.description ?? "").trim(),
  postedBy: String(announcement?.postedBy ?? announcement?.posted_by ?? announcement?.createdBy ?? announcement?.created_by ?? "HR").trim(),
  postedAt: announcement?.postedAt ?? announcement?.posted_at ?? announcement?.createdAt ?? announcement?.created_at ?? "",
  expiresAt:
    announcement?.expiresAt ??
    announcement?.expires_at ??
    announcement?.expirationDate ??
    announcement?.expiration_date ??
    "",
  updatedBy:
    announcement?.updatedBy ??
    announcement?.updated_by ??
    "",
  updatedAt:
    announcement?.updatedAt ??
    announcement?.updated_at ??
    "",
});
const getObjectField = (source, fieldName) => {
  const matchedKey = Object.keys(source || {}).find(
    (key) => key.toLowerCase() === String(fieldName).toLowerCase()
  );
  return matchedKey ? source[matchedKey] : undefined;
};

const getDashboardCount = (sources, aliases) => {
  for (const source of sources) {
    const summary = Array.isArray(source) ? source[0] : source;
    if (!summary || typeof summary !== "object") continue;

    const values = Object.entries(summary).reduce((result, [key, value]) => {
      result[String(key).replace(/[^a-z0-9]/gi, "").toLowerCase()] = value;
      return result;
    }, {});

    for (const alias of aliases) {
      const value = values[String(alias).replace(/[^a-z0-9]/gi, "").toLowerCase()];
      if (value !== undefined && value !== null && value !== "") return toDashboardNumber(value);
    }
  }

  return 0;
};

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
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementExpirationDate, setAnnouncementExpirationDate] = useState("");
  const [isAnnouncementLoading, setIsAnnouncementLoading] = useState(false);
  const [isAnnouncementPosting, setIsAnnouncementPosting] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState(null);
  const [announcementError, setAnnouncementError] = useState("");
  const [announcementPostError, setAnnouncementPostError] = useState("");

  const { user, setUser, authLoading } = useAuth();
  const navigate = useNavigate();
  const isHrUser = isEnabledFlag(user?.hrFlag ?? user?.hrflag);

  const fetchAnnouncements = useCallback(async () => {
    setIsAnnouncementLoading(true);
    setAnnouncementError("");

    try {
      const response = await fetch(API_ENDPOINTS.announcements, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Announcements request failed (${response.status}).`);

      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload?.data ?? payload?.announcements ?? [];
      setAnnouncements(rows.map(normalizeAnnouncement).filter((item) => item.message));
    } catch (requestError) {
      console.error("Error fetching announcements:", requestError);
      setAnnouncementError("Announcements are temporarily unavailable.");
    } finally {
      setIsAnnouncementLoading(false);
    }
  }, []);

  const closeAnnouncementModal = useCallback(() => {
    if (isAnnouncementPosting) return;

    setIsAnnouncementModalOpen(false);
    setEditingAnnouncement(null);
    setAnnouncementTitle("");
    setAnnouncementMessage("");
    setAnnouncementExpirationDate("");
    setAnnouncementPostError("");
  }, [isAnnouncementPosting]);

  const openAnnouncementModal = () => {
    setEditingAnnouncement(null);
    setAnnouncementTitle("");
    setAnnouncementMessage("");
    setAnnouncementExpirationDate("");
    setAnnouncementPostError("");
    setIsAnnouncementModalOpen(true);
  };

  const openAnnouncementEditModal = (announcement) => {
    if (!isHrUser) return;

    setEditingAnnouncement(announcement);
    setAnnouncementTitle(announcement?.title || "");
    setAnnouncementMessage(announcement?.message || "");
    setAnnouncementExpirationDate(
      announcement?.expiresAt
        ? dayjs(announcement.expiresAt).format("YYYY-MM-DD")
        : ""
    );
    setAnnouncementPostError("");
    setIsAnnouncementModalOpen(true);
  };

  const openAnnouncementViewModal = (announcement) => {
    setSelectedAnnouncement(announcement);
  };

  const closeAnnouncementViewModal = useCallback(() => {
    setSelectedAnnouncement(null);
  }, []);

  const handleSaveAnnouncement = async (event) => {
    event.preventDefault();

    if (
      !isHrUser ||
      !announcementTitle.trim() ||
      !announcementMessage.trim() ||
      !announcementExpirationDate
    ) {
      return;
    }

    setIsAnnouncementPosting(true);
    setAnnouncementPostError("");

    const isEditing = Boolean(editingAnnouncement?.id);
    const endpoint = isEditing
      ? `${API_ENDPOINTS.announcements}/${editingAnnouncement.id}`
      : API_ENDPOINTS.createAnnouncement;

    try {
      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? {
                title: announcementTitle.trim(),
                message: announcementMessage.trim(),
                expirationDate: announcementExpirationDate,
                updatedBy: user?.empNo,
              }
            : {
                title: announcementTitle.trim(),
                message: announcementMessage.trim(),
                expirationDate: announcementExpirationDate,
                createdBy: user?.empNo,
              }
        ),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            `Announcement ${isEditing ? "update" : "post"} failed (${response.status}).`
        );
      }

      setIsAnnouncementModalOpen(false);
      setEditingAnnouncement(null);
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementExpirationDate("");
      await fetchAnnouncements();
    } catch (requestError) {
      console.error(
        `Error ${isEditing ? "updating" : "posting"} announcement:`,
        requestError
      );
      setAnnouncementPostError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to ${isEditing ? "update" : "post"} announcement. Please try again.`
      );
    } finally {
      setIsAnnouncementPosting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcement) => {
    if (!isHrUser || !announcement?.id || deletingAnnouncementId) return;

    const confirmed = window.confirm(
      `Delete "${announcement.title}"?\n\nThis announcement will no longer be visible to employees.`
    );

    if (!confirmed) return;

    setDeletingAnnouncementId(announcement.id);
    setAnnouncementError("");

    try {
      const response = await fetch(
        `${API_ENDPOINTS.announcements}/${announcement.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            deletedBy: user?.empNo,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            `Announcement delete failed (${response.status}).`
        );
      }

      if (selectedAnnouncement?.id === announcement.id) {
        setSelectedAnnouncement(null);
      }

      await fetchAnnouncements();
    } catch (requestError) {
      console.error("Error deleting announcement:", requestError);
      setAnnouncementError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete announcement. Please try again."
      );
    } finally {
      setDeletingAnnouncementId(null);
    }
  };

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
      const employeePortalDTR = getObjectField(employee, "portalDTR");
      const employeePortalTK = getObjectField(employee, "portalTK");
      const employeePortalLV = getObjectField(employee, "portalLV");
      const employeePortalOB = getObjectField(employee, "portalOB");
      const employeePortalOT = getObjectField(employee, "portalOT");
      const employeePortalOffset = getObjectField(employee, "portalOffSet");
      const employeeMgrFlag = getObjectField(employee, "mgrFlag");
      const employeeSupFlag = getObjectField(employee, "supFlag");
      const employeePortalDtrConfirm = getObjectField(employee, "portalDTRConfirm");

      setUser((previousUser) => {
        if (
          previousUser?.approver === employee.approver &&
          previousUser?.hrFlag === (employee.hrFlag ?? employee.hrflag) &&
          previousUser?.mgrFlag === employeeMgrFlag &&
          previousUser?.supFlag === employeeSupFlag &&
          previousUser?.portalDtrConfirm === employeePortalDtrConfirm &&
          previousUser?.portalDTR === employeePortalDTR &&
          previousUser?.portalTK === employeePortalTK &&
          previousUser?.portalLV === employeePortalLV &&
          previousUser?.portalOB === employeePortalOB &&
          previousUser?.portalOT === employeePortalOT &&
          previousUser?.portalOffSet === employeePortalOffset
        ) return previousUser;

        return {
          ...(previousUser || {}),
          approver: employee.approver,
          hrFlag: employee.hrFlag ?? employee.hrflag ?? previousUser?.hrFlag,
          mgrFlag: employeeMgrFlag ?? previousUser?.mgrFlag,
          supFlag: employeeSupFlag ?? previousUser?.supFlag,
          portalDtrConfirm: employeePortalDtrConfirm ?? previousUser?.portalDtrConfirm,
          portalDTR: employeePortalDTR ?? previousUser?.portalDTR,
          portalTK: employeePortalTK ?? previousUser?.portalTK,
          portalLV: employeePortalLV ?? previousUser?.portalLV,
          portalOB: employeePortalOB ?? previousUser?.portalOB,
          portalOT: employeePortalOT ?? previousUser?.portalOT,
          portalOffSet: employeePortalOffset ?? previousUser?.portalOffSet,
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

      setAttendanceSummary(
        employee.attendanceSummary ||
        employee.attendance_summary ||
        employee.dtrSummary ||
        employee.dtr_summary ||
        employee.employeeAttendanceSummary ||
        employee.approvalsum ||
        {}
      );

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
        ShiftChangeApplicationCount: Number(summary.ShiftChangeApplicationCount ?? summary.ChangeScheduleApplicationCount ?? 0),
        ShiftChangeApprovalCount: Number(summary.ShiftChangeApprovalCount ?? summary.ChangeScheduleApprovalCount ?? 0),
        OffsetApplicationCount: Number(summary.OffsetApplicationCount ?? 0),
        OffsetApprovalCount: Number(summary.OffsetApprovalCount ?? 0),
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
      fetchAnnouncements();
    }
  }, [authLoading, fetchDashboardData, fetchAnnouncements]);

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

  useEffect(() => {
    if (!isAnnouncementModalOpen && !selectedAnnouncement) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;

      if (selectedAnnouncement) {
        closeAnnouncementViewModal();
        return;
      }

      if (!isAnnouncementPosting) {
        closeAnnouncementModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeAnnouncementModal,
    closeAnnouncementViewModal,
    isAnnouncementModalOpen,
    isAnnouncementPosting,
    selectedAnnouncement,
  ]);

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
      .map((record) => {
        const hours = toDashboardNumber(record?.reg_hrs);
        const rawTargetHours = toDashboardNumber(
          record?.work_hrs ??
          record?.workHrs ??
          record?.WORK_HRS ??
          record?.shift_work_hrs ??
          record?.shiftWorkHrs
        );
        const targetHours = rawTargetHours > 0 ? rawTargetHours : DEFAULT_DAILY_WORK_HOURS;
        const recordDate = parseDashboardDate(record?.trandate);

        return {
          sortDate: recordDate?.isValid() ? recordDate.valueOf() : Number.MAX_SAFE_INTEGER,
          date: recordDate?.isValid() ? recordDate.format("ddd") : "—",
          fullDate: recordDate?.isValid() ? recordDate.format("MMM DD") : "Unknown date",
          hours,
          targetHours,
          isUnderTime: hours > 0 && hours < targetHours,
          heightPct: Math.min(Math.max((hours / 12) * 100, 0), 100),
        };
      })
      .sort((a, b) => a.sortDate - b.sortDate)
      .slice(-7);
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

  const { canApprove, isHr, isManager, isSupervisor } = getAccessRights(user);
  const isManagementUser = isHr || isManager || isSupervisor || canApprove;
  const portalAccess = {
    dtr: isEnabledFlag(getObjectField(user, "portalDTR")),
    timekeeping: isEnabledFlag(getObjectField(user, "portalTK")),
    leave: isEnabledFlag(getObjectField(user, "portalLV")),
    officialBusiness: isEnabledFlag(getObjectField(user, "portalOB")),
    overtime: isEnabledFlag(getObjectField(user, "portalOT")),
    offset: isEnabledFlag(getObjectField(user, "portalOffSet")),
  };

  const employeeAttendanceCards = useMemo(() => {
    const sources = [attendanceSummary, approvalsum];
    const total = getDashboardCount(sources, ["totalEmployees", "totalNoOfEmployees", "employeeCount", "totalEmployeeCount", "totalEmp"]);

    return {
      total,
      items: [
        { label: "Present", count: getDashboardCount(sources, ["present", "presentCount", "totalPresent", "dtrPresent"]), tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
        { label: "No DTR", count: getDashboardCount(sources, ["noDTR", "noDtrCount", "noDTRCount", "withoutDTR", "nodtr"]), tone: "bg-amber-50 text-amber-700 border-amber-100" },
        { label: "Absent", count: getDashboardCount(sources, ["absent", "absentCount", "totalAbsent"]), tone: "bg-rose-50 text-rose-700 border-rose-100" },
        { label: "On Leave", count: getDashboardCount(sources, ["onLeave", "onLeaveCount", "leaveCount", "leave"]), tone: "bg-violet-50 text-violet-700 border-violet-100" },
        { label: "Rest Day", count: getDashboardCount(sources, ["restDay", "restDayCount", "totalRestDay", "rd"]), tone: "bg-sky-50 text-sky-700 border-sky-100" },
      ],
    };
  }, [attendanceSummary, approvalsum]);

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
    {
      code: "SCH",
      label: "Change of Schedule Applications",
      count: approvalsum?.ShiftChangeApplicationCount ?? 0,
      route: "/employee-shift",
    },
    {
      code: "OFF",
      label: "Offset Applications",
      count: approvalsum?.OffsetApplicationCount ?? 0,
      route: "/offsetApplication",
    },
  ].filter((card) => {
    if (card.code === "LV") return portalAccess.leave;
    if (card.code === "OT") return portalAccess.overtime;
    if (card.code === "OB") return portalAccess.officialBusiness;
    if (card.code === "DTR") return portalAccess.dtr;
    if (card.code === "OFF") return portalAccess.offset;
    return true;
  });

  const summaryGridClass = (cardCount) => {
    if (cardCount === 1) return "grid-cols-1";
    if (cardCount === 2) return "grid-cols-1 sm:grid-cols-2";
    if (cardCount === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    if (cardCount === 4) return "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4";
    if (cardCount === 5) return "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";
  };

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
      label: "DTR Adjustments for Approval",
      count: approvalsum?.DTRApprovalCount ?? 0,
      route: "/timekeepingAdjApproval",
    },
    {
      code: "SCH",
      label: "Change of Schedule for Approval",
      count: approvalsum?.ShiftChangeApprovalCount ?? 0,
      route: "/employee-shift-approval",
    },
    {
      code: "OFF",
      label: "Offset for Approval",
      count: approvalsum?.OffsetApprovalCount ?? 0,
      route: "/offsetApproval",
    },
  ].filter((card) => {
    if (card.code === "LV") return portalAccess.leave;
    if (card.code === "OT") return portalAccess.overtime;
    if (card.code === "OB") return portalAccess.officialBusiness;
    if (card.code === "DTR") return portalAccess.dtr;
    if (card.code === "OFF") return portalAccess.offset;
    return true;
  });

  const personalDashboardInsights = useMemo(() => {
    const recentRecords = dailyTimeRecord
      .map((record) => {
        const recordDate = parseDashboardDate(record?.trandate);
        const rawTargetHours = toDashboardNumber(
          record?.work_hrs ??
          record?.workHrs ??
          record?.WORK_HRS ??
          record?.shift_work_hrs ??
          record?.shiftWorkHrs
        );

        return {
          ...record,
          recordDate,
          hours: toDashboardNumber(record?.reg_hrs),
          targetHours: rawTargetHours > 0 ? rawTargetHours : DEFAULT_DAILY_WORK_HOURS,
        };
      })
      .filter((record) => record.recordDate?.isValid())
      .sort((left, right) => right.recordDate.valueOf() - left.recordDate.valueOf())
      .slice(0, 7);

    const renderedRecords = recentRecords.filter((record) => record.hours > 0);
    const totalHours = renderedRecords.reduce((sum, record) => sum + record.hours, 0);
    const averageHours =
      renderedRecords.length > 0 ? totalHours / renderedRecords.length : 0;
    const targetDays = renderedRecords.filter(
      (record) => record.hours >= record.targetHours
    ).length;
    const undertimeDays = renderedRecords.filter(
      (record) => record.hours > 0 && record.hours < record.targetHours
    ).length;
    const averageTargetHours = renderedRecords.length > 0
      ? renderedRecords.reduce((sum, record) => sum + record.targetHours, 0) /
        renderedRecords.length
      : DEFAULT_DAILY_WORK_HOURS;
    const incompleteDtrDays = recentRecords.filter(
      (record) => !record?.time_in || !record?.time_out
    ).length;

    const pendingRequests = requestSummaryCards.reduce(
      (sum, card) => sum + toDashboardNumber(card.count),
      0
    );
    const pendingApprovals = approvalSummaryCards.reduce(
      (sum, card) => sum + toDashboardNumber(card.count),
      0
    );
    const totalLoanBalance = loanBalanceInsights.rows.reduce(
      (sum, loan) => sum + loan.balance,
      0
    );

    return {
      averageHours,
      averageTargetHours,
      targetDays,
      undertimeDays,
      incompleteDtrDays,
      pendingRequests,
      pendingApprovals,
      totalLoanBalance,
      recentRecordCount: recentRecords.length,
      latestDtrDate: recentRecords[0]?.recordDate || null,
    };
  }, [
    approvalSummaryCards,
    dailyTimeRecord,
    loanBalanceInsights.rows,
    requestSummaryCards,
  ]);

  const attendanceDistribution = useMemo(() => {
    const statusTotal = employeeAttendanceCards.items.reduce(
      (sum, item) => sum + toDashboardNumber(item.count),
      0
    );
    const denominator = employeeAttendanceCards.total > 0
      ? employeeAttendanceCards.total
      : statusTotal;
    const presentCount =
      employeeAttendanceCards.items.find((item) => item.label === "Present")?.count || 0;
    const presentRate = denominator > 0 ? (presentCount / denominator) * 100 : 0;

    return {
      denominator,
      presentRate,
      items: employeeAttendanceCards.items.map((item) => ({
        ...item,
        percentage:
          denominator > 0 ? (toDashboardNumber(item.count) / denominator) * 100 : 0,
      })),
    };
  }, [employeeAttendanceCards]);

  const quickActions = [
    {
      code: "TK",
      label: "Timekeeping",
      description: "View attendance",
      route: "/timekeeping",
      enabled: portalAccess.timekeeping,
    },
    {
      code: "LV",
      label: "File Leave",
      description: "Request Leave Application",
      route: "/leave",
      enabled: portalAccess.leave,
    },
    {
      code: "OT",
      label: "File Overtime",
      description: "Request OT Application",
      route: "/overtime",
      enabled: portalAccess.overtime,
    },
    {
      code: "OB",
      label: "Official Business",
      description: "Request OB Application",
      route: "/official-business",
      enabled: portalAccess.officialBusiness,
    },
    {
      code: "DTR",
      label: "DTR Adjustment",
      description: "Request DTR correction",
      route: "/timekeepingAdj",
      enabled: portalAccess.dtr,
    },
    {
      code: "SCH",
      label: "Change Schedule",
      description: "Request change shift",
      route: "/employee-shift",
      enabled: true,
    },
    {
      code: "OFF",
      label: "Offset",
      description: "Request an offset application",
      route: "/offsetApplication",
      enabled: portalAccess.offset,
    },
  ].filter((action) => action.enabled);

  const dashboardGreeting = (() => {
    const hour = currentDate?.hour();
    if (!Number.isFinite(hour)) return "Welcome back ! ";
    if (hour < 12) return "Good morning! ";
    if (hour < 18) return "Good afternoon!";
    return "Good evening! ";
  })();

  const dashboardAttention = useMemo(() => {
    const items = [];

    if (personalDashboardInsights.incompleteDtrDays > 0) {
      items.push({
        label: `${personalDashboardInsights.incompleteDtrDays} incomplete DTR ${
          personalDashboardInsights.incompleteDtrDays === 1 ? "record" : "records"
        } in your latest transactions`,
        tone: "border-amber-200 bg-amber-50 text-amber-800",
        route: portalAccess.dtr ? "/timekeepingAdj" : "/timekeeping",
      });
    }

    if (personalDashboardInsights.pendingRequests > 0) {
      items.push({
        label: `${personalDashboardInsights.pendingRequests} pending ${
          personalDashboardInsights.pendingRequests === 1 ? "request" : "requests"
        } to monitor`,
        tone: "border-blue-200 bg-blue-50 text-blue-800",
        route: null,
      });
    }

    if (leaveCreditInsights.lowBalanceCount > 0) {
      items.push({
        label: `${leaveCreditInsights.lowBalanceCount} leave ${
          leaveCreditInsights.lowBalanceCount === 1 ? "type has" : "types have"
        } 1 day or less available`,
        tone: "border-rose-200 bg-rose-50 text-rose-800",
        route: portalAccess.leave ? "/leave" : null,
      });
    }

    return items.slice(0, 3);
  }, [
    leaveCreditInsights.lowBalanceCount,
    personalDashboardInsights.incompleteDtrDays,
    personalDashboardInsights.pendingRequests,
    portalAccess.dtr,
    portalAccess.leave,
  ]);

  useEffect(() => {
    const availableTabs = [
      portalAccess.leave && "leave",
      portalAccess.overtime && "ot",
      portalAccess.officialBusiness && "ob",
    ].filter(Boolean);
    if (availableTabs.length && !availableTabs.includes(activeTab)) setActiveTab(availableTabs[0]);
  }, [activeTab, portalAccess.leave, portalAccess.overtime, portalAccess.officialBusiness]);

  useEffect(() => {
    const availableTabs = [
      portalAccess.leave && "leave",
      portalAccess.overtime && "ot",
      portalAccess.officialBusiness && "ob",
    ].filter(Boolean);
    if (availableTabs.length && !availableTabs.includes(activeApproverTab)) setActiveApproverTab(availableTabs[0]);
  }, [activeApproverTab, portalAccess.leave, portalAccess.overtime, portalAccess.officialBusiness]);

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
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-blue-900 to-blue-600 p-5 text-white shadow-xl sm:p-3">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-blue-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-50 backdrop-blur">
                Employee Portal
              </div>
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                {dashboardGreeting}, {employeeDisplayName}
              </h1>
              <p className="mt-1 text-sm font-medium text-blue-100">
                {currentDate ? currentDate.format("dddd, MMMM DD, YYYY") : "Verifying Philippine date…"}
              </p>
              {/* <p className="mt-2 max-w-2xl text-sm text-blue-100/90">
                Your attendance, requests, leave credits, approvals, and important actions in one place.
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

              {portalAccess.timekeeping && (
                <button
                  type="button"
                  onClick={() => navigate("/timekeeping")}
                  className="inline-flex min-h-[72px] items-center justify-center rounded-2xl bg-white px-5 py-3 text-lg font-bold text-blue-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30"
                >
                  <FontAwesomeIcon icon={faClock} className="mr-2" />
                  Open Timekeeping
                </button>
              )}
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

        <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-100/50 blur-3xl" />

          <div className="relative flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-800 to-blue-600 text-white shadow-sm">
                <FontAwesomeIcon icon={faBullhorn} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">
                    Announcement Board
                  </h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">
                    {announcements.length} {announcements.length === 1 ? "post" : "posts"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Company notices and important updates from Human Resources.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAnnouncementLoading && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  Updating
                </span>
              )}

              {isHrUser && (
                <button
                  type="button"
                  onClick={openAnnouncementModal}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  New Announcement
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {announcementError ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                <span>{announcementError}</span>
                <button
                  type="button"
                  onClick={fetchAnnouncements}
                  className="shrink-0 rounded-xl bg-white px-3 py-1.5 font-bold text-amber-800 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100"
                >
                  Retry
                </button>
              </div>
            ) : isAnnouncementLoading && announcements.length === 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="h-3 w-24 rounded bg-slate-200" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-full rounded bg-slate-200" />
                    <div className="mt-1 h-3 w-5/6 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : announcements.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {announcements.map((announcement, index) => (
                  <article
                    key={announcement.id}
                    className={`group relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      index === 0
                        ? "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white"
                        : "border-slate-200 bg-white hover:border-blue-200"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] ${
                          index === 0
                            ? "bg-blue-800 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <FontAwesomeIcon icon={faBell} className="text-[8px]" />
                        {index === 0 ? "Latest" : "Announcement"}
                      </span>
                      {announcement.postedAt && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {dayjs(announcement.postedAt).format("MMM DD, YYYY")}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold leading-5 text-blue-950">
                      {announcement.title}
                    </h3>

                    <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                      {announcement.message}
                    </p>

                    {announcement.expiresAt && (
                      <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-xl bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">
                        <FontAwesomeIcon icon={faCalendarDays} />
                        Expires {dayjs(announcement.expiresAt).format("MMM DD, YYYY")}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="min-w-0 truncate text-[10px] font-bold text-slate-500">
                        Posted by {announcement.postedBy || "HR"}
                      </span>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAnnouncementViewModal(announcement)}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-2.5 text-[10px] font-extrabold text-blue-800 transition hover:border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          aria-label={`View announcement: ${announcement.title}`}
                        >
                          <FontAwesomeIcon icon={faEye} />
                          View
                        </button>

                        {isHrUser && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAnnouncementEditModal(announcement)}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-[10px] font-extrabold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              aria-label={`Edit announcement: ${announcement.title}`}
                            >
                              <FontAwesomeIcon icon={faPen} />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(announcement)}
                              disabled={deletingAnnouncementId === announcement.id}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-2.5 text-[10px] font-extrabold text-red-700 transition hover:border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Delete announcement: ${announcement.title}`}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                              {deletingAnnouncementId === announcement.id ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                  <FontAwesomeIcon icon={faBell} />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-700">No announcements yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Important company notices will appear here.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Personal pulse */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              My Average Hours
            </p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-2xl font-extrabold tabular-nums text-blue-950">
                {formatDashboardNumber(personalDashboardInsights.averageHours, 1)}
                <span className="ml-1 text-xs font-bold text-slate-400">hrs</span>
              </p>
              <span className="rounded-xl bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                Last {personalDashboardInsights.recentRecordCount || 0}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Average rendered hours from recent DTR.</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Target Days
            </p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-700">
              {personalDashboardInsights.targetDays}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              {personalDashboardInsights.undertimeDays} recent day(s) below scheduled hours.
            </p>
          </div>

          <div className={`rounded-2xl border bg-white p-4 shadow-sm ${
            personalDashboardInsights.incompleteDtrDays > 0
              ? "border-amber-200"
              : "border-slate-200"
          }`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Incomplete DTR
            </p>
            <p className={`mt-2 text-2xl font-extrabold tabular-nums ${
              personalDashboardInsights.incompleteDtrDays > 0
                ? "text-amber-700"
                : "text-slate-700"
            }`}>
              {personalDashboardInsights.incompleteDtrDays}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">Missing time-in or time-out in recent records.</p>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              My Available Leaves
            </p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums text-violet-700">
              {formatDashboardNumber(leaveCreditInsights.totals.remaining, 1)}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">Total available leave credits.</p>
          </div>

          <div className={`col-span-2 rounded-2xl border bg-white p-4 shadow-sm lg:col-span-1 ${
            personalDashboardInsights.pendingRequests > 0
              ? "border-blue-200"
              : "border-slate-200"
          }`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              My Pending Requests
            </p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums text-blue-800">
              {personalDashboardInsights.pendingRequests}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">Across your enabled employee services.</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          {/* Quick actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">Quick Actions</h2>
                <p className="mt-1 text-xs text-slate-500">Go directly to your most-used employee services.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                {quickActions.length} available
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickActions.map((action) => (
                <button
                  key={action.code}
                  type="button"
                  onClick={() => navigate(action.route)}
                  className="group rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-blue-800 px-2 text-[10px] font-extrabold text-white shadow-sm">
                      {action.code}
                    </span>
                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700">
                      →
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-extrabold text-slate-800 sm:text-sm">
                    {action.label}
                  </p>
                  <p className="mt-1 hidden text-[10px] leading-4 text-slate-500 sm:block">
                    {action.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Request action center */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">My Request Center</h2>
                <p className="mt-1 text-xs text-slate-500">Pending application counts and recent request status.</p>
              </div>
              <div className="rounded-xl bg-blue-50 px-3 py-2 text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-600">Total Pending</p>
                <p className="text-xl font-extrabold tabular-nums text-blue-900">
                  {personalDashboardInsights.pendingRequests}
                </p>
              </div>
            </div>

            {requestSummaryCards.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {requestSummaryCards.map((card) => (
                  <button
                    type="button"
                    key={card.code}
                    onClick={() => navigate(card.route)}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-extrabold text-blue-800">{card.code}</span>
                      <span className="block truncate text-[10px] font-semibold text-slate-600" title={card.label}>
                        {card.label.replace(" Applications", "")}
                      </span>
                    </span>
                    <span className={`inline-flex min-w-8 items-center justify-center rounded-xl px-2 py-1 text-sm font-extrabold tabular-nums ${
                      toDashboardNumber(card.count) > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {card.count}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                No employee request modules are enabled.
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-700">Recent request status</p>
                <p className="text-[10px] font-semibold text-slate-500">
                  {unifiedRequestStats.total} recent
                </p>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${unifiedRequestStats.approvedPct}%` }}
                  title={`Approved: ${unifiedRequestStats.approved}`}
                />
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${unifiedRequestStats.pendingPct}%` }}
                  title={`Pending: ${unifiedRequestStats.pending}`}
                />
                <div
                  className="bg-rose-500 transition-all duration-500"
                  style={{ width: `${unifiedRequestStats.rejectedPct}%` }}
                  title={`Rejected: ${unifiedRequestStats.rejected}`}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
                <span className="rounded-xl bg-emerald-50 px-2 py-1 text-emerald-700">
                  {unifiedRequestStats.approved} Approved
                </span>
                <span className="rounded-xl bg-amber-50 px-2 py-1 text-amber-700">
                  {unifiedRequestStats.pending} Pending
                </span>
                <span className="rounded-xl bg-rose-50 px-2 py-1 text-rose-700">
                  {unifiedRequestStats.rejected} Rejected
                </span>
              </div>
            </div>
          </div>
        </section>

        {dashboardAttention.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Needs Your Attention</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Items worth checking before payroll cut-off.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-800">
                {dashboardAttention.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {dashboardAttention.map((item, index) => {
                const content = (
                  <>
                    <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-current opacity-70" />
                    <span className="text-xs font-semibold leading-5">{item.label}</span>
                    {item.route && <span className="ml-auto shrink-0">→</span>}
                  </>
                );

                return item.route ? (
                  <button
                    key={`${item.label}-${index}`}
                    type="button"
                    onClick={() => navigate(item.route)}
                    className={`flex items-start gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${item.tone}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={`${item.label}-${index}`}
                    className={`flex items-start gap-2 rounded-xl border p-3 ${item.tone}`}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isManagementUser && (
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-blue-950 sm:text-lg">Workforce Snapshot</h2>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-blue-700">
                    HR / Approver
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Today&apos;s attendance distribution and approval workload.
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 px-4 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Employees</p>
                <p className="text-2xl font-extrabold tabular-nums text-blue-900">
                  {employeeAttendanceCards.total}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[170px_1fr] md:items-center">
                  <div className="flex flex-col items-center justify-center">
                    <div
                      className="relative flex h-36 w-36 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(#059669 ${Math.min(
                          Math.max(attendanceDistribution.presentRate, 0),
                          100
                        ) * 3.6}deg, #e2e8f0 0deg)`,
                      }}
                      title={`Present rate: ${formatDashboardNumber(attendanceDistribution.presentRate, 1)}%`}
                    >
                      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                        <p className="text-2xl font-extrabold text-emerald-700">
                          {formatDashboardNumber(attendanceDistribution.presentRate, 0)}%
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Present</p>
                      </div>
                    </div>
                    <p className="mt-2 text-center text-[10px] text-slate-500">
                      Based on {attendanceDistribution.denominator || 0} categorized employee(s)
                    </p>
                  </div>

                  <div className="space-y-3">
                    {attendanceDistribution.items.map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="font-extrabold tabular-nums text-slate-800">
                            {item.count}
                            <span className="ml-1 font-semibold text-slate-400">
                              ({formatDashboardNumber(item.percentage, 0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              item.label === "Present"
                                ? "bg-emerald-500"
                                : item.label === "No DTR"
                                ? "bg-amber-400"
                                : item.label === "Absent"
                                ? "bg-rose-500"
                                : item.label === "On Leave"
                                ? "bg-violet-500"
                                : "bg-sky-500"
                            }`}
                            style={{ width: `${Math.min(Math.max(item.percentage, 0), 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-blue-950">Approval Queue</p>
                    <p className="text-[11px] text-slate-500">Requests currently assigned to you.</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                    <p className="text-[9px] font-bold uppercase text-blue-600">Pending</p>
                    <p className="text-xl font-extrabold tabular-nums text-blue-900">
                      {personalDashboardInsights.pendingApprovals}
                    </p>
                  </div>
                </div>

                <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-2 sm:grid-cols-2">
                  {approvalSummaryCards.map((card) => (
                    <button
                      key={card.code}
                      type="button"
                      onClick={() => navigate(card.route)}
                      className="flex h-full min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-left transition hover:border-blue-300 hover:shadow-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-blue-800 px-1.5 text-[9px] font-extrabold text-white">
                          {card.code}
                        </span>
                        <span className="truncate text-[11px] font-bold text-slate-700" title={card.label}>
                          {card.label.replace(" for Approval", "")}
                        </span>
                      </span>
                      <span className={`inline-flex min-w-8 items-center justify-center rounded-xl px-2 py-1 text-sm font-extrabold tabular-nums ${
                        toDashboardNumber(card.count) > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {card.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
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
              {portalAccess.leave && (
                <button
                  type="button"
                  onClick={() => navigate("/leave")}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  File Leave
                </button>
              )}
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
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-800"
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
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-800"
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
              <div>
                <div className="relative h-44">
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-emerald-400"
                    style={{
                      bottom: `${Math.min(
                        Math.max((personalDashboardInsights.averageTargetHours / 12) * 100, 0),
                        100
                      )}%`,
                    }}
                  >
                    <span className="absolute -top-4 right-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                      {formatDashboardNumber(personalDashboardInsights.averageTargetHours, 1)}h target
                    </span>
                  </div>
                  <div className="flex h-full items-end justify-between gap-2 px-2">
                    {dtrTrendData.map((data, index) => (
                      <div key={`${data.fullDate}-${index}`} className="group flex h-full w-full max-w-[42px] flex-col items-center gap-2">
                        <div
                          className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-t-xl bg-blue-100"
                          title={`${data.fullDate}: ${formatDashboardNumber(data.hours)} hours`}
                        >
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${
                              data.isUnderTime ? "bg-amber-400" : "bg-blue-800"
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
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-center">
                  <div>
                    <p className="text-sm font-extrabold text-blue-900">
                      {formatDashboardNumber(personalDashboardInsights.averageHours, 1)}h
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Average</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-emerald-700">
                      {personalDashboardInsights.targetDays}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Target Days</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-amber-700">
                      {personalDashboardInsights.undertimeDays}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Below Target</p>
                  </div>
                </div>
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

          {dailyTimeRecord.length > 0 && portalAccess.timekeeping && (
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
        {(portalAccess.leave || portalAccess.overtime || portalAccess.officialBusiness) && (
        <div className="relative flex w-full flex-grow flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
            {/* Tab Navigation */}
            <div className="flex space-x-2 overflow-x-auto">
              {portalAccess.leave && <button
                onClick={() => setActiveTab("leave")}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors ${
                  activeTab === "leave"
                    ? "bg-blue-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                }`}
              >
                Leave Applications
              </button>}
              {portalAccess.overtime && <button
                onClick={() => setActiveTab("ot")}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors ${
                  activeTab === "ot"
                    ? "bg-blue-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                }`}
              >
                Overtime Applications
              </button>}
              {portalAccess.officialBusiness && <button
                onClick={() => setActiveTab("ob")}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors ${
                  activeTab === "ob"
                    ? "bg-blue-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                }`}
              >
                Official Business Applications
              </button>}
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
            {portalAccess.leave && activeTab === "leave" && (
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
            {portalAccess.overtime && activeTab === "ot" && (
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
            {portalAccess.officialBusiness && activeTab === "ob" && (
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
        )}

        {/* Unified Approvals Tabbed Component */}
        {canApprove && (portalAccess.leave || portalAccess.overtime || portalAccess.officialBusiness) && (
          <div className="relative flex w-full flex-grow flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
            
            <div className="mb-4">
              <h2 className="dashboard-text-header">For My Approval</h2>
              <span className="dashboard-text-span">Pending employee requests</span>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
              {/* Tab Navigation */}
              <div className="flex space-x-2 overflow-x-auto">
                {portalAccess.leave && <button
                  onClick={() => setActiveApproverTab("leave")}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                    activeApproverTab === "leave"
                      ? "bg-blue-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                  }`}
                >
                  Leave for Approval
                </button>}
                {portalAccess.overtime && <button
                  onClick={() => setActiveApproverTab("ot")}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                    activeApproverTab === "ot"
                      ? "bg-blue-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                  }`}
                >
                  Overtime for Approval
                </button>}
                {portalAccess.officialBusiness && <button
                  onClick={() => setActiveApproverTab("ob")}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${
                    activeApproverTab === "ob"
                      ? "bg-blue-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-800"
                  }`}
                >
                  Official Business for Approval
                </button>}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto flex-grow">
              
              {/* LEAVE APPROVAL TABLE */}
              {portalAccess.leave && activeApproverTab === "leave" && (
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
              {portalAccess.overtime && activeApproverTab === "ot" && (
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
              {portalAccess.officialBusiness && activeApproverTab === "ob" && (
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

        {selectedAnnouncement && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-view-modal-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeAnnouncementViewModal();
              }
            }}
          >
            <div className="flex max-h-[78vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white">
                      <FontAwesomeIcon icon={faBullhorn} className="text-sm" />
                    </span>

                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-blue-700">
                          Announcement
                        </span>
                        {selectedAnnouncement.postedAt && (
                          <span className="text-[9px] font-semibold text-slate-400">
                            {dayjs(selectedAnnouncement.postedAt).format("MMM DD, YYYY • h:mm A")}
                          </span>
                        )}
                      </div>

                      <h2
                        id="announcement-view-modal-title"
                        className="break-words text-sm font-extrabold leading-5 text-slate-900 sm:text-base"
                      >
                        {selectedAnnouncement.title}
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeAnnouncementViewModal}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close announcement"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-4">
                <p className="whitespace-pre-wrap break-words text-[11px] sm:text-xs leading-6 text-slate-700">
                  {selectedAnnouncement.message}
                </p>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-[10px] text-slate-500">
                    <span className="font-bold text-slate-700">
                      Posted by {selectedAnnouncement.postedBy || "HR"}
                    </span>
                    {selectedAnnouncement.expiresAt && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                        <FontAwesomeIcon icon={faCalendarDays} />
                        Expires {dayjs(selectedAnnouncement.expiresAt).format("MMM DD, YYYY")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {isHrUser && (
                      <button
                        type="button"
                        onClick={() => {
                          closeAnnouncementViewModal();
                          openAnnouncementEditModal(selectedAnnouncement);
                        }}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        <FontAwesomeIcon icon={faPen} />
                        Edit
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={closeAnnouncementViewModal}
                      className="inline-flex h-9 min-w-[84px] items-center justify-center rounded-xl bg-blue-800 px-3 text-[10px] font-bold text-white transition hover:bg-blue-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isHrUser && isAnnouncementModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-modal-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isAnnouncementPosting) {
                closeAnnouncementModal();
              }
            }}
          >
            <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 px-4 py-3 text-white sm:px-4">
                <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
                      <FontAwesomeIcon icon={faBullhorn} />
                    </span>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-100">
                        Human Resources
                      </p>
                      <h2 id="announcement-modal-title" className="mt-0.5 text-base font-extrabold sm:text-lg">
                        {editingAnnouncement ? "Edit Announcement" : "New Announcement"}
                      </h2>
                      <p className="mt-1 text-xs text-blue-100">
                        {editingAnnouncement
                          ? "Update the announcement details and expiration date."
                          : "This announcement will be visible to employees until its expiration date."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeAnnouncementModal}
                    disabled={isAnnouncementPosting}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Close announcement modal"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveAnnouncement} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-4">
                  {announcementPostError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
                      {announcementPostError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label htmlFor="announcement-title" className="text-xs font-extrabold text-slate-700">
                          Announcement Title
                        </label>
                        <span className={`text-[10px] font-semibold ${
                          announcementTitle.length >= 140 ? "text-amber-600" : "text-slate-400"
                        }`}>
                          {announcementTitle.length}/150
                        </span>
                      </div>
                      <input
                        id="announcement-title"
                        type="text"
                        value={announcementTitle}
                        onChange={(event) => setAnnouncementTitle(event.target.value)}
                        maxLength={150}
                        autoFocus
                        placeholder="e.g. Payroll Cut-off Advisory"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        required
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label htmlFor="announcement-expiration-date" className="text-xs font-extrabold text-slate-700">
                          Expiration Date
                        </label>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Required
                        </span>
                      </div>
                      <input
                        id="announcement-expiration-date"
                        type="date"
                        value={announcementExpirationDate}
                        onChange={(event) => setAnnouncementExpirationDate(event.target.value)}
                        min={currentDate?.format("YYYY-MM-DD") || undefined}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        required
                      />
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        The announcement will automatically stop appearing after this date.
                      </p>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label htmlFor="announcement-message" className="text-xs font-extrabold text-slate-700">
                          Message
                        </label>
                        <span className={`text-[10px] font-semibold ${
                          announcementMessage.length >= 1850 ? "text-amber-600" : "text-slate-400"
                        }`}>
                          {announcementMessage.length}/2000
                        </span>
                      </div>
                      <textarea
                        id="announcement-message"
                        value={announcementMessage}
                        onChange={(event) => setAnnouncementMessage(event.target.value)}
                        maxLength={2000}
                        rows={9}
                        placeholder="Write the announcement details here..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        required
                      />
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                          <FontAwesomeIcon icon={faBell} className="text-xs" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-blue-950">Dashboard visibility</p>
                          <p className="mt-0.5 text-[11px] leading-5 text-blue-800/80">
                            {editingAnnouncement
                              ? "Saving will immediately update the announcement for employees."
                              : "After posting, the announcement will immediately appear at the top of the Announcement Board."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                  <button
                    type="button"
                    onClick={closeAnnouncementModal}
                    disabled={isAnnouncementPosting}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isAnnouncementPosting ||
                      !announcementTitle.trim() ||
                      !announcementMessage.trim() ||
                      !announcementExpirationDate
                    }
                    className="inline-flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                    {isAnnouncementPosting
                      ? editingAnnouncement
                        ? "Saving..."
                        : "Posting..."
                      : editingAnnouncement
                      ? "Save Changes"
                      : "Post Announcement"}
                  </button>
                </div>
              </form>
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
