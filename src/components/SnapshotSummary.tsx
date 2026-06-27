/**
 * summarizeSnapshot — produce a one-line human-readable summary of a
 * snapshot's state for display in the Library modal row.
 *
 * Format: "{N} AHU(s), {M} zones total, Vot={total} cfm"
 *
 * Why a separate file? The Library row needs to render this string in
 * JSX, but the pure function is also useful in tests (asserting the
 * expected shape). Keeping it in /components (not /lib) because the
 * output is presentational, not part of the math core.
 *
 * The total Vot is computed by summing per-AHU Vot. The math core is
 * unchanged — we just call compute() per AHU.
 */
import { compute } from '../lib/ashrae621';
import type { SerializedState } from '../lib/storage/snapshots';

/** Round to nearest integer cfm for display (avoids "220.00000001" noise). */
function fmtCfm(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n));
}

/**
 * Render a one-line summary of a snapshot's state.
 *
 * Handles:
 *   - empty / zero-AHU state ("0 AHUs, 0 zones total, Vot=0 cfm")
 *   - singular vs plural AHU
 *   - missing/corrupt `vot` field (defaults to 0)
 */
export function summarizeSnapshot(state: SerializedState): string {
  const ahus = state?.ahus ?? [];
  const totalZones = ahus.reduce((n, a) => n + (a?.zones?.length ?? 0), 0);
  const totalVot = ahus.reduce((sum, a) => {
    try {
      return sum + (compute(a)?.vot ?? 0);
    } catch {
      return sum;
    }
  }, 0);
  const ahuLabel = ahus.length === 1 ? '1 AHU' : `${ahus.length} AHUs`;
  return `${ahuLabel}, ${totalZones} zones total, Vot=${fmtCfm(totalVot)} cfm`;
}
