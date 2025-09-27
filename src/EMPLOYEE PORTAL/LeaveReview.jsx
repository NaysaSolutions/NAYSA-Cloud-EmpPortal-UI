import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AiOutlineClose } from "react-icons/ai";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

const LeaveReview = ({ leaveData, onClose, setPendingLeaves, setHistory, refreshData }) => {
  if (!leaveData) return null;

  const { user } = useAuth();

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const originalDays = useMemo(() => {
    const n = parseFloat(leaveData?.leaveDays);
    return Number.isFinite(n) ? n : 0;
  }, [leaveData?.leaveDays]);

  const originalHrs = useMemo(() => {
    const n = parseFloat(leaveData?.leaveHrs);
    return Number.isFinite(n) ? n : 0;
  }, [leaveData?.leaveHrs]);

  const [formData, setFormData] = useState({
    empNo: leaveData.empNo || "",
    empName: leaveData.empName || "",
    department: leaveData.department || "",
    leaveStart: formatDate(leaveData.leaveStart),
    leaveEnd: formatDate(leaveData.leaveEnd),
    leaveDays: leaveData.leaveDays || "",
    leaveHrs: leaveData.leaveHrs || "",
    approvedDays: leaveData.leaveDays || "",
    approvedHrs: leaveData.leaveHrs || "",
    leaveCode: leaveData.leaveCode || leaveData.lvType || "",
    leaveRemarks: leaveData.leaveRemarks || leaveData.remarks || "",
    LV_STAMP: leaveData.LV_STAMP || leaveData.lvStamp || "",
    approverRemarks: leaveData.approverRemarks || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstFieldRef = useRef(null);
  const modalRef = useRef(null);
  const lastFocusableRef = useRef(null);

  // Lock background scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus first input on mount
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Close on ESC + simple focus trap
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;

    if (name === "approvedDays") {
      const num = parseFloat(v);
      if (!Number.isFinite(num)) v = "";
      else v = Math.max(0, Math.min(originalDays, num)).toString();
    }
    if (name === "approvedHrs") {
      const num = parseFloat(v);
      if (!Number.isFinite(num)) v = "";
      else v = Math.max(0, Math.min(originalHrs, num)).toString();
    }

    setFormData((p) => ({ ...p, [name]: v }));
  };

  const sendDecision = useCallback(
    async ({ appStat }) => {
      try {
        if (!formData.LV_STAMP) {
          await Swal.fire({
            title: "Error",
            text: "LV_STAMP is missing. Please try again.",
            icon: "error",
            customClass: { popup: "z-[10050]" },
            confirmButtonText: "OK",
          });
          return;
        }

        if (appStat === 1) {
          // Validate approved quantities
          const d = parseFloat(formData.approvedDays);
          const h = parseFloat(formData.approvedHrs);
          if (!Number.isFinite(d) && !Number.isFinite(h)) {
            await Swal.fire({
              title: "Missing values",
              text: "Provide at least Approved Days or Approved Hours.",
              icon: "warning",
              customClass: { popup: "z-[10050]" },
            });
            return;
          }
          if (Number.isFinite(d) && (d < 0 || d > originalDays)) {
            await Swal.fire({
              title: "Days out of range",
              text: `Approved Days must be between 0 and ${originalDays}.`,
              icon: "warning",
              customClass: { popup: "z-[10050]" },
            });
            return;
          }
          if (Number.isFinite(h) && (h < 0 || h > originalHrs)) {
            await Swal.fire({
              title: "Hours out of range",
              text: `Approved Hours must be between 0 and ${originalHrs}.`,
              icon: "warning",
              customClass: { popup: "z-[10050]" },
            });
            return;
          }
        }

        setIsSubmitting(true);

        const payloadInner = {
          empNo: formData.empNo,
          appRemarks: (formData.approverRemarks || "").trim(),
          LV_STAMP: formData.LV_STAMP,
          appStat, // 1 = Approved, 0 = Disapproved
          appUser: user.empNo,
        };

        if (appStat === 1) {
          // Only send if numeric; backend can treat missing as 0/null
          const d = parseFloat(formData.approvedDays);
          const h = parseFloat(formData.approvedHrs);
          if (Number.isFinite(d)) payloadInner.appDays = d;
          if (Number.isFinite(h)) payloadInner.appHrs = h;
        }

        const payload = {
          json_data: JSON.stringify({ json_data: payloadInner }),
        };

        const response = await fetch(API_ENDPOINTS.leaveApproval, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
          onClose?.();
          await Swal.fire({
            title: "Success",
            text: appStat === 1 ? "Approval successful!" : "Leave disapproved successfully!",
            icon: "success",
            customClass: { popup: "z-[10050]" },
          });
          refreshData?.();
        } else {
          await Swal.fire({
            title: "Error",
            text: result?.message || "Something went wrong.",
            icon: "error",
            customClass: { popup: "z-[10050]" },
          });
        }
      } catch (error) {
        console.error("Submit failed:", error);
        await Swal.fire({
          title: "Error",
          text: "Request failed. Please try again.",
          icon: "error",
          customClass: { popup: "z-[10050]" },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, onClose, refreshData, user.empNo, originalDays, originalHrs]
  );

  const handleApprove = () => sendDecision({ appStat: 1 });
  const handleDisapprove = () => sendDecision({ appStat: 0 });

  const showDaysDiff =
    Number.isFinite(parseFloat(formData.approvedDays)) &&
    parseFloat(formData.approvedDays) !== parseFloat(formData.leaveDays);

  const showHrsDiff =
    Number.isFinite(parseFloat(formData.approvedHrs)) &&
    parseFloat(formData.approvedHrs) !== parseFloat(formData.leaveHrs);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[1px] p-0 sm:p-6 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="lv-modal-title"
    >
      <div
        ref={modalRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="
          w-full sm:w-auto
          bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl
          max-h-[95vh] sm:max-h-[90vh]
          sm:max-w-3xl lg:max-w-5xl
          flex flex-col
          overflow-hidden
          animate-[scaleIn_150ms_ease-out]
        "
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 sm:px-4 py-3 flex items-center justify-between">
          <h2 id="lv-modal-title" className="text-base sm:text-lg font-semibold">
            Leave Details
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg hover:bg-gray-100 active:scale-[.98] transition"
            aria-label="Close"
            ref={firstFieldRef}
          >
            <AiOutlineClose className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-4 py-2 overflow-y-auto">
          {/* Meta badges */}
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {formData.leaveCode ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Type: <span className="ml-1 font-medium">{formData.leaveCode}</span>
              </span>
            ) : null}
            {formData.leaveDays ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Requested Days: <span className="ml-1 font-medium">{formData.leaveDays}</span>
              </span>
            ) : null}
            {formData.leaveHrs ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Requested Hours: <span className="ml-1 font-medium">{formData.leaveHrs}</span>
              </span>
            ) : null}
          </div>

          <div>
            <label className="block text-gray-700 text-sm mb-1 text-xs">Employee Name</label>
            <input className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.empName || ""} readOnly
                disabled />
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Leave Start</label>
              <input type="date" className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.leaveStart || ""} readOnly
                disabled />
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Leave End</label>
              <input type="date" className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.leaveEnd || ""} readOnly
                disabled />
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Approved Days</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={originalDays}
                name="approvedDays"
                className="border rounded-md px-3 py-2 w-full text-xs"
                value={formData.approvedDays}
                // onChange={handleChange}
                inputMode="decimal"
                disabled
              />
              {showDaysDiff && (
                <p className="mt-1 text-[11px]">
                  You changed from <span className="font-medium">{formData.leaveDays}</span> to {" "}
                  <span className="font-medium">{formData.approvedDays}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Approved Hours</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={originalHrs}
                name="approvedHrs"
                className="border rounded-md px-3 py-2 w-full text-xs"
                value={formData.approvedHrs}
                // onChange={handleChange}
                inputMode="decimal"
                disabled
              />
              {showHrsDiff && (
                <p className="mt-1 text-[11px]">
                  You changed from <span className="font-medium">{formData.leaveHrs}</span> to {" "}
                  <span className="font-medium">{formData.approvedHrs}</span>
                </p>
              )}
            </div>
          </div>

          {/* Employee Remarks */}
          <div className="mt-2">
            <label className="block text-gray-700 text-sm mb-1 text-xs">Remarks</label>
            <textarea
              name="leaveRemarks"
              value={formData.leaveRemarks}
              className="w-full border rounded-md px-3 py-2 min-h-16 resize-y text-xs"
              disabled
            />
          </div>

          {/* Approver Remarks */}
          <div className="mt-2">
            <label className="block text-gray-700 text-sm mb-1 text-xs">Approver’s Remarks</label>
            <textarea
              name="approverRemarks"
              value={formData.approverRemarks}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 min-h-16 resize-y text-xs"
              placeholder="Optional notes…"
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end text-sm">
            <button
              type="button"
              className="w-full sm:w-auto px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 active:scale-[.99] transition disabled:opacity-60"
              onClick={handleDisapprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing…" : "Disapprove"}
            </button>

            <button
              type="button"
              ref={lastFocusableRef}
              className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 active:scale-[.99] transition disabled:opacity-60"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing…" : "Approve"}
            </button>
          </div>
        </div>
      </div>

      {/* tiny keyframes (optional) */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: translateY(8px) scale(.98); opacity: .98 } to { transform: translateY(0) scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
};

export default LeaveReview;
