# Project Handoff — ASHRAE 62.1 Ventilation Rate Procedure Tool

> Context package for picking this project up elsewhere (another AI tool, a developer, or a fresh session). Read this top-to-bottom; it covers what the project is, where it came from, what exists now, how the pieces relate, the calculation methodology, and what's left to do.

---

## 1. One-paragraph summary

This is a single-air-handler **Ventilation Rate Procedure (VRP) calculator** implementing ANSI/ASHRAE Standard 62.1-2022, Section 6.2 and Normative Appendix A. It sizes the design outdoor-air intake (`Vot`) for multiple-zone recirculating (VAV) and single-zone (DOAS) systems. It started life as a **Python / Streamlit app** (the original source is in `uploads/`), and was re-implemented as a **self-contained browser app** — first as a Design Component (`Ventilation Rate Procedure.dc.html`), then bundled into a **fully-offline static build** (`FSE Ventilation Calculation/`) for IT/security-review-friendly distribution. The active, polished deliverable is the offline build; the DC is the editable source.

---

## 2. Lineage / history (how we got here)

1. **Original app — Python + Streamlit.** A working calculator with a clean separation between engine, I/O, and UI. Source preserved in `uploads/` (`app.py`, `vrp.py`, `data.py`, `workbook.py`, `help_text.py`, plus tests). It used a single `.xlsx` file as its save format (import → edit → export round-trip).
2. **Re-implementation as a browser Design Component.** Rebuilt the same methodology and Excel round-trip as `Ventilation Rate Procedure.dc.html` — a React-based, inline-styled app skinned with the **Flow Systems Design System** token palette (the `--ac` purple instrument theme, IBM Plex Sans + Chivo Mono). Adds light/dark theme, a totals bar, a critical-zone trace, and an Ez help dialog.
3. **Offline bundling.** The DC was inlined/vendored into `FSE Ventilation Calculation/` — a static folder that opens `index.html` directly with **no network access**, vendoring React, React-DOM, ExcelJS, and the web fonts locally. This is the version meant to be zipped and handed to engineers / IT.

So the same tool exists in three generations: **Streamlit (uploads/) → DC source (.dc.html) → offline static build (FSE Ventilation Calculation/)**. The two browser generations are functionally the same app; the offline build is the DC with dependencies localized.

---

## 3. Current file map

```
/  (project root)
├── HANDOFF.md                          ← this document
├── Ventilation Rate Procedure.dc.html  ← EDITABLE SOURCE (Design Component, ~1600 lines)
├── support.js                          ← DC runtime (do not edit; framework file)
│
├── FSE Ventilation Calculation/        ← OFFLINE STATIC BUILD (the shippable deliverable)
│   ├── index.html                      ← the bundled app (~2850 lines)
│   ├── lib/support.js                  ← vendored DC runtime
│   ├── vendor/                         ← React, React-DOM, ExcelJS (MIT), unmodified, local
│   ├── fonts/                          ← IBM Plex Sans + Chivo Mono .woff2 (OFL), local
│   └── README.txt                      ← end-user / IT-review notes (offline, no network)
│
├── _ds/flow-systems-design-system-…/   ← Flow Systems Design System bundle + tokens
│
└── uploads/                            ← ORIGINAL SOURCE MATERIAL + references
    ├── app.py / vrp.py / data.py / workbook.py / help_text.py   ← original Streamlit app
    ├── test_vrp.py / test_workbook.py                            ← original unit tests
    ├── *-<hash>.py / README-<hash>.md                            ← duplicate/older copies
    ├── requirements.txt                                          ← streamlit, pandas, openpyxl
    ├── ASHRAE Standard 62.1-2022 (1).pdf                         ← the governing standard
    ├── 62.1 Calc Example.pdf                                     ← worked example
    ├── 260065 Taylorport … IFC VALUES.xlsx                       ← a real project workbook
    └── pasted-*.png / draw-*.png                                 ← reference screenshots
```

Note: `uploads/` contains a few **duplicate files with hash suffixes** (e.g. `app-d451732a.py`, `workbook-551a0d05.py`, `README-f1c1442c.md`). These are alternate/older uploads of the same files — `README.md` and `README-f1c1442c.md` are byte-identical. Treat the non-suffixed names as canonical.

---

## 4. Architecture of the browser app (the DC)

`Ventilation Rate Procedure.dc.html` is a **Design Component**: a single HTML file with three logical parts assembled by `support.js`:

- **Template** — inline-styled markup between `<x-dc>…</x-dc>`. Uses control-flow tags `<sc-for>` / `<sc-if>`. All styling is inline; design tokens are CSS custom properties defined in a `<helmet><style>` block (`--ink`, `--ac` accent purple, `--sans`, `--mono`, etc.), with a full **dark-theme override** under `body:has([data-theme="dark"])`.
- **Logic class** — `class Component extends DCLogic { … }`. Holds the reference tables, default project state, the calculation engine, and all handlers. `renderVals()` returns the flat values/handlers the template binds to.
- **Props / Tweaks** — `data-props` JSON exposes: `showTrace` (boolean), `showHelp` (boolean), `criticalColor` (enum: `alert` | `accent`). Preview size 1320×1000.

Key state shape (in the logic class):
- `ahus[]` — array of air handlers; each has `type` (`multizone` | `singlezone`), `method` (`appendixA` | `simplified`), a `condition` label, system fields (`ps`, `vps`, …), and a `zones[]` array.
- Each **zone** has: `tag`, `space` (occupancy category), `area` (Az), `pop` (Pz), `vpz`, `vdz`, `vdzm`, `ezConfig`, `box` (`single` | fan-powered), recirc params.
- Seeded with two example AHUs from the **Taylorport** project (job 260065): `RTU-01` (multizone) and `DOAS-01` (singlezone).

Reference data baked into the class:
- `OCC` — **Table 6-1** map: occupancy category → `[Rp cfm/person, Ra cfm/ft²]` (I-P units internally; SI converted for display).
- `EZ` — **Table 6-2/6-4** zone air-distribution effectiveness configs → `[name, Ez value, short label]`.

I-P is the internal unit system; SI is a display conversion via the units toggle.

---

## 5. Calculation methodology (must stay faithful to the standard)

| Quantity | Equation | Ref |
|---|---|---|
| Breathing-zone OA `Vbz` | `Rp·Pz + Ra·Az` | 6-1 |
| Zone OA `Voz` | `Vbz / Ez` | 6-2 |
| Uncorrected intake `Vou` | `D·Σ(Rp·Pz) + Σ(Ra·Az)` | 6-5 |
| Occupant diversity `D` | `Ps / ΣPz` | 6-6 |
| System vent. eff. `Ev` (simplified) | `0.88·D + 0.22` (D<0.6) or `0.75` | 6-7 / 6-8 |
| Avg outdoor-air fraction `Xs` | `Vou / Vps` | A-1 |
| Zone vent. eff. `Evz` (single supply) | `1 + Xs − Zpz` | A-2 |
| Zone vent. eff. `Evz` (secondary recirc) | `(Fa + Xs·Fb − Zpz·Ep·Fc)/Fa` | A-4 |
| System vent. eff. `Ev` (Appendix A) | `min(Evz)` over zones | A-9 |
| Design OA intake `Vot` | `Vou / Ev` | 6-10 |

- **Single-zone systems** use §6.2.5.1 → `Ev = 1`.
- The app identifies and highlights the **critical (ventilation-limiting) zone**.
- Reference rates are transcribed from the **2022 edition** Tables 6-1 and 6-2/6-4. Any change to the standard edition means re-checking these tables (`OCC` and `EZ` in the DC; `data.py` in the Python source).

The original Python engine (`uploads/vrp.py`) and workbook layer (`uploads/workbook.py`) are **UI-independent and unit-tested** (`test_vrp.py`, `test_workbook.py`) — they are the most authoritative reference for correct numbers. If you ever doubt the browser engine, diff its outputs against `vrp.py`.

---

## 6. Save format — Excel round-trip (carried across all versions)

The save format is a **single `.xlsx`**. Export produces three sheets:
- `Inputs` — the editable zone table + project metadata + system settings. **This is the only sheet the importer reads.**
- `Results` — formatted, schedule-ready system + zone breakdown (for seeding drawing schedules).
- `Schema` — column reference + schema version.

Import reads only `Inputs`, tolerates reordered/extra columns, and fills missing optional columns with defaults. Workflow: **Import → edit → Export → (later) re-import.** In the browser app this is handled with **ExcelJS** (vendored); in Python it was `openpyxl`/`pandas`.

---

## 7. How to run / edit each version

- **Offline build (ship this):** unzip `FSE Ventilation Calculation/`, open `index.html` in any browser. No install, no network. See its `README.txt` for the IT/security write-up.
- **DC source (edit here):** open `Ventilation Rate Procedure.dc.html`. It's the editable generation — change logic/markup here, then re-bundle to refresh the offline build.
- **Original Streamlit app (reference engine):** `pip install -r uploads/requirements.txt` then `streamlit run app.py` (needs the original repo layout with `src/` and `tests/`; the loose files in `uploads/` are flattened copies).

**Important:** the offline `index.html` is a *generated* artifact. Don't hand-edit it as the source of truth — change the `.dc.html` and re-bundle, or you'll fork the two.

---

## 8. Design system

Skinned with the **Flow Systems Design System** (bundle under `_ds/`). It's an "instrument" aesthetic: tight radii, calm transitions, a single reserved purple accent (`--ac: #4c4487`), borders/sunken insets instead of float shadows, IBM Plex Sans + Chivo Mono. Keep new UI consistent with these tokens rather than inventing colors.

---

## 9. Open items / watch-outs for whoever picks this up

- **Two generations can drift.** The DC and the offline `index.html` must be kept in sync — treat the `.dc.html` as source and regenerate the bundle.
- **Standard edition is hard-coded to 2022.** Table 6-1 (`OCC`) and Ez configs (`EZ`) are transcribed by hand — verify against a real copy of the standard before trusting, and re-transcribe if moving editions.
- **Engineer-review disclaimer is intentional** — results are a design aid and must be checked by a qualified engineer against the AHJ. Keep the footer/disclaimer.
- **Duplicate uploads** with hash suffixes are noise; the canonical sources are the un-suffixed filenames.
- **Reference assets** (the standard PDF, worked-example PDF, Taylorport workbook, screenshots) live in `uploads/` and are the ground truth for validating numbers and matching the intended UI.

---

*Generated as a torch-passing context document. The richest single reference for correct calculations is the original tested Python engine in `uploads/vrp.py`; the richest reference for the intended UI is `Ventilation Rate Procedure.dc.html`.*
