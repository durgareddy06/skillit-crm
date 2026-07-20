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
  const designation = user.designation || user.role;
  return isManagerDesignation(designation) || isSrManagerDesignation(designation);
}
