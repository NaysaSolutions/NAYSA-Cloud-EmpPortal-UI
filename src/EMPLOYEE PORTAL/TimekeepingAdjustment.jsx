
import React, { useState, useEffect, forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaCalendarAlt } from "react-icons/fa";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { useAuth } from "./AuthContext";
import API_ENDPOINTS from "@/apiConfig.jsx";

const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
  <div className="relative">
    <input type="text" readOnly className="w-full p-2 pl-10 border rounded" value={value} onClick={onClick} ref={ref} />
    <FaCalendarAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-pointer" />
  </div>
));

const TimekeepingAdjustment = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [error, setError] = useState(null);

  // form
  const [dtrType, setDtrType] = useState("timeIn"); // NEW
  const [shiftDate, setShiftDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [actualDateTime, setActualDateTime] = useState(dayjs().format("YYYY-MM-DDTHH:mm"));
  const [remarks, setRemarks] = useState("");

  const fetchHistory = async () => {
    try {
      const body = JSON.stringify({
        EMP_NO: user.empNo,
        START_DATE: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
        END_DATE: dayjs().add(1, "year").format("YYYY-MM-DD"),
      });

      const res = await fetch(API_ENDPOINTS.getDTRAppHistory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const j = await res.json();
      if (j?.success && Array.isArray(j.data) && j.data[0]?.result) {
        const rows = JSON.parse(j.data[0].result);
        setData(rows);
        setFiltered(rows);
      } else {
        setData([]);
        setFiltered([]);
      }
    } catch (e) {
      setError("Failed to load history.");
      console.error(e);
    }
  };

  useEffect(() => { if (user?.empNo) fetchHistory(); }, [user?.empNo]);

  const handleSubmit = async () => {
    if (!shiftDate || !actualDateTime || !remarks.trim()) {
      Swal.fire({ title: "Incomplete", text: "Please fill all fields.", icon: "warning" });
      return;
    }

    const payload = {
      json_data: {
        empNo: user.empNo,
        detail: [{
          shiftDate: dayjs(shiftDate).format("YYYY-MM-DD"),
          actualDatetime: dayjs(actualDateTime).format("YYYY-MM-DDTHH:mm:ss"),
          dtrRemarks: remarks,
          dtrType: dtrType, // NEW
        }],
      },
    };

    try {
      const res = await fetch(API_ENDPOINTS.upsertDTR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const ok = res.ok;
      let j = null
      try { j = await res.json(); } catch {}
      if (!ok) throw new Error(j?.message || "Request failed");

      await Swal.fire({ title: "Submitted", text: "DTR adjustment submitted.", icon: "success" });
      setRemarks("");
      setActualDateTime(dayjs().format("YYYY-MM-DDTHH:mm"));
      setDtrType("timeIn");
      fetchHistory();
    } catch (e) {
      Swal.fire({ title: "Error", text: e.message, icon: "error" });
    }
  };

  return (
    <div className="ml-0 lg:ml-[200px] mt-[80px] p-4 bg-gray-100 min-h-screen">
      <div className="global-div-header-ui">
        <h1 className="global-div-headertext-ui">My Timekeeping Adjustments</h1>
      </div>

      <div className="mt-6 bg-white p-4 sm:p-6 shadow-md rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <label className="font-semibold mb-1">Type</label>
            <select className="w-full p-2 border rounded" value={dtrType} onChange={(e) => setDtrType(e.target.value)}>
              <option value="timeIn">Time In</option>
              <option value="timeOut">Time Out</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="font-semibold mb-1">Shift Date</label>
            <DatePicker
              selected={shiftDate ? new Date(shiftDate) : null}
              onChange={(d) => setShiftDate(dayjs(d).format("YYYY-MM-DD"))}
              dateFormat="MM/dd/yyyy"
              customInput={<CustomDateInput />}
            />
          </div>

          <div className="flex flex-col">
            <label className="font-semibold mb-1">Actual Date & Time</label>
            <DatePicker
              selected={actualDateTime ? new Date(actualDateTime) : null}
              onChange={(d) => setActualDateTime(dayjs(d).format("YYYY-MM-DDTHH:mm"))}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MM/dd/yyyy hh:mm aa"
              customInput={<CustomDateInput />}
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="font-semibold mb-1 block">Remarks</label>
          <textarea rows="4" className="w-full p-2 border rounded resize-none"
            value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>

        <div className="mt-6 flex justify-center">
          <button className="bg-blue-500 text-white px-12 py-2 rounded-md hover:bg-blue-600"
            onClick={handleSubmit}>Submit</button>
        </div>
      </div>

      <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
        <h2 className="text-base font-semibold mb-4">Timekeeping Application History</h2>
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm text-center border">
            <thead className="sticky top-0 z-10 bg-blue-800 text-white">
              <tr>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Shift Date</th>
                <th className="py-2 px-3">Actual Time</th>
                <th className="py-2 px-3">Remarks</th>
                <th className="py-2 px-3">Approver's Remarks</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="global-tbody">
              {filtered.length > 0 ? filtered.map((r, i) => (
                <tr key={i} className="global-tr">
                  <td className="global-td">{r.dtrType || ""}</td>
                  <td className="global-td">{dayjs(r.dtrDate).format("MM/DD/YYYY")}</td>
                  <td className="global-td">{dayjs(r.dtrStart).format("MM/DD/YYYY hh:mm a")}</td>
                  <td className="global-td">{r.dtrRemarks || "N/A"}</td>
                  <td className="global-td">{r.appRemarks || "N/A"}</td>
                  <td className="global-td-status">{r.dtrStatus || "N/A"}</td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="px-4 py-6 text-center text-gray-500">No applications found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TimekeepingAdjustment;
