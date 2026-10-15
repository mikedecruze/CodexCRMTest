export function money(v: number | null | undefined, compact = false) {
  return v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 2,
      }).format(v);
}
export const number = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("en-US", { maximumFractionDigits: digits });
export const percentage = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${number(v, 1)}%`;
export const metricValue = (v: number | null | undefined, unit: string) =>
  unit === "USD" ? money(v) : unit === "PERCENT" ? percentage(v) : number(v, 2);
export function utcInput(value: string) {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
