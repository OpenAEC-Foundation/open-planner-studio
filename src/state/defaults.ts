import type { Project } from '@/types/project';
import type { ViewState } from './slices/types';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';

/**
 * Default-fabrieken voor documentvelden — een BLADMODULE: hij importeert niets uit `slices/` en
 * niets uit het documentcontract, alleen types en twee utils.
 *
 * Waarom apart (K-item 27). `createDefaultProject` en `createDefaultView` woonden in
 * `projectSlice` respectievelijk `viewSlice`, terwijl `documentContract` en `snapshot` ze als
 * WAARDE importeerden en `projectSlice` daar weer `beginUndoable`/`freshPayload`/`hydratePayload`
 * uit terug-importeerde. Dat gaf twee echte runtime-cykels:
 *
 *   projectSlice → transaction → snapshot → documentContract → projectSlice
 *   projectSlice → transaction → snapshot → projectSlice
 *
 * Die werkten uitsluitend doordat beide fabrieken *function declarations* waren en dus gehoist
 * worden: `DOCUMENT_FIELDS` is een module-level const die `createDefaultProject` op evaluatietijd
 * als `fresh`-callback vastlegt. Iemand die er `export const createDefaultProject = () => …` van
 * maakt — een volstrekt onschuldig ogende stijlwijziging — laat de app crashen bij module-init met
 * een TDZ-`ReferenceError`, mogelijk pas in de productiebundel omdat Vite daar een andere
 * modulevolgorde kiest dan in dev.
 *
 * Vanuit deze bladmodule kan die cyclus niet meer ontstaan. Nieuwe `fresh`-defaults voor
 * documentvelden horen hier, niet in de slice die het veld toevallig bezit.
 */

export function createDefaultProject(): Project {
  return {
    id: generateId('proj'),
    // Een vers project is NAAMLOOS in de data. Hier een (Nederlandse) tekst stempelen zou die taal
    // in het IFC-bestand bakken en nooit meer meeveranderen met de UI-taal; elke weergaveplek valt
    // daarom bij een lege naam terug op `common:project.untitled`.
    name: '',
    description: '',
    startDate: formatDate(new Date()),
    endDate: '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
    defaultTaskDurationUnit: 'days',
    // Nieuwe projecten nummeren de WBS automatisch; geladen bestanden zonder
    // vlag blijven op vrije tekst (zie Project.wbsAutoNumber).
    wbsAutoNumber: true,
  };
}

export function createDefaultView(): ViewState {
  return {
    scrollX: 0,
    scrollY: 0,
    zoom: 30, // pixels per dag
    timeScale: 'week',
    viewStartDate: formatDate(new Date()),
    filter: null,
    group: [],
    sort: [],
    collapsedGroupKeys: [],
  };
}
