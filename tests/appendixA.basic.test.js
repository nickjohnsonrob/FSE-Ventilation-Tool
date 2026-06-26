// appendixA.basic.test.js
// Known-answer case: 2-zone Appendix A example.
// Numbers below are illustrative — they will be tightened against the
// worked example in ASHRAE 62.1-2022 Appendix A as that gets re-derived.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runTest } = require('./_harness');

test('Appendix A: 2-zone office building, identical TUs', () => {
  const r = runTest({
    name: '2x Office space, 1000 ft^2, 10 ppl each, ceiling cool supply',
    ahu: {
      type: 'multizone',
      method: 'appendixA',
      psAuto: true,
      ps: 0,
      vpsAuto: true,
      vps: 0,
      zones: [
        { id: 'z1', tag: 'TU-1-01', space: 'Office space',
          area: 1000, pop: 10, vpz: 600, vdz: 600, vdzm: 0,
          ezConfig: 'Ceiling supply of cool air', box: 'single', er: 0 },
        { id: 'z2', tag: 'TU-1-02', space: 'Office space',
          area: 1000, pop: 10, vpz: 600, vdz: 600, vdzm: 0,
          ezConfig: 'Ceiling supply of cool air', box: 'single', er: 0 },
      ],
    },
    expected: {
      // Each zone: Vbz = 10*5 + 1000*0.06 = 50 + 60 = 110 cfm
      // Ez = 1.0, so Voz = 110 cfm per zone
      // D = 20/20 = 1.0; Vou = 1.0*(2*50) + (2*60) = 100 + 120 = 220 cfm
      // Vps = sum Vpz = 1200 cfm; Xs = 220/1200 = 0.1833
      xs: 220 / 1200,
      // sumVoz = 220 cfm
    },
    tol: 0.001,
  });
  for (const c of r.checks) {
    assert.ok(c.ok, `${c.key}: want ${c.want}, got ${c.got}`);
  }
});
