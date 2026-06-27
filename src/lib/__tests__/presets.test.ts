/**
 * Tests for the preset loader (`src/lib/presets.ts`).
 *
 * Invariants:
 *   1. Every occupancy category in `OCCUPANCY_CATEGORIES` has a preset entry.
 *   2. Each preset's Rp / Ra match the ASHRAE Table 6-1 values (within fp epsilon).
 *   3. Each preset has a non-empty spaceType, a category, and reasonable defaults
 *      (area ≥ 0, pop ≥ 0, Ez in [0.5, 1.0]).
 *   4. `applyPreset()` mutates the zone fields (area, pop, ezConfig, space) and
 *      keeps zone.id intact; if the zone has rooms, rooms are rebalanced to
 *      sum to the new zone area/pop.
 *   5. `searchPresets()` filters by case-insensitive substring across spaceType
 *      and category name.
 *   6. `groupPresets()` produces groups matching ASHRAE 62.1-2022 Table 6-3
 *      canonical groupings (Educational Facilities, Healthcare, Office, Retail,
 *      Public Assembly, Residential, Food Service, Industrial/General).
 */
import { describe, it, expect } from 'vitest';
import { OCCUPANCY_CATEGORIES } from '../tables';
import {
  PRESETS,
  applyPreset,
  getPresetById,
  groupPresets,
  searchPresets,
  type Preset,
} from '../presets';
import type { ZoneInput, RoomInput } from '../ashrae621';

describe('PRESETS — coverage', () => {
  it('has an entry for every Table 6-1 occupancy category', () => {
    const catKeys = Object.keys(OCCUPANCY_CATEGORIES);
    // Filter out the Python-source alias 'Conference/meeting' — it is a
    // duplicate of 'Conference / meeting' used only for cross-engine parity.
    const nonAliasKeys = catKeys.filter((k) => k !== 'Conference/meeting');
    const presetSpaceTypes = new Set(PRESETS.map((p) => p.spaceType));
    const missing = nonAliasKeys.filter((k) => !presetSpaceTypes.has(k));
    expect(missing).toEqual([]);
  });

  it('every preset has Rp / Ra matching OCCUPANCY_CATEGORIES', () => {
    for (const p of PRESETS) {
      const expected = OCCUPANCY_CATEGORIES[p.spaceType];
      expect(expected, `missing Table 6-1 row for ${p.spaceType}`).toBeDefined();
      const [expRp, expRa] = expected as readonly [number, number];
      expect(p.rp).toBeCloseTo(expRp, 6);
      expect(p.ra).toBeCloseTo(expRa, 6);
    }
  });

  it('every preset has reasonable defaults', () => {
    for (const p of PRESETS) {
      expect(p.spaceType.length).toBeGreaterThan(0);
      expect(p.category.length).toBeGreaterThan(0);
      expect(p.defaultArea).toBeGreaterThanOrEqual(0);
      expect(p.defaultPop).toBeGreaterThanOrEqual(0);
      expect(p.defaultEz).toBeGreaterThanOrEqual(0.5);
      expect(p.defaultEz).toBeLessThanOrEqual(1.0);
    }
  });

  it('PRESETS has at least 50 entries (full Table 6-3 coverage)', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(50);
  });
});

describe('searchPresets', () => {
  it('returns matching presets by spaceType substring (case-insensitive)', () => {
    const hits = searchPresets('office');
    expect(hits.length).toBeGreaterThan(0);
    // Matches spaceType OR category; the case-insensitive substring "office"
    // hits spaceType "Office space" and category "Office Spaces".
    expect(
      hits.every((p) => /office/i.test(p.spaceType) || /office/i.test(p.category)),
    ).toBe(true);
    // And specifically — we should have the canonical "Office space" row.
    expect(hits.some((p) => p.spaceType === 'Office space')).toBe(true);
  });

  it('matches by category name', () => {
    const hits = searchPresets('healthcare');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((p) => /healthcare/i.test(p.category))).toBe(true);
  });

  it('returns all presets for empty query', () => {
    expect(searchPresets('').length).toBe(PRESETS.length);
  });
});

describe('groupPresets', () => {
  it('groups presets by canonical ASHRAE Table 6-3 categories', () => {
    const groups = groupPresets();
    const groupNames = groups.map((g) => g.category);
    // Spot-check the major ASHRAE 62.1-2022 groupings
    expect(groupNames).toContain('Office Spaces');
    expect(groupNames).toContain('Educational Facilities');
    expect(groupNames).toContain('Retail');
    expect(groupNames).toContain('Food Service');
    expect(groupNames).toContain('Healthcare');
    expect(groupNames).toContain('Public Assembly');
    expect(groupNames).toContain('Residential');
    expect(groupNames).toContain('Industrial / General');
  });

  it('every preset appears in exactly one group', () => {
    const groups = groupPresets();
    const total = groups.reduce((acc, g) => acc + g.rows.length, 0);
    expect(total).toBe(PRESETS.length);
  });
});

describe('getPresetById', () => {
  it('returns the matching preset by id', () => {
    const first = PRESETS[0];
    expect(getPresetById(first.id)).toBe(first);
  });

  it('returns undefined for unknown id', () => {
    expect(getPresetById('nope-not-real')).toBeUndefined();
  });
});

describe('applyPreset', () => {
  function makeZone(): ZoneInput {
    return {
      id: 'z-test',
      tag: 'TU-99',
      space: 'Office space',
      area: 100,
      pop: 5,
      vpz: 600,
      vdz: 600,
      vdzm: 200,
      ezConfig: 'Ceiling supply of cool air',
      box: 'single',
      er: 0,
    };
  }

  it('sets space, area, pop, ezConfig from preset', () => {
    const z = makeZone();
    const p: Preset = PRESETS.find((x) => x.spaceType === 'Office space')!;
    const next = applyPreset(z, p);
    expect(next.id).toBe('z-test');
    expect(next.space).toBe('Office space');
    expect(next.area).toBe(p.defaultArea);
    expect(next.pop).toBe(p.defaultPop);
    expect(next.ezConfig).toBeTruthy();
    // Box, vpz/vdz are preserved (preset does NOT touch airflow — that's
    // a design input, not a default).
    expect(next.box).toBe('single');
    expect(next.vpz).toBe(600);
  });

  it('keeps zone.id intact', () => {
    const z = makeZone();
    const p = PRESETS[0];
    expect(applyPreset(z, p).id).toBe(z.id);
  });

  it('rebalances rooms so Σ(rooms).area equals new zone area', () => {
    const z = makeZone();
    z.rooms = [
      { id: 'r1', tag: 'R1', space: 'Office space', area: 50, pop: 2, vpz: 150, ezConfig: 'Ceiling supply of cool air' },
      { id: 'r2', tag: 'R2', space: 'Office space', area: 50, pop: 3, vpz: 150, ezConfig: 'Ceiling supply of cool air' },
    ];
    const p: Preset = {
      id: 'test-rebal',
      category: 'Office Spaces',
      spaceType: 'Office space',
      defaultArea: 1000,
      defaultPop: 20,
      defaultEz: 1.0,
      rp: 5,
      ra: 0.06,
    };
    const next = applyPreset(z, p);
    expect(next.rooms).toBeDefined();
    const sumArea = next.rooms!.reduce((acc, r) => acc + r.area, 0);
    const sumPop = next.rooms!.reduce((acc, r) => acc + r.pop, 0);
    expect(sumArea).toBeCloseTo(1000, 1);
    expect(sumPop).toBeCloseTo(20, 1);
  });

  it('when zone has no rooms, leaves rooms undefined', () => {
    const z = makeZone();
    const p = PRESETS[0];
    const next = applyPreset(z, p);
    expect(next.rooms).toBeUndefined();
  });

  it('applies to a single-room zone (rebalance N=1)', () => {
    const z = makeZone();
    const r: RoomInput = {
      id: 'r1',
      tag: 'R1',
      space: 'Office space',
      area: 100,
      pop: 5,
      vpz: 150,
      ezConfig: 'Ceiling supply of cool air',
    };
    z.rooms = [r];
    const p: Preset = {
      id: 'test-1room',
      category: 'Office Spaces',
      spaceType: 'Office space',
      defaultArea: 800,
      defaultPop: 12,
      defaultEz: 1.0,
      rp: 5,
      ra: 0.06,
    };
    const next = applyPreset(z, p);
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms![0].area).toBe(800);
    expect(next.rooms![0].pop).toBe(12);
  });
});