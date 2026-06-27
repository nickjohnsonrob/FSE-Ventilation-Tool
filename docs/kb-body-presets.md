# feat: preset loader menu (all ASHRAE categories, grouped)

Closes P1 #5 from the backlog ("Empty states + presets") — locked scope:
"preset loader menu with all ASHRAE Table 6-3 categories, grouped by
category group (Educational / Healthcare / Retail / Office / Public
Assembly / etc.) so it's browsable. Each row populates reasonable defaults
(area, pop, Rp, Ra, Ez). One-click."

## What ships

- `src/lib/presets.ts` — full preset catalog. One entry per ASHRAE
  62.1-2022 Table 6-1 occupancy category (~62 unique rows). Defaults are
  typical engineering values (small private office 150 ft² / 1 person;
  classroom 900 ft² / 25; restaurant dining 1200 ft² / 80). Rp / Ra are
  pulled from `OCCUPANCY_CATEGORIES` so they always match the Standard.
- `src/components/PresetMenu.tsx` — popover with:
  - search input (case-insensitive substring across spaceType + category)
  - collapsible category groups (Office Spaces, Educational Facilities,
    Retail, Food Service, Healthcare, Public Assembly, Residential,
    Industrial / General)
  - target-zone picker for multi-zone AHUs (engineer can apply to any
    zone, not just the focused one)
  - keyboard navigation, Escape to close, click-outside to close
- `src/components/ZoneTable.tsx` — adds a "Presets ▾" button to the
  toolbar; tracks focused zone (click any row to focus) so a preset
  defaults to loading into the row the engineer was just looking at.
  Applying a preset keeps the zone id / tag / airflow inputs (vpz, vdz)
  intact and only seeds `space`, `area`, `pop`, `ezConfig`. If the zone
  has rooms, room area/pop are rebalanced so Σ(rooms) equals the new
  zone totals.
- `src/styles/index.css` — preset-menu styling.

## Why this approach

- Reuses the existing `OCCUPANCY_CATEGORIES` table as the source of truth
  for Rp/Ra — the preset never diverges from the Standard.
- Does not touch the math core, snapshot persistence, or room math
  semantics. Preset loader is purely a UI seed for zone input shape.
- The focused-zone tracking is additive — clicking a row to focus does
  not affect existing keyboard / touch / programmatic flows.

## Tests

- 16 new vitest tests in `src/lib/__tests__/presets.test.ts`:
  - every Table 6-1 row has a preset entry (no orphans)
  - every preset's Rp / Ra match the canonical OCCUPANCY_CATEGORIES
  - reasonable defaults (area ≥ 0, pop ≥ 0, Ez ∈ [0.5, 1.0])
  - searchPresets filters by spaceType or category
  - groupPresets returns the canonical ASHRAE 62.1 categories
  - applyPreset sets space/area/pop/ezConfig; keeps zone.id; preserves
    airflow inputs (vpz/vdz); rebalances rooms when present.
- 8 new Playwright tests in `e2e/presets.spec.ts`:
  - panel opens with all canonical groups visible
  - search filters results
  - clicking a preset populates the focused zone
  - **220 cfm math pin still holds** after preset is applied
  - Escape key closes the panel
  - clicking outside closes the panel
  - category groups are collapsible

## Gates

- typecheck: ✓ `tsc --noEmit` clean
- lint: ✓ `eslint --max-warnings 0` clean
- vitest: ✓ 74/74 pass (was 58, +16 new)
- playwright: ✓ 31/31 pass (was 23, +8 new)
- build: ✓ `vite build` produces dist/

## Invariants preserved

- 220 cfm pin (1000/10/5/0.06 → Vot=220) — explicit test in
  `e2e/presets.spec.ts`.
- Math core (ashrae621.ts) untouched.
- Snapshot persistence internals untouched.
- `useAhuState` hook untouched; preset mutations go through
  `onPatchZone` which already exists.

## Manual smoke

1. Open the app.
2. Click any zone row to focus it.
3. Click "Presets ▾" in the toolbar.
4. Type "office" → see "Office space" and "Conference / meeting" filtered.
5. Click "Office space" → first zone gets area=150, pop=1, space=Office
   space, Ez=Ceiling supply of cool air.
6. Toggle dark mode — preset menu still readable.
7. Add a second zone, focus it, apply a different preset — second zone
   gets its own values; first zone unchanged.

## Out of scope (deferred)

- Per-user favorites (separate backlog item).
- "Design driver" critical zone override (separate backlog item).
- Saving presets to a user library — the catalog is shipped, not
  user-mutable.