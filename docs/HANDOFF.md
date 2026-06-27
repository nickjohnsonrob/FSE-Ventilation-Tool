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

- [ ] **No state persistence.** Refresh nukes everything; engineers lose 30 min of inputs. Add localStorage autosave (debounced 500ms) of the full `useAhuState` tree. Versioned schema so a future breaking change to the state shape can ignore old saves. Restore on mount if version matches.
- [ ] **Excel export only keys off active AHU.** Either: (a) one worksheet per AHU in a single workbook, or (b) export all AHUs to a zip. Both already trivial — add a small export modal with radio buttons.
- [ ] **No keyboard shortcuts.** Engineers re-tab through this app hundreds of times. Add: `Cmd/Ctrl+Enter` = add zone, `Cmd/Ctrl+Shift+Enter` = add room, `Cmd/Ctrl+R` = reset zones (with confirm). Don't override native browser shortcuts.

### P1 — Restore v1.0.0 features that modern build dropped

- [ ] **Fan-powered terminal box select.** v1 had a `box` (None / Induction / Fan-powered) select that flipped the calculation through `Ep/Fa/Fb/Fc` steps in the trace. v3 dropped it. Re-add as a per-zone dropdown in the meta strip; thread through `compute()` in App.tsx.
- [ ] **DR (Default) / DC / DC+ system type selection per AHU.** v1 had this; v3 doesn't show it anywhere. Affects whether the equation trace shows §6.2.5.1 Appendix A vs Simplified steps.
- [ ] **Critical zone override per AHU.** v1 let you pin one zone as the design driver regardless of math; useful when one zone has known-higher occupancy. Add a "Design driver" radio per zone.

### P1 — UX polish

- [ ] **Drag-to-reorder zones.** Use `@dnd-kit/core`. Trivial because we already have a stable `id` per zone. Persist order.
- [ ] **Inline edit for AHU name.** Currently the input is in the picker; should also be editable in the AHU tab itself for muscle memory.
- [ ] **Confirm before Reset zones.** Currently fires instantly. Add a 1-second "click again to confirm" toast.
- [ ] **Toast notifications** for: room redistributed, zone deleted, AHU removed (currently silent). Bottom-right slide-in, auto-dismiss 2.5s, screen-reader announced.
- [ ] **Empty states** with onboarding hints: "Click + Add zone to start. Or load an example office / lab / classroom." Add 3 preset loaders (Office, Lab, Classroom) that populate reasonable defaults.

### P2 — Engineering-grade features

- [ ] **ASHRAE Standard compliance link out.** Each Table 6-3 / 5-5-5 row should link to the official standard preview (free PDF on ashrae.org). Engineers will absolutely click this.
- [ ] **Unit toggle** (SI vs IP). Currently always IP (cfm, ft²). Add `m³/s`, `m²`. Affects inputs, results, and Table 6-3 lookups.
- [ ] **Print stylesheet.** Right now `Cmd/Ctrl+P` produces a mess. Add `@media print` rules: hide AHU picker, show only the active AHU, render zone table in full with page breaks per 5 zones.
- [ ] **PDF export** with the same scope as Excel.
- [ ] **Multi-AHU export to PDF** (one page per AHU, summary cover page with total cfm).
- [ ] **Scenario comparison.** Open the same calc twice side-by-side. Easy because state is URL-encoded with a query string — just add a "Compare" button that opens a second instance.

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

## Where to start (suggested first PR)

**`feature/persistence-localstorage`** — implements the P0 #1 item. Self-contained, low-risk, high-impact. Engineers will notice immediately.

1. Add `lib/storage.ts` with `loadState()` / `saveState()` / `clearState()` and a schema version constant.
2. Extend `useAhuState.ts` with a `useEffect` that subscribes to state changes (debounced 500ms) and calls `saveState`.
3. Add a `useEffect` on mount that calls `loadState()`; if version matches, replace initial state.
4. Add a "Reset all" button in the Header (next to Theme toggle) that clears storage + state.
5. Test: write a vitest that mutates state, waits 600ms, asserts localStorage was written; reload component, asserts state restored.
6. Update the existing Playwright `multi-unit.spec.ts` to add a session-restore scenario.

Approx 100 LOC + 30 LOC tests. ~2 hours including Playwright.

---

## Open questions (worth asking the user before sinking time)

1. **Persistence — localStorage or URL-based?** URL-based is shareable ("send this calc to your colleague") but URLs get long. localStorage is private but not shareable. Could do both.
2. **Multi-AHU export format — single workbook with N sheets, or zip of N files?** User preference. Single workbook is more user-friendly; zip is more grep-able.
3. **Unit system — IP-only, SI-only, or toggle?** v1 was IP-only. ASHRAE Standard is dual-units but most US engineers stay in IP.
4. **Examples / presets** — which 3 to ship? Office / Lab / Classroom is my guess. Confirm with user.
5. **Box select (None / Induction / Fan-powered)** — should this default to "None" and require user opt-in, or default to "Fan-powered" (most common in commercial)?

---

## Testing invariants (don't break)

- `src/lib/__tests__/ashrae621.test.ts` — 46 math tests pinned against `vrp.py`. Touching these = re-pinning the math.
- `e2e/smoke.spec.ts` — the 220 cfm pin test (`Area=1000, Pop=10, Rp=5, Ra=0.06 → Vot=220`).
- `e2e/multi-unit.spec.ts` — 11 tests covering AHU/zone/room CRUD, CRIT badge, Σ redistribution.
- All Playwright selectors should use stable test-id attributes (`.ahu-tab`, `.zone-row`, `.room-row`), never `getByRole` with display strings.

---

## Contact / context

User: Nick Johnson, ASHRAE engineering context. Hands off cleanly between sessions; expects a new orchestrator session to find this doc and the repo at a clean `main`.