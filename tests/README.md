# Tests

Minimal Node-based regression suite for the `compute()` engine inside `index.html`.

These tests are **known-answer** cases drawn from worked examples in ANSI/ASHRAE 62.1-2022 §6.2, §6.2.5.1, and Normative Appendix A. They exist to catch math regressions when the formula code is touched — not to test UI behavior.

## How to run

```bash
cd tests
npm install
npm test
```

The test harness:

1. Reads `../index.html` as a string
2. Extracts the contents of the `<script type="text/x-dc">` block (the React `Component` class)
3. Evaluates it in a sandboxed `vm.Context` with a minimal stub of the `DCLogic` base class
4. Instantiates the class, feeds each test's input state into `component.compute()`, and asserts the resulting `vot`, `oaPct`, `ev`, `xs`, etc. match the expected value

## Test cases

| File | Method | Source |
|---|---|---|
| `appendixA.basic.test.js` | Appendix A (multi-zone, Ev = min(Evz)) | ASHRAE 62.1-2022 Appendix A example |
| `simplified.basic.test.js` | Simplified §6.2.5.1 (Table 6-3 breakpoints) | ASHRAE 62.1-2022 §6.2.5.1 |
| `singlezone.critical.test.js` | Single-zone, critical-room rollup | ASHRAE 62.1-2022 §6.2.5.1 |
| `singlezone.lumped.test.js` | Single-zone, lumped rollup | Internal upper-bound check |

## Adding a new case

1. Add a new `*.test.js` file
2. `require('./_harness')` and call `runTest({ name, ahu: {...}, expected: { vot, ev, xs, ... } })`
3. Run `npm test`

If you find a real ASHRAE worked example that disagrees with the app, **that's a finding**, not a test failure — open an issue with the standard reference.
