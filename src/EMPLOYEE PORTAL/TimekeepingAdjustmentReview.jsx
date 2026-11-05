import React, { useEffect, useRef, useState } from "react";
import { AiOutlineClose } from "react-icons/ai";
import { FaEye, FaPaperclip, FaFilePdf, FaFileAlt, FaImage } from "react-icons/fa";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

// Shared DTR attachment helpers. Both Approval and Review import and use these
// exact functions so the same record cannot produce different attachment states.
export const getDTRAttachment = (row) => {
  const candidates = [
    row?.attachment,
    row?.attachment_path,
    row?.ATTACHMENT_PATH,
    row?.attachmentPath,
  ];
  return candidates.find((value) =>
    typeof value === "string" &&
    value.trim() &&
    !["null", "undefined", "n/a"].includes(value.trim().toLowerCase())
  )?.trim() || null;
};

export const getDTRAttachmentUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const clean = path.replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^images\//i, "");
  const base = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000")
    .replace(/\/+$/, "").replace(/\/api$/i, "");
  return `${base}/images/${clean.split("/").map(encodeURIComponent).join("/")}`;
};

const getDTRAttachmentName = (path) => {
  if (!path) return "";
  const file = path.split(/[?#]/)[0].replace(/\\/g, "/").split("/").pop();
  try { return decodeURIComponent(file); } catch { return file; }
};

const getDTRAttachmentKind = (path) => {
  const file = path?.split("?")[0].toLowerCase() || "";
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(file)) return "image";
  if (/\.pdf$/.test(file)) return "pdf";
  return "file";
};

const getDTRAttachmentMeta = (path) => {
  const kind = getDTRAttachmentKind(path);
  if (kind === "image") return { label: "Image attachment", icon: FaImage };
  if (kind === "pdf") return { label: "PDF document", icon: FaFilePdf };
  return { label: "Supporting document", icon: FaFileAlt };
};

export const DTRAttachmentViewer = ({ row, compact = false }) => {
  const path = getDTRAttachment(row);
  if (!path) return <span className="text-xs text-slate-400">No attachment</span>;

  const name = getDTRAttachmentName(path);
  const url = getDTRAttachmentUrl(path);
  const meta = getDTRAttachmentMeta(path);
  const Icon = meta.icon;
  const viewButton = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={name}
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
    >
      <FaEye aria-hidden="true" />
      <span>View File</span>
    </a>
  );

  if (compact) return viewButton;
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Icon aria-hidden="true" />
            <span>{meta.label}</span>
          </div>
          <div title={name} className="mt-1 break-all text-xs text-slate-700">{name}</div>
        </div>
        {viewButton}
      </div>
    </div>
  );
};

/*********************************************************
 * TimekeepingAdjustmentReview — updated to match UI
 *********************************************************/
const TimekeepingAdjustmentReview = ({ dtrData, attachmentPath = null, attachmentUrl: suppliedAttachmentUrl = null, onClose, setPending, setHistory, refreshData, attachmentEnabled = false }) => {
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

  // The modal renders exactly the same viewer as the table, using the same row.
  // Keep legacy explicit props supported, but they are not required.
  const attachedPath = getDTRAttachment(dtrData) || getDTRAttachment({ attachment: attachmentPath });
  const attachedRow = { ...dtrData, attachment: attachedPath, attachment_path: attachedPath };
  const attachedUrl = getDTRAttachmentUrl(attachedPath) || suppliedAttachmentUrl;
  const attachedType = getDTRAttachmentKind(attachedPath || attachedUrl);

  const formattedType = ({ timeIn: "Time In", timeOut: "Time Out", breakIn: "Break In", breakOut: "Break Out" })[dtrData.dtrType] || dtrData.dtrType || "Adjustment";
  const formattedDate = dtrData.dtrDate && dayjs(dtrData.dtrDate).isValid() ? dayjs(dtrData.dtrDate).format("MMM D, YYYY") : "—";
  const formattedActual = dtrData.dtrStart && dayjs(dtrData.dtrStart).isValid() ? dayjs(dtrData.dtrStart).format("MMM D, YYYY • hh:mm A") : "—";

  return (
    <div
      data-dtr-attachment-build="shared-viewer-20261105"
      className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-3 sm:p-6"
      onMouseDown={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="dtr-modal-title"
    >
      <div
        ref={modalRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[94dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.12em] text-blue-700">Approval request</div>
            <h2 id="dtr-modal-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Review Timekeeping Adjustment</h2>
            <p className="mt-1 text-xs text-slate-500">Review the requested time, remarks, and supporting attachment before deciding.</p>
          </div>
          <button ref={firstFieldRef} type="button" onClick={onClose} aria-label="Close review"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100">
            <AiOutlineClose className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/60 px-5 py-5 sm:px-7">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">Request information</h3>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{dtrData.dtrStatus || "Pending"}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Employee</div>
                <div className="mt-1 break-words text-sm font-semibold text-slate-900">{dtrData.empname || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Adjustment type</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formattedType}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Shift date</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formattedDate}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Requested actual date & time</div>
                <div className="mt-1 text-sm font-semibold text-blue-800">{formattedActual}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-800">Applicant remarks</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{dtrData.dtrRemarks || "No remarks provided."}</p>
          </div>

          {attachmentEnabled && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">Supporting attachment</h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${attachedPath ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {attachedPath ? "Attached" : "Not provided"}
                </span>
              </div>
              {attachedPath ? (
                <>
                  <DTRAttachmentViewer row={attachedRow} />
                  {attachedUrl && attachedType === "image" && (
                    <div className="mt-3 flex max-h-[280px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <img src={attachedUrl} alt="DTR supporting attachment" className="max-h-[260px] max-w-full rounded object-contain" loading="lazy" />
                    </div>
                  )}
                  {attachedUrl && attachedType === "pdf" && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <iframe src={attachedUrl} title="DTR attachment PDF preview" className="h-[240px] w-full sm:h-[300px]" />
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  No supporting file was uploaded for this adjustment.
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <label htmlFor="dtr-approver-remarks" className="block text-sm font-bold text-slate-800">Approver's remarks <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="dtr-approver-remarks" rows={3} maxLength={4000}
              className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={approverRemarks} onChange={(e) => setApproverRemarks(e.target.value)}
              placeholder="Enter remarks for this approval decision..." />
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse items-stretch justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-7">
          <button type="button" onClick={onClose} disabled={isSubmitting}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Close</button>
          <button type="button" onClick={() => sendDecision(0)} disabled={isSubmitting}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{isSubmitting ? "Processing..." : "Disapprove"}</button>
          <button ref={lastFocusableRef} type="button" onClick={() => sendDecision(1)} disabled={isSubmitting}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{isSubmitting ? "Processing..." : "Approve"}</button>
        </div>
      </div>
    </div>
  );
};

export default TimekeepingAdjustmentReview;
