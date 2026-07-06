import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from 'lucide-react';
import {
  fullFieldList, fieldOptions, fieldKind, operatorsForKind, selectOptions,
  type FieldCatalogCtx,
} from '@/components/viewControls/fieldCatalog';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import { DateTextInput } from '@/components/common/DateTextInput';
import type { FieldRef, FilterNode, FilterOperator } from '@/state/slices/types';

type GroupNode = Extract<FilterNode, { kind: 'group' }>;
type RuleNode = Extract<FilterNode, { kind: 'rule' }>;

const defaultRule = (): RuleNode => ({ kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'contains', value: '' });
const defaultGroup = (): GroupNode => ({ kind: 'group', op: 'AND', children: [] });

function encodeField(f: FieldRef): string {
  return JSON.stringify(f);
}
function decodeField(s: string): FieldRef {
  return JSON.parse(s) as FieldRef;
}

/** Waarde-editor die zich aanpast aan het veldtype/de operator (§13.1). */
function RuleValueEditor({
  rule, ctx, onChange,
}: {
  rule: RuleNode;
  ctx: FieldCatalogCtx;
  onChange: (changes: Partial<RuleNode>) => void;
}) {
  const { t } = useTranslation('common');
  const kind = fieldKind(rule.field, ctx);

  if (rule.operator === 'isEmpty') return null;

  if (rule.operator === 'in') {
    const options = selectOptions(rule.field, ctx);
    const selected = Array.isArray(rule.value) ? rule.value : [];
    return (
      <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto border border-border rounded-[6px] p-1.5" style={{ minWidth: 140 }}>
        {options.length === 0 && <span className="text-text-secondary text-[11px]">—</span>}
        {options.map(o => (
          <label key={o.value} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={e => {
                const next = e.target.checked ? [...selected, o.value] : selected.filter(v => v !== o.value);
                onChange({ value: next });
              }}
              className="accent-accent"
            />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (kind === 'boolean') {
    return (
      <select
        value={rule.value === true ? 'true' : rule.value === false ? 'false' : ''}
        onChange={e => onChange({ value: e.target.value === 'true' })}
        className="input !text-xs !px-1.5 !py-1"
        style={{ width: 90, flexShrink: 0 }}
        aria-label={t('view.filter.value')}
      >
        <option value="">—</option>
        <option value="true">{t('yes')}</option>
        <option value="false">{t('no')}</option>
      </select>
    );
  }

  if (kind === 'select') {
    const options = selectOptions(rule.field, ctx);
    return (
      <select
        value={typeof rule.value === 'string' ? rule.value : ''}
        onChange={e => onChange({ value: e.target.value })}
        className="input !text-xs !px-1.5 !py-1"
        style={{ width: 160, flexShrink: 0 }}
        aria-label={t('view.filter.value')}
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (kind === 'number') {
    if (rule.operator === 'between') {
      return (
        <div className="flex items-center gap-1">
          <input type="number" value={typeof rule.value === 'number' ? rule.value : ''} placeholder={t('view.filter.valueFrom') ?? ''}
            onChange={e => onChange({ value: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="input !text-xs !px-1.5 !py-1" style={{ width: 80, flexShrink: 0 }} />
          <input type="number" value={typeof rule.value2 === 'number' ? rule.value2 : ''} placeholder={t('view.filter.valueTo') ?? ''}
            onChange={e => onChange({ value2: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="input !text-xs !px-1.5 !py-1" style={{ width: 80, flexShrink: 0 }} />
        </div>
      );
    }
    return (
      <input type="number" value={typeof rule.value === 'number' ? rule.value : ''}
        onChange={e => onChange({ value: e.target.value === '' ? undefined : Number(e.target.value) })}
        className="input !text-xs !px-1.5 !py-1" style={{ width: 96, flexShrink: 0 }} aria-label={t('view.filter.value')} />
    );
  }

  if (kind === 'date') {
    if (rule.operator === 'between') {
      return (
        <div className="flex items-center gap-1">
          <DateTextInput value={typeof rule.value === 'string' ? rule.value : ''}
            onCommit={v => onChange({ value: v })}
            className="input !text-xs !px-1.5 !py-1" style={{ width: 140, flexShrink: 0 }} />
          <DateTextInput value={typeof rule.value2 === 'string' ? rule.value2 : ''}
            onCommit={v => onChange({ value2: v })}
            className="input !text-xs !px-1.5 !py-1" style={{ width: 140, flexShrink: 0 }} />
        </div>
      );
    }
    return (
      <DateTextInput value={typeof rule.value === 'string' ? rule.value : ''}
        onCommit={v => onChange({ value: v })}
        className="input !text-xs !px-1.5 !py-1" style={{ width: 140, flexShrink: 0 }} ariaLabel={t('view.filter.value')} />
    );
  }

  // text
  return (
    <input type="text" value={typeof rule.value === 'string' ? rule.value : ''}
      onChange={e => onChange({ value: e.target.value })}
      className="input !text-xs !px-1.5 !py-1 flex-1 min-w-0" aria-label={t('view.filter.value')} />
  );
}

function RuleEditor({
  rule, ctx, fields, onChange, onRemove,
}: {
  rule: RuleNode;
  ctx: FieldCatalogCtx;
  fields: FieldRef[];
  onChange: (changes: Partial<RuleNode>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('common');
  const kind = fieldKind(rule.field, ctx);
  const ops = operatorsForKind(kind);
  const options = useMemo(() => fieldOptions(fields, ctx), [fields, ctx]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        value={encodeField(rule.field)}
        onChange={e => {
          const field = decodeField(e.target.value);
          const newKind = fieldKind(field, ctx);
          const newOps = operatorsForKind(newKind);
          onChange({ field, operator: newOps[0], value: undefined, value2: undefined });
        }}
        className="input !text-xs !px-1.5 !py-1"
        style={{ width: 150, flexShrink: 0 }}
        aria-label={t('view.filter.field')}
      >
        {options.map(({ field: f, label }) => <option key={encodeField(f)} value={encodeField(f)}>{label}</option>)}
      </select>
      <select
        value={rule.operator}
        onChange={e => onChange({ operator: e.target.value as FilterOperator, value: undefined, value2: undefined })}
        className="input !text-xs !px-1.5 !py-1"
        style={{ width: 140, flexShrink: 0 }}
        aria-label={t('view.filter.operator')}
      >
        {ops.map(op => <option key={op} value={op}>{t(`view.filter.op.${op}`)}</option>)}
      </select>
      <RuleValueEditor rule={rule} ctx={ctx} onChange={onChange} />
      <button onClick={onRemove} title={t('delete')} style={{ color: 'var(--error)' }} className="flex-shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function GroupEditor({
  node, depth, ctx, fields, onChange, onRemove,
}: {
  node: GroupNode;
  depth: number;
  ctx: FieldCatalogCtx;
  fields: FieldRef[];
  onChange: (updater: (g: GroupNode) => GroupNode) => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation('common');

  return (
    <div
      className="border border-border rounded-[8px] p-2 flex flex-col gap-2"
      style={depth > 0 ? { background: 'var(--theme-hover)' } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <select
          value={node.op}
          onChange={e => onChange(g => ({ ...g, op: e.target.value as 'AND' | 'OR' }))}
          className="input !text-xs !px-1.5 !py-1"
          style={{ width: 220, flexShrink: 0 }}
        >
          <option value="AND">{t('view.filter.all')}</option>
          <option value="OR">{t('view.filter.any')}</option>
        </select>
        {depth > 0 && onRemove && (
          <button onClick={onRemove} title={t('delete')} style={{ color: 'var(--error)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {node.children.length === 0 && (
        <span className="text-text-secondary" style={{ fontSize: 11 }}>{t('view.filter.noRules')}</span>
      )}

      <div className="flex flex-col gap-2">
        {node.children.map((child, i) =>
          child.kind === 'rule' ? (
            <RuleEditor
              key={i}
              rule={child}
              ctx={ctx}
              fields={fields}
              onChange={changes => onChange(g => ({
                ...g,
                children: g.children.map((c, ci) => (ci === i ? { ...c, ...changes } as FilterNode : c)),
              }))}
              onRemove={() => onChange(g => ({ ...g, children: g.children.filter((_, ci) => ci !== i) }))}
            />
          ) : (
            <GroupEditor
              key={i}
              node={child}
              depth={depth + 1}
              ctx={ctx}
              fields={fields}
              onChange={fn => onChange(g => ({
                ...g,
                children: g.children.map((c, ci) => (ci === i ? fn(c as GroupNode) : c)),
              }))}
              onRemove={() => onChange(g => ({ ...g, children: g.children.filter((_, ci) => ci !== i) }))}
            />
          ),
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(g => ({ ...g, children: [...g.children, defaultRule()] }))}
          className="btn btn--sm btn--secondary"
        >
          {t('view.filter.addRule')}
        </button>
        {depth === 0 && (
          <button
            onClick={() => onChange(g => ({ ...g, children: [...g.children, defaultGroup()] }))}
            className="btn btn--sm btn--secondary"
          >
            {t('view.filter.addGroup')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Filter-editor (fase 2.7, §6/§13.1), P6-achtig: All/Any-groepen (in de UI max 2 diep, datastructuur
 * onbeperkt), rijen {veld ▾, operator ▾, waarde}. Waarde-invoer past zich aan het veldtype aan.
 * "Toepassen" schrijft naar `view.filter` (lege root ⇒ `null`, kanoniek "geen filter"); "Wissen" zet
 * direct `filter: null`.
 */
export function FilterDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const viewFilter = useAppStore(s => s.view.filter);
  const setFilter = useAppStore(s => s.setFilter);

  const close = () => setUI({ showFilterDialog: false });

  const [root, setRoot] = useState<GroupNode>(
    () => (viewFilter && viewFilter.kind === 'group' ? viewFilter : defaultGroup()),
  );

  const ctx: FieldCatalogCtx = useFieldCatalogCtx();
  const fields = useMemo(() => fullFieldList(ctx), [ctx]);

  const apply = () => {
    setFilter(root.children.length === 0 ? null : root);
    close();
  };

  const clear = () => {
    setRoot(defaultGroup());
    setFilter(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[640px] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('view.filter.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs">
          <GroupEditor node={root} depth={0} ctx={ctx} fields={fields} onChange={fn => setRoot(fn(root))} />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <button onClick={clear} className="btn btn--sm btn--secondary">
            {t('view.filter.clear')}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={close} className="btn btn--sm btn--secondary">{t('cancel')}</button>
            <button onClick={apply} className="btn btn--sm btn--primary">{t('apply')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
