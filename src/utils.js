export function cleanString(value, max = 10000) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
}

export function positiveInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidUrl(value) {
  try { return Boolean(value && new URL(value)); } catch { return false; }
}
