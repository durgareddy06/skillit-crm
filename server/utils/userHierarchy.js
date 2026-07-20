export function normalizeDesignation(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

export function isSdeDesignation(value = "") {
  return normalizeDesignation(value) === "sde";
}

export function isManagerDesignation(value = "") {
  return normalizeDesignation(value) === "manager";
}

export function isSrManagerDesignation(value = "") {
  return normalizeDesignation(value) === "sr.manager" || normalizeDesignation(value) === "srmanager";
}

export function isLeadershipDesignation(value = "") {
  const designation = normalizeDesignation(value);
  return designation === "manager" || designation === "sr.manager" || designation === "srmanager";
}

export function isMisExecutiveDesignation(value = "") {
  const designation = normalizeDesignation(value);
  return designation === "misexecutive" || designation === "mis";
}

export function isCustomerSupportDesignation(value = "") {
  const designation = normalizeDesignation(value);
  return (
    designation === "customersupportexecutive" ||
    designation === "customersupport" ||
    designation === "support" ||
    designation.includes("customersupport") ||
    designation.includes("support")
  );
}


