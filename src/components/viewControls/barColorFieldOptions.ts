import {
  fieldOptions,
  groupFieldList,
  type FieldCatalogCtx,
} from '@/components/viewControls/fieldCatalog';
import { effectiveBarColorSelection } from '@/services/print/barColorCategories';
import type { BarColorSelection } from '@/types/barColor';

/** Exact dezelfde veldlijst, volgorde, labels en disambiguatie als de Group-bediening. */
export function barColorFieldOptions(ctx: FieldCatalogCtx) {
  return fieldOptions(groupFieldList(ctx), ctx);
}

/** UI-vorm van de projectfallback; muteert of bewaart de globale keuze bewust niet opnieuw. */
export function effectiveBarColorControl(selection: BarColorSelection, ctx: FieldCatalogCtx) {
  return effectiveBarColorSelection(selection, ctx);
}
