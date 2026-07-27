import dayjs from "dayjs";

const readField = (row, names) => {
  if (!row) return undefined;
  const keys = Object.keys(row);
  const key = keys.find((candidate) => names.includes(candidate.toLowerCase()));
  return key ? row[key] : undefined;
};

const isPending = (row) => {
  const status = readField(row, ["obstatus", "leavestatus", "otstatus", "dtrstatus", "status"]);
  return String(status || "").toLowerCase() === "pending";
};

export const approvalRemarks = (row) =>
  isPending(row) ? " " : row?.appRemarks ?? row?.appremarks ?? row?.APP_REMARKS ?? "N/A";


export const approvalUser = (row) =>
  isPending(row) ? " " : readField(row, ["appuser", "appUser"]) || "N/A";

export const approvalDateTime = (row) => {
  if (isPending(row)) return " ";
  const value = readField(row, ["appdatetime", "app_date_time", "appDateTime" ]);
  return value ? dayjs(value).format("MM/DD/YYYY hh:mm A") : "N/A";
};

export const applicationFileDate = (row) => {
  const value = row?.fileDate ?? row?.filedate ?? row?.FILE_DATE ?? row?.file_date;
  return value ? dayjs(value).format("MM/DD/YYYY") : "N/A";
};

export const approvalLabels = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "pending") return { remarks: "",actor: " ", date: " " };
  if (value === "cancelled" || value === "canceled") return { remarks: "Approver's Remarks", actor: "Cancelled By", date: "Cancelled Date" };
  if (value === "disapproved") return { remarks: "Approver's Remarks", actor: "Disapproved By", date: "Disapprove Date" };
  return { remarks: "Approver's Remarks", actor: "Approved By", date: "Approved Date" };
};
