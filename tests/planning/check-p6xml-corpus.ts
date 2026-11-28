import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readP6XMLDocuments } from '@/services/p6/p6xmlReader';
import { P6XmlImportError } from '@/services/p6/p6xmlErrors';
import { isMultiDocumentImport } from '@/services/importTypes';
import { installDOMParser } from './xmldom-shim';

declare const process: { env: Record<string, string | undefined>; exitCode?: number };
installDOMParser();

interface DocPin {
  tasks: number;
  leaves: number;
  sequences: number;
  resources: number;
  assignments: number;
  libraryCalendars: number;
  baselines: number;
}

interface Pin {
  docs: DocPin[];
  active: number;
  projectsSeen: number;
  emptyProjectsSkipped: number;
  crossProjectRelations: number;
  danglingBaselineReferences?: number;
  unassignedActivities?: number;
  emptyReason?: string;
  note?: string;
}

const PINS: Readonly<Record<string, Pin>> = {
  '19d272bfb4ba6d2a': {
    docs: [
      { tasks: 2, leaves: 2, sequences: 0, resources: 10, assignments: 4, libraryCalendars: 4, baselines: 2 },
    ],
    active: 0, projectsSeen: 1, emptyProjectsSkipped: 0, crossProjectRelations: 0, note: '1 project + 2 baselines (beide gekoppeld)',
  },
  '2484b7e46d5849db': {
    docs: [
      { tasks: 1, leaves: 1, sequences: 0, resources: 3, assignments: 0, libraryCalendars: 0, baselines: 0 },
      { tasks: 2, leaves: 2, sequences: 0, resources: 3, assignments: 0, libraryCalendars: 1, baselines: 0 },
    ],
    active: 1, projectsSeen: 2, emptyProjectsSkipped: 0, crossProjectRelations: 1, note: '2 projecten; de relatie tussen de projecten wordt geen relatie',
  },
  '2dc3c997fd310ea7': {
    docs: [],
    active: -1, projectsSeen: 0, emptyProjectsSkipped: 0, crossProjectRelations: 0, emptyReason: 'xer-columns', note: 'geen PMXML: XER-kolomnamen in XML',
  },
  '2ea223e8fca95b01': {
    docs: [
      { tasks: 42, leaves: 35, sequences: 33, resources: 9, assignments: 24, libraryCalendars: 2, baselines: 0 },
    ],
    active: 0, projectsSeen: 1, emptyProjectsSkipped: 0, crossProjectRelations: 0, note: '33 activiteiten + 2 lege WBS',
  },
  '598477da2157b02a': {
    docs: [
      { tasks: 13, leaves: 10, sequences: 5, resources: 0, assignments: 0, libraryCalendars: 0, baselines: 0 },
    ],
    active: 0, projectsSeen: 1, emptyProjectsSkipped: 0, crossProjectRelations: 0,
  },
  '7a1a2297ba53f29e': {
    docs: [
      { tasks: 4, leaves: 4, sequences: 0, resources: 0, assignments: 0, libraryCalendars: 2, baselines: 0 },
    ],
    active: 0, projectsSeen: 1, emptyProjectsSkipped: 0, crossProjectRelations: 0,
  },
  '8159ad929ead0c47': {
    docs: [
      { tasks: 12, leaves: 5, sequences: 0, resources: 0, assignments: 0, libraryCalendars: 0, baselines: 0 },
      { tasks: 12, leaves: 5, sequences: 0, resources: 0, assignments: 0, libraryCalendars: 0, baselines: 0 },
    ],
    active: 0, projectsSeen: 2, emptyProjectsSkipped: 0, crossProjectRelations: 0, note: '2 projecten van elk 5 activiteiten',
  },
  '946291e38feb2b03': {
    docs: [
      { tasks: 18, leaves: 15, sequences: 0, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 0 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 0 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 0 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 2 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 19, libraryCalendars: 3, baselines: 1 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 1 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 2 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 1 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 0, libraryCalendars: 3, baselines: 2 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 20, libraryCalendars: 3, baselines: 1 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 20, libraryCalendars: 3, baselines: 1 },
      { tasks: 17, leaves: 14, sequences: 15, resources: 7, assignments: 20, libraryCalendars: 3, baselines: 1 },
    ],
    active: 0, projectsSeen: 15, emptyProjectsSkipped: 3, crossProjectRelations: 0, note: '15 projecten (3 leeg) + 12 baselines',
  },
  'b616f936fd6edda9': {
    docs: [],
    active: -1, projectsSeen: 0, emptyProjectsSkipped: 0, crossProjectRelations: 0, emptyReason: 'no-object-ids', note: 'geen schema-PMXML: geen ObjectId, relaties via ActivityId',
  },
  'bcd339e71d0d866e': {
    docs: [
      { tasks: 2, leaves: 2, sequences: 1, resources: 0, assignments: 0, libraryCalendars: 2, baselines: 0 },
    ],
    active: 0, projectsSeen: 1, emptyProjectsSkipped: 0, crossProjectRelations: 0,
  },
  'bce21aa2b7c04995': {
    docs: [
      { tasks: 2, leaves: 2, sequences: 1, resources: 0, assignments: 0, libraryCalendars: 2, baselines: 0 },
    ],
    active: 0, projectsSeen: 1, emptyProjectsSkipped: 0, crossProjectRelations: 0,
  },
  'df16d97e190289ce': {
    docs: [
      { tasks: 2, leaves: 2, sequences: 0, resources: 0, assignments: 0, libraryCalendars: 2, baselines: 0 },
    ],
    active: 0, projectsSeen: 1, emptyProjectsSkipped: 0, crossProjectRelations: 0,
  },
};

const crawl = process.env.OPS_P6XML_CRAWL ?? process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl';
const dirs = ['crawl-pmxml', 'pmxml-samples'].map(d => join(crawl, d)).filter(d => existsSync(d));
if (dirs.length === 0) {
  console.log('OK  p6xml-corpus: crawl (OPS_P6XML_CRAWL/OPS_MPP_CRAWL) niet aanwezig — overgeslagen');
} else {
  const fails: string[] = [];
  const seen = new Set<string>();
  const report = process.env.OPS_P6XML_REPORT === '1';
  let files = 0;
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter(n => n.toLowerCase().endsWith('.xml')).sort()) {
      const bytes = readFileSync(join(dir, name));
      const key = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
      const xml = bytes.toString('utf8');
      files++;
      seen.add(key);
      let got: Pin;
      try {
        const opened = readP6XMLDocuments(xml);
        const docs = isMultiDocumentImport(opened) ? opened.results : [opened];
        const fileReport = docs[0].p6xmlReport;
        got = {
          docs: docs.map(r => ({
            tasks: r.tasks.length,
            leaves: r.tasks.filter(t => t.childIds.length === 0).length,
            sequences: r.sequences.length,
            resources: r.resources.length,
            assignments: r.assignments.length,
            libraryCalendars: (r.resourceCalendars ?? []).length,
            baselines: (r.baselines ?? []).length,
          })),
          active: isMultiDocumentImport(opened) ? opened.activeDocumentIndex : 0,
          projectsSeen: fileReport?.projectsSeen ?? -1,
          emptyProjectsSkipped: fileReport?.emptyProjectsSkipped ?? -1,
          crossProjectRelations: fileReport?.crossProjectRelations ?? -1,
          ...(fileReport?.danglingBaselineReferences ? { danglingBaselineReferences: fileReport.danglingBaselineReferences } : {}),
          ...(fileReport?.unassignedActivities ? { unassignedActivities: fileReport.unassignedActivities } : {}),
        };
      } catch (e) {
        if (e instanceof P6XmlImportError) {
          got = { docs: [], active: -1, projectsSeen: 0, emptyProjectsSkipped: 0, crossProjectRelations: 0, emptyReason: e.reason };
        } else {
          fails.push(`${key}: uitzondering ${(e as Error).message}`);
          continue;
        }
      }
      if (report) {
        const count = (tag: string) => (xml.match(new RegExp(`<${tag}>`, 'g')) ?? []).length;
        console.log(`.   ${key}  ${join(dir, name).slice(crawl.length + 1)}  XML: Activity ${count('Activity')}, Relationship ${count('Relationship')}, Project ${count('Project')}, BaselineProject ${count('BaselineProject')}`);
        console.log(`  '${key}': ${JSON.stringify(got)},`);
      }
      const pin = PINS[key];
      if (!pin) { fails.push(`${key}: geen pin (nieuw corpusbestand?) — gemeten ${JSON.stringify(got)}`); continue; }
      const { note: _note, ...want } = pin;
      if (want.emptyReason === undefined) delete want.emptyReason;
      if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${key}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
    }
  }
  for (const key of Object.keys(PINS)) if (!seen.has(key)) fails.push(`${key}: gepind maar niet gevonden in de crawl`);
  if (fails.length > 0) {
    for (const f of fails) console.log(`XX  p6xml-corpus: ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`OK  p6xml-corpus: ${files} bestanden (${seen.size} unieke inhouden) gelijk aan de pins`);
  }
}
