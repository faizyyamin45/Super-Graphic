// ============================================================
// UAE phone handling.
// The old form accepted /^[+\d][\d\s-]{6,}$/ — which passes "1234567"
// and every other seven-digit string, so unreachable numbers were
// being captured as leads. These helpers normalise to E.164 and
// validate against real UAE ranges.
// ============================================================

/** UAE mobile prefixes (after the 971 country code). */
const MOBILE_PREFIXES = ["50", "52", "54", "55", "56", "58"];
/** Landline area codes (Dubai 4, Abu Dhabi 2, Sharjah 6, etc). */
const LANDLINE_PREFIXES = ["2", "3", "4", "6", "7", "9"];

/**
 * Normalise any common UAE input shape to E.164 digits without the plus:
 *   "+971 55 446 9445" / "00971554469445" / "0554469445" / "554469445"
 *   all become "971554469445".
 * Returns "" when the input cannot be read as a UAE number.
 */
export function normalizeUAEPhone(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00971")) d = d.slice(5);
  else if (d.startsWith("971")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);

  if (MOBILE_PREFIXES.some((p) => d.startsWith(p)) && d.length === 9) return `971${d}`;
  if (LANDLINE_PREFIXES.some((p) => d.startsWith(p)) && d.length === 8) return `971${d}`;
  return "";
}

export function isValidUAEPhone(input) {
  return normalizeUAEPhone(input) !== "";
}

/** "971554469445" -> "+971 55 446 9445" for display. */
export function formatUAEPhone(input) {
  const e164 = normalizeUAEPhone(input);
  if (!e164) return String(input ?? "");
  const local = e164.slice(3);
  return local.length === 9
    ? `+971 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`
    : `+971 ${local.slice(0, 1)} ${local.slice(1, 4)} ${local.slice(4)}`;
}
