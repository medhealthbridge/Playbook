import "server-only";

export const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
export const int = (f: FormData, k: string, def = 0) => {
  const n = Number.parseInt(String(f.get(k) ?? ""), 10);
  return Number.isFinite(n) ? n : def;
};
export const pesoToCents = (f: FormData, k: string) => {
  const n = Number.parseFloat(String(f.get(k) ?? "").replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};
export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 50) || "venue";

export const METRO_AREAS = [
  "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila", "Marikina", "Muntinlupa", "Navotas",
  "Parañaque", "Pasay", "Pasig", "Pateros", "Quezon City", "San Juan", "Taguig", "Valenzuela",
];
