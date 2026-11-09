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
  rememberedDependentFolderHandle, type DependentFolderRef,
} from '@/services/fileAccess/dependentFolder';
import { candidateFromIfcText, candidatesFromOpenDocuments, dependentLinksFrom, withDependentResult } from './dependentCandidates';
import type { DependentCandidate } from '@/engine/dependentProjects';

const isTauri = () => '__TAURI_INTERNALS__' in window;

/** Leest de map en zet het resultaat bij `documentId`. `false` als het document intussen niet meer
 *  actief is of het project-id veranderde: dan blijft het resultaat weg. */
async function searchIn(
  ref: DependentFolderRef, documentId: string, projectId: string, labels?: ImportLabels,
): Promise<{ projects: number; links: number } | null> {
  const files = await readDependentFolder(ref);
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

/** Documenten waarvoor de achtergrondzoektocht in deze sessie al liep (document-id + project-id). */
const autoSearched = new Set<string>();

/**
 * Bij het openen van een document (of de eerste keer dat het actief is): zoekt vanzelf, op de
 * achtergrond en zonder vraag, als er een onthouden map is. Desktop: het pad uit het project.
 * Chromium: een onthouden handvat met toestemming `granted`; anders niets (toestemming vragen mag alleen
 * bij een klik). Geen melding; een fout blijft stil.
 */
export async function autoSearchDependentProjects(labels?: ImportLabels): Promise<void> {
  const s = useAppStore.getState();
  const documentId = s.activeDocumentId;
  const projectId = s.project.id;
  const key = `${documentId}\u0000${projectId}`;
  if (!projectId || autoSearched.has(key)) return;
  autoSearched.add(key);
  try {
    let ref: DependentFolderRef | null = null;
    if (isTauri()) {
      const path = s.project.dependentProjectsFolder;
      if (path) ref = { kind: 'path', path };
    } else {
      const handle = await rememberedDependentFolderHandle(projectId);
      if (handle && await dependentFolderPermission(handle)) ref = { kind: 'handle', handle };
    }
    if (ref) await searchIn(ref, documentId, projectId, labels);
  } catch (err) {
    console.warn('Afhankelijke projecten: zoeken op de achtergrond mislukt:', err);
  }
}
