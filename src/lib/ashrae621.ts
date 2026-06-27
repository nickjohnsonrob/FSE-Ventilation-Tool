/**
 * ASHRAE Standard 62.1-2022 — Ventilation Rate Procedure (VRP)
 * Pure-function implementations of every equation the calculator depends on.
 *
 * Every function here is **referenced to a Standard section** in its JSDoc.
 * Equations are reproduced verbatim — we do not approximate, simplify, or
 * "round" anywhere in this file. Rounding belongs at the display boundary
 * (see `src/lib/format.ts`).
 *
 * Units: all flow rates are in **cfm**, areas in **ft²**, populations in
 * **people**. See `src/lib/units.ts` for unit-system notes.
 *
 * ## Method fidelity — three source generations
 *
 * This engine reconciles two implementations that were in the codebase
 * before this port (see HANDOFF.md):
 *
 *   - **`uploads/vrp.py`** — original Python engine, unit-tested. Uses the
 *     §6.2.5.1 *D-formula* for Simplified Ev (Eq. 6-7 / 6-8).
 *   - **`Ventilation Rate Procedure.dc.html`** — editable DC source. Uses
 *     *Table 6-3 breakpoints* (Zd → Ev) for Simplified Ev.
 *
 * Both procedures are valid in 62.1-2022. Different AHJs adopt different
 * editions / interpretations; the AHU input carries a `simplifiedMethod`
 * so the user picks. Appendix A and the single-zone path (§6.2.5.1, Ev=1)
 * are common between both generations.
 *
 * @see ANSI/ASHRAE Standard 62.1-2022, Sections 6.2 and Normative Appendix A
 */

import {
  EZ_BY_LABEL,
  OCCUPANCY_CATEGORIES,
  TABLE_6_3_BREAKPOINTS,
} from './tables';
import type { SimplifiedMethod } from './tables';
export type { SimplifiedMethod };

/**
 * System ventilation type per ASHRAE 62.1 §6.2.5 / §6.2.6.
 * - `DR`   — Dilution (recirculating), §6.2.5.1 Simplified path
 * - `DC`   — Distribution-controlled (Appendix A full)
 * - `DC+`  — DC with enhanced fan power allowance (informational)
 */
export type SystemType = 'DR' | 'DC' | 'DC+';

// ============================================================================
// Types
// ============================================================================

/** A single terminal unit (zone). Inputs are user-provided; outputs are derived. */
export interface ZoneInput {
  /** Stable id for React keys. */
  id: string;
  /** Optional tag e.g. "TU-1-01" — UI display only. */
  tag?: string;
  /** Occupancy category label; must be a key in OCCUPANCY_CATEGORIES. */
  space: string;
  /** Floor area in ft². */
  area: number;
  /** Population (people). */
  pop: number;
  /** Primary air airflow at design, cfm. */
  vpz: number;
  /**
   * Primary air airflow at minimum turndown, cfm. Used to compute the
   * worst-case primary OA fraction `Zpz` for Appendix A Evz — that procedure
   * is evaluated at turndown, not design. Defaults to `vpz` if unspecified.
   */
  vpzMin?: number;
  /**
   * Discharge airflow, cfm. Optional — defaults to `vpz` for single-duct
   * boxes and to `vpz` for fan-powered when unspecified.
   */
  vdz?: number;
  /** Minimum discharge airflow, cfm. Optional — defaults to vdz. */
  vdzm?: number;
  /** Ez configuration label; must be a key in EZ_BY_LABEL. */
  ezConfig: string;
  /** Terminal-box type. */
  box: 'single' | 'series' | 'parallel';
  /** Outdoor air fraction of recirculated air (Er) — 0 for single-duct. */
  er: number;
  /**
   * Optional sub-room breakdown. When present, the TU is "driven" by rooms:
   * Az, Pz, Vbz are summed, and the TU's outdoor-air demand is set by the
   * critical room (worst Zp).
   */
  rooms?: RoomInput[];
  /**
   * For sub-room breakdown, whether rooms drive the TU (default true).
   * Set false to treat the TU as opaque (single composite zone).
   */
  roomsDrive?: boolean;
}

/** A sub-room within a terminal unit (§6.2.5.1 single-zone §A.3 multi-zone). */
export interface RoomInput {
  id: string;
  tag?: string;
  space: string;
  area: number;
  pop: number;
  /** Primary air allocated to this room, cfm. */
  vpz: number;
  ezConfig: string;
}

/** A whole AHU (air handler) state. */
export interface AhuInput {
  /** Stable id for multi-AHU lists / React keys. Optional — math core doesn't care. */
  id?: string;
  /** Display name e.g. "RTU-01", "DOAS-02" — editable in the UI. Optional. */
  name?: string;
  /** Free-text condition e.g. "Cooling — design". */
  condition?: string;
  type: 'multizone' | 'singlezone';
  /** Multi-zone only: full Appendix A vs Simplified §6.2.5.1. */
  method?: 'appendixA' | 'simplified';
  /**
   * Multi-zone Simplified only: which §6.2.5.1 procedure to use for Ev.
   * Default is `table6-3` to match the original DC source. See
   * `SIMPLIFIED_METHODS` in `tables.ts` for the two valid options.
   */
  simplifiedMethod?: SimplifiedMethod;
  /** Primary-air population (system). When psAuto, computed as Σ Pz. */
  psAuto: boolean;
  ps: number;
  /** Total supply airflow. When vpsAuto, computed as Σ Vpz (multi-zone). */
  vpsAuto: boolean;
  vps: number;
  zones: ZoneInput[];
  /** Single-zone only: critical room vs lumped rollup. */
  szMode?: 'critical' | 'lumped';
  /** Multizone only: show rooms sub-table. */
  roomsEnabled?: boolean;
  /**
   * System ventilation type per ASHRAE 62.1 §6.2.5 / §6.2.6.
   * Drives the EquationTrace rendering. Math (Vbz/Voz/Vou/Vot) is
   * byte-identical across all three — the choice only changes which
   * downstream steps the trace surfaces.
   *
   * Optional in the type so existing fixtures and deserialization paths
   * stay valid. `useAhuState` defaults it to `'DR'` for newly created
   * AHUs. `compute()` and the UI both treat `undefined` as `'DR'`.
   */
  systemType?: SystemType;
}

/** Per-zone calculation result (multi-zone mode). */
export interface ZoneResult {
  z: ZoneInput;
  i: number;
  rp: number;
  ra: number;
  ez: number;
  ezEff: number;
  area: number;
  pop: number;
  pzrp: number;
  azra: number;
  vbz: number;
  voz: number;
  vpz: number;
  vpzMin: number;
  vdz: number;
  vdzm: number;
  ep: number;
  er: number;
  zd: number;
  /** §A-3 Primary OA fraction at turndown: Voz / Vpz,min. */
  zpz: number;
  fa: number;
  fb: number;
  fc: number;
  /**
   * Zone ventilation efficiency. Computed in a second pass after Xs is
   * known; for multi-zone it's set inside `calcMultiZone`. For single-zone
   * it's always 1 (single-zone Ev is 1 by §6.2.5.1).
   */
  evz: number;
  /**
   * §6-9 Simplified-procedure minimum primary airflow advisory. Always 0
   * for single-zone and Appendix A; populated for the Simplified method.
   */
  vpzMinRequired: number;
  /** Did this zone pass the §6-9 check? (vpzMin >= vpzMinRequired) */
  vpzMinCompliant: boolean;
  fan: boolean;
  hasRooms: boolean;
  drive: boolean;
  roomCalcs: RoomResult[] | null;
  critRoomId: string | null;
  critZp: number;
}

/** Per-room calculation result (sub-room rollup). */
export interface RoomResult {
  id: string;
  tag?: string;
  space: string;
  area: number;
  pop: number;
  rp: number;
  ra: number;
  pzrp: number;
  azra: number;
  vbz: number;
  ezConfig: string;
  ez: number;
  voz: number;
  flow: number;
  zp: number;
}

/** AHU-level calculation result (multi-zone mode). */
export interface MultiZoneResult {
  rows: ZoneResult[];
  sumPzRp: number;
  sumAzRa: number;
  sumPz: number;
  sumVpz: number;
  sumArea: number;
  ps: number;
  D: number;
  vou: number;
  vps: number;
  xs: number;
  crit: ZoneResult | null;
  evA: number;
  maxZ: ZoneResult | null;
  maxZp: number;
  evS: number;
  ev: number;
  vot: number;
  oaPct: number;
  simp: boolean;
}

/** AHU-level calculation result (single-zone mode). */
export interface SingleZoneResult {
  rows: ZoneResult[];
  sumPzRp: number;
  sumAzRa: number;
  sumPz: number;
  sumArea: number;
  sumFlow: number;
  sumVbz: number;
  sumVoz: number;
  vbz: number;
  voz: number;
  vpz: number;
  vdz: number;
  vdzm: number;
  evEff: number;
  critZp: number;
  critId: string | null;
  vot: number;
  vps: number;
  oaPct: number;
  szMode: 'critical' | 'lumped';
}

// ============================================================================
// Lookup helpers
// ============================================================================

/**
 * Look up the [Rp, Ra] pair for an occupancy category.
 * Returns [0, 0] for unknown categories so the math stays defined — the UI
 * layer is responsible for never sending an unknown label.
 */
export function getOccupancyRates(space: string): readonly [number, number] {
  return OCCUPANCY_CATEGORIES[space] ?? [0, 0];
}

/** Look up Ez for a configuration label; defaults to 1.0 if unknown. */
export function getEz(ezConfig: string): number {
  return EZ_BY_LABEL.get(ezConfig) ?? 1.0;
}

// ============================================================================
// Core VRP equations
// ============================================================================

/**
 * §6.2.2 — Breathing-zone outdoor airflow.
 *   Vbz = Pz · Rp + Az · Ra
 */
export function calcVbz(pop: number, area: number, rp: number, ra: number): number {
  return pop * rp + area * ra;
}

/**
 * §6.2.5 — Zone outdoor airflow.
 *   Voz = Vbz / Ez
 * If Ez is 0 (shouldn't happen, but defensive) returns 0 rather than Infinity.
 */
export function calcVoz(vbz: number, ez: number): number {
  if (ez <= 0) return 0;
  return vbz / ez;
}

/**
 * §A.3 — Primary air fraction.
 *   Ep = min(Vpz / Vdz, 1)
 * Returns 1 when Vdz is 0 (degenerate; should not occur in valid inputs).
 */
export function calcEp(vpz: number, vdz: number): number {
  if (vdz <= 0) return 1;
  return Math.min(vpz / vdz, 1);
}

/**
 * §A.3 — Discharge OA fraction.
 *   Zd = Voz / Vdzm
 * Returns 0 when Vdzm is 0 (no minimum discharge specified → no constraint).
 */
export function calcZd(voz: number, vdzm: number): number {
  if (vdzm <= 0) return 0;
  return voz / vdzm;
}

/**
 * §A.3 — Zone ventilation efficiency Evz coefficients.
 *   Fa = Ep + (1 - Ep) · Er
 *   Fb = Ep
 *   Fc = 1 - (1 - Ez) · (1 - Er) · (1 - Ep)
 */
export function calcEvzCoeffs(ep: number, er: number, ez: number): {
  fa: number;
  fb: number;
  fc: number;
} {
  const fa = ep + (1 - ep) * er;
  const fb = ep;
  const fc = 1 - (1 - ez) * (1 - er) * (1 - ep);
  return { fa, fb, fc };
}

/**
 * §A.3 — Zone ventilation efficiency.
 *   Evz = (Fa + Xs · Fb - Zd · Fc) / Fa
 * Returns 0 when Fa is 0 (degenerate).
 */
export function calcEvz(fa: number, fb: number, fc: number, xs: number, zd: number): number {
  if (fa <= 0) return 0;
  return (fa + xs * fb - zd * fc) / fa;
}

/**
 * §6.2.5 — Primary air fraction of system population.
 *   D = Ps / Σ Pz
 * Returns 1 when Σ Pz is 0.
 */
export function calcD(ps: number, sumPz: number): number {
  if (sumPz <= 0) return 1;
  return ps / sumPz;
}

/**
 * §6.2.5 — Uncorrected outdoor airflow.
 *   Vou = D · Σ (Pz · Rp) + Σ (Az · Ra)
 */
export function calcVou(d: number, sumPzRp: number, sumAzRa: number): number {
  return d * sumPzRp + sumAzRa;
}

/**
 * System outdoor air fraction (derived).
 *   Xs = Vou / Vps
 * Returns 0 when Vps is 0.
 */
export function calcXs(vou: number, vps: number): number {
  if (vps <= 0) return 0;
  return vou / vps;
}

/**
 * §6.2.5 — Total outdoor airflow rate.
 *   Vot = Vou / Ev
 * Returns 0 when Ev is 0.
 */
export function calcVot(vou: number, ev: number): number {
  if (ev <= 0) return 0;
  return vou / ev;
}

/**
 * Table 6-3 — Simplified §6.2.5.1 Ventilation Efficiency breakpoints.
 * Returns Ev for the given maximum Zd (or Zp). Breaks at 0.25/0.35/0.45/0.55.
 *
 * Breakpoints are inclusive at the upper edge. We use a tiny epsilon so
 * 0.25 exactly (or 0.2500000001 from floating-point) lands in the 0.9 bucket,
 * but 0.2501 lands in the 0.8 bucket.
 */
export function calcEvFromTable(maxZp: number): number {
  for (const bp of TABLE_6_3_BREAKPOINTS) {
    if (maxZp <= bp.maxZp + 1e-9) return bp.ev;
  }
  return 0.5; // unreachable; last breakpoint is Infinity
}

/**
 * §6.2.5.1 Eq. 6-7 / 6-8 — D-formula for Simplified system vent. efficiency.
 *   Ev = 0.88·D + 0.22    when D < 0.60
 *   Ev = 0.75             otherwise
 *
 * This is the alternative Simplified §6.2.5.1 procedure (vs Table 6-3
 * breakpoints). Both are valid in 62.1-2022; the AHJ's adopted edition
 * determines which applies. See `calcEvSimplified` for the unified entry.
 */
export function calcEvFromDiversity(d: number): number {
  if (d < 0.6) return 0.88 * d + 0.22;
  return 0.75;
}

/**
 * §6.2.5.1 — Simplified system ventilation efficiency.
 *
 *   - `table6-3`: breakpoints on the maximum Zd over zones
 *   - `eq6-7-6-8`: D-formula on system occupant diversity
 *
 * Defaults to `table6-3` for backward compatibility with the original DC.
 */
export function calcEvSimplified(
  method: SimplifiedMethod | undefined,
  args: { maxZd: number; D: number },
): number {
  if (method === 'eq6-7-6-8') return calcEvFromDiversity(args.D);
  return calcEvFromTable(args.maxZd);
}

/**
 * §6-9 — Simplified-procedure minimum primary airflow check.
 *   Vpz,min_required = 1.5 · Voz
 *
 * The Simplified procedure requires that each zone's turndown Vpz be at
 * least 1.5× its Voz; if not, the zone is non-compliant and the procedure
 * doesn't apply directly. We surface this as a per-zone advisory.
 */
export function calcVpzMinRequired(voz: number): number {
  return 1.5 * voz;
}

// ============================================================================
// Per-zone & per-room calc
// ============================================================================

/**
 * Compute a single zone (or TU), with optional sub-room breakdown.
 *
 * When rooms are present and `drive === true` (default), the TU is the
 * critical-room rollup: Voz_TU = max(Voz_i / Vpz_i) · ΣVpz_i.
 * See JSDoc on ZoneInput for the reasoning.
 */
export function calcZoneBase(z: ZoneInput, ezMap?: Map<string, number>): {
  rp: number;
  ra: number;
  ez: number;
  ezEff: number;
  area: number;
  pop: number;
  vbz: number;
  pzrp: number;
  azra: number;
  voz: number;
  vpz: number;
  vdz: number;
  vdzm: number;
  fan: boolean;
  hasRooms: boolean;
  drive: boolean;
  roomCalcs: RoomResult[] | null;
  critRoomId: string | null;
  critZp: number;
} {
  const ezLookup = ezMap ?? EZ_BY_LABEL;
  const fan = z.box !== 'single';
  const hasRooms = !!z.rooms && z.rooms.length > 0;
  const drive = hasRooms && (z.roomsDrive !== false);

  let roomCalcs: RoomResult[] | null = null;
  let critRoomId: string | null = null;
  let critZp = 0;

  if (hasRooms && z.rooms) {
    let cz = 0;
    let cid: string | null = null;
    roomCalcs = z.rooms.map((rm) => {
      const [rp, ra] = getOccupancyRates(rm.space);
      const pzrp = (rm.pop || 0) * rp;
      const azra = (rm.area || 0) * ra;
      const vbz = pzrp + azra;
      const ez = ezLookup.get(rm.ezConfig) ?? 1;
      const voz = ez > 0 ? vbz / ez : 0;
      const flow = rm.vpz || 0;
      const zp = flow > 0 ? voz / flow : 0;
      if (zp > cz) {
        cz = zp;
        cid = rm.id;
      }
      return {
        id: rm.id,
        tag: rm.tag,
        space: rm.space,
        area: rm.area || 0,
        pop: rm.pop || 0,
        rp,
        ra,
        pzrp,
        azra,
        vbz,
        ezConfig: rm.ezConfig,
        ez,
        voz,
        flow,
        zp,
      };
    });
    critZp = cz;
    critRoomId = cid;
  }

  if (drive && roomCalcs) {
    const sum = (k: keyof RoomResult): number =>
      roomCalcs!.reduce((a, r) => a + (r[k] as number), 0);
    const sA = sum('area');
    const sP = sum('pop');
    const sFlow = sum('flow');
    const sVbz = sum('vbz');
    const sPzRp = sum('pzrp');
    const sAzRa = sum('azra');
    const voz = critZp * sFlow; // critical-room rollup
    const ezEff = voz > 0 ? sVbz / voz : 1; // effective Ez = ΣVbz / Voz
    const vpz = fan ? z.vpz || 0 : sFlow;
    const vdz = fan ? sFlow : vpz;
    const vdzm = z.vdzm && z.vdzm > 0 ? z.vdzm : vdz;
    const singleRm = roomCalcs.length === 1 ? roomCalcs[0] : null;
    return {
      rp: singleRm ? singleRm.rp : 0,
      ra: singleRm ? singleRm.ra : 0,
      ez: ezEff,
      ezEff,
      area: sA,
      pop: sP,
      vbz: sVbz,
      pzrp: sPzRp,
      azra: sAzRa,
      voz,
      vpz,
      vdz,
      vdzm,
      fan,
      hasRooms,
      drive: true,
      roomCalcs,
      critRoomId,
      critZp,
    };
  }

  // Opaque TU: use the TU's own space/area/pop.
  const [rp, ra] = getOccupancyRates(z.space);
  const ez = ezLookup.get(z.ezConfig) ?? 1;
  const pzrp = (z.pop || 0) * rp;
  const azra = (z.area || 0) * ra;
  const vbz = pzrp + azra;
  const voz = ez > 0 ? vbz / ez : 0;
  const vpz = z.vpz || 0;
  const vdz = z.box === 'single' ? vpz : (z.vdz ?? 0) > 0 ? (z.vdz ?? 0) : vpz;
  const vdzm = z.vdzm && z.vdzm > 0 ? z.vdzm : vdz;
  return {
    rp,
    ra,
    ez,
    ezEff: ez,
    area: z.area || 0,
    pop: z.pop || 0,
    vbz,
    pzrp,
    azra,
    voz,
    vpz,
    vdz,
    vdzm,
    fan,
    hasRooms,
    drive: false,
    roomCalcs,
    critRoomId,
    critZp,
  };
}

// ============================================================================
// AHU-level calc
// ============================================================================

/**
 * Multi-zone AHU calc.
 *
 * Implements:
 *   - Normative Appendix A: Ev = min(Evz), Evz per §A.3
 *   - Simplified §6.2.5.1:   Ev = Table 6-3 by max Zd
 *
 * The result `ev` reflects whichever method the AHU is set to.
 */
export function calcMultiZone(ahu: AhuInput): MultiZoneResult {
  const S = {
    zones: ahu.zones,
    psAuto: ahu.psAuto,
    ps: ahu.ps,
    vpsAuto: ahu.vpsAuto,
    vps: ahu.vps,
    method: ahu.method ?? 'appendixA',
    simplifiedMethod: ahu.simplifiedMethod ?? 'table6-3',
  };
  const ezMap = new Map(EZ_BY_LABEL);
  let sumPzRp = 0;
  let sumAzRa = 0;
  let sumPz = 0;
  let sumVpz = 0;
  let sumArea = 0;

  // First pass: per-zone base calcs and totals.
  const rows: ZoneResult[] = S.zones.map((z, i) => {
    const b = calcZoneBase(z, ezMap);
    const er = b.fan ? z.er || 0 : 0;
    const ep = b.vdz > 0 ? Math.min(b.vpz / b.vdz, 1) : 1;
    const zd = b.vdzm > 0 ? b.voz / b.vdzm : 0;
    // Vpz at minimum turndown — defaults to design Vpz if unspecified.
    // Used for Zpz (primary OA fraction evaluated at turndown, per §A.3).
    const vpzMin = z.vpzMin && z.vpzMin > 0 ? z.vpzMin : b.vpz;
    const zpz = vpzMin > 0 ? b.voz / vpzMin : 0;
    const { fa, fb, fc } = calcEvzCoeffs(ep, er, b.ez);

    sumPzRp += b.pzrp;
    sumAzRa += b.azra;
    sumPz += b.pop;
    sumVpz += b.vpz;
    sumArea += b.area;

    // §6-9 simplified-procedure minimum primary airflow advisory (Eq. 6-9)
    const vpzMinRequired = calcVpzMinRequired(b.voz);
    const vpzMinCompliant = vpzMin >= vpzMinRequired;

    return {
      z,
      i,
      rp: b.rp,
      ra: b.ra,
      ez: b.ez,
      ezEff: b.ezEff,
      area: b.area,
      pop: b.pop,
      pzrp: b.pzrp,
      azra: b.azra,
      vbz: b.vbz,
      voz: b.voz,
      vdz: b.vdz,
      vdzm: b.vdzm,
      vpz: b.vpz,
      vpzMin,
      ep,
      er,
      zd,
      zpz,
      fa,
      fb,
      fc,
      // evz filled in below once xs is known
      evz: 0,
      vpzMinRequired,
      vpzMinCompliant,
      fan: b.fan,
      hasRooms: b.hasRooms,
      drive: b.drive,
      roomCalcs: b.roomCalcs,
      critRoomId: b.critRoomId,
      critZp: b.critZp,
    };
  });

  const ps = S.psAuto ? sumPz : S.ps || 0;
  const D = calcD(ps, sumPz);
  const vou = calcVou(D, sumPzRp, sumAzRa);
  const simp = S.method === 'simplified';
  const vps = simp ? sumVpz : S.vpsAuto ? sumVpz : S.vps || 0;
  const xs = calcXs(vou, vps);

  // Evz per zone (needs Xs). Per §A-4: Evz = (Fa + Xs·Fb − Zpz·Ep·Fc)/Fa.
  // We use Zpz (turndown) and Ep (design) — that's how the standard writes it.
  rows.forEach((r) => {
    r.evz = calcEvz(r.fa, r.fb, r.fc, xs, r.zpz * r.ep);
  });

  // Appendix A: Ev = min(Evz)
  let crit: ZoneResult | null = rows[0] ?? null;
  for (const r of rows) {
    if (crit == null || r.evz < crit.evz) crit = r;
  }
  const evA = crit ? crit.evz : 1;

  // Simplified: dispatch to whichever procedure the AHU selected.
  // Both procedures are valid 62.1-2022 §6.2.5.1; the AHJ's adopted edition
  // determines which applies. Default to `table6-3` (DC behavior).
  let maxZ: ZoneResult | null = rows[0] ?? null;
  for (const r of rows) {
    if (maxZ == null || r.zd > maxZ.zd) maxZ = r;
  }
  const maxZp = maxZ ? maxZ.zd : 0;
  const evS = calcEvSimplified(S.simplifiedMethod, { maxZd: maxZp, D });

  const ev = simp ? evS : evA;
  const vot = calcVot(vou, ev);
  const oaPct = vps > 0 ? vot / vps : 0;

  return {
    rows,
    sumPzRp,
    sumAzRa,
    sumPz,
    sumVpz,
    sumArea,
    ps,
    D,
    vou,
    vps,
    xs,
    crit,
    evA,
    maxZ,
    maxZp,
    evS,
    ev,
    vot,
    oaPct,
    simp,
  };
}

/**
 * Single-zone AHU calc (§6.2.5.1).
 *
 * Single-zone systems have Ev = 1 (the air stream is shared; only the
 * worst room drives). Two rollup modes are supported:
 *
 *   - **critical (default):** Vot = Voz = max(Voz_i / Vpz_i) · ΣVpz_i.
 *     Guarantees the worst room is satisfied.
 *   - **lumped:**             Vot = Voz = Σ(Vbz_i / Ez_i).
 *     Assumes supply distributes in proportion to each room's OA demand.
 *     This is a conservative bound, NOT a Standard-prescribed method —
 *     included as a sanity check.
 */
export function calcSingleZone(ahu: AhuInput): SingleZoneResult {
  const S = {
    zones: ahu.zones,
    szMode: ahu.szMode ?? 'critical',
  };
  const ezMap = new Map(EZ_BY_LABEL);

  let sumPzRp = 0;
  let sumAzRa = 0;
  let sumPz = 0;
  let sumArea = 0;
  let sumFlow = 0;
  let sumVbz = 0;
  let sumVoz = 0;
  let critZp = 0;
  let critId: string | null = null;

  const rows: ZoneResult[] = S.zones.map((z, i) => {
    const b = calcZoneBase(z, ezMap);
    const er = b.fan ? z.er || 0 : 0;
    const ep = b.vdz > 0 ? Math.min(b.vpz / b.vdz, 1) : 1;
    const zd = b.vdzm > 0 ? b.voz / b.vdzm : 0;
    const { fa, fb, fc } = calcEvzCoeffs(ep, er, b.ez);

    const zp = b.vpz > 0 ? b.voz / b.vpz : 0;
    if (zp > critZp) {
      critZp = zp;
      critId = z.id;
    }

    sumPzRp += b.pzrp;
    sumAzRa += b.azra;
    sumPz += b.pop || 0;
    sumArea += b.area || 0;
    sumFlow += b.vpz;
    sumVbz += b.vbz;
    sumVoz += b.voz;

    const vpzMin = z.vpzMin && z.vpzMin > 0 ? z.vpzMin : b.vpz;

    return {
      z,
      i,
      rp: b.rp,
      ra: b.ra,
      ez: b.ez,
      ezEff: b.ezEff,
      area: b.area,
      pop: b.pop,
      pzrp: b.pzrp,
      azra: b.azra,
      vbz: b.vbz,
      voz: b.voz,
      vdz: b.vdz,
      vdzm: b.vdzm,
      vpz: b.vpz,
      vpzMin,
      ep,
      er,
      zd,
      zpz: zp, // single-zone: per-zone primary OA fraction (Zp = Voz/Vpz)
      fa,
      fb,
      fc,
      evz: 1, // Evz not used in single-zone (Ev = 1); set to 1 for shape.
      vpzMinRequired: 0,
      vpzMinCompliant: true,
      fan: b.fan,
      hasRooms: b.hasRooms,
      drive: b.drive,
      roomCalcs: b.roomCalcs,
      critRoomId: b.critRoomId,
      critZp: b.critZp,
    };
  });

  const szUseCrit = S.szMode === 'critical';
  const vbz = sumVbz;
  const voz = szUseCrit ? critZp * sumFlow : sumVoz;
  const evEff = voz > 0 ? vbz / voz : 1;

  const first = rows[0];
  const vpz = first ? first.vpz : 0;
  const vdz = first ? first.vdz : 0;
  const vdzm = first ? first.vdzm : 0;

  const vps = sumFlow;
  const vot = voz; // single-zone Ev = 1, so Vot = Voz
  const oaPct = vps > 0 ? vot / vps : 0;

  return {
    rows,
    sumPzRp,
    sumAzRa,
    sumPz,
    sumArea,
    sumFlow,
    sumVbz,
    sumVoz,
    vbz,
    voz,
    vpz,
    vdz,
    vdzm,
    evEff,
    critZp,
    critId,
    vot,
    vps,
    oaPct,
    szMode: S.szMode,
  };
}

/**
 * Top-level dispatcher: compute the right result shape for the AHU type.
 */
export function compute(ahu: AhuInput): MultiZoneResult | SingleZoneResult {
  return ahu.type === 'singlezone' ? calcSingleZone(ahu) : calcMultiZone(ahu);
}
