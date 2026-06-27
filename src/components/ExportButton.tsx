import type { AhuInput } from '../lib/ashrae621';
import { compute } from '../lib/ashrae621';
import { buildWorkbook } from '../lib/excelExport';

export interface ExportButtonProps {
  /**
   * The full list of AHUs to include in the workbook. One sheet-set
   * (Inputs / Calc / Summary) is produced per AHU, in declaration order.
   * For the single-AHU case the output matches the legacy three-sheet
   * export so existing review workflows are unaffected.
   */
  ahus: AhuInput[];
  /**
   * The currently-active AHU id. Its sheet-set gets a yellow tab color so
   * a reviewer can see at a glance which AHU was on screen when the file
   * was generated. Unknown ids simply mean no AHU gets the active marker.
   */
  activeId: string;
}

/**
 * Export the project to an .xlsx workbook. One sheet-set per AHU:
 *   {AHU name} - Inputs     — every zone's user-input fields
 *   {AHU name} - Calc       — per-zone derived values (Rp/Ra/Ez/Vbz/Voz/Ep/Zd/Evz)
 *   {AHU name} - Summary    — Vot, Vou, Ev, Xs, %OA, # zones, critical zone
 *
 * The active AHU's sheets get a yellow tab color (FFFFE082) so the
 * reviewer can spot which unit was being worked on. Sheet names are
 * truncated to 31 chars (Excel limit) with the suffix preserved.
 */
export function ExportButton({ ahus, activeId }: ExportButtonProps): JSX.Element {
  const onClick = async (): Promise<void> => {
    const wb = buildWorkbook(ahus, activeId, compute);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
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