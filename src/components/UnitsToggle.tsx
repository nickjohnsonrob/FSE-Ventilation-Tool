import type { Units } from '../lib/units';

export interface UnitsToggleProps {
  /** Active unit system (what the UI is currently showing). */
  unitSystem: Units;
  /** Flip the active unit system. The parent persists to localStorage. */
  onToggle: () => void;
}

/**
 * Header button that flips between I-P (cfm, ft²) and SI (m³/s, m²).
 *
 * Mirrors ThemeToggle's visual treatment (icon-btn) so it sits cleanly
 * next to it in the header. The button shows the *current* state, not the
 * action — clicking takes you to the *other* unit system.
 *
 * Math layer is I-P canonical; this button is purely a display preference.
 * All conversion happens at the format.ts boundary via formatFlow /
 * formatArea. Inputs stay in I-P storage regardless of which system the
 * engineer is viewing in.
 */
export function UnitsToggle({ unitSystem, onToggle }: UnitsToggleProps): JSX.Element {
  const isIp = unitSystem === 'ip';
  const currentLabel = isIp ? 'IP' : 'SI';
  const tooltip = isIp ? 'Switch to SI units (m³/s, m²)' : 'Switch to I-P units (cfm, ft²)';
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={onToggle}
      title={tooltip}
      aria-label={`${tooltip} — currently ${currentLabel}`}
      data-testid="units-toggle"
    >
      <span aria-hidden="true">{currentLabel}</span>
    </button>
  );
}
