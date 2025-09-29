import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AiOutlineClose } from "react-icons/ai";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

/*********************************************************
 * TimekeepingAdjustmentReview — updated to match UI
 *********************************************************/
const TimekeepingAdjustmentReview = ({ dtrData, onClose, setPending, setHistory, refreshData }) => {
  if (!dtrData) return null;
  const { user } = useAuth();

  const [approverRemarks, setApproverRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // a11y/focus mgmt
  const firstFieldRef = useRef(null);
  const modalRef = useRef(null);
  const lastFocusableRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev);
  }, []);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

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

  const payloadBase = (appStat) => ({
    json_data: JSON.stringify({
      json_data: {
        empNo: dtrData.empno,
        appRemarks: approverRemarks,
        dtrStamp: dtrData.dtrStamp,
        appStat, // 1 = Approve, 0 = Disapprove
        appUser: user.empNo,
        appDatetime: dtrData.actualTime, // optional; sproc may stamp current
      },
    }),
  });

  const sendDecision = async (appStat) => {
    try {
      if (!dtrData?.dtrStamp) {
        await Swal.fire({ title: "Error", text: "Missing DTR stamp.", icon: "error", customClass: { popup: "z-[10050]" } });
        return;
      }

      setIsSubmitting(true);

      const res = await fetch(API_ENDPOINTS.approvalDTR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBase(appStat)),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.message || "Request failed");

      await Swal.fire({
        title: appStat === 1 ? "Approved" : "Disapproved",
        text: appStat === 1 ? "Approval successful!" : "DTR Adjustment disapproved successfully!",
        icon: "success",
        customClass: { popup: "z-[10050]" },
      });

      const updated = { ...dtrData, appRemarks: approverRemarks, dtrStatus: appStat === 1 ? "Approved" : "Disapproved" };
      setPending?.((prev) => prev.filter((x) => x.dtrStamp !== dtrData.dtrStamp));
      setHistory?.((prev) => [updated, ...prev]);
      refreshData?.();
      onClose?.();
    } catch (err) {
      await Swal.fire({ title: "Error", text: err.message, icon: "error", customClass: { popup: "z-[10050]" } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1050] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[1px] p-0 sm:p-6 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="dtr-modal-title"
    >
      <div
        ref={modalRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full sm:w-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] sm:max-w-3xl lg:max-w-5xl flex flex-col overflow-hidden animate-[scaleIn_150ms_ease-out]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 sm:px-4 py-3 flex items-center justify-between">
          <h2 id="dtr-modal-title" className="text-base sm:text-lg font-semibold">DTR Adjustment Details</h2>
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
            {dtrData?.dtrType ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Type: <span className="ml-1 font-medium">{dtrData.dtrType}</span>
              </span>
            ) : null}
            {dtrData?.dtrDate ? (
              <span className="inline-flex items-center rounded-full border px-2 py-1">
                Shift Date: <span className="ml-1 font-medium">{dayjs(dtrData.dtrDate).format("MM/DD/YYYY")}</span>
              </span>
            ) : null}
          </div>

          <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Employee</label>
              <input className="border rounded-md px-3 py-2 w-full bg-gray-50 text-xs" value={dtrData.empname || ""} readOnly disabled/>
            </div>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-1 gap-2">
            
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Shift Date</label>
              <input type="date" className="border rounded-md px-3 py-2 w-full bg-gray-50 text-[11px]" value={dayjs(dtrData.dtrDate).format("YYYY-MM-DD")} readOnly disabled/>
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Actual Time</label>
              <input type="datetime-local" className="border rounded-md px-3 py-2 w-full bg-gray-50 text-[11px]" value={dayjs(dtrData.dtrStart).format("YYYY-MM-DDTHH:mm")} readOnly disabled/>
            </div>

          </div>

          <div className="mt-2">
            <label className="block text-gray-700 text-sm mb-1 text-xs">Applicant Remarks</label>
            <textarea className="w-full border rounded-md px-3 py-2 min-h-16 resize-y text-xs" value={dtrData.dtrRemarks || ""} readOnly disabled />
          </div>

          <div className="mt-2">
            <label className="block text-gray-700 text-sm mb-1 text-xs">Approver’s Remarks</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 min-h-16 resize-y text-xs"
              value={approverRemarks}
              onChange={(e) => setApproverRemarks(e.target.value)}
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
              onClick={() => sendDecision(0)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing…" : "Disapprove"}
            </button>

            <button
              type="button"
              ref={lastFocusableRef}
              className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 active:scale-[.99] transition disabled:opacity-60"
              onClick={() => sendDecision(1)}
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

export default TimekeepingAdjustmentReview;
