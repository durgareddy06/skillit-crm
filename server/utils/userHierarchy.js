export function normalizeDesignation(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

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


