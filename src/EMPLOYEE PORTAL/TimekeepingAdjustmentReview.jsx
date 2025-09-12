
import React, { useState } from "react";
import { X } from "lucide-react";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useAuth } from "./AuthContext";

// DTR Review modal with dtr_type display
const TimekeepingAdjustmentReview = ({ dtrData, onClose, setPending, setHistory }) => {
  const { user } = useAuth();
  if (!dtrData) return null;

  const [approverRemarks, setApproverRemarks] = useState("");

  const payloadBase = (appStat) => ({
    json_data: JSON.stringify({
      json_data: {
        empNo: dtrData.empno,
        appRemarks: approverRemarks,
        dtrStamp: dtrData.dtrStamp,
        appStat: appStat,                 // 1 = Approve, 0 = Disapprove
        appUser: user.empNo,
        appDatetime: dtrData.actualTime,  // optional; sproc stamps current
      },
    }),
  });

  const sendDecision = async (appStat) => {
    try {
      if (!dtrData?.dtrStamp) {
        await Swal.fire({ title: "Error", text: "Missing DTR stamp.", icon: "error" });
        return;
      }

      const res = await fetch(API_ENDPOINTS.approvalDTR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBase(appStat)),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || "Request failed");

      await Swal.fire({
        title: appStat === 1 ? "Approved" : "Disapproved",
        text: "Decision has been recorded.",
        icon: "success",
      });

      const updated = {
        ...dtrData,
        appRemarks: approverRemarks,
        dtrStatus: appStat === 1 ? "Approved" : "Disapproved",
      };
      setPending((prev) => prev.filter((x) => x.dtrStamp !== dtrData.dtrStamp));
      setHistory((prev) => [updated, ...prev]);

      onClose();
    } catch (err) {
      await Swal.fire({ title: "Error", text: err.message, icon: "error" });
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[9999] p-4 sm:p-6">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-md sm:max-w-3xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-5">DTR Review</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700">Employee:</label>
            <input type="text" className="border p-2 w-full" value={dtrData.empname || ""} disabled />
          </div>
          <div>
            <label className="block text-gray-700">Status:</label>
            <input type="text" className="border p-2 w-full" value={dtrData.dtrStatus || "Pending"} disabled />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-gray-700">Type:</label>
            <input type="text" className="border p-2 w-full" value={dtrData.dtrType || ""} disabled />
          </div>
          <div>
            <label className="block text-gray-700">Shift Date:</label>
            <input type="date" className="border p-2 w-full" value={dayjs(dtrData.dtrDate).format("YYYY-MM-DD")} disabled />
          </div>
          <div>
            <label className="block text-gray-700">Actual Time:</label>
            <input type="datetime-local" className="border p-2 w-full"
              value={dayjs(dtrData.dtrStart).format("YYYY-MM-DDTHH:mm")} disabled />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-gray-700">Applicant Remarks:</label>
          <textarea className="border p-2 w-full" value={dtrData.dtrRemarks || ""} disabled />
        </div>

        <div className="mt-4">
          <label className="block text-gray-700">Approver Remarks:</label>
          <textarea className="border p-2 w-full" value={approverRemarks}
            onChange={(e) => setApproverRemarks(e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => sendDecision(0)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Disapprove
          </button>
          <button onClick={() => sendDecision(1)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimekeepingAdjustmentReview;
