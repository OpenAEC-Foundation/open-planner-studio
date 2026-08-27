import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Trash2, Star, Download, Upload, ArrowUpFromLine, Pencil, Check, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { saveFileDialog } from '@/services/fileAccess';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import type { WorkCalendar } from '@/types/calendar';
import './LibrarySection.css';

/**
 * Backstage → Bibliotheek (spec §7): krimpt tot BEDRIJVENBEHEER (aanmaken/hernoemen/verwijderen,
 * standaardbedrijf) + pool-export/-import. Rechtstreeks resource-poolbeheer en de resource-
 * promoveerknop leven voortaan in de Resources-tab Bedrijfsweergave (Taak 16). De kalender-
 * promoveerknop blijft hier als fase-1-interim (spec §6/§9) tot die ook naar de Resources-tab
 * verhuist. Export is tevens het backupmechanisme (spec §5).
 */
export function LibrarySection() {
  const { t } = useTranslation();
  const companies = useAppStore(s => s.companies);
  const pools = useAppStore(s => s.pools);
  const defaultCompanyId = useAppStore(s => s.defaultCompanyId);
  const addCompany = useAppStore(s => s.addCompany);
  const renameCompany = useAppStore(s => s.renameCompany);
  const removeCompany = useAppStore(s => s.removeCompany);
  const countDocumentsLinkedTo = useAppStore(s => s.countDocumentsLinkedTo);
  const setDefaultCompany = useAppStore(s => s.setDefaultCompany);
  const removePoolCalendar = useAppStore(s => s.removePoolCalendar);
  const updatePoolCalendar = useAppStore(s => s.updatePoolCalendar);
  const promoteCalendarToPool = useAppStore(s => s.promoteCalendarToPool);
  const exportPoolIFC = useAppStore(s => s.exportPoolIFC);
  const setUI = useAppStore(s => s.setUI);
  // Actieve document: bron voor "+ Uit project" (kalender-promoveren, fase-1-interim spec §6/§9).
  const projectCalendars = useAppStore(s => s.calendars);

  const [selectedId, setSelectedId] = useState(defaultCompanyId);
  const selected = companies.find(c => c.id === selectedId) ?? companies[0];
  const pool = pools[selected.id];

  // Bedrijfsnaam als lokale draft (critreview taak 11): commit pas op blur/Enter i.p.v. een
  // store-write (en dus een undo-stap + persist) per toetsaanslag. Wisselt de gebruiker van
  // bedrijf, dan volgt de draft de nieuw geselecteerde naam.
  const [nameDraft, setNameDraft] = useState(selected.name);
  useEffect(() => setNameDraft(selected.name), [selected.id, selected.name]);
  const commitName = () => {
    if (nameDraft.trim() !== '' && nameDraft !== selected.name) renameCompany(selected.id, nameDraft);
    else setNameDraft(selected.name);
  };

  // Promote-keuzelijstje (eindreview-fix; getaakt tot kalenders na Taak 17): staat het
  // promoveerpaneel open, plus een korte succes-melding. Sluiten/wisselen van bedrijf reset beide —
  // geen stale UI-state.
  const [promotePanel, setPromotePanel] = useState<'calendar' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { setPromotePanel(null); setNotice(null); setEditingCalendarId(null); }, [selected.id]);

  const onPromoteCalendar = (cal: WorkCalendar) => {
    const id = promoteCalendarToPool(selected.id, cal);
    if (id) setNotice(t('companyLibrary.added'));
  };

  // Pool-item bewerken (eindreview-fix): inline draft, gecommit pas op "Opslaan" (zelfde
  // niet-per-toetsaanslag-patroon als `nameDraft` hierboven).
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [calDraft, setCalDraft] = useState('');
  const startEditCalendar = (cal: WorkCalendar) => { setEditingCalendarId(cal.id); setCalDraft(cal.name); };
  const saveEditCalendar = () => {
    if (!editingCalendarId) return;
    const trimmed = calDraft.trim();
    if (trimmed !== '') updatePoolCalendar(selected.id, editingCalendarId, { name: trimmed });
    setEditingCalendarId(null);
  };

  const onExport = async () => {
    const content = exportPoolIFC(selected.id);
    if (!content) return;
    const outcome = await saveFileDialog(`bibliotheek-${selected.name}.ifc`, content, [{ name: 'IFC', extensions: ['ifc'] }]);
    // Kwam het bestand via de download-terugval binnen (omgeving zonder schrijfrechten op
    // File System Access-handles), dan staat het in de downloadmap en niet waar de gebruiker het
    // aanwees — zeg dat, anders zoekt hij het op de verkeerde plek.
    if (outcome?.viaDownload) {
      useAppStore.getState().notify({
        severity: 'info',
        messageKey: 'notifications.savedViaDownload',
        params: { name: outcome.name },
        dedupeKey: 'saved-via-download',
      });
    }
  };

  // mpp-nul-data-etappe, DEEL 3 (native-dialog-audit): lokale bevestigings-state i.p.v.
  // `window.confirm()` — zelfde patroon als `LayoutsDialog.tsx`/`BaselineDialog.tsx` (fase 2.10,
  // item 5/architect-besluit 4). Geen globale singleton; `onConfirm` draagt de vervolg-logica die
  // voorheen ná de synchrone `window.confirm()`-return-waarde stond.
  const [pendingRemoveCompany, setPendingRemoveCompany] = useState(false);

  // Bedrijf verwijderen (spec §5): meld hoeveel GEOPENDE documenten (actief + slapend) aan dit
  // bedrijf gekoppeld zijn — `removeCompany` ontkoppelt die expliciet (stempels strippen).
  const onRemoveCompany = () => setPendingRemoveCompany(true);

  return (
    <div className="backstage-panel library-section">
      <h2>{t('companyLibrary.title')}</h2>
      <p className="library-intro">{t('companyLibrary.intro')}</p>
      {/* Issue #19, punt 5: resource-CRUD verhuisde naar de Resources-tab Bibliotheekweergave (dat
          IS de bron nu, met de volledige inline-editor) — deze pagina beheert nog uitsluitend
          bedrijven + kalenders + import/export. Kalenders blijven bewust hier staan (apart TODO). */}
      <p className="library-intro" data-ops-library-resource-hint>{t('companyLibrary.resourceManagementHint')}</p>

      <div className="library-layout">
        <aside className="library-companies">
          <div className="library-companies-head">
            <span>{t('companyLibrary.companies')}</span>
            <button onClick={() => setSelectedId(addCompany(t('companyLibrary.newCompany')))} title={t('companyLibrary.addCompany')}>
              <Plus size={14} />
            </button>
          </div>
          <ul>
            {companies.map(c => (
              <li key={c.id} className={c.id === selected.id ? 'active' : ''} onClick={() => setSelectedId(c.id)}>
                <Building2 size={13} />
                <span>{c.name}</span>
                {c.id === defaultCompanyId && <Star size={12} className="default-star" />}
              </li>
            ))}
          </ul>
        </aside>

        <section className="library-detail">
          <div className="library-detail-head">
            <input
              className="library-name-input"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              aria-label={t('companyLibrary.companyName')}
            />
            <div className="library-detail-actions">
              <button onClick={() => setDefaultCompany(selected.id)} disabled={selected.id === defaultCompanyId}>
                <Star size={13} /> {t('companyLibrary.setDefault')}
              </button>
              <button onClick={() => { void onExport(); }}><Download size={13} /> {t('companyLibrary.export')}</button>
              {/* Fix B1: importdoel = het GEOPENDE bedrijf (`selected.id`), niet stilzwijgend het
                  standaardbedrijf — anders overschrijft "Bibliotheek → Importeren" vanuit een ander
                  bedrijf dan het standaardbedrijf per ongeluk de verkeerde pool. */}
              <button onClick={() => setUI({ showPoolImportDialog: true, poolImportCompanyId: selected.id })}><Upload size={13} /> {t('companyLibrary.import')}</button>
              <button
                className="danger"
                onClick={onRemoveCompany}
                disabled={companies.length <= 1}
                title={companies.length <= 1 ? t('companyLibrary.cannotRemoveLast') : ''}
              >
                <Trash2 size={13} /> {t('companyLibrary.removeCompany')}
              </button>
            </div>
          </div>

          <p className="library-backup-hint">{t('companyLibrary.backupHint')}</p>

          {notice && (
            <p className="library-notice" data-ops-library-notice>
              <Check size={13} /> {notice}
            </p>
          )}

          <div className="library-pool">
            <h3>
              {t('companyLibrary.calendars')} <span className="pool-version">v{pool.poolVersion}</span>
              <button
                className="library-promote-toggle"
                onClick={() => { setPromotePanel(p => (p === 'calendar' ? null : 'calendar')); setNotice(null); }}
              >
                <Plus size={12} /> {t('companyLibrary.promoteFromProject')}
              </button>
            </h3>
            {promotePanel === 'calendar' && (
              <div className="library-promote-panel" data-ops-promote-calendar-panel>
                <ul>
                  {projectCalendars.map(cal => {
                    const linked = cal.libraryOrigin?.companyId === selected.id;
                    return (
                      <li key={cal.id}>
                        <span>{cal.name}</span>
                        {linked ? (
                          <span className="library-promote-linked">{t('companyLibrary.alreadyLinked')}</span>
                        ) : (
                          <button className="library-promote-item" onClick={() => onPromoteCalendar(cal)}>
                            <ArrowUpFromLine size={12} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {pool.calendars.length === 0 && <p className="empty">{t('companyLibrary.noCalendars')}</p>}
            <ul>
              {pool.calendars.map(cal => (
                editingCalendarId === cal.id ? (
                  <li key={cal.id} className="library-pool-item-edit">
                    <input
                      className="library-item-name-input"
                      value={calDraft}
                      onChange={e => setCalDraft(e.target.value)}
                      aria-label={t('companyLibrary.field.name')}
                      autoFocus
                    />
                    <div className="library-pool-item-edit-actions">
                      <button className="confirm-icon" onClick={saveEditCalendar} title={t('save')}><Check size={12} /></button>
                      <button className="cancel-icon" onClick={() => setEditingCalendarId(null)} title={t('cancel')}><X size={12} /></button>
                    </div>
                  </li>
                ) : (
                  <li key={cal.id}>
                    <span>{cal.name}</span>
                    <div className="library-pool-item-actions">
                      <button className="edit-icon" onClick={() => startEditCalendar(cal)} title={t('companyLibrary.editItem')}><Pencil size={12} /></button>
                      <button className="danger-icon" onClick={() => removePoolCalendar(selected.id, cal.id)}><Trash2 size={12} /></button>
                    </div>
                  </li>
                )
              ))}
            </ul>
          </div>

          <p className="library-promote-hint">
            <ArrowUpFromLine size={13} /> {t('companyLibrary.promoteHint')}
          </p>
        </section>
      </div>

      {pendingRemoveCompany && (
        // mpp-nul-data-etappe, DEEL 3 — vervangt `window.confirm()`, zie `onRemoveCompany` hierboven.
        <ConfirmDialog
          message={
            countDocumentsLinkedTo(selected.id) > 0
              ? t('companyLibrary.removeCompanyConfirmLinked', { count: countDocumentsLinkedTo(selected.id) })
              : t('companyLibrary.removeCompanyConfirm')
          }
          danger
          onConfirm={() => { removeCompany(selected.id); setPendingRemoveCompany(false); }}
          onCancel={() => setPendingRemoveCompany(false)}
        />
      )}
    </div>
  );
}
