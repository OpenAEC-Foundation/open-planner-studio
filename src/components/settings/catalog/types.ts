import type { ComponentType } from 'react';
import type { ParseKeys, TFunction } from 'i18next';
import type { AppState } from '@/state/appStore';
import type { UIState } from '@/state/slices/types';
import type { SettingId, SettingsGroupId } from '@/utils/settingIds';

export type CommonKey = ParseKeys<'common'>;

/** De bewaarde waarde achter een instelling: voor de stip "gewijzigd" en "standaard terugzetten".
 *  De standaard is die van een nieuwe store (`createDefaultUI`), dus dezelfde als bij een eerste start. */
export interface SettingBinding {
  field: keyof UIState;
  /** Zet de waarde live en bewaart hem (het vaste recept van `applySetting`). */
  apply: (value: unknown) => void;
  /** Alleen als de nieuwe store de bewaarde keuze al inleest (het thema): de waarde zonder die keuze. */
  defaultValue?: () => unknown;
}

/** Een instelling die alleen iets doet als een andere instelling of het project dat toelaat. */
export interface SettingRequirement {
  met: (state: AppState) => boolean;
  /** Waarom hij niet beschikbaar is; staat onder de instelling als hij uitgegrijsd is. */
  reasonKey: CommonKey;
  /** Weglaten: altijd zichtbaar, uitgegrijsd als niet voldaan. `browse`: in een groep verborgen,
   *  bij zoeken uitgegrijsd zichtbaar (zo vind je hem en zie je waarom hij uit staat). `always`:
   *  verborgen tot hij beschikbaar is, ook bij zoeken (het blok Experimenteel). */
  hide?: 'browse' | 'always';
}

interface EntryBase {
  id: SettingId;
  group: SettingsGroupId;
  labelKey: CommonKey;
  /** Eén zin over het effect; de details staan in het Help-artikel. */
  hintKey?: CommonKey;
  /** De uitleg als gekleurd blok met een i-icoon, voor een zin die je niet mag missen. */
  hintAsNote?: boolean;
  /** Extra zoekwoorden, komma-gescheiden, per taal (ook termen uit MS Project en P6). */
  keywordsKey?: CommonKey;
  /** `false` ⇒ bestaat niet in deze bouw (bv. AI-modus in de platformbouw). */
  available?: boolean;
  requires?: SettingRequirement;
  /** Een vervangen functie: krijgt het label Legacy. */
  legacy?: boolean;
}

export interface ToggleEntry extends EntryBase {
  kind: 'toggle';
  binding: SettingBinding;
  /** Plaatje van uit en aan naast elkaar; een klik op een plaatje kiest die stand. */
  visual?: ComponentType<{ on: boolean }>;
  /** Extra attributen op de checkbox (data-ops-* voor de tests). */
  inputProps?: Record<string, unknown>;
}

export interface ChoiceOption {
  value: unknown;
  labelKey?: CommonKey;
  /** Vaste tekst zonder vertaling (bv. "110%"). */
  label?: string;
}

export interface ChoiceEntry extends EntryBase {
  kind: 'choice';
  binding: SettingBinding;
  options: readonly ChoiceOption[];
  /** Een live voorbeeld achter de keuze, zoals de datum van vandaag in die notatie. */
  example?: (value: unknown) => string;
  /** Met plaatje: kaarten in plaats van een keuzelijst. */
  visual?: ComponentType<{ value: string }>;
  /** Extra uitleg bij de gekozen waarde (bv. wat het wiel doet in de modus Zoom + slepen). */
  valueHintKeys?: Partial<Record<string, CommonKey>>;
}

export interface CustomEntry extends EntryBase {
  kind: 'custom';
  /** De bediening: onder de naam, of met `inline` rechts naast de naam (zoals een keuzelijst). */
  Control: ComponentType;
  inline?: boolean;
  /** Optioneel: dezelfde bewaarde waarde als de andere soorten, voor gewijzigd/terugzetten. */
  binding?: SettingBinding;
  /** Extra zoekteksten, bv. de namen van de bestandsformaten. */
  searchTexts?: (t: TFunction<'common'>) => string[];
}

export type SettingEntry = ToggleEntry | ChoiceEntry | CustomEntry;
