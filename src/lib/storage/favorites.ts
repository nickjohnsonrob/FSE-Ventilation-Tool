/**
 * Favorites — per-user, all-AHUs, localStorage-backed.
 *
 * Star any ASHRAE Table 6-3 row in the preset menu and it surfaces at the
 * top of the picker the next time it opens. Favorites are *not* per-AHU:
 * the same engineer uses the same favorites across all their air handlers.
 *
 * Storage shape:
 *   localStorage[fse.vent.favorites.v1] = {
 *     version: 1,
 *     ids: string[]   // Preset.id values, e.g. 'office-general'
 *   }
 *
 * Why a separate key from the snapshot library / unit toggle?
 *   - Clearing app state must NOT wipe the engineer's curated favorites.
 *   - It also keeps the schema small and easy to inspect in DevTools.
 *
 * Why versioned?
 *   - A future schema change (say, per-AHU favorites, or ordering) can
 *     migrate under a new key without colliding with stale v1 values.
 *
 * All read/write operations swallow localStorage errors (private mode,
 * quota, file://). The UI still works for the current session — favorites
 * just won't survive a reload.
 */

/** Storage key. Exported so tests can pin the contract. */
export const FAVORITES_STORAGE_KEY = 'fse.vent.favorites.v1';

/** Current schema version. Bump when the shape changes. */
const CURRENT_VERSION = 1;

interface FavoritesRecord {
  version: number;
  ids: string[];
}

/**
 * Read favorites from localStorage. Returns an empty Set if nothing has
 * been stored, the JSON is malformed, the schema is wrong, or storage
 * is unavailable. Never throws.
 */
export function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Partial<FavoritesRecord>;
    if (!parsed || parsed.version !== CURRENT_VERSION) return new Set();
    if (!Array.isArray(parsed.ids)) return new Set();
    // Defensive: only accept strings. Anything else gets dropped silently.
    return new Set(parsed.ids.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Persist a favorites set back to localStorage. Best-effort: private mode
 * / quota / blocked storage are swallowed silently.
 */
function saveFavorites(ids: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const record: FavoritesRecord = {
      version: CURRENT_VERSION,
      ids: Array.from(ids),
    };
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage may be blocked (private mode, file://, quota); ignore.
  }
}

/** Add an id to favorites. Idempotent — adding twice is a no-op. */
export function addFavorite(id: string): void {
  const favs = loadFavorites();
  if (favs.has(id)) return;
  favs.add(id);
  saveFavorites(favs);
}

/** Remove an id from favorites. No-op if it wasn't there. */
export function removeFavorite(id: string): void {
  const favs = loadFavorites();
  if (!favs.has(id)) return;
  favs.delete(id);
  saveFavorites(favs);
}

/** O(1) membership check. */
export function hasFavorite(id: string): boolean {
  return loadFavorites().has(id);
}