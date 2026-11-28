import type { CSSProperties, ReactNode } from 'react';

export interface VisualChoiceOption {
  key: string;
  label: string;
  visual: ReactNode;
  cardProps?: Record<string, unknown>;
}

export function VisualChoice({ label, options, selectedKey, onSelect, disabled = false }: {
  label: string;
  options: readonly VisualChoiceOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  disabled?: boolean;
}) {
  const style = { '--settings-visual-columns': options.length } as CSSProperties;
  return (
    <div className={`settings-visual-choice${options.length === 2 ? ' is-pair' : ''}`} role="group" aria-label={label} style={style}>
      {options.map(option => {
        const selected = option.key === selectedKey;
        return (
          <button
            key={option.key}
            type="button"
            className={`settings-visual-card ${selected ? 'active' : ''}`}
            aria-pressed={selected}
            disabled={disabled}
            data-ops-choice={option.key}
            onClick={() => onSelect(option.key)}
            {...option.cardProps}
          >
            {option.visual}
            <span className="settings-visual-card-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
