# feat: favorites per space type

## Summary

Adds a per-user Favorites feature to the ASHRAE Table 6-3 preset menu. Engineers can star any occupancy category row; starred rows surface in a "Favorites" group at the top of the picker so commonly-used space types are one click away.

## Scope (locked)

- **Per-user, all-AHUs shared.** Same engineer uses the same favorites across every AHU in the project.
- **localStorage-backed.** Separate key from app state — wiping the calculator's state must NOT wipe the engineer's curated favorites.
- **Versioned schema** (`fse.vent.favorites.v1`) so future migrations don't collide.
- **No per-AHU override** in v1. Defer unless explicitly requested.

## What's in this PR

- `src/lib/storage/favorites.ts` — `loadFavorites()` / `addFavorite()` / `removeFavorite()` / `hasFavorite()`. Tolerates blocked localStorage (private mode / file://) by degrading to empty Set — never throws.
- `src/components/PresetMenu.tsx` — star button (`★` / `☆`) on every preset row; "Favorites" group prepended to the menu when any are starred; favorited rows removed from their canonical group (no dupes). Star click stops event propagation so it never also applies the preset.
- `src/styles/index.css` — `.preset-row__star` button + `.preset-group--favorites` accent (sunken background, accent text).
- `src/lib/__tests__/favorites.test.ts` — 12 vitest tests covering add/remove/has, persistence across loads, idempotency, corrupt-JSON tolerance, wrong-schema tolerance, version-future tolerance, separation from app state.
- `e2e/favorites.spec.ts` — 7 Playwright tests: star button on every row, top-of-menu Favorites group, persistence across close/reopen, persistence across AHU switch (per-user invariant), unstar removes from group, starring does NOT apply preset, 220 cfm math pin still holds.

## Invariants checked

- [x] Favorites survive AHU switch (per-user, not per-AHU)
- [x] Favorites survive localStorage clear of app state (separate key)
- [x] Star toggle is fast (synchronous localStorage write + setState — < 1ms in practice)
- [x] 165 vitest pass (was 153; +12 favorites tests)
- [x] 53 Playwright pass (was 46; +7 favorites tests)
- [x] typecheck clean, lint max-warnings 0, build clean

## Out of scope (do not touch)

- Math core (`src/lib/ashrae621.ts`)
- Snapshot / main persistence internals (`src/hooks/useAhuState.ts`)

## Test plan

- Vitest: `npm test`
- Playwright: `npx playwright test e2e/favorites.spec.ts`
- Full e2e: `npm run test:e2e`