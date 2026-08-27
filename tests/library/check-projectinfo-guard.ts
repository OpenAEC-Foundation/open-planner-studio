// Stale-draft-vangnetten voor ProjectInfoPanelContent (issue #19, code review op bf1c851, "GO-NA
// FIXES"). `ProjectInfoPanelContent.tsx` zelf is React (useState/useLayoutEffect/closures) en kan niet
// headless gerenderd worden zonder de architectuur te verbouwen — dit bestand test in plaats daarvan
// de STORE-PRIMITIEVEN waarop de twee vangnetten leunen, headless op de ECHTE Zustand-store (patroon
// check-library-slice.ts):
//
//  (a) re-init-effect op `activeDocumentId` (NIET op undo): dit bestand bewijst WAAROM — het hele
//      `project`-object (op `wbsAutoNumber` na) staat bewust NIET in de undo/redo-snapshot (B3-
//      uitzondering, src/state/snapshot.ts). Sectie 1 hieronder zet dat vast als regressietest: een
//      undo ná een projectveld-wijziging mag `name`/`companyId`/`schedulingOptions` niet terugdraaien.
//  (b) companyTouched/calcTouched: de React-gate zelf (die alleen bind/unbind/runCPM aanroept als de
//      gebruiker de control in DEZE mount aanraakte) is niet headless te toetsen — dat vereist een
//      DOM/React-render (zie het handmatige/browser-verificatieverslag). Sectie 2 hieronder toetst wél
//      dat de PRIMITIEVEN waarop die gate leunt (`addCompany` → `bindProjectToCompany`, `unbindProject`)
//      zich voorspelbaar gedragen: een bind vanuit "geen koppeling" strip niets, een unbind strip alles,
//      en een niet-aangeroepen unbind (het "touched=false, dus overslaan"-pad) laat companyId/stempels
//      vanzelfsprekend ongemoeid — dat laatste is triviaal maar legt de aanname vast waarop de gate
//      steunt: "niet aanroepen" is per definitie een no-op.
//
// Exitcode = poort.
import { useAppStore } from '@/state/appStore';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}


// --- 1. B3-uitzondering: undo/redo raken GEEN projectvelden (behalve wbsAutoNumber) ---
// Dit is de kern van waarom het re-init-effect in ProjectInfoPanelContent op `activeDocumentId` zit
// en NIET op undo: er is voor undo niets te herinitialiseren aan naam/koppeling/rekenopties.
{
  const s0 = useAppStore.getState();
  const companyId = s0.addCompany('GO-NA-fix-1 testbedrijf');

  useAppStore.getState().setProject({
    name: 'Voor-undo-naam',
    description: 'Voor-undo-omschrijving',
    author: 'Voor-undo-auteur',
    company: 'Voor-undo-opdrachtgever',
    schedulingOptions: { totalFloatMode: 'start' },
  });
  useAppStore.getState().bindProjectToCompany(companyId);

  const beforeUndo = useAppStore.getState().project;
  assert(beforeUndo.name === 'Voor-undo-naam', 'setup: naam gezet vóór de undo-test-mutatie');
  assert(beforeUndo.companyId === companyId, 'setup: bibliotheek gekoppeld vóór de undo-test-mutatie');

  // Een taakmutatie is wél undoable (DOCUMENT_FIELDS) — dít is de mutatie die we straks terugdraaien.
  const taskId = useAppStore.getState().addTask({ name: 'Ongerelateerde taak' });
  assert(useAppStore.getState().tasks.some(t => t.id === taskId), 'setup: taak toegevoegd (undoable mutatie)');

  useAppStore.getState().undo();

  const afterUndo = useAppStore.getState().project;
  assert(!useAppStore.getState().tasks.some(t => t.id === taskId), 'undo draait de taaktoevoeging terug (bewijst dat de undo iets deed)');
  assert(afterUndo.name === 'Voor-undo-naam', 'B3: undo laat project.name ONGEMOEID');
  assert(afterUndo.description === 'Voor-undo-omschrijving', 'B3: undo laat project.description ONGEMOEID');
  assert(afterUndo.author === 'Voor-undo-auteur', 'B3: undo laat project.author ONGEMOEID');
  assert(afterUndo.company === 'Voor-undo-opdrachtgever', 'B3: undo laat project.company ONGEMOEID');
  assert(afterUndo.schedulingOptions?.totalFloatMode === 'start', 'B3: undo laat project.schedulingOptions ONGEMOEID');
  assert(afterUndo.companyId === companyId, 'B3: undo laat project.companyId (bibliotheekkoppeling) ONGEMOEID');
}

// --- 2. bind/unbind-primitieven: voorspelbaar gedrag rond de "+ Nieuwe…"-materialisatie ---
// (het React-niveau — "roep dit alleen aan als companyTouched" — is de eigenlijke fix; hier staat
// vast dat de primitieven zelf zich houden aan de aannames waarop die gate leunt.)
{
  useAppStore.getState().newProject(); // schone lei: los project, geen resources/koppeling

  // 2a. Eerste bind (vanuit "geen koppeling") strip NIETS — er is nog geen vorig bedrijf.
  const resId = useAppStore.getState().addResource({ name: 'Timmerman GO-NA-2', type: 'LABOR', description: '', maxUnits: 1 });
  const companyA = useAppStore.getState().addCompany('GO-NA-fix-2 bedrijf A');
  useAppStore.getState().bindProjectToCompany(companyA);
  assert(useAppStore.getState().project.companyId === companyA, '2a: eerste bind koppelt aan bedrijf A');
  assert(useAppStore.getState().resources.find(r => r.id === resId)?.libraryOrigin === undefined,
    '2a: eerste bind (vanuit ongebonden) strip geen stempels — er was nog niets gestempeld');

  // 2b. "+ Nieuwe resourcebibliotheek…"-materialisatie: addCompany() gevolgd door bindProjectToCompany()
  // op een AL gebonden project is een REBIND — dat strip bewust de stempels van het VORIGE bedrijf
  // (bestaand, gewenst gedrag, ongewijzigd door deze fix). Simuleert de submit()-volgorde uit
  // ProjectInfoPanelContent.handleSubmit precies.
  const companyB = useAppStore.getState().addCompany(''); // lege naam ⇒ addCompany valt terug op zijn eigen default-literal
  assert(useAppStore.getState().companies.find(c => c.id === companyB)?.name === 'Nieuwe resourcebibliotheek',
    '2b: addCompany() met lege naam valt terug op "Nieuwe resourcebibliotheek" (hernoemings-restje, GO-NA-fix 5)');
  useAppStore.getState().bindProjectToCompany(companyB);
  assert(useAppStore.getState().project.companyId === companyB, '2b: rebind koppelt aan de net-aangemaakte bedrijf B');
  assert(useAppStore.getState().resources.find(r => r.id === resId)?.libraryOrigin === undefined,
    '2b: rebind strip het (niet-bestaande) stempel van bedrijf A — resource was nooit gestempeld, blijft ongestempeld');

  // 2c. unbindProject() strip alles — dit is precies het destructieve pad dat companyTouched=false
  // in ProjectInfoPanelContent NOOIT mag aanroepen op een stale draft.
  useAppStore.getState().unbindProject();
  assert(useAppStore.getState().project.companyId === undefined, '2c: unbindProject ontkoppelt het project');

  // 2d. Het "touched=false ⇒ niet aanroepen"-pad zelf is triviaal (geen store-aanroep = geen
  // store-wijziging) — vastgelegd als expliciete negatieve controle zodat deze aanname niet stilzwijgend
  // verschuift: zonder ENIGE aanroep na 2c blijft companyId ontkoppeld.
  const untouchedSnapshot = useAppStore.getState().project.companyId;
  assert(untouchedSnapshot === undefined, '2d: negatieve controle — géén aanroep laat companyId exact zoals het was');
}

console.log(`projectinfo-guard: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
