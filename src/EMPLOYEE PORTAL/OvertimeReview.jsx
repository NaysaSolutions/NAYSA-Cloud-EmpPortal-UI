import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AiOutlineClose } from "react-icons/ai";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

const OvertimeReview = ({ overtimeData, onClose, setPendingOt, setHistory, refreshData }) => {
  if (!overtimeData) return null;

  const { user } = useAuth();

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const originalHrs = useMemo(() => {
    const n = parseFloat(overtimeData?.otHrs);
    return Number.isFinite(n) ? n : 0;
  }, [overtimeData?.otHrs]);

  const [formData, setFormData] = useState({
    empNo: overtimeData.empNo || "",
    empName: overtimeData.empName || "",
    department: overtimeData.department || "N/A",
    otDate: formatDate(overtimeData.otDate),
    otDays: overtimeData.otDays || "",
    otHrs: overtimeData.otHrs || "",
    approvedHrs: overtimeData.otHrs || "",
    otType: overtimeData.otType || "",
    otRemarks: overtimeData.otRemarks || "",
    otStamp: overtimeData.otStamp || "",
    approverRemarks: "",
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

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      // simple focus trap (Tab cycles)
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
      // keep within 0..originalHrs, allow 2 decimals
      const num = parseFloat(v);
      if (!Number.isFinite(num)) v = "";
      else v = Math.max(0, Math.min(originalHrs, num)).toString();
    }
    setFormData((p) => ({ ...p, [name]: v }));
  };

  const sendDecision = useCallback(
    async ({ appStat }) => {
      try {
        if (!formData.otStamp) {
          await Swal.fire({
            title: "Error",
            text: "otStamp is missing. Please try again.",
            icon: "error",
            customClass: { popup: "z-[10050]" },
            confirmButtonText: "OK",
          });
          return;
        }

        if (appStat === 1) {
          // Approve validations
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
          empNo: formData.empNo,
          appRemarks: (formData.approverRemarks || "").trim(),
          otStamp: formData.otStamp,
          appStat, // 1 = Approved, 0 = Disapproved
          appUser: user.empNo,
        };

        if (appStat === 1) {
          payloadInner.appHrs = parseFloat(formData.approvedHrs) || 0;
        }

        const payload = {
          json_data: JSON.stringify({ json_data: payloadInner }),
        };

        const response = await fetch(API_ENDPOINTS.overtimeApproval, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
          onClose?.();
          await Swal.fire({
            title: "Success",
            text: appStat === 1 ? "Approval successful!" : "Overtime disapproved successfully!",
            icon: "success",
            customClass: { popup: "z-[10050]" },
          });
          // Pull fresh lists if caller provided helpers
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
    [formData, onClose, refreshData, user.empNo, originalHrs]
  );

  const handleApprove = () => sendDecision({ appStat: 1 });
  const handleDisapprove = () => sendDecision({ appStat: 0 });

  // Diff helper
  const showDiff =
    Number.isFinite(parseFloat(formData.approvedHrs)) &&
    parseFloat(formData.approvedHrs) !== parseFloat(formData.otHrs);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[1px] p-0 sm:p-6 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="ot-modal-title"
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
          <h2 id="ot-modal-title" className="text-base sm:text-lg font-semibold">
            Overtime Details
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
            {formData.otType ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Type: <span className="ml-1 font-medium">{formData.otType}</span>
              </span>
            ) : null}
            {formData.otHrs ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Hours: <span className="ml-1 font-medium">{formData.otHrs}</span>
              </span>
            ) : null}
          </div>

          <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Employee Name</label>
              <input className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.empName || ""} readOnly disabled/>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-2">

            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Department</label>
              <input className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.department || ""} readOnly disabled/>
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Overtime Date</label>
              <input
                type="date"
                className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs"
                value={formData.otDate || ""}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Requested Hours</label>
              <input className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={formData.otHrs || ""} readOnly disabled/>
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
                  You changed from <span className="font-medium">{formData.otHrs}</span> to{" "}
                  <span className="font-medium">{formData.approvedHrs}</span>
                </p>
              )}
            </div>
          </div>
          
          {/* Employee Remarks */}
          <div className="mt-2">
              <label className="block text-gray-700 text-sm mb-1 text-xs">Remarks</label>
           <textarea
                name="otRemarks"
                value={formData.otRemarks}
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

export default OvertimeReview;
