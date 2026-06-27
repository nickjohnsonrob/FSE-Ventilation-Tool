/**
 * EquationTrace — shows the step-by-step math for the selected zone (or
 * the critical zone by default). Matches v1.0.0's "03 Equation trace"
 * panel: each step has a symbol (e.g. Voz, Zd, Evz, Vot), a formula in
 * short form, the substituted values, and the result.
 *
 * For single-zone the trace covers Voz and Vot only.
 *
 * Step construction is delegated to the pure-function `buildTraceSteps` in
 * `lib/ashrae621.ts` so the step shape is unit-testable without React. The
 * systemType field on the AHU extends the trace with V_tr (DC) and a
 * V_ot-vs-V_tr comparison step (DC+). See the math-core JSDoc.
 */
import { useMemo, useState } from 'react';
import type { AhuInput, MultiZoneResult, SingleZoneResult, ZoneResult } from '../lib/ashrae621';
import { buildTraceSteps, type TraceStep } from '../lib/ashrae621';

export interface EquationTraceProps {
  ahu: AhuInput;
  result: MultiZoneResult | SingleZoneResult;
}

export function EquationTrace({ ahu, result }: EquationTraceProps): JSX.Element | null {
  const isMulti = 'vou' in result;
  const multi = isMulti ? (result as MultiZoneResult) : null;
  const rows: ZoneResult[] = 'rows' in result ? result.rows : [];

  // Default to the critical zone (multizone) or the only zone (singlezone).
  const defaultId = multi?.crit?.z.id ?? multi?.rows[0]?.z.id ?? rows[0]?.z.id ?? null;

  const [open, setOpen] = useState(true);
  const [selId, setSelId] = useState<string | null>(defaultId);

  // Keep the selection valid if the underlying zones change.
  const selIdSafe = selId !== null && rows.some((r) => r.z.id === selId) ? selId : defaultId;
  const tr = rows.find((r) => r.z.id === selIdSafe) ?? null;

  // Step construction is delegated to the math-core `buildTraceSteps` so
  // the DR / DC / DC+ shape is unit-tested without React. The hook only
  // memoizes the result; the systemType field on the AHU drives which
  // additional steps (V_tr, comparison) are appended.
  const steps: TraceStep[] = useMemo(
    () => buildTraceSteps(ahu, result, selIdSafe),
    [ahu, result, selIdSafe],
  );

  if (rows.length === 0) return null;

  const isFlagged =
    multi?.crit !== null && multi?.crit !== undefined && tr !== null && tr.z.id === multi.crit.z.id;
  const flaggedTag = multi?.crit?.z.tag;
  const note =
    tr === null
      ? ''
      : isFlagged
        ? `▸ ${tr.z.tag} is the critical zone — its Evz sets the system Ev.`
        : `${tr.z.tag}  (critical zone is ${flaggedTag ?? '—'})`;

  return (
    <section className="eq-trace" aria-label="Equation trace">
      <header className="eq-trace__head">
        <div>
          <div className="eq-trace__eyebrow">03</div>
          <h2 className="eq-trace__title">Equation trace</h2>
          <p className="eq-trace__note">
            {note || 'Pick a zone to see the math step-by-step.'}
            <span className="eq-trace__units"> · values shown in I-P</span>
          </p>
        </div>
        <div className="eq-trace__controls">
          {rows.length > 1 && (
            <select
              value={selIdSafe ?? ''}
              onChange={(e) => setSelId(e.target.value)}
              className="eq-trace__select"
              data-testid="eq-trace-select"
              aria-label="Select zone"
            >
              {rows.map((r) => (
                <option key={r.z.id} value={r.z.id}>
                  {r.z.tag ?? r.z.id}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            data-testid="eq-trace-toggle"
          >
            {open ? 'Hide ▲' : 'Show ▼'}
          </button>
        </div>
      </header>

      {open && (
        <div className="eq-trace__steps" data-testid="eq-trace-steps">
          {steps.map((s, i) => (
            <div key={i} className="eq-trace__step">
              <div className="eq-trace__line">
                <span className={`eq-trace__sym eq-trace__sym--${s.tone}`}>{s.sym}</span>
                <span className="eq-trace__formula">{s.formula}</span>
              </div>
              {(s.sub !== '' || s.out !== '') && (
                <div className="eq-trace__line eq-trace__line--sub">
                  <span className="eq-trace__sub">{s.sub}</span>
                  {s.out !== '' && (
                    <>
                      <span className="eq-trace__eq">=</span>
                      <span className={`eq-trace__out eq-trace__out--${s.tone}`}>{s.out}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
