import { useCallback, useState } from 'react';
import type { AhuInput, RoomInput, ZoneInput } from '../lib/ashrae621';

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

/** One room seed for the room-within-zone view. */
function makeRoomSeed(zoneTag: string, idx: number): RoomInput {
  return {
    id: nextRoomId(),
    tag: `${zoneTag}-R${String(idx + 1).padStart(2, '0')}`,
    space: 'Office space',
    area: 250,
    pop: 2,
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
}

export function useAhuState(): AhuStateApi {
  const [ahus, setAhus] = useState<AhuInput[]>(() => [makeSeedAhu()]);
  const [activeId, setActiveId] = useState<string>('a1');

  const ahu = ahus.find((a) => a.id === activeId) ?? ahus[0];

  const replaceActive = useCallback(
    (next: AhuInput) => {
      setAhus((prev) =>
        prev.map((a) => (a.id === activeId ? { ...next, id: activeId } : a)),
      );
    },
    [activeId],
  );

  const patchActive = useCallback(
    (partial: Partial<AhuInput>) => {
      setAhus((prev) =>
        prev.map((a) => (a.id === activeId ? { ...a, ...partial } : a)),
      );
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
          a.id !== activeId
            ? a
            : { ...a, zones: a.zones.filter((z) => z.id !== id) },
        ),
      );
    },
    [activeId],
  );

  const resetZones = useCallback(() => {
    setAhus((prev) =>
      prev.map((a) =>
        a.id !== activeId ? a : { ...a, zones: defaultZoneFor(a.type) },
      ),
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
                rooms: rooms.map((r) =>
                  r.id === rid ? { ...r, ...partial } : r,
                ),
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
              const idx = (z.rooms ?? []).length;
              const room = makeRoomSeed(z.tag ?? `Z${idx + 1}`, idx);
              return { ...z, rooms: [...(z.rooms ?? []), room] };
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
              return { ...z, rooms: (z.rooms ?? []).filter((r) => r.id !== rid) };
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

  return {
    ahus,
    activeId,
    ahu,
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
  };
}

/** Re-export factory for tests / consumers that want a fresh seed without a hook. */
export const seedFactory = makeSeedAhu;