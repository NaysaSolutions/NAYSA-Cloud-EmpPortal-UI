import React from "react";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import API_ENDPOINTS from "@/apiConfig";

const OBReview = ({ obData, onClose, onApproved }) => {
  if (!obData) return null;

  const handleAction = async (status) => {
    const confirmation = await Swal.fire({
      title: `Are you sure you want to ${status} this OB request?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Yes, ${status}`,
    });

    if (!confirmation.isConfirmed) return;

    try {
      const payload = {
        EMP_NO: obData.empno,
        OB_ID: obData.obid,
        STATUS: status,
        REMARKS: "Approved via web", // You can make this dynamic if needed
      };

      const response = await fetch(API_ENDPOINTS.officialBusinessApproval, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        Swal.fire("Success", `OB has been ${status.toLowerCase()}d successfully.`, "success");
        onApproved(); // refresh list
        onClose();
      } else {
        Swal.fire("Error", "Failed to update OB status.", "error");
      }
    } catch (error) {
      console.error("Approval Error:", error);
      Swal.fire("Error", "Something went wrong. Please try again.", "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4 text-blue-600">Official Business Review</h2>
        <div className="space-y-2">
          <div><strong>Employee Name:</strong> {obData.empname}</div>
          <div><strong>Start:</strong> {dayjs(obData.obstart).format("MM/DD/YYYY hh:mm A")}</div>
          <div><strong>End:</strong> {dayjs(obData.obend).format("MM/DD/YYYY hh:mm A")}</div>
          <div><strong>Duration:</strong> {obData.duration} hr(s)</div>
          <div><strong>Reason:</strong> {obData.obRemarks || "N/A"}</div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => handleAction("Approved")}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
          >
            Approve
          </button>
          <button
            onClick={() => handleAction("Rejected")}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
          >
            Reject
          </button>
          <button
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OBReview;
