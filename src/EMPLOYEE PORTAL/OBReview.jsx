import React, { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "./AuthContext";
import Swal from "sweetalert2";
import API_ENDPOINTS from "@/apiConfig.jsx";
import dayjs from "dayjs";

const OBReview = ({ obData, onClose, pendingOBs, setPendingOBs, setHistory }) => {
  const { user } = useAuth();
  if (!obData) return null;

  const formatDate = (date) => {
  if (!date) return "";
  return dayjs(date).isValid() ? dayjs(date).format("YYYY-MM-DDTHH:mm") : "";
};


  const [formData, setFormData] = useState({
    empno: obData.empno || "",
    empname: obData.empname || "",
    obstart: formatDate(obData.obstart),
    obend: formatDate(obData.obend),
    duration: obData.duration || "",
    obRemarks: obData.obRemarks || "",
    approverRemarks: obData.approverRemarks || "",
    obStamp: obData.obStamp || "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleApproval = async () => {
  try {
    if (!formData.obStamp) {
      console.error("Error: obStamp is missing!");
      await Swal.fire({
        title: "Error",
        text: "obStamp is missing. Please try again.",
        icon: "error",
        customClass: {
          popup: "z-[10050]",
        },
        confirmButtonText: "OK",
      });
      return;
    }

    const payload = {
      json_data: JSON.stringify({
        json_data: {
          empNo: formData.empno,
          appRemarks: formData.approverRemarks,
          obStamp: formData.obStamp,
          appStat: 1, // Approved
          appUser: user.empNo,
          appObStart: obData.obstart,
          appObEnd: obData.obend,
          appDays: parseFloat(formData.obDays) || 0,
          appHrs: formData.duration,
        },
      }),
    };

    const response = await fetch(API_ENDPOINTS.officialBusinessApproval, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      // Create the updated record with all necessary fields
      const updatedRecord = {
        ...obData,
        obstatus: "Approved", // Make sure this matches your backend response
        appRemarks: formData.approverRemarks,
      };

      onClose();
      await Swal.fire({
        title: "Success",
        text: "Approval successful!",
        icon: "success",
        customClass: {
          popup: "z-[10050]",
        },
      });

      // Update both pending and history states
      setPendingOBs((prev) => prev.filter((ob) => ob.obStamp !== formData.obStamp));
      setHistory((prev) => [...prev, updatedRecord]);
    } else {
      throw new Error(result.message || "Something went wrong.");
    }
  } catch (error) {
    console.error("Approval failed:", error);
    await Swal.fire({
      title: "Error",
      text: error.message || "Failed to send approval. Please try again.",
      icon: "error",
      customClass: {
        popup: "z-[10050]",
      },
    });
  }
};

const handleDisapprove = async () => {
  try {
    if (!formData.obStamp) {
      console.error("Error: obStamp is missing!");
      await Swal.fire({
        title: "Error",
        text: "obStamp is missing. Please try again.",
        icon: "error",
        customClass: {
          popup: "z-[10050]",
        },
        confirmButtonText: "OK",
      });
      return;
    }

    const payload = {
      json_data: JSON.stringify({
        json_data: {
          empNo: formData.empno,
          appRemarks: formData.approverRemarks,
          obStamp: formData.obStamp,
          appStat: 0, // Disapproved
          appUser: user.empNo,
          appObStart: obData.obstart,
          appObEnd: obData.obend,
          appDays: parseFloat(formData.obDays) || 0,
          appHrs: formData.duration,
        },
      }),
    };

    const response = await fetch(API_ENDPOINTS.officialBusinessApproval, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      // Create the updated record with all necessary fields
      const updatedRecord = {
        ...obData,
        obstatus: "Disapproved", // Make sure this matches your backend response
        appRemarks: formData.approverRemarks,
      };

      onClose();
      await Swal.fire({
        title: "Success",
        text: "Disapproval successful!",
        icon: "success",
        customClass: {
          popup: "z-[10050]",
        },
      });

      // Update both pending and history states
      setPendingOBs((prev) => prev.filter((ob) => ob.obStamp !== formData.obStamp));
      setHistory((prev) => [...prev, updatedRecord]);
    } else {
      throw new Error(result.message || "Something went wrong.");
    }
  } catch (error) {
    console.error("Disapproval failed:", error);
    await Swal.fire({
      title: "Error",
      text: error.message || "Failed to send disapproval. Please try again.",
      icon: "error",
      customClass: {
        popup: "z-[10050]",
      },
    });
  }
};



  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[9999] p-4 sm:p-6">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-md sm:max-w-4xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900">
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold mb-5">Official Business Review</h2>

        {/* Employee Name & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700">Employee Name:</label>
            <input type="text" name="empName" value={formData.empname} className="border p-2 w-full" disabled />
          </div>
          <div>
            <label className="block text-gray-700">Duration:</label>
          <input type="number" name="obHrs" value={formData.duration} className="border p-2 w-full" disabled />
          </div>
        </div>

        {/* OB Start & End */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
  <label className="block text-gray-700">Start Date & Time:</label>
  <input
    type="datetime-local"
    name="obStart"
    value={dayjs(formData.obstart).format("YYYY-MM-DDTHH:mm")}
    className="border p-2 w-full"
    disabled
  />
</div>

<div>
  <label className="block text-gray-700">End Date & Time:</label>
  <input
    type="datetime-local"
    name="obEnd"
    value={dayjs(formData.obend).format("YYYY-MM-DDTHH:mm")}
    className="border p-2 w-full"
    disabled
  />
</div>

        </div>

        {/* Remarks */}
        <div className="mt-4">
          <label className="block text-gray-700">Remarks:</label>
          <textarea name="obRemarks" value={formData.obRemarks} className="border p-2 w-full" disabled />
        </div>

        {/* Approver Remarks */}
        <div className="mt-4">
          <label className="block text-gray-700">Approver Remarks:</label>
          <textarea
            name="approverRemarks"
            value={formData.approverRemarks}
            onChange={handleChange}
            className="border p-2 w-full"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => handleApproval(0)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Disapprove
          </button>
          <button
            onClick={() => handleApproval(1)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export default OBReview;
