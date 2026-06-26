// singlezone.critical.test.js
// Single-zone §6.2.5.1, Ev = 1, with sub-room breakdown using
// critical-room rollup (the default).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runTest } = require('./_harness');

test('Single-zone §6.2.5.1: 1 zone, no rooms, Office space', () => {
  const r = runTest({
    name: 'Single zone, Office space, 800 ft^2, 8 ppl',
    ahu: {
      type: 'singlezone',
      szMode: 'critical',
      zones: [
        { id: 'z1', tag: 'RM-01', space: 'Office space',
          area: 800, pop: 8, vpz: 600, vdz: 600, vdzm: 0,
          ezConfig: 'Ceiling supply of cool air', box: 'single', er: 0 },
      ],
    },
    expected: {
      // Vbz = 8*5 + 800*0.06 = 40 + 48 = 88 cfm
      // Ez = 1.0 => Voz = 88 cfm; Vot = Voz (single-zone, Ev=1)
      vbz: 88,
      voz: 88,
    },
    tol: 0.5,
  });
  for (const c of r.checks) {
    assert.ok(c.ok, `${c.key}: want ${c.want}, got ${c.got}`);
  }
});
