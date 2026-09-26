/**
 * Compile-time contract: de X8-broncatalogus is volledig en recursief readonly,
 * terwijl de gematerialiseerde documentview juist bewerkbaar blijft.
 */
import type { XerMetadataCatalog, XerMetadataProjectView } from '@/services/xer/xerMetadata';

declare const catalog: XerMetadataCatalog;
declare const projectView: XerMetadataProjectView;

// @ts-expect-error Catalogus-activitycodetypen zijn diep readonly.
catalog.activityCodeTypes[0].name = 'verboden';
// @ts-expect-error Cataloguswaarden zijn diep readonly.
catalog.activityCodeTypes[0].values[0].code = 'verboden';
// @ts-expect-error Catalogus-UDF-definities zijn diep readonly.
catalog.customFieldDefs[0].name = 'verboden';
// @ts-expect-error Catalogusprojecties zijn diep readonly.
catalog.taskProjections[0].activityCodes!.fase = 'verboden';
// @ts-expect-error Catalogusnotities zijn diep readonly.
catalog.taskProjections[0].notes![0].text = 'verboden';
// @ts-expect-error Catalogusissues zijn diep readonly.
catalog.issues[0].line = 0;
// @ts-expect-error Raw row-cellen blijven via dezelfde recursieve catalogustype readonly.
catalog.sourceData.TASKMEMO[0].cells.task_memo = 'verboden';

// Alleen deze gedupliceerde documentview is bewust mutable.
projectView.activityCodeTypes[0].name = 'toegestaan';
projectView.activityCodeTypes[0].values[0].code = 'toegestaan';
projectView.customFieldDefs[0].name = 'toegestaan';
projectView.taskMetadata.get('taak')!.notes![0].text = 'toegestaan';
