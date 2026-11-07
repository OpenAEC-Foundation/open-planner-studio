import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_REPORT_SETTINGS, loadReportSettings, saveReportSettings, type ReportSettings,
} from '@/utils/reportSettings';
import { markReportInput } from './studioPerf';

/** De velden die per stap bij "Standaard" horen. */
export type StudioSettingKey = keyof ReportSettings;

export interface StudioSettingsApi {
  settings: ReportSettings;
  /** De opgeslagen voorkeuren zijn geladen; vóór dat moment tekent het papier niets. */
  hydrated: boolean;
  patch: (patch: Partial<ReportSettings>, input?: string) => void;
  /** Zet de velden van één stap terug op de standaard; ongedaan te maken met `undoReset`. */
  resetFields: (keys: readonly StudioSettingKey[], label: string) => void;
  /** De laatste "Standaard" met zijn naam, zolang hij nog ongedaan te maken is. */
  lastReset: { label: string } | null;
  undoReset: () => void;
  dismissReset: () => void;
}

/** Staan deze velden op de standaard? Arrays (kolommen) worden per element vergeleken. */
export function fieldsAreDefault(settings: ReportSettings, keys: readonly StudioSettingKey[]): boolean {
  return keys.every(key => {
    const a = settings[key];
    const b = DEFAULT_REPORT_SETTINGS[key];
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
    return a === b;
  });
}

/**
 * De rapportinstellingen van het nieuwe Rapport-tabblad: dezelfde sleutel `ops-reportSettings` als het
 * oude paneel (per apparaat), geladen bij openen en bewaard bij elke wijziging. Eén object in plaats van
 * vijfentwintig losse states, zodat Standaard en ongedaan maken over een hele stap kunnen gaan.
 *
 * Dezelfde valkuil als in `ReportPanel`: opslaan pas ná het laden, anders overschrijft de eerste render
 * de opgeslagen voorkeuren met de standaard.
 */
export function useStudioSettings(): StudioSettingsApi {
  const [settings, setSettings] = useState<ReportSettings>(DEFAULT_REPORT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const [lastReset, setLastReset] = useState<{ label: string; previous: ReportSettings } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReportSettings().then(loaded => {
      if (cancelled) return;
      setSettings(loaded);
      hydratedRef.current = true;
      setHydrated(true);
    }, () => {
      if (cancelled) return;
      hydratedRef.current = true;
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    void saveReportSettings(settings).catch(() => {});
  }, [settings]);

  const patch = useCallback((next: Partial<ReportSettings>, input = 'patch') => {
    markReportInput(input);
    setSettings(prev => ({ ...prev, ...next }));
  }, []);

  // De actuele stand voor Standaard en ongedaan maken: buiten een state-updater lezen, zodat er geen
  // tweede setState vanuit een updater nodig is.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastResetRef = useRef(lastReset);
  lastResetRef.current = lastReset;

  const resetFields = useCallback((keys: readonly StudioSettingKey[], label: string) => {
    markReportInput('reset');
    const previous = settingsRef.current;
    const next = { ...previous };
    for (const key of keys) {
      const value = DEFAULT_REPORT_SETTINGS[key];
      (next as Record<string, unknown>)[key] = Array.isArray(value) ? [...value] : value;
    }
    setLastReset({ label, previous });
    setSettings(next);
  }, []);

  const undoReset = useCallback(() => {
    const current = lastResetRef.current;
    if (!current) return;
    markReportInput('undo');
    setSettings(current.previous);
    setLastReset(null);
  }, []);

  const dismissReset = useCallback(() => setLastReset(null), []);

  return {
    settings, hydrated, patch, resetFields,
    lastReset: lastReset ? { label: lastReset.label } : null,
    undoReset, dismissReset,
  };
}
