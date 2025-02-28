import React, { useState } from "react";

const officialBusiness = () => {
  const [applicationDate] = useState("January 27, 2025");
  const [duration] = useState("January 28, 2025");
  const [OBType, setOBType] = useState("");
  const [remarks, setRemarks] = useState();

  const history = [
    {
      date: "03/07/2021",
      durationDays: "01 Day (05 Jul)",
      durationHours: "8 HRS",
      type: "Meeting",
      remark: "Client Onsite Meeting",
      approverRemark: "",
      status: "Pending",
    },
    {
        date: "06/07/2024",
        durationDays: "01 Day (06 June)",
        durationHours: "8 HRS",
        type: "Meeting",
        remark: "Client Onsite Meeting",
        approverRemark: "",
        status: "Disapproved",
    },
  ];

  return (
    <div className="ml-80 mt-[120px] p-6 bg-gray-100 min-h-screen">
      <div className="w-[1150px]">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-6 rounded-lg text-white shadow-lg">
          <h1 className="text-3xl font-semibold">My Official Business Application</h1>
        </div>

        {/* Overtime Details Section */}
        <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="block font-semibold mb-1">Date of Application</span>
              <div className="w-full p-2 border rounded bg-gray-100">{applicationDate}</div>
            </div>

            <div>
              <span className="block font-semibold mb-1">Duration</span>
              <div className="w-full p-2 border rounded bg-gray-100">{duration}</div>
            </div>

            <div>
              <span className="block font-semibold mb-1">Application Type</span>
              <select
                value={OBType}
                onChange={(e) => setOBType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option>Meeting</option>
                <option>Training</option>
              </select>
            </div>
          </div>

          {/* Remarks Section */}
          <div className="mt-6">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows="4"
              className="w-full p-2 border rounded"
            ></textarea>
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
              SUBMIT
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mt-10 grid grid-cols-4 gap-6 bg-white p-4 shadow-md rounded-lg">
          <div>
            <span className="block font-semibold mb-1">Date of Application</span>
            <input type="text" className="w-full p-2 border rounded" />
          </div>
          <div>
            <span className="block font-semibold mb-1">Duration</span>
            <input type="text" className="w-full p-2 border rounded" />
          </div>
          <div>
            <span className="block font-semibold mb-1">Application Type</span>
            <input type="text" className="w-full p-2 border rounded" />
          </div>
          <div>
            <span className="block font-semibold mb-1">Status</span>
            <input type="text" className="w-full p-2 border rounded" />
          </div>
        </div>

        {/* History Table */}
        <div className="mt-6 bg-white p-6 shadow-md rounded-lg">
          <h2 className="text-lg font-semibold mb-4">History</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2 border">DATE OF APPLICATION</th>
                <th className="p-2 border">DURATION (DAYS)</th>
                <th className="p-2 border">DURATION (HOURS)</th>
                <th className="p-2 border">APPLICATION TYPE</th>
                <th className="p-2 border">REMARKS</th>
                <th className="p-2 border">APPROVER'S REMARK</th>
                <th className="p-2 border">STATUS</th>
              </tr>
            </thead>
            <tbody>
  {history.map((entry, index) => (
    <tr key={index} className="border">
      <td className="p-2 border">{entry.date}</td>
      <td className="p-2 border">{entry.durationDays}</td>
      <td className="p-2 border">{entry.durationHours}</td>
      <td className="p-2 border">{entry.type}</td>
      <td className="p-2 border">{entry.remark}</td>
      <td className="p-2 border">{entry.approverRemark}</td>
      <td className="p-2 border">
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            entry.status === "Pending"
              ? "bg-orange-100 text-orange-500"
              : "bg-red-100 text-red-500"
          }`}
        >
          {entry.status}
        </span>
      </td>
    </tr>
  ))}
</tbody>

          </table>
        </div>
      </div>
    </div>
  );
};

export default officialBusiness;
