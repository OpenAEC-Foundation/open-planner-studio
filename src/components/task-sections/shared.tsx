import { useState, useEffect } from 'react';
import type { ResourceCurve } from '@/types/resource';
import type { CustomFieldDef, CustomFieldValue } from '@/types/structure';
import { formatDuration } from '@/utils/durationFormat';
import { parseDuration } from '@/utils/durationFormat';
import { DateTextInput } from '@/components/common/DateTextInput';

/**
 * Gedeelde primitieven voor de taak-sectie-componenten (fase 2.10, golf D — extractie uit
 * `TaskPropertiesPanel.tsx`). Verhuisd naar een neutrale plek (i.p.v. in het paneel-bestand te
 * blijven staan) omdat zowel `TaskPropertiesPanel` als `TaskDialog` als `Ribbon.tsx`
 * (curve-labels in de rapportage-UI) ernaar verwijzen — een import vanuit het paneel zou een
 * cirkelvormige afhankelijkheid geven zodra het paneel zelf secties uit deze map importeert.
 */

export const RESOURCE_CURVES: ResourceCurve[] = ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'];

/** ResourceCurve → i18n-key in de common-namespace (resource.curve.*). `as const` houdt de
 *  literal-keytypes zodat de getypeerde `t(...)` ze accepteert. */
export const CURVE_KEY = {
  UNIFORM: 'resource.curve.uniform',
  FRONT_LOADED: 'resource.curve.frontLoaded',
  BACK_LOADED: 'resource.curve.backLoaded',
  BELL: 'resource.curve.bell',
  EARLY_PEAK: 'resource.curve.earlyPeak',
  LATE_PEAK: 'resource.curve.latePeak',
} as const satisfies Record<ResourceCurve, string>;

/** Getypeerd invoerveld voor één custom field op een taak. */
export function CustomFieldInput({ def, value, onCommit }: {
  def: CustomFieldDef;
  value: CustomFieldValue | undefined;
  onCommit: (value: CustomFieldValue | null) => void;
}) {
  const cls = 'input !text-xs !px-2.5 !py-1.5';
  if (def.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={e => onCommit(e.target.checked ? true : null)}
        className="w-4 h-4 accent-[var(--theme-accent)]"
      />
    );
  }
  if (def.type === 'date') {
    return (
      <DateTextInput
        value={typeof value === 'string' ? value : ''}
        onCommit={v => onCommit(v || null)}
        className={cls}
      />
    );
  }
  if (def.type === 'text') {
    return (
      <input
        value={typeof value === 'string' ? value : ''}
        onChange={e => onCommit(e.target.value || null)}
        className={cls}
      />
    );
  }
  // number / integer / cost
  return (
    <input
      type="number"
      step={def.type === 'integer' ? 1 : 'any'}
      value={typeof value === 'number' ? value : ''}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '') { onCommit(null); return; }
        const n = def.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isFinite(n)) onCommit(n);
      }}
      className={cls}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, type = 'text', min, max, step, disabled }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="input !text-xs !px-2.5 !py-1.5 disabled:opacity-50"
    />
  );
}

/**
 * Duurveld voor een uur-taak (§6.4): tekstinvoer die "20u"/"2d 4u"/"90m" via `parseDuration`
 * accepteert (hele eenheden) en pas op blur/Enter commit — een parse-fout (o.a. decimalen) draait
 * terug naar de vorige waarde. Gekeyd op de taak zodat het bij taakwissel vers seedt.
 */
export function HourDurationField({ minutes, hpd, onCommitMinutes }: {
  minutes: number;
  hpd: number;
  onCommitMinutes: (m: number) => void;
}) {
  const seed = formatDuration(minutes, hpd, 'hours');
  const [val, setVal] = useState(seed);
  useEffect(() => { setVal(seed); }, [seed]);
  const commit = () => {
    const m = parseDuration(val, hpd);
    if (m != null) onCommitMinutes(m); else setVal(seed);
  };
  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
      className="input !text-xs !px-2.5 !py-1.5"
      data-ops-panel-duration
    />
  );
}
