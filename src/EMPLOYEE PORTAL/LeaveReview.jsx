import React, { useState } from "react";
import { X } from "lucide-react";

const LeaveReview = ({ leaveData, onClose }) => {
  if (!leaveData) return null; // Ensure data exists before rendering

  const formatDate = (date) => {
    if (!date) return ""; // Ensure it's not null/undefined
    const d = new Date(date);
    return d.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
  };
  
  const [formData, setFormData] = useState({
    empNo: leaveData.empNo || "",
    empName: leaveData.empName || "",
    department: leaveData.department || "N/A",
    leaveStart: formatDate(leaveData.leaveStart), // ✅ Convert date format
    leaveEnd: formatDate(leaveData.leaveEnd), // ✅ Convert date format
    leaveDays: leaveData.leaveDays || "",
    leaveHrs: leaveData.leaveHrs || "",
    leaveCode: leaveData.leaveCode || "",
    leaveRemarks: leaveData.leaveRemarks || "",
    approverRemarks: leaveData.approverRemarks || "",
    approvedDays: leaveData.approvedDays || "",
    approvedHrs: leaveData.approvedHrs || "",
    lvStamp: leaveData.lvStamp || "", // ✅ Include lvStamp
  });
  
  // Handle input change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleApprove = async () => {
    try {
      if (!formData.lvStamp) {
        console.error("Error: lvStamp is missing!");
        alert("Error: lvStamp is missing. Please try again.");
        return;
      }
  
      // Correct JSON format: wrapping json_data around the actual approval details
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            empNo: formData.empNo,
            appRemarks: formData.approverRemarks,
            appDays: parseFloat(formData.approvedDays) || 0,
            appHrs: parseFloat(formData.approvedHrs) || 0,
            lvStamp: formData.lvStamp, // ✅ Ensure lvStamp is included
            appStat: 1, // Status for approved
          }
        }),
      };
  
      console.log("Sending approval data:", payload);
  
      const response = await fetch("http://127.0.0.1:8000/api/approvalLV", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
  
      const result = await response.json();
  
      if (response.ok) {
        alert("Approval successful!");
        onClose();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error("Approval failed:", error);
      alert("Failed to send approval. Please try again.");
    }
  };
  
  
  const handleDisapprove = async () => {
    try {
      if (!formData.lvStamp) {
        console.error("Error: lvStamp is missing!");
        alert("Error: lvStamp is missing. Please try again.");
        return;
      }
  
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            empNo: formData.empNo,
            appRemarks: formData.approverRemarks,
            lvStamp: formData.lvStamp, // Ensure lvStamp is included
            appStat: 0, // Status for disapproved
          }
        }),
      };
  
      console.log("Sending disapproval data:", payload);
  
      const response = await fetch("http://127.0.0.1:8000/api/approvalLV", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
  
      const result = await response.json();
  
      if (response.ok) {
        alert("Leave disapproved successfully!");
        onClose();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error("Disapproval failed:", error);
      alert("Failed to send disapproval. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[9999]">
  <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full relative">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900">
          <X size={24} />
        </button>
    <h2 className="text-2xl font-bold mb-5 uppercase">Leave Review</h2>

        {/* Grid Layout for Inputs */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium uppercase">Employee Name:</label>
              <input
                type="text"
                name="empName"
                value={formData.empName}
                className="w-full border rounded p-2"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium uppercase">Department:</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                className="w-full border rounded p-2"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium uppercase">Leave Start:</label>
              <input
                type="date"
                name="leaveStart"
                value={formData.leaveStart}
                className="w-full border rounded p-2"
                disabled
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium uppercase">Number of Days:</label>
              <input
                type="number"
                name="leaveDays"
                value={formData.leaveDays}
                className="w-full border rounded p-2"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium uppercase">Number of Hours:</label>
              <input
                type="number"
                name="leaveHrs"
                value={formData.leaveHrs}
                className="w-full border rounded p-2"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium uppercase">Leave End:</label>
              <input
                type="date"
                name="leaveEnd"
                value={formData.leaveEnd}
                className="w-full border rounded p-2"
                disabled
              />
            </div>
          </div>
        </div>

        {/* Full-Width Text Areas */}
        <div className="mt-4">
          <label className="block text-sm font-medium uppercase">Remarks:</label>
          <textarea
            name="leaveRemarks"
            value={formData.leaveRemarks}
            onChange={handleChange}
            className="w-full border rounded p-2"
            disabled
            required
          />
        </div>
        <hr  className="mt-5 mb-5"/>

        {/* Approved Days & Approved Hours (Side by Side) */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-sm font-medium uppercase">Approved Days:</label>
            <input
              type="number"
              name="approvedDays"
              value={formData.approvedDays}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium uppercase">Approved Hours:</label>
            <input
              type="number"
              name="approvedHrs"
              value={formData.approvedHrs}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium uppercase">Approver Remarks:</label>
          <textarea
            name="approverRemarks"
            value={formData.approverRemarks}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
      

        {/* Buttons */}
        <div className="flex justify-end mt-4 space-x-2">
          <button
            className="bg-red-500 text-white px-4 py-2 rounded"
            onClick={handleDisapprove}
          >
            Disapprove
          </button>
          <button
            className="bg-green-500 text-white px-4 py-2 rounded"
            onClick={handleApprove}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveReview;
