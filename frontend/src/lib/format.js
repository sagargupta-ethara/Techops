export function cell(v) {
  if (v == null) return "No data";
  const s = String(v).trim();
  return s === "" ? "No data" : s;
}

export function pctText(p) {
  if (p == null) return "Not available";
  return `${p}%`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function fmtDay(d) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}
