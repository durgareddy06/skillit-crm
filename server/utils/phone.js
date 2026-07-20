export function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

export function normalizePhone(value = "") {
  return digitsOnly(value).slice(-10);
}
