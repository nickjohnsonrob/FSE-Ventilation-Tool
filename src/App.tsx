import { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { MethodSwitcher } from './components/MethodSwitcher';
import { ZoneTable } from './components/ZoneTable';
import { ResultsBand } from './components/ResultsBand';
import { EzHelpDialog } from './components/EzHelpDialog';
import { ThemeToggle } from './components/ThemeToggle';
import { ExportButton } from './components/ExportButton';
import { AhuPicker } from './components/AhuPicker';
import { EffZoneChart } from './components/EffZoneChart';
import { EquationTrace } from './components/EquationTrace';
import { useAhuState } from './hooks/useAhuState';
import { compute } from './lib/ashrae621';
import { EZ_CONFIGS } from './lib/tables';

/**
 * Top-level app shell.
 *
 * Holds only UI shell state (theme, dialogs). All AHU/zone data lives in
 * the useAhuState hook and is the source of truth for both display and
 * compute(). `compute()` is memoized on `ahu` so editing one zone doesn't
 * recompute the rest of the app.
 */
export function App(): JSX.Element {
  // Theme persisted in localStorage; default to light.
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('fse:theme') === 'dark';
  });
  const [ezHelpOpen, setEzHelpOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(true);
  const ahu = useAhuState();
  const result = useMemo(() => compute(ahu.ahu), [ahu.ahu]);

  // The DS bundle's dark theme is bound to `:root[data-theme="dark"]`,
  // which targets the <html> element. Sync the attribute whenever
  // `dark` changes so toggling actually flips the palette.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      window.localStorage.setItem('fse:theme', dark ? 'dark' : 'light');
    } catch {
      // localStorage may be blocked (private mode, file://); ignore.
    }
  }, [dark]);

  return (
    <div className={`app ${dark ? 'dark' : 'light'}`}>
      <Header
        title="FSE Ventilation Calculation"
        subtitle="ANSI/ASHRAE 62.1-2022 Ventilation Rate Procedure"
      >
        <ExportButton ahu={ahu.ahu} />
        <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
      </Header>

      <main className="container">
        <AhuPicker
          ahus={ahu.ahus}
          activeId={ahu.activeId}
          onSelect={ahu.setActive}
          onAdd={ahu.addUnit}
          onRemove={ahu.removeUnit}
        />

        <MethodSwitcher
          method={ahu.ahu.method ?? 'appendixA'}
          simplifiedMethod={ahu.ahu.simplifiedMethod ?? 'table6-3'}
          onChange={(m) => ahu.patch({ method: m })}
          onSimplifiedMethodChange={(sm) => ahu.patch({ simplifiedMethod: sm })}
        />

        <ZoneTable
          ahu={ahu.ahu}
          result={result}
          onPatchAhu={ahu.patch}
          onPatchZone={ahu.patchZone}
          onAddZone={ahu.addZone}
          onRemoveZone={ahu.removeZone}
          onResetZones={ahu.resetZones}
          onPatchRoom={ahu.patchRoom}
          onAddRoom={ahu.addRoom}
          onRemoveRoom={ahu.removeRoom}
          onShowEzHelp={() => setEzHelpOpen(true)}
        />

        <ResultsBand
          ahu={ahu.ahu}
          result={result}
          open={resultsOpen}
          onToggle={() => setResultsOpen(!resultsOpen)}
        />

        {/* Analysis row: per-zone efficiency chart + equation trace.
            Single-zone units skip the chart (no per-zone breakdown exists
            for §6.2.5.1 — Ev is always 1) but still get the trace. */}
        <div className="analysis-grid">
          {result && 'rows' in result && 'vou' in result && (
            <EffZoneChart ahu={ahu.ahu} result={result} />
          )}
          <EquationTrace ahu={ahu.ahu} result={result} />
        </div>
      </main>

      <footer className="footer">
        <p>
          Calculations follow the Ventilation Rate Procedure of ANSI/ASHRAE Standard 62.1-2022,
          Section 6.2 and Normative Appendix A. Reference rates transcribed from Table 6-1 (
          <code>Rp</code>, <code>Ra</code>) and Table 6-2 (<code>Ez</code>). This tool is a design
          aid — all results must be reviewed by a qualified engineer against the governing edition
          of the standard and the authority having jurisdiction.
        </p>
      </footer>

      {ezHelpOpen && (
        <EzHelpDialog rows={EZ_CONFIGS} onClose={() => setEzHelpOpen(false)} />
      )}
    </div>
  );
}