import { useCallback, useState } from 'react';
import type { AhuInput, RoomInput, ZoneInput } from '../lib/ashrae621';
import type { Units } from '../lib/units';

/** localStorage key for the unit-system preference. Versioned (`v1`)
 *  so future schema changes can migrate without colliding with stale
 *  values from older deploys. */
const UNITS_STORAGE_KEY = 'fse.vent.units.v1';

/** Read the unit-system preference from localStorage. Tolerates blocked
 *  storage (private mode, file://) by falling back to the default. */
function readUnitsFromStorage(): Units {
  if (typeof window === 'undefined') return 'ip';
  try {
    const v = window.localStorage.getItem(UNITS_STORAGE_KEY);
    return v === 'si' || v === 'ip' ? v : 'ip';
  } catch {
    return 'ip';
  }
}

/** Write the unit-system preference to localStorage. Best-effort — private
 *  mode / quota errors are swallowed silently so the in-memory toggle still
 *  works for the session. */
function writeUnitsToStorage(u: Units): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UNITS_STORAGE_KEY, u);
  } catch {
    // localStorage may be blocked (private mode, file://); ignore.
  }
}

/** Module-scope id counters so keys stay unique across remounts / hook instances. */
let _zoneIdCounter = 1000;
let _roomIdCounter = 1000;
let _ahuIdCounter = 10;
const nextZoneId = (): string => `z${++_zoneIdCounter}`;
const nextRoomId = (): string => `r${++_roomIdCounter}`;
const nextAhuId = (): string => `a${++_ahuIdCounter}`;

// ----------------------------------------------------------------------------
// Factories (preserve v1.0.0 defaults so behavior matches the offline bundle)
// ----------------------------------------------------------------------------

/** Two empty office TUs — multizone unit seed. */
function makeMultiZoneSeed(): ZoneInput[] {
  return [
    {
      id: nextZoneId(),
      tag: 'TU-1-01',
      space: 'Office space',
      area: 0,
      pop: 0,
      vpz: 0,
      vdz: 0,
      vdzm: 0,
      ezConfig: 'Ceiling supply of cool air',
      box: 'single',
      er: 0,
    },
    {
      id: nextZoneId(),
      tag: 'TU-1-02',
      space: 'Office space',
      area: 0,
      pop: 0,
      vpz: 0,
      vdz: 0,
      vdzm: 0,
      ezConfig: 'Ceiling supply of cool air',
      box: 'single',
      er: 0,
    },
  ];
}

/** One DOAS room — singlezone unit seed. */
function makeSingleZoneSeed(): ZoneInput[] {
  return [
    {
      id: nextZoneId(),
      tag: 'RM-01',
      space: 'Office space',
      area: 800,
      pop: 8,
      vpz: 0,
      vdz: 0,
      vdzm: 0,
      ezConfig: 'Ceiling supply of cool air',
      box: 'single',
      er: 0,
    },
  ];
}

/** One room seed for the room-within-zone view.
 *  Uses the zone's area/pop as the starting values; the caller is
 *  responsible for redistributing across all rooms after this. */
function makeRoomSeed(zoneTag: string, idx: number, area = 250, pop = 2): RoomInput {
  return {
    id: nextRoomId(),
    tag: `${zoneTag}-R${String(idx + 1).padStart(2, '0')}`,
    space: 'Office space',
    area,
    pop,
    vpz: 150,
    ezConfig: 'Ceiling supply of cool air',
  };
}

/** First/seed AHU — matches v1.0.0 constructor. */
function makeSeedAhu(): AhuInput {
  return {
    id: 'a1',
    name: 'RTU-01',
    condition: 'Cooling — design',
    type: 'multizone',
    method: 'appendixA',
    simplifiedMethod: 'table6-3',
    psAuto: true,
    ps: 0,
    vpsAuto: false,
    vps: 0,
    zones: makeMultiZoneSeed(),
  };
}

function defaultZoneFor(type: AhuInput['type']): ZoneInput[] {
  return type === 'singlezone' ? makeSingleZoneSeed() : makeMultiZoneSeed();
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export interface AhuStateApi {
  /** All AHUs (multizone RTUs and singlezone DOAS). */
  ahus: AhuInput[];
  /** Currently active AHU id. */
  activeId: string;
  /** The active AHU (resolves activeId; falls back to first). */
  ahu: AhuInput;
  /**
   * Active unit system for display. Lives at the root of the state tree
   * (NOT per-AHU) — it's a global UI preference, like theme. Math core
   * always operates in I-P canonical (cfm, ft²); this field only drives
   * the display/format layer.
   */
  unitSystem: Units;
  /** Update the active unit system. */
  setUnitSystem: (u: Units) => void;
  /** Replace the active AHU entirely (rare; for deserialization). */
  replace: (next: AhuInput) => void;
  /** Shallow-patch the active AHU. */
  patch: (partial: Partial<AhuInput>) => void;
  /** Patch a zone within the active AHU by id. */
  patchZone: (id: string, partial: Partial<ZoneInput>) => void;
  /** Append a new zone to the active AHU (matches v1.0.0 `addZone`). */
  addZone: () => void;
  /** Remove a zone from the active AHU (matches v1.0.0 `removeZone`). */
  removeZone: (id: string) => void;
  /** Restore the two-zone (or single-zone) seed for the active AHU. */
  resetZones: () => void;
  /** Patch a room within a zone of the active AHU. */
  patchRoom: (zid: string, rid: string, partial: Partial<RoomInput>) => void;
  /** Append a room to a zone of the active AHU. */
  addRoom: (zid: string) => void;
  /** Remove a room from a zone of the active AHU. */
  removeRoom: (zid: string, rid: string) => void;
  /** Add a new unit (multizone or singlezone). Auto-numbers by type and activates it. */
  addUnit: (type: AhuInput['type']) => string;
  /** Remove a unit by id. Refuses to remove the last one. */
  removeUnit: (id: string) => void;
  /** Switch the active AHU. */
  setActive: (id: string) => void;
  /** Rename any AHU by id (no-op if id is unknown). Does not change activeId. */
  renameAhu: (id: string, name: string) => void;
  /**
   * Reorder zones within the active AHU. `newOrder` is an array of zone
   * ids in the desired order. Any zone ids not present in the array keep
   * their relative position at the end; ids that don't exist in the AHU
   * are ignored. No-op when called with an unknown active AHU id.
   *
   * Zone objects are preserved by reference (tags, area, pop, rooms, …)
   * — only display order changes. `compute()` results are invariant
   * because the math core doesn't depend on iteration order.
   */
  reorderZones: (newOrder: string[]) => void;
}

export function useAhuState(): AhuStateApi {
  const [ahus, setAhus] = useState<AhuInput[]>(() => [makeSeedAhu()]);
  const [activeId, setActiveId] = useState<string>('a1');
  const [unitSystem, setUnitSystemState] = useState<Units>(() => readUnitsFromStorage());

  const ahu = ahus.find((a) => a.id === activeId) ?? ahus[0];

  const replaceActive = useCallback(
    (next: AhuInput) => {
      setAhus((prev) => prev.map((a) => (a.id === activeId ? { ...next, id: activeId } : a)));
    },
    [activeId],
  );

  const patchActive = useCallback(
    (partial: Partial<AhuInput>) => {
      setAhus((prev) => prev.map((a) => (a.id === activeId ? { ...a, ...partial } : a)));
    },
    [activeId],
  );

  const patchZone = useCallback(
    (id: string, partial: Partial<ZoneInput>) => {
      setAhus((prev) =>
        prev.map((a) => {
          if (a.id !== activeId) return a;
          return {
            ...a,
            zones: a.zones.map((z) => (z.id === id ? { ...z, ...partial } : z)),
          };
        }),
      );
    },
    [activeId],
  );

  const addZone = useCallback(() => {
    setAhus((prev) =>
      prev.map((a) => {
        if (a.id !== activeId) return a;
        const tag = `TU-${String(a.zones.length + 1).padStart(2, '0')}`;
        return {
          ...a,
          zones: [
            ...a.zones,
            {
              id: nextZoneId(),
              tag,
              space: 'Office space',
              area: 500,
              pop: 5,
              vpz: 600,
              vdz: 600,
              vdzm: 200,
              ezConfig: 'Ceiling supply of cool air',
              box: 'single' as const,
              er: 0,
            },
          ],
        };
      }),
    );
  }, [activeId]);

  const removeZone = useCallback(
    (id: string) => {
      setAhus((prev) =>
        prev.map((a) =>
          a.id !== activeId ? a : { ...a, zones: a.zones.filter((z) => z.id !== id) },
        ),
      );
    },
    [activeId],
  );

  const resetZones = useCallback(() => {
    setAhus((prev) =>
      prev.map((a) => (a.id !== activeId ? a : { ...a, zones: defaultZoneFor(a.type) })),
    );
  }, [activeId]);

  const patchRoom = useCallback(
    (zid: string, rid: string, partial: Partial<RoomInput>) => {
      setAhus((prev) =>
        prev.map((a) => {
          if (a.id !== activeId) return a;
          return {
            ...a,
            zones: a.zones.map((z) => {
              if (z.id !== zid) return z;
              const rooms = z.rooms ?? [];
              return {
                ...z,
                rooms: rooms.map((r) => (r.id === rid ? { ...r, ...partial } : r)),
              };
            }),
          };
        }),
      );
    },
    [activeId],
  );

  const addRoom = useCallback(
    (zid: string) => {
      setAhus((prev) =>
        prev.map((a) => {
          if (a.id !== activeId) return a;
          return {
            ...a,
            zones: a.zones.map((z) => {
              if (z.id !== zid) return z;
              const existing = z.rooms ?? [];
              const idx = existing.length;
              // Add a placeholder room, then redistribute area/pop equally
              // across existing + new so Σ(rooms) = z.area / z.pop.
              const provisional = [
                ...existing,
                makeRoomSeed(z.tag ?? `Z${idx + 1}`, idx, z.area ?? 0, z.pop ?? 0),
              ];
              const redistributed = redistributeRooms(provisional, z);
              return { ...z, rooms: redistributed };
            }),
          };
        }),
      );
    },
    [activeId],
  );

  const removeRoom = useCallback(
    (zid: string, rid: string) => {
      setAhus((prev) =>
        prev.map((a) => {
          if (a.id !== activeId) return a;
          return {
            ...a,
            zones: a.zones.map((z) => {
              if (z.id !== zid) return z;
              const surviving = (z.rooms ?? []).filter((r) => r.id !== rid);
              // Redistribute the remaining rooms so Σ(rooms) stays equal
              // to z.area / z.pop. When the last room is removed, the
              // zone reverts to using its own area/pop directly.
              const redistributed = redistributeRooms(surviving, z);
              return { ...z, rooms: redistributed };
            }),
          };
        }),
      );
    },
    [activeId],
  );

  const addUnit = useCallback((type: AhuInput['type']): string => {
    const id = nextAhuId();
    setAhus((prev) => {
      const sameTypeCount = prev.filter((a) => a.type === type).length;
      const prefix = type === 'singlezone' ? 'DOAS' : 'RTU';
      const name = `${prefix}-${String(sameTypeCount + 1).padStart(2, '0')}`;
      const next: AhuInput = {
        id,
        name,
        condition: 'Cooling — design',
        type,
        method: type === 'singlezone' ? undefined : 'appendixA',
        simplifiedMethod: 'table6-3',
        psAuto: true,
        ps: type === 'singlezone' ? 0 : 5,
        vpsAuto: false,
        vps: 0,
        zones: defaultZoneFor(type),
      };
      return [...prev, next];
    });
    setActiveId(id);
    return id;
  }, []);

  const removeUnit = useCallback(
    (id: string) => {
      setAhus((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((a) => a.id !== id);
        const firstId = next[0]?.id;
        if (activeId === id && firstId) {
          setActiveId(firstId);
        }
        return next;
      });
    },
    [activeId],
  );

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const renameAhu = useCallback((id: string, name: string) => {
    setAhus((prev) => {
      // No-op if the id doesn't exist — preserves the array reference so
      // React doesn't re-render on a mistyped call.
      if (!prev.some((a) => a.id === id)) return prev;
      return prev.map((a) => (a.id === id ? { ...a, name } : a));
    });
  }, []);

  const setUnitSystem = useCallback((u: Units) => {
    setUnitSystemState(u);
    writeUnitsToStorage(u);
  }, []);

  const reorderZones = useCallback(
    (newOrder: string[]) => {
      setAhus((prev) =>
        prev.map((a) => {
          if (a.id !== activeId) return a;
          const byId = new Map(a.zones.map((z) => [z.id, z] as const));
          // Resolve the requested order against the existing zones. Unknown
          // ids are silently dropped; zones not present in `newOrder` keep
          // their relative position at the end (preserves the "drop into
          // empty list" case without data loss).
          const resolved: ZoneInput[] = [];
          const seen = new Set<string>();
          for (const id of newOrder) {
            const z = byId.get(id);
            if (z && !seen.has(id)) {
              resolved.push(z);
              seen.add(id);
            }
          }
          for (const z of a.zones) {
            if (!seen.has(z.id)) resolved.push(z);
          }
          return { ...a, zones: resolved };
        }),
      );
    },
    [activeId],
  );

  return {
    ahus,
    activeId,
    ahu,
    unitSystem,
    setUnitSystem,
    replace: replaceActive,
    patch: patchActive,
    patchZone,
    addZone,
    removeZone,
    resetZones,
    patchRoom,
    addRoom,
    removeRoom,
    addUnit,
    removeUnit,
    setActive,
    renameAhu,
    reorderZones,
  };
}

/** Re-export factory for tests / consumers that want a fresh seed without a hook. */
export const seedFactory = makeSeedAhu;

// ----------------------------------------------------------------------------
// Room redistribution helpers — preserve zone totals when rooms change.
//
// When a zone has rooms, the math core uses Σ(rooms) for area/pop/flow
// (the "rooms drive TU totals" behavior). To keep the displayed rollup
// in sync with the zone-level area/pop, we redistribute area/pop equally
// across all surviving rooms on every add/remove. This matches the
// "zone level area is maintained" UX the user asked for.
// ----------------------------------------------------------------------------

/** Redistribute area and pop equally across N rooms. Rounded to 1 decimal
 *  for display; total is preserved up to floating-point noise. If `pop` is
 *  not an integer (e.g. after a split), the last room absorbs the remainder. */
function equalSplit(total: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [total];
  const each = Math.floor((total * 10) / n) / 10; // round to 1 dp
  const out: number[] = [];
  let assigned = 0;
  for (let i = 0; i < n - 1; i++) {
    out.push(each);
    assigned += each;
  }
  // Last room absorbs the rounding remainder so total is exact.
  out.push(Math.max(0, +(total - assigned).toFixed(1)));
  return out;
}

function redistributeRooms(rooms: RoomInput[], z: ZoneInput): RoomInput[] {
  if (rooms.length === 0) return rooms;
  const areas = equalSplit(z.area || 0, rooms.length);
  const pops = equalSplit(z.pop || 0, rooms.length);
  return rooms.map((r, i) => ({
    ...r,
    area: areas[i],
    pop: pops[i],
  }));
}
