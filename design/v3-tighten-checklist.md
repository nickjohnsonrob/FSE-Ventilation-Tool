# v3 Tighten — checklist for Claude Design (or me)

Paste this list into Claude Design with the prompt:

> Here's a FSE-Ventilation-Tool redesign task. Read
> design/v1-vs-v2-zone-rooms.md first, then read the current main
> branch at github.com/nickjohnsonrob/FSE-Ventilation-Tool. Refactor
> the ZoneTable component so the rooms come back **inline below each
> zone row** (with a chevron expand), restore the CRIT badge on the
> zone row, and add a Critical-room / Lumped segmented picker for the
> single-zone case. Keep the modern Vite + React 18 + TS stack. Keep
> all existing tests passing; update test selectors to match the new
> inline DOM. Don't break the AhuPicker, MathSwitcher, ResultsBand,
> or EzHelpDialog components. Preserve the design system bundle at
> public/_ds/. When you're done, give me a list of changed files
> with line counts so I can pull them back into the repo.

## What to change

- [ ] **Remove** `src/components/RoomTable.tsx` (it's inside ZoneTable.tsx now)
- [ ] **Remove** all `.room-table*`, `.room-table__*`, `.zone-rooms` CSS rules from `src/styles/index.css`
- [ ] **Edit** `src/components/ZoneTable.tsx`:
  - [ ] Add chevron `<button aria-label="Expand rooms" aria-expanded={isExpanded}>` in the zone-row tag cell, before the tag input
  - [ ] Add `expandedZones: Set<string>` local state in `ZoneTable` (don't push into the hook — UI-only state)
  - [ ] Render room rows **in the same `<tbody>`**, directly below the parent zone row, when the zone is in `expandedZones`
  - [ ] Indent room-row tag cell with `↳` glyph + 20px left padding
  - [ ] Show `+ Room` button as a sub-row at the bottom of each expanded zone, with the **"Rooms drive TU totals"** checkbox beside it
  - [ ] Show inline `CRIT` badge in the Evz cell of the zone row when `Math.max(...roomResultsByZone.get(zoneId).map(r => r.zp))` matches that zone's calculated Zp
  - [ ] **Delete** the `RoomTable` component declaration at the bottom of the file
  - [ ] **Delete** the `<RoomTable>` rendering block (currently lines ~333–348)
  - [ ] **Delete** the global "Rooms" toolbar button (currently around line 90–105)
- [ ] **Edit** `src/hooks/useAhuState.ts`:
  - [ ] Make sure `patchRoom` already exists (it does per the handoff)
  - [ ] Don't add a `setExpandedZones` here — it's UI state, not data state
- [ ] **Edit** `src/App.tsx`:
  - [ ] Remove `onPatchRoom` / `onAddRoom` / `onRemoveRoom` from ZoneTable props ONLY if you're keeping them — they should still be there, just wired differently
- [ ] **Edit** `src/styles/index.css`:
  - [ ] Add a `.zone-row__chevron` rule (~30 lines, design tokens only)
  - [ ] Add a `.zone-row__room` rule for indented room rows (~20 lines)
  - [ ] Add a `.zone-row__add-room` rule for the `+ Room` sub-row (~30 lines)
  - [ ] Add a `.crit-badge--inline` rule that matches the existing `.crit-badge` (~15 lines, mostly reuse the same colors)
- [ ] **Add** a new component `src/components/RollupMethodPicker.tsx`:
  - [ ] Two-button segmented control: `[Critical room] [Lumped]`
  - [ ] Reads `ahu.simplifiedMethod` (or whatever the current field is — check the `MethodSwitcher` to confirm the field name)
  - [ ] Calls `onPatchAhu({ simplifiedMethod: 'critical' | 'lumped' })`
  - [ ] Only renders for single-zone (`!isMulti`)
- [ ] **Edit** `src/App.tsx`:
  - [ ] Render `<RollupMethodPicker>` inside the single-zone results card, just above `<ResultsBand>`
- [ ] **Edit** `e2e/multi-unit.spec.ts`:
  - [ ] Update selectors: `data-room-add` now lives on the inline button inside `[data-zone-id="<id>"]`
  - [ ] Update `Rooms toggle reveals a per-zone room sub-table` test → rename to "Zone chevron expand reveals inline room rows" and rewrite the flow
- [ ] **Edit** `e2e/smoke.spec.ts`:
  - [ ] No changes needed — math-pin test doesn't touch rooms
- [ ] **Edit** `src/hooks/__tests__/useAhuState.test.ts`:
  - [ ] No changes needed — state machine doesn't care about UI layout
- [ ] **Verify** before claiming done:
  - [ ] `npx tsc --noEmit` exits 0
  - [ ] `npm run lint` exits 0
  - [ ] `npx vitest run` → 58/58
  - [ ] `npx playwright test` → 17/17
  - [ ] `npm run build` exits 0

## Files I should NOT touch

- `src/lib/ashrae621.ts` (math)
- `src/lib/tables.ts`
- `src/lib/format.ts`
- `src/lib/units.ts`
- `src/components/MethodSwitcher.tsx`
- `src/components/ResultsBand.tsx`
- `src/components/ExportButton.tsx`
- `src/components/EzHelpDialog.tsx`
- `src/components/Header.tsx`
- `src/components/ThemeToggle.tsx`
- `public/_ds/` (design system bundle)

## Acceptance criteria

When you load the live page after the deploy:

1. Zone rows have a `▶` chevron to the left of the tag input.
2. Clicking the chevron expands 0..N room rows directly below that zone, indented with `↳`.
3. The room rows share columns with the parent zone (same `<thead>`).
4. Below the rooms, an indented `+ Room` row appears with the "Rooms drive TU totals" checkbox.
5. The Evz cell of the zone row shows an inline `CRIT` badge when that zone has the highest room Zp.
6. The single-zone results card shows a segmented `[Critical room] [Lumped]` button.
7. No global "Rooms" button in the zone table toolbar.
8. No standalone room sub-table anywhere on the page.

## Rollback

`v1.0.0` tag still works offline. Recovery:
```bash
git reset --hard 3ce792f && git push --force-with-lease
```
