# FSE Ventilation Tool

> **Live: [nickjohnsonrob.github.io/FSE-Ventilation-Tool](https://nickjohnsonrob.github.io/FSE-Ventilation-Tool/)**
>
> Self-contained, offline-capable React app implementing the
> **ANSI/ASHRAE Standard 62.1-2022 Ventilation Rate Procedure (VRP)**.
>
> ⚠️ **Design aid.** All results must be reviewed by a qualified engineer
> against the governing edition of the standard and the authority having
> jurisdiction.

---

## Features

- **Multi-zone (Appendix A)** — full normative procedure: `Ev = min(Evz)` across zones
- **Multi-zone (Simplified §6.2.5.1)** — two valid procedures selectable per AHU:
  - **Table 6-3 breakpoints** — Ev by max Zd (used by the original DC source)
  - **Eq. 6-7 / 6-8 (D-formula)** — Ev = 0.88·D + 0.22 when D < 0.6, else 0.75 (used by the original Python engine)
- **Single-zone (§6.2.5.1, Ev = 1)** with optional **sub-room breakdown** — two rollup modes:
  - **Critical room** (default): worst Zp drives the system
  - **Lumped**: Σ(Vbz/Ez), conservative upper bound
- **Excel export** of inputs, derived calcs, and a summary sheet
- **Dark / light theme**, **I-P units** (cfm, ft², people)
- **100% offline-capable** — no network calls at runtime

## Quick start

### Online (live build)

Open **[nickjohnsonrob.github.io/FSE-Ventilation-Tool](https://nickjohnsonrob.github.io/FSE-Ventilation-Tool/)** — no install required.

### Offline (download)

1. Download the source tarball from the latest release on the
   [Releases page](https://github.com/nickjohnsonrob/FSE-Ventilation-Tool/releases).
2. Unzip and open `index.html` in any browser.

### Develop locally

```bash
git clone https://github.com/nickjohnsonrob/FSE-Ventilation-Tool.git
cd FSE-Ventilation-Tool
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # Production build → dist/
npm run preview      # Preview the production build
```

## Project layout

```
.
├── src/
│   ├── App.tsx                    top-level shell
│   ├── main.tsx                   Vite entry point
│   ├── styles/index.css           design tokens + components (no inline styles)
│   ├── components/                React 18 functional components
│   │   ├── Header.tsx
│   │   ├── MethodSwitcher.tsx     Appendix A / Simplified + procedure picker
│   │   ├── ZoneTable.tsx          editable per-zone inputs
│   │   ├── ResultsBand.tsx        Vot, Vou, Xs, Ev, %OA
│   │   ├── EzHelpDialog.tsx       Table 6-2 reference
│   │   ├── ThemeToggle.tsx
│   │   └── ExportButton.tsx       ExcelJS export
│   ├── hooks/useAhuState.ts       AHU state management
│   └── lib/                        pure functions, no React
│       ├── ashrae621.ts            VRP math engine
│       ├── tables.ts               Table 6-1/6-2/6-3 + SIMPLIFIED_METHODS
│       ├── units.ts                I-P only (cfm, ft²)
│       └── format.ts               display-layer rounding
├── tests/                          (none — see src/lib/__tests__/)
├── src/lib/__tests__/
│   └── ashrae621.test.ts           Vitest, 46 tests including
│                                   cross-engine parity with uploads/vrp.py
├── e2e/
│   └── smoke.spec.ts               Playwright smoke tests
├── .storybook/                     Storybook 8 config
├── .github/workflows/              CI + GitHub Pages deploy
├── index.html                      Vite HTML entry (root of build)
├── vite.config.ts / vitest.config.ts / playwright.config.ts / tsconfig.json
└── package.json
```

## Calculation reference

| Quantity | Equation | Ref |
|---|---|---|
| Breathing-zone OA `Vbz` | `Rp·Pz + Ra·Az` | 6-1 |
| Zone OA `Voz` | `Vbz / Ez` | 6-2 |
| Uncorrected intake `Vou` | `D·Σ(Rp·Pz) + Σ(Ra·Az)` | 6-5 |
| Occupant diversity `D` | `Ps / ΣPz` | 6-6 |
| System vent. eff. `Ev` (Simplified, D-formula) | `0.88·D + 0.22` (D<0.6) or `0.75` | 6-7 / 6-8 |
| System vent. eff. `Ev` (Simplified, Table 6-3) | breakpoints on max Zd | Table 6-3 |
| Avg outdoor-air fraction `Xs` | `Vou / Vps` | A-1 |
| Primary OA fraction `Zpz` | `Voz / Vpz_min` (at turndown) | A-3 |
| Primary air fraction `Ep` | `min(Vpz / Vdz, 1)` | A-8 |
| Zone vent. eff. `Evz` (recirc) | `(Fa + Xs·Fb − Zpz·Ep·Fc) / Fa` | A-4 |
| System vent. eff. `Ev` (Appendix A) | `min(Evz)` over zones | A-9 |
| Design OA intake `Vot` | `Vou / Ev` | 6-10 |
| Vpz,min (Simplified check) | `1.5 · Voz` | 6-9 |

For the sub-room rollup (single-zone §6.2.5.1):
- **Critical room (default):** `Vot = Voz = max(Voz_i / Vpz_i) · ΣVpz_i`
- **Lumped:** `Vot = Voz = Σ(Vbz_i / Ez_i)` (conservative upper bound)

## Method fidelity — three source generations

This engine reconciles **two divergent implementations** of the §6.2.5.1
Simplified procedure that existed in the upstream codebase (see
[HANDOFF.md](./HANDOFF.md)):

| Source | Simplified Ev | Notes |
|---|---|---|
| `uploads/vrp.py` (Python) | Eq. 6-7 / 6-8 (D-formula) | Unit-tested in `test_vrp.py` |
| `Ventilation Rate Procedure.dc.html` (DC source) | Table 6-3 breakpoints | Used in the original UI |
| **This TS port** | **Both selectable** | Pick per AHU; cross-engine parity tested |

Other math fixes applied in this port (vs. an initial draft):

1. **Evz A-4** uses `Zpz · Ep · Fc`, not `Zd · Fc` (the standard's actual form)
2. **Zpz** is evaluated at minimum turndown (`vpzMin`), not design `vpz`
3. **Table 6-3** floating-point snap was rounding 0.2501 → 0.25 (now uses `+1e-9` epsilon)
4. **`Conference/meeting`** alias added so cross-engine parity tests can use either spelling

The cross-engine parity test block in `src/lib/__tests__/ashrae621.test.ts`
mirrors `uploads/test_vrp.py` byte-for-byte on the published worked examples
(D=0.75, Vou=660, Ev=0.572, Ev=0.75, Zpz=0.5167, Evz=0.5668) — any drift
between the engines will surface there.

## Development

### Run all checks

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run test          # vitest (46 tests)
npm run test:e2e      # Playwright smoke tests (needs `npx playwright install chromium` first)
npm run build         # Vite production build
npm run build-storybook   # Storybook static build
npm run storybook     # Storybook dev server
npm run format        # Prettier
```

### Editing the calc engine

All ASHRAE math lives in `src/lib/ashrae621.ts`. The module is
**pure** — no React, no DOM, no I/O. Adding a new equation:

1. Write the function with JSDoc citing the Standard section.
2. Add a Vitest case to `src/lib/__tests__/ashrae621.test.ts` with a
   hand-verified answer.
3. Run `npm test`.

### Adding a new occupancy category

1. Open `src/lib/tables.ts`
2. Add to `OCCUPANCY_CATEGORIES`: `"Your category": [Rp, Ra]` (cfm/person, cfm/ft²)
3. The dropdown is auto-generated — no UI change needed.

### Adding a new Ez configuration

Same pattern — edit `EZ_CONFIGS` in `src/lib/tables.ts`:
`[label, value, shortLabel]`.

## License

MIT — see [`LICENSE`](./LICENSE). Vendored libraries retain their own
licenses — see [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## References

- ANSI/ASHRAE Standard 62.1-2022, *Ventilation and Acceptable Indoor Air Quality*
  - §6.2 — Ventilation Rate Procedure
  - §6.2.5.1 — Simplified procedure (single-zone, Ev = 1)
  - Table 6-1 — IAQ Procedure: Required Outdoor Ventilation Air
  - Table 6-2 — Zone Air Distribution Effectiveness
  - Table 6-3 — Simplified Method: Ventilation Efficiency breakpoints
  - Normative Appendix A — Multi-zone procedure
- See [`HANDOFF.md`](./HANDOFF.md) for the project history and source-of-truth relationships.
