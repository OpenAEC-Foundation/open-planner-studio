// *Afhankelijke projecten zoeken…* (stap 1.11 van "relaties tussen projecten", keuze 7,
// `docs/relaties-tussen-projecten.md` §7.3). De zoekroute van de app: de map kiezen of de onthouden map
// gebruiken, de IFC-bestanden alleen-lezen lezen, de geopende documenten meetellen en het resultaat per
// document in `ui.dependentProjects` zetten. Het resultaat is sessiedata: niet in het IFC-bestand.
//
// App-module (importeert de gemounte store), net als de bridges; de headless kern laadt hem niet.
import { useAppStore } from '@/state/appStore';
import { summarizeDependentLinks } from '@/engine/dependentProjects';
import type { ImportLabels } from '@/services/importTypes';
import {
  dependentFolderPermission, pickDependentFolder, readDependentFolder, rememberDependentFolderHandle,
  rememberedDependentFolderHandle, type DependentFolderFile, type DependentFolderRef,
} from '@/services/fileAccess/dependentFolder';
import { candidateFromIfcText, candidatesFromOpenDocuments, dependentLinksFrom, withDependentResult } from './dependentCandidates';
import type { DependentCandidate } from '@/engine/dependentProjects';

const isTauri = () => '__TAURI_INTERNALS__' in window;

/** Leest de map en zet het resultaat bij `documentId`. `null` als het document intussen niet meer
 *  actief is of het project-id veranderde: dan blijft het resultaat weg. */
async function searchIn(
  ref: DependentFolderRef, documentId: string, projectId: string, labels?: ImportLabels,
  read: (ref: DependentFolderRef) => Promise<DependentFolderFile[]> = readDependentFolder,
): Promise<{ projects: number; links: number } | null> {
  const files = await read(ref);
  const candidates: DependentCandidate[] = [];
  for (const file of files) {
    const candidate = await candidateFromIfcText(file.name, file.text, labels);
    if (candidate) candidates.push(candidate);
  }
  const s = useAppStore.getState();
  if (s.activeDocumentId !== documentId || s.project.id !== projectId) return null;
  const opened = candidatesFromOpenDocuments(s.getOpenDocumentPayloads(), documentId);
  const links = dependentLinksFrom(opened, candidates, projectId);
  const open = new Set(s.documents.map(d => d.id));
  s.setUI({ dependentProjects: withDependentResult(s.ui.dependentProjects, { documentId, projectId, links }, open) });
  return summarizeDependentLinks(links);
}

/**
 * De knop: de planner kiest een map (of in andere browsers: bestanden), OPS zoekt en meldt het
 * resultaat. Desktop: het pad wordt een projectinstelling (`Project.dependentProjectsFolder`, één
 * undo-stap, het document is daarna gewijzigd). Chromium: het maphandvat gaat per project-id naar
 * IndexedDB.
 */
export async function searchDependentProjectsManually(labels?: ImportLabels): Promise<void> {
  const before = useAppStore.getState();
  const documentId = before.activeDocumentId;
  const projectId = before.project.id;
  let ref: DependentFolderRef | null;
  try {
    ref = await pickDependentFolder(isTauri()
      ? { path: before.project.dependentProjectsFolder }
      : { handle: await rememberedDependentFolderHandle(projectId) });
  } catch (err) {
    console.error('Afhankelijke projecten: map kiezen mislukt:', err);
    before.notify({ severity: 'error', messageKey: 'notifications.dependentProjectsFailed' });
    return;
  }
  if (!ref) return;
  let summary: { projects: number; links: number } | null;
  try {
    summary = await searchIn(ref, documentId, projectId, labels);
  } catch (err) {
    console.error('Afhankelijke projecten: map lezen mislukt:', err);
    useAppStore.getState().notify({ severity: 'error', messageKey: 'notifications.dependentProjectsFailed' });
    return;
  }
  if (!summary) return;
  const s = useAppStore.getState();
  if (ref.kind === 'path' && s.project.dependentProjectsFolder !== ref.path) {
    s.setProject({ dependentProjectsFolder: ref.path });
  } else if (ref.kind === 'handle') {
    await rememberDependentFolderHandle(projectId, ref.handle);
  }
  useAppStore.getState().notify(summary.links === 0
    ? { severity: 'info', messageKey: 'notifications.dependentProjectsNone', dedupeKey: 'dependent-projects', replaceOnDedupe: true }
    : {
      severity: 'info', messageKey: 'notifications.dependentProjectsFound',
      params: { projects: summary.projects, links: summary.links },
      dedupeKey: 'dependent-projects', replaceOnDedupe: true,
    });
}

/** Documenten (document-id + project-id) waarvoor de achtergrondzoektocht in deze sessie een resultaat
 *  plaatste. Pas na het plaatsen: een zoektocht die afbreekt (tabwissel tijdens het lezen) of mislukt,
 *  telt niet, zodat de volgende keer dat het document actief is opnieuw gezocht wordt (review #857). */
const autoSearched = new Set<string>();
/** Zoektochten die nu lopen; een tweede start voor hetzelfde document wacht niet en doet niets. */
const autoSearching = new Set<string>();

/** Naden voor de tests: waar de map vandaan komt en hoe hij gelezen wordt. */
export interface AutoSearchDeps {
  resolveRef?: (project: { id: string; dependentProjectsFolder?: string }) => Promise<DependentFolderRef | null>;
  read?: (ref: DependentFolderRef) => Promise<DependentFolderFile[]>;
}

async function defaultAutoRef(project: { id: string; dependentProjectsFolder?: string }): Promise<DependentFolderRef | null> {
  if (isTauri()) {
    return project.dependentProjectsFolder ? { kind: 'path', path: project.dependentProjectsFolder } : null;
  }
  const handle = await rememberedDependentFolderHandle(project.id);
  return handle && await dependentFolderPermission(handle) ? { kind: 'handle', handle } : null;
}

/**
 * Bij het openen van een document (of de eerste keer dat het actief is): zoekt vanzelf, op de
 * achtergrond en zonder vraag, als er een onthouden map is. Desktop: het pad uit het project.
 * Chromium: een onthouden handvat met toestemming `granted`; anders niets (toestemming vragen mag alleen
 * bij een klik). Geen melding; een fout blijft stil. Eén keer per document en project-id per sessie,
 * geteld vanaf een geplaatst resultaat.
 */
export async function autoSearchDependentProjects(labels?: ImportLabels, deps: AutoSearchDeps = {}): Promise<void> {
  const s = useAppStore.getState();
  const documentId = s.activeDocumentId;
  const projectId = s.project.id;
  const key = `${documentId}\u0000${projectId}`;
  if (!projectId || autoSearched.has(key) || autoSearching.has(key)) return;
  autoSearching.add(key);
  try {
    const ref = await (deps.resolveRef ?? defaultAutoRef)(s.project);
    if (!ref) return;
    const placed = await searchIn(ref, documentId, projectId, labels, deps.read);
    if (placed) autoSearched.add(key);
  } catch (err) {
    console.warn('Afhankelijke projecten: zoeken op de achtergrond mislukt:', err);
  } finally {
    autoSearching.delete(key);
  }
}
