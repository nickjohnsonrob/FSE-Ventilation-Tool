/**
 * Tests for the favorites storage module (`src/lib/storage/favorites.ts`).
 *
 * Invariants:
 *   1. `load()` returns an empty Set when no value has ever been stored.
 *   2. `load()` returns an empty Set when stored JSON is malformed
 *      (corrupt, wrong shape, wrong version) — never throws.
 *   3. `add(id)` makes `has(id)` true and persists across `load()`.
 *   4. `remove(id)` makes `has(id)` false and persists across `load()`.
 *   5. `has(id)` returns false for unknown ids.
 *   6. `add()` is idempotent — adding the same id twice does not duplicate.
 *   7. Schema is versioned (`v1`) — keys are namespaced under
 *      `fse.vent.favorites.v1` to avoid colliding with snapshots/state.
 *   8. Tolerates blocked localStorage (private mode / file://) by
 *      degrading to an empty Set — never throws.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FAVORITES_STORAGE_KEY,
  loadFavorites,
  addFavorite,
  removeFavorite,
  hasFavorite,
} from '../storage/favorites';

describe('favorites storage', () => {
  beforeEach(() => {
    // Start each test from a clean localStorage so prior tests don't leak.
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('exposes a versioned storage key', () => {
    // Locked scope: per-user, all-AHUs, localStorage. v1 namespacing keeps
    // it independent of the snapshot library (`fse.vent.snapshots.v1`)
    // and the unit toggle (`fse.vent.units.v1`).
    expect(FAVORITES_STORAGE_KEY).toBe('fse.vent.favorites.v1');
  });

  it('load() returns an empty Set when nothing has been stored', () => {
    const favs = loadFavorites();
    expect(favs).toBeInstanceOf(Set);
    expect(favs.size).toBe(0);
  });

  it('add() makes has() true', () => {
    addFavorite('office-general');
    expect(hasFavorite('office-general')).toBe(true);
  });

  it('remove() makes has() false', () => {
    addFavorite('classrooms-9plus');
    expect(hasFavorite('classrooms-9plus')).toBe(true);
    removeFavorite('classrooms-9plus');
    expect(hasFavorite('classrooms-9plus')).toBe(false);
  });

  it('has() returns false for ids that have never been added', () => {
    expect(hasFavorite('does-not-exist')).toBe(false);
  });

  it('persists across loads (round-trips through localStorage)', () => {
    addFavorite('office-general');
    addFavorite('lecture-hall');

    // Simulate a fresh page load — `load()` reads from localStorage.
    const reloaded = loadFavorites();
    expect(reloaded.has('office-general')).toBe(true);
    expect(reloaded.has('lecture-hall')).toBe(true);
    expect(reloaded.size).toBe(2);
  });

  it('remove() persists across loads', () => {
    addFavorite('office-general');
    addFavorite('lecture-hall');
    removeFavorite('office-general');

    const reloaded = loadFavorites();
    expect(reloaded.has('office-general')).toBe(false);
    expect(reloaded.has('lecture-hall')).toBe(true);
    expect(reloaded.size).toBe(1);
  });

  it('add() is idempotent — no duplicates', () => {
    addFavorite('office-general');
    addFavorite('office-general');
    addFavorite('office-general');
    expect(loadFavorites().size).toBe(1);
  });

  it('tolerates corrupt JSON without throwing', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, 'not json {{');
    expect(() => loadFavorites()).not.toThrow();
    expect(loadFavorites().size).toBe(0);
  });

  it('tolerates wrong schema (missing ids array) without throwing', () => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 1, wrongField: 'oops' }),
    );
    expect(() => loadFavorites()).not.toThrow();
    expect(loadFavorites().size).toBe(0);
  });

  it('tolerates future versions without throwing (returns empty)', () => {
    // Future schema migration: if v2 ships, v1 readers must not crash.
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 999, ids: ['x'] }),
    );
    expect(() => loadFavorites()).not.toThrow();
    expect(loadFavorites().size).toBe(0);
  });

  it('survives clearing the main app state key', () => {
    // Invariant: favorites are stored under a separate key from app state,
    // so wiping the state store must NOT wipe favorites.
    window.localStorage.setItem('fse.vent.state.v1', JSON.stringify({ ahus: [] }));
    addFavorite('office-general');

    // Simulate a state wipe.
    window.localStorage.removeItem('fse.vent.state.v1');

    // Favorites must still be there.
    expect(loadFavorites().has('office-general')).toBe(true);
  });
});