import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Icon } from '@/components/icons';
import { DATE_PICKER_ICONS, DatePickerPanel } from './DatePicker';
import { parsePersonalDate } from '@/utils/displayDate';
import type { DateNotation } from '@/state/slices/types';

export function parseFlexibleDate(raw: string): string | null {
  return parsePersonalDate(raw, 'dmy');
}

export type SegKind = 'day' | 'month' | 'year';

export interface SegmentDef {
  kind: SegKind;
  maxLen: number;
  labelKey: 'dateInput.day' | 'dateInput.month' | 'dateInput.year';
}

const DAY_SEG: SegmentDef = { kind: 'day', maxLen: 2, labelKey: 'dateInput.day' };
const MONTH_SEG: SegmentDef = { kind: 'month', maxLen: 2, labelKey: 'dateInput.month' };
const YEAR_SEG: SegmentDef = { kind: 'year', maxLen: 4, labelKey: 'dateInput.year' };

interface DateFormat {
  order: SegmentDef[];
  separator: string;
}

const SEG_BY_KIND: Record<SegKind, SegmentDef> = { day: DAY_SEG, month: MONTH_SEG, year: YEAR_SEG };

const ORDER_BY_NOTATION: Record<DateNotation, SegKind[]> = {
  dmy: ['day', 'month', 'year'],
  mdy: ['month', 'day', 'year'],
  ymd: ['year', 'month', 'day'],
};

export type SegState = Record<SegKind, string>;

const EMPTY_SEG: SegState = { day: '', month: '', year: '' };

export function splitDateValue(value: string): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(T.*)?$/.exec(value);
  return m ? { date: m[1], time: m[2] ?? '' } : { date: '', time: '' };
}

export function isoToSegments(iso: string): SegState {
  const m = splitDateValue(iso).date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ...EMPTY_SEG };
  return { day: m[3], month: m[2], year: m[1] };
}

export type SegStatus = 'empty' | 'incomplete' | 'valid' | 'invalid';

export function computeSeg(seg: SegState): { status: SegStatus; iso: string | null } {
  const filled = [seg.day, seg.month, seg.year].filter(v => v !== '').length;
  if (filled === 0) return { status: 'empty', iso: '' };
  if (filled < 3) return { status: 'incomplete', iso: null };
  const iso = parseFlexibleDate(`${seg.day}-${seg.month}-${seg.year}`);
  return iso ? { status: 'valid', iso } : { status: 'invalid', iso: null };
}

export type DateCommitMode = 'live' | 'blur';

export type DateCommitPhase = 'typing' | 'finish';

export type DateCommitResolution =
  | { kind: 'idle' }
  | { kind: 'write'; iso: string }
  | { kind: 'revert' }
  | { kind: 'error' };

export function resolveDateCommit(
  phase: DateCommitPhase, mode: DateCommitMode, seg: SegState, required = false,
): DateCommitResolution {
  const st = computeSeg(seg);
  if (phase === 'typing') {
    if (mode === 'blur') return { kind: 'idle' };
    if (st.status === 'empty') return required ? { kind: 'idle' } : { kind: 'write', iso: '' };
    if (st.status === 'valid') return { kind: 'write', iso: st.iso! };
    return { kind: 'idle' };
  }
  if (st.status === 'empty') return required ? { kind: 'revert' } : { kind: 'write', iso: '' };
  if (st.status === 'valid') return { kind: 'write', iso: st.iso! };
  if (st.status === 'incomplete') return { kind: 'revert' };
  return { kind: 'error' };
}

export function dateCommitValue(iso: string, value: string): string | null {
  const current = splitDateValue(value);
  if (iso === current.date) return null;
  if (iso === '') return '';
  return iso + current.time;
}

export function nextSegmentState(
  seg: SegState, order: SegmentDef[], i: number, raw: string,
): { seg: SegState; advanceTo: number | null } {
  const def = order[i];
  const digits = raw.replace(/\D/g, '').slice(0, def.maxLen);
  const next = { ...seg, [def.kind]: digits };
  const advanceTo = digits.length >= def.maxLen && i < order.length - 1 ? i + 1 : null;
  return { seg: next, advanceTo };
}

export const DMY_ORDER: SegmentDef[] = [DAY_SEG, MONTH_SEG, YEAR_SEG];

const FOCUS_STYLE: React.CSSProperties = {
  border: '1.5px solid var(--theme-accent)',
  boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.20)',
};
const ERROR_STYLE: React.CSSProperties = {
  border: '1.5px solid var(--error)',
  boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.20)',
};

const SEG_STYLE: React.CSSProperties = {
  border: 'none', outline: 'none', background: 'transparent',
  padding: 0, margin: 0,
  font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
  textAlign: 'center', minWidth: 0,
  fontVariantNumeric: 'tabular-nums',
};

const SEP_STYLE: React.CSSProperties = {
  opacity: 0.55, padding: '0 1px', userSelect: 'none', flexShrink: 0,
};

interface DateTextInputProps {
  value: string;
  onCommit: (iso: string) => void | false;
  required?: boolean;
  invalid?: boolean;
  onDraftValidChange?: (valid: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  commitMode?: DateCommitMode;
}

export function DateTextInput({
  value, onCommit, className = '', style, ariaLabel, title, disabled, placeholder, id,
  commitMode = 'blur', required = false, invalid = false, onDraftValidChange,
}: DateTextInputProps) {
  const { t } = useTranslation('common');
  const notation = useAppStore(s => s.ui.dateNotation);
  const format = useMemo<DateFormat>(
    () => ({ order: ORDER_BY_NOTATION[notation].map(k => SEG_BY_KIND[k]), separator: '-' }),
    [notation],
  );
  const { order } = format;

  const [seg, setSeg] = useState<SegState>(() => isoToSegments(value));
  const [groupFocused, setGroupFocused] = useState(false);
  const [showError, setShowError] = useState(false);
  const [activeKind, setActiveKind] = useState<SegKind>(order[0].kind);

  const refs = useRef<Partial<Record<SegKind, HTMLInputElement | null>>>({});
  const groupRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!groupFocused && !showError) setSeg(isoToSegments(value));
  }, [value, groupFocused, showError]);

  const placeholders = useMemo(() => {
    const hint = placeholder ?? t('dateInput.placeholder');
    const parts = hint.split(/[-/.\s]+/).filter(Boolean);
    const byKind: Record<SegKind, string> = parts.length === 3
      ? { day: parts[0], month: parts[1], year: parts[2] }
      : { day: '', month: '', year: '' };
    return order.map(d => byKind[d.kind]);
  }, [placeholder, t, order]);

  const focusSeg = (i: number, pos: 'start' | 'end' | 'all') => {
    const el = refs.current[order[i].kind];
    if (!el) return;
    el.focus();
    try {
      if (pos === 'all') el.select();
      else { const p = pos === 'end' ? el.value.length : 0; el.setSelectionRange(p, p); }
    } catch {}
  };

  const focusEntry = () => {
    const idx = order.findIndex(d => !seg[d.kind]);
    if (idx === -1) focusSeg(order.length - 1, 'end');
    else focusSeg(idx, 'start');
  };

  const commitFrom = (s: SegState, phase: DateCommitPhase): DateCommitResolution => {
    const res = resolveDateCommit(phase, commitMode, s, required);
    if (res.kind === 'write') {
      const next = dateCommitValue(res.iso, value);
      if (next !== null && onCommit(next) === false) return { kind: 'revert' };
    }
    return res;
  };

  const finish = (s: SegState): { blocked: boolean } => {
    const res = commitFrom(s, 'finish');
    if (res.kind === 'write') {
      setShowError(false);
      if (res.iso !== '') setSeg(isoToSegments(res.iso));
      return { blocked: false };
    }
    if (res.kind === 'revert') {
      setShowError(false);
      setSeg(isoToSegments(value));
      return { blocked: true };
    }
    setShowError(true);
    return { blocked: true };
  };

  const handleChange = (i: number, raw: string) => {
    const { seg: next, advanceTo } = nextSegmentState(seg, order, i, raw);
    setSeg(next);
    setShowError(false);
    commitFrom(next, 'typing');
    if (advanceTo !== null) focusSeg(advanceTo, next[order[advanceTo].kind] ? 'all' : 'start');
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const val = el.value;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === val.length && el.selectionEnd === val.length;

    if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      setPickerOpen(true);
      return;
    }
    if (e.key === 'Enter') {
      const { blocked } = finish(seg);
      if (blocked) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (e.key === 'Escape') {
      const restored = isoToSegments(value);
      const dirty = showError || JSON.stringify(restored) !== JSON.stringify(seg);
      if (!dirty) return;
      e.preventDefault();
      e.stopPropagation();
      setSeg(restored);
      setShowError(false);
      return;
    }
    if (e.key === '-' || e.key === '/' || e.key === '.') {
      e.preventDefault();
      if (val.length > 0 && i < order.length - 1) focusSeg(i + 1, 'start');
      return;
    }
    if (e.key === 'Backspace') {
      if (val === '' && i > 0) { e.preventDefault(); focusSeg(i - 1, 'end'); }
      return;
    }
    if (e.key === 'ArrowLeft') {
      if (atStart && i > 0) { e.preventDefault(); focusSeg(i - 1, 'end'); }
      return;
    }
    if (e.key === 'ArrowRight') {
      if (atEnd && i < order.length - 1) { e.preventDefault(); focusSeg(i + 1, 'start'); }
      return;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const iso = parseFlexibleDate(text.trim());
    if (!iso) return;
    e.preventDefault();
    const segs = isoToSegments(iso);
    setSeg(segs);
    setShowError(false);
    const next = dateCommitValue(iso, value);
    if (next !== null && onCommit(next) === false) setSeg(isoToSegments(value));
  };

  const handleGroupFocus = () => setGroupFocused(true);

  const handleGroupBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
    const next = e.relatedTarget as Node | null;
    if (e.currentTarget.contains(next) || pickerPanelRef.current?.contains(next)) return;
    setPickerOpen(false);
    setGroupFocused(false);
    finish(seg);
  };

  const focusField = () => focusSeg(Math.max(0, order.findIndex(d => d.kind === activeKind)), 'all');

  const pickDate = (iso: string) => {
    focusField();
    setPickerOpen(false);
    setSeg(isoToSegments(iso));
    setShowError(false);
    const next = dateCommitValue(iso, value);
    if (next !== null && onCommit(next) === false) setSeg(isoToSegments(value));
  };

  const closePicker = (restoreFocus: boolean) => {
    if (restoreFocus) focusField();
    setPickerOpen(false);
  };

  const typed = computeSeg(seg);
  const draftValid = typed.status === 'valid' || (typed.status === 'empty' && !required);
  const draftValidRef = useRef(onDraftValidChange);
  draftValidRef.current = onDraftValidChange;
  useEffect(() => { draftValidRef.current?.(draftValid); }, [draftValid]);
  const pickerValue = typed.status === 'valid' && typed.iso ? typed.iso : splitDateValue(value).date;

  const groupBorder = disabled ? null : showError || invalid ? ERROR_STYLE : groupFocused ? FOCUS_STYLE : null;

  return (
    <span
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}
      onFocus={handleGroupFocus}
      onBlur={handleGroupBlur}
    >
      <div
        ref={groupRef}
        id={id}
        role="group"
        aria-label={ariaLabel ?? t('dateInput.group')}
        aria-disabled={disabled || undefined}
        title={title}
        className={className}
        onMouseDown={e => {
          if (disabled) return;
          const target = e.target as HTMLElement;
          if (pickerButtonRef.current?.contains(target)) { e.preventDefault(); return; }
          if (target.tagName !== 'INPUT') { e.preventDefault(); focusEntry(); }
        }}
        style={{
          display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden',
          cursor: disabled ? 'not-allowed' : 'text',
          ...style,
          ...groupBorder,
          ...(disabled ? { opacity: 0.6 } : null),
        }}
      >
        {order.map((def, i) => (
          <Fragment key={def.kind}>
            {i > 0 && <span aria-hidden="true" style={SEP_STYLE}>{format.separator}</span>}
            <input
              ref={el => { refs.current[def.kind] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              tabIndex={def.kind === activeKind ? 0 : -1}
              aria-label={t(def.labelKey)}
              aria-invalid={showError || invalid || undefined}
              value={seg[def.kind]}
              placeholder={placeholders[i]}
              maxLength={def.maxLen}
              style={{ ...SEG_STYLE, width: `${def.maxLen === 4 ? 4.9 : 2.9}ch`, minWidth: `${def.maxLen}ch` }}
              onFocus={() => setActiveKind(def.kind)}
              onMouseUp={e => {
                const el = e.currentTarget;
                if (el.value.length > 0 && el.selectionStart === el.selectionEnd) el.select();
              }}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
            />
          </Fragment>
        ))}
        <span aria-hidden="true" className="ops-date-input__gap" />
        <button
          ref={pickerButtonRef}
          type="button"
          className="ops-date-input__picker"
          tabIndex={-1}
          disabled={disabled}
          aria-label={t('dateInput.openCalendar')}
          title={t('dateInput.openCalendar')}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-keyshortcuts="Alt+ArrowDown"
          data-ops-date-picker-button
          onClick={() => { if (pickerOpen) closePicker(true); else setPickerOpen(true); }}
        >
          <Icon id={DATE_PICKER_ICONS.open} size={14} />
        </button>
      </div>
      {pickerOpen && !disabled && (
        <DatePickerPanel
          anchorRef={groupRef}
          panelRef={pickerPanelRef}
          ignoreRef={pickerButtonRef}
          value={pickerValue}
          ariaLabel={ariaLabel}
          onPick={pickDate}
          onClose={closePicker}
        />
      )}
      {showError && (
        <span
          role="alert"
          className="!text-small"
          style={{
            position: 'absolute', left: 0, top: '100%', marginTop: 2, zIndex: 30,
            lineHeight: 1.2, color: 'var(--error)', whiteSpace: 'nowrap',
            background: 'var(--theme-surface, var(--surface, #fff))',
            border: '1px solid var(--error)', borderRadius: 4, padding: '1px 5px',
            pointerEvents: 'none', boxShadow: 'var(--shadow-pop)',
          }}
        >
          {t('dateInput.invalid')}
        </span>
      )}
    </span>
  );
}
