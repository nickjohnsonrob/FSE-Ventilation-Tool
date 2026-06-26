import ExcelJS from 'exceljs';
import type { AhuInput, MultiZoneResult, SingleZoneResult } from '../lib/ashrae621';
import { compute } from '../lib/ashrae621';

export interface ExportButtonProps {
  ahu: AhuInput;
}

/**
 * Export the project to an .xlsx workbook. Three tabs:
 *   1. Inputs  — the AHU state, all zones
 *   2. Calc    — per-zone derived values
 *   3. Summary — Vot, Ev, Xs, %OA
 */
export function ExportButton({ ahu }: ExportButtonProps): JSX.Element {
  const onClick = async (): Promise<void> => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'FSE Ventilation Tool';
    wb.created = new Date();

    const inputs = wb.addWorksheet('Inputs');
    inputs.columns = [
      { header: 'Tag', key: 'tag', width: 12 },
      { header: 'Space', key: 'space', width: 30 },
      { header: 'Area (ft²)', key: 'area', width: 12 },
      { header: 'Pop', key: 'pop', width: 8 },
      { header: 'Vpz (cfm)', key: 'vpz', width: 12 },
      { header: 'Vdz (cfm)', key: 'vdz', width: 12 },
      { header: 'Vdzm (cfm)', key: 'vdzm', width: 12 },
      { header: 'Ez config', key: 'ezConfig', width: 50 },
    ];
    for (const z of ahu.zones) {
      inputs.addRow({
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

    const r = compute(ahu);
    const isMulti = 'vou' in r;
    const multi = isMulti ? (r as MultiZoneResult) : null;
    const single = !isMulti ? (r as SingleZoneResult) : null;
    const calc = wb.addWorksheet('Calc');
    calc.columns = [
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
    if (multi) {
      for (const row of multi.rows) {
        calc.addRow({
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
    }

    const vot = multi ? multi.vot : single!.vot;
    const summary = wb.addWorksheet('Summary');
    summary.columns = [
      { header: 'Quantity', key: 'k', width: 30 },
      { header: 'Value', key: 'v', width: 20 },
      { header: 'Notes', key: 'n', width: 50 },
    ];
    summary.addRows([
      { k: 'Vot', v: vot, n: 'Total outdoor airflow, cfm' },
      { k: 'Vou', v: multi ? multi.vou : '—', n: 'Uncorrected OA, cfm' },
      { k: 'Ev', v: multi ? multi.ev : 1, n: 'System ventilation efficiency' },
      { k: 'Xs', v: multi ? multi.xs : '—', n: 'System OA fraction' },
      { k: '%OA', v: multi ? multi.oaPct : single!.oaPct, n: 'Vot / Vps' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fse-ventilation-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" className="btn btn--primary" onClick={onClick}>
      Export .xlsx
    </button>
  );
}
