// _harness.js
// Loads the React Component class out of ../index.html, instantiates it,
// and exposes runTest() for the individual *.test.js files.
//
// This is intentionally minimal — no test framework dependency. The tests
// themselves run under node:test (built in to Node >= 18).

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let cachedComponent = null;

function loadComponent() {
  if (cachedComponent) return cachedComponent;

  const html = fs.readFileSync(
    path.join(__dirname, '..', 'index.html'),
    'utf8'
  );

  // Pull the body of the <script type="text/x-dc"> block.
  const m = html.match(
    /<script\s+type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!m) throw new Error('Could not find <script type="text/x-dc"> in index.html');

  // The original source declares `class Component extends DCLogic { ... }`.
  // A class declaration lives in the script's lexical scope but does NOT
  // attach to the sandbox global, so vm.runInContext can't expose it.
  // Fix: append `; module.exports = { Component };` (Node treats the IIFE
  // pattern below the same way; under vm we expose via `globalThis`).
  const inner = m[1].trim();
  // Append an assignment so the class is reachable as `sandbox.Component`.
  const code = inner + '\n;globalThis.__Component = Component;';

  // Minimal stub of DCLogic (the Dabble runtime base class).
  // The Component class extends DCLogic but doesn't actually use any of its
  // methods in the calc paths — it just stores `this.state`.
  const DCLogicStub = class {
    constructor(props) { this.props = props || {}; }
    setState() {} // no-op; tests read state directly after compute()
  };

  // Minimal React stub — the class never imports React at the top of its
  // script, but references `React.createRef` in the constructor.
  const ReactStub = { createRef: () => ({ current: null }) };

  const sandbox = {
    DCLogic: DCLogicStub,
    StreamableLogic: DCLogicStub,
    React: ReactStub,
    console,
    globalThis: null, // will be replaced below
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const Component = sandbox.__Component;
  if (!Component) throw new Error('Component class not found in dc-script');
  cachedComponent = Component;
  return Component;
}

/**
 * Run a single known-answer test.
 *   name      — string
 *   ahu       — the AHU state object to pass to component.compute(ahu)
 *   expected  — { vot, ev, xs, oaPct, ... } (only the keys you supply are checked)
 *   tol       — absolute tolerance (default 0.5 cfm or 0.001 for fractions)
 */
function runTest(t) {
  const Component = loadComponent();
  const c = new Component();
  c.state = {
    units: 'ip',
    ahus: [],
    activeId: 'a1',
  };
  const result = c.compute(t.ahu);
  const tol = t.tol ?? 0.5;
  const out = { name: t.name, checks: [], pass: true };
  for (const [k, want] of Object.entries(t.expected)) {
    const got = result[k];
    const ok = Math.abs(Number(got) - Number(want)) <= tol;
    if (!ok) out.pass = false;
    out.checks.push({ key: k, want, got, ok });
  }
  return out;
}

module.exports = { runTest };
