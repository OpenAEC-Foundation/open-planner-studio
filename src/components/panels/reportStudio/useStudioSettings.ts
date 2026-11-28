import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_REPORT_SETTINGS, latestReportSettings, patchReportSettings, type ReportSettings, type ReportSettingsPatch,
} from '@/utils/reportSettings';
import { useReportSettings } from '@/hooks/useReportSettings';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { markReportInput } from './studioPerf';

export type StudioSettingKey = keyof ReportSettings;

export interface StudioSettingsApi {
  settings: ReportSettings;
  patch: (patch: ReportSettingsPatch, input?: string) => void;
  remember: (patch: Partial<ReportSettings>) => void;
  resetFields: (scope: string, keys: readonly StudioSettingKey[], label: string, restoreExtra?: () => void) => void;
  applyWithUndo: (
    scope: string, next: Partial<ReportSettings>, text: (keys: readonly StudioSettingKey[]) => string, mergeKey: string,
  ) => void;
  lastReset: { scope: string; label: string; text?: string } | null;
  undoReset: () => void;
  dismissReset: () => void;
}

interface PendingReset {
  scope: string;
  label: string;
  text?: string;
  previous: Partial<ReportSettings>;
  restoreExtra?: () => void;
  mergeKey?: string;
}

export function fieldsAreDefault(settings: ReportSettings, keys: readonly StudioSettingKey[]): boolean {
  return keys.every(key => {
    const a = settings[key];
    const b = DEFAULT_REPORT_SETTINGS[key];
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
    if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
    return a === b;
  });
}

export function useStudioSettings(): StudioSettingsApi {
  const settings = useReportSettings();
  const [lastReset, setLastReset] = useState<PendingReset | null>(null);
  useStoredSettingRefresh('ops-reportSettings', () => setLastReset(null));

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastResetRef = useRef(lastReset);
  lastResetRef.current = lastReset;

  const patch = useCallback((next: ReportSettingsPatch, input = 'patch') => {
    markReportInput(input);
    const pending = lastResetRef.current;
    if (pending && Object.keys(next).some(key => key in pending.previous)) setLastReset(null);
    patchReportSettings(next);
  }, []);

  const remember = useCallback((next: Partial<ReportSettings>) => {
    if (Object.entries(next).every(([key, value]) => settingsRef.current[key as StudioSettingKey] === value)) return;
    patchReportSettings(next);
  }, []);

  const resetFields = useCallback((scope: string, keys: readonly StudioSettingKey[], label: string, restoreExtra?: () => void) => {
    markReportInput('reset');
    const latest = latestReportSettings();
    const previous: Partial<ReportSettings> = {};
    const defaults: Partial<ReportSettings> = {};
    for (const key of keys) {
      (previous as Record<string, unknown>)[key] = latest[key];
      const value = DEFAULT_REPORT_SETTINGS[key];
      (defaults as Record<string, unknown>)[key] = Array.isArray(value) ? [...value]
        : value && typeof value === 'object' ? structuredClone(value) : value;
    }
    patchReportSettings(defaults);
    setLastReset({ scope, label, previous, restoreExtra });
  }, []);

  const applyWithUndo = useCallback((
    scope: string, nextValues: Partial<ReportSettings>, text: (keys: readonly StudioSettingKey[]) => string, mergeKey: string,
  ) => {
    markReportInput('apply');
    const latest = latestReportSettings();
    const pending = lastResetRef.current;
    const previous: Partial<ReportSettings> = pending?.mergeKey === mergeKey ? { ...pending.previous } : {};
    for (const key of Object.keys(nextValues) as StudioSettingKey[]) {
      if (!(key in previous)) (previous as Record<string, unknown>)[key] = latest[key];
    }
    patchReportSettings(nextValues);
    setLastReset({ scope, label: scope, text: text(Object.keys(previous) as StudioSettingKey[]), previous, mergeKey });
  }, []);

  const undoReset = useCallback(() => {
    const current = lastResetRef.current;
    if (!current) return;
    markReportInput('undo');
    patchReportSettings(current.previous);
    current.restoreExtra?.();
    setLastReset(null);
  }, []);

  const dismissReset = useCallback(() => setLastReset(null), []);

  const lastResetInfo = useMemo(
    () => (lastReset ? { scope: lastReset.scope, label: lastReset.label, text: lastReset.text } : null),
    [lastReset],
  );
  return {
    settings, patch, remember, resetFields, applyWithUndo,
    lastReset: lastResetInfo,
    undoReset, dismissReset,
  };
}
