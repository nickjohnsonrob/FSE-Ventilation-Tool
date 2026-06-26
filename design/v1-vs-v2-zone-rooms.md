# v1 → v2 ZoneTable comparison

Tells you exactly what v2 lost, what's still here, and what a tightened v3
should look like. Read this top-to-bottom before touching CSS or JSX.

## What's in v1.0.0 (offline bundle) that's gone in v2

### 1. Per-zone rooms are **in-line rows** in v1, **a sub-table per zone** in v2

**v1 (in-line):**
- Each terminal unit row has a `▶` / `▼` chevron button next to its tag.
- Clicking expands rows below it that belong to *the same zone*, indented
  with `↳` glyph in the tag column.
- Rooms share columns with the parent zone: area, pop, Rp, Ra, Voz, Ez,
  Zp, CRIT badge, ×. Columns the room doesn't carry are blank (but
  visible — vertical alignment matters).
- A `+ Room` row appears at the bottom of each expanded zone with a
  dashed-border button + a checkbox **"Rooms drive TU totals"**.
- The "Rooms drive TU totals" toggle is **inside the in-line expand
  affordance** — it's not a global toolbar switch.

**v2 (sub-table):**
- Rooms are in a *separate* `RoomTable` rendered *below* the zone table.
- Each zone with rooms gets its own table block (`data-room-zone=...`).
- There's a global `Rooms ●` toggle in the zone-table toolbar.
- **Net effect:** two scroll contexts, duplicated column headers, and
  you can't see the room you care about while looking at the zone it
  belongs to.

### 2. v1 had a **roll-up method picker** (Critical room / Lumped)

In the single-zone §6.2.5.1 case, v1 showed a segmented button:
```
[ Critical room ] [ Lumped ]
```
inside its own card right above the results. v2 dropped this UI — the
math library still supports both modes but the user can't switch.

### 3. v1 used chevron expand as the **only** rooms toggle

No global "Rooms" button. The Rooms drive-TU-totals checkbox lived in
the in-line `+ Room` row and was always visible when the zone was
expanded. v2 inverted this: global toolbar toggle, no inline expand.

### 4. v1 had an **edit-in-place zone tag** (`TU-01`, `TU-02`, ...) with a monospaced field, transparent border until hover/focus

v2 kept this. ✅ Still here.

### 5. v1 had a `CRIT` badge **inline** in the Evz cell of the zone row, *plus* a CRIT badge on the room row with the highest Zp

v2 has the room CRIT badge but lost the inline zone-row badge. Hard to
scan which zone is critical without looking at the sub-tables.

### 6. v1 had **per-room Vpz/Vbz/Voz/Zp** columns visible right next to the zone row that owns them

v2's sub-table has these but they live in a separate scroll context.

### 7. v1 had a **"delete" button** (text label) on room rows; v2 uses `×` everywhere

Minor — fine to keep v2's × style.

### 8. v1 had a results-band with a **formula trace** card below the headline Vot tile

v2 keeps ResultsBand but dropped the formula trace card.

## What v2 did that's actually better than v1

- **Editable AHU name** (v1 didn't have multi-AHU at all — single-AHU
  calc only, no name field, no tab strip)
- **AhuPicker** (chip row, × button on tabs, Multi-zone RTU /
  Single-zone DOAS split)
- **Vite build, CI, Pages deploy**
- **TypeScript** types throughout (better refactor safety)
- **Test coverage** — 58 vitest + 17 Playwright, none in v1
- **Design system bundle** (`public/_ds/`) gives tokens without
  hand-rolling inline styles
- **Memoized compute()** on active AHU
- **CRIT badge math** is correctly tied to `roomCalcs[].zp` per zone
- **Reset zones** and **per-zone ×** exist in v2 (v1 had Reset via
  page reload only)

## What v3 should look like (the plan)

### Layer 1 — bring rooms back inline

- Remove the global "Rooms" toolbar toggle.
- Add the **chevron `▶`/`▼`** in the zone-row tag cell, before the tag
  input. Clicking it expands the zone.
- When expanded, render the room rows **inside the same `<tbody>`**
  below the zone row, indented `↳` in the tag column.
- Add the `+ Room` row at the bottom of each expanded zone, with the
  **"Rooms drive TU totals"** checkbox beside the button.
- Drop the separate `RoomTable` component and the `.room-table*` CSS.
- Keep the CRIT badge math (per-zone highest Zp).

### Layer 2 — restore the roll-up method picker (single-zone only)

- Add a segmented `[Critical room] [Lumped]` button in the
  single-zone §6.2.5.1 results card.
- Wire to existing `simplifiedMethod` field on the AHU input
  (already exposed via `MethodSwitcher` per the PR-#2 handoff).

### Layer 3 — restore the inline CRIT badge on the zone row

- In the Evz cell of every zone row, append a small `CRIT` badge when
  `roomResults.max(zp) === zp` for that zone. (Or, if no rooms,
  inherit from the single critical-zone logic in v1.)
- Color it the same red/amber as the room CRIT badge for visual
  continuity.

### Layer 4 — restore the calculation-trace card (optional)

- Add a single-card "Calculation" section under the Vot headline that
  prints the formula + substituted values for `Xs`, `Ev`, `Vot`.
- Use `mono` font for numbers, `sans` for prose.
- Trivially skippable if scope tightens.

## Risks

- **Chevron in the tag cell** — must not be mistaken for the × delete
  button. v1 used a chevron icon (no accessible name conflict). Use
  `aria-label="Expand rooms"` and `aria-expanded`.
- **CRIT badge collision** — if both zone-row and room-row show CRIT,
  it should look intentional, not broken. Same color + same radius +
  identical hover treatment.
- **Test selectors** — `multi-unit.spec.ts` currently relies on
  `data-room-add` on the sub-table button. When rooms move inline, the
  button is per-zone in the same table; update tests to scope to
  `[data-zone-id="<id>"] [data-room-add]` instead.
- **CSS reduction** — we can delete ~10 KB of `.room-table*` rules
  when the sub-table goes away. Budget the diff carefully.

## Out of scope for v3 (still future work)

- Drag-to-reorder zones
- Keyboard shortcut for add zone/room
- Excel export for all AHUs (currently active only)
- localStorage persistence
- AHU name appearing in the page `<title>`
