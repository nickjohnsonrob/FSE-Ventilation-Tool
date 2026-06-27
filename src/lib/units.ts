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
export const FT2_PER_M2 = 10.7639;
export const M2_PER_FT2 = 1 / FT2_PER_M2;
export const CFM_PER_M3S = 2118.88;
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