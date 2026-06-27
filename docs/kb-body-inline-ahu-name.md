# feat: inline AHU name edit on tab (P2)

Closes P2 from the HANDOFF backlog ("Inline edit for AHU name … should
also be editable in the AHU tab itself for muscle memory"). Engineers
frequently rename an AHU right after creating it, and switching
focus from the meta-strip input back to the picker chip wastes a click
when the chip is right there. Now the active AHU tab is editable
inline via double-click.

## What ships

- `src/hooks/useAhuState.ts` — new `renameAhu(id, name)` action. Patches
  the named AHU without changing `activeId`. No-op when the id is
  unknown (preserves the array reference so React skips a re-render on
  a mistyped call).
- `src/components/AhuPicker.tsx` — extracts the tab name into a small
  `AhuTabName` sub-component:
  - Reads the canonical name from props.
  - On the **active** tab only, double-clicking the `.ahu-tab__name`
    span swaps it for a text input. The input is auto-focused and
    pre-selected so typing replaces the value immediately.
  - `Enter` or `blur` commits; the value is trimmed and any
    empty / whitespace result reverts to the original name (no blank
    AHUs).
  - `Escape` reverts without committing.
  - Event bubbling is stopped so the wrapping `<button>` doesn't fire
    its `onSelect` while the input has focus.
  - Inactive tabs render the plain span (no edit affordance) so the
    double-click gesture on them still means "switch active".
- `src/App.tsx` — wires `onRename={ahu.renameAhu}`.
- `src/styles/index.css` — `.ahu-tab__name-input` styling (monospace,
  accent border, focus ring); a subtle dotted-underline on hover for
  the active tab label to telegraph the new affordance.
- `src/hooks/__tests__/useAhuState.test.ts` — 3 new vitest cases:
  rename any AHU by id (not just active), no-op for unknown id,
  preserves `activeId`.
- `e2e/inline-ahu-name.spec.ts` — 6 new Playwright cases:
  Enter commits, blur commits, Escape reverts, empty name reverts,
  active AHU unchanged after rename, 220 cfm math pin still holds
  after rename.

## Why this approach

- Reuses the same `AhuInput` rename pathway as the existing
  `data-testid="ahu-name"` meta-strip input (which calls
  `onPatchAhu({ name })`). Both paths route through the same state,
  so the two stay in sync and either can be the entry point. The
  meta-strip input remains in place as a discoverable fallback.
- The picker takes `onRename: (id, name) => void` rather than
  hard-wiring to the active-AHU `patch`. This keeps the picker usable
  with arbitrary state containers (future persistence layer, snapshot
  restore, etc.) without touching it again.
- Inline edit only enables on the active tab to avoid competing
  gestures: double-clicking an inactive tab still means "switch to
  this unit." Engineers that need to rename a non-active AHU have the
  picker chip click → then double-click on the now-active chip.
- No math-core or persistence changes. 220 cfm pin still holds
  (verified end-to-end after a rename). Snapshot persistence, units
  toggle, and presets untouched.

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean (--max-warnings 0)
- `npm test` — 61/61 vitest (was 58, +3 new)
- `npm run build` — clean
- `npx playwright test` — 29/29 (was 23, +6 new)

Math core, snapshot persistence, units toggle, and presets untouched.