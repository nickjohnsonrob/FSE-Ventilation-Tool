/**
 * Unit system for ASHRAE 62.1 calculations.
 *
 * The Standard specifies air-handling equations in I-P (cfm, ft², ft³) for
 * the U.S. implementation. SI values come from the equivalent SI tables in
 * the standard.
 *
 * Math core ALWAYS uses I-P canonical (cfm, ft²). Conversions are
 * display-only, applied at the format.ts / display boundary. This module
 * owns the unit-system *types* and the canonical conversion factors; the
 * display formatting itself lives in lib/format.ts.
 */

export type Units = 'ip' | 'si';

export interface FlowValue {
  /** Numeric value, stored in internal units (cfm for I-P). */
  value: number;
  /** Which unit system this value is in. */
  units: Units;
}

/**
 * Canonical conversion factors.
 *
 * These are the exact source-of-truth values used by the display layer.
 * Anywhere in the codebase that needs a ft²↔m² or cfm↔m³/s factor MUST
 * import these constants instead of inlining a literal.
 *
 * Source: NIST SP 811 (Guide for the Use of SI) + ASHRAE 62.1-2022 SI
 * Annex. Values match the standard's published conversion table to the
 * number of significant digits shown.
 */
export const FT2_PER_M2 = 10.7639104;
export const M2_PER_FT2 = 1 / FT2_PER_M2;
export const CFM_PER_M3S = 2118.880003;
export const M3S_PER_CFM = 1 / CFM_PER_M3S;

export const toDisplayCfm = (v: number): string => {
  // For I-P we display cfm directly. Threshold formatting happens in UI.
  return v.toFixed(0);
};

export const toDisplayFt2 = (v: number): string => v.toFixed(0);

// --- Bidirectional converters ----------------------------------------------
// Display-only. Never feed the output of these into the math core, which
// always works in cfm / ft².

/** Convert ft² to m² (display only). */
export const ft2ToM2 = (v: number): number => v * M2_PER_FT2;

/** Convert m² to ft² (display only). */
export const m2ToFt2 = (v: number): number => v * FT2_PER_M2;

/** Convert cfm to m³/s (display only). */
export const cfmToM3s = (v: number): number => v * M3S_PER_CFM;

/** Convert m³/s to cfm (display only). */
export const m3sToCfm = (v: number): number => v * CFM_PER_M3S;

/** Convert cfm to L/s (display only — L/s is the more common HVAC SI flow unit). */
export const cfmToLs = (v: number): number => v * CFM_TO_LS;

/** Convert L/s to cfm (display only). */
export const lsToCfm = (v: number): number => v / CFM_TO_LS;

// 1 cfm = 0.47194744 L/s. Kept as a literal here (not a derived constant)
// because the conversion target is L/s, not m³/s — pulling it out would
// obscure intent at the call site.
const CFM_TO_LS = 0.47194744;

// Volume (display only). Rarely needed for VRP, but useful for room-volume
// calcs (e.g. dilution ventilation for labs, kitchens).
export const FT3_PER_M3 = 35.3146667;
export const M3_PER_FT3 = 1 / FT3_PER_M3;

/** Convert ft³ to m³ (display only). */
export const ft3ToM3 = (v: number): number => v * M3_PER_FT3;

/** Convert m³ to ft³ (display only). */
export const m3ToFt3 = (v: number): number => v * FT3_PER_M3;

// Temperature deltas (display only).
// ASHRAE 62.1 uses °F deltas (e.g. cooling ΔT). SI uses K (or °C — the
// magnitudes are identical, since both scales have the same unit size).
// 1 Δ°F = 5/9 ΔK. Note this is a DELTA conversion, not an absolute
// temperature — use only for differences.
export const deltaFToDeltaK = (v: number): number => v * (5 / 9);
export const deltaKToDeltaF = (v: number): number => v * (9 / 5);

// --- High-level convenience functions --------------------------------------
// P0.2 plumbing: these wrap the bidirectional converters so the UI layer
// (P0.3) can call e.g. `formatFlow(value, unitSystem)` without branching on
// the conversion direction. Math core is NEVER touched by these — they only
// operate at the display boundary.

/** Convert a flow value between unit systems. Same-units returns input. */
export function convertFlow(value: number, from: Units, to: Units): number {
  if (from === to) return value;
  if (from === 'ip' && to === 'si') return cfmToM3s(value);
  return m3sToCfm(value); // 'si' → 'ip'
}

/** Convert an area value between unit systems. Same-units returns input. */
export function convertArea(value: number, from: Units, to: Units): number {
  if (from === to) return value;
  if (from === 'ip' && to === 'si') return ft2ToM2(value);
  return m2ToFt2(value); // 'si' → 'ip'
}

/** Convert a volume value between unit systems. Same-units returns input. */
export function convertVolume(value: number, from: Units, to: Units): number {
  if (from === to) return value;
  if (from === 'ip' && to === 'si') return ft3ToM3(value);
  return m3ToFt3(value); // 'si' → 'ip'
}

/**
 * Format a flow value (stored in cfm internally) for display in the given
 * unit system. I-P prints cfm directly; SI converts to m³/s.
 *
 * Returns a placeholder (`— cfm` / `— m³/s`) for NaN / Infinity so the UI
 * never renders the literal string "NaN cfm".
 */
export function formatFlow(value: number, units: Units): string {
  if (!Number.isFinite(value)) {
    return units === 'ip' ? '— cfm' : '— m³/s';
  }
  if (units === 'ip') return `${value.toFixed(0)} cfm`;
  return `${cfmToM3s(value).toFixed(3)} m³/s`;
}

/**
 * Format an area value (stored in ft² internally) for display in the given
 * unit system. I-P prints ft² directly; SI converts to m².
 *
 * Returns a placeholder (`— ft²` / `— m²`) for NaN / Infinity.
 */
export function formatArea(value: number, units: Units): string {
  if (!Number.isFinite(value)) {
    return units === 'ip' ? '— ft²' : '— m²';
  }
  if (units === 'ip') return `${value.toFixed(0)} ft²`;
  return `${ft2ToM2(value).toFixed(1)} m²`;
}

/**
 * Format a temperature DELTA (stored in °F internally) for display in the
 * given unit system. I-P prints °F directly; SI converts to K. Note this
 * is for differences only — for absolute temperatures see `formatTempAbs`.
 */
export function formatTempDelta(value: number, units: Units): string {
  if (units === 'ip') return `${value.toFixed(1)} °F`;
  return `${deltaFToDeltaK(value).toFixed(2)} K`;
}
