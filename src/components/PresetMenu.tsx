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
 *
 * Favorites:
 *   - Each row has a star button (★/☆) that toggles a per-user favorite.
 *   - Favorites appear in a "Favorites" group at the top of the menu.
 *   - Favorites survive AHU switches and state reloads (separate
 *     localStorage key, per-user, all-AHUs shared — locked scope).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ZoneInput } from '../lib/ashrae621';
import { groupPresets, searchPresets, type Preset, type PresetGroup } from '../lib/presets';
import { addFavorite, hasFavorite, loadFavorites, removeFavorite } from '../lib/storage/favorites';

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
  // Bump this counter to force a re-read of favorites from localStorage.
  // localStorage isn't reactive in React, so a manual nudge keeps the star
  // icon and the Favorites group in sync after add/remove.
  const [favVersion, setFavVersion] = useState(0);
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

  // Toggle a preset's favorite status. The star button stops event
  // propagation so this never fires the row's "apply preset" handler.
  const toggleFavorite = (id: string) => {
    if (hasFavorite(id)) removeFavorite(id);
    else addFavorite(id);
    setFavVersion((v) => v + 1);
  };

  // Build the rendered groups. Three regimes:
  //   1. Searching → single virtual group of all matches (no Favorites split).
  //   2. No search, no favorites → canonical groupPresets() output.
  //   3. No search, some favorites → "Favorites" group at the top, then the
  //      canonical groups with favorited rows pulled out (no dupes).
  const groups: PresetGroup[] = useMemo(() => {
    // Touch favVersion so this memo re-runs when stars toggle.
    void favVersion;
    if (query.trim()) {
      return [
        {
          category: `Results (${searchPresets(query).length})`,
          rows: searchPresets(query),
        },
      ];
    }
    const favIds = loadFavorites();
    const all = groupPresets();
    if (favIds.size === 0) return all;
    // Flatten all presets to resolve favorited ids into full Preset rows
    // so we can render name + meta.
    const byId = new Map<string, Preset>();
    for (const g of all) for (const p of g.rows) byId.set(p.id, p);
    const favRows: Preset[] = [];
    for (const id of favIds) {
      const p = byId.get(id);
      if (p) favRows.push(p);
    }
    // Drop favorited rows from their canonical groups so they don't appear
    // twice in the menu. Preserve order in the Favorites group to match the
    // order the engineer starred them.
    const filtered = all.map((g) => ({
      ...g,
      rows: g.rows.filter((p) => !favIds.has(p.id)),
    }));
    return [{ category: 'Favorites', rows: favRows }, ...filtered];
  }, [favVersion, query]);

  // Resolve the current target zone label for the picker hint.
  const targetZone = zones.find((z) => z.id === targetZoneId) ?? null;

  // Read favorites once per render so star icons reflect current state.
  // (Cheap: localStorage read + a Set lookup per row.)
  const favIds = useMemo(() => {
    void favVersion;
    return loadFavorites();
  }, [favVersion]);

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
              const isFavGroup = g.category === 'Favorites';
              return (
                <section
                  key={g.category}
                  className={
                    isFavGroup ? 'preset-group preset-group--favorites' : 'preset-group'
                  }
                  data-testid="preset-group"
                  data-fav-group={isFavGroup ? '1' : undefined}
                >
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
                      {g.rows.map((p) => {
                        const isFav = favIds.has(p.id);
                        return (
                          <li key={p.id}>
                            <div className="preset-row">
                              <button
                                type="button"
                                className="preset-row__main"
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
                              <button
                                type="button"
                                className={
                                  isFav ? 'preset-row__star preset-row__star--on' : 'preset-row__star'
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(p.id);
                                }}
                                data-testid="preset-star"
                                data-preset-star-id={p.id}
                                data-fav={isFav ? '1' : '0'}
                                aria-label={isFav ? `Unfavorite ${p.spaceType}` : `Favorite ${p.spaceType}`}
                                aria-pressed={isFav}
                                title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                              >
                                {isFav ? '\u2605' : '\u2606'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
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