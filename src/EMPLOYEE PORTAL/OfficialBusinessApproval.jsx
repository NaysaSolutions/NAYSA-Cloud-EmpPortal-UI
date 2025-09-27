import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import OBReview from "./OBReview.jsx";
import API_ENDPOINTS from "@/apiConfig.jsx";

// ---- Shared UI helpers (same as OT/Leave) -----------------------------------
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

const OfficialBusinessApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingOBs, setPendingOBs] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedOB, setSelectedOB] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOBApprovals = async () => {
    try {
      if (!user?.empNo) return;
      setLoading(true);
      setError(null);

      const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

      // If you have a separate "OBHistoryApplication" (like OT), you can swap it here.
      const response = await fetch(
        API_ENDPOINTS.approvedOfficialBusinessHistory,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: startDate,
            END_DATE: "2030-01-01",
          }),
        }
      );

      const data = await response.json();
      if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
        const parsed = JSON.parse(data.data[0].result || "[]");

        // Deduplicate (trusting obStamp as unique key)
        const seen = new Set();
        const unique = parsed.filter((r) => {
          const key = r.obStamp || `${r.empname}-${r.obstart}-${r.obend}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const pending = unique.filter((r) => (r.obstatus || "") === "Pending");
        const nonPending = unique.filter((r) => (r.obstatus || "") !== "Pending");

        setPendingOBs(pending);
        setHistory(nonPending);
      } else {
        setPendingOBs([]);
        setHistory([]);
      }
    } catch (err) {
      console.error("Error fetching OB approvals:", err);
      setError("An error occurred while fetching OB approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOBApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empNo]);

  const handleReviewClick = (ob) => {
    setSelectedOB(ob);
    setShowModal(true);
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Official Business Approval</h1>
        </div>

        {/* PENDING */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Official Business Applications</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {pendingOBs.length > 0 ? (
              pendingOBs.map((ob, idx) => (
                <details
                  key={`p-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">
                        {ob.empname}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")} –{" "}
                        {dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")} •{" "}
                        {ob.duration} hr(s)
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-end text-xs gap-2">
                      <span className={badgeClass(ob.obstatus)}>{ob.obstatus}</span>
                      <button
                        className="text-[12px] bg-blue-500 text-white px-5 py-1 rounded-lg hover:bg-blue-600 transition"
                        onClick={() => handleReviewClick(ob)}
                      >
                        Review
                      </button>
                    </div>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Remarks">{ob.obRemarks || "N/A"}</Labeled>
                  </div>
                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">
                No pending Official Business applications.
              </div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-left whitespace-nowrap">Employee Name</th>
                  <th className="global-th text-right whitespace-nowrap">Duration</th>
                  <th className="global-th text-left whitespace-nowrap">Start</th>
                  <th className="global-th text-left whitespace-nowrap">End</th>
                  <th className="global-th text-left whitespace-nowrap">Remarks</th>
                  <th className="global-th text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {pendingOBs.length > 0 ? (
                  pendingOBs.map((ob, index) => (
                    <tr key={`p-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {ob.empname}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {ob.duration} hr(s)
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left">
                        {ob.obRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className="bg-blue-500 text-white px-4 py-0.5 rounded-lg hover:bg-blue-600 transition"
                          onClick={() => handleReviewClick(ob)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="6" className="p-2 text-center text-gray-500">
                      No pending Official Business applications.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Official Business Approval History</h2>

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {history.length > 0 ? (
              history.map((rec, idx) => (
                <details
                  key={`h-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">
                        {rec.empname}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dayjs(rec.obstart).format("MM/DD/YYYY hh:mm A")} –{" "}
                        {dayjs(rec.obend).format("MM/DD/YYYY hh:mm A")} •{" "}
                        {rec.duration} hr(s)
                      </span>
                    </div>
                    <span className={badgeClass(rec.obstatus)}>{rec.obstatus}</span>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Employee Remarks">{rec.obRemarks || "N/A"}</Labeled>
                    <Labeled label="Approver's Remarks">{rec.appRemarks || "N/A"}</Labeled>
                  </div>
                </details>
              ))
            ) : (
              <div className="py-4 text-center text-gray-500">
                No approved or disapproved records found.
              </div>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-left whitespace-nowrap">Employee Name</th>
                  <th className="global-th text-right whitespace-nowrap">Duration</th>
                  <th className="global-th text-left whitespace-nowrap">Start</th>
                  <th className="global-th text-left whitespace-nowrap">End</th>
                  <th className="global-th text-left whitespace-nowrap">Remarks</th>
                  <th className="global-th text-left whitespace-nowrap">Approver's Remarks</th>
                  <th className="global-th text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {history.length > 0 ? (
                  history.map((rec, index) => (
                    <tr key={`h-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {rec.empname}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {rec.duration} hr(s)
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(rec.obstart).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(rec.obend).format("MM/DD/YYYY hh:mm A")}
                      </td>
                      <td className="global-td-approval text-left">
                        {rec.obRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-left">
                        {rec.appRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center">
                        <span className={badgeClass(rec.obstatus)}>{rec.obstatus}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-3 text-center text-gray-500">
                      No approved or disapproved records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OB REVIEW MODAL */}
      {showModal && selectedOB && (
        <OBReview
          obData={selectedOB}
          onClose={() => {
            setShowModal(false);
            setSelectedOB(null);
            // Refresh lists after approve/disapprove/cancel
            fetchOBApprovals();
          }}
          // Keep these if your OBReview expects them (like your current version)
          pendingOBs={pendingOBs}
          setPendingOBs={setPendingOBs}
          setHistory={setHistory}
        />
      )}
    </div>
  );
};

export default OfficialBusinessApproval;
