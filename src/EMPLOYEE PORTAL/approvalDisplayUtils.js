import dayjs from "dayjs";

export const approvalRemarks = (row) =>
  row?.appRemarks ?? row?.appremarks ?? row?.APP_REMARKS ?? "N/A";


export const approvalUser = (row) =>
  row?.appUser ?? row?.appuser ?? row?.APP_USER ?? "N/A";

export const approvalDateTime = (row) => {
  const value = row?.appDateTime ?? row?.appDatetime ?? row?.APP_DATETIME ?? row?.app_date_time;
  return value ? dayjs(value).format("MM/DD/YYYY hh:mm A") : "N/A";
};

export const applicationFileDate = (row) => {
  const value = row?.fileDate ?? row?.filedate ?? row?.FILE_DATE ?? row?.file_date;
  return value ? dayjs(value).format("MM/DD/YYYY") : "N/A";
};

export const approvalLabels = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "cancelled" || value === "canceled") return { actor: "Cancelled By", date: "Cancelled Date" };
  if (value === "disapproved") return { actor: "Disapproved By", date: "Disapprove Date" };
  return { actor: "Approved By", date: "Approved Date" };
};
