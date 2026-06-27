/**
 * Unit tests for the pure `buildWorkbook` Excel export builder.
 *
 * No React, no DOM, no `exceljs.writeBuffer()` — we exercise the function
 * with a stub `compute` so the test stays deterministic and runs in jsdom
 * without needing the full math engine. The component is just a thin shell
 * over this function.
 *
 * Acceptance (from the P0 HANDOFF item):
 *   - one Inputs/Calc/Summary sheet-set per AHU (3 × N total)
 *   - active AHU's tabs end with ` *` and have a non-empty tabColor argb
 *   - sheet names truncate to 31 chars (Excel limit)
 *   - Calc sheet has the right column set
 *   - Summary sheet shows the AHU's Vot
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildWorkbook,
  isMultiZoneResult,
  type AhuComputeFn,
} from '../excelExport';
import type {
  AhuInput,
  MultiZoneResult,
  SingleZoneResult,
} from '../ashrae621';

// ---------- fixtures ----------

function makeMultiZoneZone(
  id: string,
  tag: string,
  overrides: Partial<AhuInput['zones'][number]> = {},
): AhuInput['zones'][number] {
  return {
    id,
    tag,
    space: 'Office space',
    area: 1000,
    pop: 10,
    vpz: 200,
    vdz: 200,
    vdzm: 100,
    ezConfig: 'Ceiling supply of cool air',
    box: 'single',
    er: 0,
    ...overrides,
  };
}

function makeMultiZoneAhu(
  id: string,
  name: string,
  zones: AhuInput['zones'],
): AhuInput {
  return {
    id,
    name,
    condition: 'Cooling — design',
    type: 'multizone',
    method: 'appendixA',
    simplifiedMethod: 'table6-3',
    psAuto: true,
    ps: 0,
    vpsAuto: false,
    vps: 0,
    zones,
  };
}

function makeSingleZoneZone(
  id: string,
  tag: string,
): AhuInput['zones'][number] {
  return {
    id,
    tag,
    space: 'Office space',
    area: 800,
    pop: 8,
    vpz: 0,
    vdz: 0,
    vdzm: 0,
    ezConfig: 'Ceiling supply of cool air',
    box: 'single',
    er: 0,
  };
}

function makeSingleZoneAhu(id: string, name: string): AhuInput {
  return {
    id,
    name,
    condition: 'Cooling — design',
    type: 'singlezone',
    psAuto: true,
    ps: 0,
    vpsAuto: false,
    vps: 0,
    zones: [makeSingleZoneZone('z1', 'RM-01')],
    szMode: 'critical',
  };
}

/** Stub compute — returns a deterministic Vot per AHU name so we can assert. */
const stubCompute: AhuComputeFn = (ahu) => {
  const vot = ahu.name === 'RTU-01' ? 220 : 330;
  if (ahu.type === 'multizone') {
    const result: MultiZoneResult = {
      rows: ahu.zones.map((z, i) => ({
        z,
        i,
        rp: 5,
        ra: 0.06,
        ez: 1,
        ezEff: 1,
        area: z.area,
        pop: z.pop,
        pzrp: z.pop * 5,
        azra: z.area * 0.06,
        vbz: z.pop * 5 + z.area * 0.06,
        voz: z.pop * 5 + z.area * 0.06,
        vpz: z.vpz,
        vpzMin: z.vpz,
        vdz: z.vdz ?? 0,
        vdzm: z.vdzm ?? 0,
        ep: 1,
        er: 0,
        zd: 0,
        zpz: 0,
        fa: 1,
        fb: 1,
        fc: 1,
        evz: 1,
        vpzMinRequired: 0,
        vpzMinCompliant: true,
        fan: false,
        hasRooms: false,
        drive: false,
        roomCalcs: null,
        critRoomId: null,
        critZp: 0,
      })),
      sumPzRp: ahu.zones.reduce((s, z) => s + z.pop * 5, 0),
      sumAzRa: ahu.zones.reduce((s, z) => s + z.area * 0.06, 0),
      sumPz: ahu.zones.reduce((s, z) => s + z.pop, 0),
      sumVpz: ahu.zones.reduce((s, z) => s + z.vpz, 0),
      sumArea: ahu.zones.reduce((s, z) => s + z.area, 0),
      ps: ahu.zones.reduce((s, z) => s + z.pop, 0),
      D: 1,
      vou: vot,
      vps: ahu.zones.reduce((s, z) => s + z.vpz, 0),
      xs: 0.5,
      crit: null,
      evA: 1,
      maxZ: null,
      maxZp: 0,
      evS: 1,
      ev: 1,
      vot,
      oaPct: 0.5,
      simp: false,
    };
    return result;
  }
  const szResult: SingleZoneResult = {
    rows: [],
    sumPzRp: 0,
    sumAzRa: 0,
    sumPz: 0,
    sumArea: 0,
    sumFlow: 0,
    sumVbz: 0,
    sumVoz: 0,
    vbz: 0,
    voz: vot,
    vpz: 0,
    vdz: 0,
    vdzm: 0,
    evEff: 1,
    critZp: 0,
    critId: null,
    vot,
    vps: 0,
    oaPct: 0,
    szMode: 'critical',
  };
  return szResult;
};

// ---------- helpers ----------

/** Return all worksheet names in the order they were added. */
function sheetNames(wb: ExcelJS.Workbook): string[] {
  return wb.worksheets.map((ws) => ws.name);
}

/** Find a worksheet by name (ExcelJS lookups return `undefined` on miss). */
function findSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`worksheet not found: ${name}`);
  return ws;
}

/** Header values of a sheet — row 1, columns A..last. */
function headerRow(ws: ExcelJS.Worksheet): string[] {
  const row = ws.getRow(1);
  const headers: string[] = [];
  row.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value ?? ''));
  });
  return headers;
}

/** All values in a given column index (1-based) below the header. */
function columnValues(ws: ExcelJS.Worksheet, col: number): unknown[] {
  const out: unknown[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    out.push(ws.getRow(r).getCell(col).value);
  }
  return out;
}

// ---------- tests ----------

describe('excelExport — isMultiZoneResult', () => {
  it('returns true for MultiZoneResult shape (has vou)', () => {
    const r: MultiZoneResult = {
      rows: [],
      sumPzRp: 0,
      sumAzRa: 0,
      sumPz: 0,
      sumVpz: 0,
      sumArea: 0,
      ps: 0,
      D: 1,
      vou: 100,
      vps: 200,
      xs: 0.5,
      crit: null,
      evA: 1,
      maxZ: null,
      maxZp: 0,
      evS: 1,
      ev: 1,
      vot: 100,
      oaPct: 0.5,
      simp: false,
    };
    expect(isMultiZoneResult(r)).toBe(true);
  });

  it('returns false for SingleZoneResult shape (has vbz)', () => {
    const r: SingleZoneResult = {
      rows: [],
      sumPzRp: 0,
      sumAzRa: 0,
      sumPz: 0,
      sumArea: 0,
      sumFlow: 0,
      sumVbz: 0,
      sumVoz: 0,
      vbz: 100,
      voz: 100,
      vpz: 0,
      vdz: 0,
      vdzm: 0,
      evEff: 1,
      critZp: 0,
      critId: null,
      vot: 100,
      vps: 0,
      oaPct: 0,
      szMode: 'critical',
    };
    expect(isMultiZoneResult(r)).toBe(false);
  });
});

describe('excelExport — buildWorkbook', () => {
  it('produces 3 sheets per AHU (Inputs / Calc / Summary)', () => {
    const ahus = [
      makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')]),
      makeMultiZoneAhu('a2', 'RTU-02', [makeMultiZoneZone('z2', 'TU-201')]),
    ];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    const names = sheetNames(wb);
    expect(names).toHaveLength(6);
    expect(names).toEqual([
      'RTU-01 - Inputs',
      'RTU-01 - Calc',
      'RTU-01 - Summary',
      'RTU-02 - Inputs',
      'RTU-02 - Calc',
      'RTU-02 - Summary',
    ]);
  });

  it('single AHU produces the same 3-sheet shape as today (back-compat)', () => {
    const ahus = [makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')])];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    expect(sheetNames(wb)).toEqual(['RTU-01 - Inputs', 'RTU-01 - Calc', 'RTU-01 - Summary']);
  });

  it('active AHU is distinguished by a yellow tab color (FFFFE082) only', () => {
    // The active AHU's sheets do NOT add a literal `*` to the sheet name —
    // Excel rejects `*` as a sheet-name character. The active marker is the
    // tab color instead, which Excel renders faithfully.
    const ahus = [
      makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')]),
      makeMultiZoneAhu('a2', 'RTU-02', [makeMultiZoneZone('z2', 'TU-201')]),
    ];
    const wb = buildWorkbook(ahus, 'a2', stubCompute);
    expect(sheetNames(wb)).toEqual([
      'RTU-01 - Inputs',
      'RTU-01 - Calc',
      'RTU-01 - Summary',
      'RTU-02 - Inputs',
      'RTU-02 - Calc',
      'RTU-02 - Summary',
    ]);
    // Active (RTU-02) gets the color
    expect(findSheet(wb, 'RTU-02 - Inputs').properties?.tabColor?.argb).toBe('FFFFE082');
    expect(findSheet(wb, 'RTU-02 - Calc').properties?.tabColor?.argb).toBe('FFFFE082');
    expect(findSheet(wb, 'RTU-02 - Summary').properties?.tabColor?.argb).toBe('FFFFE082');
  });

  it('inactive AHU sheets do NOT get a tab color', () => {
    const ahus = [
      makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')]),
      makeMultiZoneAhu('a2', 'RTU-02', [makeMultiZoneZone('z2', 'TU-201')]),
    ];
    const wb = buildWorkbook(ahus, 'a2', stubCompute);
    expect(findSheet(wb, 'RTU-01 - Inputs').properties?.tabColor).toBeUndefined();
    expect(findSheet(wb, 'RTU-01 - Calc').properties?.tabColor).toBeUndefined();
    expect(findSheet(wb, 'RTU-01 - Summary').properties?.tabColor).toBeUndefined();
  });

  it('falls back to `AHU` when AHU name and id are both missing', () => {
    const ahus: AhuInput[] = [
      {
        type: 'multizone',
        psAuto: true,
        ps: 0,
        vpsAuto: false,
        vps: 0,
        zones: [makeMultiZoneZone('z1', 'TU-101')],
      },
    ];
    const wb = buildWorkbook(ahus, '', stubCompute);
    expect(sheetNames(wb)).toEqual(['AHU - Inputs', 'AHU - Calc', 'AHU - Summary']);
  });

  it('falls back to AHU id when name is missing', () => {
    const ahus: AhuInput[] = [
      makeMultiZoneAhu('a1', '', [makeMultiZoneZone('z1', 'TU-101')]),
    ];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    expect(sheetNames(wb)).toEqual(['a1 - Inputs', 'a1 - Calc', 'a1 - Summary']);
  });

  it('falls back to AHU id when name is missing AND active marker is needed', () => {
    const ahus: AhuInput[] = [
      makeMultiZoneAhu('a1', '', [makeMultiZoneZone('z1', 'TU-101')]),
      makeMultiZoneAhu('a2', '', [makeMultiZoneZone('z2', 'TU-201')]),
    ];
    const wb = buildWorkbook(ahus, 'a2', stubCompute);
    expect(sheetNames(wb)).toEqual([
      'a1 - Inputs',
      'a1 - Calc',
      'a1 - Summary',
      'a2 - Inputs',
      'a2 - Calc',
      'a2 - Summary',
    ]);
  });

  it('sheet names truncate to 31 characters (Excel limit)', () => {
    const ahus = [
      makeMultiZoneAhu(
        'a1',
        'VERY-LONG-AHU-NAME-THAT-EXCEEDS-LIMIT-XX',
        [makeMultiZoneZone('z1', 'TU-101')],
      ),
    ];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    for (const ws of wb.worksheets) {
      expect(ws.name.length).toBeLessThanOrEqual(31);
    }
    // Specifically: `VERY-LONG-AHU-NAME-THAT-EXCEEDS-LIMIT-XX - Inputs` is 47 chars
    // → truncated to 31, and we still recognize the trailing Inputs/Calc/Summary
    const names = sheetNames(wb);
    expect(names[0].endsWith('- Inputs')).toBe(true);
    expect(names[1].endsWith('- Calc')).toBe(true);
    expect(names[2].endsWith('- Summary')).toBe(true);
  });

  it('Calc sheet has the per-zone derived columns (Tag/Rp/Ra/Ez/Vbz/Voz/Ep/Zd/Evz)', () => {
    const ahus = [
      makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')]),
    ];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    const calc = findSheet(wb, 'RTU-01 - Calc');
    expect(headerRow(calc)).toEqual([
      'Tag',
      'Rp',
      'Ra',
      'Ez',
      'Vbz',
      'Voz',
      'Ep',
      'Zd',
      'Evz',
    ]);
    // Per-zone row: TU-101 area=1000 pop=10 → Rp=5, Ra=0.06, Vbz = 50+60 = 110, Voz = 110, Evz = 1
    expect(calc.getCell('A2').value).toBe('TU-101');
    expect(calc.getCell('B2').value).toBe(5);
    expect(calc.getCell('C2').value).toBe(0.06);
    expect(calc.getCell('E2').value).toBeCloseTo(110, 5);
    expect(calc.getCell('F2').value).toBeCloseTo(110, 5);
    expect(calc.getCell('I2').value).toBe(1);
  });

  it('Inputs sheet has the user-input columns and one row per zone', () => {
    const ahus = [
      makeMultiZoneAhu('a1', 'RTU-01', [
        makeMultiZoneZone('z1', 'TU-101'),
        makeMultiZoneZone('z2', 'TU-102', { area: 500, pop: 5 }),
      ]),
    ];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    const inputs = findSheet(wb, 'RTU-01 - Inputs');
    expect(headerRow(inputs)).toEqual([
      'Tag',
      'Space',
      'Area (ft²)',
      'Pop',
      'Vpz (cfm)',
      'Vdz (cfm)',
      'Vdzm (cfm)',
      'Ez config',
    ]);
    expect(columnValues(inputs, 1)).toEqual(['TU-101', 'TU-102']);
    expect(columnValues(inputs, 3)).toEqual([1000, 500]);
    expect(columnValues(inputs, 4)).toEqual([10, 5]);
  });

  it('Summary sheet shows the AHU Vot (and Ev / Xs / %OA for multi-zone)', () => {
    const ahus = [
      makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')]),
    ];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    const summary = findSheet(wb, 'RTU-01 - Summary');
    expect(headerRow(summary)).toEqual(['Quantity', 'Value', 'Units']);
    // First row: Vot 220 cfm
    expect(summary.getCell('A1').value).toBe('Quantity');
    // Walk the Vot/Ev/Xs/%OA rows
    const rows: Array<[string, unknown]> = [];
    for (let r = 2; r <= summary.rowCount; r++) {
      const k = summary.getCell(r, 1).value;
      const v = summary.getCell(r, 2).value;
      if (k != null) rows.push([String(k), v]);
    }
    const map = new Map(rows);
    expect(map.get('Vot')).toBe(220);
    expect(map.get('Ev')).toBe(1);
    expect(map.get('Xs')).toBeCloseTo(0.5, 5);
    expect(map.get('%OA')).toBeCloseTo(0.5, 5);
  });

  it('single-zone AHU Summary uses Vot and emits `—` for non-applicable Ev/Xs', () => {
    const ahus = [makeSingleZoneAhu('a1', 'DOAS-01')];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    const summary = findSheet(wb, 'DOAS-01 - Summary');
    const rows: Array<[string, unknown]> = [];
    for (let r = 2; r <= summary.rowCount; r++) {
      const k = summary.getCell(r, 1).value;
      const v = summary.getCell(r, 2).value;
      if (k != null) rows.push([String(k), v]);
    }
    const map = new Map(rows);
    expect(map.get('Vot')).toBe(330);
    expect(map.get('Ev')).toBe(1); // single-zone Ev is 1
    expect(map.get('Vou')).toBe('—');
    expect(map.get('Xs')).toBe('—');
  });

  it('produces 3 sheets for each of N AHUs in declaration order', () => {
    const ahus = [
      makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')]),
      makeMultiZoneAhu('a2', 'DOAS-02', [makeSingleZoneZone('z2', 'RM-201')]),
      makeMultiZoneAhu('a3', 'RTU-03', [makeMultiZoneZone('z3', 'TU-301')]),
    ];
    const wb = buildWorkbook(ahus, 'a3', stubCompute);
    expect(sheetNames(wb)).toEqual([
      'RTU-01 - Inputs',
      'RTU-01 - Calc',
      'RTU-01 - Summary',
      'DOAS-02 - Inputs',
      'DOAS-02 - Calc',
      'DOAS-02 - Summary',
      'RTU-03 - Inputs',
      'RTU-03 - Calc',
      'RTU-03 - Summary',
    ]);
  });

  it('empty AHU list yields an empty workbook (no sheets, no throw)', () => {
    const wb = buildWorkbook([], 'a1', stubCompute);
    expect(sheetNames(wb)).toEqual([]);
  });

  it('assigns the workbook creator and a created timestamp', () => {
    const ahus = [makeMultiZoneAhu('a1', 'RTU-01', [makeMultiZoneZone('z1', 'TU-101')])];
    const wb = buildWorkbook(ahus, 'a1', stubCompute);
    expect(wb.creator).toBe('FSE Ventilation Tool');
    expect(wb.created).toBeInstanceOf(Date);
  });
});