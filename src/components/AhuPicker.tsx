import { useEffect, useRef, useState } from 'react';
import type { AhuInput, SystemType } from '../lib/ashrae621';

export interface AhuPickerProps {
  ahus: AhuInput[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: (type: AhuInput['type']) => string;
  onRemove: (id: string) => void;
  /** Rename any AHU by id (no-op if id is unknown). Empty/whitespace reverts. */
  onRename: (id: string, name: string) => void;
  /**
   * Set the system ventilation type for any AHU by id.
   * - 'DR'  — Default / recirculating. 4 trace steps.
   * - 'DC'  — Dual-Conduit. Adds V_tr step. 5 trace steps.
   * - 'DC+' — Dual-Conduit plus return-air analysis. 6 trace steps.
   */
  onSystemTypeChange: (id: string, systemType: SystemType) => void;
}

/**
 * Air-handler picker — matches the v1.0.0 "unit rail" header strip.
 * Renders a horizontally-scrollable chip row with one chip per AHU, plus a
 * dashed `+ Add unit` button that opens a small menu to pick multizone
 * (RTU) vs singlezone (DOAS). Each chip has a close × that hides itself
 * when only one AHU remains.
 *
 * The active tab's name is inline-editable: double-click the label to
 * convert it to a text input. Enter or blur commits; Esc reverts. The
 * ZoneTable meta-strip input (`data-testid="ahu-name"`) is preserved as
 * the fallback for keyboard / screen-reader users who don't discover
 * the double-click affordance.
 */
export function AhuPicker({
  ahus,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  onSystemTypeChange,
}: AhuPickerProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const showClose = ahus.length > 1;

  return (
    <div className="ahu-picker" aria-label="Air handlers">
      <span className="ahu-picker__label">Air handlers</span>
      <div className="ahu-picker__rail">
        {ahus.map((a) => {
          const isActive = a.id === activeId;
          const isSingle = a.type === 'singlezone';
          // The hook always assigns `id`; this guards the math-core type
          // where `id` is optional for tests / deserialization.
          if (!a.id) return null;
          const id = a.id;
          return (
            <button
              key={id}
              type="button"
              className={`ahu-tab${isActive ? ' ahu-tab--active' : ''}`}
              onClick={() => {
                // Don't switch active AHU if we're in inline-edit mode on
                // this tab — clicking the chip while the input is focused
                // would steal focus and commit, which is fine, but a
                // synthetic click on the wrapping button shouldn't also
                // navigate away. AhuTabName guards this internally.
                if (!isActive) onSelect(id);
              }}
              title={`${a.name} (${isSingle ? 'Single-zone DOAS' : 'Multi-zone RTU'})`}
              data-ahu-id={id}
              data-ahu-type={a.type}
            >
              <span className={`ahu-tab__badge ahu-tab__badge--${a.type}`}>
                {isSingle ? '1-ZN' : 'MULTI'}
              </span>
              <AhuTabName id={id} name={a.name ?? ''} editable={isActive} onRename={onRename} />
              {isActive && (
                <select
                  className="ahu-tab__system-type"
                  value={a.systemType ?? 'DR'}
                  aria-label={`System ventilation type for ${a.name}`}
                  data-testid="system-type-select"
                  data-ahu-id={id}
                  // Stop propagation so the wrapping <button> doesn't fire
                  // its onClick (which would re-activate the same AHU).
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => onSystemTypeChange(id, e.target.value as SystemType)}
                  title="System ventilation type (ASHRAE 62.1 §6.2.5 / §6.2.6)"
                >
                  <option value="DR">Default (DR)</option>
                  <option value="DC">Dual-Conduit (DC)</option>
                  <option value="DC+">Dual-Conduit + (DC+)</option>
                </select>
              )}
              {showClose && (
                <span
                  className="ahu-tab__close"
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${a.name}`}
                  data-ahu-remove={id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(id);
                    }
                  }}
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="ahu-picker__add" ref={menuRef}>
        <button
          type="button"
          className="ahu-add-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          + Add unit
        </button>
        {menuOpen && (
          <div className="ahu-add-menu" role="menu">
            <button
              type="button"
              className="ahu-add-menu__opt"
              onClick={() => {
                onAdd('multizone');
                setMenuOpen(false);
              }}
              role="menuitem"
              data-add-type="multizone"
            >
              <div className="ahu-add-menu__title ahu-add-menu__title--multi">
                Multi-zone unit <span className="ahu-add-menu__hint">RTU</span>
              </div>
              <div className="ahu-add-menu__desc">
                Full Appendix A — many zones, diversity, critical-zone E<sub>v</sub>.
              </div>
            </button>
            <button
              type="button"
              className="ahu-add-menu__opt"
              onClick={() => {
                onAdd('singlezone');
                setMenuOpen(false);
              }}
              role="menuitem"
              data-add-type="singlezone"
            >
              <div className="ahu-add-menu__title ahu-add-menu__title--single">
                Single-zone unit <span className="ahu-add-menu__hint">DOAS</span>
              </div>
              <div className="ahu-add-menu__desc">
                Simplified §6.2.5.1 — one space, E<sub>v</sub> = 1, V<sub>ot</sub> = V<sub>oz</sub>.
              </div>
            </button>
            <div className="ahu-add-menu__note">Unit type is fixed once created.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline-editable label for an AHU tab.
 *
 * - Reads `name` for display.
 * - Double-click the span → swap to a focused text input pre-selected.
 * - Enter or blur → commit (revert on empty / whitespace).
 * - Esc → revert without committing.
 *
 * Inert when `editable` is false (inactive tabs keep the plain span so
 * the double-click affordance doesn't compete with "click to switch").
 */
function AhuTabName({
  id,
  name,
  editable,
  onRename,
}: {
  id: string;
  name: string;
  editable: boolean;
  onRename: (id: string, name: string) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the draft in sync when the underlying name changes (e.g. after
  // a commit from elsewhere, or after a sibling AHU is renamed and this
  // component re-renders for a different AHU).
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  // Auto-focus + select-all on entering edit mode.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const beginEdit = (): void => {
    if (!editable) return;
    setDraft(name);
    setEditing(true);
  };

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== name) {
      onRename(id, trimmed);
    }
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(name);
    setEditing(false);
  };

  if (!editable || !editing) {
    return (
      <span
        className="ahu-tab__name"
        onDoubleClick={(e) => {
          e.stopPropagation();
          beginEdit();
        }}
        title={editable ? `${name} — double-click to rename` : name}
        data-ahu-name={name}
      >
        {name}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="ahu-tab__name-input"
      value={draft}
      aria-label={`Rename ${name}`}
      data-testid={`ahu-name-input-${id}`}
      // Stop propagation so the wrapping <button> doesn't fire its
      // onClick (which would either navigate away on an inactive tab
      // or do nothing on the active one — but still, avoid bubbling).
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      }}
    />
  );
}
