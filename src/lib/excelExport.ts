/**
 * Pure-function Excel workbook builder for the multi-AHU export.
 *
 * Extracted from `ExportButton.tsx` so the build logic is testable without
 * React, DOM, or `exceljs.writeBuffer()`. The component now just calls
 * `buildWorkbook(ahus, activeId, compute)` and triggers the file download.
 *
 * ## Workbook layout (Option A — per-AHU grouped sheets)
 *
 * One sheet-set per AHU, in declaration order:
 *
 *     {AHU name} - Inputs     — every zone's user-input fields
 *     {AHU name} - Calc       — per-zone derived values (Vbz/Voz/Ep/Zd/Evz/…)
 *     {AHU name} - Summary    — Vot, Ev, Xs, %OA, # zones, critical zone
 *
 * The **active AHU's** sheet names get a ` *` suffix (Excel-like
 * "modified" marker) and a yellow tab color (`FFFFE082`) so a reviewer
 * opening the workbook can see at a glance which AHU was on-screen
 * when the export was triggered.
 *
 * Sheet names are capped at 31 characters (Excel's hard limit).
 *
 * @see ANSI/ASHRAE Standard 62.1-2022, §6.2 — values that flow into Summary.
 */

import ExcelJS from 'exceljs';
import type {
  AhuInput,
  MultiZoneResult,
  SingleZoneResult,
} from './ashrae621';

/** Compute function shape — injected so tests can use a stub. */
export type AhuComputeFn = (ahu: AhuInput) => MultiZoneResult | SingleZoneResult;

/** Excel's hard limit on sheet-name length. */
const SHEET_NAME_MAX = 31;

/** Tab color for the active AHU's sheets (light yellow). */
const ACTIVE_TAB_COLOR = 'FFFFE082';

/** Inputs sheet columns — the user-facing zone fields. */
const INPUTS_COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Tag', key: 'tag', width: 12 },
  { header: 'Space', key: 'space', width: 30 },
  { header: 'Area (ft²)', key: 'area', width: 12 },
  { header: 'Pop', key: 'pop', width: 8 },
  { header: 'Vpz (cfm)', key: 'vpz', width: 12 },
  { header: 'Vdz (cfm)', key: 'vdz', width: 12 },
  { header: 'Vdzm (cfm)', key: 'vdzm', width: 12 },
  { header: 'Ez config', key: 'ezConfig', width: 50 },
];

/** Calc sheet columns — per-zone derived values. */
const CALC_COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Tag', key: 'tag', width: 12 },
  { header: 'Rp', key: 'rp', width: 10 },
  { header: 'Ra', key: 'ra', width: 10 },
  { header: 'Ez', key: 'ez', width: 10 },
  { header: 'Vbz', key: 'vbz', width: 10 },
  { header: 'Voz', key: 'voz', width: 10 },
  { header: 'Ep', key: 'ep', width: 10 },
  { header: 'Zd', key: 'zd', width: 10 },
  { header: 'Evz', key: 'evz', width: 10 },
];

/** Summary sheet columns. */
const SUMMARY_COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Quantity', key: 'k', width: 30 },
  { header: 'Value', key: 'v', width: 20 },
  { header: 'Units', key: 'n', width: 50 },
];

/** Type guard for the multi-zone result shape. */
export function isMultiZoneResult(
  r: MultiZoneResult | SingleZoneResult,
): r is MultiZoneResult {
  return 'vou' in r;
}

/**
 * Build a single ExcelJS workbook with one sheet-set per AHU.
 *
 * The function is pure w.r.t. the AHU data — it only mutates the workbook
 * it constructs. Caller passes `compute` so tests can substitute a stub
 * without pulling in the full math engine.
 *
 * @param ahus     All AHUs (in export order — typically declaration order).
 * @param activeId The currently active AHU id; its sheets get a tab color.
 * @param compute  The compute function (usually `compute` from ashrae621).
 * @returns        A workbook ready for `workbook.xlsx.writeBuffer()`.
 */
export function buildWorkbook(
  ahus: AhuInput[],
  activeId: string,
  compute: AhuComputeFn,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FSE Ventilation Tool';
  wb.created = new Date();

  for (const ahu of ahus) {
    const isActive = ahu.id === activeId;
    const baseName = ahu.name && ahu.name.trim().length > 0
      ? ahu.name.trim()
      : (ahu.id ?? 'AHU');
    // Active AHU is distinguished by yellow tab color (see applyTabColor).
    // We do NOT add a literal `*` to the sheet name because Excel rejects
    // it as a sheet-name character.
    const prefix = baseName;

    addInputsSheet(wb, ahu, prefix, isActive);
    addCalcSheet(wb, ahu, compute, prefix, isActive);
    addSummarySheet(wb, ahu, compute, prefix, isActive);
  }

  return wb;
}

// ---------------------------------------------------------------------------
// Per-sheet builders
// ---------------------------------------------------------------------------

function applyTabColor(ws: ExcelJS.Worksheet, isActive: boolean): void {
  if (!isActive) return;
  ws.properties = ws.properties ?? {};
  // ExcelJS accepts either a partial Color or an `{ argb }` object.
  (ws.properties as { tabColor?: { argb: string } }).tabColor = {
    argb: ACTIVE_TAB_COLOR,
  };
}

function addInputsSheet(
  wb: ExcelJS.Workbook,
  ahu: AhuInput,
  prefix: string,
  isActive: boolean,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(makeSheetName(prefix, 'Inputs'));
  ws.columns = INPUTS_COLUMNS;
  for (const z of ahu.zones) {
    ws.addRow({
      tag: z.tag ?? '',
      space: z.space,
      area: z.area,
      pop: z.pop,
      vpz: z.vpz,
      vdz: z.vdz,
      vdzm: z.vdzm ?? 0,
      ezConfig: z.ezConfig,
    });
  }
  applyTabColor(ws, isActive);
  return ws;
}

function addCalcSheet(
  wb: ExcelJS.Workbook,
  ahu: AhuInput,
  compute: AhuComputeFn,
  prefix: string,
  isActive: boolean,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(makeSheetName(prefix, 'Calc'));
  ws.columns = CALC_COLUMNS;

  const r = compute(ahu);
  if (!isMultiZoneResult(r)) {
    // §6.2.5.1 single-zone path — Ev is 1 by definition, no per-zone
    // Evz to show. We still emit the row so engineers can read Vbz/Voz.
    for (const row of r.rows) {
      ws.addRow({
        tag: row.z.tag ?? '',
        rp: row.rp,
        ra: row.ra,
        ez: row.ez,
        vbz: row.vbz,
        voz: row.voz,
        ep: row.ep,
        zd: row.zd,
        evz: row.evz,
      });
    }
    applyTabColor(ws, isActive);
    return ws;
  }

  for (const row of r.rows) {
    ws.addRow({
      tag: row.z.tag ?? '',
      rp: row.rp,
      ra: row.ra,
      ez: row.ez,
      vbz: row.vbz,
      voz: row.voz,
      ep: row.ep,
      zd: row.zd,
      evz: row.evz,
    });
  }
  applyTabColor(ws, isActive);
  return ws;
}

function addSummarySheet(
  wb: ExcelJS.Workbook,
  ahu: AhuInput,
  compute: AhuComputeFn,
  prefix: string,
  isActive: boolean,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(makeSheetName(prefix, 'Summary'));
  ws.columns = SUMMARY_COLUMNS;

  const r = compute(ahu);

  ws.addRows(
    isMultiZoneResult(r)
      ? [
          { k: 'Vot', v: r.vot, n: 'cfm — Total OA flow' },
          { k: 'Vou', v: r.vou, n: 'cfm — Uncorrected OA' },
          { k: 'Ev', v: r.ev, n: '— — System vent. efficiency' },
          { k: 'Xs', v: r.xs, n: '— — System OA fraction' },
          { k: '%OA', v: r.oaPct, n: '— — Vot / Vps' },
          { k: '# zones', v: ahu.zones.length, n: '— — Terminal units' },
          { k: 'Critical zone', v: r.crit?.z.tag ?? '—', n: '— — Highest Zp' },
        ]
      : [
          { k: 'Vot', v: r.vot, n: 'cfm — Total OA flow' },
          { k: 'Vou', v: '—', n: 'cfm — Uncorrected OA' },
          { k: 'Ev', v: 1, n: '— — System vent. efficiency' },
          { k: 'Xs', v: '—', n: '— — System OA fraction' },
          { k: '%OA', v: r.oaPct, n: '— — Vot / Vps' },
          { k: '# zones', v: ahu.zones.length, n: '— — Terminal units' },
          { k: 'Critical zone', v: r.critId ?? '—', n: '— — Highest Zp' },
        ],
  );

  applyTabColor(ws, isActive);
  return ws;
}

// ---------------------------------------------------------------------------
// Sheet name helpers
// ---------------------------------------------------------------------------

/**
 * Combine the AHU prefix and the suffix (`- Inputs` / `- Calc` / `- Summary`)
 * into a 31-char-or-less sheet name. Excel forbids `: \ / ? * [ ]` in names;
 * any of those characters in the prefix get stripped defensively so an AHU
 * named "RTU/01" or "RTU:1" doesn't blow up the export.
 *
 * The suffix is **always preserved** — if the prefix is too long, we
 * truncate the prefix only, never the suffix, so the three sheets for a
 * given AHU remain distinguishable in Excel's tab strip.
 */
function makeSheetName(prefix: string, suffix: 'Inputs' | 'Calc' | 'Summary'): string {
  const cleaned = sanitizeForSheetName(prefix);
  const sep = ' - ';
  const maxPrefix = SHEET_NAME_MAX - sep.length - suffix.length;
  const truncated = cleaned.length <= maxPrefix ? cleaned : cleaned.slice(0, maxPrefix);
  return `${truncated}${sep}${suffix}`;
}

function sanitizeForSheetName(name: string): string {
  // Excel also disallows these characters — strip them out so an AHU named
  // "RTU/01" or "RTU:1" doesn't blow up the export. The trailing `]` is
  // placed first in the character class so it doesn't terminate the class.
  return name.replace(/[:\\/?*[\]]/g, '_').trim();
}