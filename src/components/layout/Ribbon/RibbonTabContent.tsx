import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RibbonTab } from '@/state/slices/types';
import { RibbonButton, RibbonSmallButton, RibbonGroup, RibbonButtonStack } from './ribbonPrimitives';
import {
  RIBBON_TABS,
  type NsKey, type RibbonButtonSpec, type RibbonItemSpec, type RibbonGroupSpec, type RibbonComponentSpec,
} from './ribbonConfig';

/**
 * Generiek render-pad voor de declaratieve ribbon-config — één component rendert
 * elke tab uit `RIBBON_TABS`, net zoals ExtensionRibbonGroups extensieknoppen uit data rendert.
 *
 * Generieke ankers (`data-tour-anchor`, voor de rondleiding en de begeleiding van extensies) komen
 * hier vandaan, nooit per knop met de hand: `ribbon-group:<tab>:<groupId>` op elke groep en
 * `ribbon:<tab>:<itemId>` op elk item. Een knop-item draagt het anker zelf; een component-item
 * (popover, invoerveld, samengestelde widget) rendert zijn eigen DOM, dus daar zet het render-pad een
 * onzichtbare `<template data-ribbon-anchor>` vóór en een `<template data-ribbon-anchor-end>` ná,
 * waarna `useRibbonAnchorMarkers` (Ribbon.tsx) het anker op precies de elementen daartussen zet.
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

/** Het generieke anker van een lintitem. */
const ribbonItemAnchor = (tab: string, itemId: string) => `ribbon:${tab}:${itemId}`;
/** Het generieke anker van een lintgroep. */
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
        onClick={b.onClick} active={b.active} disabled={b.disabled} danger={spec.danger} title={b.title}
      />
    );
  }
  return (
    <RibbonButton
      icon={icon} label={label} itemId={spec.id} anchor={anchor}
      onClick={b.onClick} active={b.active} disabled={b.disabled} primary={spec.primary} danger={spec.danger}
      title={b.title}
    />
  );
}

function RibbonComponentView({ spec, anchor }: { spec: RibbonComponentSpec; anchor: string }) {
  const C = spec.Component;
  // `<template>` rendert niets en neemt geen plek in (ook niet in het mini-grid van het lint); de twee
  // markeren alleen waar de elementen van dit component beginnen en eindigen.
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

/** Groep + voorafgaande scheidingslijn; een groep met `useVisible() === false` rendert niets. */
function RibbonGroupSlot({ group, first, tab }: { group: RibbonGroupSpec; first: boolean; tab: string }) {
  // `useVisible` is per groep een vaste eigenschap van de config, dus de hookvolgorde is stabiel.
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
        // tab-uniek key → remount bij tab-wissel (rules-of-hooks veilig)
        <RibbonGroupSlot key={`${tab}:${group.id}`} group={group} first={i === 0} tab={tab} />
      ))}
    </>
  );
}
