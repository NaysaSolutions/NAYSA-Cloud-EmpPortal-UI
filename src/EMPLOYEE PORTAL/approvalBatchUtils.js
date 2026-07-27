import API_ENDPOINTS from "@/apiConfig.jsx";

const getStamp = (row, type) => {
  const fields = {
    ot: ["otStamp", "OT_STAMP", "stamp", "Stamp", "guid", "OT_STAMP_ID"],
    leave: ["LV_STAMP", "lvStamp", "leaveStamp", "stamp", "Stamp", "guid"],
    ob: ["obStamp", "OB_STAMP", "stamp", "Stamp", "guid"],
    dtr: ["dtrStamp", "DTR_STAMP", "stamp", "Stamp", "guid"],
  };
  return (fields[type] || []).map((field) => row?.[field]).find(Boolean);
};

const getEmployeeNo = (row) => row?.empno || row?.empNo || row?.EMP_NO || "";

const approvalConfig = {
  ot: { endpoint: API_ENDPOINTS.overtimeApproval, stamp: "otStamp" },
  leave: { endpoint: API_ENDPOINTS.leaveApproval, stamp: "LV_STAMP" },
  ob: { endpoint: API_ENDPOINTS.officialBusinessApproval, stamp: "obStamp" },
  dtr: { endpoint: API_ENDPOINTS.approvalDTR, stamp: "dtrStamp" },
};

export const sendApprovalDecision = async ({ type, row, appStat, userEmpNo }) => {
  const config = approvalConfig[type];
  const stamp = getStamp(row, type);
  if (!config || !stamp) throw new Error(`Missing ${type} record identifier.`);

  const inner = {
    empNo: getEmployeeNo(row),
    appRemarks: "",
    [config.stamp]: stamp,
    appStat,
    appUser: userEmpNo,
  };

  if (type === "ot") inner.appHrs = Number(row.appHrs ?? row.otHrs ?? 0);
  if (type === "leave") {
    const days = Number(row.appDays ?? row.leaveDays);
    const hours = Number(row.appHrs ?? row.leaveHrs);
    if (Number.isFinite(days)) inner.appDays = days;
    if (Number.isFinite(hours)) inner.appHrs = hours;
  }
  if (type === "ob") {
    inner.appHrs = Number(row.appHrs ?? row.duration ?? 0);
    inner.appDays = 0;
    inner.appObStart = row.obstart;
    inner.appObEnd = row.obend;
  }
  if (type === "dtr") inner.appDatetime = row.actualTime;

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json_data: JSON.stringify({ json_data: inner }) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || "Approval request failed.");
};

export const cancelApprovedRecord = async ({ type, row }) => {
  const endpoint = {
    ot: API_ENDPOINTS.cancelOvertimeApplication,
    leave: API_ENDPOINTS.cancelLeaveApplication,
    ob: API_ENDPOINTS.cancelOfficialBusinessApplication,
    dtr: API_ENDPOINTS.cancelDTR,
  }[type];
  const field = { ot: "otStamp", leave: "lvStamp", ob: "obStamp", dtr: "dtrStamp" }[type];
  const stamp = getStamp(row, type);
  if (!endpoint || !stamp) throw new Error(`Missing ${type} record identifier.`);

  const payload = { empNo: getEmployeeNo(row), [field]: stamp };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json_data: payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result?.status && result.status !== "success")) {
    throw new Error(result?.message || "Cancellation failed.");
  }
};

