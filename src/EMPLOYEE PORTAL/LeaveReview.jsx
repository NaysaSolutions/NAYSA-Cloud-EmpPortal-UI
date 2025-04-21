import React, { useState } from "react";
import { User, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

import Swal from 'sweetalert2';

const LeaveReview = ({ leaveData, onClose, pendingLeaves, setPendingLeaves, setHistory, refreshData }) => {
  if (!leaveData) return null; // Ensure data exists before rendering

  const { user } = useAuth(); // Get logged-in user data

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
    // approvedDays: leaveData.approvedDays || "",
    // approvedHrs: leaveData.approvedHrs || "",
    LV_STAMP: leaveData.LV_STAMP || "", // ✅ Include lvStamp
  });
  
  // Handle input change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleApprove = async () => {
    try {
      if (!formData.LV_STAMP) {
        console.error("Error: LV_STAMP is missing!");
        await Swal.fire({
          title: "Error",
          text: "LV_STAMP is missing. Please try again.",
          icon: "error",
          customClass: {
            popup: 'z-[10050]',
          },
        });
        return;
      }
  
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            empNo: formData.empNo,
            appRemarks: formData.approverRemarks,
            LV_STAMP: formData.LV_STAMP,
            appStat: 1, // Approved
            appUser: user.empNo,
          },
        }),
      };
  
      console.log("Sending approval data:", payload);
  
      const response = await fetch(API_ENDPOINTS.leaveApproval, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      const result = await response.json();
  
      if (response.ok) {
        onClose(); // Close modal
        await Swal.fire({
          title: "Success",
          text: "Approval successful!",
          icon: "success",
          customClass: {
            popup: 'z-[10050]',
          },
        });
  
        setPendingLeaves((prevLeaves) =>
          prevLeaves.filter((leave) => leave.LV_STAMP !== leaveData.LV_STAMP)
        );
  
        setHistory((prevHistory) => [
          ...prevHistory,
          { ...leaveData, leaveStatus: "Approved" },
        ]);
        
      } else {
        await Swal.fire({
          title: "Error",
          text: result.message || "Something went wrong.",
          icon: "error",
          customClass: {
            popup: 'z-[10050]',
          },
        });
      }
    } catch (error) {
      console.error("Approval failed:", error);
      await Swal.fire({
        title: "Error",
        text: "Failed to send approval. Please try again.",
        icon: "error",
        customClass: {
          popup: 'z-[10050]',
        },
      });
    }
  };
  
  const handleDisapprove = async () => {
    try {
      if (!formData.LV_STAMP) {
        console.error("Error: LV_STAMP is missing!");
        await Swal.fire({
          title: "Error",
          text: "LV_STAMP is missing. Please try again.",
          icon: "error",
          customClass: {
            popup: 'z-[10050]',
          },
        });
        return;
      }
  
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            empNo: formData.empNo,
            appRemarks: formData.approverRemarks,
            LV_STAMP: formData.LV_STAMP,
            appStat: 0, // Disapproved
            appUser: user.empNo,
          },
        }),
      };
  
      console.log("Sending disapproval data:", payload);
  
      const response = await fetch(API_ENDPOINTS.leaveApproval, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      const result = await response.json();
  
      if (response.ok) {
        onClose(); // Close modal
        await Swal.fire({
          title: "Success",
          text: "Leave disapproved successfully!",
          icon: "success",
          customClass: {
            popup: 'z-[10050]',
          },
        });
  
        setPendingLeaves((prevLeaves) =>
          prevLeaves.filter((leave) => leave.LV_STAMP !== leaveData.LV_STAMP)
        );
  
        setHistory((prevHistory) => [
          ...prevHistory,
          { ...leaveData, leaveStatus: "Disapproved" },
        ]);

      } else {
        await Swal.fire({
          title: "Error",
          text: result.message || "Something went wrong.",
          icon: "error",
          customClass: {
            popup: 'z-[10050]',
          },
        });
      }
    } catch (error) {
      console.error("Disapproval failed:", error);
      await Swal.fire({
        title: "Error",
        text: "Failed to send disapproval. Please try again.",
        icon: "error",
        customClass: {
          popup: 'z-[10050]',
        },
      });
    }
  };
  
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[9999] p-4 sm:p-6">
  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-md sm:max-w-4xl relative overflow-y-auto max-h-[90vh]">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900">
          <X size={24} />
        </button>
    <h2 className="text-2xl font-bold mb-5">Leave Review</h2>

        {/* Grid Layout for Inputs */}
        <div className="space-y-4">
  {/* Row: Employee Name & Department (Stacked on mobile) */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium">Employee Name:</label>
      <input
        type="text"
        name="empName"
        value={formData.empName}
        className="w-full border rounded p-2"
        disabled
      />
    </div>
    <div>
      <label className="block text-sm font-medium">Department:</label>
      <input
        type="text"
        name="department"
        value={formData.department}
        className="w-full border rounded p-2"
        disabled
      />
    </div>
  </div>

  {/* Row: Leave Start & Leave End */}
  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium">Leave Start:</label>
      <input
        type="date"
        name="leaveStart"
        value={formData.leaveStart}
        className="w-full border rounded p-2"
        disabled
      />
    </div>
    <div>
      <label className="block text-sm font-medium">Leave End:</label>
      <input
        type="date"
        name="leaveEnd"
        value={formData.leaveEnd}
        className="w-full border rounded p-2"
        disabled
      />
    </div>
  </div>

  {/* Row: Leave Days & Leave Hours */}
  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium">Number of Days:</label>
      <input
        type="number"
        name="leaveDays"
        value={formData.leaveDays}
        className="w-full border rounded p-2"
        disabled
      />
    </div>
    <div>
      <label className="block text-sm font-medium">Number of Hours:</label>
      <input
        type="number"
        name="leaveHrs"
        value={formData.leaveHrs}
        className="w-full border rounded p-2"
        disabled
      />
    </div>
  </div>
</div>


        {/* Full-Width Text Areas */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Remarks:</label>
          <textarea
            name="leaveRemarks"
            value={formData.leaveRemarks}
            onChange={handleChange}
            className="w-full border rounded p-2 text-sm"
            disabled
            required
          />
        </div>
        <hr  className="mt-5 mb-5"/>

        {/* Approved Days & Approved Hours (Side by Side)
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
        </div> */}
        <div className="mt-3">
          <label className="block text-sm font-medium uppercase">Approver Remarks:</label>
          <textarea
            name="approverRemarks"
            value={formData.approverRemarks}
            onChange={handleChange}
            className="w-full border rounded p-2 text-sm"
          />
        </div>
      

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-end mt-4 gap-2 sm:gap-2">

          <button
            className="bg-red-500 text-white px-4 py-2 rounded"
            onClick={handleDisapprove}
          >
            Disapprove
          </button>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
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
