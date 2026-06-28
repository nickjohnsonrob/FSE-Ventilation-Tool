# P2: Drag-to-reorder zones

Closes the P1 UX gap (backlog item: "Drag-to-reorder zones") by letting
engineers grab a zone row and drag it into a new position with the mouse,
keyboard, or touch. Implemented with `@dnd-kit/core` + `@dnd-kit/sortable`.

## What changed

- **`src/hooks/useAhuState.ts`** — new `reorderZones(newOrder: string[])`
  action. Resolves the requested id list against the active AHU's zones,
  silently drops unknown ids, and appends any zones omitted from the
  list at the end. Zone objects are preserved by reference — only display
  order changes. Three vitest cases cover the contract:
  reorder, preserve-all-fields, unknown-id-drop, append-omitted.
- **`src/components/ZoneTable.tsx`** — wraps the zone table in a
  `DndContext` (`PointerSensor` + `KeyboardSensor` with
  `sortableKeyboardCoordinates`) and a `SortableContext` keyed on
  the active AHU's zone ids. Each zone row is a `useSortable` item;
  the drag handle is a narrow left-column button (`⋮⋮` glyph) with the
  sensor's listeners, plus ARIA attributes for screen-reader
  announcements of pick-up / move / drop.
- **`src/styles/index.css`** — added `.col-drag` and `.zone-row__drag`
  styles. Handle is `opacity: 0` by default and fades in on row hover
  (or when focused / actively dragging) so the default UI stays clean.
  Reduced-motion media query trims the transition.
- **`src/App.tsx`** — wires `onReorderZones={ahu.reorderZones}` into
  `<ZoneTable>`. No other state plumbing required; the hook mutates
  React state via the existing setter, so any future persistence layer
  that subscribes to the state tree (P0 #1 work) picks up the new order
  automatically.
- **`e2e/drag.spec.ts`** — five Playwright tests:
  1. Drag handle is hidden by default and visible on row hover.
  2. Mouse drag reorders zone 2 above zone 1 (the spec example).
  3. `compute()` is invariant under reorder — `Vot = 220 cfm` stays,
     per-zone Voz numbers travel with their rows.
  4. Keyboard reorders (Tab to handle, Space activates, ArrowUp moves,
     Space drops) — accessibility path.
  5. Zone data is preserved on reorder (area, pop, vpz travel with the
     row, not re-applied).

## Invariants preserved

- `V_ot` is unchanged across reorder — only display order moves. The
  math core doesn't depend on iteration order, and `reorderZones`
  preserves zone objects by reference, so `compute()` returns the same
  numbers for the same inputs.
- The 220 cfm pin (`Area=1000, Pop=10, Rp=5, Ra=0.06`) still holds
  after a reorder; verified end-to-end in `drag.spec.ts`.
- 220 cfm math pin in the existing `e2e/smoke.spec.ts` continues to
  pass (no regression — same inputs, same outputs).

## Accessibility

- Drag handle is a real `<button>` with `aria-label="Reorder zone {tag}"`
  and `title` hint explaining keyboard alternative.
- `KeyboardSensor` with `sortableKeyboardCoordinates` provides standard
  WAI-ARIA drag-and-drop keyboard semantics (Space to pick up, arrow
  keys to move, Space to drop, Escape to cancel).
- `useSortable` attributes include `role="button"`, `tabIndex={0}`, and
  `aria-roledescription="sortable"` automatically.

## Out of scope (intentionally not touched)

- Math core (`src/lib/ashrae621.ts`) — pin preserved.
- Snapshots / persistence internals — no persistence layer exists yet;
  this change is compatible with the upcoming P0 #1 save-state work.
- Storybook stories — none added (consistent with the existing
  `AhuPicker` + `EffZoneChart` storybook coverage, which is sparse).
- Drag handle for room rows — out of scope; rooms are sub-units of a
  zone and their order is purely cosmetic within the zone.

## Verification

All gates green:

```
npm run typecheck   # tsc --noEmit — clean
npm run lint        # eslint --max-warnings 0 — clean
npm test            # vitest — 147 passed (19 useAhuState, 4 new)
npm run test:e2e    # playwright — 46 passed (5 new in drag.spec.ts)
npm run build       # vite build — clean
```

## How to try it

```bash
git checkout feature/drag-zones
npm ci && npm run dev
# In the browser, hover a zone row → grab the ⋮⋮ handle on the left
# and drag it. Or Tab to the handle, press Space, Arrow keys, Space.
```