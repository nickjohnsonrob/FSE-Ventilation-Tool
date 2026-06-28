/**
 * LibraryModal — browse, load, rename, and delete saved snapshots.
 *
 * Mirrors the EzHelpDialog backdrop pattern: fixed overlay, click-outside
 * to close, X button in the corner. Lists every snapshot in storage,
 * newest-first (matching `listSnapshots()` order). Each row exposes
 *   - Load    — replaces current state tree with the snapshot's state
 *   - Rename  — inline-edit the name (Enter to commit, Esc to revert)
 *   - Delete  — confirms before removing
 *
 * After any mutating action, the row list refreshes by re-reading
 * localStorage so the UI matches the persisted store exactly.
 *
 * The modal is dumb about persistence — it just calls into `snapshots.ts`
 * and `useAhuState.restoreState()`. All schema validation lives in those
 * two layers; the modal can trust that inputs are well-formed.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import {
  deleteSnapshot,
  listSnapshots,
  loadSnapshot,
  renameSnapshot,
  type Snapshot,
} from '../lib/storage/snapshots';
import { summarizeSnapshot } from './SnapshotSummary';

export interface LibraryModalProps {
  /** Called when the engineer picks "Load" — restores the snapshot. */
  onLoad: (snap: Snapshot) => void;
  /** Called to close the modal (X button, click backdrop, or Esc). */
  onClose: () => void;
}

export function LibraryModal({ onLoad, onClose }: LibraryModalProps): JSX.Element {
  const [snaps, setSnaps] = useState<Snapshot[]>(() => listSnapshots());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const titleId = useId();

  /** Re-read from storage — used after any mutating action. */
  const refresh = useCallback((): void => {
    setSnaps(listSnapshots());
  }, []);

  // Esc closes the modal — standard dialog convention.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // If we're in inline rename mode, let that input handle Esc
        // (its onKeyDown fires first). Otherwise close the modal.
        if (renamingId === null) {
          e.preventDefault();
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, renamingId]);

  const startRename = (snap: Snapshot): void => {
    setRenamingId(snap.id);
    setDraftName(snap.name);
  };

  const commitRename = (): void => {
    if (renamingId && draftName.trim().length > 0) {
      renameSnapshot(renamingId, draftName);
    }
    setRenamingId(null);
    setDraftName('');
    refresh();
  };

  const cancelRename = (): void => {
    setRenamingId(null);
    setDraftName('');
  };

  const handleDelete = (snap: Snapshot): void => {
    const ok = window.confirm(`Delete snapshot "${snap.name}"? This cannot be undone.`);
    if (!ok) return;
    deleteSnapshot(snap.id);
    refresh();
  };

  const handleLoad = (snap: Snapshot): void => {
    // Re-load the snapshot from storage so the caller gets the latest
    // saved state (in case it was renamed between list-render and click).
    const fresh = loadSnapshot(snap.id);
    if (fresh) onLoad(fresh);
  };

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      data-testid="library-modal"
    >
      <div className="dialog library-modal" onClick={(e) => e.stopPropagation()}>
        <div className="library-modal__head">
          <h3 id={titleId}>Snapshot Library</h3>
          <button
            type="button"
            className="library-modal__close"
            onClick={onClose}
            aria-label="Close library"
            data-testid="library-close"
          >
            ×
          </button>
        </div>

        {snaps.length === 0 ? (
          <p className="library-modal__empty muted">
            No saved snapshots yet. Click <strong>Save</strong> to capture the current calc.
          </p>
        ) : (
          <ul className="library-modal__list" data-testid="library-list">
            {snaps.map((s) => {
              const isRenaming = renamingId === s.id;
              return (
                <li
                  key={s.id}
                  className="library-row"
                  data-testid="library-row"
                  data-snapshot-id={s.id}
                >
                  <div className="library-row__main">
                    {isRenaming ? (
                      <input
                        type="text"
                        className="library-row__rename-input"
                        value={draftName}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={commitRename}
                        data-testid="library-rename-input"
                        aria-label="Rename snapshot"
                      />
                    ) : (
                      <div className="library-row__name" title={s.name}>
                        {s.name}
                      </div>
                    )}
                    <div className="library-row__meta muted">
                      <span className="library-row__date">{formatTimestamp(s.createdAt)}</span>
                      <span className="library-row__summary">{summarizeSnapshot(s.state)}</span>
                    </div>
                  </div>
                  <div className="library-row__actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => handleLoad(s)}
                      data-testid="library-load"
                      title="Replace current state with this snapshot"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => startRename(s)}
                      disabled={isRenaming}
                      data-testid="library-rename"
                      title="Rename snapshot"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => handleDelete(s)}
                      data-testid="library-delete"
                      title="Delete snapshot"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="dialog__actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            data-testid="library-close-action"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Format an ISO timestamp as a short locale-friendly string. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
