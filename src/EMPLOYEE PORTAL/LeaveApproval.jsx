import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import LeaveReview from "./LeaveReview";
import API_ENDPOINTS from "@/apiConfig.jsx";

// ---- Shared UI helpers (same look/feel as Overtime) -------------------------
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

const LeaveApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLeaveApprovals = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = dayjs().format("YYYY-MM-DD");
      const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

      // --- PENDING -----------------------------------------------------------
      // Prefer a "LeaveHistoryApplication" endpoint (mirrors OT) if you have it.
      // Fallback: use approvedLeaveHistory and filter "Pending".
      const pendingResponse = await fetch(
        API_ENDPOINTS.LeaveHistoryApplication ?? API_ENDPOINTS.LeaveHistoryApplication,
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

      const pendingText = await pendingResponse.text();
      let pendingResult = JSON.parse(pendingText);

      if (pendingResult.success && pendingResult.data?.length > 0) {
        const all = JSON.parse(pendingResult.data[0].result) || [];
        const pendingOnly = all.filter((r) => (r.leaveStatus || "") === "Pending");
        setPendingLeaves(pendingOnly);
      } else {
        setPendingLeaves([]);
      }

      // --- HISTORY (Approved / Disapproved / Cancelled) ----------------------
      const historyResponse = await fetch(API_ENDPOINTS.approvedLeaveHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: startDate,
          END_DATE: today,
        }),
      });

      const historyResult = await historyResponse.json();
      if (historyResult.success && historyResult.data?.length > 0) {
        const parsed = JSON.parse(historyResult.data[0].result) || [];
        setHistory(parsed.filter((r) => (r.leaveStatus || "") !== "Pending"));
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Error fetching leave approvals:", err);
      setError("An error occurred while fetching leave approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.empNo) fetchLeaveApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empNo]);

  const handleReviewClick = (leave) => {
    setSelectedLeave(leave);
    setShowModal(true);
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Leave Approval</h1>
        </div>

        {/* PENDING */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Leave Applications</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}

          {/* Loading */}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {pendingLeaves.length > 0 ? (
              pendingLeaves.map((leave, idx) => (
                <details
                  key={`p-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">
                        {leave.empName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dayjs(leave.leaveStart).format("MM/DD/YYYY")} –{" "}
                        {dayjs(leave.leaveEnd).format("MM/DD/YYYY")} •{" "}
                        {leave.leaveDays} day(s)
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-end text-xs gap-2">
                      <span className={badgeClass(leave.leaveStatus)}>
                        {leave.leaveStatus}
                      </span>
                      <button
                        className="text-[12px] bg-blue-500 text-white px-5 py-1 rounded-lg hover:bg-blue-600 transition"
                        onClick={() => handleReviewClick(leave)}
                      >
                        Review
                      </button>
                    </div>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Leave Type">{leave.leaveCode}</Labeled>
                    <Labeled label="Hours">{leave.leaveHrs}</Labeled>
                    <Labeled label="Remarks">
                      {leave.leaveRemarks || "N/A"}
                    </Labeled>
                  </div>
                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">
                No pending leave applications.
              </div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg">
            <table className="min-w-full text-center text-sm lg:text-base border">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-left whitespace-nowrap">Employee Name</th>
                  <th className="global-th text-left whitespace-nowrap">Leave Start</th>
                  <th className="global-th text-left whitespace-nowrap">Leave End</th>
                  <th className="global-th text-right whitespace-nowrap">Days</th>
                  <th className="global-th text-right whitespace-nowrap">Hours</th>
                  <th className="global-th text-left whitespace-nowrap">Leave Type</th>
                  <th className="global-th text-left whitespace-nowrap">Remarks</th>
                  <th className="global-th text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {pendingLeaves.length > 0 ? (
                  pendingLeaves.map((leave, index) => (
                    <tr key={`p-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {leave.empName}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(leave.leaveStart).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(leave.leaveEnd).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {leave.leaveDays}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {leave.leaveHrs}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {leave.leaveCode}
                      </td>
                      <td className="global-td-approval text-left">
                        {leave.leaveRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className="bg-blue-500 text-white px-4 py-0.5 rounded-lg hover:bg-blue-600 transition"
                          onClick={() => handleReviewClick(leave)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="8" className="p-2 text-center text-gray-500">
                      No pending leave applications.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Leave Approval History</h2>

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
                        {rec.empName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dayjs(rec.leaveStart).format("MM/DD/YYYY")} –{" "}
                        {dayjs(rec.leaveEnd).format("MM/DD/YYYY")} • {rec.leaveDays} day(s)
                      </span>
                    </div>
                    <span className={badgeClass(rec.leaveStatus)}>{rec.leaveStatus}</span>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Leave Type">{rec.leaveCode}</Labeled>
                    <Labeled label="Hours">{rec.leaveHrs}</Labeled>
                    <Labeled label="Employee Remarks">{rec.leaveRemarks || "N/A"}</Labeled>
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
                  <th className="global-th text-left whitespace-nowrap">Leave Start</th>
                  <th className="global-th text-left whitespace-nowrap">Leave End</th>
                  <th className="global-th text-right whitespace-nowrap">Days</th>
                  <th className="global-th text-right whitespace-nowrap">Hours</th>
                  <th className="global-th text-left whitespace-nowrap">Leave Type</th>
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
                        {rec.empName}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(rec.leaveStart).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(rec.leaveEnd).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {rec.leaveDays}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">
                        {rec.leaveHrs}
                      </td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {rec.leaveCode}
                      </td>
                      <td className="global-td-approval text-left">
                        {rec.leaveRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-left">
                        {rec.appRemarks || "N/A"}
                      </td>
                      <td className="global-td-approval text-center">
                        <span className={badgeClass(rec.leaveStatus)}>{rec.leaveStatus}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="p-3 text-center text-gray-500">
                      No approved or disapproved records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <LeaveReview
            leaveData={selectedLeave}
            onClose={() => {
              setShowModal(false);
              setSelectedLeave(null);
              // Refresh after action (approve/disapprove/cancel)
              fetchLeaveApprovals();
            }}
            refreshData={fetchLeaveApprovals}
          />
        )}
      </div>
    </div>
  );
};

export default LeaveApproval;
