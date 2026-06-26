# FSE Ventilation Tool

Offline calculator for the **ANSI/ASHRAE Standard 62.1-2022 Ventilation Rate Procedure (VRP)**.

- Multi-zone systems — full **Normative Appendix A** and the **Simplified §6.2.5.1** method (Table 6-3 breakpoints)
- Single-zone systems (§6.2.5.1, Ev = 1) with optional **sub-room breakdown** and two rollup modes:
  - **Critical room** — `Vot = Voz = max(Zp_i) · ΣVpz_i` (worst room drives)
  - **Lumped** — `Vot = Voz = Σ(Vbz_i / Ez_i)` (proportional-mix assumption)
- **Excel export** of the project workbook (multi-tab: Inputs, Multi-zone, Single-zone)
- **Dark / light theme**, I-P units (cfm, ft², people)
- **100% offline** — no network calls at runtime (all assets are local; see *Security & offline behavior* below)

> ⚠️ **Design aid.** All results must be reviewed by a qualified engineer against the governing edition of the standard and the authority having jurisdiction.

---

## How to use

Unzip (or clone) and open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari). No build step, no install, no internet required.

```bash
git clone https://github.com/nickjohnsonrob/FSE-Ventilation-Tool.git
open FSE-Ventilation-Tool/index.html      # macOS
xdg-open FSE-Ventilation-Tool/index.html  # Linux
start FSE-Ventilation-Tool/index.html     # Windows
```

---

## Repository layout

```
.
├── index.html               Application (React component + CSS + embedded template)
├── lib/support.js           Dabble/Scrimba "dc" runtime loader (DCLogic, StreamableLogic)
├── vendor/                  Third-party libraries, unmodified, served locally
│   ├── react.production.min.js          (MIT)
│   ├── react-dom.production.min.js      (MIT)
│   └── exceljs.min.js                   (MIT)
├── fonts/                   IBM Plex Sans + Chivo Mono (OFL), as local .woff2 files
├── tests/                   Known-answer regression tests for compute() — see tests/README.md
├── README.md                You are here
├── THIRD_PARTY_NOTICES.md   License attributions for bundled vendor code & fonts
└── LICENSE                  MIT (this project)
```

### What's *not* in this repo

- The Dabble/Scrimba authoring-time editor. The runtime expects `<x-dc>` and `<helmet>` markers in `index.html` (lines ~27, ~30, ~947) — these are framework scaffolding that the runtime (`lib/support.js`) understands. The `<script type="text/x-dc">` block (lines ~1863–2848) contains the actual React `Component` class with all the calc logic.

---

## Security & offline behavior

This is a **static, self-contained** web page. At runtime:

- **No external network calls.** Every asset (JS, fonts, CSS) loads via relative paths.
- The runtime loader (`lib/support.js`) may issue a *same-origin* `fetch(location.href)` **only** when it cannot find the `<x-dc>` template block in the current document. This is a self-fetch against the file already loaded — not an outbound request to any server.
- No cookies, no `localStorage` cross-site writes, no telemetry.
- All vendor JS is checked in as-is. See `THIRD_PARTY_NOTICES.md` for license provenance.

If your security policy forbids any `fetch()` at all (even self-fetch), set your browser/content-security-policy to `default-src 'self'; connect-src 'none'` and the fallback self-fetch will be silently blocked — the app will still load, but you must serve `index.html` over `http(s)://` (not `file://`) for the loader to find the embedded template.

---

## Calculation reference

| Symbol | Meaning | Source |
|---|---|---|
| `Pz` | Zone population | user input |
| `Az` | Zone floor area (ft²) | user input |
| `Rp`, `Ra` | People / area outdoor air rate | **Table 6-1** (I-P), transcribed into the `OCC` object |
| `Ez` | Zone air distribution effectiveness | **Table 6-2**, in the `EZ` object |
| `Vbz = Pz·Rp + Az·Ra` | Breathing-zone outdoor airflow | §6.2.2 |
| `Voz = Vbz / Ez` | Zone outdoor airflow | §6.2.5 |
| `Vpz`, `Vdz`, `Vdzm` | Primary, discharge, min-discharge airflow | user input |
| `Ep = min(Vpz/Vdz, 1)` | Primary air fraction | §A.3 |
| `Er` | Outdoor air fraction of recirculated air | user input |
| `Zd = Voz / Vdzm` | Discharge OA fraction | derived |
| `Xs = Vou / Vps` | System outdoor air fraction | derived |
| `D = Ps / ΣPz` | Primary air fraction of system population | derived |
| `Evz` | Zone ventilation efficiency | Appendix A |
| `Ev = min(Evz)` (Appendix A) or Table 6-3 (Simplified) | System ventilation efficiency | §6.2.5 / §A.3 |
| `Vot = Vou / Ev` | Total outdoor airflow rate | §6.2.5 / §A.3 |

For the sub-room rollup (single-zone §6.2.5.1):
- **Critical room (default):** `Vot = max(Voz_i / Vpz_i) · ΣVpz_i`
- **Lumped:** `Vot = Σ(Vbz_i / Ez_i)` (assumes supply distributes in proportion to each room's OA demand — not a standard-prescribed method, included as an upper-bound check)

---

## Development

Edit `index.html` for the app, `lib/support.js` for runtime behavior. There is no bundler — refresh the browser to see changes.

### Tests

`tests/` contains a minimal Node harness that loads the `Component` class out of `index.html` and asserts known answers against ASHRAE 62.1 worked examples. Run with:

```bash
cd tests && npm install && npm test
```

See `tests/README.md` for the example set and how to add new cases.

### Adding a new occupancy category

1. Open `index.html`
2. Find the `OCC = { ... }` object (around line 1866)
3. Add `"Your category":[Rp, Ra]` using cfm/person and cfm/ft² (I-P)
4. The dropdown in the UI is auto-generated from `Object.keys(this.OCC).sort()` — no further change needed

### Adding a new Ez configuration

Same pattern — edit the `EZ` array (around line 1890). Format: `[label, value, shortLabel]`.

---

## License

MIT — see [`LICENSE`](./LICENSE). Vendored libraries retain their own licenses — see [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

---

## References

- ANSI/ASHRAE Standard 62.1-2022, *Ventilation and Acceptable Indoor Air Quality*
  - §6.2 — Ventilation Rate Procedure
  - §6.2.5.1 — Simplified procedure (single-zone, Ev = 1)
  - Table 6-1 — IAQ Procedure: Required Outdoor Ventilation Air
  - Table 6-2 — Zone Air Distribution Effectiveness
  - Table 6-3 — Simplified Method: Ventilation Efficiency
  - Normative Appendix A — Multi-zone procedure
