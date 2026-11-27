import type { ComponentType } from 'react';
import type { ParseKeys, TFunction } from 'i18next';
import type { AppState } from '@/state/appStore';
import type { UIState } from '@/state/slices/types';
import type { SettingId, SettingsGroupId } from '@/utils/settingIds';

export type CommonKey = ParseKeys<'common'>;

export interface SettingBinding {
  field: keyof UIState;
  apply: (value: unknown) => void;
  defaultValue?: () => unknown;
}

export interface SettingRequirement {
  met: (state: AppState) => boolean;
  reasonKey: CommonKey;
  hide?: 'browse' | 'always';
}

interface EntryBase {
  id: SettingId;
  group: SettingsGroupId;
  labelKey: CommonKey;
  hintKey?: CommonKey;
  hintAsNote?: boolean;
  keywordsKey?: CommonKey;
  available?: boolean;
  requires?: SettingRequirement;
  legacy?: boolean;
}

export interface ToggleEntry extends EntryBase {
  kind: 'toggle';
  binding: SettingBinding;
  visual?: ComponentType<{ on: boolean }>;
  inputProps?: Record<string, unknown>;
}

export interface ChoiceOption {
  value: unknown;
  labelKey?: CommonKey;
  label?: string;
}

export interface ChoiceEntry extends EntryBase {
  kind: 'choice';
  binding: SettingBinding;
  options: readonly ChoiceOption[];
  example?: (value: unknown) => string;
  visual?: ComponentType<{ value: string }>;
  valueHintKeys?: Partial<Record<string, CommonKey>>;
}

export interface CustomEntry extends EntryBase {
  kind: 'custom';
  Control: ComponentType;
  inline?: boolean;
  binding?: SettingBinding;
  searchTexts?: (t: TFunction<'common'>) => string[];
}

export type SettingEntry = ToggleEntry | ChoiceEntry | CustomEntry;
