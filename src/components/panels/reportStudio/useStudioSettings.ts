import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_REPORT_SETTINGS, latestReportSettings, patchReportSettings, type ReportSettings, type ReportSettingsPatch,
} from '@/utils/reportSettings';
import { useReportSettings } from '@/hooks/useReportSettings';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { markReportInput } from './studioPerf';

/** De velden die per stap bij "Standaard" horen. */
export type StudioSettingKey = keyof ReportSettings;

export interface StudioSettingsApi {
  settings: ReportSettings;
  /** In de optiegroepen (`resourceGantt`, `tableReports`) alleen de gewijzigde opties. */
  patch: (patch: ReportSettingsPatch, input?: string) => void;
  /** Wijzigt alleen de opgeslagen stand, zonder meting en zonder dat een "Standaard" vervalt (open stap). */
  remember: (patch: Partial<ReportSettings>) => void;
  /**
   * Zet de velden van één stap terug op de standaard; ongedaan te maken met `undoReset`. `restoreExtra`
   * zet bij ongedaan maken wat buiten deze instellingen valt terug (de bedrijfsnaam).
   */
  resetFields: (scope: string, keys: readonly StudioSettingKey[], label: string, restoreExtra?: () => void) => void;
  /**
   * Zet meerdere velden in één keer, als één stap die ongedaan te maken is (kolommen of balkopties van een
   * layout overnemen, #861). `text` geeft de melding met "Ongedaan maken", bij de velden die dat herstelpunt
   * terugzet. Staat er nog een herstelpunt met dezelfde `mergeKey` (een tweede overname uit dezelfde layout),
   * dan voegt deze stap zijn velden daaraan toe: elk veld houdt zijn eerste waarde, en één keer "Ongedaan
   * maken" zet beide overnames terug (review Sol #847, ronde 4).
   */
  applyWithUndo: (
    scope: string, next: Partial<ReportSettings>, text: (keys: readonly StudioSettingKey[]) => string, mergeKey: string,
  ) => void;
  /** De laatste "Standaard" (of overgenomen deel van een layout) met zijn stap en naam, zolang hij nog ongedaan te maken is. */
  lastReset: { scope: string; label: string; text?: string } | null;
  undoReset: () => void;
  dismissReset: () => void;
}

interface PendingReset {
  scope: string;
  label: string;
  /** Eigen meldingstekst (een overgenomen deel van een layout); zonder tekst "… staat weer op de standaard". */
  text?: string;
  /** Alleen de velden die Standaard terugzette, met hun waarde van vóór Standaard. */
  previous: Partial<ReportSettings>;
  restoreExtra?: () => void;
  /** Overnames met dezelfde sleutel delen dit herstelpunt (`applyWithUndo`). */
  mergeKey?: string;
}

/** Staan deze velden op de standaard? Arrays (kolommen) en objecten (de Resourcediagram-opties) op inhoud. */
export function fieldsAreDefault(settings: ReportSettings, keys: readonly StudioSettingKey[]): boolean {
  return keys.every(key => {
    const a = settings[key];
    const b = DEFAULT_REPORT_SETTINGS[key];
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
    if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
    return a === b;
  });
}

/**
 * De rapportinstellingen van het Rapport-tabblad: de gedeelde stand van `ops-reportSettings` (`useReportSettings`,
 * gedeeld met `ReportPanel` en de werkruimte, per apparaat). Elke handeling schrijft meteen via
 * `patchReportSettings`; er is geen eigen kopie. Eén object in plaats van vijfentwintig losse states, zodat
 * Standaard en ongedaan maken over een hele stap kunnen gaan. Het herstelpunt van Standaard en van een overname
 * komt uit de nieuwste stand (`latestReportSettings`).
 */
export function useStudioSettings(): StudioSettingsApi {
  const settings = useReportSettings();
  const [lastReset, setLastReset] = useState<PendingReset | null>(null);
  // Een andere bron vernieuwde de opslag: ongedaan maken zou de stand van vóór Standaard eroverheen zetten.
  useStoredSettingRefresh('ops-reportSettings', () => setLastReset(null));

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastResetRef = useRef(lastReset);
  lastResetRef.current = lastReset;

  const patch = useCallback((next: ReportSettingsPatch, input = 'patch') => {
    markReportInput(input);
    // Een latere wijziging van een veld dat Standaard terugzette, wint: ongedaan maken zou haar anders
    // stil wissen. Een wijziging in een andere stap laat het ongedaan maken staan.
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
    // Een tweede overname uit dezelfde layout: de velden van het open herstelpunt houden hun eerste waarde.
    // Zonder samenvoegen zette "Ongedaan maken" alleen de laatste overname terug.
    const pending = lastResetRef.current;
    const previous: Partial<ReportSettings> = pending?.mergeKey === mergeKey ? { ...pending.previous } : {};
    for (const key of Object.keys(nextValues) as StudioSettingKey[]) {
      if (!(key in previous)) (previous as Record<string, unknown>)[key] = latest[key];
    }
    patchReportSettings(nextValues);
    setLastReset({ scope, label: scope, text: text(Object.keys(previous) as StudioSettingKey[]), previous, mergeKey });
  }, []);

  // Precies de stand van vóór Standaard, alleen voor de velden die Standaard terugzette: een later gekozen
  // papierformaat in een andere stap blijft staan.
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
