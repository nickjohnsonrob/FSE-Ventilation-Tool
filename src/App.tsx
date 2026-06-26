import { useMemo, useState } from 'react';
import { Header } from './components/Header';
import { MethodSwitcher } from './components/MethodSwitcher';
import { ZoneTable } from './components/ZoneTable';
import { ResultsBand } from './components/ResultsBand';
import { EzHelpDialog } from './components/EzHelpDialog';
import { ThemeToggle } from './components/ThemeToggle';
import { ExportButton } from './components/ExportButton';
import { AhuPicker } from './components/AhuPicker';
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
  const [dark, setDark] = useState(false);
  const [ezHelpOpen, setEzHelpOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(true);
  const ahu = useAhuState();
  const result = useMemo(() => compute(ahu.ahu), [ahu.ahu]);

  return (
    <div className={`app ${dark ? 'dark' : 'light'}`} data-theme={dark ? 'dark' : 'light'}>
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