const enabled = (value) => ["1", "y", "yes", "true"].includes(
  String(value ?? "").trim().toLowerCase(),
);

const field = (user, name) => {
  const normalizedName = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const key = Object.keys(user || {}).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  const matchingKey = key || Object.keys(user || {}).find(
    (candidate) => candidate.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalizedName,
  );
  return matchingKey ? user[matchingKey] : undefined;
};

export const getAccessRights = (user) => {
  const isApprover = enabled(field(user, "approver"));
  const isHr = enabled(field(user, "hrFlag"));
  const isManager = enabled(field(user, "mgrFlag"));
  const isSupervisor = enabled(field(user, "supFlag"));
  const isManagement = isHr || isManager || isSupervisor;

  return {
    isApprover,
    isHr,
    isManager,
    isSupervisor,
    canApprove: isApprover,
    canViewDtrMonitoring: isManagement,
    canViewLeaveMonitoring: isManagement,
    canManageEmployeeShifts: isManagement,
    canApproveEmployeeShifts: isApprover || isManagement,
    // Role permissions are additive: a manager/supervisor who is also an
    // approver retains both approval access and DTR Confirmation access.
    canConfirmDtr: isManager || isSupervisor,
  };
};

export const hasAccess = (user, right) => Boolean(getAccessRights(user)[right]);
