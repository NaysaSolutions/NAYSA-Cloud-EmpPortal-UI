
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import API_ENDPOINTS from "@/apiConfig.jsx";
import { useAuth } from "./AuthContext.jsx";
import TimekeepingAdjustmentReview from "./TimekeepingAdjustmentReview.jsx";

const TimekeepingAdjustmentApproval = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    try {
      const inqRes = await fetch(API_ENDPOINTS.getDTRApprInq, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ EMP_NO: user.empNo, STAT: "Pending" }),
      });
      const inq = await inqRes.json();

      let pendingRows = [];
      if (inq?.success && inq?.data?.[0]?.result) {
        pendingRows = JSON.parse(inq.data[0].result) || [];
      }

      const histRes = await fetch(API_ENDPOINTS.getDTRApprHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EMP_NO: user.empNo,
          START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
          END_DATE: dayjs().add(1, "year").format("YYYY-MM-DD"),
        }),
      });
      const hist = await histRes.json();
      let histRows = [];
      if (hist?.success && hist?.data?.[0]?.result) {
        histRows = JSON.parse(hist.data[0].result) || [];
      }

      setPending(pendingRows);
      setHistory(histRows);
    } catch (e) {
      console.error(e);
      setError("Failed to load approvals.");
    }
  };

  useEffect(() => { if (user?.empNo) fetchAll(); }, [user?.empNo]);

  const openReview = (row) => { setSelected(row); setShowModal(true); };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="global-div-header-ui">
        <h1 className="global-div-headertext-ui">Timekeeping Adjustment Approval</h1>
      </div>

      <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
        <h2 className="text-lg font-bold mb-4">Pending DTR Adjustments</h2>
        {error && <p className="text-red-500 text-center">{error}</p>}
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto relative">
          <table className="min-w-full text-sm text-center border">
            <thead className="global-thead-approval">
              <tr>
                <th className="global-th text-left">Employee</th>
                <th className="global-th text-left">Type</th>
                <th className="global-th text-left">Shift Date</th>
                <th className="global-th text-left">Actual Time</th>
                <th className="global-th text-left">Remarks</th>
                <th className="global-th text-center">Action</th>
              </tr>
            </thead>
            <tbody className="global-tbody">
              {pending.length ? pending.map((r, i) => (
                <tr key={i} className="global-tr">
                  <td className="global-td-approval text-left">{r.empname}</td>
                  <td className="global-td-approval text-left">{r.dtrType || ""}</td>
                  <td className="global-td-approval text-left">{dayjs(r.dtrDate).format("MM/DD/YYYY")}</td>
                  <td className="global-td-approval text-left">{dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}</td>
                  <td className="global-td-approval text-left">{r.dtrRemarks || "N/A"}</td>
                  <td className="global-td-approval text-center">
                    <button className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600"
                      onClick={() => openReview(r)}>Review</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="text-center text-gray-500 p-3">No pending requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-white p-4 shadow-lg rounded-lg">
        <h2 className="text-lg font-bold mb-4">Approval History</h2>
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto relative">
          <table className="min-w-full text-sm text-center border">
            <thead className="global-thead-approval">
              <tr>
                <th className="global-th text-left">Employee</th>
                <th className="global-th text-left">Type</th>
                <th className="global-th text-left">Shift Date</th>
                <th className="global-th text-left">Actual Time</th>
                <th className="global-th text-left">Applicant Remarks</th>
                <th className="global-th text-left">Approver Remarks</th>
                <th className="global-th text-left">Status</th>
              </tr>
            </thead>
            <tbody className="global-tbody">
              {history.length ? history.map((r, i) => (
                <tr key={i} className="global-tr">
                  <td className="global-td-approval text-left">{r.empname}</td>
                  <td className="global-td-approval text-left">{r.dtrType || ""}</td>
                  <td className="global-td-approval text-left">{dayjs(r.dtrDate).format("MM/DD/YYYY")}</td>
                  <td className="global-td-approval text-left">{dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm A")}</td>
                  <td className="global-td-approval text-left">{r.dtrRemarks || "N/A"}</td>
                  <td className="global-td-approval text-left">{r.appRemarks || "N/A"}</td>
                  <td className={`global-td-approval text-left font-bold ${r.dtrStatus === "Approved" ? "text-blue-600" : "text-red-600"}`}>
                    {r.dtrStatus}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="text-center text-gray-500 p-3">No records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selected && (
        <TimekeepingAdjustmentReview
          dtrData={selected}
          onClose={() => { setShowModal(false); setSelected(null); }}
          setPending={setPending}
          setHistory={setHistory}
        />
      )}
    </div>
  );
};

export default TimekeepingAdjustmentApproval;
