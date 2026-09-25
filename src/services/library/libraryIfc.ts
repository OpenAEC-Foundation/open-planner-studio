/**
 * Pool-bestand (spec §4): één IFC 4.3-bestand per bedrijf met de kalenders/resources als echte
 * entiteiten (leesbaar voor derden) én de VOLLEDIGE pool als autoritatief `OPS_Library`-JSON
 * (verliesloos, incl. ids/versie). Delegeert aan de bestaande writeIFC/readIFC.
 */
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { normalizePoolShape } from './libraryOps';
import type { CompanyPool } from '@/types/library';

/** Serialiseer een pool naar een IFC-bestand (string). */
export function writePoolIFC(pool: CompanyPool): string {
  const project = {
    ...createDefaultProject(),
    name: `Bibliotheek — ${pool.companyName}`,
    company: pool.companyName,
    companyId: pool.companyId,
    companyName: pool.companyName,
  };
  return writeIFC({
    project,
    calendar: createDefaultCalendar(),
    tasks: [],
    sequences: [],
    resources: pool.resources,
    assignments: [],
    resourceCalendars: pool.calendars,
    libraryPool: pool,
  });
}

/**
 * Lees een pool uit een IFC-bestand. Gooit als het bestand geen OPS_Library-pool draagt (`null`/
 * ontbrekende property — de reader kon geen JSON parsen of de prop was leeg/afwezig).
 *
 * F2 (vloot-fixpakket, issue #19): het `OPS_Library`-pset draagt de VOLLEDIGE pool als vrije JSON —
 * elke truthy waarde (een hand-bewerkt bestand, een export van een derde tool, of gewoon `{}`) kwam
 * hiervoor BLIND gecast door als `CompanyPool` terug. `PoolImportDialog` leest meteen
 * `imported.calendars.length` in de preview — vóór de gebruiker de import kan bevestigen, en zonder
 * ErrorBoundary — dus een pool-JSON zonder `calendars`/`resources` (of met die velden als iets
 * anders dan een array) crashte de preview met een TypeError. Normaliseer daarom hier door
 * `normalizePoolShape` (dezelfde defensieve shape-garantie als `replacePool`/`normalizeLoadedLibrary`)
 * vóórdat de pool de aanroeper bereikt. `companyId`/`companyName` uit de gelezen pool blijven staan
 * als ze geldige strings zijn (anders leeg/afgeleid) — `replacePool` overschrijft `companyId` toch met
 * het GEKOZEN doelbedrijf zodra de import bevestigd wordt; dit leespunt hoeft alleen een crash-vrije
 * SHAPE te garanderen voor de preview.
 */
export async function readPoolIFC(content: string): Promise<CompanyPool> {
  // Geen `labels`: dienstlaag zonder `t(...)` — pool-bestanden schrijft OPS zelf en hebben altijd een IFCPROJECT. `readIFC` valt dan terug op de Engelse
  // default voor een bestand zonder IFCPROJECT (zie ImportLabels).
  const result = await readIFCWithXerReconstruction(content);
  if (!result.libraryPool) {
    throw new Error('Dit IFC-bestand bevat geen bedrijfsbibliotheek (OPS_Library).');
  }
  const raw = result.libraryPool as Partial<CompanyPool>;
  const cid = typeof raw?.companyId === 'string' && raw.companyId ? raw.companyId : '';
  return normalizePoolShape(cid, raw, []);
}
