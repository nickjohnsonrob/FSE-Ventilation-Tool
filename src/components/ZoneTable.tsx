import { useState } from 'react';
import type {
  AhuInput,
  MultiZoneResult,
  RoomInput,
  RoomResult,
  SingleZoneResult,
  ZoneInput,
  ZoneResult,
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
 * Zone input table.
 *
 * v3 — rooms render **inline** below each zone row (chevron expand) instead
 * of in a separate sub-table. This matches the v1.0.0 layout and removes
 * the global "Rooms" toolbar toggle. Room rows share the same `<thead>` as
 * their parent zone; an indented `+ Room` sub-row appears at the bottom of
 * each expanded zone with the v1-style "Rooms drive TU totals" checkbox.
 *
 * Two display modes:
 *   - **multizone** — one row per TU; rooms inline when chevron is open.
 *   - **singlezone** — one row per zone; no rooms.
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

  // UI-only state — which zones are expanded. Resets when the AHU changes.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (zid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(zid)) next.delete(zid);
      else next.add(zid);
      return next;
    });

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
              const row: ZoneResult | null =
                'rows' in result && result.rows
                  ? result.rows.find((r) => r.z.id === z.id) ?? null
                  : null;
              const critRow = 'crit' in result ? result.crit : null;
              const isCrit = !!critRow && critRow.z.id === z.id;
              const rooms = z.rooms ?? [];
              const isOpen = expanded.has(z.id);
              // CRIT badge on zone row: the zone owns the critical room
              // (highest Zp) per §6.2.5.1. `ZoneResult.critRoomId` is the
              // authoritative signal from the math core.
              const hasCriticalRoom = row !== null && row.critRoomId !== null;
              return (
                <ZoneRows
                  key={z.id}
                  zone={z}
                  row={row}
                  isCrit={isCrit}
                  isMulti={isMulti}
                  isOpen={isOpen}
                  rooms={rooms}
                  hasCriticalRoom={hasCriticalRoom}
                  occOptions={occOptions}
                  onToggleExpanded={() => toggleExpanded(z.id)}
                  onPatchZone={onPatchZone}
                  onRemoveZone={onRemoveZone}
                  onPatchRoom={onPatchRoom}
                  onAddRoom={onAddRoom}
                  onRemoveRoom={onRemoveRoom}
                  canRemoveZone={ahu.zones.length > 1}
                />
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
    </section>
  );
}

// ----------------------------------------------------------------------------
// Per-zone rows (zone row + inline room rows + +Room sub-row).
// One component because they're tightly coupled and need a shared open state.
// ----------------------------------------------------------------------------

interface ZoneRowsProps {
  zone: ZoneInput;
  row: ZoneResult | null;
  isCrit: boolean;
  isMulti: boolean;
  isOpen: boolean;
  rooms: RoomInput[];
  hasCriticalRoom: boolean;
  occOptions: string[];
  onToggleExpanded: () => void;
  onPatchZone: (id: string, partial: Partial<ZoneInput>) => void;
  onRemoveZone: (id: string) => void;
  onPatchRoom: (zid: string, rid: string, partial: Partial<RoomInput>) => void;
  onAddRoom: (zid: string) => void;
  onRemoveRoom: (zid: string, rid: string) => void;
  canRemoveZone: boolean;
}

function ZoneRows({
  zone,
  row,
  isCrit,
  isMulti,
  isOpen,
  rooms,
  hasCriticalRoom,
  occOptions,
  onToggleExpanded,
  onPatchZone,
  onRemoveZone,
  onPatchRoom,
  onAddRoom,
  onRemoveRoom,
  canRemoveZone,
}: ZoneRowsProps): JSX.Element {
  return (
    <>
      {/* ZONE ROW */}
      <tr
        className={`zone-row${isCrit ? ' row--crit' : ''}`}
        data-zone-id={zone.id}
      >
        <td className="col-tag">
          <div className="zone-row__tag-stack">
            <button
              type="button"
              className="zone-row__chev"
              onClick={onToggleExpanded}
              aria-label={isOpen ? 'Collapse rooms' : 'Expand rooms'}
              aria-expanded={isOpen}
              data-testid={`chev-${zone.id}`}
              title={isOpen ? 'Collapse rooms' : 'Expand rooms'}
            >
              ▶
            </button>
            <span className="zone-row__dot" />
            <input
              className="tag-input"
              value={zone.tag ?? ''}
              onChange={(e) => onPatchZone(zone.id, { tag: e.target.value })}
            />
            {rooms.length > 0 && (
              <span
                className="zone-row__room-count"
                title={`${rooms.length} room${rooms.length === 1 ? '' : 's'}`}
              >
                {rooms.length}r
              </span>
            )}
          </div>
        </td>
        <td className="col-space">
          <select
            value={zone.space}
            onChange={(e) => onPatchZone(zone.id, { space: e.target.value })}
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
            value={Number.isFinite(zone.area) ? zone.area : 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              onPatchZone(zone.id, { area: isFinite(v) ? v : 0 });
            }}
          />
        </td>
        <td className="num">
          <input
            type="number"
            min={0}
            value={Number.isFinite(zone.pop) ? zone.pop : 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              onPatchZone(zone.id, { pop: isFinite(v) ? v : 0 });
            }}
          />
        </td>
        <td className="num">
          <input
            type="number"
            min={0}
            value={Number.isFinite(zone.vpz) ? zone.vpz : 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              onPatchZone(zone.id, { vpz: isFinite(v) ? v : 0 });
            }}
          />
        </td>
        {isMulti && (
          <td className="num">
            <input
              type="number"
              min={0}
              value={Number.isFinite(zone.vdz ?? 0) ? (zone.vdz ?? 0) : 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                onPatchZone(zone.id, { vdz: isFinite(v) ? v : 0 });
              }}
            />
          </td>
        )}
        {isMulti && (
          <td className="num">
            <input
              type="number"
              min={0}
              value={Number.isFinite(zone.vdzm ?? 0) ? (zone.vdzm ?? 0) : 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                onPatchZone(zone.id, { vdzm: isFinite(v) ? v : 0 });
              }}
            />
          </td>
        )}
        <td>
          <select
            value={zone.ezConfig}
            onChange={(e) => onPatchZone(zone.id, { ezConfig: e.target.value })}
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
            {hasCriticalRoom && (
              <span
                className="crit-badge crit-badge--inline"
                title="This zone owns the critical (highest-Zp) room."
              >
                CRIT
              </span>
            )}
          </td>
        )}
        {isMulti && (
          <td className="num calc">
            {row ? fmtRatio(row.zd) : '—'}
          </td>
        )}
        <td className="col-remove">
          {canRemoveZone && (
            <button
              type="button"
              className="row-remove"
              onClick={() => onRemoveZone(zone.id)}
              title="Remove zone"
              aria-label={`Remove ${zone.tag ?? 'zone'}`}
              data-remove-zone={zone.id}
            >
              ×
            </button>
          )}
        </td>
      </tr>

      {/* INLINE ROOM ROWS — only when chevron open */}
      {isOpen &&
        rooms.map((r) => {
          const result = row?.roomCalcs?.find((rr) => rr.id === r.id);
          const isRoomCrit =
            result !== undefined && row?.critRoomId === r.id;
          return (
            <tr
              key={r.id}
              className={`room-row${isRoomCrit ? ' row--crit' : ''}`}
              data-room-row={r.id}
              data-room-zone={zone.id}
            >
              <td className="col-tag">
                <div className="room-row__tag-stack">
                  <span className="room-row__arrow">↳</span>
                  <input
                    className="tag-input tag-input--room"
                    value={r.tag ?? ''}
                    onChange={(e) => onPatchRoom(zone.id, r.id, { tag: e.target.value })}
                  />
                </div>
              </td>
              <td>
                <select
                  value={r.space}
                  onChange={(e) => onPatchRoom(zone.id, r.id, { space: e.target.value })}
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
                    onPatchRoom(zone.id, r.id, { area: isFinite(v) ? v : 0 });
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
                    onPatchRoom(zone.id, r.id, { pop: isFinite(v) ? v : 0 });
                  }}
                />
              </td>
              <td className="num">
                <input
                  type="number"
                  min={0}
                  value={Number.isFinite(r.vpz) ? r.vpz : 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onPatchRoom(zone.id, r.id, { vpz: isFinite(v) ? v : 0 });
                  }}
                />
              </td>
              {/* Vdz / Vdzm columns: empty (room doesn't carry these) */}
              {isMulti && <td />}
              {isMulti && <td />}
              <td>
                <select
                  value={r.ezConfig}
                  onChange={(e) => onPatchRoom(zone.id, r.id, { ezConfig: e.target.value })}
                >
                  {EZ_CONFIGS.map(([label, _v, short]) => (
                    <option key={label} value={label}>
                      {short}
                    </option>
                  ))}
                </select>
              </td>
              <td className="num calc">
                {result ? fmtCfm(result.voz) : '—'}
                {isRoomCrit && (
                  <span className="crit-badge" title="Highest Zp drives Voz">
                    CRIT
                  </span>
                )}
              </td>
              {isMulti && <td className="num calc">{result ? fmtRatio(result.zp) : '—'}</td>}
              <td className="col-remove">
                <button
                  type="button"
                  className="row-remove"
                  onClick={() => onRemoveRoom(zone.id, r.id)}
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

      {/* + ROOM SUB-ROW — only when chevron open */}
      {isOpen && (
        <tr className="add-room-row" data-add-room-for={zone.id}>
          <td colSpan={isMulti ? 11 : 9} className="add-room-cell">
            <div className="add-room-stack">
              <button
                type="button"
                className="btn btn--ghost btn--small add-room-btn"
                onClick={() => onAddRoom(zone.id)}
                data-testid="add-room"
                data-room-add={zone.id}
              >
                + Room
              </button>
              <span className="add-room-hint">
                {rooms.length === 0
                  ? 'Add rooms to make this zone critical-room-aware.'
                  : `${rooms.length} room${rooms.length === 1 ? '' : 's'} — the highest-Zp one drives Voz.`}
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

