/**
 * EffZoneChart — visualizes per-zone ventilation efficiency E_vz so the user
 * can see *which* zone drives the system E_v.
 *
 * For multizone Appendix A: bars are sorted ascending (lowest first), the
 * lowest is the critical zone (highlighted), axis is 0.50–1.05.
 *
 * For multizone Simplified (Table 6-3 / Eq. 6-7/6-8): bars are sorted by Z_p
 * descending, the highest is the driving zone (highlighted), axis is
 * 0.00–0.60.
 *
 * For single-zone §6.2.5.1: this component renders nothing — E_v = 1 by
 * definition, no per-zone breakdown makes sense.
 */
import { useMemo, useState } from 'react';
import type { AhuInput, MultiZoneResult, SingleZoneResult, ZoneResult } from '../lib/ashrae621';
import type { Units } from '../lib/units';

export interface EffZoneChartProps {
  ahu: AhuInput;
  result: MultiZoneResult | SingleZoneResult;
  /**
   * Active unit system for display. Accepted for consistency with the other
   * analysis components but currently unused — the chart only renders
   * dimensionless ratios (Evz, Zd), which are unit-invariant.
   */
  unitSystem?: Units;
}

interface Bar {
  tag: string;
  pct: number; // 0..100
  val: string; // formatted value (3 decimals)
  isCritical: boolean;
  isLow: boolean; // Evz < 0.9 (warning)
}

export function EffZoneChart({
  ahu,
  result,
  // Plumbed for P0.3 — chart only renders unitless ratios (Evz, Zd) so
  // no display conversion is required. Keeping the prop in the interface
  // so a future Voz/area overlay can be unit-aware without churning callers.
  unitSystem: _unitSystem,
}: EffZoneChartProps): JSX.Element | null {
  const [open, setOpen] = useState(true);

  const isMultiResult = 'rows' in result && 'vou' in result;
  const m = isMultiResult ? (result as MultiZoneResult) : null;
  const isSimplified = m?.simp === true;

  const bars: Bar[] = useMemo(() => {
    if (!m) return [];
    const rows = m.rows;
    if (rows.length === 0) return [];
    if (isSimplified) {
      // Simplified: sort by Zd descending. Driving zone is max.
      const sorted = [...rows].sort((a: ZoneResult, b: ZoneResult) => b.zd - a.zd);
      return sorted.map((r) => ({
        tag: r.z.tag ?? '—',
        pct: Math.max(2, Math.min(100, (r.zd / 0.6) * 100)),
        val: r.zd.toFixed(3),
        isCritical: m.crit !== null && r.z.id === m.crit.z.id,
        isLow: false,
      }));
    }
    // Appendix A: sort by Evz ascending. Critical is the minimum.
    const sorted = [...rows].sort((a: ZoneResult, b: ZoneResult) => a.evz - b.evz);
    return sorted.map((r) => ({
      tag: r.z.tag ?? '—',
      pct: Math.max(2, Math.min(100, ((r.evz - 0.5) / 0.55) * 100)),
      val: r.evz.toFixed(3),
      isCritical: m.crit !== null && r.z.id === m.crit.z.id,
      isLow: r.evz < 0.9,
    }));
  }, [m, isSimplified]);

  // Only meaningful for multizone — singlezone has no per-zone breakdown.
  if (!m || m.rows.length === 0) return null;

  const title = isSimplified ? 'Zone primary OA fraction Zd' : 'Zone ventilation efficiency Evz';
  const subtitle = isSimplified
    ? 'Sorted high → low. The maximum drives Table 6-3 / Eq. 6-7–6-8.'
    : 'Sorted low → high. The lowest (critical) zone sets system Ev.';
  const axisLo = isSimplified ? '0.00' : '0.50';
  const axisHi = isSimplified ? '0.60' : '1.05';

  return (
    <section className="eff-chart-card" aria-label="Per-zone efficiency chart">
      <header className="eff-chart-card__head">
        <div>
          <div className="eff-chart-card__eyebrow">02</div>
          <h2 className="eff-chart-card__title">{title}</h2>
          <p className="eff-chart-card__sub">{subtitle}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          data-testid="eff-chart-toggle"
        >
          {open ? 'Hide ▲' : 'Show ▼'}
        </button>
      </header>

      {open && (
        <>
          <div className="eff-chart" role="list">
            {bars.map((b) => (
              <div className="eff-chart__row" role="listitem" key={b.tag}>
                <span className={`eff-chart__tag${b.isCritical ? ' eff-chart__tag--crit' : ''}`}>
                  {b.tag}
                </span>
                <div className="eff-chart__track">
                  <div
                    className={`eff-chart__bar${b.isCritical ? ' eff-chart__bar--crit' : ''}${b.isLow ? ' eff-chart__bar--low' : ''}`}
                    style={{ width: `${b.pct}%` }}
                    data-testid="eff-chart-bar"
                    data-bar-tag={b.tag}
                  />
                </div>
                <span className={`eff-chart__val${b.isCritical ? ' eff-chart__val--crit' : ''}`}>
                  {b.val}
                </span>
              </div>
            ))}
          </div>
          <div className="eff-chart__axis" aria-hidden="true">
            <span>{axisLo}</span>
            <span>{axisHi}</span>
          </div>
          <p className="eff-chart__legend">
            {isSimplified ? (
              <>
                Driving zone is <b>highlighted</b>.
              </>
            ) : (
              <>
                Critical zone is <b>highlighted</b>. Bars below <b>0.90</b> show a warning tint (low
                ventilation efficiency).
              </>
            )}{' '}
            Air handler: <b>{ahu.name ?? '—'}</b>.
          </p>
        </>
      )}
    </section>
  );
}
