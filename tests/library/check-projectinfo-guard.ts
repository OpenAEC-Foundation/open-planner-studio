import { useAppStore } from '@/state/appStore';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}


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

{
  useAppStore.getState().newProject();

  const resId = useAppStore.getState().addResource({ name: 'Timmerman GO-NA-2', type: 'LABOR', description: '', maxUnits: 1 });
  const companyA = useAppStore.getState().addCompany('GO-NA-fix-2 bedrijf A');
  useAppStore.getState().bindProjectToCompany(companyA);
  assert(useAppStore.getState().project.companyId === companyA, '2a: eerste bind koppelt aan bedrijf A');
  assert(useAppStore.getState().resources.find(r => r.id === resId)?.libraryOrigin === undefined,
    '2a: eerste bind (vanuit ongebonden) strip geen stempels — er was nog niets gestempeld');

  const companyB = useAppStore.getState().addCompany('');
  assert(useAppStore.getState().companies.find(c => c.id === companyB)?.name === 'Nieuwe resourcebibliotheek',
    '2b: addCompany() met lege naam valt terug op "Nieuwe resourcebibliotheek" (hernoemings-restje, GO-NA-fix 5)');
  useAppStore.getState().bindProjectToCompany(companyB);
  assert(useAppStore.getState().project.companyId === companyB, '2b: rebind koppelt aan de net-aangemaakte bedrijf B');
  assert(useAppStore.getState().resources.find(r => r.id === resId)?.libraryOrigin === undefined,
    '2b: rebind strip het (niet-bestaande) stempel van bedrijf A — resource was nooit gestempeld, blijft ongestempeld');

  useAppStore.getState().unbindProject();
  assert(useAppStore.getState().project.companyId === undefined, '2c: unbindProject ontkoppelt het project');

  const untouchedSnapshot = useAppStore.getState().project.companyId;
  assert(untouchedSnapshot === undefined, '2d: negatieve controle — géén aanroep laat companyId exact zoals het was');
}

console.log(`projectinfo-guard: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
