import { EZ_CONFIGS } from '../lib/tables';

export interface EzHelpDialogProps {
  rows: typeof EZ_CONFIGS;
  onClose: () => void;
}

export function EzHelpDialog({ rows, onClose }: EzHelpDialogProps): JSX.Element {
  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ez-help-title"
      onClick={onClose}
    >
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3 id="ez-help-title">Table 6-2 · Zone Air Distribution Effectiveness</h3>
        <table>
          <thead>
            <tr>
              <th className="num">E<sub>z</sub></th>
              <th>Configuration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value, short]) => (
              <tr key={label}>
                <td className="num">
                  {value.toFixed(2)} <span className="muted">({short})</span>
                </td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
