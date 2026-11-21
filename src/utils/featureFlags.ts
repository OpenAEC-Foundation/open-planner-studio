import type { ParseKeys } from 'i18next';

export interface FeatureFlag {
  id: string;
  nameKey: ParseKeys<'common'>;
  descriptionKey?: ParseKeys<'common'>;
  /** Technische markering voor nieuwe IFC-data; beïnvloedt de schakelaar of activering niet. */
  writesNewIfcData: boolean;
  /**
   * De eigen UI-teksten van de functie: `ns:pad` of een voorvoegsel `ns:pad.*`. `nameKey` en
   * `descriptionKey` tellen vanzelf mee. De nachtvertaling slaat ze over tot de flag weg is; de release
   * vertaalt ze wel. Leeg alleen als de functie geen eigen tekst heeft. Getoetst in check-translate-night.ts.
   */
  texts: readonly string[];
}

/** Voeg hier tijdelijke functies toe; de demo maakt de verborgen bediening zichtbaar toetsbaar. */
export const FEATURE_FLAGS: FeatureFlag[] = [
  // Demo-flag: alleen titelbalkdecoratie, zonder nieuwe documentgegevens.
  {
    id: 'demo-topbar-animation',
    nameKey: 'settings.demoTopbarAnimation',
    descriptionKey: 'settings.demoTopbarAnimationHint',
    writesNewIfcData: false,
    texts: [], // alleen naam en uitleg
  },
  // #804 fase 1: een IFC-bestand met een gebouwmodel of gegevens van andere programma's openen (bytes-route, scanner,
  // indeling, `ifcSource`). Opslaan van zo'n bestand komt in fase 1c; tot dan weigert de app het, met een melding.
  {
    id: 'ifcForeignContent',
    nameKey: 'settings.ifcForeignContent',
    descriptionKey: 'settings.ifcForeignContentHint',
    writesNewIfcData: true,
    // De nl-sleutels uit de #804-merges op main (#864, #914, #927, #928, #931, #935, #961, #967), plus de
    // meldingen voor een onleesbaar doel uit #870: die geeft alleen de doelcontrole met de flag aan
    // (`refusedWriteTarget` in src/state/ifcForeignGuard.ts).
    texts: [
      'common:ifcExportWithoutModel.*',
      'common:ifcMissingSourceSaveAs.*',
      'common:notifications.exportPlanOnly',
      'common:notifications.ifc2x3PlanningOnly',
      'common:notifications.ifcForeignAutoSaveNotRecorded',
      'common:notifications.ifcForeignAutoSaveRemnant',
      'common:notifications.ifcForeignAutoSaveSaveAsOnly',
      'common:notifications.ifcForeignAutoSaveTargetChanged',
      'common:notifications.ifcForeignDownloadCopy',
      'common:notifications.ifcForeignMergeRefused',
      'common:notifications.ifcForeignNewTargetOnly',
      'common:notifications.ifcForeignOpenSchema',
      'common:notifications.ifcForeignOpenTooLarge',
      'common:notifications.ifcForeignOpenUnsafe',
      'common:notifications.ifcForeignPlaceUnknown',
      'common:notifications.ifcForeignReplaceBlocked',
      'common:notifications.ifcForeignReplaceFailed',
      'common:notifications.ifcForeignReplaceNotRecorded',
      'common:notifications.ifcForeignSaveBlocked',
      'common:notifications.ifcForeignSourceMissing',
      'common:notifications.ifcForeignTargetAutoSave',
      'common:notifications.ifcForeignTargetChanged',
      'common:notifications.ifcForeignTargetExport',
      'common:notifications.ifcForeignTargetGone',
      'common:notifications.ifcForeignTargetSave',
      'common:notifications.ifcSaveChangedWhileWaiting',
      'common:notifications.ifcSourceCopyFailed',
      'common:notifications.ifcUnreadableTargetAutoSave',
      'common:notifications.ifcUnreadableTargetExport',
      'common:notifications.ifcUnreadableTargetSave',
      'common:notifications.recoveryModelNotRestored',
      'menu:projectInfo.ifcSchema.foreignLocked',
    ],
  },
];

export type FeatureFlagValues = Record<string, boolean>;

/** Onbekende ids blijven uit; elke geregistreerde flag volgt de expliciet bewaarde keuze. */
export function isFeatureEnabled(values: Readonly<FeatureFlagValues>, id: string): boolean {
  return FEATURE_FLAGS.some(flag => flag.id === id)
    && Object.prototype.hasOwnProperty.call(values, id) && values[id] === true;
}

/** Alleen booleans overnemen. Bewaarde ids zonder register-entry zijn inert. */
export function parseFeatureFlagValues(raw: unknown): FeatureFlagValues | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === 'boolean'));
}

/** Staat de flag `ifcForeignContent` aan (#804)? Eén plek voor de open-routes; zie `FormatReadOptions.ifcBytes`. */
export function ifcForeignContentEnabled(values: Readonly<FeatureFlagValues>): boolean {
  return isFeatureEnabled(values, 'ifcForeignContent');
}
