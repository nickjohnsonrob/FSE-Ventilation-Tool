import type {
  AhuInput,
  MultiZoneResult,
  RoomInput,
  RoomResult,
  SingleZoneResult,
  ZoneInput,
} from '../lib/ashrae621';
import { EZ_CONFIGS, OCCUPANCY_CATEGORIES } from '../lib/tables';
import { fmtCfm, fmtRatio } from '../lib/format';

export interface ZoneTableProps {
  ahu: AhuInput;
  result: MultiZoneResult | SingleZoneResult;
  onPatchAhu: (partial: Partial<AhuInput>) => void;
  onPatchZone: (id: string, partial: Partial<ZoneInput>) => void;
  onAddZone: () => void;
  onRemoveZone: (id: string) => void;
  onResetZones: () => void;
  onPatchRoom: (zid: string, rid: string, partial: Partial<RoomInput>) => void;
  onAddRoom: (zid: string) => void;
  onRemoveRoom: (zid: string, rid: string) => void;
  onShowEzHelp: () => void;
}

/**
 * Zone input table + (optional) room sub-table per zone + footer add controls.
 *
 * Two display modes:
 *   - **multizone** — one row per TU; optional rooms sub-table per zone when
 *     `ahu.roomsEnabled` is true (matches v1.0.0 "roomsEnabled" toggle).
 *   - **singlezone** — one row per zone; no rooms sub-table (the DOAS view).
 */
export function ZoneTable({
  ahu,
  result,
  onPatchAhu,
  onPatchZone,
  onAddZone,
  onRemoveZone,
  onResetZones,
  onPatchRoom,
  onAddRoom,
  onRemoveRoom,
  onShowEzHelp,
}: ZoneTableProps): JSX.Element {
  const occOptions = Object.keys(OCCUPANCY_CATEGORIES).sort();
  const isMulti = ahu.type === 'multizone';
  const roomsEnabled = ahu.roomsEnabled ?? false;

  // Build a map of zone id -> rooms result for the multizone-with-rooms view.
  const roomResultsByZone = new Map<string, RoomResult[]>();
  if (isMulti && 'rows' in result) {
    for (const row of result.rows) {
      if (row.roomCalcs) roomResultsByZone.set(row.z.id, row.roomCalcs);
    }
  }

  return (
    <section className="zone-table" aria-label="Zone inputs">
      <div className="zone-table__meta">
        <label className="zone-table__meta-field">
          <span>AHU</span>
          <input
            type="text"
            value={ahu.name ?? ''}
            onChange={(e) => onPatchAhu({ name: e.target.value })}
            placeholder="RTU-01"
            data-testid="ahu-name"
            style={{ width: '110px' }}
          />
        </label>
        <label className="zone-table__meta-field">
          <span>Condition</span>
          <input
            type="text"
            value={ahu.condition ?? ''}
            onChange={(e) => onPatchAhu({ condition: e.target.value })}
            placeholder="Cooling — design"
            style={{ width: '180px' }}
          />
        </label>
        <div className="zone-table__meta-tag">
          {isMulti ? 'Multi-zone (Appendix A)' : 'Single-zone (DOAS)'}
        </div>
      </div>

      <div className="zone-table__toolbar">
        <div className="zone-table__toolbar-title">
          <span className="zone-table__step">01</span>
          <span>Ventilation Zones</span>
        </div>
        <div className="zone-table__toolbar-actions">
          {isMulti && (
            <button
              type="button"
              className={`btn btn--ghost${roomsEnabled ? ' btn--on' : ''}`}
              onClick={() => onPatchAhu({ roomsEnabled: !roomsEnabled })}
              data-testid="rooms-toggle"
              title="When on, each zone has its own rooms table; the critical room drives Voz."
            >
              {roomsEnabled ? 'Rooms ●' : 'Rooms'}
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onResetZones}
            title="Restore the default zones for this AHU type."
          >
            Reset zones
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onAddZone}
            data-testid="add-zone"
          >
            + Add zone
          </button>
        </div>
      </div>

      <div className="zone-table__scroll">
        <table className="zone-table__main">
          <thead>
            <tr>
              <th className="col-tag">Tag</th>
              <th className="col-space">Occupancy</th>
              <th className="num">
                A<sub>z</sub>
                <div className="th-sub">ft²</div>
              </th>
              <th className="num">P<sub>z</sub></th>
              <th className="num">
                V<sub>pz</sub>
                <div className="th-sub">cfm</div>
              </th>
              {isMulti && (
                <>
                  <th className="num">
                    V<sub>dz</sub>
                    <div className="th-sub">cfm</div>
                  </th>
                  <th className="num">
                    V<sub>dzm</sub>
                    <div className="th-sub">cfm</div>
                  </th>
                </>
              )}
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
              {isMulti && (
                <th className="num calc">
                  V<sub>oz</sub>
                </th>
              )}
              {isMulti && (
                <th className="num calc">
                  Z<sub>d</sub>
                </th>
              )}
              <th className="col-remove" aria-label="Remove"></th>
            </tr>
          </thead>
          <tbody>
            {ahu.zones.map((z) => {
              const row =
                'rows' in result ? result.rows.find((r) => r.z.id === z.id) : null;
              const critRow = 'crit' in result ? result.crit : null;
              const isCrit = !!critRow && critRow.z.id === z.id;
              return (
                <tr key={z.id} className={isCrit ? 'row--crit' : undefined}>
                  <td className="col-tag">
                    <input
                      className="tag-input"
                      value={z.tag ?? ''}
                      onChange={(e) =>
                        onPatchZone(z.id, { tag: e.target.value })
                      }
                    />
                  </td>
                  <td className="col-space">
                    <select
                      value={z.space}
                      onChange={(e) =>
                        onPatchZone(z.id, { space: e.target.value })
                      }
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
                      value={Number.isFinite(z.area) ? z.area : 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onPatchZone(z.id, { area: isFinite(v) ? v : 0 });
                      }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      value={Number.isFinite(z.pop) ? z.pop : 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onPatchZone(z.id, { pop: isFinite(v) ? v : 0 });
                      }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      value={Number.isFinite(z.vpz) ? z.vpz : 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onPatchZone(z.id, { vpz: isFinite(v) ? v : 0 });
                      }}
                    />
                  </td>
                  {isMulti && (
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(z.vdz ?? 0) ? (z.vdz ?? 0) : 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          onPatchZone(z.id, { vdz: isFinite(v) ? v : 0 });
                        }}
                      />
                    </td>
                  )}
                  {isMulti && (
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        value={Number.isFinite(z.vdzm ?? 0) ? (z.vdzm ?? 0) : 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          onPatchZone(z.id, { vdzm: isFinite(v) ? v : 0 });
                        }}
                      />
                    </td>
                  )}
                  <td>
                    <select
                      value={z.ezConfig}
                      onChange={(e) =>
                        onPatchZone(z.id, { ezConfig: e.target.value })
                      }
                    >
                      {EZ_CONFIGS.map(([label, _v, short]) => (
                        <option key={label} value={label}>
                          {short}
                        </option>
                      ))}
                    </select>
                  </td>
                  {isMulti && (
                    <td className="num calc">
                      {row ? fmtCfm(row.voz) : '—'}
                    </td>
                  )}
                  {isMulti && (
                    <td className="num calc">
                      {row ? fmtRatio(row.zd) : '—'}
                    </td>
                  )}
                  <td className="col-remove">
                    {ahu.zones.length > 1 && (
                      <button
                        type="button"
                        className="row-remove"
                        onClick={() => onRemoveZone(z.id)}
                        title="Remove zone"
                        aria-label={`Remove ${z.tag ?? 'zone'}`}
                        data-remove-zone={z.id}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {isMulti && (
            <tfoot>
              <tr>
                <td className="muted" colSpan={3}>
                  Totals
                </td>
                <td className="num">
                  {'sumPz' in result ? result.sumPz : '—'}
                </td>
                <td className="num">
                  {'sumVpz' in result ? fmtCfm(result.sumVpz) : '—'}
                </td>
                {isMulti && <td />}
                {isMulti && <td />}
                <td />
                <td className="num calc">
                  {'sumVoz' in result ? fmtCfm(result.sumVoz) : '—'}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Rooms sub-table — only when multizone + roomsEnabled */}
      {isMulti && roomsEnabled && (
        <div className="zone-rooms">
          {ahu.zones.map((z) => (
            <RoomTable
              key={z.id}
              zone={z}
              roomResults={roomResultsByZone.get(z.id) ?? []}
              onAdd={() => onAddRoom(z.id)}
              onRemove={(rid) => onRemoveRoom(z.id, rid)}
              onPatch={(rid, p) => onPatchRoom(z.id, rid, p)}
              onShowEzHelp={onShowEzHelp}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Room sub-table
// ----------------------------------------------------------------------------

interface RoomTableProps {
  zone: ZoneInput;
  roomResults: RoomResult[];
  onAdd: () => void;
  onRemove: (rid: string) => void;
  onPatch: (rid: string, partial: Partial<RoomInput>) => void;
  onShowEzHelp: () => void;
}

function RoomTable({
  zone,
  roomResults,
  onAdd,
  onRemove,
  onPatch,
  onShowEzHelp,
}: RoomTableProps): JSX.Element {
  const occOptions = Object.keys(OCCUPANCY_CATEGORIES).sort();
  const rooms = zone.rooms ?? [];

  return (
    <div className="room-table" data-room-zone={zone.id}>
      <div className="room-table__toolbar">
        <div className="room-table__title">
          <span className="room-table__zone-tag">{zone.tag ?? 'Zone'}</span>
          <span>Zone rooms</span>
          <span className="room-table__hint">
            Critical room (highest Z<sub>p</sub>) sets the zone outdoor-air demand.
          </span>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={onAdd}
          data-testid="add-room"
          data-room-add={zone.id}
        >
          + Add room
        </button>
      </div>

      <div className="room-table__scroll">
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Occupancy</th>
              <th className="num">
                A<sub>z</sub>
                <div className="th-sub">ft²</div>
              </th>
              <th className="num">P<sub>z</sub></th>
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
              <th className="num">
                V<sub>pz</sub>
                <div className="th-sub">cfm</div>
              </th>
              <th className="num calc">R<sub>p</sub></th>
              <th className="num calc">R<sub>a</sub></th>
              <th className="num calc">V<sub>bz</sub></th>
              <th className="num calc">V<sub>oz</sub></th>
              <th className="num calc">Z<sub>p</sub></th>
              <th className="col-remove" aria-label="Remove"></th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 && (
              <tr>
                <td colSpan={12} className="room-table__empty">
                  No rooms yet — click <strong>+ Add room</strong>.
                </td>
              </tr>
            )}
            {rooms.map((r) => {
              const result = roomResults.find((rr) => rr.id === r.id);
              return (
                <tr
                  key={r.id}
                  className={result?.zp === Math.max(...roomResults.map((x) => x.zp)) ? 'row--crit' : undefined}
                  data-room-row={r.id}
                >
                  <td className="col-tag">
                    <input
                      className="tag-input"
                      value={r.tag ?? ''}
                      onChange={(e) => onPatch(r.id, { tag: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={r.space}
                      onChange={(e) => onPatch(r.id, { space: e.target.value })}
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
                      value={Number.isFinite(r.area) ? r.area : 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onPatch(r.id, { area: isFinite(v) ? v : 0 });
                      }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      value={Number.isFinite(r.pop) ? r.pop : 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onPatch(r.id, { pop: isFinite(v) ? v : 0 });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={r.ezConfig}
                      onChange={(e) => onPatch(r.id, { ezConfig: e.target.value })}
                    >
                      {EZ_CONFIGS.map(([label, _v, short]) => (
                        <option key={label} value={label}>
                          {short}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      value={Number.isFinite(r.vpz) ? r.vpz : 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onPatch(r.id, { vpz: isFinite(v) ? v : 0 });
                      }}
                    />
                  </td>
                  <td className="num calc">{result ? fmtCfm(result.rp * r.pop) : '—'}</td>
                  <td className="num calc">{result ? fmtCfm(result.ra * r.area) : '—'}</td>
                  <td className="num calc">{result ? fmtCfm(result.vbz) : '—'}</td>
                  <td className="num calc">{result ? fmtCfm(result.voz) : '—'}</td>
                  <td className="num calc">
                    {result ? fmtRatio(result.zp) : '—'}
                    {(() => {
                      if (!result || roomResults.length === 0) return null;
                      const maxZp = Math.max(...roomResults.map((x) => x.zp));
                      return result.zp === maxZp ? (
                        <span className="crit-badge">CRIT</span>
                      ) : null;
                    })()}
                  </td>
                  <td className="col-remove">
                    <button
                      type="button"
                      className="row-remove"
                      onClick={() => onRemove(r.id)}
                      title="Remove room"
                      aria-label={`Remove ${r.tag ?? 'room'}`}
                      data-room-remove={r.id}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}