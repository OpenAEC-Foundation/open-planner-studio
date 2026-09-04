import { useState, useMemo, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, X, Check, Unlink2, Library, AlertTriangle } from 'lucide-react';
import type { Resource, ResourceType, AvailabilityStep } from '@/types/resource';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { formatDate } from '@/utils/dateUtils';
import { ResourceCalendarDialog } from '@/components/dialogs/ResourceCalendarDialog';
import { UnitsInput } from '@/components/common/UnitsInput';
import { DateTextInput } from '@/components/common/DateTextInput';
import { isResourceFieldLocked, matchByName, computeResourceHash, normalizeName } from '@/services/library/libraryOps';
import { ResourceOccupancyView } from './ResourceOccupancyView';
import { resourceDisplayColor, nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import { useLiveGridNav } from './hooks/useLiveGridNav';
import { controlKindOf, liveGridNavDirection } from '@/utils/gridNavigation';

const RESOURCE_TYPES: ResourceType[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'];

/**
 * Kolomsleutels van de resourcetabel, in weergavevolgorde — de "velden"-as van de rasternavigatie
 * (issue #48). De "Totaal"-kolom staat er bewust NIET in: die is een berekening, geen invoerveld.
 */
const GRID_FIELDS = ['name', 'type', 'maxUnits', 'calendar', 'cost', 'unit', 'parent'] as const;
type GridField = typeof GRID_FIELDS[number];
/** Rij-id van de concept-rij; die staat als LAATSTE rij in het raster (zie `PendingNewRow`). */
const DRAFT_ROW_ID = '__draft';

/**
 * De concept-rij houdt een VOLLEDIGE resource vast, niet alleen een naam (#48, tweede ronde).
 * Puur lokale component-state: er staat pas iets in de store zodra er een naam is (zie
 * `commitPendingNew`). Bewust géén `id`/`libraryOrigin` — die ontstaan pas bij het committeren.
 */
type ResourceDraft = {
  name: string;
  type: ResourceType;
  maxUnits: number;
  calendarId?: string;
  costPerHour?: number;
  unitOfMeasure?: string;
  parentId?: string;
  /** #21: bewust gekozen kleur uit de concept-rij. Ontbreekt ⇒ de store wijst automatisch de
   *  eerste vrije paletkleur toe (addResource/addPoolResource). */
  color?: string;
};
/** De waarden waarmee een nieuwe rij begint — zichtbaar in de rij zelf, niet verborgen in een default. */
const freshDraft = (): ResourceDraft => ({ name: '', type: 'LABOR', maxUnits: 1 });

const TYPE_KEY = {
  LABOR: 'resource.type.labor',
  EQUIPMENT: 'resource.type.equipment',
  MATERIAL: 'resource.type.material',
  SUBCONTRACTOR: 'resource.type.subcontractor',
  CREW: 'resource.type.crew',
} as const satisfies Record<ResourceType, string>;

const NEW_CAL = '__new';

type ResourceView = 'company' | 'project' | 'occupancy';
type PendingResourceDraft = { variant: 'project' | 'pool'; draft: ResourceDraft };
type SetUI = ReturnType<typeof useAppStore.getState>['setUI'];

/** Reset alleen bij mount of een echte koppelingsovergang; handmatige viewkeuzes blijven staan. */
function useResourceViewReset(companyId: string | undefined, linked: boolean, setUI: SetUI): void {
  useEffect(() => {
    if (useAppStore.getState().ui.resourcesView !== 'project') {
      setUI({ resourcesView: 'project' });
    }
  }, [companyId, linked, setUI]);
}

/** Consumeer één lintverzoek en open precies één lokale concept-rij in de zichtbare tabel. */
function usePendingResourceDraft({
  pendingNewResource,
  openDraft,
  requestFocus,
  setUI,
}: {
  pendingNewResource: boolean;
  openDraft: (view: ResourceView) => void;
  requestFocus: (rowId: string, field: GridField) => void;
  setUI: SetUI;
}): void {
  useEffect(() => {
    if (!pendingNewResource) return;
    let view = useAppStore.getState().ui.resourcesView;
    if (view === 'occupancy') {
      view = 'project';
      setUI({ resourcesView: 'project' });
    }
    openDraft(view);
    requestFocus(DRAFT_ROW_ID, 'name');
    setUI({ pendingNewResource: false });
  }, [pendingNewResource, openDraft, requestFocus, setUI]);
}

const cellInput = 'input !text-[11px] !px-1.5 !py-1 w-full';
// Geërfd/read-only-velden (issue #19, punt D1 — user-feedback): platte tekst, GEEN uitgegrijsd
// invoerveld. Zelfde padding/tekstgrootte als `cellInput` (kolommen blijven uitgelijnd met de
// bewerkbare rijen), maar zonder de `.input`-rand/achtergrond en in de secundaire tekstkleur — zodat
// "dit reageert niet op een klik" al zichtbaar is vóórdat de gebruiker het probeert.
const cellStatic = 'block !text-[11px] !px-1.5 !py-1 w-full truncate text-text-secondary';

/**
 * Resource-beheerpaneel (fase 2.5, §6.2; herzien issue #19 — bibliotheek = bron, project = inzet).
 * Drie weergaven; de eerste twee BEIDE met de volledige inline-tabel-editor (`ResourceRow`,
 * gedeeld), de derde (B1b, `resourcesView === 'occupancy'`) is een leesvenster in een eigen
 * component (`ResourceOccupancyView`): de bezetting van de gekoppelde bibliotheek over álle open
 * documenten, alleen zichtbaar onder dezelfde `linked`-conditie als de Bibliotheekweergave.
 *
 * - **Bibliotheekweergave** (`resourcesView === 'company'`): de POOL van het gekoppelde bedrijf —
 *   dit IS de bron. CRUD loopt uitsluitend via `addPoolResource`/`updatePoolResource`/
 *   `removePoolResource` (nooit de project-CRUD) en de kalender-kolom wijst naar `pools[cid].calendars`
 *   (niet de projectkalenders). Geen "Totaal"-kolom (dat is een projectberekening, geen
 *   poolgrootheid). "Ploeg"-kolom alleen als de pool zelf CREW-resources kent.
 * - **Projectweergave** (`resourcesView === 'project'`): wat dit project gebruikt, over
 *   `s.resources`. Een resource met een GELDIGE bibliotheekherkomst (stempel van het gekoppelde
 *   bedrijf, status ≠ 'removed' — zie `onOpenStatusForResource`/`isResourceFieldLocked`) toont
 *   naam/type/tarief/eenheid READ-ONLY (identiteitsvelden/bibliotheekafspraken: de bibliotheek
 *   bepaalt WAT de resource IS — zie `RESOURCE_DIFF_FIELDS`) — max.eenheden, de tijd-gefaseerde
 *   `availabilitySteps` ÉN de kalenderKEUZE blijven bewerkbaar (F2-correctie: dat is projectinzet/
 *   -keuze, geen bibliotheekafspraak; zie de uitgebreide toelichting bij `ResourceRow`). Zo'n geërfde
 *   rij draagt een subtiel bibliotheek-icoontje; projecteigen rijen (los project, of een nieuwe
 *   resource via de "+ Nieuwe resource"-knop terwijl het project wél gekoppeld is) krijgen geen
 *   markering en blijven volledig bewerkbaar. "Losmaken van de bibliotheek" strip de stempel van
 *   precies dat ene item (én, F4, de meegereisde kalenderstempel als geen andere resource 'm nog
 *   volgt), waarna alle velden weer vrijstaan van de bibliotheek.
 *
 * De kalender-dropdown verwijst naar `s.calendars` (project) resp. `pools[cid].calendars` (bibliotheek);
 * "Bewerken…" en "+ nieuwe kalender" openen dezelfde `ResourceCalendarDialog`, die met een optionele
 * `poolCompanyId`-prop tussen beide bestemmingen schakelt.
 */
export function ResourcePanel() {
  const { t, i18n } = useTranslation('common');
  const resources = useAppStore(s => s.resources);
  const resourceCalendars = useAppStore(s => s.calendars);
  const assignments = useAppStore(s => s.assignments);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const hoursPerDay = useAppStore(s => s.calendar.hoursPerDay);
  const addResource = useAppStore(s => s.addResource);
  const updateResource = useAppStore(s => s.updateResource);
  const removeResource = useAppStore(s => s.removeResource);
  const unlinkResourceFromLibrary = useAppStore(s => s.unlinkResourceFromLibrary);
  const addCalendar = useAppStore(s => s.addCalendar);
  const setUI = useAppStore(s => s.setUI);
  const project = useAppStore(s => s.project);
  const companies = useAppStore(s => s.companies);
  const pools = useAppStore(s => s.pools);
  const resourcesView = useAppStore(s => s.ui.resourcesView);
  const pendingNewResource = useAppStore(s => s.ui.pendingNewResource);
  const addPoolResource = useAppStore(s => s.addPoolResource);
  const removePoolResource = useAppStore(s => s.removePoolResource);
  const updatePoolResource = useAppStore(s => s.updatePoolResource);
  const addPoolCalendar = useAppStore(s => s.addPoolCalendar);
  const addLibraryResourceToProject = useAppStore(s => s.addLibraryResourceToProject);
  const promoteResourceToPool = useAppStore(s => s.promoteResourceToPool);
  const linked = !!project.companyId && companies.some(c => c.id === project.companyId);
  const pool = project.companyId ? pools[project.companyId] : undefined;
  const inPoolView = linked && resourcesView === 'company' && !!pool;
  // B1b (spec §3): derde stand — bezettingsoverzicht van de bibliotheek over alle open documenten.
  // Zelfde vangnet als de Bibliotheekweergave: valt de koppeling weg terwijl deze weergave openstaat,
  // dan is `inOccupancyView` false en rendert de else-tak (Projectweergave) — het effect op
  // [project.companyId, linked] hieronder zet `ui.resourcesView` daarna ook echt terug.
  const inOccupancyView = linked && resourcesView === 'occupancy' && !!pool;

  // Kalender-editor: null = dicht. `poolCompanyId` aanwezig ⇒ de dialoog bewerkt/maakt een
  // POOL-kalender (via addPoolCalendar/updatePoolCalendar) i.p.v. een projectkalender.
  const [calDialog, setCalDialog] = useState<{ id: string; poolCompanyId?: string } | null>(null);
  // Uitgeklapte availabilitySteps-subrij (één tegelijk) — gedeeld tussen beide weergaven; nooit
  // gelijktijdig zichtbaar omdat er maar één tabel tegelijk gerenderd wordt.
  const [expandedSteps, setExpandedSteps] = useState<string | null>(null);
  // Resource die op verwijder-bevestiging wacht (bevinding 6, cascade-waarschuwing) — Projectweergave.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Poolresource die op verwijder-bevestiging wacht (critreview 51ad2ec, fix 1): bedrijfsbrede
  // delete buiten undo krijgt dezelfde bevestigingsrem als de projectgrid-delete hierboven.
  const [confirmPoolDelete, setConfirmPoolDelete] = useState<string | null>(null);
  // Feedback op "Toewijzen aan project" (critreview 51ad2ec, fix 2): hergebruikt het
  // added/alreadyInProject-notice-patroon van de oude AddFromLibraryDialog.
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  // Feedback op "Naar de bibliotheek" (issue #19, punt D5) — Projectweergave-tegenhanger van
  // `poolNotice`; apart gehouden omdat `poolNotice` bewust reset bij het verlaten van de
  // Bibliotheekweergave (zie de eerste useEffect hieronder) en deze notice juist in de
  // Projectweergave hoort te verschijnen.
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  // F10 (critreview op 352bb94): "+ Nieuwe resource" persisteert NIET meteen een lege rij (dat gaf een
  // ongewenste undo-stap + een blijvend leeg poolitem/projectresource als je niets typte en wegklikte).
  // In plaats daarvan een lokale PENDING-draft (geen store-mutatie, geen id) die pas bij een
  // niet-lege naam (op blur/Enter) écht wordt aangemaakt (`addResource`/`addPoolResource`); leeg
  // wegklikken laat helemaal geen spoor na. Vervangt de eerdere `newRowId`-autofocus-aanpak (punt 3) —
  // de pending-rij bestaat sowieso maar heel even en mag altijd focus krijgen.
  const [pendingNew, setPendingNew] = useState<PendingResourceDraft | null>(null);
  /** Welke draft-variant hoort bij een gegeven weergave — één definitie, gebruikt door de knop, de
   *  weergave-wissel-reset hieronder en de lintknop-route (#48-1). Spiegelt `inPoolView`. De
   *  Bezettingsweergave (B1b) is een leesvenster zonder tabel — daar hoort geen draft; aanroepers
   *  schakelen eerst naar de Projectweergave (zie de lintknop-route hieronder). */
  const hasLinkedPool = linked && !!pool;
  const variantForView = useCallback((view: ResourceView): 'project' | 'pool' => (
    hasLinkedPool && view === 'company' ? 'pool' : 'project'
  ), [hasLinkedPool]);
  const openDraft = useCallback((view: ResourceView) => {
    setPendingNew({ variant: variantForView(view), draft: freshDraft() });
  }, [variantForView]);

  // #48 (vervolgmelding van de melder): "Is it the intended behavior for the concept row to have
  // only the Name field editable?" — nee. De concept-rij bestaat om ÉÉN reden: voorkomen dat een
  // knopdruk zonder invoer een lege resource achterlaat (F10). Ze is nooit bedoeld geweest om
  // invoer te beperken, en zolang de overige cellen platte grijze tekst waren LAS ze wel zo — ook
  // nadat het commit-moment vervroegd was, want de aanblik bleef "vergrendeld".
  //
  // Daarom houdt de draft nu de HELE resource vast (`ResourceDraft`) en rendert de rij overal een
  // écht besturingselement. Je kunt dus eerst het type kiezen en dan pas de naam typen; bij het
  // committeren gaat alles in één keer mee, in één undo-stap. De F10-regel is ongewijzigd en geldt
  // nu ook voor de nieuwe velden: ZONDER NAAM WORDT ER NIETS GESCHREVEN — een dropdown verzetten en
  // wegklikken laat evengoed geen resource, geen undo-stap en geen `isDirty` achter.
  //
  // De rij staat ONDERAAN, precies waar de resource ook landt, zodat het commit-moment de cursor
  // niet verplaatst (de screencast van de melder liet zien hoe de hele tabel een rij opschoof).
  /** Commit de concept-rij. `null` = er is niets aangemaakt (geen draft, of een lege naam). */
  const commitPendingNew = (): string | null => {
    if (!pendingNew) return null;
    const { variant, draft } = pendingNew;
    const trimmed = draft.name.trim();
    if (trimmed === '') { setPendingNew(null); return null; } // geen naam: geen spoor.
    const base = {
      name: trimmed,
      description: '',
      type: draft.type,
      maxUnits: draft.maxUnits,
      calendarId: draft.calendarId,
      costPerHour: draft.costPerHour,
      unitOfMeasure: draft.type === 'MATERIAL' ? draft.unitOfMeasure : undefined,
      parentId: draft.parentId,
      color: draft.color,
    };
    let newId: string | null = null;
    if (variant === 'pool' && project.companyId) {
      newId = addPoolResource(project.companyId, base);
      // `addPoolResource` strip `calendarId`/`parentId` (pool-lokale verwijzingen worden daar
      // bewust niet uit een payload overgenomen). Zonder deze naslag zou een kalender- of
      // ploegkeuze uit de concept-rij stil verdwijnen — precies het soort "ik vulde het in en het
      // was weg" dat dit issue al aankaartte.
      if (newId && (draft.calendarId || draft.parentId)) {
        updatePoolResource(project.companyId, newId, { calendarId: draft.calendarId, parentId: draft.parentId });
      }
    } else if (variant === 'project') {
      newId = addResource(base);
    }
    setPendingNew(null);
    return newId;
  };

  // Rasternavigatie (#48, tweede verzoek van de melder): Enter/Shift+Enter en ↑/↓ tussen de rijen,
  // en Enter op de LAATSTE rij opent een nieuwe (concept-)rij. De rekensom en het toetsbeleid komen
  // uit `@/utils/gridNavigation` — dezelfde definitie die de takentabel gebruikt; alleen de
  // cursor-mechaniek verschilt (DOM-focus hier, React-state daar). Geldt in BEIDE weergaven: de
  // rij-id's hieronder volgen de tabel die daadwerkelijk gerenderd wordt.
  const gridRowIds = useMemo(() => {
    const base = (inPoolView && pool ? pool.resources : resources).map(r => r.id);
    return pendingNew ? [...base, DRAFT_ROW_ID] : base;
  }, [inPoolView, pool, resources, pendingNew]);

  /** Enter/↓ op de laatste rij ⇒ nieuwe rij. Dat is hier de concept-rij: dezelfde route als de
   *  "+ Nieuwe resource"-knop, dus ook hier geldt "niets typen ⇒ geen spoor". */
  const appendRow = useCallback((): boolean => {
    if (pendingNew) return false; // er staat er al een onderaan
    openDraft(useAppStore.getState().ui.resourcesView);
    return true;
  }, [pendingNew, openDraft]);

  const grid = useLiveGridNav<GridField>({ rowIds: gridRowIds, fields: GRID_FIELDS, onAppendRow: appendRow });
  const { requestFocus, flushPendingFocus } = grid;
  // Focus die pas ná de render kan landen (net aangemaakte rij, verse concept-rij). Bewust zonder
  // dependency-lijst: de aanvraag is een ref, dus dit is een goedkope no-op zolang er niets wacht.
  useEffect(() => { flushPendingFocus(); });

  /**
   * Verticale navigatie VANUIT de concept-rij (Enter/↓/Shift+Enter/↑). Committeren gebeurt hier,
   * niet bij het verlaten van een los veld: binnen de rij mag je vrij rondlopen met Tab en de muis
   * zonder dat er al iets in de store belandt — dát is wat de rij volledig bewerkbaar maakt.
   */
  const commitDraftAndMove = (mode: 'nextRow' | 'prevRow') => {
    const newId = commitPendingNew();
    if (mode === 'nextRow') {
      // Enter/↓: doorlopend invoeren. Meteen een verse concept-rij eronder; het naamveld blijft
      // hetzelfde DOM-element, dus de cursor staat er al in — maar de rij is intussen wél omlaag
      // geschoven, dus hem expliciet in beeld halen (zie `focusCell`/`scrollDeltaToReveal`).
      if (newId) {
        openDraft(useAppStore.getState().ui.resourcesView);
        requestFocus(DRAFT_ROW_ID, 'name');
      }
      return;
    }
    // ↑: terug de tabel in. Met een naam ⇒ naar de zojuist gemaakte rij; zonder ⇒ naar de laatste
    // bestaande rij (de concept-rij is dan spoorloos verdwenen).
    const rows = inPoolView && pool ? pool.resources : resources;
    const target = newId ?? rows[rows.length - 1]?.id;
    if (target) requestFocus(target, 'name');
  };

  // Bevestiging + notice horen bij de Bibliotheekweergave; reset zodra je 'm verlaat, zodat er geen
  // stale confirm-stap of melding terugkomt bij een latere terugkeer naar deze weergave. Spiegel voor
  // `projectNotice` (Projectweergave — punt D5). Een pending-draft die nog niet gecommit is vervalt
  // ook bij het wisselen van weergave (bewust: hij hoorde bij de weergave die je verlaat).
  // Uitzondering (#48-1): een draft die BIJ de nieuwe weergave hoort blijft staan. Dat is precies de
  // lintknop-route — bij een verse mount kan de default-weergave-normalisatie hieronder de weergave
  // nog omklappen nádat de draft is aangemaakt; zonder deze uitzondering zou de knop dan niets doen.
  // Een echte gebruikers-wissel gooit de draft nog steeds weg (die draagt altijd de variant van de
  // weergave die je verlaat).
  useEffect(() => {
    if (resourcesView !== 'company') { setConfirmPoolDelete(null); setPoolNotice(null); }
    if (resourcesView !== 'project') { setConfirmDelete(null); setProjectNotice(null); }
    // De Bezettingsweergave (B1b) rendert geen tabel — een meereizende draft zou er onzichtbaar
    // (en oncommitbaar) in blijven hangen, dus die vervalt daar altijd.
    setPendingNew(p => (p && resourcesView !== 'occupancy' && p.variant === variantForView(resourcesView) ? p : null));
  }, [resourcesView, variantForView]);

  const onAssignFromCompany = (resourceId: string) => {
    const result = addLibraryResourceToProject(project.companyId!, resourceId);
    setPoolNotice(result.added ? t('companyLibrary.added') : t('companyLibrary.alreadyInProject'));
  };

  // "Naar de bibliotheek" (issue #19, punt D5): tegenhanger van onAssignFromCompany. Dedup op naam
  // gebeurt in de store (`promoteResourceToPool` → `matchByName`) — hier wordt vooraf dezelfde matcher
  // geraadpleegd om de juiste melding te kiezen, zonder de bestaande `string | null`-return van
  // `promoteResourceToPool` te hoeven verbouwen (die wordt elders/in tests al als kale pool-id gebruikt).
  // F8 (critreview op 352bb94): "bestond al — gekoppeld" mag alleen een succesmelding zijn als het
  // bestaande poolitem INHOUDELIJK gelijk is (zelfde `computeResourceHash`, dus dezelfde
  // RESOURCE_DIFF_FIELDS-waarden) — anders koppelt het item wél, maar wijkt het meteen af (rode
  // "wijkt af"-badge op een bevroren rij), en moet de melding dat eerlijk zeggen i.p.v. te suggereren
  // dat alles nu klopt.
  const onPromoteResource = (resource: Resource) => {
    if (!project.companyId) return;
    const existingMatch = matchByName(resource.name, pool?.resources ?? []);
    const identical = existingMatch ? computeResourceHash(resource) === computeResourceHash(existingMatch) : false;
    promoteResourceToPool(project.companyId, resource, { dedupByName: true });
    setProjectNotice(
      !existingMatch ? t('companyLibrary.added')
        : identical ? t('companyLibrary.linkedToExisting')
          : t('companyLibrary.linkedToExistingDiffers'),
    );
  };

  // Default-weergave (issue #64, vervangt spec §4): ALTIJD de Projectweergave bij het openen — óók
  // met een gekoppelde, gevulde bibliotheek. De oude regel ("Bibliotheek zodra de pool inhoud
  // heeft") liet gebruikers ongemerkt in de gedeelde, app-globale bibliotheek landen, waar elke
  // bewerking buiten undo valt en alle projecten raakt. Bewust een RESET bij elke mount (en bij
  // koppeling-wissel), geen persistente voorkeur: de Bibliotheekweergave is een bewuste tabkeuze
  // per bezoek, geen toestand waar je een sessie later stil in terugvalt. Binnen één open paneel
  // blijft de gekozen weergave gewoon staan (dit effect draait niet per render/edit).
  useResourceViewReset(project.companyId, linked, setUI);

  // Lintknop "Nieuwe resource" (#48-1): die persisteerde vroeger meteen een naamloze resource (echte
  // store-mutatie + undo-stap). Nu zet hij alleen `ui.pendingNewResource` en opent dit effect
  // dezelfde concept-rij als de "+ Nieuwe resource"-knop in het paneel — één route, één gedrag.
  // BEWUST ná het default-weergave-effect hierboven: dat kan bij een verse mount de weergave nog
  // omklappen, dus lezen we de weergave hier vers uit de store i.p.v. uit de render-waarde, zodat de
  // draft in de tabel landt die de gebruiker daadwerkelijk te zien krijgt.
  usePendingResourceDraft({ pendingNewResource, openDraft, requestFocus, setUI });

  const crews = resources.filter(r => r.type === 'CREW');
  // Ploeg-kolom in de pool (issue #19, punt 1) — parentId is een geldig pool-lokaal veld (zie
  // copyResourceToProject: het wordt bewust NIET meegekopieerd naar het project, precies omdát het
  // een pool-lokale verwijzing is). F7 (critreview op 352bb94): de KOLOM zelf tonen zodra de pool niet
  // leeg is (niet pas als er al een CREW bestaat) — anders verdwijnt de kolom zodra de laatste ploeg
  // wordt verwijderd, waardoor je 'm niet meer kunt herstellen, en springt de tabel bij elke
  // eerste/laatste-CREW-mutatie. De SELECT-opties (`poolCrews`) blijven wél op echte CREW-resources.
  const poolCrews = pool ? pool.resources.filter(r => r.type === 'CREW') : [];
  const poolShowParentColumn = (pool?.resources.length ?? 0) > 0;

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [i18n.language],
  );

  // Kosten-totaal per resource (bevinding 8): Σ belaste eenheden × uren/dag × tarief.
  // uren = eenheden × hoursPerDay van de projectkalender; undefined = "—" (geen tarief of belasting).
  // Puur een PROJECT-grootheid (leunt op resourceLoadResult/hoursPerDay van dit project) — de pool
  // heeft hier bewust geen equivalent (zie "Totaal" hieronder).
  const costByResource = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    for (const r of resources) {
      const load = resourceLoadResult?.load[r.id];
      if (!load || r.costPerHour == null) { map[r.id] = undefined; continue; }
      const totalUnits = Object.values(load).reduce((a, b) => a + b, 0);
      map[r.id] = totalUnits * hoursPerDay * r.costPerHour;
    }
    return map;
  }, [resources, resourceLoadResult, hoursPerDay]);

  const grandTotal = useMemo(() => {
    const vals = Object.values(costByResource).filter((v): v is number => v !== undefined);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : undefined;
  }, [costByResource]);

  const assignmentCount = (resourceId: string) =>
    assignments.filter(a => a.resourceId === resourceId).length;

  const requestRemove = (resourceId: string) => {
    if (assignmentCount(resourceId) > 0) {
      setConfirmDelete(resourceId);
    } else {
      removeResource(resourceId);
    }
  };

  // Contextgevoelige "+ Nieuwe resource" (issue #19, punt 2): opent een POOL-pending-draft in de
  // Bibliotheekweergave, een PROJECT-pending-draft in de Projectweergave (F10: geen store-mutatie
  // vóór een niet-lege naam, zie `pendingNew`/`commitPendingNew` hierboven) — vervangt de oude aparte
  // "Nieuw in de bibliotheek"-knop (dubbelop geworden).
  const onAddClick = () => {
    openDraft(resourcesView);
    // Stond er al een concept-rij, dan is `autoFocus` al verbruikt — deze aanvraag zet de cursor
    // er alsnog in.
    requestFocus(DRAFT_ROW_ID, 'name');
  };

  const patch = (id: string, updates: Partial<Resource>) => updateResource(id, updates);
  const poolPatch = (id: string, updates: Partial<Resource>) => {
    if (project.companyId) updatePoolResource(project.companyId, id, updates);
  };

  // "+ nieuwe kalender": maak direct een lege resource-kalender aan, koppel 'm en open de editor.
  const createAndEditCalendar = (resourceId: string) => {
    const { id: _drop, ...base } = createDefaultCalendar();
    void _drop;
    const id = addCalendar({ ...base, name: t('resource.calendarDialog.title') });
    updateResource(resourceId, { calendarId: id });
    setCalDialog({ id });
  };

  // Poolvariant: dezelfde flow, maar tegen de pool-kalenderbibliotheek van het gekoppelde bedrijf.
  const createAndEditPoolCalendar = (resourceId: string) => {
    if (!project.companyId) return;
    const { id: _drop, ...base } = createDefaultCalendar();
    void _drop;
    const id = addPoolCalendar(project.companyId, { ...base, name: t('resource.calendarDialog.title') });
    if (!id) return;
    updatePoolResource(project.companyId, resourceId, { calendarId: id });
    setCalDialog({ id, poolCompanyId: project.companyId });
  };

  const onCalendarChange = (resource: Resource, value: string) => {
    if (value === NEW_CAL) {
      createAndEditCalendar(resource.id);
      return;
    }
    updateResource(resource.id, { calendarId: value || undefined });
  };

  const onPoolCalendarChange = (resource: Resource, value: string) => {
    if (value === NEW_CAL) {
      createAndEditPoolCalendar(resource.id);
      return;
    }
    poolPatch(resource.id, { calendarId: value || undefined });
  };

  /** De concept-rij — één definitie voor beide weergaven; hij staat ONDERAAN de tabel (zie
   *  `commitPendingNew`), precies waar de resource straks ook staat. */
  const draftRow = (
    variant: 'project' | 'pool',
    showTotalColumn: boolean,
    showParentColumn: boolean,
    calendarOptions: { id: string; name: string }[],
    crewOptions: Resource[],
    autoColor: string,
  ) => (
    <PendingNewRow
      autoColor={autoColor}
      draft={pendingNew?.draft ?? freshDraft()}
      isPool={variant === 'pool'}
      showTotalColumn={showTotalColumn}
      showParentColumn={showParentColumn}
      calendarOptions={calendarOptions}
      crews={crewOptions}
      onChange={patch => setPendingNew(p => (p ? { variant: p.variant, draft: { ...p.draft, ...patch } } : p))}
      onCommit={() => { commitPendingNew(); }}
      onMove={commitDraftAndMove}
      onCancel={() => setPendingNew(null)}
      onReveal={() => grid.revealCell(DRAFT_ROW_ID, 'name')}
    />
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden text-xs">
      <div className="flex items-center justify-between h-9 px-3 border-b border-border flex-shrink-0">
        <span className="ui-card-header !text-xs">{t('resource.panel.title')}</span>
        <div className="flex items-center gap-2">
          {linked && (
            <div className="flex items-center rounded-[8px] border border-border overflow-hidden" data-ops-resources-view-toggle>
              <button
                className={`px-2 py-1 ${resourcesView === 'company' ? 'bg-surface-hover font-semibold' : ''}`}
                onClick={() => setUI({ resourcesView: 'company' })}
              >{t('companyLibrary.companyView')}</button>
              <button
                className={`px-2 py-1 ${resourcesView === 'project' ? 'bg-surface-hover font-semibold' : ''}`}
                onClick={() => setUI({ resourcesView: 'project' })}
              >{t('companyLibrary.projectView')}</button>
              {/* B1b (spec §3): derde stand — bezetting van de bibliotheek over alle open documenten.
                  Zelfde zichtbaarheidsconditie als de hele schakelaar (`linked`). */}
              <button
                className={`px-2 py-1 ${resourcesView === 'occupancy' ? 'bg-surface-hover font-semibold' : ''}`}
                onClick={() => setUI({ resourcesView: 'occupancy' })}
                data-ops-occupancy-view-button
              >{t('resource.occupancyView')}</button>
            </div>
          )}
          {/* B1b: de Bezettingsweergave is een leesvenster — geen "+ Nieuwe resource" daar. */}
          {!inOccupancyView && (
            <button onClick={onAddClick} className="btn btn--sm btn--primary flex items-center gap-1" data-ops-resource-add>
              <Plus size={13} /> {inPoolView ? t('resource.panel.addRowLibrary') : t('resource.panel.addRow')}
            </button>
          )}
          <button
            onClick={() => setUI({ showResourcePanel: false })}
            className="p-1 hover:bg-surface-hover rounded"
            title={t('close')}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {inOccupancyView && pool && project.companyId ? (
        <ResourceOccupancyView companyId={project.companyId} pool={pool} />
      ) : inPoolView && pool ? (
        <div className="flex-1 overflow-auto" ref={grid.gridRef}>
          {/* Waarschuwingsbanner (issue #64c): dit was platte cursieve tekst, maar "bewerkt de
              bibliotheek, geldt voor alle projecten, valt buiten undo" is precies het soort
              waarschuwing dat je niet mag kunnen missen — dus een contrasterend vlak + icoon.
              Kleuren via de semantische --warning-token + per-thema --theme-warning-text, zodat de
              banner in alle drie de thema's leesbaar blijft. */}
          <div
            className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium"
            style={{
              background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
              borderColor: 'var(--warning)',
              color: 'var(--theme-warning-text)',
            }}
            role="alert"
            data-ops-company-view-hint
          >
            <AlertTriangle size={14} className="shrink-0" aria-hidden />
            <span>{t('companyLibrary.companyViewHint')}</span>
          </div>
          {poolNotice && (
            <p className="flex items-center gap-1.5 px-2" style={{ color: 'var(--success)' }} data-ops-pool-assign-notice>
              <Check size={13} /> {poolNotice}
            </p>
          )}
          {pool.resources.length === 0 && pendingNew?.variant !== 'pool' ? (
            <div className="p-4 text-text-secondary">{t('companyLibrary.noResources')}</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="sticky top-0 z-10" style={{ background: 'var(--theme-surface-alt)' }}>
                  <th className="border-b border-border px-1 py-1.5" style={{ width: 44 }} title={t('resource.color')} aria-label={t('resource.color')}>
                  <span className="block h-2.5 w-full rounded-sm" style={{ background: 'var(--theme-border)' }} />
                </th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ minWidth: 160 }}>{t('resource.name')}</th>
                  <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 130 }}>{t('resource.typeLabel')}</th>
                  <th className="text-right px-2 py-1.5 font-semibold border-b border-border" style={{ width: 110 }}>{t('resource.maxUnits')}</th>
                  <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 160 }}>{t('resource.calendarId')}</th>
                  <th className="text-right px-2 py-1.5 font-semibold border-b border-border" style={{ width: 90 }}>{t('resource.costPerHour')}</th>
                  <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 90 }}>{t('resource.unitOfMeasure')}</th>
                  {poolShowParentColumn && (
                    <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 120 }}>{t('resource.parent')}</th>
                  )}
                  <th className="border-b border-border" style={{ width: 190 }} />
                </tr>
              </thead>
              <tbody>
                {pool.resources.map(r => {
                  const stepsOpen = expandedSteps === r.id;
                  const stepCount = r.availabilitySteps?.length ?? 0;
                  return (
                    <ResourceRow
                      key={r.id}
                      resource={r}
                      variant="pool"
                      colCount={poolShowParentColumn ? 9 : 8}
                      crews={poolCrews}
                      calendarOptions={pool.calendars}
                      stepsOpen={stepsOpen}
                      stepCount={stepCount}
                      showParentColumn={poolShowParentColumn}
                      confirmingDelete={confirmPoolDelete === r.id}
                      confirmMessage={t('companyLibrary.confirmRemoveResource', { name: r.name || r.id })}
                      onToggleSteps={() => setExpandedSteps(stepsOpen ? null : r.id)}
                      onPatch={updates => poolPatch(r.id, updates)}
                      onRequestRemove={() => setConfirmPoolDelete(r.id)}
                      onConfirmRemove={() => { removePoolResource(project.companyId!, r.id); setConfirmPoolDelete(null); }}
                      onCancelRemove={() => setConfirmPoolDelete(null)}
                      onCalendarChange={value => onPoolCalendarChange(r, value)}
                      onEditCalendar={() => r.calendarId && setCalDialog({ id: r.calendarId, poolCompanyId: project.companyId! })}
                      onAssignToProject={() => onAssignFromCompany(r.id)}
                      cellProps={grid.cellProps}
                      rowProps={grid.rowProps}
                    />
                  );
                })}
                {pendingNew?.variant === 'pool' && draftRow('pool', false, poolShowParentColumn, pool.calendars, poolCrews, nextFreePaletteColor(pool.resources))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="flex-1 overflow-auto" ref={grid.gridRef}>
        {projectNotice && (
          <p className="flex items-center gap-1.5 px-2 pt-2" style={{ color: 'var(--success)' }} data-ops-project-promote-notice>
            <Check size={13} /> {projectNotice}
          </p>
        )}
        {resources.length === 0 && pendingNew?.variant !== 'project' ? (
          linked ? (
            // D4 (issue #19, user-feedback): een leeg Projectweergave — precies de instap-showcase-
            // situatie (project WEL gekoppeld, nog niets gematerialiseerd) — legt de tweedeling meteen
            // uit i.p.v. een kale lege tabel te tonen.
            <div className="p-4 text-text-secondary" data-ops-resource-empty-linked>
              <p>{t('resource.panel.emptyLinkedTitle')}</p>
              <p className="mt-1">{t('resource.panel.emptyLinkedHint')}</p>
            </div>
          ) : (
            <div className="p-4 text-text-secondary">{t('resource.panel.empty')}</div>
          )
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10" style={{ background: 'var(--theme-surface-alt)' }}>
                <th className="border-b border-border px-1 py-1.5" style={{ width: 44 }} title={t('resource.color')} aria-label={t('resource.color')}>
                  <span className="block h-2.5 w-full rounded-sm" style={{ background: 'var(--theme-border)' }} />
                </th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ minWidth: 160 }}>{t('resource.name')}</th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 130 }}>{t('resource.typeLabel')}</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border" style={{ width: 110 }}>{t('resource.maxUnits')}</th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 160 }}>{t('resource.calendarId')}</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border" style={{ width: 90 }}>{t('resource.costPerHour')}</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border" style={{ width: 100 }} title={t('resource.totalHint')}>{t('resource.total')}</th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 90 }}>{t('resource.unitOfMeasure')}</th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 120 }}>{t('resource.parent')}</th>
                {/* F10 (critreview op 352bb94): zelfde breedte als de pooltabel — er kan nu een
                    "Naar de bibliotheek"-tekstknop in staan, niet alleen het losmaak-/verwijder-icoon. */}
                <th className="border-b border-border" style={{ width: 190 }} />
              </tr>
            </thead>
            <tbody>
              {resources.map(r => {
                const stepsOpen = expandedSteps === r.id;
                const stepCount = r.availabilitySteps?.length ?? 0;
                const cost = costByResource[r.id];
                return (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    variant="project"
                    colCount={10}
                    crews={crews}
                    calendarOptions={resourceCalendars}
                    stepsOpen={stepsOpen}
                    stepCount={stepCount}
                    showParentColumn
                    costLabel={cost === undefined ? '—' : numberFmt.format(cost)}
                    confirmingDelete={confirmDelete === r.id}
                    confirmMessage={t('resource.panel.confirmDelete', { name: r.name || r.id, count: assignmentCount(r.id) })}
                    onToggleSteps={() => setExpandedSteps(stepsOpen ? null : r.id)}
                    onPatch={updates => patch(r.id, updates)}
                    onRequestRemove={() => requestRemove(r.id)}
                    onConfirmRemove={() => { removeResource(r.id); setConfirmDelete(null); }}
                    onCancelRemove={() => setConfirmDelete(null)}
                    onCalendarChange={value => onCalendarChange(r, value)}
                    onEditCalendar={() => r.calendarId && setCalDialog({ id: r.calendarId })}
                    onUnlink={() => unlinkResourceFromLibrary(r.id)}
                    onPromoteToLibrary={linked ? () => onPromoteResource(r) : undefined}
                    cellProps={grid.cellProps}
                    rowProps={grid.rowProps}
                  />
                );
              })}
              {pendingNew?.variant === 'project' && draftRow('project', true, true, resourceCalendars, crews, nextFreePaletteColor(resources))}
            </tbody>
            {grandTotal !== undefined && (
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="px-2 py-1.5 text-text-secondary" colSpan={4}>{t('resource.total')}</td>
                  <td className="px-2 py-1.5 text-right" />
                  <td className="px-2 py-1.5 text-right">{numberFmt.format(grandTotal)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
      )}

      {calDialog !== null && (
        <ResourceCalendarDialog calendarId={calDialog.id} poolCompanyId={calDialog.poolCompanyId} onClose={() => setCalDialog(null)} />
      )}
    </div>
  );
}

/**
 * Gedeelde inline-tabelrij voor ZOWEL de Bibliotheekweergave (`variant="pool"`) als de
 * Projectweergave (`variant="project"`) — issue #19: de rolverdeling was omgekeerd (de bibliotheek,
 * de BRON, had alleen een `window.prompt()`-editor; het project had de volledige tabel). Nu delen
 * beide weergaven precies deze rij; alleen kolomkeuze, bestemming van de mutaties en de
 * read-only-gating verschillen per variant.
 */
function ResourceRow({
  resource, variant, colCount, crews, calendarOptions, stepsOpen, stepCount, costLabel,
  showParentColumn = true,
  confirmingDelete, confirmMessage,
  onToggleSteps, onPatch, onRequestRemove, onConfirmRemove, onCancelRemove,
  onCalendarChange, onEditCalendar, onAssignToProject, onUnlink, onPromoteToLibrary,
  cellProps, rowProps,
}: {
  resource: Resource;
  variant: 'project' | 'pool';
  /** Aantal kolommen van DEZE tabel — voor de colSpan van de confirm-/steps-subrij. */
  colCount: number;
  crews: Resource[];
  calendarOptions: { id: string; name: string }[];
  stepsOpen: boolean;
  stepCount: number;
  /** Alleen aanwezig in de Projectweergave — de pool kent geen "Totaal"-kolom (dat is een
   *  projectberekening, zie de toelichting bovenaan dit bestand). */
  costLabel?: string;
  showParentColumn?: boolean;
  confirmingDelete: boolean;
  confirmMessage: string;
  onToggleSteps: () => void;
  onPatch: (updates: Partial<Resource>) => void;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  onCalendarChange: (value: string) => void;
  onEditCalendar: () => void;
  /** Pool-only: "Toewijzen aan project" (behouden op de bestaande plek, expliciete user-wens). */
  onAssignToProject?: () => void;
  /** Project-only: "Losmaken van de bibliotheek" — alleen zichtbaar/zinvol op een geërfde (locked) rij. */
  onUnlink?: () => void;
  /** Project-only, tegenhanger van `onAssignToProject` (issue #19, punt D5): "naar de bibliotheek"
   *  op een ONGESTEMPELDE rij — alleen aanwezig (van de aanroeper) als het project aan een bedrijf
   *  gekoppeld is; de rij zelf toont 'm alleen als `!resource.libraryOrigin`. */
  onPromoteToLibrary?: () => void;
  /** Rasternavigatie (#48): adres + toetsafhandeling per cel, uit `useLiveGridNav`. */
  cellProps: (rowId: string, field: GridField) => { 'data-ops-grid-cell': string; onKeyDown: (e: KeyboardEvent) => void };
  rowProps: (rowId: string) => { 'data-ops-grid-row': string };
}) {
  const { t, i18n } = useTranslation('common');
  // F10 (critreview op 352bb94): geërfd tarief door dezelfde Intl-opmaak als de Totaal-kolom
  // (`numberFmt` in `ResourcePanel`) — anders toont dit veld de rauwe `number`-waarde terwijl de rest
  // van de tabel gelokaliseerd (2 decimalen) opmaakt.
  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [i18n.language],
  );
  const isMaterial = resource.type === 'MATERIAL';
  const isPool = variant === 'pool';
  // Projectweergave-markeringen (spec §3/§4, taak 18): 'deviated'/'removed' komen uit de
  // grens-1/4-classificatie (onOpenStatusForResource, taak 7) — null/'in-sync'/'behind'/'unbound'
  // tonen bewust niets ('behind' is na een grens al stil ververst; zie taakbrief). Pool-rijen hebben
  // geen "openings-status" — ze ZIJN de bron.
  const onOpenStatusForResource = useAppStore(s => s.onOpenStatusForResource);
  const setUI = useAppStore(s => s.setUI);
  const openStatus = isPool ? null : onOpenStatusForResource(resource.id);

  // Geërfd-gating (issue #19, punt 4 — F2-correctie ná critreview op 352bb94: kalender is GEEN
  // bibliotheekafspraak, dat was een ontwerpfout in de vorige ronde). Rationale voor de user: DE
  // BIBLIOTHEEK BEPAALT WAT EEN RESOURCE IS (naam, type, tarief/uur, eenheid — identiteitsvelden,
  // vastgelegd door het bedrijf, gelden voor elk project dat deze resource gebruikt, horen dus alleen
  // in de Bibliotheekweergave gewijzigd te worden — zie `RESOURCE_DIFF_FIELDS`); HET PROJECT BEPAALT
  // HOEVEEL en WANNEER: max.eenheden + de tijd-gefaseerde `availabilitySteps` (de allocatiegrootheden
  // waar een later bezettingsoverzicht op leunt) ÉN welke kalender aan deze resource hangt (F2: dat is
  // een projectkeuze — wat er IN die kalender staat komt uit de bibliotheek via de meegereisde,
  // gestempelde kalenderkopie, niet via dit veld). `isResourceFieldLocked` (services/library/
  // libraryOps.ts) is de gedeelde, headless-testbare pure functie achter dit besluit — ze leunt op
  // dezelfde `RESOURCE_DIFF_FIELDS` als de diff/sync-machinerie, dus "locked" en "wat de bibliotheek
  // daadwerkelijk terugzet bij bijwerken" kunnen nooit uiteenlopen. 'removed' (het poolorigineel
  // bestaat niet meer) telt bewust NIET als "geldige herkomst": de stempel wijst dan nergens meer naar,
  // dus zo'n rij is feitelijk een wees en blijft volledig bewerkbaar (met de bestaande expliciete
  // "Verwijder uit project"-actie hieronder) in plaats van muurvast te zitten op een dode referentie.
  // D1 (user-feedback): een geërfd/locked veld rendert als PLATTE TEKST (`cellStatic`), niet als een
  // uitgegrijsd invoerveld — "waarom reageert dit niet op een klik" is zichtbaar vóórdat de gebruiker
  // het probeert. Elke gegate cel hieronder vertakt zelf op `locked` (static <span> vs. echt invoerveld).
  const locked = !isPool && isResourceFieldLocked(openStatus);

  // F6 (critreview op 352bb94): in de POOL-variant committeert `onPatch` naar `updatePoolResource`,
  // die per aanroep bumpPool + persist + refreshAllDocumentsFromPool doet (dat laatste wist de
  // redoStack van elk gekoppeld document) — per-toetsaanslag-onChange zou tien poolversies + tien
  // volledige bibliotheekschrijfacties opleveren voor het typen van tien letters. Tekstvelden
  // (naam/eenheid) committeren daarom op blur/Enter, net als de bedrijfsnaam-draft in
  // `LibrarySection.tsx` (zelfde patroon: lokale draft, resync op externe wijziging, commit alleen bij
  // een echt verschil). Numerieke/select-velden (max.eenheden via `UnitsInput`, type, kalender) blijven
  // bewust WEL direct: het zijn korte, atomaire wijzigingen (een paar cijfers, of één discrete keuze),
  // geen aanhoudende vrije tekst-compositie — de marginale pool-bump-kost daarvan is verwaarloosbaar
  // vergeleken met een meerdere-woorden-lange naam, en `UnitsInput` doet dit al overal (ook in de
  // Projectweergave) zo. Alleen relevant voor `isPool`; de Projectweergave-tak van elke cel hieronder
  // (locked ? static : direct invoerveld) is ongewijzigd.
  const [nameDraft, setNameDraft] = useState(resource.name);
  useEffect(() => { setNameDraft(resource.name); }, [resource.id, resource.name]);
  const commitNameDraft = () => { if (nameDraft !== resource.name) onPatch({ name: nameDraft }); };

  const [unitDraft, setUnitDraft] = useState(resource.unitOfMeasure ?? '');
  useEffect(() => { setUnitDraft(resource.unitOfMeasure ?? ''); }, [resource.id, resource.unitOfMeasure]);
  const commitUnitDraft = () => {
    const v = unitDraft || undefined;
    if (v !== resource.unitOfMeasure) onPatch({ unitOfMeasure: v });
  };

  return (
    <>
      <tr
        className="border-b border-border-light hover:bg-surface-hover"
        data-ops-pool-resource-row={isPool ? true : undefined}
        {...rowProps(resource.id)}
      >
        <td className="px-1 py-1">
          {/* #21: kleurkolom — toont de EFFECTIEVE kleur (eigen keuze of hash-fallback), zodat de
              cel nooit "leeg" oogt terwijl balken wél gekleurd zijn. Bewust zonder geërfd-gating:
              kleur is geen bibliotheekafspraak (RESOURCE_DIFF_FIELDS) en mag overal gekozen worden. */}
          <input
            type="color"
            aria-label={t('resource.color')}
            title={t('resource.color')}
            value={resourceDisplayColor(resource)}
            onChange={e => onPatch({ color: e.target.value })}
            className="block h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
          />
        </td>
        <td className="px-2 py-1">
          <div className="flex items-center gap-1 min-w-0">
            {isPool ? (
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={commitNameDraft}
                // Enter/↑/↓ verplaatsen de cursor (#48); de focuswissel blurt dit veld en dat is
                // precies wat de draft committeert — daarom hier geen eigen Enter-blur meer.
                {...cellProps(resource.id, 'name')}
                className={cellInput}
                placeholder={t('resource.name')}
              />
            ) : locked ? (
              <span className={cellStatic} title={t('resource.inheritedFieldHint')}>
                {resource.name || '—'}
              </span>
            ) : (
              <input
                value={resource.name}
                onChange={e => onPatch({ name: e.target.value })}
                {...cellProps(resource.id, 'name')}
                className={cellInput}
                placeholder={t('resource.name')}
              />
            )}
            {locked && (
              // Rustige, subtiele herkomstmarkering (user-wens B): een klein bibliotheek-icoontje
              // i.p.v. een tekstbadge — de rode "wijkt af"/"niet meer in de bibliotheek"-badges
              // hierboven blijven de aandachttrekkers; dit is puur een oogopslag-signaal. `title` op
              // de omringende span (niet rechtstreeks op het SVG-icoon) voor betrouwbare tooltips.
              <span
                className="shrink-0 inline-flex items-center text-text-secondary"
                title={t('resource.fromLibraryBadge')}
                data-ops-resource-inherited
              >
                <Library size={12} />
              </span>
            )}
            {openStatus === 'deviated' && (
              <button
                type="button"
                className="badge badge--red shrink-0"
                onClick={() => setUI({ showLibraryLinkDialog: true })}
                title={t('companyLibrary.deviates')}
                data-ops-resource-deviates
              >
                {t('companyLibrary.deviates')}
              </button>
            )}
            {openStatus === 'removed' && (
              <>
                <span className="badge badge--red shrink-0" title={t('companyLibrary.notInCompany')} data-ops-resource-removed>
                  {t('companyLibrary.notInCompany')}
                </span>
                {/* Wees-actie bedraden (spec §4, eindreview-bevinding 1): expliciete, gelabelde
                    verwijderknop voor een 'removed'-materialisatie — hergebruikt hetzelfde
                    verwijderpad (onRequestRemove/cascade-confirm) als de rij-Trash2, geen nieuw
                    verwijdermechanisme. */}
                <button
                  type="button"
                  onClick={onRequestRemove}
                  className="btn btn--sm btn--secondary shrink-0 !py-0.5 !px-1.5 !text-[10px]"
                  title={t('companyLibrary.removeFromProject')}
                  data-ops-resource-remove-orphan
                >
                  {t('companyLibrary.removeFromProject')}
                </button>
              </>
            )}
          </div>
        </td>
        <td className="px-2 py-1">
          {locked ? (
            <span className={cellStatic} title={t('resource.inheritedFieldHint')}>
              {t(TYPE_KEY[resource.type])}
            </span>
          ) : (
            <select
              value={resource.type}
              onChange={e => onPatch({ type: e.target.value as ResourceType })}
              {...cellProps(resource.id, 'type')}
              className={cellInput}
            >
              {RESOURCE_TYPES.map(rt => (
                <option key={rt} value={rt}>{t(TYPE_KEY[rt])}</option>
              ))}
            </select>
          )}
        </td>
        <td className="px-2 py-1">
          {/* F2 (critreview op 352bb94): max.eenheden (+ de tijd-gefaseerde stappen hieronder) en de
              kalenderkeuze (verderop) zijn projectinzet, GEEN bibliotheekafspraak — dus ALTIJD een
              echt invoerveld, nooit `cellStatic`, ook niet op een geërfde/locked resource. */}
          <div className="flex items-center gap-1 justify-end">
            <UnitsInput
              value={resource.maxUnits}
              ariaLabel={t('resource.maxUnits')}
              onCommit={n => onPatch({ maxUnits: n })}
              gridCell={cellProps(resource.id, 'maxUnits')['data-ops-grid-cell']}
              onKeyDown={cellProps(resource.id, 'maxUnits').onKeyDown}
              className={cellInput + ' text-right'}
            />
            <button
              onClick={onToggleSteps}
              title={t('resource.availabilityStepsEditor.title')}
              className="p-0.5 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0"
            >
              {stepsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {stepCount > 0 && <span className="text-[9px] ml-0.5">{stepCount}</span>}
            </button>
          </div>
        </td>
        <td className="px-2 py-1">
          <div className="flex items-center gap-1 min-w-0">
            {/* F2 (critreview op 352bb94, issue #19): kalenderKEUZE is PROJECTINZET, geen
                bibliotheekafspraak — welke kalender aan deze resource hangt is een keuze van dit ene
                project (net als max.eenheden); WAT in die kalender staat (werkdagen/-uren) komt uit de
                bibliotheek via de meegereisde, gestempelde kalenderkopie (zie `addLibraryResourceToProject`
                → traveling calendar). `calendarId` staat daarom bewust NIET in `RESOURCE_DIFF_FIELDS` —
                vergrendelen zou het hier NERGENS meer wijzigbaar maken (er is geen "bijwerken vanuit
                bibliotheek"-pad voor dit veld). Altijd een echte dropdown, ook op een geërfde rij. */}
            <select
              value={resource.calendarId ?? ''}
              onChange={e => onCalendarChange(e.target.value)}
              {...cellProps(resource.id, 'calendar')}
              className={cellInput}
            >
              <option value="">{isPool ? t('resource.noCalendar') : t('resource.projectCalendar')}</option>
              {calendarOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
              <option value={NEW_CAL}>+ {t('resource.calendarDialog.title')}</option>
            </select>
            {/* F3 (critreview op 352bb94): dit potlood bewerkt de MEEGEREISDE PROJECTKOPIE van de
                kalender (`s.calendars`/`updateCalendar`, project-only hier — pool-variant heeft z'n
                eigen `poolCompanyId`-pad). Dat kan de kopie 'deviated' maken t.o.v. de bibliotheek — dat
                is correct en bedoeld gedrag (de bestaande badge/afwijkingenscherm pakt het op); de
                tooltip mag dus NOOIT suggereren dat dit de bibliotheek zelf bewerkt. */}
            <button
              onClick={onEditCalendar}
              disabled={!resource.calendarId}
              title={t('resource.editCalendar')}
              className="p-0.5 rounded hover:bg-surface-hover text-text-secondary disabled:opacity-30 flex-shrink-0"
            >
              <Pencil size={12} />
            </button>
          </div>
        </td>
        <td className="px-2 py-1">
          {locked ? (
            <span className={cellStatic + ' text-right'} title={t('resource.inheritedFieldHint')}>
              {resource.costPerHour != null ? numberFmt.format(resource.costPerHour) : '—'}
            </span>
          ) : (
            <input
              type="number"
              min={0}
              step="any"
              value={resource.costPerHour ?? ''}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { onPatch({ costPerHour: undefined }); return; }
                const n = parseFloat(raw);
                if (Number.isFinite(n)) onPatch({ costPerHour: n });
              }}
              {...cellProps(resource.id, 'cost')}
              className={cellInput + ' text-right'}
            />
          )}
        </td>
        {costLabel !== undefined && (
          <td className="px-2 py-1 text-right tabular-nums" title={t('resource.totalHint')}>
            {costLabel}
          </td>
        )}
        <td className="px-2 py-1">
          {isPool ? (
            <input
              value={unitDraft}
              disabled={!isMaterial}
              onChange={e => setUnitDraft(e.target.value)}
              onBlur={commitUnitDraft}
              {...cellProps(resource.id, 'unit')}
              className={cellInput + ' disabled:opacity-30'}
              title={isMaterial ? undefined : t('resource.unitOnlyMaterial')}
            />
          ) : locked ? (
            <span className={cellStatic} title={t('resource.inheritedFieldHint')}>
              {isMaterial ? (resource.unitOfMeasure || '—') : '—'}
            </span>
          ) : (
            <input
              value={resource.unitOfMeasure ?? ''}
              disabled={!isMaterial}
              onChange={e => onPatch({ unitOfMeasure: e.target.value || undefined })}
              {...cellProps(resource.id, 'unit')}
              className={cellInput + ' disabled:opacity-30'}
              title={isMaterial ? undefined : t('resource.unitOnlyMaterial')}
            />
          )}
        </td>
        {showParentColumn && (
          <td className="px-2 py-1">
            <select
              value={resource.parentId ?? ''}
              onChange={e => onPatch({ parentId: e.target.value || undefined })}
              {...cellProps(resource.id, 'parent')}
              className={cellInput}
            >
              <option value="">{t('resource.noParent')}</option>
              {crews.filter(c => c.id !== resource.id).map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
            </select>
          </td>
        )}
        <td className="px-1 py-1 text-center">
          <div className="flex items-center gap-0.5 justify-center">
            {isPool && onAssignToProject && !confirmingDelete && (
              <button
                onClick={onAssignToProject}
                className="btn btn--sm btn--secondary !py-0.5 !px-1.5 !text-[10px]"
              >
                {t('companyLibrary.assignFromCompany')}
              </button>
            )}
            {/* Tegenhanger van "Toewijzen aan project" (issue #19, punt D5): alleen op een
                ONGESTEMPELDE Projectweergave-rij, en alleen als de aanroeper 'm meegeeft (project aan
                een bedrijf gekoppeld — zie ResourcePanel). F10 (critreview op 352bb94): ook gate'n op
                een niet-lege GENORMALISEERDE naam — een naamloze resource naar de bibliotheek tillen
                levert een zinloos poolitem op (`matchByName` negeert een lege genormaliseerde naam
                sowieso al, zie libraryOps.ts, maar zonder deze gate zou de knop wél zichtbaar zijn). */}
            {!isPool && !resource.libraryOrigin && normalizeName(resource.name) !== '' && onPromoteToLibrary && !confirmingDelete && (
              <button
                onClick={onPromoteToLibrary}
                title={t('resource.promoteToLibrary')}
                className="btn btn--sm btn--secondary !py-0.5 !px-1.5 !text-[10px]"
                data-ops-resource-promote
              >
                {t('resource.promoteToLibrary')}
              </button>
            )}
            {/* F5 (critreview op 352bb94): gate op `!!resource.libraryOrigin`, NIET op `locked` — een
                'removed'-wees (dode stempel, altijd `!locked`) en een stempel van een ANDER bedrijf
                (rij bewerkbaar dus ook `!locked`, stempel onzichtbaar) waren met `locked` doodlopende
                straten: geen enkele knop kon dat stempel meer wegnemen. Met deze gate kan elk item met
                ÍÉTS in `libraryOrigin` losgemaakt worden, ongeacht welk bedrijf/status. */}
            {!isPool && !!resource.libraryOrigin && onUnlink && !confirmingDelete && (
              <button
                onClick={onUnlink}
                title={t('resource.unlinkFromLibrary')}
                className="p-1 rounded hover:bg-surface-hover text-text-secondary"
                data-ops-resource-unlink
              >
                <Unlink2 size={13} />
              </button>
            )}
            {confirmingDelete ? (
              <>
                <button
                  onClick={onConfirmRemove}
                  title={t('resource.panel.confirmDeleteYes')}
                  className="p-1 rounded hover:bg-surface-hover"
                  style={{ color: 'var(--error)' }}
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={onCancelRemove}
                  title={t('resource.panel.confirmDeleteNo')}
                  className="p-1 rounded hover:bg-surface-hover text-text-secondary"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <button
                onClick={onRequestRemove}
                title={t('resource.panel.deleteRow')}
                className="p-1 rounded hover:bg-surface-hover"
                style={{ color: 'var(--error)' }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {confirmingDelete && (
        <tr style={{ background: 'var(--theme-surface-alt)' }} data-ops-pool-delete-confirm={isPool ? true : undefined}>
          <td colSpan={colCount} className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--error)' }}>
            {confirmMessage}
          </td>
        </tr>
      )}
      {stepsOpen && (
        <tr style={{ background: 'var(--theme-surface-alt)' }}>
          <td colSpan={colCount} className="px-3 py-2">
            <AvailabilityStepsEditor
              steps={resource.availabilitySteps ?? []}
              onChange={steps => onPatch({ availabilitySteps: steps.length > 0 ? steps : undefined })}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * F10 (critreview op 352bb94): de "nieuwe rij"-draft VÓÓR de eerste niet-lege naam — puur lokale
 * component-state in `ResourcePanel`, GEEN store-mutatie. Escape gooit de draft weg zonder spoor,
 * en wie niets invult en wegklikt laat evenmin iets achter: geen resource, geen undo-stap, document
 * niet als gewijzigd gemarkeerd. Dát is de reden dat deze rij bestaat.
 *
 * #48 (vervolgmelding van de melder — "only the Name field editable? Remaining fields are locked"):
 * hij bestaat NIET om invoer te beperken, dus is élke cel hier een ECHT besturingselement op de
 * lokale draft. Vul in welke volgorde je wilt; er belandt pas iets in de store zodra er een naam
 * staat én je de rij verlaat (klik elders, Tab voorbij de laatste cel) of Enter drukt — dan gaat
 * alles in één keer mee, in één undo-stap. Een dropdown verzetten zónder naam blijft spoorloos.
 *
 * Bewust NIET aanwezig, in tegenstelling tot een echte rij: de uitklap-chevron voor tijd-gefaseerde
 * capaciteit, het kalender-potlood en de verwijderknop. Die werken alle drie op een resource die
 * nog niet bestaat; ze verschijnen zodra de rij echt is. Om dezelfde reden kent de kalenderkeuze
 * hier geen "+ nieuwe kalender".
 *
 * De rij staat onderaan, precies waar die resource ook komt te staan, zodat het commit-moment de
 * cursor niet verplaatst.
 */
function PendingNewRow({
  draft, isPool, showTotalColumn, showParentColumn, calendarOptions, crews, autoColor,
  onChange, onCommit, onCancel, onMove, onReveal,
}: {
  /** #21: preview-kleur voor de concept-rij — wat de store bij commit zal toewijzen als de
   *  gebruiker zelf niets kiest (eerste vrije paletkleur op de betreffende verzameling). */
  autoColor: string;
  draft: ResourceDraft;
  isPool: boolean;
  showTotalColumn: boolean;
  showParentColumn: boolean;
  calendarOptions: { id: string; name: string }[];
  crews: Resource[];
  onChange: (patch: Partial<ResourceDraft>) => void;
  /** De rij verlaten: committeer wat er staat (of laat geen spoor na als er geen naam is). */
  onCommit: () => void;
  onCancel: () => void;
  /** Enter/↓ ⇒ committeer + verse concept-rij; Shift+Enter/↑ ⇒ committeer + terug de tabel in. */
  onMove: (mode: 'nextRow' | 'prevRow') => void;
  /** De rij in beeld scrollen (de scroller kent alleen de hook, niet deze component). */
  onReveal: () => void;
}) {
  const { t } = useTranslation('common');
  const isMaterial = draft.type === 'MATERIAL';

  /** Eén toetsbeleid voor de hele rij — dezelfde regels als de echte rijen (`useLiveGridNav`),
   *  zodat ↑/↓ in de dropdowns en de spinner gewoon hun eigen betekenis houden. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); return; }
    const direction = liveGridNavDirection(e, controlKindOf(e.target as HTMLElement & { type?: string }));
    if (!direction) return;
    e.preventDefault();
    e.stopPropagation();
    onMove(direction === 'down' ? 'nextRow' : 'prevRow');
  };

  /** Verlaat de focus de RIJ (niet slechts een cel), dan is dat het commit-moment. Binnen de rij
   *  mag je vrij rondlopen — anders zou Tab van Naam naar Type de rij al wegschrijven en zou
   *  "volledig bewerkbaar" niets betekenen. */
  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    onCommit();
  };

  const cell = (field: GridField) => ({
    'data-ops-grid-cell': `${DRAFT_ROW_ID}:${field}`,
    onKeyDown,
  });

  return (
    <tr
      className="border-b border-border-light"
      style={{ background: 'var(--theme-surface-alt)' }}
      data-ops-pending-new-row
      data-ops-grid-row={DRAFT_ROW_ID}
      onBlur={onBlur}
      onFocus={onReveal}
    >
      <td className="px-1 py-1">
        <input
          type="color"
          aria-label={t('resource.color')}
          title={t('resource.color')}
          value={draft.color ?? autoColor}
          onChange={e => onChange({ color: e.target.value })}
          className="block h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
        />
      </td>
      <td className="px-2 py-1">
        <input
          value={draft.name}
          onChange={e => onChange({ name: e.target.value })}
          {...cell('name')}
          className={cellInput}
          placeholder={t('resource.name')}
          autoFocus
        />
      </td>
      <td className="px-2 py-1">
        <select
          value={draft.type}
          onChange={e => onChange({ type: e.target.value as ResourceType })}
          {...cell('type')}
          className={cellInput}
        >
          {RESOURCE_TYPES.map(rt => (
            <option key={rt} value={rt}>{t(TYPE_KEY[rt])}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1 justify-end">
          <UnitsInput
            value={draft.maxUnits}
            ariaLabel={t('resource.maxUnits')}
            onCommit={n => onChange({ maxUnits: n })}
            gridCell={cell('maxUnits')['data-ops-grid-cell']}
            onKeyDown={onKeyDown}
            className={cellInput + ' text-right'}
          />
        </div>
      </td>
      <td className="px-2 py-1">
        <select
          value={draft.calendarId ?? ''}
          onChange={e => onChange({ calendarId: e.target.value || undefined })}
          {...cell('calendar')}
          className={cellInput}
        >
          <option value="">{isPool ? t('resource.noCalendar') : t('resource.projectCalendar')}</option>
          {calendarOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name || c.id}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          min={0}
          step="any"
          value={draft.costPerHour ?? ''}
          onChange={e => {
            const raw = e.target.value;
            if (raw === '') { onChange({ costPerHour: undefined }); return; }
            const n = parseFloat(raw);
            if (Number.isFinite(n)) onChange({ costPerHour: n });
          }}
          {...cell('cost')}
          className={cellInput + ' text-right'}
        />
      </td>
      {/* "Totaal" is een berekening over de belasting — die bestaat pas als de resource bestaat. */}
      {showTotalColumn && <td className="px-2 py-1 text-right tabular-nums text-text-secondary">—</td>}
      <td className="px-2 py-1">
        <input
          value={draft.unitOfMeasure ?? ''}
          disabled={!isMaterial}
          onChange={e => onChange({ unitOfMeasure: e.target.value || undefined })}
          {...cell('unit')}
          className={cellInput + ' disabled:opacity-30'}
          title={isMaterial ? undefined : t('resource.unitOnlyMaterial')}
        />
      </td>
      {showParentColumn && (
        <td className="px-2 py-1">
          <select
            value={draft.parentId ?? ''}
            onChange={e => onChange({ parentId: e.target.value || undefined })}
            {...cell('parent')}
            className={cellInput}
          >
            <option value="">{t('resource.noParent')}</option>
            {crews.map(c => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </td>
      )}
      <td className="px-1 py-1" />
    </tr>
  );
}

function AvailabilityStepsEditor({ steps, onChange }: {
  steps: AvailabilityStep[];
  onChange: (steps: AvailabilityStep[]) => void;
}) {
  const { t } = useTranslation('common');

  const update = (idx: number, patch: Partial<AvailabilityStep>) => {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const remove = (idx: number) => onChange(steps.filter((_, i) => i !== idx));
  const add = () => onChange([...steps, { from: formatDate(new Date()), maxUnits: 1 }]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
        {t('resource.availabilityStepsEditor.title')}
      </span>
      {steps.length === 0 && (
        <span className="text-[10px] text-text-secondary">{t('resource.availabilityStepsEditor.empty')}</span>
      )}
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <label className="text-[10px] text-text-secondary">{t('resource.availabilityStepsEditor.from')}</label>
          <DateTextInput
            value={s.from}
            onCommit={v => update(i, { from: v })}
            className="input !text-[11px] !px-1.5 !py-1"
            ariaLabel={t('resource.availabilityStepsEditor.from')}
          />
          <label className="text-[10px] text-text-secondary">{t('resource.availabilityStepsEditor.maxUnits')}</label>
          <UnitsInput
            value={s.maxUnits}
            ariaLabel={t('resource.availabilityStepsEditor.maxUnits')}
            onCommit={n => update(i, { maxUnits: n })}
            className="input !text-[11px] !px-1.5 !py-1 !w-20 text-right"
          />
          <button onClick={() => remove(i)} className="p-0.5 rounded hover:bg-surface-hover" style={{ color: 'var(--error)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button onClick={add} className="btn btn--sm btn--secondary self-start flex items-center gap-1 mt-1">
        <Plus size={12} /> {t('resource.availabilityStepsEditor.addStep')}
      </button>
    </div>
  );
}
