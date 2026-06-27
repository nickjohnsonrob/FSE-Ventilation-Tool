/**
 * SaveButton — capture the current calculation as a named snapshot.
 *
 * Two states:
 *   1. Idle — a single "Save" button.
 *   2. Naming — an inline text input + "Save" / "Cancel" actions.
 *
 * Click Save → focus moves to the input. Type a name, press Enter (or
 * click Save) → calls `saveSnapshot(name, state)` and returns to idle.
 * Press Esc (or click Cancel) → returns to idle without saving.
 *
 * The button lives in the Header next to Export and Theme; opening the
 * name input shouldn't disrupt the rest of the page, so it pops in-place
 * (no modal). An empty name disables the Save action — engineers can't
 * create nameless snapshots.
 */
import { useEffect, useRef, useState } from 'react';
import { saveSnapshot } from '../lib/storage/snapshots';
import type { SerializedState } from '../lib/storage/snapshots';

export interface SaveButtonProps {
  /** The state tree to persist when the engineer commits a name. */
  getState: () => SerializedState;
  /** Optional callback after a successful save (e.g. flash a toast). */
  onSaved?: (name: string) => void;
}

export function SaveButton({ getState, onSaved }: SaveButtonProps): JSX.Element {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when entering naming mode so the engineer can
  // start typing immediately.
  useEffect(() => {
    if (naming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [naming]);

  const beginNaming = (): void => {
    setName('');
    setNaming(true);
  };

  const cancel = (): void => {
    setName('');
    setNaming(false);
  };

  const commit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return; // disabled while empty, but be defensive
    saveSnapshot(trimmed, getState());
    onSaved?.(trimmed);
    setName('');
    setNaming(false);
  };

  if (!naming) {
    return (
      <button
        type="button"
        className="btn"
        onClick={beginNaming}
        data-testid="save-button"
        title="Save the current calculation as a named snapshot"
      >
        Save
      </button>
    );
  }

  return (
    <span className="save-button__naming" data-testid="save-button-naming">
      <input
        ref={inputRef}
        type="text"
        className="save-button__input"
        placeholder="Snapshot name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        data-testid="snapshot-name-input"
        aria-label="Snapshot name"
      />
      <button
        type="button"
        className="btn btn--primary btn--small"
        onClick={commit}
        disabled={name.trim().length === 0}
        data-testid="snapshot-name-commit"
      >
        Save
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={cancel}
        data-testid="snapshot-name-cancel"
      >
        Cancel
      </button>
    </span>
  );
}
