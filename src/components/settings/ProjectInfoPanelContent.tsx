import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, X } from 'lucide-react';
import { Select } from '@/components/common/Select';
import { DateTextInput } from '@/components/common/DateTextInput';
import { formatDate } from '@/utils/dateUtils';
import { PROJECT_TEMPLATES, templatePhases, buildGeneratedCalendar, type TemplateKey } from '@/utils/projectTemplates';
import { CalendarGeneratorFields } from '@/components/dialogs/CalendarGeneratorFields';
import { CalcOptionsSection } from '@/components/dialogs/CalcOptionsSection';
import { computeGenerateSpan, type HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import type { HolidayCountry } from '@/engine/calendar/holidays';
import { WIZARD_PRESETS, SHIFT_PRESET_LABEL, shiftPresetPatch, type ShiftPresetKey } from '@/utils/shiftPresets';
import type { Project, SchedulingOptions } from '@/types/project';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';

/** Wizard-generatorstatus: `HolidayGenParams` uitgebreid met de wizard-only pseudo-keuze
 *  `'custom'` ("Aangepast…", ontwerp §7.2) — die opent na aanmaken de kalenderdialoog i.p.v.
 *  een land-set te genereren. */
type WizardCalendarState = Omit<HolidayGenParams, 'country'> & { country: HolidayCountry | 'none' | 'custom' };

const DEFAULT_WIZARD_CALENDAR: WizardCalendarState = {
  country: 'NL', region: undefined, bouwvak: 'geen', // default GEEN bouwvak (harde eis)
};

/** Pseudo-waarde voor de "+ Nieuwe resourcebibliotheek…"-optie in de bibliotheek-select (issue #19). */
const NEW_COMPANY_OPTION = '__new__';

export interface ProjectInfoPanelContentHandle {
  /** Committeert de huidige draft — wizard ⇒ createNewProject + bibliotheek-koppeling; edit ⇒
   *  setProject + bibliotheek-(ont)koppeling (+ runCPM als de Berekening-sectie wijzigde). */
  submit: () => void;
}

export interface ProjectInfoPanelContentProps {
  /** 'wizard' = nieuw-project-wizard (ui.showNewProjectDialog): toont sjabloon/ploeg-preset/
   *  kalender-generator, geen Berekening-sectie.
   *  'edit' = bestaand project bewerken — zowel de dialoog-op-bestaand-project als de
   *  Backstage → Projectinfo-sectie draaien in deze modus. */
  mode: 'wizard' | 'edit';
  /** Aangeroepen NA een geslaagde submit(); de wrapper bepaalt wat "klaar" betekent (dialoog sluiten,
   *  Backstage terug naar Start-tab). */
  onDone: () => void;
  /** Autofocus op het Naam-veld — ALLEEN de modale dialoog/wizard mag dit aanzetten (GO-NA-fix 4):
   *  in de niet-modale Backstage-pagina zou autoFocus bij elk bezoek de focus grijpen. Default: uit. */
  autoFocusName?: boolean;
}

/**
 * Eén gedeelde projectinfo-velden-UI (issue #19), naar het model van `SettingsPanelContent`: dezelfde
 * veld-rendering + commit-logica draait achter twee chrome's — `ProjectInfoDialog` (tevens de
 * nieuw-project-wizard) en de Backstage → Projectinfo-sectie (`ProjectInfoSection` in Backstage.tsx).
 * Beide worden dunne wrappers die alleen hun eigen container/knoppen + de Dialog-chrome (Esc/backdrop/
 * Enter) leveren.
 *
 * Anders dan Settings (live-apply, geen pending state) werkt projectinfo met een LOKALE DRAFT +
 * expliciete commit: de wrapper bezit de knoppen en roept `submit()` aan via een `ref`
 * (`ProjectInfoPanelContentHandle`) — nodig omdat `Dialog`'s Enter-afhandeling (`onConfirm`) op het
 * BUITENSTE element zit, vóór dit component gemount wordt.
 *
 * Commit-semantiek (KRITISCH, ongewijzigd t.o.v. de oude losse implementaties in ProjectInfoDialog en
 * Backstage's ProjectInfoSection):
 *  - `mode="wizard"`: `createNewProject(...)` + bibliotheek-koppeling (`bindProjectToCompany`) +
 *    herkenning (`computeRecognition` → evt. `showLibraryLinkDialog`).
 *  - `mode="edit"`: `setProject(...)` + bibliotheek-(ont)koppeling (`bindProjectToCompany`/
 *    `unbindProject`) + (bij gewijzigde Berekening-sectie) `runCPM()`.
 *
 * STALE-DRAFT-GUARD (GO-NA-fix 1, code review op bf1c851): `ProjectInfoSection` in Backstage blijft
 * gemount zolang de gebruiker op die pagina staat. `nav.switchDocumentN` (Ctrl+1..9) en `edit.undo`/
 * `edit.redo` (Ctrl+Z/Y) hebben GEEN `when`-guard tegen open dialogen/Backstage (zie
 * `shortcutRegistry.ts`) en negeren alleen invoervelden-met-focus (`isTypingTarget`) — dus een klik
 * buiten een veld gevolgd door zo'n sneltoets kan het ACTIEVE document verwisselen terwijl deze
 * component met de OUDE `useState`-waarden gemount blijft. Twee onafhankelijke vangnetten:
 *  (a) re-init-effect op `activeDocumentId` (documentwissel — swapt `project` als geheel, dus dít is
 *      het bewezen identiteitssignaal; zie hieronder waarom NIET op undo).
 *  (b) `companyTouched`/`calcTouched`: de bibliotheek-(ont)koppeling en de Berekening/runCPM-tak
 *      committeren ALLEEN als de gebruiker die specifieke control in DEZE mount daadwerkelijk heeft
 *      aangeraakt — dus zelfs als (a) een scenario zou missen, kan een stale draft nooit meer stilletjes
 *      een bibliotheek los- of vastkoppelen (het destructieve pad: `unbindProject()` strip ALLE
 *      `libraryOrigin`-stempels).
 *  Over undo specifiek: nagetrokken in `src/state/snapshot.ts` (B3-uitzondering) — het hele
 *  `project`-object (op `wbsAutoNumber` na) staat BEWUST NIET in de undo/redo-snapshot, dus Ctrl+Z/Y
 *  kan `name`/`description`/`author`/`company`/`startDate`/`endDate`/`companyId`/`schedulingOptions`
 *  hier niet veranderen — er is dus niets om voor te re-initialiseren. (a) is daarom bewust gekoppeld
 *  aan `activeDocumentId` (het bewezen vector), en (b) is de generieke vangrail die verder los staat
 *  van WELK mechanisme de staleness veroorzaakt (dus ook toekomstbestendig tegen undo-gedrag dat
 *  later wél projectvelden zou gaan raken).
 */
export const ProjectInfoPanelContent = forwardRef<ProjectInfoPanelContentHandle, ProjectInfoPanelContentProps>(
  function ProjectInfoPanelContent({ mode, onDone, autoFocusName }, ref) {
    const isNew = mode === 'wizard';
    const { t: tMenu } = useTranslation('menu');
    const { t: tCommon } = useTranslation('common');
    const { t: tTask } = useTranslation('task');
    const project = useAppStore(s => s.project);
    const projectCalendar = useAppStore(s => s.calendar);
    const activeDocumentId = useAppStore(s => s.activeDocumentId);
    const activeRibbonTab = useAppStore(s => s.ui.activeRibbonTab);
    const setProject = useAppStore(s => s.setProject);
    const createNewProject = useAppStore(s => s.createNewProject);
    const setUI = useAppStore(s => s.setUI);
    const runCPM = useAppStore(s => s.runCPM);

    const [name, setName] = useState(isNew ? '' : project.name);
    const [description, setDescription] = useState(isNew ? '' : project.description);
    const [author, setAuthor] = useState(isNew ? '' : project.author);
    const [company, setCompany] = useState(isNew ? '' : project.company);
    const [startDate, setStartDate] = useState(isNew ? formatDate(new Date()) : project.startDate);
    const [endDate, setEndDate] = useState(isNew ? '' : project.endDate);
    const [defaultTaskDurationUnit, setDefaultTaskDurationUnit] = useState<'days' | 'hours'>(
      isNew ? 'days' : (project.defaultTaskDurationUnit ?? 'days'),
    );
    // Berekening-sectie als DRAFT (fase 2.9-fix): net als Naam/Omschrijving bewerkt de Berekening-sectie
    // een lokale kopie; de store wijzigt pas op submit() (consistent Annuleren-gedrag). Vers gemount ⇒
    // initialiseert uit het huidige project.
    const [schedulingOptions, setSchedulingOptionsRaw] = useState<SchedulingOptions>(
      isNew ? {} : (project.schedulingOptions ?? {}),
    );
    // Bouwmodus (2026-07-13): in bouw-agnostische modus (bouwmodus UIT) start de kalender-generator op
    // `country: 'none'` (geen NL-feestdagen) i.p.v. NL. Het component wordt vers gemount, dus de
    // useState-initializer leest de vlag eenmalig — geen re-init nodig.
    const constructionMode = useAppStore(s => s.ui.constructionMode);
    const [calState, setCalState] = useState<WizardCalendarState>(() =>
      constructionMode
        ? DEFAULT_WIZARD_CALENDAR
        : { country: 'none', region: undefined, bouwvak: 'geen' },
    );
    const [template, setTemplate] = useState<TemplateKey>('empty');
    const companies = useAppStore(s => s.companies);
    const defaultCompanyId = useAppStore(s => s.defaultCompanyId);
    const bindProjectToCompany = useAppStore(s => s.bindProjectToCompany);
    const unbindProject = useAppStore(s => s.unbindProject);
    const addCompany = useAppStore(s => s.addCompany);
    // Voorselectie: het gekoppelde bedrijf, anders het standaardbedrijf (spec §2 — gekoppeld is de norm).
    const [linkedCompanyId, setLinkedCompanyId] = useState<string>(isNew ? defaultCompanyId : (project.companyId ?? ''));
    // GO-NA-fix 1b: alleen ná een daadwerkelijke gebruikersactie op de bibliotheek-select committeert
    // submit() de bind/unbind-tak (mode="edit"; de wizard-tak heeft geen "vorige koppeling" om per
    // ongeluk te overschrijven en blijft dus ongated).
    const [companyTouched, setCompanyTouched] = useState(false);
    // GO-NA-fix 2: "+ Nieuwe resourcebibliotheek…" toont een inline naamveld i.p.v. meteen te
    // persisteren — de bibliotheek wordt pas in handleSubmit() aangemaakt (zie daar), zodat annuleren
    // van de dialoog/sectie NIETS achterlaat. Twee aparte vlaggen, bewust niet samengevoegd:
    // `creatingCompany` is puur UI (staat het invoervakje open?), `pendingNewCompany` is de
    // COMMIT-intentie (moet handleSubmit() dit materialiseren?) — "bevestigen" sluit het vakje
    // (creatingCompany → false) maar de intentie blijft staan tot submit/annuleren/andere keuze.
    const [creatingCompany, setCreatingCompany] = useState(false);
    const [pendingNewCompany, setPendingNewCompany] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');
    // Ploeg-preset (§6.7): default 'day' = dag-kalender (byte-identiek). Alleen zichtbaar met
    // Urenplanning aan; een niet-default preset materialiseert workTime + shift op de nieuwe kalender.
    const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
    const [shiftPreset, setShiftPreset] = useState<ShiftPresetKey>('day');
    const canDefaultToHours = isNew ? shiftPreset !== 'day' : hasConcreteWorkBlocks(projectCalendar);
    // GO-NA-fix 1b: net als companyTouched — de Berekening-sectie/runCPM-tak committeert ALLEEN als de
    // gebruiker CalcOptionsSection in deze mount daadwerkelijk bewerkte.
    const [calcTouched, setCalcTouched] = useState(false);
    const setSchedulingOptions = (next: SchedulingOptions) => {
      setCalcTouched(true);
      setSchedulingOptionsRaw(next);
    };

    // GO-NA-fix 1a: her-initialiseer de VOLLEDIGE draft zodra het ACTIEVE document verandert
    // (Ctrl+1..9 kan vuren terwijl deze component gemount blijft — zie de JSDoc hierboven). Alléén
    // relevant in edit-modus (de wizard heeft geen "vorig document" om stale te worden). Bewust
    // GEEN afhankelijkheid op losse `project`-velden: elke store-mutatie die toevallig een nieuwe
    // `project`-referentie oplevert zou anders de tekst die de gebruiker nog aan het intypen is
    // wegvegen; `activeDocumentId` is het bewezen, precieze identiteitssignaal (zie snapshot.ts-analyse
    // hierboven — undo raakt geen projectvelden, dus er is daar niets te herinitialiseren).
    const draftDocIdRef = useRef(activeDocumentId);
    useLayoutEffect(() => {
      if (isNew) return;
      if (activeDocumentId === draftDocIdRef.current) return;
      draftDocIdRef.current = activeDocumentId;
      const p = useAppStore.getState().project; // vers — dit IS de state ná de documentwissel
      setName(p.name);
      setDescription(p.description);
      setAuthor(p.author);
      setCompany(p.company);
      setStartDate(p.startDate);
      setEndDate(p.endDate);
      setDefaultTaskDurationUnit(p.defaultTaskDurationUnit ?? 'days');
      setSchedulingOptionsRaw(p.schedulingOptions ?? {});
      setCalcTouched(false);
      setLinkedCompanyId(p.companyId ?? '');
      setCompanyTouched(false);
      setCreatingCompany(false);
      setPendingNewCompany(false);
      setNewCompanyName('');
    }, [isNew, activeDocumentId]);

    // Generatie-spanne bij aanmaak (§4.4): nog geen projecteinde bekend ⇒ startjaar−1..+3.
    const calSpan = useMemo(() => computeGenerateSpan(startDate, endDate || undefined), [startDate, endDate]);

    const handleSubmit = () => {
      // "+ Nieuwe resourcebibliotheek…" materialiseert pas HIER (GO-NA-fix 2) — vóór dit punt bestaat
      // er geen store-mutatie, dus Annuleren van de dialoog/sectie laat niets achter. `pendingNewCompany`
      // (niet `creatingCompany`, dat sluit al bij "bevestigen" — zie confirmNewCompany) blijft de
      // commit-intentie tot hier, dus een bevestigd-maar-niet-meer-open naamveld materialiseert nog
      // steeds correct.
      let effectiveLinkedCompanyId = linkedCompanyId;
      let effectiveCompanyTouched = companyTouched;
      if (pendingNewCompany) {
        const createdId = addCompany(newCompanyName.trim() || tCommon('companyLibrary.newCompany'));
        effectiveLinkedCompanyId = createdId;
        effectiveCompanyTouched = true;
      }

      if (isNew) {
        const isCustom = calState.country === 'custom';
        const calendar = isCustom
          ? buildGeneratedCalendar({ country: 'none', bouwvak: 'geen' }, calSpan)
          : buildGeneratedCalendar(calState as HolidayGenParams, calSpan);
        // Ploeg-preset materialiseren (§6.7): default 'day' laat de kalender een dag-kalender (geen
        // workTime); een niet-default preset zet workTime + shift + scalar-fallback op nieuwe entries.
        if (enableHourPlanning && shiftPreset !== 'day') {
          const patch = shiftPresetPatch(shiftPreset);
          calendar.workTime = patch.workTime;
          calendar.shift = patch.shift;
          calendar.workDays = patch.workDays;
          calendar.workStartHour = patch.workStartHour;
          calendar.workEndHour = patch.workEndHour;
          calendar.hoursPerDay = patch.hoursPerDay;
        }
        createNewProject({
          name, description, author, company, startDate, endDate,
          calendar,
          phaseNames: templatePhases(template),
          defaultTaskDurationUnit: enableHourPlanning && canDefaultToHours ? defaultTaskDurationUnit : 'days',
        });
        // Spec §2/§5: koppel aan het gekozen bedrijf (default = standaardbedrijf). Herkenning start
        // pas als het project al inhoud heeft — bij een vers, leeg project is dat een no-op. Geen
        // touched-gate nodig: een vers project heeft geen "vorige koppeling" om per ongeluk te
        // overschrijven.
        if (effectiveLinkedCompanyId) {
          bindProjectToCompany(effectiveLinkedCompanyId);
          if (useAppStore.getState().computeRecognition().some(c => c.suggestedPoolId)) {
            useAppStore.getState().setUI({ showLibraryLinkDialog: true });
          }
        }
        // Verlaat de Backstage zodat het nieuwe project meteen zichtbaar is; "Aangepast…" opent
        // meteen de kalenderdialoog zodat de gebruiker de kalender handmatig kan samenstellen (§7.2).
        setUI({
          showNewProjectDialog: false,
          ...(isCustom ? { showCalendarDialog: true } : {}),
          ...(activeRibbonTab === 'file' ? { activeRibbonTab: 'start' as const } : {}),
        });
      } else {
        // Committeer de metadata altijd; de Berekening-draft ALLEEN als de gebruiker CalcOptionsSection
        // aanraakte (GO-NA-fix 1b — anders geen spurious dirty / geen onnodige herberekening op een
        // stale of nooit-bekeken draft). Genormaliseerd via JSON-roundtrip zodat undefined-sleutels
        // verdwijnen ⇒ leeg wordt `undefined` (byte-identiek met "geen opties").
        const patch: Partial<Project> = {
          name, description, author, company, startDate, endDate,
          // Een tijdelijk verborgen of momenteel onbruikbare uurdefault blijft documentdata.
          // Nieuwe taken vallen in taskSlice veilig terug op dagen zolang de capability of
          // concrete werkblokken ontbreken; alleen deze voorkeur hier stil terugzetten zou een
          // ongerelateerde metadata-edit echter dataverlies laten veroorzaken.
          defaultTaskDurationUnit,
        };
        let soChanged = false;
        if (calcTouched) {
          const normalized = JSON.parse(JSON.stringify(schedulingOptions)) as SchedulingOptions;
          soChanged = JSON.stringify(normalized) !== JSON.stringify(project.schedulingOptions ?? {});
          if (soChanged) patch.schedulingOptions = Object.keys(normalized).length > 0 ? normalized : undefined;
        }
        setProject(patch);
        // GO-NA-fix 1b: bind/unbind ALLEEN als de gebruiker de select in DEZE mount aanraakte — dit is
        // de vangrail tegen de stale-draft-unbind (zie JSDoc hierboven).
        if (effectiveCompanyTouched) {
          const prevCompany = project.companyId ?? '';
          if (effectiveLinkedCompanyId !== prevCompany) {
            if (effectiveLinkedCompanyId) {
              bindProjectToCompany(effectiveLinkedCompanyId);
              if (useAppStore.getState().computeRecognition().some(c => c.suggestedPoolId)) {
                useAppStore.getState().setUI({ showLibraryLinkDialog: true });
              }
            } else {
              unbindProject();
            }
          }
        }
        if (calcTouched && soChanged) runCPM();
      }
      onDone();
    };

    // BEWUST geen dependency-array: elke render moet de NIEUWSTE `handleSubmit`-closure (met de
    // actuele draft-state) aan de ref hangen. Een `[]` zou de closure op de EERSTE render bevriezen en
    // submit() daarna altijd de staat van dat allereerste render laten committeren.
    useImperativeHandle(ref, () => ({ submit: handleSubmit }));

    const inputCls =
      'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

    const templateLabel: Record<TemplateKey, string> = {
      empty: tMenu('newProject.tmplEmpty'),
      woningbouw: tMenu('newProject.tmplWoningbouw'),
      utiliteit: tMenu('newProject.tmplUtiliteit'),
    };
    // Bouwmodus UIT (bouw-agnostisch): alleen "Leeg" aanbieden — de bouwsjablonen (woningbouw/
    // utiliteit) zijn bouwjargon en vervallen uit de keuzelijst. Default stond al op 'empty'.
    const templateOptions = PROJECT_TEMPLATES
      .filter(t => constructionMode || t.key === 'empty')
      .map(t => ({ value: t.key, label: templateLabel[t.key] }));

    // "+ Nieuwe resourcebibliotheek…" (GO-NA-fix 2): toont het inline naamveld; de bibliotheek zelf
    // materialiseert pas in handleSubmit(). Kiezen van een BESTAANDE bibliotheek (of "geen") annuleert
    // een eventuele nieuw-aanmaak-intentie stilzwijgend (er is nog niets aangemaakt).
    const handleCompanySelectChange = (value: string) => {
      if (value === NEW_COMPANY_OPTION) {
        setCreatingCompany(true);
        setPendingNewCompany(true);
        setNewCompanyName('');
        return;
      }
      setCompanyTouched(true);
      setCreatingCompany(false);
      setPendingNewCompany(false);
      setLinkedCompanyId(value);
    };
    const cancelNewCompany = () => {
      setCreatingCompany(false);
      setPendingNewCompany(false);
      setNewCompanyName('');
    };
    const confirmNewCompany = () => {
      // Sluit alleen het inline veldje — `pendingNewCompany` blijft AAN, dus de daadwerkelijke
      // aanmaak gebeurt pas in handleSubmit(). Dit is puur een "ik ben klaar met typen"-affordance
      // die het formulier opruimt (de naam blijft zichtbaar in de samenvattingsregel eronder).
      setCreatingCompany(false);
      setCompanyTouched(true);
    };

    return (
      <div className="flex flex-col gap-3 text-xs" data-ops-project-info-panel>
        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tMenu('projectInfo.name')}</label>
          {/* Leeg laten mag: het project blijft dan naamloos in de data en toont overal de
              vertaalde weergavenaam — die staat daarom als placeholder in het veld. */}
          <input value={name} onChange={e => setName(e.target.value)} placeholder={tCommon('project.untitled')} className={inputCls} autoFocus={autoFocusName} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tMenu('projectInfo.description')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.author')}</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tCommon('companyLibrary.linkedCompany')}</label>
            <select
              value={(creatingCompany || pendingNewCompany) ? NEW_COMPANY_OPTION : linkedCompanyId}
              onChange={e => handleCompanySelectChange(e.target.value)}
              className={inputCls}
              data-ops-project-company-select
            >
              <option value="">{tCommon('companyLibrary.noCompanyLinked')}</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_COMPANY_OPTION}>{tCommon('companyLibrary.addNewOption')}</option>
            </select>
            {creatingCompany && (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirmNewCompany(); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelNewCompany(); }
                  }}
                  placeholder={tCommon('companyLibrary.newCompany')}
                  aria-label={tCommon('companyLibrary.companyName')}
                  className={inputCls}
                  autoFocus
                  data-ops-project-new-company-name
                />
                <button
                  type="button"
                  onClick={confirmNewCompany}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('ok')}
                  data-ops-project-new-company-confirm
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={cancelNewCompany}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('cancel')}
                  data-ops-project-new-company-cancel
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {/* Bevestigd-maar-nog-niet-gematerialiseerd: het inline veldje is dicht, maar de naam
                (en de commit-intentie) blijft zichtbaar tot submit()/annuleren/een andere keuze. */}
            {pendingNewCompany && !creatingCompany && (
              <div className="flex items-center gap-1.5 mt-1 text-text-secondary">
                <span data-ops-project-new-company-pending>{newCompanyName.trim() || tCommon('companyLibrary.newCompany')}</span>
                <button
                  type="button"
                  onClick={() => setCreatingCompany(true)}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('companyLibrary.editItem')}
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={cancelNewCompany}
                  className="p-1 hover:bg-surface-hover rounded-[6px] shrink-0"
                  title={tCommon('cancel')}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tCommon('companyLibrary.clientOrg')}</label>
          <input value={company} onChange={e => setCompany(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.startDate')}</label>
            {/* Lokale draftstate zonder undo-kosten, mét live afgeleide feedback (de kalenderspanne
                hieronder rekent mee terwijl je typt) ⇒ hier blijft live committen zinvol. */}
            <DateTextInput value={startDate} onCommit={setStartDate} className={inputCls} commitMode="live" ariaLabel={tMenu('projectInfo.startDate')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.endDate')}</label>
            <DateTextInput value={endDate} onCommit={setEndDate} className={inputCls} commitMode="live" ariaLabel={tMenu('projectInfo.endDate')} />
          </div>
        </div>

        {enableHourPlanning && (
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">
              {tCommon('settings.defaultTaskDurationUnit')}
            </label>
            <Select
              aria-label={tCommon('settings.defaultTaskDurationUnit')}
              value={defaultTaskDurationUnit}
              onChange={value => setDefaultTaskDurationUnit(value as 'days' | 'hours')}
              options={[
                { value: 'days', label: tCommon('duration.days') },
                { value: 'hours', label: tCommon('duration.hours'), disabled: !canDefaultToHours },
              ]}
            />
            <p className="scrollzoom-hint">
              {canDefaultToHours ? tCommon('settings.defaultTaskDurationUnitHint') : tTask('duration.requiresWorkBlocks')}
            </p>
          </div>
        )}

        {isNew && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('newProject.template')}</label>
              <Select aria-label={tMenu('newProject.template')} value={template}
                onChange={v => setTemplate(v as TemplateKey)} options={templateOptions} />
            </div>

            {/* Ploeg-preset (§6.7) — alleen met Urenplanning aan; default 'Dagdienst' = dag-kalender. */}
            {enableHourPlanning && (
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary font-medium">{tCommon('calendar.worktime.shiftPreset')}</label>
                <Select aria-label={tCommon('calendar.worktime.shiftPreset')} value={shiftPreset}
                  onChange={v => setShiftPreset(v as ShiftPresetKey)}
                  options={WIZARD_PRESETS.map(k => ({ value: k, label: tCommon(SHIFT_PRESET_LABEL[k] as 'calendar.shift.day') }))} />
              </div>
            )}

            {/* Feestdagen-generator (fase 2.8a, §7.2): land/regio, bouwvak (default GEEN — harde
                eis) + compacte preview. "Aangepast…" (extra optie in de land-select) verbergt de
                rest van de generator (leeg gestart; de kalenderdialoog opent na aanmaken om
                handmatig te bewerken, zie `handleSubmit`). */}
            <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
            <span className="text-text-secondary font-medium">{tMenu('wizard.calendar.country')}</span>
            <CalendarGeneratorFields
              value={calState}
              onChange={patch => setCalState(s => ({ ...s, ...patch }))}
              fromYear={calSpan.from}
              toYear={calSpan.to}
              noneLabel={tMenu('wizard.calendar.none')}
              extraCountryOptions={[{ value: 'custom', label: tMenu('wizard.calendar.custom') }]}
            />
          </>
        )}

        {/* Berekening-sectie (fase 2.9 §5.7/§7, besluit B5) — alleen bij het bewerken van een
            bestaand project (niet in de nieuw-project-wizard). Draait nu identiek op beide
            edit-oppervlakken (dialoog én Backstage). onChange markeert calcTouched (GO-NA-fix 1b). */}
        {!isNew && <CalcOptionsSection value={schedulingOptions} onChange={setSchedulingOptions} />}
      </div>
    );
  },
);
