/**
 * Unit system for ASHRAE 62.1 calculations.
 *
 * The Standard specifies air-handling equations in I-P (cfm, ft², ft³) for
 * the U.S. implementation. SI values come from the equivalent SI tables in
 * the standard. This implementation ships **I-P only** for v2.0; SI is on
 * the roadmap but not implemented (see README).
 *
 * All flow values in the math layer are stored in **cfm** internally and
 * only converted at the formatting boundary.
 */

export type Units = 'ip';

export interface FlowValue {
  /** Numeric value, stored in internal units (cfm for I-P). */
  value: number;
  /** Which unit system this value is in. */
  units: Units;
}

export const toDisplayCfm = (v: number): string => {
  // For I-P we display cfm directly. Threshold formatting happens in UI.
  return v.toFixed(0);
};

export const toDisplayFt2 = (v: number): string => v.toFixed(0);

/** Convert ft² to m² (display only, not used in calcs). */
export const ft2ToM2 = (v: number): number => v * 0.09290304;

/** Convert cfm to L/s (display only, not used in calcs). */
export const cfmToLs = (v: number): number => v * 0.47194744;
