import React from "react";
import { AiOutlineClose } from "react-icons/ai"; // ✅ Import X (close) icon from React Icons

const OvertimeReview = ({ overtimeData, onClose }) => {
  if (!overtimeData) return null;

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
          <label className="block text-gray-700">Approver's Remarks</label>
          <textarea className="border p-2 w-full h-20"></textarea> 
        </div>

        <div className="flex justify-end space-x-4 mt-6">
          <button className="bg-green-500 text-white px-4 py-2 rounded">Approve</button>
          <button className="bg-red-500 text-white px-4 py-2 rounded">Reject</button>
        </div>
      </div>
    </div>
  );
};

export default OvertimeReview;
