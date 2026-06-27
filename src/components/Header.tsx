import type { ReactNode } from 'react';
import { UnitsToggle } from './UnitsToggle';
import type { Units } from '../lib/units';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Active unit system; passed to the UnitsToggle next to the theme toggle. */
  unitSystem?: Units;
  /** Flip the unit system. The parent persists to localStorage. */
  onToggleUnits?: () => void;
  children?: ReactNode;
}

export function Header({
  title,
  subtitle,
  unitSystem,
  onToggleUnits,
  children,
}: HeaderProps): JSX.Element {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="app-header__actions">
        {children}
        {unitSystem !== undefined && onToggleUnits && (
          <UnitsToggle unitSystem={unitSystem} onToggle={onToggleUnits} />
        )}
      </div>
    </header>
  );
}
