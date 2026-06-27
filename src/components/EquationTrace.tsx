/**
 * EquationTrace — shows the step-by-step math for the selected zone (or
 * the critical zone by default). Matches v1.0.0's "03 Equation trace"
 * panel: each step has a symbol (e.g. Voz, Zd, Evz, Vot), a formula in
 * short form, the substituted values, and the result.
 *
 * For single-zone the trace covers Voz and Vot only.
 */
import { useMemo, useState } from 'react';
import type {
  AhuInput,
  MultiZoneResult,
  RoomResult,
  SingleZoneResult,
  SystemType,
  ZoneResult,
} from '../lib/ashrae621';
import { formatFlow } from '../lib/units';
import type { Units } from '../lib/units';

export interface EquationTraceProps {
  ahu: AhuInput;
  result: MultiZoneResult | SingleZoneResult;
  /** Active unit system for display. Optional — defaults to I-P. */
  unitSystem?: Units;
}

interface TraceStep {
  sym: string;
  formula: string;
  sub: string;
  out: string;
  /** Highlight class for the symbol/out: 'ink' (default), 'ok', 'warn', 'crit'. */
  tone: 'ink' | 'ok' | 'warn' | 'crit';
}

const f = (n: number, p = 1): string => (Number.isFinite(n) ? n.toFixed(p) : '—');

export function EquationTrace({
  ahu,
  result,
  unitSystem = 'ip',
}: EquationTraceProps): JSX.Element | null {
  const isMulti = 'vou' in result;
  const multi = isMulti ? (result as MultiZoneResult) : null;
  const rows: ZoneResult[] = 'rows' in result ? result.rows : [];

  // System ventilation type — DR is the default if the field is missing
  // (back-compat with deserialized / hand-edited fixtures that predate
  // the dropdown). `systemType` is display-only: Vot math is byte-identical
  // across all three.
  const systemType: SystemType = ahu.systemType ?? 'DR';

  // Default to the critical zone (multizone) or the only zone (singlezone).
  const defaultId = multi?.crit?.z.id ?? multi?.rows[0]?.z.id ?? rows[0]?.z.id ?? null;

  const [open, setOpen] = useState(true);
  const [selId, setSelId] = useState<string | null>(defaultId);

  // Keep the selection valid if the underlying zones change.
  const selIdSafe = selId !== null && rows.some((r) => r.z.id === selId) ? selId : defaultId;
  const tr = rows.find((r) => r.z.id === selIdSafe) ?? null;

  const steps: TraceStep[] = useMemo(() => {
    if (!tr) return [];
    const out: TraceStep[] = [];

    // formatFlow() returns the active-unit display string ("500 cfm" or
    // "0.236 m³/s"). Math values stay I-P — conversion happens at the
    // format boundary only.
    const vozOut = formatFlow(tr.voz, unitSystem);
    const votOut = multi ? formatFlow(multi.vot, unitSystem) : '';

    if (tr.drive && tr.roomCalcs && tr.roomCalcs.length > 0) {
      // Critical-room rollup
      const crc = tr.roomCalcs.find((x: RoomResult) => x.id === tr.critRoomId);
      const tag = crc?.tag ?? '—';
      out.push({
        sym: 'Voz',
        formula: `critical room · ${tag} · Zp,crit · ΣVpz`,
        sub: `${f(tr.critZp, 3)} × ${f(tr.vpz, 0)}  (${tr.roomCalcs.length} rooms)`,
        out: vozOut,
        tone: 'ink',
      });
    } else {
      // Lumped: Voz = (Pz·Rp + Az·Ra) / Ez
      out.push({
        sym: 'Voz',
        formula: '(Pz·Rp + Az·Ra) / Ez',
        sub: `(${f(tr.pop)} · ${f(tr.rp, 1)} + ${f(tr.area, 0)} · ${f(tr.ra, 2)}) / ${f(tr.ez, 1)}`,
        out: vozOut,
        tone: 'ink',
      });
    }

    if (tr.fan) {
      out.push({
        sym: 'Ep',
        formula: 'Vpz / Vdz',
        sub: `${f(tr.vpz)} / ${f(tr.vdz)}`,
        out: f(tr.ep, 3),
        tone: 'ink',
      });
      out.push({
        sym: 'Fa/Fb/Fc',
        formula: 'recirc factors',
        sub: `Fa=${f(tr.fa, 2)}  Fb=${f(tr.fb, 2)}  Fc=${f(tr.fc, 2)}`,
        out: '',
        tone: 'ink',
      });
    }

    out.push({
      sym: 'Zd',
      formula: 'Voz / Vdzm  (min discharge)',
      sub: `${f(tr.voz, 1)} / ${f(tr.vdzm)}`,
      out: f(tr.zd, 3),
      tone: 'ink',
    });

    out.push({
      sym: 'Evz',
      formula: '(Fa + Xs·Fb − Zd·Fc) / Fa',
      sub: multi
        ? `(${f(tr.fa, 2)} + ${f(multi.xs, 3)}·${f(tr.fb, 2)} − ${f(tr.zd, 3)}·${f(tr.fc, 2)})`
        : `(single-zone: Ev = 1)`,
      out: f(tr.evz, 3),
      tone: tr.evz < 0.9 ? 'warn' : 'ink',
    });

    if (multi) {
      out.push({
        sym: 'Vot',
        formula: `Vou / Ev  (Ev = min(Evz) = ${f(multi.ev, 3)})`,
        sub: `${f(multi.vou, 0)} / ${f(multi.ev, 3)}`,
        out: votOut,
        tone: 'ok',
      });

      // === System-type trace additions (display-only; vot math unchanged) ===
      //
      // ASHRAE 62.1 §6.2.5 / §6.2.6 distinguishes:
      //   DR   — Dilution (recirculating), simplest path. Vot is the
      //          single deliverable flow.
      //   DC   — Distribution-controlled. Adds a transfer-airflow term
      //          V_tr (the OA stream dedicated to the zones via a
      //          separate conduit). V_tr = Vou here — the uncorrected
      //          OA the system delivers before the Ev adjustment.
      //   DC+  — DC with enhanced fan-power allowance (informational).
      //          Adds a comparison note: Vot ≥ V_tr when Ev ≤ 1 (Ev is
      //          a penalty, not a multiplier), so Vot ≥ V_tr always
      //          holds for valid inputs.
      //
      // These additions intentionally do NOT alter Vot. The math core
      // remains byte-identical across DR/DC/DC+ — verified by the
      // `V_ot value is UNCHANGED across DR/DC/DC+` Playwright test.
      if (systemType === 'DC' || systemType === 'DC+') {
        // V_tr = Vou — uncorrected OA delivered before Ev. This is the
        // "transfer airflow" term that DC systems document separately
        // from the system OA requirement Vot. Use the same active-unit
        // formatter as Vot so the step respects the toggle.
        const vtrOut = formatFlow(multi.vou, unitSystem);
        out.push({
          sym: 'V_tr',
          formula: 'Vou  (transfer airflow to zones)',
          sub: `${f(multi.vou, 0)}  (uncorrected OA)`,
          out: vtrOut,
          tone: 'ink',
        });
      }

      if (systemType === 'DC+') {
        // DC+ adds an informational comparison step. Ev ≤ 1 by §A-3,
        // so Vot = Vou / Ev ≥ Vou = V_tr. The step surfaces this as a
        // ratio so an engineer can verify the design margin at a
        // glance.
        const ratio = multi.vou > 0 ? multi.vot / multi.vou : 0;
        out.push({
          sym: 'V_ot ↔ V_tr',
          formula: 'Vot / V_tr = 1 / Ev',
          sub: `${f(multi.vot, 0)} / ${f(multi.vou, 0)}`,
          out: ratio > 0 ? `× ${f(ratio, 3)}` : '—',
          tone: 'ok',
        });
      }
    }

    return out;
  }, [tr, multi, unitSystem, systemType]);

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
            <span className="eq-trace__units">
              {' '}
              · values shown in {unitSystem === 'si' ? 'SI' : 'I-P'}
            </span>
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
