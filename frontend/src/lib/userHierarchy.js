const normalizeDesignation = (value = "") =>
  String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

export function isSdeDesignation(value = "") {
  return normalizeDesignation(value) === "sde";
}

export function isManagerDesignation(value = "") {
  return normalizeDesignation(value) === "manager";
}

export function isSrManagerDesignation(value = "") {
  const normalized = normalizeDesignation(value);
  return normalized === "srmanager" || normalized === "sr.manager";
}

export function isLeadershipDesignation(value = "") {
  return isManagerDesignation(value) || isSrManagerDesignation(value);
}

export function isMisExecutiveDesignation(value = "") {
  const normalized = normalizeDesignation(value);
  return normalized === "misexecutive" || normalized === "mis";
}

export function isCustomerSupportDesignation(value = "") {
  const normalized = normalizeDesignation(value);
  return (
    normalized === "customersupportexecutive" ||
    normalized === "customersupport" ||
    normalized === "support" ||
    normalized.includes("customersupport") ||
    normalized.includes("support")
  );
}


export function canTransferLead(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  // Dynamic: any user who has the student/update permission (whether from
  // their own role or inherited from subordinates) can transfer leads.
  // This replaces the old hardcoded Manager/Sr.Manager check.
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const studentRow = permissions.find(
    (row) => row && String(row.key).trim().toLowerCase().replace(/[\s._-]+/g, "") === "student"
  );
  if (!studentRow) return false;
  return Boolean(studentRow.basic?.update) || Boolean(studentRow.administrative?.updateAll);
}
