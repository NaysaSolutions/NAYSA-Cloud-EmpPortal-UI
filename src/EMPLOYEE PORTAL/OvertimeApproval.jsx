import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import OvertimeReview from "./OvertimeReview";
import API_ENDPOINTS from "@/apiConfig.jsx";

const OvertimeApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingOvertime, setPendingOvertime] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [selectedOvertime, setSelectedOvertime] = useState(null);
  const [showModal, setShowModal] = useState(false);


    const fetchOvertimeApprovals = async () => {
      try {
        const today = dayjs().format("YYYY-MM-DD");
        const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");
    
        const pendingResponse = await fetch(API_ENDPOINTS.OvertimeHistoryApplication, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            EMP_NO: user.empNo,
            START_DATE: startDate,
            END_DATE: "2030-01-01"
          }),
        });
    
        const pendingText = await pendingResponse.text();
        let pendingResult = JSON.parse(pendingText);
    
        if (pendingResult.success && pendingResult.data.length > 0) {
          const allRecords = JSON.parse(pendingResult.data[0].result) || [];
          const pendingOnly = allRecords.filter((record) => record.otStatus === "Pending");
          setPendingOvertime(pendingOnly);
        }
    
        const historyResponse = await fetch(API_ENDPOINTS.approvedOvertimeHistory, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ EMP_NO: user.empNo, START_DATE: startDate, END_DATE: today }),
        });
    
        const historyResult = await historyResponse.json();
        if (historyResult.success && historyResult.data.length > 0) {
          setHistory(
            JSON.parse(historyResult.data[0].result).filter((record) => record.otStatus !== "Pending") || []
          );
        }
    
      } catch (err) {
        console.error("Error fetching overtime approval data:", err);
        setError("An error occurred while fetching overtime approvals.");
      }
    };
    useEffect(() => {
      if (user && user.empNo) {
        fetchOvertimeApprovals();
      }
    }, [user]);
    

  const handleReviewClick = (overtime) => {
    setSelectedOvertime(overtime);
    setShowModal(true);
  };

  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[260px] mt-[110px] p-4 sm:p-6 bg-gray-100 min-h-screen">

    <div className="mx-auto">
    <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold">Overtime Approval</h1>
        </div>

        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Overtime Applications</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}

  {/* Scrollable container */}
  <div className="w-full overflow-x-auto max-h-[450px] overflow-y-auto relative">
  <table className="min-w-full text-center text-sm sm:text-xs md:text-sm lg:text-base border">
          <thead className="global-thead-approval">
          <tr className="border-b">
              <th className="global-th text-left whitespace-nowrap">Employee Name</th>
                {/* <th className="global-th text-left">Department</th> */}
                <th className="global-th text-left whitespace-nowrap">OT Date</th>
                {/* <th className="global-th">DURATION (Days)</th> */}
                <th className="global-th text-right whitespace-nowrap">No. of Hours</th>
                <th className="global-th text-left whitespace-nowrap">OT Type</th>
                <th className="global-th text-left whitespace-nowrap">Remarks</th>
                {/* <th className="global-th text-left whitespace-nowrap">Status</th> */}
                <th className="global-th text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody classname="global-tbody">
              {pendingOvertime.length > 0 ? (
                pendingOvertime.map((overtime, index) => (
                  <tr key={index} className="global-tr">
                    <td className="global-td-approval text-left whitespace-nowrap">{overtime.empName}</td>
                    {/* <td className="global-td-approval text-left whitespace-nowrap">{overtime.department || "N/A"}</td> */}
                    <td className="global-td-approval text-left whitespace-nowrap">{dayjs(overtime.otDate).format("MM/DD/YYYY")}</td>
                    {/* <td className="global-td-approval text-left whitespace-nowrap">{overtime.otDay}</td> */}
                    <td className="global-td-approval text-right whitespace-nowrap">{overtime.otHrs} hr(s)</td>
                    <td className="global-td-approval text-left whitespace-nowrap">{overtime.otDesc}</td>
                    <td className="global-td-approval text-left">{overtime.otRemarks || "N/A"}</td>
                    {/* <td className="global-td-approval text-left text-orange-500 font-bold whitespace-nowrap">{overtime.otStatus}</td> */}
                    
                    <td className="text-center whitespace-nowrap">
                      <button
                        className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition"
                        onClick={() => handleReviewClick(overtime)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="p-2 text-center text-gray-500">
                    No pending overtime applications.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Overtime Approval History Table */}
        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg overflow-x-auto">
          <h2 className="text-lg font-bold mb-4">Overtime Approval History</h2>
  <div className="w-full overflow-x-auto max-h-[450px] overflow-y-auto relative">
  <table className="min-w-full text-center text-sm sm:text-xs md:text-sm lg:text-base border">
          <thead className="global-thead-approval">
          <tr className="border-b">
                <th className="global-th text-left whitespace-nowrap">Employee Name</th>
                {/* <th className="global-th text-left">Department</th> */}
                <th className="global-th text-left whitespace-nowrap">OT Date</th>
                {/* <th className="global-th text-left">DURATION (Days)</th> */}
                <th className="global-th text-right whitespace-nowrap">No. of Hours</th>
                <th className="global-th text-left whitespace-nowrap">OT Type</th>
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
                    {/* <td className="global-td-approval text-left whitespace-nowrap">{record.department || "N/A"}</td> */}
                    <td className="global-td-approval text-left whitespace-nowrap">{dayjs(record.otDate).format("MM/DD/YYYY")}</td>
                    {/* <td className="global-td-approval text-left whitespace-nowrap">{record.otDay}</td> */}
                    <td className="global-td-approval text-right whitespace-nowrap">{record.otHrs} hr(s)</td>
                    <td className="global-td-approval text-left whitespace-nowrap">{record.otDesc}</td>
                    <td className="global-td-approval text-left">{record.otRemarks || "N/A"}</td>
                    <td className="global-td-approval text-left">{record.appRemarks || "N/A"}</td>
                    <td className={`global-td-approval text-center font-bold whitespace-nowrap ${record.otStatus === "Approved" ? "text-blue-600" : "text-red-600"}`}>{record.otStatus}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-3 text-center text-gray-500">No approved or disapproved records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
      {showModal && (
  <OvertimeReview
  overtimeData={selectedOvertime}
  onClose={() => {
    setShowModal(false);
    fetchOvertimeApprovals(); // ✅ This will now work
  }}
  refreshData={fetchOvertimeApprovals}
/>
)}
    </div>
  );
};

export default OvertimeApproval;
