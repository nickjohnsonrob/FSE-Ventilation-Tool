/**
 * Tests for the localStorage-backed snapshot library
 * (src/lib/storage/snapshots.ts).
 *
 * What we verify:
 *   1. CRUD round-trip — save → list → load → delete.
 *   2. List ordering — newest-first so the most-recent save sits at the top
 *      of the library modal.
 *   3. Rename mutates the persisted record (and list reflects the new name).
 *   4. Corrupt / non-JSON / non-array values in localStorage don't crash
 *      and surface as an empty list — engineers don't lose access to the
 *      app because something else wrote to the same key.
 *   5. summarizeSnapshot produces a human-readable rollup of AHU counts,
 *      zone counts, and a total Vot (cfm) for display in the library.
 *
 * jsdom gives us a real localStorage, so no mocking is required beyond the
 * beforeEach clear() so tests don't bleed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AhuInput, ZoneInput } from '../ashrae621';
import {
  type SerializedState,
  deleteSnapshot,
  listSnapshots,
  loadSnapshot,
  renameSnapshot,
  saveSnapshot,
} from '../storage/snapshots';
import { summarizeSnapshot } from '../../components/SnapshotSummary';

const sampleZone = (
  id: string,
  tag: string,
  area: number,
  pop: number,
): ZoneInput => ({
  id,
  tag,
  space: 'Office space',
  area,
  pop,
  vpz: 0,
  vdz: 0,
  vdzm: 0,
  ezConfig: 'Ceiling supply of cool air',
  box: 'single',
  er: 0,
});

const sampleAhu = (
  id: string,
  name: string,
  zones: ZoneInput[],
): AhuInput => ({
  id,
  name,
  type: 'multizone',
  psAuto: true,
  ps: 0,
  vpsAuto: true,
  vps: 0,
  zones,
});

const sampleState = (overrides: Partial<SerializedState> = {}): SerializedState => ({
  schemaVersion: 1,
  ahus: [
    sampleAhu('a1', 'RTU-01', [
      sampleZone('z1', 'TU-1-01', 1000, 10),
      sampleZone('z2', 'TU-1-02', 500, 5),
    ]),
  ],
  activeId: 'a1',
  unitSystem: 'ip',
  ...overrides,
});

describe('snapshots — save / load / list / delete / rename', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveSnapshot returns a snapshot with id, name, createdAt ISO timestamp, and state', () => {
    const before = Date.now();
    const snap = saveSnapshot('v1 for client A', sampleState());
    const after = Date.now();

    expect(snap.id).toMatch(/^[0-9a-f-]{36}$/); // uuid-shaped
    expect(snap.name).toBe('v1 for client A');
    // ISO timestamp — parseable + within the test window
    const t = Date.parse(snap.createdAt);
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
    expect(snap.state.ahus).toHaveLength(1);
    expect(snap.state.activeId).toBe('a1');
  });

  it('saveSnapshot persists to localStorage under the versioned key', () => {
    saveSnapshot('persisted', sampleState());
    const raw = localStorage.getItem('fse.vent.snapshots.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('persisted');
  });

  it('listSnapshots returns empty array initially', () => {
    expect(listSnapshots()).toEqual([]);
  });

  it('listSnapshots returns saved snapshots sorted newest-first', () => {
    // Use vitest fake timers to control createdAt deterministically —
    // we can't trust Date.now resolution to differ between back-to-back
    // saveSnapshot calls in a fast test runner.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T12:00:00.000Z'));
    const a = saveSnapshot('alpha', sampleState());
    vi.setSystemTime(new Date('2026-06-27T12:00:05.000Z'));
    const b = saveSnapshot('beta', sampleState());
    vi.useRealTimers();

    const ordered = listSnapshots();
    // Newest (beta, t+5s) first; oldest (alpha, t+0s) second.
    expect(ordered.map((s) => s.name)).toEqual(['beta', 'alpha']);
    expect(ordered[0].id).toBe(b.id);
    expect(ordered[1].id).toBe(a.id);
  });

  it('loadSnapshot returns the saved snapshot by id with the full state intact', () => {
    const state = sampleState();
    const saved = saveSnapshot('round-trip', state);
    const loaded = loadSnapshot(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(saved.id);
    expect(loaded!.name).toBe('round-trip');
    expect(loaded!.state.ahus[0].zones[0].area).toBe(1000);
    expect(loaded!.state.unitSystem).toBe('ip');
  });

  it('loadSnapshot returns null for an unknown id', () => {
    expect(loadSnapshot('not-a-real-id')).toBeNull();
  });

  it('deleteSnapshot removes it from the list and returns null on subsequent load', () => {
    const a = saveSnapshot('delete-me', sampleState());
    expect(listSnapshots()).toHaveLength(1);
    deleteSnapshot(a.id);
    expect(listSnapshots()).toHaveLength(0);
    expect(loadSnapshot(a.id)).toBeNull();
  });

  it('deleteSnapshot on an unknown id is a no-op', () => {
    saveSnapshot('keep-me', sampleState());
    deleteSnapshot('not-a-real-id');
    expect(listSnapshots()).toHaveLength(1);
  });

  it('renameSnapshot updates the name without changing createdAt or id', () => {
    const saved = saveSnapshot('old name', sampleState());
    const originalCreatedAt = saved.createdAt;
    renameSnapshot(saved.id, 'new name');
    const reloaded = loadSnapshot(saved.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.name).toBe('new name');
    expect(reloaded!.id).toBe(saved.id);
    expect(reloaded!.createdAt).toBe(originalCreatedAt);
  });

  it('renameSnapshot on an unknown id is a no-op', () => {
    saveSnapshot('only one', sampleState());
    renameSnapshot('not-a-real-id', 'whatever');
    expect(listSnapshots()[0].name).toBe('only one');
  });

  it('trims whitespace from the name at save time and falls back to "Untitled" on empty input', () => {
    const a = saveSnapshot('   spaced name   ', sampleState());
    expect(a.name).toBe('spaced name');

    const b = saveSnapshot('   ', sampleState());
    expect(b.name).toBe('Untitled snapshot');

    // Also covers rename with whitespace
    renameSnapshot(a.id, '   ');
    expect(loadSnapshot(a.id)?.name).toBe('Untitled snapshot');
  });

  it('survives corrupt JSON in localStorage by returning empty list', () => {
    localStorage.setItem('fse.vent.snapshots.v1', '{not json');
    expect(listSnapshots()).toEqual([]);
  });

  it('survives a non-array payload by returning empty list', () => {
    localStorage.setItem('fse.vent.snapshots.v1', JSON.stringify({ not: 'array' }));
    expect(listSnapshots()).toEqual([]);
  });

  it('survives a missing key by returning empty list', () => {
    expect(localStorage.getItem('fse.vent.snapshots.v1')).toBeNull();
    expect(listSnapshots()).toEqual([]);
  });

  it('saveSnapshot does not throw when localStorage.setItem throws', () => {
    // Block writes via instance override — simulates Safari private mode
    // or quota-exceeded.
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    try {
      // Caller still gets a valid snapshot handle — UI can use it
      // immediately even if persistence failed.
      expect(() => saveSnapshot('blocked', sampleState())).not.toThrow();
      const snap = saveSnapshot('blocked-2', sampleState());
      expect(snap.name).toBe('blocked-2');
      expect(snap.id).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });
});

describe('snapshots — summarizeSnapshot', () => {
  it('returns a human-readable summary for a multi-AHU, multi-zone state', () => {
    const s = sampleState({
      ahus: [
        sampleAhu('a1', 'RTU-01', [
          sampleZone('z1', 'TU-1-01', 1000, 10),
          sampleZone('z2', 'TU-1-02', 500, 5),
        ]),
        sampleAhu('a2', 'DOAS-01', [
          { ...sampleZone('z3', 'RM-01', 800, 8), area: 800, pop: 8 },
        ]),
      ],
      activeId: 'a1',
    });
    const summary = summarizeSnapshot(s);
    // 2 AHUs, 3 zones total, Vot = sum of Vot for both AHUs (office space).
    // The exact Vot value depends on the math core (compute()) — we assert
    // the human-readable shape here, not the number itself.
    expect(summary).toMatch(/^2 AHUs, 3 zones total, Vot=\d+(\.\d+)? cfm$/);
  });

  it('handles empty / zero-AHU state gracefully', () => {
    const summary = summarizeSnapshot({
      schemaVersion: 1,
      ahus: [],
      activeId: '',
      unitSystem: 'ip',
    });
    expect(summary).toBe('0 AHUs, 0 zones total, Vot=0 cfm');
  });

  it('produces a singular form when there is exactly 1 AHU', () => {
    const summary = summarizeSnapshot({
      schemaVersion: 1,
      ahus: [
        sampleAhu('a1', 'RTU-01', [sampleZone('z1', 'TU-1-01', 0, 0)]),
      ],
      activeId: 'a1',
      unitSystem: 'ip',
    });
    expect(summary).toMatch(/^1 AHU, /);
  });

  it('sums Vot across multiple AHUs (multizone + singlezone)', () => {
    // Both AHUs use Office space → Rp=5, Ra=0.06, Ez=1.
    // RTU-01 (multizone Appendix A, default seed): psAuto=true → ps=Σpop=15.
    //   Vou = D·Σ(Pz·Rp) + Σ(Az·Ra) = 1·(15·5) + (1500·0.06) = 75 + 90 = 165 cfm.
    //   vpsAuto=true → vps=ΣVpz=0 → Xs=Infinity → Appendix A selects critical Evz path.
    //   With default zones (vpz=0 everywhere), Zd=Zpz=0 everywhere → Evz=1 for all
    //   zones → Ev=1 → Vot=Vou=165.
    // DOAS-01 (singlezone, area 1000, pop 10):
    //   Vbz = 5·10 + 0.06·1000 = 110, Voz = 110 (Ez=1), Vot = Voz = 110 (Ev=1).
    // Total Vot = 165 + 110 = 275 cfm.
    const s = sampleState({
      ahus: [
        sampleAhu('a1', 'RTU-01', [
          sampleZone('z1', 'TU-1-01', 1000, 10),
          sampleZone('z2', 'TU-1-02', 500, 5),
        ]),
        sampleAhu('a2', 'DOAS-01', [sampleZone('z3', 'RM-01', 1000, 10)]),
      ],
      activeId: 'a1',
    });
    const summary = summarizeSnapshot(s);
    expect(summary).toBe('2 AHUs, 3 zones total, Vot=275 cfm');
  });
});
