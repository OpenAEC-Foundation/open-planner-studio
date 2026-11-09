import type { ParseKeys } from 'i18next';

export interface FeatureFlag {
  id: string;
  nameKey: ParseKeys<'common'>;
  descriptionKey?: ParseKeys<'common'>;
  /** Alleen via een ontwikkel-URL; geen zichtbare instelling. */
  hidden?: boolean;
  /** Nieuwe IFC-data: geen checkbox zolang de opslag daarvan nog niet af is. */
  writesNewIfcData: boolean;
}

/** Voeg hier tijdelijke functies toe; de demo maakt de verborgen bediening zichtbaar toetsbaar. */
export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'b2-icons',
    nameKey: 'settings.experimentalSection',
    writesNewIfcData: false,
    hidden: true,
  },
  // Demo-flag: alleen titelbalkdecoratie, zonder nieuwe documentgegevens.
  {
    id: 'demo-topbar-animation',
    nameKey: 'settings.demoTopbarAnimation',
    descriptionKey: 'settings.demoTopbarAnimationHint',
    writesNewIfcData: false,
  },
  // #804 fase 1: een IFC-bestand met een gebouwmodel of gegevens van andere programma's openen (bytes-route, scanner,
  // indeling, `ifcSource`). Opslaan van zo'n bestand komt in fase 1c; tot dan weigert de app het, met een melding.
  // `writesNewIfcData: true`: geen checkbox en altijd uit, tot de IFC-round-trip af is (AGENTS.md, feature flags).
  {
    id: 'ifcForeignContent',
    nameKey: 'settings.ifcForeignContent',
    descriptionKey: 'settings.ifcForeignContentHint',
    writesNewIfcData: true,
  },
];

export type FeatureFlagValues = Record<string, boolean>;

/** Onbekende ids en functies met nog nieuwe IFC-data blijven altijd uit. */
export function isFeatureEnabled(values: Readonly<FeatureFlagValues>, id: string): boolean {
  return FEATURE_FLAGS.some(flag => flag.id === id && !flag.writesNewIfcData)
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
