import { Fragment, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RibbonTab } from '@/state/slices/types';
import { RibbonButton, RibbonSmallButton, RibbonGroup, RibbonButtonStack } from './ribbonPrimitives';
import {
  RIBBON_TABS,
  type NsKey, type RibbonButtonSpec, type RibbonItemSpec, type RibbonGroupSpec, type RibbonComponentSpec,
} from './ribbonConfig';

/**
 * Generiek render-pad voor de declaratieve ribbon-config (audit P18) — één component rendert
 * elke tab uit `RIBBON_TABS`, net zoals ExtensionRibbonGroups extensieknoppen uit data rendert.
 *
 * Rules-of-hooks: elke knop met een `use`-binding wordt in zijn EIGEN component-instantie
 * gerenderd (RibbonButtonView) en met een tab-uniek key gemount, zodat een tab-wissel remount
 * i.p.v. de hook-volgorde binnen één instantie te veranderen.
 */

/** Resolveert een 'ns:key'-sleutel naar vertaalde tekst; laadt alle vier de namespaces. */
function useRibbonTranslate() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const { t: tReport } = useTranslation('report');
  return useCallback((full: NsKey): string => {
    const idx = full.indexOf(':');
    const ns = full.slice(0, idx);
    // Runtime-sleutel: de i18next-typing verwacht een letterlijke sleutel-union; hier is de
    // sleutel dynamisch (uit de config), dus `as never` om de argument-typecheck te omzeilen.
    const key = full.slice(idx + 1) as never;
    switch (ns) {
      case 'common': return tCommon(key);
      case 'task': return tTask(key);
      case 'report': return tReport(key);
      default: return tMenu(key);
    }
  }, [tMenu, tCommon, tTask, tReport]);
}

function RibbonButtonView({ spec }: { spec: RibbonButtonSpec }) {
  const t = useRibbonTranslate();
  const b = spec.use ? spec.use() : {};
  const label = t(spec.labelKey);
  const icon = b.icon ?? spec.icon;
  if (spec.kind === 'small') {
    return (
      <RibbonSmallButton
        icon={icon} label={label}
        onClick={b.onClick} active={b.active} disabled={b.disabled} danger={spec.danger} title={b.title}
      />
    );
  }
  return (
    <RibbonButton
      icon={icon} label={label}
      onClick={b.onClick} active={b.active} disabled={b.disabled} primary={spec.primary} danger={spec.danger}
    />
  );
}

function RibbonComponentView({ spec }: { spec: RibbonComponentSpec }) {
  const C = spec.Component;
  return <C />;
}

function RibbonItemView({ item }: { item: RibbonItemSpec }) {
  switch (item.kind) {
    case 'component':
      return <RibbonComponentView spec={item} />;
    case 'stack':
      return (
        <RibbonButtonStack>
          {item.items.map(sub => (
            sub.kind === 'component'
              ? <RibbonComponentView key={sub.id} spec={sub} />
              : <RibbonButtonView key={sub.id} spec={sub} />
          ))}
        </RibbonButtonStack>
      );
    default:
      return <RibbonButtonView spec={item} />;
  }
}

function RibbonGroupView({ group }: { group: RibbonGroupSpec }) {
  const t = useRibbonTranslate();
  return (
    <RibbonGroup label={t(group.labelKey)}>
      {group.items.map(item => <RibbonItemView key={item.id} item={item} />)}
    </RibbonGroup>
  );
}

export function RibbonTabContent({ tab }: { tab: Exclude<RibbonTab, 'file'> }) {
  const groups = RIBBON_TABS[tab];
  return (
    <>
      {groups.map((group, i) => (
        // tab-uniek key → remount bij tab-wissel (rules-of-hooks veilig)
        <Fragment key={`${tab}:${group.id}`}>
          {i > 0 && <div className="ribbon-separator" />}
          <RibbonGroupView group={group} />
        </Fragment>
      ))}
    </>
  );
}
