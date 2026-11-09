import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Wijzigt alleen de opgeslagen stand, zonder meting en zonder dat een "Standaard" vervalt (open stap). */
  remember: (patch: Partial<ReportSettings>) => void;
  /**
   * Zet de velden van één stap terug op de standaard; ongedaan te maken met `undoReset`. `restoreExtra`
   * zet bij ongedaan maken wat buiten deze instellingen valt terug (de bedrijfsnaam).
   */
  resetFields: (scope: string, keys: readonly StudioSettingKey[], label: string, restoreExtra?: () => void) => void;
  /** De laatste "Standaard" met zijn stap en naam, zolang hij nog ongedaan te maken is. */
  lastReset: { scope: string; label: string } | null;
  undoReset: () => void;
  dismissReset: () => void;
}

interface PendingReset {
  scope: string;
  label: string;
  /** Alleen de velden die Standaard terugzette, met hun waarde van vóór Standaard. */
  previous: Partial<ReportSettings>;
  restoreExtra?: () => void;
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
  const [lastReset, setLastReset] = useState<PendingReset | null>(null);

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

  // De actuele stand voor Standaard en ongedaan maken: buiten een state-updater lezen, zodat er geen
  // tweede setState vanuit een updater nodig is.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastResetRef = useRef(lastReset);
  lastResetRef.current = lastReset;

  const patch = useCallback((next: Partial<ReportSettings>, input = 'patch') => {
    markReportInput(input);
    // Een latere wijziging van een veld dat Standaard terugzette, wint: ongedaan maken zou haar anders
    // stil wissen. Een wijziging in een andere stap laat het ongedaan maken staan.
    const pending = lastResetRef.current;
    if (pending && Object.keys(next).some(key => key in pending.previous)) setLastReset(null);
    setSettings(prev => ({ ...prev, ...next }));
  }, []);

  const remember = useCallback((next: Partial<ReportSettings>) => {
    setSettings(prev => (Object.entries(next).every(([key, value]) => prev[key as StudioSettingKey] === value) ? prev : { ...prev, ...next }));
  }, []);

  const resetFields = useCallback((scope: string, keys: readonly StudioSettingKey[], label: string, restoreExtra?: () => void) => {
    markReportInput('reset');
    const current = settingsRef.current;
    const previous: Partial<ReportSettings> = {};
    const next = { ...current };
    for (const key of keys) {
      (previous as Record<string, unknown>)[key] = current[key];
      const value = DEFAULT_REPORT_SETTINGS[key];
      (next as Record<string, unknown>)[key] = Array.isArray(value) ? [...value] : value;
    }
    setLastReset({ scope, label, previous, restoreExtra });
    setSettings(next);
  }, []);

  // Precies de stand van vóór Standaard, alleen voor de velden die Standaard terugzette: een later gekozen
  // papierformaat in een andere stap blijft staan.
  const undoReset = useCallback(() => {
    const current = lastResetRef.current;
    if (!current) return;
    markReportInput('undo');
    setSettings(prev => ({ ...prev, ...current.previous }));
    current.restoreExtra?.();
    setLastReset(null);
  }, []);

  const dismissReset = useCallback(() => setLastReset(null), []);

  const lastResetInfo = useMemo(
    () => (lastReset ? { scope: lastReset.scope, label: lastReset.label } : null),
    [lastReset],
  );
  return {
    settings, hydrated, patch, remember, resetFields,
    lastReset: lastResetInfo,
    undoReset, dismissReset,
  };
}
