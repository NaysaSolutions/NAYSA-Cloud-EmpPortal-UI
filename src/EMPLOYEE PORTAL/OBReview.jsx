import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AiOutlineClose } from "react-icons/ai";
import { FaEye, FaPaperclip } from "react-icons/fa";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

// Official Business attachment display. Uses the same outlined View File control as DTR.
const getOBAttachment = (row) => {
  const value = row?.attachment ?? row?.attachment_path ?? row?.ATTACHMENT_PATH ?? row?.attachmentPath;
  return typeof value === "string" && value.trim() && !["null", "undefined", "n/a"].includes(value.trim().toLowerCase()) ? value.trim() : null;
};
const getOBAttachmentName = (value) => {
  if (!value) return "";
  const file = value.split(/[?#]/)[0].replace(/\\/g, "/").split("/").pop();
  try { return decodeURIComponent(file); } catch { return file; }
};
const getOBAttachmentUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const clean = value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^public\//i, "").replace(/^images\//i, "");
  const base = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "").replace(/\/api$/i, "");
  return `${base}/images/${clean.split("/").map(encodeURIComponent).join("/")}`;
};
const OBAttachmentViewer = ({ row, compact = false }) => {
  const path = getOBAttachment(row);
  if (!path) return <span className="text-xs text-slate-400">No attachment</span>;
  const url = getOBAttachmentUrl(path);
  const filename = getOBAttachmentName(path);
  const viewButton = (
    <a href={url} target="_blank" rel="noopener noreferrer" title={filename}
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300">
      <FaEye aria-hidden="true" /><span>View File</span>
    </a>
  );
  return compact ? viewButton : (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><FaPaperclip aria-hidden="true" /> Supporting document</div>
          <div title={filename} className="mt-1 truncate text-xs text-slate-700">{filename}</div>
        </div>
        {viewButton}
      </div>
    </div>
  );
};
/*********************************************************
 * OBReview — updated to match OvertimeReview UX patterns
 *********************************************************/
const OBReview = ({ obData, onClose, pendingOBs, setPendingOBs, setHistory, refreshData, attachmentEnabled = false }) => {
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
  const attachedPath = getOBAttachment(obData);
  const attachedUrl = getOBAttachmentUrl(attachedPath);
  const attachedType = attachedPath?.toLowerCase().split("?")[0] || "";

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
        className="w-full sm:w-[720px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-[scaleIn_150ms_ease-out]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 sm:px-4 py-3 flex items-center justify-between">
          <div>
             <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Approval Request</div>
             <h2 id="ob-modal-title" className="text-base sm:text-lg font-bold text-slate-900">Review Official Business</h2>
             <p className="text-xs text-slate-500">Review the employee request and supporting document before deciding.</p>
           </div>
          <button
            onClick={onClose}
            className="rounded-xl hover:bg-gray-100 active:scale-[.98] transition"
            aria-label="Close"
            ref={firstFieldRef}
          >
            <AiOutlineClose className="h-5 w-5" />
          </button>
        </div>

         {/* Content */}
         <div className="space-y-4 overflow-y-auto bg-slate-50/50 px-4 py-4 sm:px-6">
           <div className="rounded-xl border border-slate-200 bg-white p-4">
             <h3 className="mb-3 text-sm font-bold text-slate-800">Request information</h3>
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
            <input className="border rounded-xl px-3 py-2 w-full bg-gray-50 text-xs" value={formData.empname || ""} readOnly disabled/>
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">Start</label>
              <input type="datetime-local" className="border rounded-xl px-3 py-2 w-full bg-gray-50 text-[11px]" value={formData.obstart} readOnly disabled/>
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">End</label>
              <input type="datetime-local" className="border rounded-xl px-3 py-2 w-full bg-gray-50 text-[11px]" value={formData.obend} readOnly disabled/>
            </div>
          </div>

          
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-2">

            <div>
              <label className="block text-gray-700 text-sm mb-1 text-xs">OB Hours</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="approvedHrs"
                className="border rounded-xl px-3 py-2 w-full text-xs"
                value={formData.duration}
                inputMode="decimal"
                readOnly disabled
              />
              {showDiff && (
                <p className="mt-1 text-[11px]">
                  You changed from <span className="font-medium">{formData.duration}</span> to {" "}
                  <span className="font-medium">{formData.approvedHrs}</span>
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
                className="border rounded-xl px-3 py-2 w-full text-xs"
                value={formData.approvedHrs}
                onChange={handleChange}
                inputMode="decimal"           
                readOnly disabled
              />
              {showDiff && (
                <p className="mt-1 text-[11px]">
                  You changed from <span className="font-medium">{formData.duration}</span> to {" "}
                  <span className="font-medium">{formData.approvedHrs}</span>
                </p>
              )}
            </div>
          </div>

           </div>
           {attachmentEnabled && (
             <div className="rounded-xl border border-slate-200 bg-white p-4">
               <div className="mb-3 flex items-center justify-between gap-3">
                 <h3 className="text-sm font-bold text-slate-800">Supporting attachment</h3>
                 <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${attachedPath ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                   {attachedPath ? "Attached" : "Not provided"}
                 </span>
               </div>
               <OBAttachmentViewer row={obData} />
               {attachedUrl && /\.(png|jpe?g|webp)$/i.test(attachedType) && (
                 <div className="mt-3 flex max-h-[260px] justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                   <img src={attachedUrl} alt="Official Business supporting attachment" className="max-h-[240px] max-w-full object-contain" loading="lazy" />
                 </div>
               )}
               {attachedUrl && /\.pdf$/i.test(attachedType) && (
                 <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                   <iframe src={attachedUrl} title="Official Business attachment preview" className="h-[240px] w-full sm:h-[300px]" />
                 </div>
               )}
             </div>
           )}
           {/* Applicant Remarks */}
<div className="rounded-xl border border-slate-200 bg-white p-4">
             <label className="mb-2 block text-sm font-bold text-slate-800">Applicant remarks</label>
            <textarea name="obRemarks" value={formData.obRemarks} className="w-full border rounded-xl px-3 py-2 min-h-16 resize-y text-xs" disabled />
          </div>

          {/* Approver Remarks */}
<div className="rounded-xl border border-slate-200 bg-white p-4">
             <label className="mb-2 block text-sm font-bold text-slate-800">Approver’s Remarks <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea
              name="approverRemarks"
              value={formData.approverRemarks}
              onChange={handleChange}
              className="w-full border rounded-xl px-3 py-2 min-h-16 resize-y text-xs"
              placeholder="Optional notes…"
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end text-sm">
            <button
              type="button"
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 active:scale-[.99] transition disabled:opacity-60"
              onClick={handleDisapprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing…" : "Disapprove"}
            </button>
            <button
              type="button"
              ref={lastFocusableRef}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[.99] transition disabled:opacity-60"
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
