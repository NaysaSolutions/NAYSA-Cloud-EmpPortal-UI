import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import OBReview from "./OBReview.jsx";
import API_ENDPOINTS from "@/apiConfig.jsx";

const OfficialBusinessApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingOBs, setPendingOBs] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [selectedOB, setSelectedOB] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchOBApprovals = async () => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

    const body = JSON.stringify({
      EMP_NO: user.empNo,
      START_DATE: startDate,
      END_DATE: "2030-01-01",
    });

    const response = await fetch(API_ENDPOINTS.approvedOfficialBusinessHistory, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = await response.json();
    if (data.success && data.data.length > 0) {
      const parsed = JSON.parse(data.data[0].result) || [];

      // Filter Pending and History
      const pending = parsed.filter((record) => record.obstatus === "Pending");
      const historyRecords = parsed.filter((record) => record.obstatus !== "Pending");

      // Remove duplicates
      const getUniqueRecords = (array, keyFn) => {
        const seen = new Set();
        return array.filter((item) => {
          const key = keyFn(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const uniquePending = getUniqueRecords(
        pending,
        (item) => `${item.empname}-${item.obstart}-${item.obend}`
      );
      const uniqueHistory = getUniqueRecords(
        historyRecords,
        (item) => `${item.empname}-${item.obstart}-${item.obend}`
      );

      setPendingOBs(uniquePending);
      setHistory(uniqueHistory);
    }
  } catch (err) {
    console.error("Error fetching OB approvals:", err);
    setError("An error occurred while fetching OB approvals.");
  }
};

  // Add this useEffect to refresh data when modal closes
useEffect(() => {
  if (!showModal && user?.empNo) {
    fetchOBApprovals();
  }
}, [showModal, user]);

  const handleReviewClick = (ob) => {
    setSelectedOB(ob);
    setShowModal(true);
  };

  return (
    <div className="ml-0 lg:ml-[260px] mt-[110px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold">Official Business Approval</h1>
        </div>

        {/* PENDING OBs */}
        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Official Business Applications</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}
          <div className="overflow-x-auto max-h-[450px] overflow-y-auto relative">
            <table className="min-w-full text-sm text-center border">
              <thead className="global-thead-approval">
                <tr>
                  <th className="global-th text-left">Employee Name</th>
                  <th className="global-th text-center">Duration</th>
                  <th className="global-th text-left">Start Date</th>
                  <th className="global-th text-left">End Date</th>
                  <th className="global-th text-left">Remarks</th>
                  <th className="global-th text-center">Action</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {pendingOBs.length > 0 ? (
                  pendingOBs.map((ob, index) => (
                    <tr key={index} className="global-tr">
                      <td className="global-td-approval text-left">{ob.empname}</td>
                      <td className="global-td-approval text-center">{ob.duration} hr(s)</td>
                      <td className="global-td-approval text-left">{dayjs(ob.obstart).format("MM/DD/YYYY hh:mm A")}</td>
                      <td className="global-td-approval text-left">{dayjs(ob.obend).format("MM/DD/YYYY hh:mm A")}</td>
                      <td className="global-td-approval text-left">{ob.obRemarks || "N/A"}</td>
                      <td className="global-td-approval text-center">
                        <button
                          className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600"
                          onClick={() => handleReviewClick(ob)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center text-gray-500 p-3">
                      No pending Official Business applications.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Official Business Approval History</h2>
          <div className="overflow-x-auto max-h-[450px] overflow-y-auto relative">
            <table className="min-w-full text-sm text-center border">
              <thead className="global-thead-approval">
                <tr>
                  <th className="global-th text-left">Employee Name</th>
                  <th className="global-th text-left">Duration</th>
                  <th className="global-th text-left">Start Date</th>
                  <th className="global-th text-left">End Date</th>
                  <th className="global-th text-left">Remarks</th>
                  <th className="global-th text-left">Approver's Remarks</th>
                  <th className="global-th text-left">Status</th>
                </tr>
              </thead>
              <tbody className="global-tbody">
                {history.length > 0 ? (
                  history.map((record, index) => (
                    <tr key={index} className="global-tr">
                      <td className="global-td-approval text-left">{record.empname}</td>
                      <td className="global-td-approval text-left">{record.duration} hr(s)</td>
                      <td className="global-td-approval text-left">{dayjs(record.obstart).format("MM/DD/YYYY hh:mm A")}</td>
                      <td className="global-td-approval text-left">{dayjs(record.obend).format("MM/DD/YYYY hh:mm A")}</td>
                      <td className="global-td-approval text-left">{record.obRemarks || "N/A"}</td>
                      <td className="global-td-approval text-left">{record.appRemarks || "N/A"}</td>
                      <td
                        className={`global-td-approval text-left font-bold ${
                          record.obstatus === "Approved" ? "text-blue-600" : "text-red-600"
                        }`}
                      >
                        {record.obstatus}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center text-gray-500 p-3">
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
          }}
          pendingOBs={pendingOBs}
          setPendingOBs={setPendingOBs}
          setHistory={setHistory}
        />
      )}
    </div>
  );
};

export default OfficialBusinessApproval;
