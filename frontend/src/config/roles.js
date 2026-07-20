export const DEFAULT_ROLE_NAMES = [
  "Tech",
  "SDE",
  "Manager",
  "Sr.Manager",
  "MIS Executive",
  "Relationship Manager",
  "Customer Support Executive",
];

const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

export function sortRoleNames(names = []) {
  const order = new Map(DEFAULT_ROLE_NAMES.map((name, index) => [normalize(name), index]));
  return [...new Set((Array.isArray(names) ? names : []).filter(Boolean))].sort((a, b) => {
    const aRank = order.has(normalize(a)) ? order.get(normalize(a)) : Number.MAX_SAFE_INTEGER;
    const bRank = order.has(normalize(b)) ? order.get(normalize(b)) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return String(a).localeCompare(String(b));
  });
}

export function sortRoles(roles = []) {
  const order = new Map(DEFAULT_ROLE_NAMES.map((name, index) => [normalize(name), index]));
  return [...(Array.isArray(roles) ? roles : [])].sort((a, b) => {
    const aRank = order.has(normalize(a?.name)) ? order.get(normalize(a.name)) : Number.MAX_SAFE_INTEGER;
    const bRank = order.has(normalize(b?.name)) ? order.get(normalize(b.name)) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}
