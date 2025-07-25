import React, { useState } from "react";
import { AiOutlineClose } from "react-icons/ai"; // ✅ Import X (close) icon from React Icons
import { useAuth } from "./AuthContext"; // Import AuthContext to get logged-in user data
import API_ENDPOINTS from "@/apiConfig.jsx";

import Swal from 'sweetalert2';

const OvertimeReview = ({ overtimeData, onClose, setPendingOt, setHistory, refreshData }) => {
  if (!overtimeData) return null;

  const { user } = useAuth(); // Get logged-in user data

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // ✅ Local date in YYYY-MM-DD
  };
  
  
   const [formData, setFormData] = useState({
  empNo: overtimeData.empNo || "",
  empName: overtimeData.empName || "",
  department: overtimeData.department || "N/A",
  otDate: formatDate(overtimeData.otDate),
  otDays: overtimeData.otDays || "",
  otHrs: overtimeData.otHrs || "",     // original requested hours
  approvedHrs: overtimeData.otHrs || "", // editable approved hours
  otType: overtimeData.otType || "",
  otRemarks: overtimeData.otRemarks || "",
  otStamp: overtimeData.otStamp || "",
});

  
  // Handle input change
  const handleChange = (e) => {
  setFormData({ ...formData, [e.target.name]: e.target.value });
};


  const handleApprove = async () => {
    try {
      if (!formData.otStamp) {
        console.error("Error: otStamp is missing!");
        await Swal.fire({
          title: "Error",
          text: "otStamp is missing. Please try again.",
          icon: "error",
          customClass: {
            popup: 'z-[10050]',
          },
          confirmButtonText: "OK",
        });
        return;
      }
  
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            empNo: formData.empNo,
            appRemarks: formData.approverRemarks,
            appHrs: parseFloat(formData.approvedHrs) || 0,
            otStamp: formData.otStamp,
            appStat: 1, // Approved
            appUser: user.empNo,
          },
        }),
      };
  
      console.log("Sending approval data:", payload);
  
      const response = await fetch(API_ENDPOINTS.overtimeApproval, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      if (!formData.otStamp) {
        console.error("Error: otStamp is missing!");
        Swal.fire({
          title: "Error",
          text: "otStamp is missing. Please try again.",
          icon: "error",
          customClass: {
            popup: 'z-[10050]',
          },
          confirmButtonText: "OK",
        });
        return;
      }
  
      const payload = {
        json_data: JSON.stringify({
          json_data: {
            empNo: formData.empNo,
            appRemarks: formData.approverRemarks,
            otStamp: formData.otStamp,
            appStat: 0, // Disapproved
            appUser: user.empNo,
          },
        }),
      };
  
      console.log("Sending disapproval data:", payload);
  
      const response = await fetch(API_ENDPOINTS.overtimeApproval, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          {/* ✅ Close Button (X) in Top-Right */}
        <button className="absolute top-3 right-3 text-gray-600 hover:text-gray-900" onClick={onClose}>
          <AiOutlineClose size={24} />
        </button>

        <h2 className="text-xl font-bold mb-4">Overtime Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700">Employee Name</label>
            <input className="border p-2 w-full" value={formData.empName || ""} readOnly />
          </div>
          <div>
            <label className="block text-gray-700">Department</label>
            <input className="border p-2 w-full" value={formData.department || ""} readOnly />
          </div>
          <div>
            <label className="block text-gray-700">Overtime Date</label>
            <input className="border p-2 w-full" 
                type="date" value={formData.otDate || ""} readOnly />
          </div>
          <div>
            <label className="block text-gray-700">Hours</label>
            <input className="border p-2 w-full" value={formData.otHrs || ""} readOnly />
            
          </div>

          <div>
  <label className="block text-gray-700">Approved Hours</label>
  <input
    type="number"
    step="0.01"
    name="approvedHrs"
    className="border p-2 w-full"
    value={formData.approvedHrs}
    onChange={handleChange}
  />
</div>

        </div>

        {/* ✅ Approver Remarks (Editable) */}
        <div className="mt-4">
          <label className="block text-gray-700">Approver's Remarks</label>
          <textarea
            name="approverRemarks"
            value={formData.approverRemarks}
            onChange={handleChange}
            className="w-full border rounded p-2"
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

export default OvertimeReview;
