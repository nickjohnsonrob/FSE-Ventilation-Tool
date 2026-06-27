# FSE Ventilation Tool — Session Handoff & Improvement Backlog

_Last updated: end of session that merged PR #5 ("room area/pop rollup from zone + fix dark mode toggle")._

---

## What this is

A browser-based ANSI/ASHRAE 62.1-2022 Ventilation Rate Procedure (VRP) calculator for engineers. Live at:
**https://nickjohnsonrob.github.io/FSE-Ventilation-Tool/**

Built on Vite + React 18 + TypeScript, deployed to GitHub Pages on push to `main`. Math core pinned by 46 vitest tests against a Python reference (`vrp.py`).

The repo: `nickjohnsonrob/FSE-Ventilation-Tool` (local clone at `/tmp/ashrae_review/FSE-Ventilation-Tool`).

---

## Current state of `main` (PR #5, commit `6d048a9`)

### Working features
- **Multi-AHU**: add/remove/switch air handlers via `+ Add unit` (RTU vs DOAS); editable AHU name; tab × appears at ≥2 AHUs
- **Multi-zone**: `+ Add zone`, per-zone × (≥2 zones), `Reset zones`, Rooms toggle in toolbar
- **Multi-room (rooms-mode)**: rooms roll up to the zone — add/remove rooms redistribute area & pop equally so Σ(rooms) = z.area/z.pop; zone inputs lock (disabled) while rooms exist; `Σ rooms drives` hint badge in zone tag
- **Math core**: VRP + Simplified (§6.2.5.1), fan-powered branch, CRIT badge on highest-Zp room per zone
- **Analysis row**: `EffZoneChart` (bars per zone, red on critical, amber when <0.90) + `EquationTrace` (step list with `=` icon to collapse details)
- **Dark/light mode**: actually works now (`data-theme` on `<html>`, persists in localStorage); v2 set it on inner div and the selector never matched
- **Export**: Excel export (active AHU only)
- **Tests**: 58 vitest + 23 Playwright, all green
- **CI**: typecheck, lint, vitest, Playwright, build — all green

### Known gaps (from previous sessions' notes)
- No keyboard shortcuts for add zone/room
- No drag-to-reorder zones
- Excel export keys off active AHU only (was same in v1.0.0)
- No persistence — refresh loses state (was same in v1.0.0)
- v2/v3 has no `box` select (fan-powered branch inactive by default); v1 had it, modernized build dropped it

---

## Project layout (post-PR #5)

```
src/
  lib/
    ashrae621.ts        — math core. Pinned. Do not touch math semantics; UI fields (id?, name?, condition?, roomsEnabled?) are added here
    tables.ts           — ASHRAE Table 6-3 / 5-5-5 lookups (untouched)
    format.ts, units.ts — number/unit formatting (untouched)
  hooks/
    useAhuState.ts      — central state machine: ahus[], activeId, add/remove/switch units, zones, rooms
    __tests__/useAhuState.test.ts — 12 state-machine tests (NEW in PR #2, extended in #5)
  components/
    AhuPicker.tsx       — chip-row picker with +Add menu (NEW #2)
    ZoneTable.tsx       — zones + inline rooms; rewritten in #3, extended in #5
    MethodSwitcher.tsx, ResultsBand.tsx, ExportButton.tsx,
    EzHelpDialog.tsx, Header.tsx, ThemeToggle.tsx — untouched components
    EquationTrace.tsx, EffZoneChart.tsx — analysis row (PR #4)
  styles/index.css      — design tokens + custom CSS for picker, room table, CRIT badge, Σ badge
  App.tsx               — wires picker, theme (data-theme on <html>), memoizes compute() per active AHU
e2e/
  smoke.spec.ts         — math pin (1000/1000/1000/10/10 → Vot=220)
  multi-unit.spec.ts    — 11 UI-level tests for AHU/zone/room controls + CRIT + Σ redistribution
  analysis.spec.ts      — 3 tests for analysis row + equation trace
design/
  v3-mockup.html        — interactive mockup deployed at /v3-mockup/
  v1-vs-v2-zone-rooms.md
  v3-tighten-checklist.md
public/_ds/             — design system bundle (untouched; owns the dark-mode :root selector)
docs/
  HANDOFF.md            — this file
```

---

## How to run locally

```bash
cd /tmp/ashrae_review/FSE-Ventilation-Tool
npm ci
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit
npm run lint         # eslint --max-warnings 0
npm test             # vitest
npm run test:e2e     # playwright (needs browsers: npx playwright install)
npm run build        # vite build
```

## How to ship

```bash
git checkout -b feature/<name>
# ... edit, npm test, npm run test:e2e, npm run build ...
git add -A && git commit -m "..."
gh pr create --base main --head feature/<name>
gh pr merge --squash --delete-branch
# Wait for Pages deploy (~30-40s), then curl -sI the live URL
```

## Rollback (if the live site breaks)

```bash
cd /tmp/ashrae_review/FSE-Ventilation-Tool
git reset --hard 1b54044 && git push --force-with-lease   # back to v1.0.0 working tag
gh workflow run "Deploy to GitHub Pages"
# OR
git checkout v1.0.0 && open index.html                    # original offline bundle, runs from disk
```

---

## Improvement backlog

Prioritized. Pick from the top.

### P0 — Fix what's broken or fragile

- [ ] **No state persistence.** Refresh nukes everything; engineers lose 30 min of inputs. **Locked scope (this session):** URL-encoded shareable state wins on load, localStorage is backup + offline, **plus named snapshots** (save-state library, 50-snapshot FIFO cap, Restore / Duplicate-as-new-AHU / Delete / search-by-name). No diff view v1. See "Save-state feature" section below.
- [ ] **Excel export only keys off active AHU.** **Locked scope:** single workbook, N sheets (one per AHU). Add a small export modal with sheet-name preview.
- [ ] **No keyboard shortcuts.** Engineers re-tab through this app hundreds of times. Add: `Cmd/Ctrl+Enter` = add zone, `Cmd/Ctrl+Shift+Enter` = add room, `Cmd/Ctrl+R` = reset zones (with confirm). Don't override native browser shortcuts.
- [ ] **Unit toggle (SI vs IP).** Currently always IP (cfm, ft²). **Locked scope:** IP default, SI opt-in via toggle in header. Affects inputs, results, and Table 6-3 lookups.

### P1 — Restore v1.0.0 features modern build dropped

- [ ] **Fan-powered terminal box select.** v1 had a `box` (None / Induction / Fan-powered) select that flipped the calculation through `Ep/Fa/Fb/Fc` steps in the trace. v3 dropped it. **Locked scope (this session):** default **Single-duct TU**, Fan-powered opt-in. (Induction box deferred — out of scope unless asked.) Re-add as a per-zone dropdown in the meta strip; thread through `compute()` in App.tsx.
- [ ] **DR (Default) / DC / DC+ system type selection per AHU.** v1 had this; v3 doesn't show it anywhere. Affects whether the equation trace shows §6.2.5.1 Appendix A vs Simplified steps.
- [ ] **Critical zone override per AHU.** v1 let you pin one zone as the design driver regardless of math; useful when one zone has known-higher occupancy. Add a "Design driver" radio per zone.

### P1 — UX polish

- [ ] **Drag-to-reorder zones.** Use `@dnd-kit/core`. Trivial because we already have a stable `id` per zone. Persist order.
- [ ] **Inline edit for AHU name.** Currently the input is in the picker; should also be editable in the AHU tab itself for muscle memory.
- [ ] **Confirm before Reset zones.** Currently fires instantly. Add a 1-second "click again to confirm" toast.
- [ ] **Toast notifications** for: room redistributed, zone deleted, AHU removed (currently silent). Bottom-right slide-in, auto-dismiss 2.5s, screen-reader announced.
- [ ] **Empty states + presets.** **Locked scope (this session):** preset loader menu with **all ASHRAE Table 6-3 categories**, grouped by category group (Educational / Healthcare / Retail / Office / Public Assembly / etc.) so it's browsable. Each row populates reasonable defaults (area, pop, Rp, Ra, Ez). One-click.

### P2 — Engineering-grade features

- [ ] **ASHRAE Standard compliance link out.** Each Table 6-3 / 5-5-5 row should link to the official standard preview (free PDF on ashrae.org). Engineers will absolutely click this.
- [ ] **Print stylesheet.** Right now `Cmd/Ctrl+P` produces a mess. Add `@media print` rules: hide AHU picker, show only the active AHU, render zone table in full with page breaks per 5 zones.
- [ ] **PDF export** with the same scope as Excel.
- [ ] **Multi-AHU export to PDF** (one page per AHU, summary cover page with total cfm).
- [ ] **Favorites per space type.** Star icon next to each Table 6-3 row → adds to a "Favorites" group at the top of the picker. **Locked scope (this session):** per-user (all AHUs share), stored in localStorage. No per-AHU override v1.
- [ ] **Scenario comparison.** Snapshots + library gives basic compare (pick snapshot A, pick snapshot B, see totals side-by-side). Side-by-side DOM compare is **deferred** unless explicitly asked.

### P2 — Code health

- [ ] **Extract `RoomTable.tsx` from `ZoneTable.tsx`.** PR #3 inlined it; PR #5 added the Σ redistribution logic inline; it's now 250+ lines. Pull it out and memoize.
- [ ] **`compute()` in App.tsx is not memoized on `(zones, rooms)` changes.** Only on active AHU. Zone-level changes re-run the full compute unnecessarily. Use `useMemo` keyed on `activeAhu`.
- [ ] **CSS debt.** `src/styles/index.css` is ~13 KB of ad-hoc rules; should be split: `picker.css`, `zone-table.css`, `room-table.css`, `analysis.css`. Pull into CSS modules per component.
- [ ] **Storybook** for components. PR #2 added an `index.stories.tsx` story for AhuPicker and nothing else. Finish the rest.
- [ ] **Coverage gate** in vitest config. Currently no threshold; should be 80% statements / 75% branches.
- [ ] **Playwright on real CI browser.** Currently uses Playwright's bundled chromium. Confirm it works on GitHub Actions (already done) — but add a `--headed=false --project=chromium` to the workflow explicitly.

### P3 — Nice to have, low ROI

- [ ] **Dark mode toggle keyboard shortcut** (`Cmd/Ctrl+J`).
- [ ] **Sound effect** when reaching critical zone. (No. Don't.)
- [ ] **Animated count-up** for Vot results. Looks slick but engineers will hate it after the 3rd calc.
- [ ] **Help text tooltips** on every input. Currently only `Ez` and a few have hover hints.
- [ ] **Keyboard navigation through zone rows** with `j`/`k` vim-style.
- [ ] **Auto-save indicator** in the header. "Saved 3s ago" / "Saving…".

---

## Save-state feature (locked scope)

Named snapshots, localStorage-backed. Goal: experiment with changes and revert, or look at multiple different scenarios.

**Storage:**
- localStorage key: `fse.vent.snapshots.v1`
- Schema: `{ version: 1, snapshots: [{ id, name, createdAt, state }] }`
- Cap: 50 snapshots, FIFO eviction. localStorage ~5 MB so 50 × 10 KB is comfortable.
- `id` = uuid v4; `name` defaults to `Snapshot ${n}`, user can rename inline.
- `state` = the full `useAhuState` tree (just JSON-stringify the array; trivial).

**UI:**
- Header button: 💾 **Save state** → captures current state, opens a small inline input to name it (default `Snapshot N`), user can edit before saving.
- Header button: 📚 **Library** → modal listing all snapshots. Columns: name, createdAt, AHU count, total Vot across all AHUs. Each row: **Restore** (replace current state, with confirm), **Duplicate as new AHU** (no destructive — adds as a fresh AHU), **Delete** (with confirm). Search box filters by name.
- Empty state: "No saved scenarios yet. Click 💾 to capture your current work."
- Restoring a snapshot overwrites the current state; offer "Save current state before restoring?" as a one-click save prompt.
- Snapshots persist independently of the active state — deleting the active AHU doesn't delete snapshots.

**Wire:**
- `lib/storage/snapshots.ts` — load / save / add / remove / rename / cap.
- `hooks/useAhuState.ts` — no change (snapshots read/write state externally).
- `components/SnapshotSave.tsx`, `components/SnapshotLibrary.tsx` — new.
- `Header.tsx` — add the two buttons.

**Tests:**
- vitest: `snapshots.test.ts` — add/remove/rename, FIFO cap at 51, schema versioning, name uniqueness not enforced (allow duplicates).
- Playwright: `snapshots.spec.ts` — save state, open library, restore, verify state replaced; save-and-restore-then-modify round-trip.

Approx 150 LOC + 80 LOC tests.

---

## Where to start (suggested first PR)

**`feature/unit-toggle`** — locked P0 scope, smallest surface area, validates the build pipeline before tackling the bigger persistence work.

1. Add `lib/units.ts` extension: `units` enum, `convert()` helpers for area (ft² ↔ m²), airflow (cfm ↔ m³/s), population density.
2. Add `UnitsToggle.tsx` in Header.
3. Add `units` field to `AhuInput` (optional, defaults to `'ip'`).
4. Wrap input values in App.tsx with display converters (stored value is canonical IP, display toggles).
5. Wrap results in `ResultsBand.tsx` and `EffZoneChart.tsx` with display converters.
6. Tests: vitest for `convert()` round-trips; Playwright for the toggle visibly changing displayed values.

Approx 200 LOC + 60 LOC tests. ~3 hours.

**Then:** `feature/persistence-and-snapshots` (P0 #1, biggest piece), `feature/box-select` (P1), `feature/presets-and-favorites` (P1), `feature/multi-ahu-excel-export` (P0).

---

## Open questions (worth asking the user before sinking time)

1. ~~Persistence — localStorage or URL-based?~~ **Locked: both (URL wins on load, localStorage as backup).**
2. ~~Multi-AHU export format — single workbook with N sheets, or zip of N files?~~ **Locked: single workbook, N sheets.**
3. ~~Unit system — IP-only, SI-only, or toggle?~~ **Locked: toggle, IP default.**
4. ~~Examples / presets — which 3 to ship?~~ **Locked: all ASHRAE categories, grouped menu.**
5. ~~Box select default?~~ **Locked: Single-duct TU default, Fan-powered opt-in.**
6. **Induction box** — included in the box-select dropdown, or out of scope for v1? You said "Single-duct TU with fan-powered as an option" so I'm assuming only two choices in the dropdown (no induction). Confirm?
7. **URL shareable state length** — when state grows (multiple AHUs, all zones, all rooms), URLs get long. Some browsers cap at ~2 KB. Acceptable as-is, or do we use a hash fragment (`#state=...`) and store the full state in IndexedDB keyed by hash?

---

## Testing invariants (don't break)

- `src/lib/__tests__/ashrae621.test.ts` — 46 math tests pinned against `vrp.py`. Touching these = re-pinning the math.
- `e2e/smoke.spec.ts` — the 220 cfm pin test (`Area=1000, Pop=10, Rp=5, Ra=0.06 → Vot=220`).
- `e2e/multi-unit.spec.ts` — 11 tests covering AHU/zone/room CRUD, CRIT badge, Σ redistribution.
- All Playwright selectors should use stable test-id attributes (`.ahu-tab`, `.zone-row`, `.room-row`), never `getByRole` with display strings.

---

## Contact / context

User: Nick Johnson, ASHRAE engineering context. Hands off cleanly between sessions; expects a new orchestrator session to find this doc and the repo at a clean `main`.