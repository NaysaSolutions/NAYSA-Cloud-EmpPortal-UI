import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import LeaveReview from "./LeaveReview"; // Import modal component

const LeaveApproval = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);

  useEffect(() => {
    if (!user || !user.empNo) return;

    const fetchLeaveApprovals = async () => {
      try {
        const today = dayjs().format("YYYY-MM-DD");
        const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

        // Fetch Pending Leave Applications
        const pendingResponse = await fetch("http://127.0.0.1:8000/api/getLVApprInq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ EMP_NO: user.empNo, STAT: "Pending" }),
        });

        const pendingResult = await pendingResponse.json();
        console.log("Fetched Pending Leave Applications:", pendingResult);

        if (pendingResult.success && pendingResult.data.length > 0) {
          setPendingLeaves(JSON.parse(pendingResult.data[0].result) || []);
        }

        // Fetch Leave Approval History
        const historyResponse = await fetch("http://127.0.0.1:8000/api/getLVApprHistory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ EMP_NO: user.empNo, START_DATE: startDate, END_DATE: today }),
        });

        const historyResult = await historyResponse.json();
        console.log("Fetched Leave Approval History:", historyResult);

        if (historyResult.success && historyResult.data.length > 0) {
          const parsedHistoryData = JSON.parse(historyResult.data[0].result);
          setHistory(parsedHistoryData.filter((record) => record.leaveStatus !== "Pending") || []);
        }
      } catch (err) {
        console.error("Error fetching leave approvals:", err);
        setError("An error occurred while fetching leave approvals.");
      }
    };

    fetchLeaveApprovals();
  }, [user]);

  return (
    <div className="ml-80 mt-[120px] p-6 bg-gray-100 min-h-screen">
      <div className="w-[1150px]">
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold">Leave Approval</h1>
        </div>

        {/* Pending Leave Table */}
        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Leave Applications</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}
          <table className="w-full border-collapse text-center">
            <thead className="bg-gray-100">
              <tr className="border-b">
                <th className="p-2">EMPLOYEE NAME</th>
                <th className="p-2">DEPARTMENT</th>
                <th className="p-2">LEAVE START</th>
                <th className="p-2">LEAVE END</th>
                <th className="p-2">DURATION (Days)</th>
                <th className="p-2">DURATION (Hours)</th>
                <th className="p-2">APPLICATION TYPE</th>
                <th className="p-2">REMARKS</th>
                <th className="p-2">STATUS</th>
                <th className="p-2">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pendingLeaves.length > 0 ? (
                pendingLeaves.map((leave, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{leave.empName}</td>
                    <td className="p-2">{leave.department || "N/A"}</td>
                    <td className="p-2">{dayjs(leave.leaveStart).format("MM/DD/YYYY")}</td>
                    <td className="p-2">{dayjs(leave.leaveEnd).format("MM/DD/YYYY")}</td>
                    <td className="p-2">{leave.leaveDays}</td>
                    <td className="p-2">{leave.leaveHrs} HRS</td>
                    <td className="p-2">{leave.leaveCode}</td>
                    <td className="p-2">{leave.leaveRemarks}</td>
                    <td className="p-2 text-orange-500 font-bold">{leave.leaveStatus}</td>
                    <td className="p-2">
                    <button
  className="bg-blue-500 text-white px-3 py-1 rounded"
  onClick={() => {
    console.log("Selected Leave for Review:", leave);
    setSelectedLeave(leave);
  }}
>
  Review
</button>

                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="p-2 text-center text-gray-500">No pending leave applications.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Leave Approval History Table */}
        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Leave Approval History</h2>
          <table className="w-full border-collapse text-center">
            <thead className="bg-gray-100">
              <tr className="border-b">
                <th className="p-2">EMPLOYEE NAME</th>
                <th className="p-2">DEPARTMENT</th>
                <th className="p-2">LEAVE START</th>
                <th className="p-2">LEAVE END</th>
                <th className="p-2">DURATION (Days)</th>
                <th className="p-2">DURATION (Hours)</th>
                <th className="p-2">APPLICATION TYPE</th>
                <th className="p-2">REMARKS</th>
                <th className="p-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? (
                history.map((record, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{record.empName}</td>
                    <td className="p-2">{record.department || "N/A"}</td>
                    <td className="p-2">{dayjs(record.leaveStart).format("MM/DD/YYYY")}</td>
                    <td className="p-2">{dayjs(record.leaveEnd).format("MM/DD/YYYY")}</td>
                    <td className="p-2">{record.leaveDays}</td>
                    <td className="p-2">{record.leaveHrs} HRS</td>
                    <td className="p-2">{record.leaveCode}</td>
                    <td className="p-2">{record.leaveRemarks || "N/A"}</td>
                    <td className={`p-2 font-bold ${record.leaveStatus === "Approved" ? "text-green-500" : "text-red-500"}`}>
                      {record.leaveStatus}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-2 text-center text-gray-500">No approved or disapproved records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal for Leave Review */}
      {selectedLeave && (
        <LeaveReview leaveData={selectedLeave} onClose={() => setSelectedLeave(null)} />
      )}
    </div>
  );
};

export default LeaveApproval;
