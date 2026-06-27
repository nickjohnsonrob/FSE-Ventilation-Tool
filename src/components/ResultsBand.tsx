import type { AhuInput, MultiZoneResult, SingleZoneResult } from '../lib/ashrae621';
import { fmtCfm, fmtPct, fmtRatio } from '../lib/format';
import type { Units } from '../lib/units';

export interface ResultsBandProps {
  ahu: AhuInput;
  result: MultiZoneResult | SingleZoneResult;
  /** Active unit system for display. Optional — defaults to I-P. */
  unitSystem?: Units;
  open: boolean;
  onToggle: () => void;
}

export function ResultsBand({
  result,
  // Plumbed for P0.3 — currently unused; render logic lives in that card.
  unitSystem: _unitSystem = 'ip',
  open,
  onToggle,
}: ResultsBandProps): JSX.Element {
  const isMulti = 'vou' in result;
  const vot = isMulti ? result.vot : result.vot;
  const ev = isMulti ? result.ev : 1;
  const xs = isMulti ? result.xs : 0;
  const oaPct = isMulti ? result.oaPct : result.oaPct;

  return (
    <section className="results-band" aria-label="Results">
      <header className="results-band__header">
        <h2>
          V<sub>ot</sub> = {fmtCfm(vot)} cfm
        </h2>
        <button type="button" className="toggle-btn" onClick={onToggle}>
          {open ? 'Hide details ▲' : 'Show details ▼'}
        </button>
      </header>

      {open && (
        <div className="results-band__grid">
          <Tile label="Vou" value={isMulti ? fmtCfm(result.vou) : '—'} sub="uncorrected OA" />
          <Tile label="Xs" value={isMulti ? fmtRatio(xs) : '—'} sub="system OA fraction" />
          <Tile label="Ev" value={fmtRatio(ev)} sub={isMulti ? (result.simp ? 'Simplified' : 'Appendix A') : 'Single-zone (§6.2.5.1)'} />
          <Tile label="%OA" value={fmtPct(oaPct)} sub="of supply airflow" />
        </div>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}): JSX.Element {
  return (
    <div className="tile">
      <div className="tile__label">{label}</div>
      <div className="tile__value">{value}</div>
      {sub && <div className="tile__sub muted">{sub}</div>}
    </div>
  );
}
