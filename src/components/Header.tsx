import type { ReactNode } from 'react';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps): JSX.Element {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="app-header__actions">{children}</div>
    </header>
  );
}
