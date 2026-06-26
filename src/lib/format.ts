/**
 * Formatting utilities — display-layer only.
 *
 * The math layer never rounds. All rounding is at the boundary where a
 * number becomes a string.
 */

/** Format a flow value (cfm) for display: integer when ≥ 100, else 1 decimal. */
export function fmtCfm(v: number): string {
  if (!isFinite(v) || isNaN(v)) return '—';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(1);
}

/** Format an area (ft²) for display: integer. */
export function fmtFt2(v: number): string {
  if (!isFinite(v) || isNaN(v)) return '—';
  return v.toFixed(0);
}

/** Format a population count. */
export function fmtPeople(v: number): string {
  if (!isFinite(v) || isNaN(v)) return '—';
  return v.toFixed(0);
}

/** Format a percentage (0..1 input → 0..100% output). */
export function fmtPct(v: number, decimals = 1): string {
  if (!isFinite(v) || isNaN(v)) return '—';
  return (v * 100).toFixed(decimals) + '%';
}

/** Format a dimensionless ratio (Ep, Er, Zd, Xs, Ev, Ez). */
export function fmtRatio(v: number, decimals = 3): string {
  if (!isFinite(v) || isNaN(v)) return '—';
  return v.toFixed(decimals);
}

/** Parse a user-entered number string. Returns undefined for empty/invalid. */
export function parseNumOr(s: string): number | undefined {
  if (s === '' || s == null) return undefined;
  const n = Number(s);
  return isFinite(n) ? n : undefined;
}
