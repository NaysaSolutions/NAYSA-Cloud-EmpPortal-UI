import React from "react";
import { X } from "lucide-react";

export default function LeaveCreditModal({ isOpen, onClose, leaveCredit }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl relative">

        {/* Close Button (X Icon) */}
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-600 hover:text-gray-900">
          <X size={24} />
        </button>

        <h2 className="text-lg font-semibold uppercase">Leave Credit Details</h2>
        <span className="text-gray-500 text-sm font-normal mt-2 uppercase">Recent Transactions</span>

        <div className="mt-4 overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm text-center border border-gray-200 rounded-lg shadow-md">
            <thead className="text-gray-700 uppercase bg-gray-100">
              <tr className="bg-gray-200 text-gray-700 text-sm uppercase">
                <th className="px-4 py-2 border cursor-pointer">Leave Type</th>
                <th className="px-4 py-2 border cursor-pointer">Credit</th>
                <th className="px-4 py-2 border cursor-pointer">Applied</th>
                <th className="px-4 py-2 border cursor-pointer">Used</th>
                <th className="px-4 py-2 border cursor-pointer">Remaining Balance</th>
                <th className="px-4 py-2 border cursor-pointer">Actual Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaveCredit.length > 0 ? (
                leaveCredit.map((leave, index) => (
                  <tr key={index} className="bg-white hover:bg-gray-100 transition">
                    <td className="px-4 py-2 border">{leave.description}</td>
                    <td className="px-4 py-2 border">{leave.credit}</td>
                    <td className="px-4 py-2 border">{leave.applied}</td>
                    <td className="px-4 py-2 border">{leave.availed}</td>
                    <td className="px-4 py-2 border">{leave.remaining_balance}</td>
                    <td className="px-4 py-2 border">{leave.balance}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-600 text-sm">
                    No leave credits found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}