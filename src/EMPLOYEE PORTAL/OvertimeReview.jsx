import React, { useState } from "react";
import { AiOutlineClose } from "react-icons/ai"; // ✅ Import X (close) icon from React Icons
import { X } from "lucide-react";
import { useAuth } from "./AuthContext"; // Import AuthContext to get logged-in user data


const OvertimeReview = ({ overtimeData, onClose }) => {
  if (!overtimeData) return null;

  const { user } = useAuth(); // Get logged-in user data

  const formatDate = (date) => {
    if (!date) return ""; // Ensure it's not null/undefined
    const d = new Date(date);
    return d.toISOString().split("T")[0]; // Convert to YYYY-MM-DD format
  };
  
   const [formData, setFormData] = useState({
    empNo: overtimeData.empNo || "",
    empName: overtimeData.empName || "",
    department: overtimeData.department || "N/A",
    otDate: formatDate(overtimeData.otDate), // ✅ Convert date format
    otDays: overtimeData.otDays || "",
    otHrs: overtimeData.otHrs || "",
    otType: overtimeData.otType || "",
    otRemarks: overtimeData.otRemarks || "",
    approverRemarks: overtimeData.approverRemarks || "",
    approvedHrs: overtimeData.approvedHrs || "",
    otStamp: overtimeData.otStamp || "", // ✅ Include lvStamp
   });
  
  // Handle input change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleApprove = async () => {
    try {
      if (!formData.otStamp) {
        console.error("Error: otStamp is missing!");
        alert("Error: otStamp is missing. Please try again.");
        return;
      }
  
      // Correct JSON format: wrapping json_data around the actual approval details
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            empNo: formData.empNo,
            appRemarks: formData.approverRemarks,
            appHrs: parseFloat(formData.approvedHrs) || 0,
            otStamp: formData.otStamp, // ✅ Ensure lvStamp is included
            appStat: 1, // Status for approved
            appUser: user.empNo, // Global User
          }
        }),
      };
  
      console.log("Sending approval data:", payload);
  
      const response = await fetch("https://api.nemarph.com:81/api/approvalOT", {
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
      if (!formData.otStamp) {
        console.error("Error: otStamp is missing!");
        alert("Error: otStamp is missing. Please try again.");
        return;
      }
  
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            applEmpNo: formData.applEmpNo,
            appRemarks: formData.approverRemarks,
            otStamp: formData.otStamp, // Ensure lvStamp is included
            appStat: 0, // Status for disapproved
            appuser: formData.empNo, // Global User
          }
        }),
      };
  
      console.log("Sending disapproval data:", payload);
  
      const response = await fetch("https://api.nemarph.com:81/api/approvalOT", {
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
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white p-6 rounded-lg shadow-lg w-[600px]">
        {/* ✅ Close Button (X) in Top-Right */}
        <button className="absolute top-3 right-3 text-gray-600 hover:text-gray-900" onClick={onClose}>
          <AiOutlineClose size={24} />
        </button>

        <h2 className="text-xl font-bold mb-4">Overtime Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700">Employee Name</label>
            <input className="border p-2 w-full" value={overtimeData.empName || ""} readOnly />
          </div>
          <div>
            <label className="block text-gray-700">Department</label>
            <input className="border p-2 w-full" value={overtimeData.department || ""} readOnly />
          </div>
          <div>
            <label className="block text-gray-700">Overtime Date</label>
            <input className="border p-2 w-full" value={overtimeData.otDate || ""} readOnly />
          </div>
          <div>
            <label className="block text-gray-700">Hours</label>
            <input className="border p-2 w-full" value={overtimeData.otHrs || ""} readOnly />
            
          </div>
        </div>

        {/* ✅ Approver Remarks (Editable) */}
        <div className="mt-4">
          <label className="block text-gray-700">Approved Hours</label>
          <input
              type="number"
              name="approvedHrs"
              value={formData.approvedHrs}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          {/* <input className="border p-2 w-full" value={overtimeData.otHrs || ""}  /> */}
          <label className="block text-gray-700">Approver's Remarks</label>
          <textarea
            name="approverRemarks"
            value={formData.approverRemarks}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        {/* <div className="flex justify-end space-x-4 mt-6">
          <button className="bg-green-500 text-white px-4 py-2 rounded">Approve</button>
          <button className="bg-red-500 text-white px-4 py-2 rounded">Disapprove</button>
        </div> */}

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

export default OvertimeReview;
