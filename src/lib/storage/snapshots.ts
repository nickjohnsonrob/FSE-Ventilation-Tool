/**
 * Named, manual save-state snapshots — the "library" feature.
 *
 * Engineers can save the current calculation as a named snapshot (e.g.
 * "v1 for client A", "design option 2"), and recall / rename / delete
 * them later. Distinct from auto-persistence: snapshots are explicit,
 * user-named, and live in a library the engineer curates.
 *
 * ## Storage shape
 *
 * One localStorage key (`fse.vent.snapshots.v1`) holds a JSON array of
 * `Snapshot` records. We keep an explicit `schemaVersion` on the wrapped
 * `state` so a future app version with a different state tree can detect
 * incompatible snapshots on load rather than silently blowing up.
 *
 * ## Robustness
 *
 * - `localStorage.setItem` / `getItem` can throw in private mode, on
 *   `file://` (Safari), or when quota is exhausted. Every helper swallows
 *   those errors silently — the engineer should still be able to use the
 *   app, they just can't save/load snapshots.
 * - Corrupt or non-JSON content in the key returns an empty list rather
 *   than throwing — the library surfaces a clean empty state, and a
 *   subsequent save overwrites the broken data.
 * - Non-array payloads (e.g. someone hand-editing devtools) are coerced
 *   to an empty list.
 */
import type { AhuInput } from '../ashrae621';
import type { Units } from '../units';

/** Bump when the persisted state shape changes incompatibly. */
export const SNAPSHOT_SCHEMA_VERSION = 1 as const;
export type SnapshotSchemaVersion = typeof SNAPSHOT_SCHEMA_VERSION;

/** Full app state needed to restore a snapshot. */
export interface SerializedState {
  schemaVersion: SnapshotSchemaVersion;
  ahus: AhuInput[];
  activeId: string;
  unitSystem: Units;
}

/** A persisted, named snapshot — user-facing record in the library. */
export interface Snapshot {
  /** UUID v4 — stable across rename. */
  id: string;
  /** User-provided name. Empty / whitespace trimmed at save time. */
  name: string;
  /** ISO 8601 timestamp captured at save time (used for "newest-first"). */
  createdAt: string;
  /** The full state tree at save time. */
  state: SerializedState;
}

const STORAGE_KEY = 'fse.vent.snapshots.v1';

/** Minimal UUID v4 — we don't need crypto strength, just uniqueness. */
function makeId(): string {
  // crypto.randomUUID is available in modern browsers + jsdom; fall back to
  // a Math.random-based v4-shaped string for environments that lack it
  // (very old Safari, some test sandboxes).
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const r = (n: number): string =>
    Math.floor(Math.random() * Math.pow(16, n))
      .toString(16)
      .padStart(n, '0');
  return `${r(8)}-${r(4)}-4${r(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${r(3)}-${r(12)}`;
}

/** Read the raw snapshot array from localStorage, defensively. */
function readRaw(): Snapshot[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // Light shape guard: each entry must at least have id/name/createdAt/state.
  // Anything missing is dropped silently — corrupt records shouldn't take
  // the whole library down.
  return parsed.filter(
    (s): s is Snapshot =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Snapshot).id === 'string' &&
      typeof (s as Snapshot).name === 'string' &&
      typeof (s as Snapshot).createdAt === 'string' &&
      typeof (s as Snapshot).state === 'object',
  );
}

/** Persist a snapshot array to localStorage. Swallows storage errors. */
function writeRaw(list: Snapshot[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist a new named snapshot. Returns the created record so the caller
 * has its id for follow-up UI (e.g. focusing the new row in the library).
 *
 * Tolerates blocked localStorage silently: the returned snapshot is still
 * a valid object so callers can update local UI without nil-checks, but
 * `listSnapshots()` will reflect that nothing was actually persisted.
 */
export function saveSnapshot(name: string, state: SerializedState): Snapshot {
  const trimmed = (name ?? '').trim() || 'Untitled snapshot';
  const snap: Snapshot = {
    id: makeId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    state: { ...state, schemaVersion: SNAPSHOT_SCHEMA_VERSION },
  };
  const list = readRaw();
  list.push(snap);
  writeRaw(list);
  return snap;
}

/** Return all persisted snapshots, newest-first. */
export function listSnapshots(): Snapshot[] {
  const list = readRaw();
  // Stable, deterministic ordering: primary = createdAt desc, tie-break by
  // id desc so two saves in the same millisecond still order by save order
  // (later id = later save in practice).
  return [...list].sort((a, b) => {
    const dt = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (dt !== 0) return dt;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** Return the snapshot with this id, or null if not found. */
export function loadSnapshot(id: string): Snapshot | null {
  return readRaw().find((s) => s.id === id) ?? null;
}

/** Remove the snapshot with this id. Unknown id is a silent no-op. */
export function deleteSnapshot(id: string): void {
  const list = readRaw().filter((s) => s.id !== id);
  writeRaw(list);
}

/** Rename the snapshot with this id. Empty name reverts to "Untitled snapshot". */
export function renameSnapshot(id: string, newName: string): void {
  const trimmed = (newName ?? '').trim() || 'Untitled snapshot';
  const list = readRaw();
  const next = list.map((s) => (s.id === id ? { ...s, name: trimmed } : s));
  writeRaw(next);
}
