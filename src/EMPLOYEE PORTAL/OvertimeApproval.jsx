import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import OvertimeReview from "./OvertimeReview";
import API_ENDPOINTS from "@/apiConfig.jsx";


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
    <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
    <div className="text-[13px] sm:text-sm font-medium text-slate-800">{children}</div>
  </div>
);

const OvertimeApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingOvertime, setPendingOvertime] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [selectedOvertime, setSelectedOvertime] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchOvertimeApprovals = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = dayjs().format("YYYY-MM-DD");
      const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

      // Pending
      const pendingResponse = await fetch(API_ENDPOINTS.OvertimeHistoryApplication, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: startDate,
          END_DATE: "2030-01-01",
        }),
      });

      const pendingText = await pendingResponse.text();
      let pendingResult = JSON.parse(pendingText);

      if (pendingResult.success && pendingResult.data.length > 0) {
        const allRecords = JSON.parse(pendingResult.data[0].result) || [];
        const pendingOnly = allRecords.filter((r) => r.otStatus === "Pending");
        setPendingOvertime(pendingOnly);
      } else {
        setPendingOvertime([]);
      }

      // History
      const historyResponse = await fetch(API_ENDPOINTS.approvedOvertimeHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo, START_DATE: startDate, END_DATE: today }),
      });

      const historyResult = await historyResponse.json();
      if (historyResult.success && historyResult.data.length > 0) {
        const parsed = JSON.parse(historyResult.data[0].result) || [];
        setHistory(parsed.filter((r) => r.otStatus !== "Pending"));
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Error fetching overtime approval data:", err);
      setError("An error occurred while fetching overtime approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.empNo) {
      fetchOvertimeApprovals();
    }
  }, [user?.empNo]);

  const handleReviewClick = (overtime) => {
    setSelectedOvertime(overtime);
    setShowModal(true);
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Overtime Approval</h1>
        </div>

        {/* Pending Overtime */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Overtime Applications</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}

          {/* Loading State */}
          {loading && (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          )}

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {pendingOvertime.length > 0 ? (
              pendingOvertime.map((overtime, idx) => (
                <details
                  key={`p-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">{overtime.empName}</span>
                      <span className="text-xs text-slate-500">
                        {dayjs(overtime.otDate).format("MM/DD/YYYY")} • {overtime.otHrs} hr(s)
                      </span>
                    </div>
                   <div className="mt-3 flex flex-col items-end text-xs gap-2">
                      <span className={badgeClass(overtime.otStatus)}>
                        {overtime.otStatus}
                      </span>
                      <button
                        className="text-[12px] bg-blue-500 text-white px-5 py-1 rounded-lg hover:bg-blue-600 transition"
                        onClick={() => handleReviewClick(overtime)}
                      >
                        Review
                      </button>
                    </div>

                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="OT Type">{overtime.otDesc}</Labeled>
                    <Labeled label="Remarks">{overtime.otRemarks || "N/A"}</Labeled>
                  </div>

                </details>
              ))
            ) : !loading ? (
              <div className="py-4 text-center text-gray-500">No pending overtime applications.</div>
            ) : null}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block w-full overflow-x-auto max-h-[450px] overflow-y-auto relative rounded-lg ">
            <table className="min-w-full text-center text-sm lg:text-base border ">
              <thead className="global-thead-approval sticky top-0 z-10">
                <tr className="border-b">
                  <th className="global-th text-left whitespace-nowrap">Employee Name</th>
                  <th className="global-th text-left whitespace-nowrap">OT Date</th>
                  <th className="global-th text-right whitespace-nowrap">No. of Hours</th>
                  <th className="global-th text-left whitespace-nowrap">OT Type</th>
                  <th className="global-th text-left whitespace-nowrap">Remarks</th>
                  <th className="global-th text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {pendingOvertime.length > 0 ? (
                  pendingOvertime.map((overtime, index) => (
                    <tr key={`p-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-left whitespace-nowrap">{overtime.empName}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(overtime.otDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">{overtime.otHrs} hr(s)</td>
                      <td className="global-td-approval text-left whitespace-nowrap">{overtime.otDesc}</td>
                      <td className="global-td-approval text-left">{overtime.otRemarks || "N/A"}</td>
                      <td className="global-td-approval text-center whitespace-nowrap">
                        <button
                          className="bg-blue-500 text-white px-4 py-0.5 rounded-lg hover:bg-blue-600 transition"
                          onClick={() => handleReviewClick(overtime)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan="6" className="p-2 text-center text-gray-500">
                      No pending overtime applications.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overtime Approval History */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Overtime Approval History</h2>

          {/* Mobile: Cards / Accordion */}
          <div className="block md:hidden space-y-3">
            {history.length > 0 ? (
              history.map((record, idx) => (
                <details
                  key={`h-mobile-${idx}`}
                  className="group rounded-xl border border-slate-200 p-3 open:shadow-sm"
                >
                  <summary className="list-none flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-800">{record.empName}</span>
                      <span className="text-xs text-slate-500">
                        {dayjs(record.otDate).format("MM/DD/YYYY")} • {record.appHrs} hr(s)
                      </span>
                    </div>
                    <span className={badgeClass(record.otStatus)}>{record.otStatus}</span>
                  </summary>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="OT Type">{record.otDesc}</Labeled>
                    <Labeled label="Employee Remarks">{record.otRemarks || "N/A"}</Labeled>
                    <Labeled label="Approver's Remarks">{record.appRemarks || "N/A"}</Labeled>
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
                  <th className="global-th text-left whitespace-nowrap">OT Date</th>
                  <th className="global-th text-right whitespace-nowrap">Approved Hours</th>
                  <th className="global-th text-left whitespace-nowrap">OT Type</th>
                  <th className="global-th text-left whitespace-nowrap">Remarks</th>
                  <th className="global-th text-left whitespace-nowrap">Approver's Remarks</th>
                  <th className="global-th text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {history.length > 0 ? (
                  history.map((record, index) => (
                    <tr key={`h-desktop-${index}`} className="global-tr">
                      <td className="global-td-approval text-left whitespace-nowrap">{record.empName}</td>
                      <td className="global-td-approval text-left whitespace-nowrap">
                        {dayjs(record.otDate).format("MM/DD/YYYY")}
                      </td>
                      <td className="global-td-approval text-right whitespace-nowrap">{record.appHrs} hr(s)</td>
                      <td className="global-td-approval text-left whitespace-nowrap">{record.otDesc}</td>
                      <td className="global-td-approval text-left">{record.otRemarks || "N/A"}</td>
                      <td className="global-td-approval text-left">{record.appRemarks || "N/A"}</td>
                      <td className={`global-td-approval ${badgeClass(record.otStatus)}`}>
                        {record.otStatus}
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

        {/* Modal */}
        {showModal && (
          <OvertimeReview
            overtimeData={selectedOvertime}
            onClose={() => {
              setShowModal(false);
              fetchOvertimeApprovals();
            }}
            refreshData={fetchOvertimeApprovals}
          />
        )}
      </div>
    </div>
  );
};

export default OvertimeApproval;
