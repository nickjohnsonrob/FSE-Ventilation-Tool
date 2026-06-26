import type { AhuInput, MultiZoneResult, SingleZoneResult } from '../lib/ashrae621';
import { EZ_CONFIGS, OCCUPANCY_CATEGORIES } from '../lib/tables';
import { fmtCfm, fmtRatio } from '../lib/format';

export interface ZoneTableProps {
  ahu: AhuInput;
  result: MultiZoneResult | SingleZoneResult;
  onPatchAhu: (partial: Partial<AhuInput>) => void;
  onShowEzHelp: () => void;
}

/** Column headers + inputs for the per-zone editable table. */
export function ZoneTable({
  ahu,
  result,
  onPatchAhu,
  onShowEzHelp,
}: ZoneTableProps): JSX.Element {
  const occOptions = Object.keys(OCCUPANCY_CATEGORIES).sort();
  const isMulti = ahu.type === 'multizone';

  return (
    <section className="zone-table" aria-label="Zone inputs">
      <table>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Occupancy</th>
            <th className="num">Area (ft²)</th>
            <th className="num">Pop</th>
            <th className="num">
              V<sub>pz</sub> (cfm)
            </th>
            <th className="num">
              V<sub>dz</sub> (cfm)
            </th>
            <th className="num">
              V<sub>dzm</sub> (cfm)
            </th>
            <th>
              E<sub>z</sub>
              <button
                type="button"
                className="help-btn"
                onClick={onShowEzHelp}
                title="What do these mean? (Table 6-2)"
              >
                ?
              </button>
            </th>
            <th className="num calc">
              V<sub>oz</sub>
            </th>
            <th className="num calc">
              Z<sub>d</sub>
            </th>
          </tr>
        </thead>
        <tbody>
          {ahu.zones.map((z) => {
            const row = 'rows' in result ? result.rows.find((r) => r.z.id === z.id) : null;
            return (
              <tr key={z.id}>
                <td>
                  <input
                    className="tag-input"
                    value={z.tag ?? ''}
                    onChange={(e) => {
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, tag: e.target.value } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  />
                </td>
                <td>
                  <select
                    value={z.space}
                    onChange={(e) => {
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, space: e.target.value } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  >
                    {occOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={z.area || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, area: isFinite(v) ? v : 0 } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={z.pop || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, pop: isFinite(v) ? v : 0 } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={z.vpz || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, vpz: isFinite(v) ? v : 0 } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={z.vdz || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, vdz: isFinite(v) ? v : 0 } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={z.vdzm || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, vdzm: isFinite(v) ? v : 0 } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  />
                </td>
                <td>
                  <select
                    value={z.ezConfig}
                    onChange={(e) => {
                      const zones = ahu.zones.map((zz) =>
                        zz.id === z.id ? { ...zz, ezConfig: e.target.value } : zz,
                      );
                      onPatchAhu({ zones });
                    }}
                  >
                    {EZ_CONFIGS.map(([label, _v, short]) => (
                      <option key={label} value={label}>
                        {short}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="num calc">{row ? fmtCfm(row.voz) : '—'}</td>
                <td className="num calc">{row ? fmtRatio(row.zd) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {isMulti && (
            <tr>
              <td colSpan={3} className="muted">
                Totals
              </td>
              <td className="num">{'sumPz' in result ? result.sumPz : '—'}</td>
              <td className="num">
                {'sumVpz' in result ? fmtCfm(result.sumVpz) : '—'}
              </td>
              <td />
              <td />
              <td />
              <td className="num calc">
                {'sumVoz' in result ? fmtCfm(result.sumVoz) : '—'}
              </td>
              <td />
            </tr>
          )}
        </tfoot>
      </table>

      <div className="zone-table__actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const zones = [
              ...ahu.zones,
              {
                id: `z${Date.now()}`,
                tag: `TU-${String(ahu.zones.length + 1).padStart(2, '0')}`,
                space: 'Office space',
                area: 500,
                pop: 5,
                vpz: 600,
                vdz: 600,
                vdzm: 0,
                ezConfig: 'Ceiling supply of cool air',
                box: 'single' as const,
                er: 0,
              },
            ];
            onPatchAhu({ zones });
          }}
        >
          + Add zone
        </button>
      </div>
    </section>
  );
}
