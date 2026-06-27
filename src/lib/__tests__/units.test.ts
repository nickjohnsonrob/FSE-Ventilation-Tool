/**
 * Tests for unit-system conversion helpers (`src/lib/units.ts`).
 *
 * Invariants:
 *   1. Every bidirectional converter inverts cleanly (round-trip).
 *   2. Canonical reference values match NIST SP 811 / ASHRAE 62.1-2022 SI Annex.
 *   3. Convenience functions (convertFlow/Area/Volume) short-circuit when
 *      from === to (no floating-point drift on identity).
 *   4. formatFlow / formatArea / formatTempDelta produce the expected
 *      localized strings for each unit system, including the zero edge case.
 *
 * Why ~25 tests: every converter needs a round-trip sweep across a range of
 * magnitudes (0, fractional, 1, 100, 1000, 1e6, MAX_SAFE_INTEGER), plus a
 * canonical-value anchor against NIST. That alone is 7×4 = 28 round-trip
 * cases. Plus 3 convenience-function groups and 3 canonical anchors.
 */
import { describe, it, expect } from 'vitest';
import {
  // Bidirectional converters
  ft2ToM2,
  m2ToFt2,
  cfmToM3s,
  m3sToCfm,
  ft3ToM3,
  m3ToFt3,
  deltaFToDeltaK,
  deltaKToDeltaF,
  // Convenience
  convertFlow,
  convertArea,
  convertVolume,
  formatFlow,
  formatArea,
  formatTempDelta,
} from '../units';

// Range of magnitudes a real engineer might throw at this. Includes 0 (edge
// case), sub-unit values, a "typical" 100–1000 zone/room value, a large
// building (1e6 ft²), and the IEEE-754 safe-integer ceiling (above which
// `Number` integer precision is lost and round-trips become meaningless).
const SAMPLES = [0, 0.001, 1, 100, 1000, 1e6, Number.MAX_SAFE_INTEGER];

describe('units — round-trip conversions', () => {
  it.each(SAMPLES)('cfm ↔ m³/s round-trips for %d cfm', (v) => {
    const si = cfmToM3s(v);
    const back = m3sToCfm(si);
    expect(back).toBeCloseTo(v, 6);
  });

  it.each(SAMPLES)('ft² ↔ m² round-trips for %d ft²', (v) => {
    const m = ft2ToM2(v);
    const back = m2ToFt2(m);
    expect(back).toBeCloseTo(v, 6);
  });

  it.each(SAMPLES)('ft³ ↔ m³ round-trips for %d ft³', (v) => {
    const m = ft3ToM3(v);
    const back = m3ToFt3(m);
    expect(back).toBeCloseTo(v, 6);
  });

  it.each(SAMPLES)('Δ°F ↔ ΔK round-trips for %d Δ°F', (v) => {
    const k = deltaFToDeltaK(v);
    const back = deltaKToDeltaF(k);
    expect(back).toBeCloseTo(v, 6);
  });
});

describe('units — convenience functions', () => {
  describe('convertFlow', () => {
    it('returns the input unchanged when from === to', () => {
      expect(convertFlow(500, 'ip', 'ip')).toBe(500);
      expect(convertFlow(0.5, 'si', 'si')).toBe(0.5);
    });

    it('ip → si → ip returns the original value', () => {
      const converted = convertFlow(500, 'ip', 'si');
      expect(converted).not.toBe(500); // it actually changed
      expect(convertFlow(converted, 'si', 'ip')).toBeCloseTo(500, 6);
    });

    it('si → ip → si returns the original value', () => {
      const converted = convertFlow(0.236, 'si', 'ip');
      expect(converted).not.toBe(0.236);
      expect(convertFlow(converted, 'ip', 'si')).toBeCloseTo(0.236, 6);
    });

    it('handles zero without producing NaN', () => {
      expect(convertFlow(0, 'ip', 'si')).toBe(0);
      expect(convertFlow(0, 'si', 'ip')).toBe(0);
    });
  });

  describe('convertArea', () => {
    it('returns the input unchanged when from === to', () => {
      expect(convertArea(1000, 'ip', 'ip')).toBe(1000);
      expect(convertArea(92.9, 'si', 'si')).toBe(92.9);
    });

    it('ip → si → ip returns the original value', () => {
      const converted = convertArea(1000, 'ip', 'si');
      expect(converted).not.toBe(1000);
      expect(convertArea(converted, 'si', 'ip')).toBeCloseTo(1000, 4);
    });
  });

  describe('convertVolume', () => {
    it('returns the input unchanged when from === to', () => {
      expect(convertVolume(1000, 'ip', 'ip')).toBe(1000);
    });

    it('ip → si → ip returns the original value', () => {
      const converted = convertVolume(5000, 'ip', 'si');
      expect(converted).not.toBe(5000);
      expect(convertVolume(converted, 'si', 'ip')).toBeCloseTo(5000, 4);
    });
  });

  describe('formatFlow', () => {
    it('produces "N cfm" for ip', () => {
      expect(formatFlow(500, 'ip')).toBe('500 cfm');
      expect(formatFlow(0, 'ip')).toBe('0 cfm');
      expect(formatFlow(1234.7, 'ip')).toBe('1235 cfm'); // toFixed(0) rounds
    });

    it('produces "N.NNN m³/s" for si', () => {
      expect(formatFlow(500, 'si')).toMatch(/m³\/s$/);
      expect(formatFlow(0, 'si')).toBe('0.000 m³/s');
    });

    it('si format converts the underlying cfm value', () => {
      // 500 cfm ≈ 0.236 m³/s
      expect(formatFlow(500, 'si')).toBe('0.236 m³/s');
    });
  });

  describe('formatArea', () => {
    it('produces "N ft²" for ip', () => {
      expect(formatArea(1000, 'ip')).toBe('1000 ft²');
      expect(formatArea(0, 'ip')).toBe('0 ft²');
    });

    it('produces "N.N m²" for si', () => {
      expect(formatArea(1000, 'si')).toMatch(/m²$/);
      // 1000 ft² ≈ 92.9 m² → toFixed(1) = "92.9"
      expect(formatArea(1000, 'si')).toBe('92.9 m²');
      expect(formatArea(0, 'si')).toBe('0.0 m²');
    });
  });

  describe('formatTempDelta', () => {
    it('produces "N.N °F" for ip', () => {
      expect(formatTempDelta(20, 'ip')).toBe('20.0 °F');
    });

    it('produces "N.NN K" for si', () => {
      expect(formatTempDelta(20, 'si')).toMatch(/K$/);
      // 20 Δ°F ≈ 11.111 ΔK → toFixed(2) = "11.11"
      expect(formatTempDelta(20, 'si')).toBe('11.11 K');
    });
  });
});

describe('units — canonical NIST reference values', () => {
  // These are the values engineers will recognize from spec books. Pinning
  // them catches any silent drift in the canonical factors.

  it('1000 ft² = 92.90304 m² (NIST SP 811)', () => {
    expect(ft2ToM2(1000)).toBeCloseTo(92.90304, 4);
  });

  it('500 cfm = 0.235974 m³/s (NIST)', () => {
    expect(cfmToM3s(500)).toBeCloseTo(0.235974, 5);
  });

  it('18 Δ°F = 10 ΔK (the canonical "10 K = 18 °F" identity)', () => {
    expect(deltaFToDeltaK(18)).toBeCloseTo(10, 6);
    expect(deltaKToDeltaF(10)).toBeCloseTo(18, 6);
  });

  it('1 m² = 10.7639 ft² (NIST, rounded)', () => {
    // 10.7639104 rounded to 4 decimal places = 10.7639
    expect(m2ToFt2(1)).toBeCloseTo(10.7639, 4);
  });

  it('1 m³/s = 2118.88 cfm (NIST, rounded)', () => {
    // 2118.880003 rounded to 2 decimal places = 2118.88
    expect(m3sToCfm(1)).toBeCloseTo(2118.88, 2);
  });

  it('100 ft³ = 2.83168 m³ (NIST)', () => {
    expect(ft3ToM3(100)).toBeCloseTo(2.83168, 5);
  });
});
