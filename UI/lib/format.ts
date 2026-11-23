import type { ZipFeature } from "./types";

export function formatFeatureValue(f: ZipFeature): string {
  if (f.value === null || f.value === undefined || f.value === "") return "—";
  if (typeof f.value === "string") return f.value;
  const unit = f.unit ?? "";
  if (unit.startsWith("$")) return `$${Math.round(f.value).toLocaleString("en-US")}${unit.slice(1)}`;
  if (unit === "%") return `${Math.round(f.value)}%`;
  const n = Number.isInteger(f.value) ? f.value.toLocaleString("en-US") : f.value.toFixed(2);
  return unit ? `${n} ${unit}` : n;
}
