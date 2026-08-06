const normalizeDesignation = (value = "") =>
  String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

export function isSdeDesignation(value = "") {
  const norm = normalizeDesignation(value);
  return norm === "sde" || norm === "sd" || norm === "salesdeveloper";
}

export function isManagerDesignation(value = "") {
  return normalizeDesignation(value) === "manager";
}

export function isSrManagerDesignation(value = "") {
  const norm = normalizeDesignation(value);
  if (!norm) return false;
  if (norm === "manager") return false;

  const excluded = [
    "sde", "sd", "salesdeveloper", "admin",
    "misexecutive", "mis", "customersupportexecutive",
    "customersupport", "support", "relationshipmanager", "tech"
  ];
  const isExcluded = excluded.some(ex => norm === ex || norm.includes(ex));
  if (isExcluded) return false;

  return (
    norm.includes("srmanager") ||
    norm.includes("sr.manager") ||
    norm.includes("seniormanager") ||
    norm === "agm" ||
    norm.includes("vp") ||
    norm.includes("vicepresident") ||
    norm.includes("director") ||
    norm.includes("ultraseniormanager") ||
    norm.includes("ultrasenior")
  );
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
  if (isSdeDesignation(user.designation || user.role)) return false;
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
