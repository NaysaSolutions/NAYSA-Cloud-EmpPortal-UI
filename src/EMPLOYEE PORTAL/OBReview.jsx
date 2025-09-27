import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AiOutlineClose } from "react-icons/ai";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

/*********************************************************
 * OBReview — updated to match OvertimeReview UX patterns
 *********************************************************/
const OBReview = ({ obData, onClose, pendingOBs, setPendingOBs, setHistory, refreshData }) => {
  if (!obData) return null;
  const { user } = useAuth();

  // helpers
  const formatDateTimeLocal = (value) => {
    if (!value) return "";
    const d = dayjs(value);
    return d.isValid() ? d.format("YYYY-MM-DDTHH:mm") : "";
  };

  const originalHrs = useMemo(() => {
    const n = parseFloat(obData?.duration);
    return Number.isFinite(n) ? n : 0;
  }, [obData?.duration]);

  const [formData, setFormData] = useState({
    empno: obData.empno || "",
    empname: obData.empname || "",
    department: obData.department || "",
    obstart: formatDateTimeLocal(obData.obstart),
    obend: formatDateTimeLocal(obData.obend),
    duration: obData.duration || "",
    approvedHrs: obData.duration || "",
    obRemarks: obData.obRemarks || "",
    approverRemarks: obData.approverRemarks || "",
    obStamp: obData.obStamp || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // a11y/focus mgmt
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

  // Close on ESC + focus trap
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
        if (!formData.obStamp) {
          await Swal.fire({
            title: "Error",
            text: "obStamp is missing. Please try again.",
            icon: "error",
            customClass: { popup: "z-[10050]" },
          });
          return;
        }

        if (appStat === 1) {
          const n = parseFloat(formData.approvedHrs);
          if (!Number.isFinite(n)) {
            await Swal.fire({
              title: "Invalid hours",
              text: "Please enter a valid number for Approved Hours.",
              icon: "warning",
              customClass: { popup: "z-[10050]" },
            });
            return;
          }
          if (n < 0 || n > originalHrs) {
            await Swal.fire({
              title: "Out of range",
              text: `Approved Hours must be between 0 and ${originalHrs}.`,
              icon: "warning",
              customClass: { popup: "z-[10050]" },
            });
            return;
          }
        }

        setIsSubmitting(true);

        const payloadInner = {
          empNo: formData.empno,
          appRemarks: (formData.approverRemarks || "").trim(),
          obStamp: formData.obStamp,
          appStat, // 1 = Approved, 0 = Disapproved
          appUser: user.empNo,
          appObStart: obData.obstart,
          appObEnd: obData.obend,
        };
        if (appStat === 1) {
          payloadInner.appHrs = parseFloat(formData.approvedHrs) || 0;
          payloadInner.appDays = 0; // keep 0 unless you have day-based logic
        }

        const payload = { json_data: JSON.stringify({ json_data: payloadInner }) };

        const response = await fetch(API_ENDPOINTS.officialBusinessApproval, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
          onClose?.();
          await Swal.fire({
            title: "Success",
            text: appStat === 1 ? "Approval successful!" : "Disapproval successful!",
            icon: "success",
            customClass: { popup: "z-[10050]" },
          });

          // Update lists if parent provided
          if (setPendingOBs) setPendingOBs((prev) => prev.filter((x) => x.obStamp !== formData.obStamp));
          if (setHistory) setHistory((prev) => [{ ...obData, obstatus: appStat === 1 ? "Approved" : "Disapproved", appRemarks: formData.approverRemarks }, ...prev]);
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
        await Swal.fire({
          title: "Error",
          text: error?.message || "Request failed. Please try again.",
          icon: "error",
          customClass: { popup: "z-[10050]" },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, user.empNo, onClose, setPendingOBs, setHistory, refreshData, obData, originalHrs]
  );

  const handleApprove = () => sendDecision({ appStat: 1 });
  const handleDisapprove = () => sendDecision({ appStat: 0 });

  const showDiff =
    Number.isFinite(parseFloat(formData.approvedHrs)) &&
    parseFloat(formData.approvedHrs) !== parseFloat(formData.duration);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[1px] p-0 sm:p-6 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="ob-modal-title"
    >
      <div
        ref={modalRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full sm:w-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] sm:max-w-3xl lg:max-w-5xl flex flex-col overflow-hidden animate-[scaleIn_150ms_ease-out]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 sm:px-4 py-3 flex items-center justify-between">
          <h2 id="ob-modal-title" className="text-base sm:text-lg font-semibold">Official Business Details</h2>
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
            {formData.obDate ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Date: <span className="ml-1 font-medium">{formData.obDate}</span>
              </span>
            ) : null}
            {formData.duration ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Hours: <span className="ml-1 font-medium">{formData.duration}</span>
              </span>
            ) : null}
          </div>

          <div>
            <label className="block text-gray-700 text-sm mb-1 text-xs">Employee Name</label>
            <input className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.empname || ""} readOnly />
          </div>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Start</label>
              <input type="datetime-local" className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.obstart} readOnly />
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">End</label>
              <input type="datetime-local" className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.obend} readOnly />
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
                onChange={handleChange}
                inputMode="decimal"
              />
              {showDiff && (
                <p className="mt-1 text-[11px]">
                  You changed from <span className="font-medium">{formData.duration}</span> to {" "}
                  <span className="font-medium">{formData.approvedHrs}</span>
                </p>
              )}
            </div>
          </div>

          {/* Applicant Remarks */}
          <div className="mt-2">
            <label className="block text-gray-700 text-sm mb-1 text-xs">Remarks</label>
            <textarea name="obRemarks" value={formData.obRemarks} className="w-full border rounded-md px-3 py-2 min-h-16 resize-y text-xs" disabled />
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

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: translateY(8px) scale(.98); opacity: .98 } to { transform: translateY(0) scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
};


export default OBReview ;
