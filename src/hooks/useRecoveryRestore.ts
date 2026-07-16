import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { readIFC } from '@/services/ifc/ifcReader';
import { documentTitle } from '@/utils/documents';
import type { RecoveryEntry } from '@/components/dialogs/RecoveryDialog';
import type { RecoveryDocInput } from '@/state/slices/documentSlice';
import { recoveryManifestName, legacyRecoveryFile, type RecoveryManifest } from './recoveryPaths';

// In-app herstel-dialoog (vervangt de native OS-`ask()`): de gedetecteerde
// recovery-payload + de callbacks om te herstellen/verwerpen/uitstellen. Lokale
// state i.p.v. een ui.show*-flag houdt de detectie-logica (paden, geparste IFC,
// opruim-closures) bij elkaar en vermijdt slice-wijzigingen.
export interface RecoveryState {
  entries: RecoveryEntry[];
  onRestore: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export interface RecoveryRestore {
  recovery: RecoveryState | null;
  // Fase 2.10 onderdeel 3 (§3): reactief signaal "recovery-flow volledig afgehandeld" — waar
  // `autoSaveEnabled` een ref is (niet reactief, alleen voor de auto-save-timer), heeft de
  // welkomstdialoog-bootstrap-check een render-triggerende state nodig om pas te vuren NADAT de
  // recovery-detectie/-keuze echt klaar is (nooit gelijktijdig met RecoveryDialog).
  recoveryResolved: boolean;
  // Auto-save-poort: blijft dicht tot de recovery-keuze is gemaakt, zodat de debounced
  // auto-save de recovery-snapshots niet overschrijft vóórdat de gebruiker heeft gekozen.
  // Gaat open bij: geen recovery-data, een fout tijdens detectie, of nadat de gebruiker
  // herstelt/verwerpt/uitstelt. Gedeeld met useAutoSave.
  autoSaveEnabled: MutableRefObject<boolean>;
}

export function useRecoveryRestore(): RecoveryRestore {
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  // Gezet op exact dezelfde momenten als `autoSaveEnabled.current = true` (dezelfde
  // `finish()`-closure + de niet-Tauri-kortsluiting).
  const [recoveryResolved, setRecoveryResolved] = useState(false);
  const autoSaveEnabled = useRef(false);

  // Check for recovery file on startup
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;

    (async () => {
      // Buiten Tauri is er geen recovery/auto-save: poort meteen open.
      if (!isTauri()) { autoSaveEnabled.current = true; setRecoveryResolved(true); return; }
      // Poort opent zodra de keuze is gemaakt (of er niets te herstellen valt);
      // pas dan mag de auto-save de snapshots overschrijven.
      const finish = () => { autoSaveEnabled.current = true; setRecoveryResolved(true); };
      try {
        const { readTextFile, exists, remove, stat } = await import('@tauri-apps/plugin-fs');
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const dir = await appDataDir();
        const manifestPath = await join(dir, recoveryManifestName);

        // Nieuw pad: multi-document manifest. Parse elke snapshot vooraf zodat de
        // dialoog projectnaam + taakaantal kan tonen, en hergebruik dat resultaat
        // bij het daadwerkelijke herstellen.
        if (await exists(manifestPath)) {
          const manifest = JSON.parse(await readTextFile(manifestPath)) as RecoveryManifest;
          const restored: RecoveryDocInput[] = [];
          const entries: RecoveryEntry[] = [];
          for (const d of manifest.documents) {
            try {
              const ifcPath = await join(dir, d.ifc);
              const parsed = readIFC(await readTextFile(ifcPath));
              restored.push({
                id: d.id,
                project: parsed.project, calendar: parsed.calendar, tasks: parsed.tasks,
                sequences: parsed.sequences, resources: parsed.resources, assignments: parsed.assignments,
                activityCodeTypes: parsed.activityCodeTypes, customFieldDefs: parsed.customFieldDefs,
                resourceCalendars: parsed.resourceCalendars,
                filePath: d.filePath ?? null, isDirty: d.isDirty ?? true,
              });
              let mtime: Date | null = null;
              try { mtime = (await stat(ifcPath)).mtime; } catch { /* geen mtime — laat null */ }
              entries.push({
                id: d.id,
                name: documentTitle(d.filePath ?? null, parsed.project.name),
                filePath: d.filePath ?? null,
                taskCount: parsed.tasks.length,
                mtime,
              });
            } catch (err) {
              console.error('Failed to read recovery document:', d.id, err);
            }
          }

          // Opruimen: alle gerefereerde snapshots + het manifest.
          const cleanup = async () => {
            for (const d of manifest.documents) {
              try { await remove(await join(dir, d.ifc)); } catch { /* al weg */ }
            }
            try { await remove(manifestPath); } catch { /* al weg */ }
          };

          // Niets bruikbaars geparst → stil opruimen, geen dialoog.
          if (entries.length === 0) { await cleanup(); finish(); return; }

          setRecovery({
            entries,
            onRestore: () => {
              if (restored.length > 0) {
                useAppStore.getState().restoreDocuments(restored, manifest.activeDocumentId ?? null);
              }
              void cleanup();
              setRecovery(null);
              finish();
            },
            onDiscard: () => { void cleanup(); setRecovery(null); finish(); },
            // Uitstellen: bestanden laten staan, niet herstellen (zie RecoveryDialog).
            onClose: () => { setRecovery(null); finish(); },
          });
          return;
        }

        // Terugval: oude losse <base>.ifc (één document).
        const legacyPath = await join(dir, legacyRecoveryFile);
        if (await exists(legacyPath)) {
          const content = await readTextFile(legacyPath);
          let parsed: ReturnType<typeof readIFC>;
          try {
            parsed = readIFC(content);
          } catch (err) {
            console.error('Failed to parse legacy recovery file:', err);
            try { await remove(legacyPath); } catch { /* al weg */ }
            finish();
            return;
          }
          let mtime: Date | null = null;
          try { mtime = (await stat(legacyPath)).mtime; } catch { /* geen mtime — laat null */ }
          const cleanup = async () => { try { await remove(legacyPath); } catch { /* al weg */ } };
          setRecovery({
            entries: [{
              id: 'legacy',
              name: parsed.project.name,
              filePath: null,
              taskCount: parsed.tasks.length,
              mtime,
            }],
            onRestore: () => {
              try { useAppStore.getState().loadState(parsed); } catch (err) {
                console.error('Failed to restore recovery file:', err);
              }
              void cleanup();
              setRecovery(null);
              finish();
            },
            onDiscard: () => { void cleanup(); setRecovery(null); finish(); },
            onClose: () => { setRecovery(null); finish(); },
          });
          return;
        }

        // Geen recovery-data gevonden.
        finish();
      } catch (err) {
        console.error('Recovery check failed:', err);
        finish();
      }
    })();
  }, []);

  return { recovery, recoveryResolved, autoSaveEnabled };
}
