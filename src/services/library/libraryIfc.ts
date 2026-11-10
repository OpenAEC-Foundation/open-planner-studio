/**
 * Pool-bestand: één IFC 4.3-bestand per bedrijf met de kalenders/resources als echte
 * entiteiten (leesbaar voor derden) én de VOLLEDIGE pool als autoritatief `OPS_Library`-JSON
 * (verliesloos, incl. ids/versie). Delegeert aan de bestaande writeIFC/readIFC.
 */
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { normalizePoolShape } from './libraryOps';
import type { CompanyPool } from '@/types/library';
import type { Resource } from '@/types/resource';

/**
 * Markering in het `OPS_Library`-JSON voor een kostenresource (issue #815). De pool-JSON is
 * autoritatief en een oudere versie neemt hem letterlijk over; daar telt een onbekend type als
 * duursturend (v2026.44.0). Daarom schrijft het bestand een kostenresource als `type: 'MATERIAL'`
 * plus deze markering, zoals het projectbestand materiaal als drager gebruikt. De lezer zet hem terug.
 */
export const POOL_COST_RESOURCE_MARKER = 'costResource';

type PoolFileResource = Resource & { [POOL_COST_RESOURCE_MARKER]?: true };

/** Een poolresource zoals het bestand hem schrijft (COST ⇒ MATERIAL + markering). */
export function poolResourceToFile(resource: Resource): PoolFileResource {
  return resource.type === 'COST' ? { ...resource, type: 'MATERIAL', [POOL_COST_RESOURCE_MARKER]: true } : resource;
}

/** Terug uit het bestand: MATERIAL + markering ⇒ COST, de markering zelf valt weg. */
export function poolResourceFromFile(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, unknown>;
  if (!(POOL_COST_RESOURCE_MARKER in r)) return raw;
  const { [POOL_COST_RESOURCE_MARKER]: marker, ...rest } = r;
  return marker === true && rest.type === 'MATERIAL' ? { ...rest, type: 'COST' } : rest;
}

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
    // De entiteiten hierboven dragen COST als gemarkeerde materiaalentiteit; het JSON krijgt
    // MATERIAL + `costResource` (zie `POOL_COST_RESOURCE_MARKER`).
    libraryPool: { ...pool, resources: pool.resources.map(poolResourceToFile) },
  });
}

/**
 * Lees een pool uit een IFC-bestand. Gooit als het bestand geen OPS_Library-pool draagt (`null`/
 * ontbrekende property — de reader kon geen JSON parsen of de prop was leeg/afwezig).
 *
 * Het `OPS_Library`-pset draagt de VOLLEDIGE pool als vrije JSON — elke truthy waarde (een
 * hand-bewerkt bestand, een export van een derde tool, of gewoon `{}`). `PoolImportDialog` leest
 * meteen `imported.calendars.length` in de preview, vóór de gebruiker de import kan bevestigen, dus
 * een pool-JSON zonder `calendars`/`resources` (of met die velden als iets anders dan een array)
 * zou de preview met een TypeError laten crashen. Normaliseer daarom hier door
 * `normalizePoolShape` (dezelfde defensieve shape-garantie als `replacePool`/`normalizeLoadedLibrary`)
 * vóórdat de pool de aanroeper bereikt. `companyId`/`companyName` uit de gelezen pool blijven staan
 * als ze geldige strings zijn (anders leeg/afgeleid) — `replacePool` overschrijft `companyId` toch met
 * het GEKOZEN doelbedrijf zodra de import bevestigd wordt; dit leespunt hoeft alleen een crash-vrije
 * SHAPE te garanderen voor de preview.
 */
export async function readPoolIFC(content: string): Promise<CompanyPool> {
  // Geen `labels`: dienstlaag zonder `t(...)` — pool-bestanden schrijft OPS zelf en hebben altijd een
  // IFCPROJECT. `readIFC` valt dan terug op de Engelse default voor een bestand zonder IFCPROJECT
  // (zie ImportLabels).
  const result = await readIFCWithXerReconstruction(content);
  if (!result.libraryPool) {
    throw new Error('Dit IFC-bestand bevat geen bedrijfsbibliotheek (OPS_Library).');
  }
  const raw = result.libraryPool as Partial<CompanyPool>;
  if (raw && Array.isArray(raw.resources)) raw.resources = raw.resources.map(poolResourceFromFile) as Resource[];
  const cid = typeof raw?.companyId === 'string' && raw.companyId ? raw.companyId : '';
  return normalizePoolShape(cid, raw, []);
}
