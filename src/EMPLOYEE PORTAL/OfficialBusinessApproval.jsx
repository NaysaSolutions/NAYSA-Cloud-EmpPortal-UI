import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";
import OBReview from "./OBReview.jsx"; 
import API_ENDPOINTS from "@/apiConfig.jsx";


const OfficialBusinessApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingOvertime, setPendingOvertime] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [selectedOB, setselectedOB] = useState(null);
  const [showModal, setShowModal] = useState(false);



//     const fetchOBApprovals = async () => {
//   try {
//     const today = dayjs().format("YYYY-MM-DD");
//     const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

//     // ✅ Step 1: Build JSON payload for approval inquiry
//     const approvalPayload = {
//       json_data: JSON.stringify({
//         json_data: {
//           EMP_NO: user.empNo,
//           START_DATE: startDate,
//           END_DATE: "2030-01-01",
//         },
//       }),
//     };

//     // ✅ Step 2: Send to approval endpoint
//     const pendingResponse = await fetch(API_ENDPOINTS.approvedOfficialBusinessHistory, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(approvalPayload),
//     });

//     const pendingText = await pendingResponse.text();
//     const pendingResult = JSON.parse(pendingText);


//         console.log("Fetched Leave Applications:", pendingResult);

//     if (
//       pendingResult.status === "success" &&
//       pendingResult.data &&
//       pendingResult.data.length > 0
//     ) {
//       const allRecords = JSON.parse(pendingResult.data[0].result) || [];
//       const pendingOnly = allRecords.filter((record) => record.obstatus === "Pending");
//       setPendingOvertime(pendingOnly);
//       // setPendingOvertime(allRecords);
//     }

//     // ✅ Step 3: Send to history endpoint
//     const historyPayload = {
//       EMP_NO: user.empNo,
//       START_DATE: startDate,
//       END_DATE: today,
//     };

//     const historyResponse = await fetch(API_ENDPOINTS.approvedOfficialBusinessHistory, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(historyPayload),
//     });

//     const historyResult = await historyResponse.json();

//     if (historyResult.success && historyResult.data.length > 0) {
//       const historyRecords = JSON.parse(historyResult.data[0].result) || [];
//       const nonPending = historyRecords.filter((record) => record.obstatus !== "Pending");
//       setHistory(nonPending);
//     }
//   } catch (err) {
//     console.error("Error fetching official business approval data:", err);
//     setError("An error occurred while fetching OB approvals.");
//   }
// };

//     useEffect(() => {
//   if (user && user.empNo) {
//     fetchOBApprovals();
//   }
// }, [user]);

 useEffect(() => {
    if (!user || !user.empNo) return;

    
const fetchOBApprovals = async () => {
      try {
        const today = dayjs().format("YYYY-MM-DD");
        const startDate = dayjs().subtract(1, "year").format("YYYY-MM-DD");

        // Fetch All Leave Applications, then filter pending
        const pendingResponse = await fetch(API_ENDPOINTS.approvedOfficialBusinessHistory, {
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
  console.log(record.obstatus); // Check if leaveStatus is exactly "Pending"
  return record.obstatus === "Pending";
});
setPendingOvertime(pendingOnly);

        }

        // Fetch Leave Approval History
        const historyResponse = await fetch(API_ENDPOINTS.approvedOfficialBusinessHistory, { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ EMP_NO: user.empNo, START_DATE: startDate, END_DATE: today }),
        });

        const historyResult = await historyResponse.json();
        console.log("Fetched Leave Approval History:", historyResult);

        if (historyResult.success && historyResult.data.length > 0) {
          const parsedHistoryData = JSON.parse(historyResult.data[0].result);
          setHistory(parsedHistoryData.filter((record) => record.obstatus !== "Pending") || []);
        }
      } catch (err) {
        console.error("Error fetching leave approvals:", err);
        setError("An error occurred while fetching leave approvals.");
      }
    };

    fetchOBApprovals();
  }, [user]);

  const handleClose = () => {
    setSelectedLeave(null); // Close modal
  };


  const handleReviewClick = (OB) => {
    setselectedOB(OB);
    setShowModal(true);
  };

  return (
    <div className="ml-0 sm:ml-0 md:ml-0 lg:ml-[260px] mt-[110px] p-4 sm:p-6 bg-gray-100 min-h-screen">

    <div className="mx-auto">
    <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold">Official Business Approval</h1>
        </div>

        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Official Business Applications</h2>
          {error && <p className="text-red-500 text-center">{error}</p>}

  {/* Scrollable container */}
  <div className="w-full overflow-x-auto max-h-[450px] overflow-y-auto relative">
  <table className="min-w-full text-center text-sm sm:text-xs md:text-sm lg:text-base border">
  <thead className="global-thead-approval">
    <tr className="border-b">
      <th className="global-th text-left whitespace-nowrap">Employee Name</th>
      <th className="global-th text-center whitespace-nowrap">Duration</th>
      <th className="global-th text-left whitespace-nowrap">Start Date</th>
      <th className="global-th text-left whitespace-nowrap">End Date</th>
      <th className="global-th text-left whitespace-nowrap">Remarks</th>
      <th className="global-th text-center whitespace-nowrap">Action</th>
    </tr>
  </thead>
  <tbody className="global-tbody">
    {pendingOvertime.length > 0 ? (
      pendingOvertime.map((record, index) => (
        <tr key={index} className="global-tr">
          <td className="global-td-approval text-left whitespace-nowrap">{record.empname}</td>
          <td className="global-td-approval text-center whitespace-nowrap">{record.duration} hr(s)</td>
          <td className="global-td-approval text-left whitespace-nowrap">{dayjs(record.obstart).format("MM/DD/YYYY hh:mm A")}</td>
          <td className="global-td-approval text-left whitespace-nowrap">{dayjs(record.obend).format("MM/DD/YYYY hh:mm A")}</td>
          <td className="global-td-approval text-left whitespace-nowrap">{record.obRemarks || "N/A"}</td>
          <td className="global-td-approval text-center whitespace-nowrap">
            <button
              className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition"
              onClick={() => handleReviewClick(record)}
            >
              Review
            </button>
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan="6" className="p-2 text-center text-gray-500">
          No pending Official Business applications.
        </td>
      </tr>
    )}
  </tbody>
</table>

          </div>
        </div>

        {/* Overtime Approval History Table */}
        <div className="mt-6 bg-white p-4 shadow-lg rounded-lg overflow-x-auto">
          <h2 className="text-lg font-bold mb-4">Official Business Approval History</h2>
  <div className="w-full overflow-x-auto max-h-[450px] overflow-y-auto relative">
  <table className="min-w-full text-center text-sm sm:text-xs md:text-sm lg:text-base border">
  <thead className="global-thead-approval">
    <tr className="border-b">
      <th className="global-th text-left whitespace-nowrap">Employee Name</th>
      <th className="global-th text-left whitespace-nowrap">Duration</th>
      <th className="global-th text-left whitespace-nowrap">Start Date</th>
      <th className="global-th text-left whitespace-nowrap">End Date</th>
      <th className="global-th text-left whitespace-nowrap">Remarks</th>
      <th className="global-th text-left whitespace-nowrap">Approver's Remarks</th>
      <th className="global-th text-left whitespace-nowrap">Status</th>
    </tr>
  </thead>
  <tbody className="global-tbody">
    {history.length > 0 ? (
      history.map((record, index) => (
        <tr key={index} className="global-tr">
          <td className="global-td-approval text-left whitespace-nowrap">{record.empname}</td>
          <td className="global-td-approval text-left whitespace-nowrap">{record.duration} hr(s)</td>
          <td className="global-td-approval text-left whitespace-nowrap">{dayjs(record.obstart).format("MM/DD/YYYY hh:mm A")}</td>
          <td className="global-td-approval text-left whitespace-nowrap">{dayjs(record.obend).format("MM/DD/YYYY hh:mm A")}</td>
          <td className="global-td-approval text-left">{record.obRemarks || "N/A"}</td>
          <td className="global-td-approval text-left">{record.appRemarks || "N/A"}</td>
          <td className={`global-td-approval text-left font-bold whitespace-nowrap ${record.obstatus === "Approved" ? "text-blue-600" : "text-red-600"}`}>
            {record.obstatus}
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
      {showModal && (
  <OBReview
  overtimeData={selectedOB}
  onClose={() => {
    setShowModal(false);
    fetchOBApprovals(); // ✅ This will now work
  }}
  refreshData={fetchOBApprovals}
/>
)}
    </div>
  );
};

export default OfficialBusinessApproval;
