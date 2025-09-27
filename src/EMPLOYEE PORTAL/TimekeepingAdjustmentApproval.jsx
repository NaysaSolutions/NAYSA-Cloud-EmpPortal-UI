import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useAuth } from "./AuthContext.jsx";
import TimekeepingAdjustmentReview from "./TimekeepingAdjustmentReview.jsx";

// ---- Shared UI helpers (same look/feel as OT/Leave/OB) ----------------------
const badgeClass = (status) => {
  const base =
    "inline-flex justify-center items-center text-xs w-20 py-1 rounded-lg font-semibold";
  switch ((status || "").toLowerCase()) {
    case "approved":
      return `${base} bg-blue-100 text-blue-700`;
    case "disapproved":
      return `${base} bg-red-100 text-red-700`;
    case "pending":
      return `${base} bg-amber-100 text-amber-700`;
    case "cancelled":
    case "canceled":
      return `${base} bg-gray-200 text-gray-700`;
    default:
      return `${base} bg-slate-100 text-slate-700`;
  }
};

const Labeled = ({ label, children }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <div className="text-[13px] sm:text-sm font-medium text-slate-800">
      {children}
    </div>
  </div>
);

// -----------------------------------------------------------------------------

const TimekeepingAdjustmentApproval = () => {
  const { user } = useAuth();

  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    try {
      if (!user?.empNo) return;
      setLoading(true);
      setError(null);

      // Pending
      const inqRes = await fetch(API_ENDPOINTS.getDTRApprInq, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo, STAT: "Pending" }),
      });
      const inq = await inqRes.json();
      const pendingRows =
        inq?.success && inq?.data?.[0]?.result
          ? JSON.parse(inq.data[0].result || "[]")
          : [];

      // History (non-pending)
      const histRes = await fetch(API_ENDPOINTS.getDTRApprHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
          END_DATE: dayjs().add(1, "year").format("YYYY-MM-DD"),
        }),
      });
      const hist = await histRes.json();
      const histRows =
        hist?.success && hist?.data?.[0]?.result
          ? JSON.parse(hist.data[0].result || "[]")
          : [];

      setPending(pendingRows);
      setHistory(histRows.filter((r) => (r.dtrStatus || "") !== "Pending"));
    } catch (e) {
      console.error(e);
      setError("Failed to load approvals.");
      setPending([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empNo]);

  const openReview = (row) => {
    setSelected(row);
    setShowModal(true);
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Timekeeping Adjustment Approval</h1>
        </div>

        {/* PENDING */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending DTR Adjustments</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {pending.length > 0 ? (
              pending.map((r, i) => (
                <details
                  key={`p-mobile-${i}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">
                        {r.empname}
                      </span>
                      <span className="text-xs text-slate-500">
                        {r.dtrType || "Adjustment"} • {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-end text-xs gap-2">
                      <span className={badgeClass(r.dtrStatus)}>{r.dtrStatus || "Pending"}</span>
                      <button
                        className="text-[12px] bg-blue-500 text-white px-5 py-1 rounded-lg hover:bg-blue-600 transition"
                        onClick={() => openReview(r)}
                      >
                        Review
                      </button>
                    </div>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Actual Time">
                      {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                    </Labeled>
                    <Labeled label="Applicant Remarks">{r.dtrRemarks || "N/A"}</Labeled>
                  </div>
                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">No pending requests.</div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-left whitespace-nowrap">Employee</th>
                  <th className="global-th text-left whitespace-nowrap">Type</th>
                  <th className="global-th text-left whitespace-nowrap">Shift Date</th>
                  <th className="global-th text-left whitespace-nowrap">Actual Time</th>
                  <th className="global-th text-left whitespace-nowrap">Remarks</th>
                  <th className="global-th text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {pending.length > 0 ? (
                  pending.map((r, i) => (
                    <tr key={`p-desktop-${i}`} className="global-tr">
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.empname}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.dtrType || ""}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left">
                        {r.dtrRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className="bg-blue-500 text-white px-4 py-0.5 rounded-lg hover:bg-blue-600 transition"
                          onClick={() => openReview(r)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="6" className="p-2 text-center text-gray-500">
                      No pending requests.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Approval History</h2>

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {history.length > 0 ? (
              history.map((r, i) => (
                <details
                  key={`h-mobile-${i}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">
                        {r.empname}
                      </span>
                      <span className="text-xs text-slate-500">
                        {r.dtrType || "Adjustment"} • {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </span>
                    </div>
                    <span className={badgeClass(r.dtrStatus)}>{r.dtrStatus}</span>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Actual Time">
                      {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                    </Labeled>
                    <Labeled label="Applicant Remarks">{r.dtrRemarks || "N/A"}</Labeled>
                    <Labeled label="Approver Remarks">{r.appRemarks || "N/A"}</Labeled>
                  </div>
                </details>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500">No records.</div>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-left whitespace-nowrap">Employee</th>
                  <th className="global-th text-left whitespace-nowrap">Type</th>
                  <th className="global-th text-left whitespace-nowrap">Shift Date</th>
                  <th className="global-th text-left whitespace-nowrap">Actual Time</th>
                  <th className="global-th text-left whitespace-nowrap">Applicant Remarks</th>
                  <th className="global-th text-left whitespace-nowrap">Approver Remarks</th>
                  <th className="global-th text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {history.length > 0 ? (
                  history.map((r, i) => (
                    <tr key={`h-desktop-${i}`} className="global-tr">
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.empname}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {r.dtrType || ""}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left">
                        {r.dtrRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-left">
                        {r.appRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <span className={badgeClass(r.dtrStatus)}>{r.dtrStatus}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-3 text-center text-gray-500">
                      No records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* REVIEW MODAL */}
        {showModal && selected && (
          <TimekeepingAdjustmentReview
            dtrData={selected}
            onClose={() => {
              setShowModal(false);
              setSelected(null);
              // Refresh after approve/disapprove/cancel
              fetchAll();
            }}
            setPending={setPending}
            setHistory={setHistory}
          />
        )}
      </div>
    </div>
  );
};

export default TimekeepingAdjustmentApproval;
