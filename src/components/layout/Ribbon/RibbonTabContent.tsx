import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RibbonTab } from '@/state/slices/types';
import { RibbonButton, RibbonSmallButton, RibbonGroup, RibbonButtonStack } from './ribbonPrimitives';
import {
  RIBBON_TABS,
  type NsKey, type RibbonButtonSpec, type RibbonItemSpec, type RibbonGroupSpec, type RibbonComponentSpec,
} from './ribbonConfig';

function useRibbonTranslate() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const { t: tReport } = useTranslation('report');
  return useCallback((full: NsKey): string => {
    const idx = full.indexOf(':');
    const ns = full.slice(0, idx);
    const key = full.slice(idx + 1) as never;
    switch (ns) {
      case 'common': return tCommon(key);
      case 'task': return tTask(key);
      case 'report': return tReport(key);
      default: return tMenu(key);
    }
  }, [tMenu, tCommon, tTask, tReport]);
}

const ribbonItemAnchor = (tab: string, itemId: string) => `ribbon:${tab}:${itemId}`;
const ribbonGroupAnchor = (tab: string, groupId: string) => `ribbon-group:${tab}:${groupId}`;

function RibbonButtonView({ spec, anchor }: { spec: RibbonButtonSpec; anchor: string }) {
  const t = useRibbonTranslate();
  const b = spec.use ? spec.use() : {};
  const label = t(spec.labelKey);
  const icon = b.icon ?? spec.icon;
  if (spec.kind === 'small') {
    return (
      <RibbonSmallButton
        icon={icon} label={label} itemId={spec.id} anchor={anchor}
        onClick={b.onClick} active={b.active} disabled={b.disabled} danger={spec.danger} title={b.title} form={spec.form}
      />
    );
  }
  return (
    <RibbonButton
      icon={icon} label={label} itemId={spec.id} anchor={anchor}
      onClick={b.onClick} active={b.active} disabled={b.disabled} primary={spec.primary} danger={spec.danger}
      title={b.title} form={spec.form}
    />
  );
}

function RibbonComponentView({ spec, anchor }: { spec: RibbonComponentSpec; anchor: string }) {
  const C = spec.Component;
  return (
    <>
      <template data-ribbon-anchor={anchor} />
      <C />
      <template data-ribbon-anchor-end="" />
    </>
  );
}

function RibbonItemView({ item, tab }: { item: RibbonItemSpec; tab: string }) {
  const anchor = ribbonItemAnchor(tab, item.id);
  switch (item.kind) {
    case 'component':
      return <RibbonComponentView spec={item} anchor={anchor} />;
    case 'stack':
      return (
        <RibbonButtonStack anchor={anchor}>
          {item.items.map(sub => (
            sub.kind === 'component'
              ? <RibbonComponentView key={sub.id} spec={sub} anchor={ribbonItemAnchor(tab, sub.id)} />
              : <RibbonButtonView key={sub.id} spec={sub} anchor={ribbonItemAnchor(tab, sub.id)} />
          ))}
        </RibbonButtonStack>
      );
    default:
      return <RibbonButtonView spec={item} anchor={anchor} />;
  }
}

function RibbonGroupView({ group, tab }: { group: RibbonGroupSpec; tab: string }) {
  const t = useRibbonTranslate();
  return (
    <RibbonGroup label={t(group.labelKey)} anchor={ribbonGroupAnchor(tab, group.id)}>
      {group.items.map(item => <RibbonItemView key={item.id} item={item} tab={tab} />)}
    </RibbonGroup>
  );
}

function RibbonGroupSlot({ group, first, tab }: { group: RibbonGroupSpec; first: boolean; tab: string }) {
  const visible = group.useVisible ? group.useVisible() : true;
  if (!visible) return null;
  return (
    <>
      {!first && <div className="ribbon-separator" />}
      <RibbonGroupView group={group} tab={tab} />
    </>
  );
}

export function RibbonTabContent({ tab }: { tab: Exclude<RibbonTab, 'file'> }) {
  const groups = RIBBON_TABS[tab];
  return (
    <>
      {groups.map((group, i) => (
        <RibbonGroupSlot key={`${tab}:${group.id}`} group={group} first={i === 0} tab={tab} />
      ))}
    </>
  );
}
