import {
  fieldOptions,
  groupFieldList,
  type FieldCatalogCtx,
} from '@/components/viewControls/fieldCatalog';
import { effectiveBarColorSelection, isBarColorCandidate } from '@/services/print/barColorCategories';
import type { BarColorSelection } from '@/types/barColor';

/** Dezelfde veldlijst, volgorde, labels en disambiguatie als de Group-bediening, minus de velden
 *  die geen kleur kunnen dragen (Resourcetype, issue #173). */
export function barColorFieldOptions(ctx: FieldCatalogCtx) {
  return fieldOptions(groupFieldList(ctx).filter(isBarColorCandidate), ctx);
}

/** UI-vorm van de projectfallback; muteert of bewaart de globale keuze bewust niet opnieuw. */
export function effectiveBarColorControl(selection: BarColorSelection, ctx: FieldCatalogCtx) {
  return effectiveBarColorSelection(selection, ctx);
}
