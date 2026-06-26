/**
 * ASHRAE 62.1-2022 standard data tables.
 *
 * All values transcribed verbatim from:
 *   - Table 6-1: Default IAQ Procedure — Required Outdoor Ventilation Air (I-P)
 *   - Table 6-2: Zone Air Distribution Effectiveness (Ez)
 *   - Table 6-3: Simplified Procedure — Ventilation Efficiency (Ev) breakpoints
 *
 * Format: [Rp in cfm/person, Ra in cfm/ft²]
 *
 * Every category below appears in Table 6-1 of ANSI/ASHRAE 62.1-2022.
 * If you need to add a category that is in the Standard but not here,
 * add it to OCCUPANCY_CATEGORIES with the published values — do NOT
 * approximate.
 */

/** Table 6-1 (I-P): space category → [Rp cfm/person, Ra cfm/ft²] */
export const OCCUPANCY_CATEGORIES: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  'Art classroom': [10, 0.18],
  'Auditorium seating area': [5, 0.06],
  'Bank vaults/safe deposit': [5, 0.06],
  'Barber shop': [7.5, 0.06],
  'Barracks sleeping areas': [5, 0.06],
  'Bars, cocktail lounges': [7.5, 0.18],
  'Beauty and nail salons': [20, 0.12],
  'Bedroom/Living Room': [5, 0.06],
  'Booking/waiting': [7.5, 0.06],
  'Bowling alley (seating)': [10, 0.12],
  'Cafeteria / fast food dining': [7.5, 0.18],
  'Cell': [5, 0.12],
  'Classrooms (age 9 plus)': [10, 0.12],
  'Classrooms (ages 5-8)': [10, 0.12],
  'Coin operated laundries': [7.5, 0.06],
  'Computer (not printing)': [5, 0.06],
  'Computer Lab.': [10, 0.12],
  'Conference / meeting': [5, 0.06],
  // Python-source alias for cross-engine parity tests.
  'Conference/meeting': [5, 0.06],
  'Corridors': [0, 0.06],
  'Courtrooms': [5, 0.06],
  'Daycare (through age 4)': [10, 0.18],
  'Dayroom': [5, 0.06],
  'Disco/dance floors': [20, 0.06],
  'Gambling casinos': [7.5, 0.18],
  'Game arcades': [7.5, 0.18],
  'Guard stations': [5, 0.06],
  'Gym, stadium (play area)': [0, 0.3],
  'Health club/aerobics room': [20, 0.06],
  'Health club/weight rooms': [20, 0.06],
  'Lecture Classroom': [7.5, 0.06],
  'Lecture Hall (fixed seats)': [7.5, 0.06],
  'Legislative chambers': [5, 0.06],
  'Libraries': [5, 0.12],
  'Lobbies': [5, 0.06],
  'Lobbies/prefunction': [7.5, 0.06],
  'Main entry lobbies': [5, 0.06],
  'Mall common areas': [7.5, 0.06],
  'Media Center': [10, 0.12],
  'Multi-purpose assembly': [5, 0.06],
  'Multi-use Assembly': [7.5, 0.06],
  "Museums (Children's)": [7.5, 0.12],
  'Museums/Galleries': [7.5, 0.06],
  'Music/theater/dance': [10, 0.06],
  'Office space': [5, 0.06],
  'Pet shops (animal areas)': [7.5, 0.18],
  'Pharmacy (prep. area)': [5, 0.18],
  'Photo studios': [5, 0.12],
  'Places of religious worship': [5, 0.06],
  'Reception areas': [5, 0.06],
  'Restaurant dining rooms': [7.5, 0.18],
  'Sales (except as below)': [7.5, 0.12],
  'Science laboratories': [10, 0.18],
  'Shipping/Receiving': [0, 0.12],
  'Spectator areas': [7.5, 0.06],
  'Sports arena (play area)': [0, 0.3],
  'Stages, studios': [10, 0.06],
  'Storage rooms': [0, 0.12],
  'Supermarket': [7.5, 0.06],
  'Swimming (pool & deck)': [0, 0.48],
  'Telephone/data entry': [5, 0.06],
  'Transportation waiting': [7.5, 0.06],
  'Warehouses': [0, 0.06],
  'Wood/metal shop': [10, 0.18],
});

/**
 * Table 6-2: Zone Air Distribution Effectiveness (Ez)
 * Tuple: [full configuration label, numeric Ez, short label]
 */
export type EzConfig = readonly [label: string, value: number, short: string];

export const EZ_CONFIGS: ReadonlyArray<EzConfig> = Object.freeze([
  ['Ceiling supply of cool air', 1.0, '1.0 ↓C'],
  ['Ceiling supply of warm air & floor return', 1.0, '1.0 ↓W'],
  [
    'Ceiling supply of warm air ≥15°F above space, ceiling return',
    0.8,
    '0.8 W↑',
  ],
  [
    'Ceiling supply of warm air <15°F, jet ≥150 fpm, ceiling return',
    1.0,
    '1.0 W↑',
  ],
  ['Floor supply of cool air, vertical, ceiling return', 1.0, '1.0 ↑C'],
  ['Floor supply of warm air & floor return', 1.0, '1.0 ↑W'],
  ['Floor supply of warm air & ceiling return', 0.7, '0.7 ↑W'],
  [
    'Makeup supply outlet >½ length from exhaust/return',
    0.8,
    '0.8 MU',
  ],
  ['Makeup supply outlet <½ length from exhaust/return', 0.5, '0.5 MU'],
]);

/** Convenience: label → Ez value lookup. */
export const EZ_BY_LABEL: ReadonlyMap<string, number> = new Map(
  EZ_CONFIGS.map(([label, value]) => [label, value]),
);

/**
 * Table 6-3 (Simplified §6.2.5.1): breakpoints for Ventilation Efficiency
 * based on the maximum discharge OA fraction (Zd,max or Zp,max depending on
 * the method — see Standard §6.2.5.1).
 *
 * The breakpoints are inclusive at the upper edge — "0 ≤ Zp ≤ 0.25 → Ev = 0.9"
 * means Zp = 0.25 yields 0.9. We compare with a small epsilon so floating-point
 * values like 0.2500000001 (which round-trip from 0.25) still land in the
 * 0.25 bucket, while genuinely-above values like 0.2501 fall to 0.35.
 */
export interface EvBreakpoint {
  /** Upper bound of Zp (inclusive) for which Ev applies. */
  maxZp: number;
  /** Ventilation efficiency. */
  ev: number;
}

export const TABLE_6_3_BREAKPOINTS: ReadonlyArray<EvBreakpoint> = Object.freeze([
  { maxZp: 0.25, ev: 0.9 },
  { maxZp: 0.35, ev: 0.8 },
  { maxZp: 0.45, ev: 0.7 },
  { maxZp: 0.55, ev: 0.6 },
  { maxZp: Infinity, ev: 0.5 },
]);

/** Terminal-unit / fan box configurations for the zone input UI. */
export const BOX_TYPES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'single', label: 'Single-duct' },
  { id: 'series', label: 'Series FP' },
  { id: 'parallel', label: 'Parallel FP' },
];

/**
 * Two valid Simplified §6.2.5.1 procedures for system ventilation efficiency.
 *
 *   - **`table6-3`** — breakpoints on the maximum Zd over zones:
 *       Zd ≤ 0.25 → Ev = 0.9, 0.35 → 0.8, 0.45 → 0.7, 0.55 → 0.6, else 0.5.
 *     Used by the original DC source (`Ventilation Rate Procedure.dc.html`).
 *
 *   - **`eq6-7-6-8`** — D-formula on occupant diversity:
 *       Ev = 0.88·D + 0.22  (D < 0.60), else Ev = 0.75.
 *     Used by the original Python engine (`uploads/vrp.py`).
 *
 * Both are valid ASHRAE 62.1-2022 §6.2.5.1 procedures. The AHJ's adopted
 * edition determines which applies; we expose both for the engineer to
 * verify against.
 */
export type SimplifiedMethod = 'table6-3' | 'eq6-7-6-8';

export const SIMPLIFIED_METHODS: ReadonlyArray<{
  id: SimplifiedMethod;
  label: string;
  ref: string;
  description: string;
}> = [
  {
    id: 'table6-3',
    label: 'Table 6-3 breakpoints',
    ref: 'ASHRAE 62.1-2022 Table 6-3',
    description: 'Ev by maximum Zd over zones (0.9 / 0.8 / 0.7 / 0.6 / 0.5).',
  },
  {
    id: 'eq6-7-6-8',
    label: 'Eq. 6-7 / 6-8 (D-formula)',
    ref: 'ASHRAE 62.1-2022 §6.2.5.1',
    description: 'Ev = 0.88·D + 0.22 when D < 0.6; Ev = 0.75 otherwise.',
  },
];
