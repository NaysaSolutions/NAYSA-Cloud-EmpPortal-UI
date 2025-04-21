import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import LeaveReview from "./LeaveReview"; // Import modal component
import API_ENDPOINTS from "@/apiConfig.jsx";


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

        // Fetch All Leave Applications, then filter pending
        const pendingResponse = await fetch(API_ENDPOINTS.approvedLeaveHistory, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: startDate,
            END_DATE: "2030-01-01"
          }),
        });
        
        if (!pendingResponse.ok) {
          throw new Error("Failed to fetch leave approvals: " + pendingResponse.statusText);
        }
        

        const pendingText = await pendingResponse.text();
        let pendingResult;

        try {
          pendingResult = JSON.parse(pendingText);
        } catch (err) {
          throw new Error("Invalid JSON in leave response: " + pendingText);
        }

        console.log("Fetched Leave Applications:", pendingResult);

        if (pendingResult.success && pendingResult.data.length > 0) {
          const allLeaves = JSON.parse(pendingResult.data[0].result) || [];
const pendingOnly = allLeaves.filter((record) => {
  console.log(record.leaveStatus); // Check if leaveStatus is exactly "Pending"
  return record.leaveStatus === "Pending";
});
setPendingLeaves(pendingOnly);

        }

        // Fetch Leave Approval History
        const historyResponse = await fetch(API_ENDPOINTS.approvedLeaveHistory, { 
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

  const handleClose = () => {
    setSelectedLeave(null); // Close modal
  };

  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[260px] mt-[110px] p-4 sm:p-6 bg-gray-100 min-h-screen">

    <div className="mx-auto">
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold">Leave Approval</h1>
        </div>

{/* Pending Leave Table */}
<div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
  <h2 className="text-lg font-bold mb-4">Pending Leave Applications</h2>
  {error && <p className="text-red-500 text-center">{error}</p>}

  {/* Scrollable container */}
  <div className="overflow-x-auto max-h-[480px] overflow-y-auto relative">
    <table className="min-w-full text-center text-sm sm:text-xs md:text-sm lg:text-base border">
      <thead className="global-thead-approval">
        <tr className="border-b">
          <th className="global-th text-left whitespace-nowrap">Employee Name</th>
          {/* <th className="p-2">Department</th> */}
          <th className="global-th text-left whitespace-nowrap">Leave Start</th>
          <th className="global-th text-left whitespace-nowrap">Leave End</th>
          <th className="global-th text-right whitespace-nowrap">Days</th>
          <th className="global-th text-right whitespace-nowrap">Hours</th>
          <th className="global-th text-center whitespace-nowrap">Leave Type</th>
          <th className="global-th text-left whitespace-nowrap">Remarks</th>
          {/* <th className="global-th text-center whitespace-nowrap">Status</th> */}
          <th className="global-th text-center whitespace-nowrap">Action</th>
        </tr>
      </thead>
      <tbody classname="global-tbody">
        {pendingLeaves.length > 0 ? (
          pendingLeaves.map((leave, index) => (
            <tr key={index} className="global-tr">
              <td className="global-td-approval text-left whitespace-nowrap">{leave.empName}</td>
              {/* <td className="global-td-approval text-left">{leave.department || "N/A"}</td> */}
              <td className="global-td-approval text-left">{dayjs(leave.leaveStart).format("MM/DD/YYYY")}</td>
              <td className="global-td-approval text-left">{dayjs(leave.leaveEnd).format("MM/DD/YYYY")}</td>
              <td className="global-td-approval text-right">{leave.leaveDays}</td>
              <td className="global-td-approval text-right">{leave.leaveHrs}</td>
              <td className="global-td-approval text-center">{leave.leaveCode}</td>
              <td className="global-td-approval text-left">{leave.leaveRemarks}</td>
              {/* <td className="global-td-approval text-orange-500 font-bold">{leave.leaveStatus}</td> */}
              <td className="global-td-approval text-center">
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition"
                  onClick={() => setSelectedLeave(leave)}
                >
                  Review
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="10" className="p-2 text-center text-gray-500">
              No pending leave applications.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>


        {/* Leave Approval History Table */}
        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Leave Approval History</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="min-w-full text-center text-sm sm:text-xs md:text-sm lg:text-base border">
          <thead className="global-thead-approval">
              <tr className="border-b">
                <th className="global-th text-left whitespace-nowrap">Employee Name</th>
                {/* <th className="global-th">Department</th> */}
                <th className="global-th text-left whitespace-nowrap">Leave Start</th>
                <th className="global-th text-left whitespace-nowrap">Leave End</th>
                <th className="global-th text-right whitespace-nowrap">Days</th>
                <th className="global-th text-right whitespace-nowrap">Hours</th>
                <th className="global-th text-center whitespace-nowrap">Leave Type</th>
                <th className="global-th text-left whitespace-nowrap">Remarks</th>
                <th className="global-th text-left whitespace-nowrap">Approver's Remarks</th>
                <th className="global-th text-center whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody classname="global-tbody">
              {history.length > 0 ? (
                history.map((record, index) => (
                  <tr key={index} className="global-tr">
                    <td className="global-td-approval text-left whitespace-nowrap">{record.empName}</td>
                    {/* <td className="global-td-approval text-left">{record.department || "N/A"}</td> */}
                    <td className="global-td-approval text-left">{dayjs(record.leaveStart).format("MM/DD/YYYY")}</td>
                    <td className="global-td-approval text-left">{dayjs(record.leaveEnd).format("MM/DD/YYYY")}</td>
                    <td className="global-td-approval text-right">{record.leaveDays}</td>
                    <td className="global-td-approval text-right">{record.leaveHrs}</td>
                    <td className="global-td-approval text-center">{record.leaveCode}</td>
                    <td className="global-td-approval text-left">{record.leaveRemarks || "N/A"}</td>
                    <td className="global-td-approval text-left">{record.appRemarks || "N/A"}</td>
                    <td className={`global-td-approval text-center font-bold ${record.leaveStatus === "Approved" ? "text-blue-600" : "text-red-600"}`}>
                      {record.leaveStatus}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="p-2 text-center text-gray-500">
                    No approved or disapproved records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* Modal for Leave Review */}
      {selectedLeave && (
        <LeaveReview 
          leaveData={selectedLeave}  // Passing selectedLeave to the LeaveReview component
          onClose={handleClose} 
          pendingLeaves={pendingLeaves} 
          setPendingLeaves={setPendingLeaves} 
          setHistory={setHistory}
        />
      )}
    </div>
  );
};

export default LeaveApproval;
