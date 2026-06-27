/**
 * PresetMenu — one-click preset loader for ventilation zones.
 *
 * Opens as a popover anchored to the toolbar button. Lets the engineer search
 * across all ASHRAE Table 6-3 occupancy categories (grouped by canonical
 * ASHRAE 62.1-2022 groupings: Office / Educational / Retail / etc.) and load
 * a typical area / pop / Ez into a chosen zone.
 *
 * Behavior:
 *   - If a zone is focused (passed via `focusedZoneId`), it is the target.
 *   - Otherwise, if there is exactly one zone, it is the implicit target.
 *   - Otherwise, the engineer picks the target zone from a small inline picker.
 *
 * The preset does NOT mutate room math semantics; it only seeds the zone
 * shape (space / area / pop / ezConfig). Room totals are rebalanced to match.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ZoneInput } from '../lib/ashrae621';
import { groupPresets, searchPresets, type Preset, type PresetGroup } from '../lib/presets';

export interface PresetMenuProps {
  zones: ZoneInput[];
  /** Currently focused zone id (the row the engineer clicked most recently). */
  focusedZoneId?: string;
  /** Apply a preset to a specific zone by id. */
  onApply: (zoneId: string, preset: Preset) => void;
}

export function PresetMenu({ zones, focusedZoneId, onApply }: PresetMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [targetZoneId, setTargetZoneId] = useState<string | null>(focusedZoneId ?? null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();

  // Re-sync the implicit target whenever the focused zone changes
  // or the menu is re-opened.
  useEffect(() => {
    if (!open) return;
    if (focusedZoneId) {
      setTargetZoneId(focusedZoneId);
    } else if (!targetZoneId && zones.length === 1) {
      setTargetZoneId(zones[0].id);
    }
  }, [open, focusedZoneId, zones, targetZoneId]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Auto-focus the search input when the menu opens.
  useEffect(() => {
    if (open && searchRef.current) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const groups: PresetGroup[] = useMemo(() => {
    if (!query.trim()) return groupPresets();
    // When searching, return a single virtual group of all matches so the
    // user sees results without having to expand each category.
    return [{ category: `Results (${searchPresets(query).length})`, rows: searchPresets(query) }];
  }, [query]);

  const toggleCategory = (cat: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const handleApply = (preset: Preset) => {
    const zid = targetZoneId ?? (zones.length === 1 ? zones[0].id : null);
    if (!zid) return;
    onApply(zid, preset);
    setOpen(false);
    setQuery('');
  };

  // Resolve the current target zone label for the picker hint.
  const targetZone = zones.find((z) => z.id === targetZoneId) ?? null;

  return (
    <div className="preset-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => setOpen((o) => !o)}
        data-testid="open-presets"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Load a typical zone setup from ASHRAE Table 6-3"
      >
        Presets ▾
      </button>
      {open && (
        <div
          className="preset-menu__panel"
          role="dialog"
          aria-labelledby={titleId}
          data-testid="preset-panel"
        >
          <div className="preset-menu__head">
            <h3 id={titleId} className="preset-menu__title">
              ASHRAE Table 6-3 Presets
            </h3>
            <button
              type="button"
              className="preset-menu__close"
              onClick={() => setOpen(false)}
              aria-label="Close preset menu"
              data-testid="close-presets"
            >
              ×
            </button>
          </div>

          <div className="preset-menu__search">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search… (e.g. office, healthcare)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="preset-search"
              aria-label="Search presets"
            />
          </div>

          {zones.length > 1 && (
            <div className="preset-menu__target">
              <label>
                <span>Apply to zone:</span>
                <select
                  value={targetZoneId ?? ''}
                  onChange={(e) => setTargetZoneId(e.target.value || null)}
                  data-testid="preset-target"
                >
                  <option value="">— pick a zone —</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.tag ?? z.id} · {z.space}
                    </option>
                  ))}
                </select>
              </label>
              {targetZone && (
                <span className="preset-menu__target-hint">
                  Will overwrite <strong>{targetZone.tag ?? targetZone.id}</strong> (area, pop, space, Ez).
                </span>
              )}
            </div>
          )}

          <div className="preset-menu__groups" data-testid="preset-groups">
            {groups.length === 0 && (
              <div className="preset-menu__empty">No presets match.</div>
            )}
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.category);
              return (
                <section key={g.category} className="preset-group" data-testid="preset-group">
                  <button
                    type="button"
                    className="preset-group__header"
                    onClick={() => toggleCategory(g.category)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="preset-group__chev">{isCollapsed ? '▸' : '▾'}</span>
                    <span className="preset-group__name">{g.category}</span>
                    <span className="preset-group__count">{g.rows.length}</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="preset-group__rows">
                      {g.rows.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="preset-row"
                            onClick={() => handleApply(p)}
                            data-testid="preset-row"
                            data-preset-id={p.id}
                            disabled={!targetZoneId && zones.length > 1}
                            title={
                              !targetZoneId && zones.length > 1
                                ? 'Pick a target zone first'
                                : `Load ${p.spaceType} (${p.defaultArea} ft², ${p.defaultPop} ppl)`
                            }
                          >
                            <span className="preset-row__name">{p.spaceType}</span>
                            <span className="preset-row__meta">
                              {p.defaultArea} ft² · {p.defaultPop} ppl · Rp={p.rp}, Ra={p.ra}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}