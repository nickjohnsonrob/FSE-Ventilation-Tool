import type { SimplifiedMethod } from '../lib/tables';
import { SIMPLIFIED_METHODS } from '../lib/tables';

export type CalcMethod = 'appendixA' | 'simplified';

export interface MethodSwitcherProps {
  method: CalcMethod;
  simplifiedMethod: SimplifiedMethod;
  onChange: (m: CalcMethod) => void;
  onSimplifiedMethodChange: (sm: SimplifiedMethod) => void;
}

export function MethodSwitcher({
  method,
  simplifiedMethod,
  onChange,
  onSimplifiedMethodChange,
}: MethodSwitcherProps): JSX.Element {
  return (
    <div>
      <div className="method-switcher" role="tablist" aria-label="Calculation method">
        <button
          role="tab"
          aria-selected={method === 'appendixA'}
          className={method === 'appendixA' ? 'seg seg--on' : 'seg'}
          onClick={() => onChange('appendixA')}
          type="button"
        >
          Appendix A
          <span className="seg__sub">Many zones · diversity</span>
        </button>
        <button
          role="tab"
          aria-selected={method === 'simplified'}
          className={method === 'simplified' ? 'seg seg--on' : 'seg'}
          onClick={() => onChange('simplified')}
          type="button"
        >
          Simplified §6.2.5.1
          <span className="seg__sub">One space · Ev=1</span>
        </button>
      </div>
      {method === 'simplified' && (
        <div className="method-switcher method-switcher--sub" role="radiogroup" aria-label="Simplified procedure">
          {SIMPLIFIED_METHODS.map((sm) => (
            <label
              key={sm.id}
              className={simplifiedMethod === sm.id ? 'seg seg--on' : 'seg'}
            >
              <input
                type="radio"
                name="simplifiedMethod"
                value={sm.id}
                checked={simplifiedMethod === sm.id}
                onChange={() => onSimplifiedMethodChange(sm.id)}
              />
              <span>
                <strong>{sm.label}</strong>
                <span className="seg__sub">{sm.description}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
