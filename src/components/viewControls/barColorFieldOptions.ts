import {
  fieldOptions,
  groupFieldList,
  type FieldCatalogCtx,
} from '@/components/viewControls/fieldCatalog';
import { effectiveBarColorSelection, isBarColorCandidate } from '@/services/print/barColorCategories';
import type { BarColorSelection } from '@/types/barColor';

export function barColorFieldOptions(ctx: FieldCatalogCtx) {
  return fieldOptions(groupFieldList(ctx).filter(isBarColorCandidate), ctx);
}

export function effectiveBarColorControl(selection: BarColorSelection, ctx: FieldCatalogCtx) {
  return effectiveBarColorSelection(selection, ctx);
}
