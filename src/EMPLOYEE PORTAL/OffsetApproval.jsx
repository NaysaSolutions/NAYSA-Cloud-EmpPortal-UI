import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useAuth } from "./AuthContext.jsx";
import OffsetReview from "../EMPLOYEE PORTAL/OffsetReview.jsx";

const badgeClass = (status) => {
  const base = "inline-flex justify-center items-center text-xs w-24 py-1 rounded-lg font-semibold";
  switch ((status || "").toLowerCase()) {
    case "approved": return `${base} bg-blue-100 text-blue-700`;
    case "disapproved": return `${base} bg-red-100 text-red-700`;
    case "pending": return `${base} bg-amber-100 text-amber-700`;
    case "cancelled":
    case "canceled": return `${base} bg-gray-200 text-gray-700`;
    default: return `${base} bg-slate-100 text-slate-700`;
  }
};

const OffsetApproval = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOffset, setSelectedOffset] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // TanStack Query for data fetching
  const { data: offsets, isLoading, isError } = useQuery({
    queryKey: ["offsets", user?.empNo],
    queryFn: async () => {
      const pendingRes = await fetch(API_ENDPOINTS.getOffsetApprInq, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo, STATUS: "Pending" }),
      });
      const pendingResult = await pendingRes.json();

      const historyRes = await fetch(API_ENDPOINTS.getOffsetApprInq, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo, STATUS: null }),
      });
      const historyResult = await historyRes.json();

      return {
        pending: pendingResult.success ? (pendingResult.data || []) : [],
        history: historyResult.success 
          ? (historyResult.data || []).filter(r => 
              r.offsetStatus === "Approved" || r.offsetStatus === "Disapproved"
            ) 
          : [],
      };
    },
    enabled: !!user?.empNo,
  });

  const handleReview = (row) => {
    setSelectedOffset(row);
    setShowModal(true);
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="mx-auto">
        <div className="global-div-header-ui">
          <h1 className="global-div-headertext-ui">Offset Approval</h1>
        </div>

        {/* PENDING SECTION */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Pending Offset Applications</h2>

          {isError && <p className="text-red-500 font-semibold mb-2">Failed to load offset approvals.</p>}
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-500 text-sm">Loading applications...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead className="global-thead-approval">
                  <tr>
                    <th className="global-th text-left">Employee</th>
                    <th className="global-th text-left">Source Date</th>
                    <th className="global-th text-left">Offset Date</th>
                    <th className="global-th text-right">Hours</th>
                    <th className="global-th text-left">Remarks</th>
                    <th className="global-th text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offsets?.pending?.length > 0 ? (
                    offsets.pending.map((r, i) => (
                      <tr key={i} className="global-tr">
                        <td className="global-td-approval">{r.empName}</td>
                        <td className="global-td-approval">{dayjs(r.sourceDate).format("MM/DD/YYYY")}</td>
                        <td className="global-td-approval">{dayjs(r.offsetDate).format("MM/DD/YYYY")}</td>
                        <td className="global-td-approval text-right">{Number(r.offsetHrs).toFixed(2)}</td>
                        <td className="global-td-approval">{r.offsetRemarks || "N/A"}</td>
                        <td className="global-td-approval text-center space-x-2">
                          <button
                            className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
                            onClick={() => handleReview(r)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center p-4">No pending offset applications.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* HISTORY SECTION */}
        <div className="mt-4 bg-white p-4 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">Offset Approval History</h2>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead className="global-thead-approval">
                  <tr>
                    <th className="global-th text-left">Employee</th>
                    <th className="global-th text-left">Source Date</th>
                    <th className="global-th text-left">Offset Date</th>
                    <th className="global-th text-right">Hours</th>
                    <th className="global-th text-left">Remarks</th>
                    <th className="global-th text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {offsets?.history?.length > 0 ? (
                    offsets.history.map((r, i) => (
                      <tr key={i} className="global-tr">
                        <td className="global-td-approval">{r.empName}</td>
                        <td className="global-td-approval">{dayjs(r.sourceDate).format("MM/DD/YYYY")}</td>
                        <td className="global-td-approval">{dayjs(r.offsetDate).format("MM/DD/YYYY")}</td>
                        <td className="global-td-approval text-right">{r.offsetHrs}</td>
                        <td className="global-td-approval">{r.offsetRemarks || "N/A"}</td>
                        <td className="global-td-approval text-center">
                          <span className={badgeClass(r.offsetStatus)}>{r.offsetStatus}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center p-4">No history records.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <OffsetReview
          offsetData={selectedOffset}
          onClose={() => {
            setShowModal(false);
            setSelectedOffset(null);
          }}
          refreshData={() => queryClient.invalidateQueries({ queryKey: ["offsets", user?.empNo] })}
        />
      )}
    </div>
  );
};

export default OffsetApproval;