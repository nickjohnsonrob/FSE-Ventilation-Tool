import { useCallback, useState } from 'react';
import type { AhuInput, ZoneInput } from '../lib/ashrae621';

let _idCounter = 1000;
const nextId = () => `z${++_idCounter}`;

/** Default AHU state — two empty office zones, full Appendix A. */
export function defaultAhu(): AhuInput {
  return {
    type: 'multizone',
    method: 'appendixA',
    psAuto: true,
    ps: 0,
    vpsAuto: true,
    vps: 0,
    zones: [
      {
        id: nextId(),
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
        id: nextId(),
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
    ],
  };
}

export interface AhuStateApi {
  ahu: AhuInput;
  patch: (partial: Partial<AhuInput>) => void;
  patchZone: (id: string, partial: Partial<ZoneInput>) => void;
  addZone: () => void;
  removeZone: (id: string) => void;
  reset: () => void;
}

/**
 * Manage the AHU state. `patch` does a shallow merge; `patchZone` updates
 * a single zone by id.
 */
export function useAhuState(initial: AhuInput): AhuStateApi {
  const [ahu, setAhu] = useState<AhuInput>(initial);

  const patch = useCallback((partial: Partial<AhuInput>) => {
    setAhu((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchZone = useCallback((id: string, partial: Partial<ZoneInput>) => {
    setAhu((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === id ? { ...z, ...partial } : z)),
    }));
  }, []);

  const addZone = useCallback(() => {
    setAhu((prev) => ({
      ...prev,
      zones: [
        ...prev.zones,
        {
          id: nextId(),
          tag: `TU-${String(prev.zones.length + 1).padStart(2, '0')}`,
          space: 'Office space',
          area: 500,
          pop: 5,
          vpz: 600,
          vdz: 600,
          vdzm: 0,
          ezConfig: 'Ceiling supply of cool air',
          box: 'single',
          er: 0,
        },
      ],
    }));
  }, []);

  const removeZone = useCallback((id: string) => {
    setAhu((prev) => ({ ...prev, zones: prev.zones.filter((z) => z.id !== id) }));
  }, []);

  const reset = useCallback(() => {
    setAhu(defaultAhu());
  }, []);

  return { ahu, patch, patchZone, addZone, removeZone, reset };
}
