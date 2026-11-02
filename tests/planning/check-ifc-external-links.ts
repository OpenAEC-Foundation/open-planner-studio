// De IFC-lezer neemt externe koppelingen (`OPS_ExternalLink`, één JSON-veld) alleen over in een vorm
// die de app aankan. Vroeger nam hij elke JSON-array letterlijk over. Een met de hand bewerkt of
// vreemd bestand met een kapotte koppeling liet dan laden en rekenen vastlopen ("iso.includes is
// not a function") en ook het label in de relatiecel ("reading 'projectName'").
//
// Regel (`storedExternalLinks`): een koppeling zonder geldige richting, type, anker (tekst) of
// bron (project-id als tekst, taak-id niet leeg) valt weg; de andere blijven. Een ontbrekend id of
// een ontbrekende bronstatus wordt aangevuld; een ongeldige lag vervalt. Onbekende extra velden
// blijven staan, zodat een nieuwere versie van de app bij opslaan niets verliest.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readIFC } from '@/services/ifc/ifcReader';
import { createAppStoreContext } from '@/state/appStore';
import { formatExternalRelationVisible } from '@/engine/taskGrid/relationFormat';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

// `run.sh` schrijft de bundel in `tests/planning/`, dus de repo-root ligt twee mappen hoger.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const original = readFileSync(resolve(root, 'examples/showcase-appartementencomplex.ifc'), 'utf8');
const LINKS = /IFCTEXT\('\[\{"direction":"predecessor".*?\]'\)/;
if (!LINKS.test(original)) {
  console.error('XX ifc-external-links: de koppeling van De Vaart staat niet meer in het voorbeeld');
  process.exit(1);
}
const withLinks = (json: string) => original.replace(LINKS, `IFCTEXT('${json}')`);
const linksOf = (text: string) => readIFC(text).tasks.find(task => task.externalLinks)?.externalLinks;

const good = {
  id: 'extlink-a', direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: '2027-04-06T16:00',
  sourceRef: { projectId: 'bron', projectName: 'Terrein', taskId: 'task-1', taskName: 'Bouwrijp', filePath: '/p/terrein.ifc' },
  sourceMissing: true,
};

// (1) Een geldige koppeling komt letterlijk terug.
eq('1 een geldige koppeling blijft gelijk', linksOf(withLinks(JSON.stringify([good]))), [good]);

// (2) Kapotte koppelingen vallen weg; de geldige blijft.
const broken = [
  { direction: 'predecessor', relType: 'FS', anchorDate: 20270406, sourceRef: good.sourceRef, sourceMissing: true },
  { direction: 'sideways' },
  { ...good, id: 'zonder-bron', sourceRef: undefined },
  { ...good, id: 'lege-taak', sourceRef: { projectId: 'bron', taskId: '' } },
  { ...good, id: 'fout-type', relType: 'XX' },
  'geen object',
  null,
  good,
];
const kept = linksOf(withLinks(JSON.stringify(broken)));
eq('2a alleen de geldige koppeling blijft', kept?.map(link => (link as { id?: string } | null)?.id ?? null), ['extlink-a']);

// (3) Laden, rekenen en het relatielabel lopen niet meer vast op zo'n bestand.
{
  const { store } = createAppStoreContext();
  let error = '';
  try {
    store.getState().loadState(readIFC(withLinks(JSON.stringify(broken))) as never);
    store.getState().runCPM();
  } catch (err) { error = (err as Error).message; }
  eq('3a laden en rekenen gooien niet', error, '');
  eq('3b de berekening slaagt', store.getState().cpmResult?.error ?? null, null);
  let labelError = '';
  try { for (const link of kept ?? []) if (link) formatExternalRelationVisible(link); } catch (err) { labelError = (err as Error).message; }
  eq('3c het relatielabel gooit niet', labelError, '');
}

// (4) Aanvullen en opschonen zonder de koppeling te verliezen.
{
  const repaired = linksOf(withLinks(JSON.stringify([
    { direction: 'successor', relType: 'SS', anchorDate: '2027-04-06', sourceRef: { projectId: '', taskId: 'x', projectName: 7 } },
    { ...good, lagMinutes: 'veel' },
    { ...good, toekomstigVeld: { lagKalender: 'bron' } },
  ])));
  eq('4a zonder id: een eigen, uniek id per taak', repaired?.map(link => link.id), ['extlink-ifc-1', 'extlink-a', 'extlink-a-2']);
  eq('4b zonder bronstatus: "bron ontbreekt"', repaired?.[0].sourceMissing, true);
  eq('4c een bronveld dat geen tekst is, vervalt', repaired?.[0].sourceRef, { projectId: '', taskId: 'x' });
  eq('4d een ongeldige lag vervalt; de geldige blijft', [repaired?.[1].lagMinutes, repaired?.[1].lagDays], [undefined, 0]);
  eq('4e een onbekend extra veld blijft staan',
    (repaired?.[2] as unknown as { toekomstigVeld?: unknown }).toekomstigVeld, { lagKalender: 'bron' });
}

// (5) Alleen kapotte koppelingen ⇒ de taak heeft er geen.
eq('5 alleen kapotte koppelingen geeft geen lijst', linksOf(withLinks(JSON.stringify([{ direction: 'sideways' }]))), undefined);

if (failures.length) {
  console.error(`XX ifc-external-links: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK ifc-external-links: ${checks}/${checks}`);
