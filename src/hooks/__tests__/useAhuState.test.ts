/**
 * Tests for the multi-AHU / multi-zone / multi-room UI state machine
 * (useAhuState hook). These verify that the state transitions used by the
 * UI controls (add/remove unit, add/remove zone, add/remove room, switch
 * active AHU, reset zones) match the v1.0.0 offline bundle's behavior.
 *
 * We exercise the hook indirectly via @testing-library/react's renderHook
 * to make sure React state updates actually fire (not just a pure function).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAhuState } from '../useAhuState';

describe('useAhuState', () => {
  it('seeds with one multizone AHU named RTU-01 with two empty zones', () => {
    const { result } = renderHook(() => useAhuState());
    expect(result.current.ahus).toHaveLength(1);
    const a = result.current.ahus[0];
    expect(a.name).toBe('RTU-01');
    expect(a.type).toBe('multizone');
    expect(a.method).toBe('appendixA');
    expect(a.zones).toHaveLength(2);
    expect(a.zones[0].tag).toBe('TU-1-01');
    expect(a.zones[1].tag).toBe('TU-1-02');
    expect(result.current.activeId).toBe(a.id);
  });

  it('addZone appends a zone with a TU-NN tag', () => {
    const { result } = renderHook(() => useAhuState());
    act(() => result.current.addZone());
    expect(result.current.ahu.zones).toHaveLength(3);
    expect(result.current.ahu.zones[2].tag).toBe('TU-03');
  });

  it('removeZone drops the matching zone by id', () => {
    const { result } = renderHook(() => useAhuState());
    const id = result.current.ahu.zones[0].id;
    act(() => result.current.removeZone(id));
    expect(result.current.ahu.zones).toHaveLength(1);
    expect(result.current.ahu.zones[0].tag).toBe('TU-1-02');
  });

  it('patchZone updates only the targeted zone', () => {
    const { result } = renderHook(() => useAhuState());
    const id = result.current.ahu.zones[0].id;
    act(() => result.current.patchZone(id, { area: 1234 }));
    expect(result.current.ahu.zones[0].area).toBe(1234);
    expect(result.current.ahu.zones[1].area).toBe(0);
  });

  it('addUnit(multizone) creates RTU-NN, increments type count, and activates it', () => {
    const { result } = renderHook(() => useAhuState());
    act(() => result.current.addUnit('multizone'));
    expect(result.current.ahus).toHaveLength(2);
    const added = result.current.ahus[1];
    expect(added.name).toBe('RTU-02');
    expect(added.type).toBe('multizone');
    expect(result.current.activeId).toBe(added.id);
  });

  it('addUnit(singlezone) creates DOAS-01, separate numbering by type', () => {
    const { result } = renderHook(() => useAhuState());
    act(() => result.current.addUnit('singlezone'));
    const added = result.current.ahus[1];
    expect(added.name).toBe('DOAS-01');
    expect(added.type).toBe('singlezone');
    // Single-zone seed has exactly 1 zone with tag RM-01
    expect(added.zones).toHaveLength(1);
    expect(added.zones[0].tag).toBe('RM-01');
  });

  it('removeUnit refuses to remove the last AHU', () => {
    const { result } = renderHook(() => useAhuState());
    const id = result.current.ahus[0].id!;
    act(() => result.current.removeUnit(id));
    expect(result.current.ahus).toHaveLength(1);
  });

  it('removeUnit switches activeId when removing the active AHU', () => {
    const { result } = renderHook(() => useAhuState());
    let addedId = '';
    act(() => {
      addedId = result.current.addUnit('multizone');
    });
    expect(result.current.activeId).toBe(addedId);
    act(() => result.current.removeUnit(addedId));
    // Falls back to the original AHU
    expect(result.current.ahus).toHaveLength(1);
    expect(result.current.activeId).toBe(result.current.ahus[0].id);
  });

  it('setActive switches the active AHU and isolates state', () => {
    const { result } = renderHook(() => useAhuState());
    let firstId = '';
    let secondId = '';
    act(() => {
      firstId = result.current.ahu.id!;
      secondId = result.current.addUnit('singlezone');
    });
    act(() => result.current.setActive(firstId));
    expect(result.current.activeId).toBe(firstId);
    expect(result.current.ahu.type).toBe('multizone');

    // Patching active should NOT bleed into the singlezone AHU
    act(() => result.current.patchZone(result.current.ahu.zones[0].id, { area: 999 }));
    expect(result.current.ahu.zones[0].area).toBe(999);

    act(() => result.current.setActive(secondId));
    const second = result.current.ahus.find((a: { id?: string }) => a.id === secondId)!;
    // Second AHU's only zone is unedited
    expect(second.zones[0].area).toBe(800); // singlezone seed default
  });

  it('resetZones restores the type-appropriate seed', () => {
    const { result } = renderHook(() => useAhuState());
    act(() => result.current.addZone());
    act(() => result.current.removeZone(result.current.ahu.zones[0].id));
    expect(result.current.ahu.zones).toHaveLength(2);
    act(() => result.current.resetZones());
    expect(result.current.ahu.zones[0].tag).toBe('TU-1-01');
    expect(result.current.ahu.zones[1].tag).toBe('TU-1-02');
  });

  it('addRoom / removeRoom operate on a specific zone', () => {
    const { result } = renderHook(() => useAhuState());
    // Opt in via roomsEnabled and add a room to the first zone.
    act(() => result.current.patch({ roomsEnabled: true }));
    const zoneId = result.current.ahu.zones[0].id;
    act(() => result.current.addRoom(zoneId));
    act(() => result.current.addRoom(zoneId));
    expect(result.current.ahu.zones[0].rooms).toHaveLength(2);
    const r0 = result.current.ahu.zones[0].rooms![0].id;
    act(() => result.current.removeRoom(zoneId, r0));
    expect(result.current.ahu.zones[0].rooms).toHaveLength(1);
    // Second zone untouched
    expect(result.current.ahu.zones[1].rooms ?? []).toHaveLength(0);
  });

  it('patch updates top-level AHU fields', () => {
    const { result } = renderHook(() => useAhuState());
    act(() => result.current.patch({ name: 'RTU-NORTH', condition: 'Heating' }));
    expect(result.current.ahu.name).toBe('RTU-NORTH');
    expect(result.current.ahu.condition).toBe('Heating');
  });

  it('renameAhu updates the name of any AHU by id, not just the active one', () => {
    const { result } = renderHook(() => useAhuState());
    const firstId = result.current.ahus[0].id!;
    let secondId = '';
    act(() => {
      secondId = result.current.addUnit('singlezone');
    });
    // Rename the FIRST AHU even though active is the new one
    act(() => result.current.renameAhu(firstId, 'RTU-NORTH'));
    const first = result.current.ahus.find((a) => a.id === firstId)!;
    const second = result.current.ahus.find((a) => a.id === secondId)!;
    expect(first.name).toBe('RTU-NORTH');
    expect(second.name).toBe('DOAS-01'); // unchanged
  });

  it('renameAhu is a no-op for an unknown id', () => {
    const { result } = renderHook(() => useAhuState());
    const before = result.current.ahu.name;
    act(() => result.current.renameAhu('a-not-real', 'whatever'));
    expect(result.current.ahu.name).toBe(before);
  });

  it('renameAhu preserves the active AHU', () => {
    const { result } = renderHook(() => useAhuState());
    const activeBefore = result.current.activeId;
    act(() => result.current.renameAhu(result.current.ahus[0].id!, 'RTU-WEST'));
    expect(result.current.activeId).toBe(activeBefore);
    expect(result.current.ahu.name).toBe('RTU-WEST');
  });

  it('reorderZones reshuffles zones by id within the active AHU', () => {
    const { result } = renderHook(() => useAhuState());
    // Seed: [TU-1-01, TU-1-02]. Capture the original zone ids.
    const z1 = result.current.ahu.zones[0];
    const z2 = result.current.ahu.zones[1];
    expect(z1.tag).toBe('TU-1-01');
    expect(z2.tag).toBe('TU-1-02');

    // Reorder to [z2, z1]
    act(() => result.current.reorderZones([z2.id, z1.id]));
    expect(result.current.ahu.zones.map((z) => z.id)).toEqual([z2.id, z1.id]);
    // Tags follow their zones (preserved object identity, not re-tagged)
    expect(result.current.ahu.zones[0].tag).toBe('TU-1-02');
    expect(result.current.ahu.zones[1].tag).toBe('TU-1-01');
  });

  it('reorderZones preserves every zone field — only display order changes', () => {
    const { result } = renderHook(() => useAhuState());
    // Set distinct values on each zone so we can prove nothing mutates
    act(() =>
      result.current.patchZone(result.current.ahu.zones[0].id, {
        area: 1000,
        pop: 10,
        vpz: 150,
      }),
    );
    act(() =>
      result.current.patchZone(result.current.ahu.zones[1].id, {
        area: 500,
        pop: 5,
        vpz: 200,
      }),
    );
    const z1 = result.current.ahu.zones[0];
    const z2 = result.current.ahu.zones[1];

    // Swap them
    act(() => result.current.reorderZones([z2.id, z1.id]));

    // Same zone objects, same data — just in the new order
    expect(result.current.ahu.zones[0].area).toBe(500);
    expect(result.current.ahu.zones[0].pop).toBe(5);
    expect(result.current.ahu.zones[0].vpz).toBe(200);
    expect(result.current.ahu.zones[1].area).toBe(1000);
    expect(result.current.ahu.zones[1].pop).toBe(10);
    expect(result.current.ahu.zones[1].vpz).toBe(150);
  });

  it('reorderZones silently drops unknown zone ids', () => {
    const { result } = renderHook(() => useAhuState());
    const z1 = result.current.ahu.zones[0];
    const z2 = result.current.ahu.zones[1];
    // First slot is garbage; second slot is real. Result should be [z2, z1].
    act(() => result.current.reorderZones(['z-not-real', z2.id, z1.id]));
    expect(result.current.ahu.zones.map((z) => z.id)).toEqual([z2.id, z1.id]);
  });

  it('reorderZones appends zones omitted from newOrder at the end', () => {
    const { result } = renderHook(() => useAhuState());
    const z1 = result.current.ahu.zones[0];
    const z2 = result.current.ahu.zones[1];
    // Pass only z2; z1 should still appear at the end (preserved).
    act(() => result.current.reorderZones([z2.id]));
    expect(result.current.ahu.zones.map((z) => z.id)).toEqual([z2.id, z1.id]);
  });
});

describe('useAhuState — unitSystem persistence', () => {
  // The unit toggle is a global UI preference (like theme). It must
  // survive a page reload so an engineer who set SI doesn't have to
  // flip it back every time. Backed by localStorage with a versioned
  // key (`fse.vent.units.v1`).

  const KEY = 'fse.vent.units.v1';

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults unitSystem to "ip" when localStorage is empty', () => {
    const { result } = renderHook(() => useAhuState());
    expect(result.current.unitSystem).toBe('ip');
  });

  it('reads unitSystem from localStorage on mount', () => {
    window.localStorage.setItem(KEY, 'si');
    const { result } = renderHook(() => useAhuState());
    expect(result.current.unitSystem).toBe('si');
  });

  it('falls back to "ip" when localStorage has an unknown value', () => {
    // Tolerate stale / corrupted entries (e.g. someone wrote 'metric'
    // by hand, or a previous version used a different scheme).
    window.localStorage.setItem(KEY, 'metric');
    const { result } = renderHook(() => useAhuState());
    expect(result.current.unitSystem).toBe('ip');
  });

  it('setUnitSystem persists to localStorage', () => {
    const { result } = renderHook(() => useAhuState());
    act(() => result.current.setUnitSystem('si'));
    expect(result.current.unitSystem).toBe('si');
    expect(window.localStorage.getItem(KEY)).toBe('si');
    act(() => result.current.setUnitSystem('ip'));
    expect(window.localStorage.getItem(KEY)).toBe('ip');
  });

  it('tolerates blocked localStorage on write (e.g. private mode)', () => {
    const { result } = renderHook(() => useAhuState());
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Should NOT throw — the toggle still flips in-memory state.
    expect(() => act(() => result.current.setUnitSystem('si'))).not.toThrow();
    expect(result.current.unitSystem).toBe('si');
    setItemSpy.mockRestore();
  });
});
