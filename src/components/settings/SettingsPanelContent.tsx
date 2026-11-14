import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Icon } from '@/components/icons';
import '@/components/dialogs/SettingsDialog.css';
import './SettingsPanelContent.css';
import {
  GROUP_LABEL_KEYS, SETTINGS_CATALOG, SETTINGS_GROUPS, isSettingChanged, settingEntry,
} from './catalog/settingsCatalog';
import type { SettingId, SettingsGroupId } from '@/utils/settingIds';
import type { SettingEntry } from './catalog/types';
import { matchesSearch, searchTerms, splitKeywords } from './catalog/settingsSearch';
import { SettingRow, choiceOptionLabel } from './SettingRow';

/** Hoe lang een instelling oplicht na een directe link (`openSettingsAt`). */
const HIGHLIGHT_MS = 2000;

/**
 * Eén gedeelde settings-UI die in alle drie de toegangspunten draait (tandwiel, Instellingen-lint →
 * dialoog, en Bestand → Backstage). Links de groepen, rechts de instellingen van de gekozen groep.
 * Zoeken of "Alleen gewijzigd" toont de passende instellingen uit alle groepen, per groep onder een
 * kop. Alle wijzigingen gelden meteen en worden bewaard; er is geen OK of Annuleren.
 * De instellingen zelf staan in `catalog/settingsCatalog.tsx`.
 */
export function SettingsPanelContent({ autoFocusSearch = false }: { autoFocusSearch?: boolean }) {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const [group, setGroup] = useState<SettingsGroupId>('appearance');
  const [query, setQuery] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);
  const [highlight, setHighlight] = useState<SettingId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Welke instellingen nu beschikbaar en gewijzigd zijn, als tekst zodat de selector alleen bij een
  // echte verandering opnieuw rendert (de ui-state verandert ook om andere redenen).
  const availableIds = useAppStore(s => SETTINGS_CATALOG
    .filter(e => !e.requires || e.requires.met(s)).map(e => e.id).join(' '));
  const changedIds = useAppStore(s => SETTINGS_CATALOG
    .filter(e => isSettingChanged(e, s.ui)).map(e => e.id).join(' '));
  const available = useMemo(() => new Set(availableIds.split(' ')), [availableIds]);
  const changed = useMemo(() => new Set(changedIds === '' ? [] : changedIds.split(' ')), [changedIds]);

  // De zoekteksten per instelling in de huidige taal.
  const searchIndex = useMemo(() => new Map(SETTINGS_CATALOG.map(entry => [entry.id, searchTextsOf(entry, t)])),
    // `i18n.language`: de teksten veranderen met de taal, ook als `t` dezelfde functie blijft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]);

  const terms = searchTerms(query);
  const filtering = terms.length > 0 || changedOnly;

  const visible = (entry: SettingEntry): boolean => {
    if (entry.id === highlight) return true;
    const met = available.has(entry.id);
    if (entry.requires?.hide === 'always' && !met) return false;
    if (!filtering) return entry.group === group && (met || !entry.requires?.hide);
    if (changedOnly && !changed.has(entry.id)) return false;
    return matchesSearch(searchIndex.get(entry.id) ?? [], terms);
  };
  const shown = SETTINGS_CATALOG.filter(visible);
  const shownGroups = filtering ? SETTINGS_GROUPS.filter(g => shown.some(e => e.group === g)) : [group];

  // Directe link: een ander scherm zet `settingsFocusId` (via `openSettingsAt`). Het paneel gaat naar
  // de groep, laat de instelling oplichten en geeft hem de focus; daarna is de link verbruikt.
  const focusId = useAppStore(s => s.ui.settingsFocusId);
  useEffect(() => {
    if (!focusId) return;
    setUI({ settingsFocusId: null });
    const entry = settingEntry(focusId);
    if (!entry) return;
    setQuery('');
    setChangedOnly(false);
    setGroup(entry.group);
    setHighlight(entry.id);
  }, [focusId, setUI]);

  useEffect(() => {
    if (!highlight) return;
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-ops-setting="${highlight}"]`);
    row?.scrollIntoView({ block: 'center' });
    row?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);

  // "/" of Ctrl+F (Cmd+F) ergens in het paneel springt naar de zoekbalk, zoals in een browser.
  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const find = (e.key === 'f' || e.key === 'F') && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
    if (find || (e.key === '/' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey)) {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
  };

  // Escape in een gevulde zoekbalk wist eerst de zoekterm; pas de volgende sluit de dialoog.
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && query !== '') {
      e.stopPropagation();
      setQuery('');
    }
  };

  const chooseGroup = (next: SettingsGroupId) => {
    setGroup(next);
    setQuery('');
    setChangedOnly(false);
  };

  return (
    <div className="settings-content" ref={rootRef} onKeyDown={onPanelKeyDown}>
      <nav className="settings-tabs" aria-label={t('settings.groupsNav')}>
        {SETTINGS_GROUPS.map(g => (
          <button
            key={g}
            type="button"
            className={`settings-tab ${!filtering && group === g ? 'active' : ''}`}
            aria-current={!filtering && group === g ? 'page' : undefined}
            data-ops-settings-group={g}
            onClick={() => chooseGroup(g)}
          >
            <span>{t(GROUP_LABEL_KEYS[g])}</span>
            {SETTINGS_CATALOG.some(e => e.group === g && changed.has(e.id)) && (
              <span className="settings-changed-dot" title={t('settings.groupHasChanges')} aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>

      <div className="settings-main">
        <div className="settings-toolbar">
          <div className="settings-search">
            <Icon id="view.search" size={14} aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t('settings.searchPlaceholder')}
              aria-label={t('settings.searchLabel')}
              data-ops-settings-search
            />
            {query !== '' && (
              <button
                type="button"
                className="settings-search-clear"
                aria-label={t('settings.searchClear')}
                title={t('settings.searchClear')}
                onClick={() => { setQuery(''); searchRef.current?.focus(); }}
              >
                <Icon id="ui.close" size={12} aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            className={`settings-filter ${changedOnly ? 'active' : ''}`}
            aria-pressed={changedOnly}
            disabled={changed.size === 0 && !changedOnly}
            data-ops-settings-changed-only
            onClick={() => setChangedOnly(v => !v)}
          >
            {t('settings.changedOnly', { n: changed.size })}
          </button>
        </div>

        <div className="settings-tab-content">
          {shown.length === 0 && (
            <p className="settings-empty" data-ops-settings-empty>
              {terms.length > 0 ? t('settings.searchEmpty', { query: query.trim() }) : t('settings.changedEmpty')}
            </p>
          )}
          {shownGroups.map(g => (
            <section key={g} className="settings-group" aria-label={t(GROUP_LABEL_KEYS[g])}>
              <h3 className="settings-group-title">{t(GROUP_LABEL_KEYS[g])}</h3>
              <div className="settings-section-list">
                {shown.filter(e => e.group === g).map(entry => (
                  <SettingRow key={entry.id} entry={entry} highlighted={entry.id === highlight} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Alles waarop een instelling gevonden moet worden: naam, uitleg, keuzes, zoekwoorden en groep. */
function searchTextsOf(entry: SettingEntry, t: ReturnType<typeof useTranslation<'common'>>['t']): string[] {
  const texts = [t(entry.labelKey), t(GROUP_LABEL_KEYS[entry.group])];
  if (entry.hintKey) texts.push(t(entry.hintKey));
  if (entry.keywordsKey) texts.push(...splitKeywords(t(entry.keywordsKey)));
  if (entry.kind === 'choice') texts.push(...entry.options.map(o => choiceOptionLabel(entry, o, t)));
  if (entry.kind === 'custom' && entry.searchTexts) texts.push(...entry.searchTexts(t));
  return texts;
}
