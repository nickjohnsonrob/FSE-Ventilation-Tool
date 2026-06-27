import { describe, it, expect } from 'vitest';
import {
  calcD,
  calcEp,
  calcEvFromTable,
  calcEvz,
  calcEvzCoeffs,
  calcVbz,
  calcVot,
  calcVou,
  calcVoz,
  calcXs,
  calcZd,
  compute,
  type AhuInput,
  type MultiZoneResult,
  type SingleZoneResult,
} from '../ashrae621';
import { OCCUPANCY_CATEGORIES, TABLE_6_3_BREAKPOINTS } from '../tables';

/** Narrow the union compute() returns to the multi-zone shape. */
function asMulti(r: MultiZoneResult | SingleZoneResult): MultiZoneResult {
  if (!('xs' in r)) throw new Error('expected multi-zone result');
  return r as MultiZoneResult;
}

/** Narrow the union compute() returns to the single-zone shape. */
function asSingle(r: MultiZoneResult | SingleZoneResult): SingleZoneResult {
  if (!('vbz' in r)) throw new Error('expected single-zone result');
  return r as SingleZoneResult;
}

describe('ASHRAE 62.1-2022 — §6.2 core equations', () => {
  it('Vbz = Pz·Rp + Az·Ra  (Office space, 10 ppl, 1000 ft²)', () => {
    // Office space: Rp=5 cfm/person, Ra=0.06 cfm/ft²
    // Vbz = 10*5 + 1000*0.06 = 50 + 60 = 110 cfm
    expect(calcVbz(10, 1000, 5, 0.06)).toBeCloseTo(110, 2);
  });

  it('Voz = Vbz / Ez', () => {
    expect(calcVoz(110, 1.0)).toBeCloseTo(110, 2);
    expect(calcVoz(110, 0.8)).toBeCloseTo(137.5, 2);
    expect(calcVoz(110, 0)).toBe(0); // defensive
  });

  it('Ep = min(Vpz/Vdz, 1) — clamped to 1 when primary ≥ discharge', () => {
    expect(calcEp(600, 600)).toBeCloseTo(1, 3);
    expect(calcEp(400, 600)).toBeCloseTo(0.6667, 3);
    expect(calcEp(0, 600)).toBe(0);
    expect(calcEp(600, 0)).toBe(1); // defensive: Vdz=0 → degenerate, return 1
  });

  it('Zd = Voz / Vdzm', () => {
    expect(calcZd(110, 1100)).toBeCloseTo(0.1, 3);
    expect(calcZd(110, 0)).toBe(0);
  });

  it('D = Ps / ΣPz', () => {
    expect(calcD(20, 20)).toBe(1);
    expect(calcD(10, 20)).toBeCloseTo(0.5, 3);
    expect(calcD(0, 0)).toBe(1); // defensive
  });

  it('Vou = D · Σ(Pz·Rp) + Σ(Az·Ra)', () => {
    // Same 10/1000 office twice. D=1 (ps=20, sumPz=20), sumPzRp=100, sumAzRa=120.
    expect(calcVou(1, 100, 120)).toBeCloseTo(220, 2);
    // D=0.5 halves the people-component
    expect(calcVou(0.5, 100, 120)).toBeCloseTo(170, 2);
  });

  it('Xs = Vou / Vps', () => {
    expect(calcXs(220, 1200)).toBeCloseTo(0.18333, 3);
    expect(calcXs(220, 0)).toBe(0);
  });

  it('Vot = Vou / Ev', () => {
    expect(calcVot(220, 1.0)).toBeCloseTo(220, 2);
    expect(calcVot(220, 0.5)).toBeCloseTo(440, 2);
    expect(calcVot(220, 0)).toBe(0);
  });

  it('Evz coefficient formulas', () => {
    // For single-duct (Er=0, Ep=1, Ez=1): Fa=1, Fb=1, Fc=1
    const { fa, fb, fc } = calcEvzCoeffs(1, 0, 1);
    expect(fa).toBeCloseTo(1, 3);
    expect(fb).toBeCloseTo(1, 3);
    expect(fc).toBeCloseTo(1, 3);
  });

  it('Evz = (Fa + Xs·Fb - Zd·Fc) / Fa — single-duct, identical zones, no Zd', () => {
    // Same-zone: Fa=Fb=Fc=1, Zd=0, Evz = (1 + Xs·1 - 0)/1 = 1 + Xs
    // Xs = 220/1200 = 0.18333
    const coeffs = calcEvzCoeffs(1, 0, 1);
    const evz = calcEvz(coeffs.fa, coeffs.fb, coeffs.fc, 0.18333, 0);
    expect(evz).toBeCloseTo(1.18333, 3);
  });
});

describe('Table 6-3 — Simplified Ventilation Efficiency breakpoints', () => {
  it('Exposed breakpoints match Table 6-3 published values', () => {
    expect(TABLE_6_3_BREAKPOINTS).toEqual([
      { maxZp: 0.25, ev: 0.9 },
      { maxZp: 0.35, ev: 0.8 },
      { maxZp: 0.45, ev: 0.7 },
      { maxZp: 0.55, ev: 0.6 },
      { maxZp: Infinity, ev: 0.5 },
    ]);
  });

  it.each<[number, number]>([
    [0.0, 0.9],
    [0.1, 0.9],
    [0.25, 0.9], // inclusive upper bound
    [0.2501, 0.8],
    [0.3, 0.8],
    [0.35, 0.8],
    [0.4, 0.7],
    [0.45, 0.7],
    [0.5, 0.6],
    [0.55, 0.6],
    [0.6, 0.5],
    [1.0, 0.5],
  ])('Zd = %s → Ev = %s', (zd, ev) => {
    expect(calcEvFromTable(zd)).toBeCloseTo(ev, 3);
  });

  it('Floating-point edge: 0.2499999 → 0.9 (snap to 3 decimals)', () => {
    expect(calcEvFromTable(0.2499999)).toBeCloseTo(0.9, 3);
  });

  it('Floating-point edge: 0.2500001 → 0.8', () => {
    expect(calcEvFromTable(0.2500001)).toBeCloseTo(0.8, 3);
  });
});

describe('Table 6-1 occupancy categories — transcription integrity', () => {
  it('Office space rates', () => {
    expect(OCCUPANCY_CATEGORIES['Office space']).toEqual([5, 0.06]);
  });

  it('Corridors have Rp=0 (no people component)', () => {
    expect(OCCUPANCY_CATEGORIES['Corridors'][0]).toBe(0);
  });

  it('All rates are non-negative', () => {
    for (const [name, [rp, ra]] of Object.entries(OCCUPANCY_CATEGORIES)) {
      expect(rp, `${name}.Rp`).toBeGreaterThanOrEqual(0);
      expect(ra, `${name}.Ra`).toBeGreaterThanOrEqual(0);
    }
  });

  it('Has ≥ 60 categories (sanity check on completeness)', () => {
    expect(Object.keys(OCCUPANCY_CATEGORIES).length).toBeGreaterThanOrEqual(60);
  });
});

describe('compute() — multi-zone Appendix A', () => {
  // 2-zone office: identical zones, Vpz=Vdz=600, no turndown specified
  // (→ vpzMin defaults to vpz), no Vdzm constraint (→ vdzm=0, Ep=1, Zd=0).
  // With no fan-powered boxes (box='single'), Er=0; so A-4 collapses to A-2:
  //   Evz = 1 + Xs − Zpz·Ep   (with Ep=1) = 1 + Xs − Zpz.
  // Per-zone: Vbz = 110, Voz = 110, Zpz = 110/600 = 0.18333.
  // Vou = 220 (D=1), Xs = 220/1200 = 0.18333.
  // Evz = 1 + 0.18333 − 0.18333 = 1; Ev = min(1, 1) = 1.
  const baseAhu: AhuInput = {
    type: 'multizone',
    method: 'appendixA',
    psAuto: true,
    ps: 0,
    vpsAuto: true,
    vps: 0,
    zones: [
      {
        id: 'z1',
        tag: 'TU-1-01',
        space: 'Office space',
        area: 1000,
        pop: 10,
        vpz: 600,
        vdz: 600,
        ezConfig: 'Ceiling supply of cool air',
        box: 'single',
        er: 0,
      },
      {
        id: 'z2',
        tag: 'TU-1-02',
        space: 'Office space',
        area: 1000,
        pop: 10,
        vpz: 600,
        vdz: 600,
        ezConfig: 'Ceiling supply of cool air',
        box: 'single',
        er: 0,
      },
    ],
  };

  it('identical TUs (no Vdzm → Ep=1, Zpz·Ep = Zpz; Evz collapses to 1+Xs−Zpz)', () => {
    const r = asMulti(compute(baseAhu));
    expect(r.vou).toBeCloseTo(220, 2);
    expect(r.xs).toBeCloseTo(220 / 1200, 3);
    expect(r.sumPz).toBe(20);
    expect(r.sumArea).toBe(2000);
  });

  it('Evz = 1 (Appendix A min), Vou/Xs/Evz values match vrp.py outputs', () => {
    const r = asMulti(compute(baseAhu));
    // Evz = (Fa + Xs·Fb − Zpz·Ep·Fc)/Fa
    // For single-duct: Ep=1, Er=0, Ez=1 → Fa=1, Fb=1, Fc=1
    // Evz = 1 + 0.18333 − 0.18333 = 1
    expect(r.evA).toBeCloseTo(1, 3);
    expect(r.ev).toBeCloseTo(1, 3);
  });

  it('Vot = Vou / Ev = 220 (Ev=1 → Vot=Vou)', () => {
    const r = asMulti(compute(baseAhu));
    expect(r.vot).toBeCloseTo(220, 2);
  });

  it('Fan-powered + Er > 0 changes Fa/Fb/Fc; Evz formula path', () => {
    // With box='series', vdz=800 → Ep = 600/800 = 0.75.
    // With Er=0.5 → Fa = 0.875, Fb = 0.75, Fc = 1 (because Ez=1).
    // Vou stays 220 (both zones), Vps = 2 × 600 = 1200, Xs = 220/1200.
    // Zpz = 110/600 = 0.18333 (turndown = design in this case).
    // Evz = (Fa + Xs·Fb − Zpz·Ep·Fc) / Fa
    //     = (0.875 + 0.18333·0.75 − 0.18333·0.75·1) / 0.875
    //     = (0.875 + 0.1375 − 0.1375) / 0.875 = 1
    //
    // Note the Zpz·Ep and Xs·Fb terms cancel exactly because Ep·Fc = 1
    // and Zpz is numerically close to Xs·Fb/(Ep·Fc). The key insight is
    // that the Evz coefficient path is active (not the single-supply A-2
    // collapse) when Fc is not constrained by Ez < 1.
    const ahu: AhuInput = {
      ...baseAhu,
      zones: baseAhu.zones.map((z) => ({
        ...z,
        box: 'series' as const,
        vdz: 800,
        vdzm: 0,
        er: 0.5,
      })),
    };
    const r = asMulti(compute(ahu));
    expect(r.rows[0].ep).toBeCloseTo(0.75, 3);
    expect(r.rows[0].fa).toBeCloseTo(0.875, 3);
    expect(r.rows[0].fb).toBeCloseTo(0.75, 3);
    expect(r.rows[0].fc).toBeCloseTo(1, 3);
    // The Evz formula path produces 1 for this exact configuration.
    expect(r.evA).toBeCloseTo(1, 3);
  });

  it('Fc < 1 (Ez < 1) lowers Evz via the A-4 correction term', () => {
    // Same as above but with Ez = 0.5 (floor supply, ceiling return) so
    // Fc = 1 − (1−0.5)(1−0.5)(1−0.75) = 1 − 0.0625 = 0.9375.
    // Then Evz = (0.875 + 0.1375 − 0.18333·0.75·0.9375) / 0.875
    //         = (0.875 + 0.1375 − 0.1289) / 0.875 = 0.8836/0.875 = 1.0098
    // Hmm, still > 1. Try with Ep=0.5 instead — would need vpzMin<vpz.
    // The cleaner test: Ez=0.5 with Vpz=400 (Ep = 400/800 = 0.5).
    //   Fa = 0.5 + 0.5·0.5 = 0.75
    //   Fb = 0.5
    //   Fc = 1 − 0.5·0.5·0.5 = 0.875
    //   Zpz = Voz/400 = (5·10+0.06·1000)/400 / Ez = 110/(0.5·400) = 110/200 = 0.55
    //   Evz = (0.75 + 0.18333·0.5 − 0.55·0.5·0.875) / 0.75
    //       = (0.75 + 0.0917 − 0.2406) / 0.75 = 0.6011/0.75 = 0.8014
    // Ez = 0.7 (Floor supply warm air + ceiling return).
    // Ep = 400/800 = 0.5; Er = 0.5.
    //   Fa = 0.5 + 0.5·0.5 = 0.75
    //   Fb = 0.5
    //   Fc = 1 − (1−0.7)(1−0.5)(1−0.5) = 1 − 0.075 = 0.925
    //   Voz = Vbz/Ez = 110/0.7 = 157.14 ; Zpz = 157.14/400 = 0.39286
    //   Vou = Vbz (D=1) = 110 ; Xs = 110/400 = 0.275
    //   Evz = (0.75 + 0.275·0.5 − 0.39286·0.5·0.925) / 0.75
    //       = (0.75 + 0.1375 − 0.1817) / 0.75 = 0.7058/0.75 = 0.9411
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'appendixA',
      psAuto: true,
      ps: 0,
      vpsAuto: true,
      vps: 0,
      zones: [
        {
          id: 'z1',
          tag: 'A',
          space: 'Office space',
          area: 1000,
          pop: 10,
          vpz: 400,
          vdz: 800,
          vdzm: 0,
          ezConfig: 'Floor supply of warm air & ceiling return', // Ez = 0.7
          box: 'series',
          er: 0.5,
        },
      ],
    };
    const r = asMulti(compute(ahu));
    expect(r.rows[0].ep).toBeCloseTo(0.5, 3);
    expect(r.rows[0].ez).toBeCloseTo(0.7, 3);
    expect(r.rows[0].fa).toBeCloseTo(0.75, 3);
    expect(r.rows[0].fb).toBeCloseTo(0.5, 3);
    expect(r.rows[0].fc).toBeCloseTo(0.925, 3);
    expect(r.rows[0].voz).toBeCloseTo(110 / 0.7, 2);
    expect(r.rows[0].zpz).toBeCloseTo((110 / 0.7) / 400, 3);
    expect(r.rows[0].evz).toBeCloseTo(0.9411, 3);
    expect(r.evA).toBeCloseTo(0.9411, 3);
  });
});

describe('compute() — matches uploads/test_vrp.py known-answer cases', () => {
  // These cases mirror uploads/test_vrp.py so a regression in either engine
  // shows up in both. See HANDOFF.md §9 — vrp.py is the most-tested reference.
  //
  // Note: the Python tests use zones with explicit rp/ra fields; we look up
  // rates from OCCUPANCY_CATEGORIES so the test asserts via the public API.

  // Office space: Rp=5, Ra=0.06 ; Conference/meeting: Rp=5, Ra=0.06.
  // Both have identical rates — the Python tests rely on this.

  it('test_single_zone_equation_6_1_and_6_2', () => {
    // Python: Vbz = 5*10 + 0.06*1000 = 110 ; Voz = 110/1 = 110.
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'appendixA',
      psAuto: true,
      ps: 0,
      vpsAuto: true,
      vps: 0,
      zones: [
        {
          id: 'z1',
          tag: 'Z1',
          space: 'Office space',
          area: 1000,
          pop: 10,
          vpz: 1000,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    };
    const r = asMulti(compute(ahu));
    expect(r.rows[0].vbz).toBeCloseTo(110, 2);
    expect(r.rows[0].voz).toBeCloseTo(110, 2);
  });

  it('test_diversity_and_vou_equations_6_5_6_6', () => {
    // Python: zones A (5000 ft², 30 ppl) + B (1000 ft², 50 ppl), ps=60.
    // SumPz=80, D=60/80=0.75 ; Vou = 0.75*(5*30+5*50) + 0.06*(5000+1000)
    //                            = 0.75*400 + 0.06*6000
    //                            = 300 + 360 = 660.
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'simplified',
      simplifiedMethod: 'eq6-7-6-8',
      psAuto: false,
      ps: 60,
      vpsAuto: false,
      vps: 0,
      zones: [
        {
          id: 'a',
          tag: 'A',
          space: 'Office space',
          area: 5000,
          pop: 30,
          vpz: 5000,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
        {
          id: 'b',
          tag: 'B',
          space: 'Conference/meeting', // alias for "Conference / meeting"
          area: 1000,
          pop: 50,
          vpz: 2000,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    };
    const r = asMulti(compute(ahu));
    expect(r.D).toBeCloseTo(0.75, 3);
    expect(r.vou).toBeCloseTo(660, 2);
  });

  it('test_simplified_efficiency_equations_6_7_6_8 (low D)', () => {
    // Python: ps_override=4, D=4/10=0.4 → Ev = 0.88·0.4 + 0.22 = 0.572.
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'simplified',
      simplifiedMethod: 'eq6-7-6-8',
      psAuto: false,
      ps: 4,
      vpsAuto: false,
      vps: 0,
      zones: [
        {
          id: 'z1',
          tag: 'A',
          space: 'Office space',
          area: 1000,
          pop: 10,
          vpz: 1000,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    };
    const r = asMulti(compute(ahu));
    expect(r.evS).toBeCloseTo(0.572, 3);
    expect(r.ev).toBeCloseTo(0.572, 3);
  });

  it('test_simplified_efficiency_equations_6_7_6_8 (high D)', () => {
    // Python: ps_override=10, D=10/10=1.0 ≥ 0.6 → Ev = 0.75.
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'simplified',
      simplifiedMethod: 'eq6-7-6-8',
      psAuto: false,
      ps: 10,
      vpsAuto: false,
      vps: 0,
      zones: [
        {
          id: 'z1',
          tag: 'A',
          space: 'Office space',
          area: 1000,
          pop: 10,
          vpz: 1000,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    };
    const r = asMulti(compute(ahu));
    expect(r.evS).toBeCloseTo(0.75, 3);
    expect(r.ev).toBeCloseTo(0.75, 3);
  });

  it('test_appendix_a_single_supply_equations_a1_a2_a3', () => {
    // Python: ps=70, vps=8500. SumPz=80, D=70/80=0.875.
    // Vou = 0.875*400 + 360 = 710 ; Xs = 710/8500 = 0.0835.
    // Zone B: Vbz=5*50+0.06*1000=310, Voz=310, vpz_min=600, Zpz=310/600=0.5167.
    // Evz_B = 1 + 0.0835 − 0.5167 = 0.5668 (single-supply A-2 form, since Er=0).
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'appendixA',
      psAuto: false,
      ps: 70,
      vpsAuto: false,
      vps: 8500,
      zones: [
        {
          id: 'a',
          tag: 'A',
          space: 'Office space',
          area: 5000,
          pop: 30,
          vpz: 5000,
          vpzMin: 1500,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
        {
          id: 'b',
          tag: 'B',
          space: 'Conference/meeting',
          area: 1000,
          pop: 50,
          vpz: 2000,
          vpzMin: 600,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    };
    const r = asMulti(compute(ahu));
    expect(r.xs).toBeCloseTo(0.0835, 3);
    const b = r.rows.find((row) => row.z.tag === 'B');
    expect(b?.zpz).toBeCloseTo(0.5167, 3);
    // Single-duct (Er=0, Ep=1) → Evz_A2 collapses to 1 + Xs − Zpz·Ep
    //                                  = 1 + 0.0835 − 0.5167 = 0.5668.
    expect(b?.evz).toBeCloseTo(0.5668, 3);
    // Critical zone is B (lower Evz).
    expect(r.crit?.z.tag).toBe('B');
  });
});

describe('compute() — multi-zone Simplified §6.2.5.1', () => {
  const baseAhu: AhuInput = {
    type: 'multizone',
    method: 'simplified',
    psAuto: true,
    ps: 0,
    vpsAuto: true,
    vps: 0,
    zones: [
      {
        id: 'z1',
        tag: 'TU-1-01',
        space: 'Office space',
        area: 1000,
        pop: 10,
        vpz: 600,
        vdz: 600,
        vdzm: 220, // forces Zd = 110/220 = 0.5
        ezConfig: 'Ceiling supply of cool air',
        box: 'single',
        er: 0,
      },
    ],
  };

  it('Uses Table 6-3 instead of Evz = min(...)', () => {
    const r = asMulti(compute(baseAhu));
    // Zd = 110/220 = 0.5 → Ev = 0.6 (Table 6-3)
    expect(r.maxZp).toBeCloseTo(0.5, 3);
    expect(r.evS).toBeCloseTo(0.6, 3);
    expect(r.ev).toBeCloseTo(0.6, 3);
    expect(r.simp).toBe(true);
  });
});

describe('compute() — single-zone §6.2.5.1', () => {
  it('Ev = 1, Vot = Voz = Vbz/Ez', () => {
    const ahu: AhuInput = {
      type: 'singlezone',
      szMode: 'critical',
      psAuto: true,
      ps: 0,
      vpsAuto: true,
      vps: 0,
      zones: [
        {
          id: 'z1',
          tag: 'RM-01',
          space: 'Office space',
          area: 800,
          pop: 8,
          vpz: 600,
          vdz: 600,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    };
    const r = asSingle(compute(ahu));
    expect(r.vbz).toBeCloseTo(88, 2); // 8*5 + 800*0.06
    expect(r.voz).toBeCloseTo(88, 2); // Vbz / Ez=1
    expect(r.vot).toBeCloseTo(88, 2); // Ev=1 ⇒ Vot=Voz
  });

  it('Critical-room rollup dominates over sum-Vbz when room Zps differ', () => {
    // 2 rooms with very different Zps — the worst one drives.
    const ahu: AhuInput = {
      type: 'singlezone',
      szMode: 'critical',
      psAuto: true,
      ps: 0,
      vpsAuto: true,
      vps: 0,
      zones: [
        {
          id: 'z1',
          space: 'Office space',
          area: 800,
          pop: 8,
          vpz: 600,
          vdz: 600,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
          rooms: [
            // room A: low Zp
            {
              id: 'r1',
              space: 'Office space',
              area: 400,
              pop: 4,
              vpz: 400,
              ezConfig: 'Ceiling supply of cool air',
            },
            // room B: high Zp (small flow, normal OA)
            {
              id: 'r2',
              space: 'Office space',
              area: 400,
              pop: 4,
              vpz: 100, // small flow → high Zp
              ezConfig: 'Ceiling supply of cool air',
            },
          ],
        },
      ],
    };
    const r = asSingle(compute(ahu));
    // ΣVpz = 500; room B Zp = (4*5 + 400*0.06)/100 = 44/100 = 0.44
    // Voz = 0.44 * 500 = 220 cfm — that's what the TU must deliver.
    expect(r.voz).toBeCloseTo(220, 2);
  });
});

describe('compute() — robustness', () => {
  it('Unknown space label → Rp=Ra=0 → Vbz driven by area only', () => {
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'appendixA',
      psAuto: true,
      ps: 0,
      vpsAuto: true,
      vps: 0,
      zones: [
        {
          id: 'z1',
          space: 'A category that does not exist',
          area: 1000,
          pop: 5,
          vpz: 500,
          vdz: 500,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    };
    const r = asMulti(compute(ahu));
    // Unknown space → Rp=Ra=0 → Vbz = 0
    expect(r.vou).toBe(0);
  });

  it('Empty zones array → Vou = 0, Vot = 0', () => {
    const ahu: AhuInput = {
      type: 'multizone',
      method: 'appendixA',
      psAuto: true,
      ps: 0,
      vpsAuto: true,
      vps: 0,
      zones: [],
    };
    const r = asMulti(compute(ahu));
    expect(r.vou).toBe(0);
    expect(r.vot).toBe(0);
    expect(r.ev).toBe(1); // degenerate: no crit
  });
});

describe('compute() — property tests', () => {
  // Property: Vot is monotonic in Vou for fixed Ev.
  // Property: Vot is monotonic in 1/Ev for fixed Vou (smaller Ev → bigger Vot).
  // Property: oaPct ∈ [0, 1] when Vps > 0 and Ev ≤ 1.
  // Property: Vbz is monotonic in Pz, Az.

  it('Vbz is monotonic in population and area', () => {
    expect(calcVbz(0, 1000, 5, 0.06)).toBeCloseTo(60, 2);
    expect(calcVbz(10, 1000, 5, 0.06)).toBeCloseTo(110, 2);
    expect(calcVbz(10, 2000, 5, 0.06)).toBeCloseTo(170, 2);
  });

  it('Vot increases as Ev decreases (for fixed Vou)', () => {
    expect(calcVot(220, 1.0)).toBeCloseTo(220, 2);
    expect(calcVot(220, 0.8)).toBeCloseTo(275, 2);
    expect(calcVot(220, 0.5)).toBeCloseTo(440, 2);
  });
});

describe('compute() — DR / DC / DC+ system type', () => {
  // The systemType field is display-only on the trace. It MUST NOT
  // change the math core output. This is the contract that lets the
  // AhuPicker dropdown re-style the EquationTrace without re-computing
  // anything.
  //
  // Use the canonical 2-zone 1000-ft²/10-people office fixture:
  // Vbz = 110/zone, Vou = 220, Xs = 220/1200, Ev = 1, Vot = 220.

  const baseAhu = (systemType: 'DR' | 'DC' | 'DC+' | undefined): AhuInput => ({
    type: 'multizone',
    method: 'appendixA',
    psAuto: true,
    ps: 0,
    vpsAuto: true,
    vps: 0,
    systemType,
    zones: [
      {
        id: 'z1',
        tag: 'TU-1-01',
        space: 'Office space',
        area: 1000,
        pop: 10,
        vpz: 600,
        vdz: 600,
        ezConfig: 'Ceiling supply of cool air',
        box: 'single',
        er: 0,
      },
      {
        id: 'z2',
        tag: 'TU-1-02',
        space: 'Office space',
        area: 1000,
        pop: 10,
        vpz: 600,
        vdz: 600,
        ezConfig: 'Ceiling supply of cool air',
        box: 'single',
        er: 0,
      },
    ],
  });

  it('Vot value is identical across DR / DC / DC+ (canonical office fixture)', () => {
    const rDR = asMulti(compute(baseAhu('DR')));
    const rDC = asMulti(compute(baseAhu('DC')));
    const rDCp = asMulti(compute(baseAhu('DC+')));
    expect(rDR.vot).toBeCloseTo(220, 2);
    expect(rDC.vot).toBeCloseTo(220, 2);
    expect(rDCp.vot).toBeCloseTo(220, 2);
    // Also: the entire AHU-level result is byte-identical (Vou, Ev, Xs, etc.).
    expect(rDC.vou).toBe(rDR.vou);
    expect(rDC.ev).toBe(rDR.ev);
    expect(rDC.xs).toBe(rDR.xs);
    expect(rDCp.vou).toBe(rDR.vou);
    expect(rDCp.ev).toBe(rDR.ev);
  });

  it('compute() does not depend on systemType — Vou / Xs / Ev / Vot all invariant', () => {
    const a = asMulti(compute(baseAhu('DR')));
    const b = asMulti(compute(baseAhu('DC')));
    const c = asMulti(compute(baseAhu('DC+')));
    for (const key of [
      'vou',
      'xs',
      'ev',
      'evA',
      'evS',
      'vot',
      'oaPct',
      'sumPz',
      'sumArea',
      'sumPzRp',
      'sumAzRa',
      'sumVpz',
      'D',
    ] as const) {
      expect(b[key], `DC.${key}`).toBeCloseTo(a[key], 6);
      expect(c[key], `DC+.${key}`).toBeCloseTo(a[key], 6);
    }
  });

  it('compute() treats undefined systemType as DR (back-compat for old fixtures)', () => {
    const aUndef = asMulti(compute(baseAhu(undefined)));
    const aDR = asMulti(compute(baseAhu('DR')));
    expect(aUndef.vot).toBe(aDR.vot);
    expect(aUndef.vou).toBe(aDR.vou);
    expect(aUndef.ev).toBe(aDR.ev);
  });
});
