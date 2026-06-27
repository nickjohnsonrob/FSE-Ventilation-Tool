/**
 * ASHRAE 62.1-2022 Table 6-3 occupancy presets.
 *
 * A preset is a starter bundle for a zone: it sets `space` (occupancy
 * category), `area` (ft²), `pop` (people), `ezConfig`, and the implied
 * `Rp` / `Ra` rates. Rp and Ra are derived from `OCCUPANCY_CATEGORIES`
 * (the canonical ASHRAE Table 6-1 values) — they live in this module
 * purely for display in the preset menu so engineers can see what they're
 * loading. The math core uses OCCUPANCY_CATEGORIES; the preset only seeds
 * the zone input shape.
 *
 * Defaults are *typical engineering values*, not worst-case — a small
 * private office is ~150 ft² with 1-2 people, not the largest corner office.
 * The engineer can edit any field after the preset loads.
 *
 * Grouping follows ASHRAE 62.1-2022 Table 6-3 canonical categories
 * (Office Spaces, Educational Facilities, Healthcare, etc.). When a row
 * could plausibly fit multiple categories we put it in the most common
 * one and let `searchPresets()` find it across all text.
 */
import type { RoomInput, ZoneInput } from './ashrae621';
import { OCCUPANCY_CATEGORIES } from './tables';

/** A starter bundle for one zone. */
export interface Preset {
  /** Stable id, e.g. 'office-general'. Used for keyboard nav / deep links. */
  id: string;
  /** ASHRAE Table 6-3 group label, e.g. 'Office Spaces'. */
  category: string;
  /** Must be a key in OCCUPANCY_CATEGORIES. */
  spaceType: string;
  /** Typical floor area in ft². */
  defaultArea: number;
  /** Typical population (people). */
  defaultPop: number;
  /** Zone Air Distribution Effectiveness (Ez). 1.0 is the standard default. */
  defaultEz: number;
  /** People-outdoor-air rate, cfm/person (from Table 6-1, for display). */
  rp: number;
  /** Area-outdoor-air rate, cfm/ft² (from Table 6-1, for display). */
  ra: number;
}

/** A category with its presets, used for the grouped menu rendering. */
export interface PresetGroup {
  category: string;
  rows: Preset[];
}

// ----------------------------------------------------------------------------
// Preset data — typical engineering defaults. One entry per Table 6-1 row.
// Defaults: small private office 150 ft² / 1 person; classroom 900 ft² / 25;
// conference 500 ft² / 12; etc. Tuned for "first draft, then edit" workflow.
// ----------------------------------------------------------------------------

const TABLE_6_3_PRESETS: ReadonlyArray<Omit<Preset, 'rp' | 'ra'>> = [
  // ---- Office Spaces ----
  { id: 'office-space', category: 'Office Spaces', spaceType: 'Office space', defaultArea: 150, defaultPop: 1, defaultEz: 1.0 },
  { id: 'reception-areas', category: 'Office Spaces', spaceType: 'Reception areas', defaultArea: 300, defaultPop: 4, defaultEz: 1.0 },
  { id: 'telephone-data-entry', category: 'Office Spaces', spaceType: 'Telephone/data entry', defaultArea: 200, defaultPop: 4, defaultEz: 1.0 },
  { id: 'main-entry-lobbies', category: 'Office Spaces', spaceType: 'Main entry lobbies', defaultArea: 600, defaultPop: 12, defaultEz: 1.0 },
  { id: 'guard-stations', category: 'Office Spaces', spaceType: 'Guard stations', defaultArea: 80, defaultPop: 1, defaultEz: 1.0 },
  { id: 'bank-vaults', category: 'Office Spaces', spaceType: 'Bank vaults/safe deposit', defaultArea: 400, defaultPop: 2, defaultEz: 1.0 },

  // ---- Educational Facilities ----
  { id: 'classrooms-9plus', category: 'Educational Facilities', spaceType: 'Classrooms (age 9 plus)', defaultArea: 900, defaultPop: 25, defaultEz: 1.0 },
  { id: 'classrooms-5to8', category: 'Educational Facilities', spaceType: 'Classrooms (ages 5-8)', defaultArea: 900, defaultPop: 25, defaultEz: 1.0 },
  { id: 'lecture-classroom', category: 'Educational Facilities', spaceType: 'Lecture Classroom', defaultArea: 750, defaultPop: 30, defaultEz: 1.0 },
  { id: 'lecture-hall', category: 'Educational Facilities', spaceType: 'Lecture Hall (fixed seats)', defaultArea: 1500, defaultPop: 100, defaultEz: 1.0 },
  { id: 'art-classroom', category: 'Educational Facilities', spaceType: 'Art classroom', defaultArea: 1100, defaultPop: 25, defaultEz: 1.0 },
  { id: 'science-laboratories', category: 'Educational Facilities', spaceType: 'Science laboratories', defaultArea: 950, defaultPop: 24, defaultEz: 1.0 },
  { id: 'computer-lab', category: 'Educational Facilities', spaceType: 'Computer Lab.', defaultArea: 950, defaultPop: 30, defaultEz: 1.0 },
  { id: 'media-center', category: 'Educational Facilities', spaceType: 'Media Center', defaultArea: 1200, defaultPop: 30, defaultEz: 1.0 },
  { id: 'music-theater-dance', category: 'Educational Facilities', spaceType: 'Music/theater/dance', defaultArea: 1100, defaultPop: 25, defaultEz: 1.0 },
  { id: 'wood-metal-shop', category: 'Educational Facilities', spaceType: 'Wood/metal shop', defaultArea: 1500, defaultPop: 20, defaultEz: 1.0 },
  { id: 'daycare-thru-4', category: 'Educational Facilities', spaceType: 'Daycare (through age 4)', defaultArea: 800, defaultPop: 16, defaultEz: 1.0 },
  { id: 'dayroom', category: 'Educational Facilities', spaceType: 'Dayroom', defaultArea: 600, defaultPop: 20, defaultEz: 1.0 },

  // ---- Healthcare ----
  { id: 'cell', category: 'Healthcare', spaceType: 'Cell', defaultArea: 70, defaultPop: 1, defaultEz: 1.0 },
  { id: 'medical-rooms', category: 'Healthcare', spaceType: 'Pharmacy (prep. area)', defaultArea: 250, defaultPop: 3, defaultEz: 1.0 },
  { id: 'patient-rooms', category: 'Healthcare', spaceType: 'Bedroom/Living Room', defaultArea: 200, defaultPop: 2, defaultEz: 1.0 },
  { id: 'barracks-sleeping', category: 'Healthcare', spaceType: 'Barracks sleeping areas', defaultArea: 200, defaultPop: 2, defaultEz: 1.0 },

  // ---- Retail ----
  { id: 'sales-except-below', category: 'Retail', spaceType: 'Sales (except as below)', defaultArea: 1500, defaultPop: 15, defaultEz: 1.0 },
  { id: 'mall-common', category: 'Retail', spaceType: 'Mall common areas', defaultArea: 3000, defaultPop: 60, defaultEz: 1.0 },
  { id: 'supermarket', category: 'Retail', spaceType: 'Supermarket', defaultArea: 5000, defaultPop: 75, defaultEz: 1.0 },
  { id: 'barber-shop', category: 'Retail', spaceType: 'Barber shop', defaultArea: 300, defaultPop: 4, defaultEz: 1.0 },
  { id: 'beauty-nail-salons', category: 'Retail', spaceType: 'Beauty and nail salons', defaultArea: 400, defaultPop: 6, defaultEz: 1.0 },
  { id: 'pet-shops', category: 'Retail', spaceType: 'Pet shops (animal areas)', defaultArea: 600, defaultPop: 8, defaultEz: 1.0 },
  { id: 'photo-studios', category: 'Retail', spaceType: 'Photo studios', defaultArea: 400, defaultPop: 4, defaultEz: 1.0 },
  { id: 'coin-laundries', category: 'Retail', spaceType: 'Coin operated laundries', defaultArea: 600, defaultPop: 6, defaultEz: 1.0 },
  { id: 'libraries', category: 'Retail', spaceType: 'Libraries', defaultArea: 1200, defaultPop: 30, defaultEz: 1.0 },

  // ---- Public Assembly ----
  { id: 'auditorium-seating', category: 'Public Assembly', spaceType: 'Auditorium seating area', defaultArea: 3000, defaultPop: 200, defaultEz: 1.0 },
  { id: 'multi-purpose-assembly', category: 'Public Assembly', spaceType: 'Multi-purpose assembly', defaultArea: 2500, defaultPop: 150, defaultEz: 1.0 },
  { id: 'multi-use-assembly', category: 'Public Assembly', spaceType: 'Multi-use Assembly', defaultArea: 2000, defaultPop: 120, defaultEz: 1.0 },
  { id: 'religious-worship', category: 'Public Assembly', spaceType: 'Places of religious worship', defaultArea: 3000, defaultPop: 200, defaultEz: 1.0 },
  { id: 'legislative-chambers', category: 'Public Assembly', spaceType: 'Legislative chambers', defaultArea: 2500, defaultPop: 100, defaultEz: 1.0 },
  { id: 'courtrooms', category: 'Public Assembly', spaceType: 'Courtrooms', defaultArea: 1500, defaultPop: 50, defaultEz: 1.0 },
  { id: 'spectator-areas', category: 'Public Assembly', spaceType: 'Spectator areas', defaultArea: 5000, defaultPop: 400, defaultEz: 1.0 },
  { id: 'sports-arena', category: 'Public Assembly', spaceType: 'Sports arena (play area)', defaultArea: 12000, defaultPop: 0, defaultEz: 1.0 },
  { id: 'stages-studios', category: 'Public Assembly', spaceType: 'Stages, studios', defaultArea: 2500, defaultPop: 50, defaultEz: 1.0 },
  { id: 'museums-galleries', category: 'Public Assembly', spaceType: 'Museums/Galleries', defaultArea: 2500, defaultPop: 80, defaultEz: 1.0 },
  { id: 'museums-childrens', category: 'Public Assembly', spaceType: "Museums (Children's)", defaultArea: 1800, defaultPop: 60, defaultEz: 1.0 },
  { id: 'gambling-casinos', category: 'Public Assembly', spaceType: 'Gambling casinos', defaultArea: 3000, defaultPop: 80, defaultEz: 1.0 },
  { id: 'game-arcades', category: 'Public Assembly', spaceType: 'Game arcades', defaultArea: 1200, defaultPop: 30, defaultEz: 1.0 },
  { id: 'transportation-waiting', category: 'Public Assembly', spaceType: 'Transportation waiting', defaultArea: 2000, defaultPop: 60, defaultEz: 1.0 },
  { id: 'lobbies', category: 'Public Assembly', spaceType: 'Lobbies', defaultArea: 1500, defaultPop: 30, defaultEz: 1.0 },
  { id: 'lobbies-prefunction', category: 'Public Assembly', spaceType: 'Lobbies/prefunction', defaultArea: 1500, defaultPop: 30, defaultEz: 1.0 },
  { id: 'booking-waiting', category: 'Public Assembly', spaceType: 'Booking/waiting', defaultArea: 600, defaultPop: 20, defaultEz: 1.0 },

  // ---- Food Service ----
  { id: 'restaurant-dining', category: 'Food Service', spaceType: 'Restaurant dining rooms', defaultArea: 1200, defaultPop: 80, defaultEz: 1.0 },
  { id: 'cafeteria-fast-food', category: 'Food Service', spaceType: 'Cafeteria / fast food dining', defaultArea: 1500, defaultPop: 100, defaultEz: 1.0 },
  { id: 'bars-cocktail-lounges', category: 'Food Service', spaceType: 'Bars, cocktail lounges', defaultArea: 800, defaultPop: 60, defaultEz: 1.0 },
  { id: 'disco-dance-floors', category: 'Food Service', spaceType: 'Disco/dance floors', defaultArea: 1500, defaultPop: 100, defaultEz: 1.0 },
  { id: 'bowling-alley-seating', category: 'Food Service', spaceType: 'Bowling alley (seating)', defaultArea: 1200, defaultPop: 50, defaultEz: 1.0 },

  // ---- Recreation (subset of Public Assembly in some editions) ----
  { id: 'gym-stadium-play', category: 'Public Assembly', spaceType: 'Gym, stadium (play area)', defaultArea: 8000, defaultPop: 0, defaultEz: 1.0 },
  { id: 'health-club-aerobics', category: 'Public Assembly', spaceType: 'Health club/aerobics room', defaultArea: 1500, defaultPop: 40, defaultEz: 1.0 },
  { id: 'health-club-weights', category: 'Public Assembly', spaceType: 'Health club/weight rooms', defaultArea: 1500, defaultPop: 20, defaultEz: 1.0 },
  { id: 'swimming-pool-deck', category: 'Public Assembly', spaceType: 'Swimming (pool & deck)', defaultArea: 5000, defaultPop: 0, defaultEz: 1.0 },

  // ---- Residential ----
  { id: 'bedroom-living-room', category: 'Residential', spaceType: 'Bedroom/Living Room', defaultArea: 250, defaultPop: 2, defaultEz: 1.0 },

  // ---- Industrial / General / Misc ----
  { id: 'corridors', category: 'Industrial / General', spaceType: 'Corridors', defaultArea: 800, defaultPop: 0, defaultEz: 1.0 },
  { id: 'storage-rooms', category: 'Industrial / General', spaceType: 'Storage rooms', defaultArea: 500, defaultPop: 0, defaultEz: 1.0 },
  { id: 'warehouses', category: 'Industrial / General', spaceType: 'Warehouses', defaultArea: 5000, defaultPop: 0, defaultEz: 1.0 },
  { id: 'shipping-receiving', category: 'Industrial / General', spaceType: 'Shipping/Receiving', defaultArea: 1500, defaultPop: 0, defaultEz: 1.0 },
  { id: 'conference-meeting', category: 'Office Spaces', spaceType: 'Conference / meeting', defaultArea: 500, defaultPop: 12, defaultEz: 1.0 },
  { id: 'computer-not-printing', category: 'Office Spaces', spaceType: 'Computer (not printing)', defaultArea: 250, defaultPop: 5, defaultEz: 1.0 },
];

// ----------------------------------------------------------------------------
// Public surface
// ----------------------------------------------------------------------------

/** All presets, with Rp / Ra filled in from Table 6-1. */
export const PRESETS: ReadonlyArray<Preset> = Object.freeze(
  TABLE_6_3_PRESETS.map((p) => {
    const [rp, ra] = OCCUPANCY_CATEGORIES[p.spaceType] ?? [0, 0];
    return Object.freeze({ ...p, rp, ra });
  }),
);

/** Lookup a preset by its id. */
export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/**
 * Case-insensitive substring search across spaceType and category.
 * Empty query returns all presets.
 */
export function searchPresets(query: string): Preset[] {
  const q = query.trim().toLowerCase();
  if (!q) return PRESETS.slice();
  return PRESETS.filter(
    (p) => p.spaceType.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
  );
}

/**
 * Group presets by canonical ASHRAE 62.1-2022 Table 6-3 category, preserving
 * the order of `TABLE_6_3_PRESETS` within each group so the menu is stable.
 */
export function groupPresets(): PresetGroup[] {
  const order: string[] = [];
  const byCat = new Map<string, Preset[]>();
  for (const p of PRESETS) {
    if (!byCat.has(p.category)) {
      byCat.set(p.category, []);
      order.push(p.category);
    }
    byCat.get(p.category)!.push(p);
  }
  return order.map((cat) => ({ category: cat, rows: byCat.get(cat)! }));
}

// ----------------------------------------------------------------------------
// applyPreset — zone mutation
// ----------------------------------------------------------------------------

/**
 * Apply a preset to a zone. Sets space / area / pop / ezConfig; keeps the
 * zone's id, tag, airflow inputs (vpz/vdz/vdzm), box type, er, and roomsDrive.
 * If the zone has rooms, redistribute area and pop equally across all rooms so
 * Σ(rooms) equals the new zone totals.
 *
 * Returns a new zone object — does not mutate in place.
 */
export function applyPreset(zone: ZoneInput, preset: Preset): ZoneInput {
  const next: ZoneInput = {
    ...zone,
    space: preset.spaceType,
    area: preset.defaultArea,
    pop: preset.defaultPop,
    ezConfig: ezConfigForPreset(preset),
  };
  if (zone.rooms && zone.rooms.length > 0) {
    next.rooms = redistributeRooms(zone.rooms, preset.defaultArea, preset.defaultPop);
  }
  return next;
}

/** Pick a sensible Ez configuration label for a preset. Defaults to the
 *  ceiling-supply-of-cool-air baseline (Ez = 1.0). */
function ezConfigForPreset(preset: Preset): string {
  if (preset.defaultEz === 0.8) return 'Ceiling supply of warm air ≥15°F above space, ceiling return';
  if (preset.defaultEz === 0.7) return 'Floor supply of warm air & ceiling return';
  if (preset.defaultEz === 0.5) return 'Makeup supply outlet <½ length from exhaust/return';
  // 1.0 is the safe default that every other preset maps to.
  return 'Ceiling supply of cool air';
}

/** Equal-split helper, mirroring useAhuState's redistributeRooms but exported
 *  here so the preset is self-contained. Rounds to 1 decimal; the last room
 *  absorbs the rounding remainder so the total is exact. */
function equalSplit(total: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [total];
  const each = Math.floor((total * 10) / n) / 10;
  const out: number[] = [];
  let assigned = 0;
  for (let i = 0; i < n - 1; i++) {
    out.push(each);
    assigned += each;
  }
  out.push(Math.max(0, +(total - assigned).toFixed(1)));
  return out;
}

function redistributeRooms(rooms: RoomInput[], area: number, pop: number): RoomInput[] {
  const areas = equalSplit(area, rooms.length);
  const pops = equalSplit(pop, rooms.length);
  return rooms.map((r, i) => ({
    ...r,
    area: areas[i],
    pop: pops[i],
    space: r.space, // preserve each room's space
  }));
}