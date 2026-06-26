import { useEffect, useRef, useState } from 'react';
import type { AhuInput } from '../lib/ashrae621';

export interface AhuPickerProps {
  ahus: AhuInput[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: (type: AhuInput['type']) => string;
  onRemove: (id: string) => void;
}

/**
 * Air-handler picker — matches the v1.0.0 "unit rail" header strip.
 * Renders a horizontally-scrollable chip row with one chip per AHU, plus a
 * dashed `+ Add unit` button that opens a small menu to pick multizone
 * (RTU) vs singlezone (DOAS). Each chip has a close × that hides itself
 * when only one AHU remains.
 */
export function AhuPicker({
  ahus,
  activeId,
  onSelect,
  onAdd,
  onRemove,
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
              onClick={() => onSelect(id)}
              title={`${a.name} (${isSingle ? 'Single-zone DOAS' : 'Multi-zone RTU'})`}
              data-ahu-id={id}
              data-ahu-type={a.type}
            >
              <span className={`ahu-tab__badge ahu-tab__badge--${a.type}`}>
                {isSingle ? '1-ZN' : 'MULTI'}
              </span>
              <span className="ahu-tab__name">{a.name}</span>
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