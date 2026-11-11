import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  chosenReportChange, DEFAULT_REPORT_SETTINGS, loadReportSettings, patchReportSettings, readReportSettings, type ReportSettings,
} from '@/utils/reportSettings';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
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
 * De rapportinstellingen van het Rapport-tabblad: de sleutel `ops-reportSettings`, gedeeld met `ReportPanel`
 * (per apparaat), geladen bij openen en bewaard bij elke wijziging. Eén object in plaats van
 * vijfentwintig losse states, zodat Standaard en ongedaan maken over een hele stap kunnen gaan.
 *
 * De valkuil: opslaan pas ná het laden, anders overschrijft de eerste render
 * de opgeslagen voorkeuren met de standaard.
 *
 * Een andere bron kan de opgeslagen stand vernieuwen: de host die pas na de start antwoordt (#818), of
 * een ander tabblad. Daarom leest de hook bij elke `StorageEvent` op `ops-reportSettings` opnieuw
 * (`useStoredSettingRefresh`), meteen in de gebeurtenis. Elke handeling schrijft meteen, in de klik zelf,
 * precies wat de planner koos (`patchReportSettings`): een keuze, Standaard, een overname uit een layout,
 * ongedaan maken. Nooit de hele kopie, en nooit een verschil tussen twee kopieën: een wijziging van elders die
 * nog niet binnen is, blijft zo staan, en een keuze die de kopie al had, komt toch in de opslag (review Terra
 * #893, rondes 1 tot en met 4). Het herstelpunt van Standaard en een overname komt uit de opslag, en na elke
 * handeling toont het tabblad de samengevoegde stand.
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

  useStoredSettingRefresh('ops-reportSettings', () => {
    void loadReportSettings().then(loaded => {
      setSettings(loaded);
      // Ongedaan maken zou de stand van vóór Standaard over de vernieuwde stand terugzetten.
      setLastReset(null);
    }, () => {});
  });

  // Schrijf een handeling weg en toon daarna de samengevoegde stand uit de opslag: de keuze plus wat er van
  // elders al stond (review Terra #893, ronde 4). Kwam hij niet in de opslag, of is er nog niet geladen (dan
  // zette de standaard van de eerste render de opslag over), dan alleen in deze sessie: `next` over de kopie.
  const commit = useCallback((change: Parameters<typeof patchReportSettings>[0], next: Partial<ReportSettings>) => {
    const merged = hydratedRef.current ? patchReportSettings(change) : null;
    setSettings(merged ?? (prev => ({ ...prev, ...next })));
  }, []);

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
    const base = settingsRef.current;
    commit(stored => chosenReportChange(base, next, stored), next);
  }, [commit]);

  const remember = useCallback((next: Partial<ReportSettings>) => {
    if (Object.entries(next).every(([key, value]) => settingsRef.current[key as StudioSettingKey] === value)) return;
    const base = settingsRef.current;
    commit(stored => chosenReportChange(base, next, stored), next);
  }, [commit]);

  const resetFields = useCallback((scope: string, keys: readonly StudioSettingKey[], label: string, restoreExtra?: () => void) => {
    markReportInput('reset');
    // Het herstelpunt uit de opslag: een optie die elders net veranderde, komt bij ongedaan maken terug.
    const stored = readReportSettings();
    const previous: Partial<ReportSettings> = {};
    const defaults: Partial<ReportSettings> = {};
    for (const key of keys) {
      (previous as Record<string, unknown>)[key] = stored[key];
      const value = DEFAULT_REPORT_SETTINGS[key];
      (defaults as Record<string, unknown>)[key] = Array.isArray(value) ? [...value]
        : value && typeof value === 'object' ? structuredClone(value) : value;
    }
    // De hele stap naar de standaard, ook de opties van een groep die de kopie al op de standaard had.
    commit(defaults, defaults);
    setLastReset({ scope, label, previous, restoreExtra });
  }, [commit]);

  const applyWithUndo = useCallback((
    scope: string, nextValues: Partial<ReportSettings>, text: (keys: readonly StudioSettingKey[]) => string, mergeKey: string,
  ) => {
    markReportInput('apply');
    const stored = readReportSettings();
    // Een tweede overname uit dezelfde layout: de velden van het open herstelpunt houden hun eerste waarde.
    // Zonder samenvoegen zette "Ongedaan maken" alleen de laatste overname terug.
    const pending = lastResetRef.current;
    const previous: Partial<ReportSettings> = pending?.mergeKey === mergeKey ? { ...pending.previous } : {};
    for (const key of Object.keys(nextValues) as StudioSettingKey[]) {
      if (!(key in previous)) (previous as Record<string, unknown>)[key] = stored[key];
    }
    commit(nextValues, nextValues);
    setLastReset({ scope, label: scope, text: text(Object.keys(previous) as StudioSettingKey[]), previous, mergeKey });
  }, [commit]);

  // Precies de stand van vóór Standaard, alleen voor de velden die Standaard terugzette: een later gekozen
  // papierformaat in een andere stap blijft staan.
  const undoReset = useCallback(() => {
    const current = lastResetRef.current;
    if (!current) return;
    markReportInput('undo');
    commit(current.previous, current.previous);
    current.restoreExtra?.();
    setLastReset(null);
  }, [commit]);

  const dismissReset = useCallback(() => setLastReset(null), []);

  const lastResetInfo = useMemo(
    () => (lastReset ? { scope: lastReset.scope, label: lastReset.label, text: lastReset.text } : null),
    [lastReset],
  );
  return {
    settings, hydrated, patch, remember, resetFields, applyWithUndo,
    lastReset: lastResetInfo,
    undoReset, dismissReset,
  };
}
