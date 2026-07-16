import { useEffect, type MutableRefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { recoveryBase, recoveryManifestName, recoveryIfcName, type RecoveryManifest } from './recoveryPaths';

// Auto-save bij ELKE wijziging (gedebounced) i.p.v. op een vaste interval:
// we abonneren op de store en schrijven een recovery-snapshot kort nadat de
// wijzigingen tot rust komen (de debounce coalesceert snelle bursts zoals
// slepen/typen tot één schrijfactie). Alle open documenten krijgen een eigen
// IFC-snapshot + een manifest; snapshots van gesloten documenten worden
// opgeruimd.
//
// `autoSaveEnabled` is de gedeelde poort met de recovery-flow (useRecoveryRestore):
// blijft dicht tot de recovery-keuze is gemaakt, zodat de debounced auto-save de
// recovery-snapshots niet overschrijft vóórdat de gebruiker heeft gekozen.
export function useAutoSave(autoSaveEnabled: MutableRefObject<boolean>): void {
  useEffect(() => {
    if (!isTauri()) return;

    let saving = false;
    let pending = false;

    const runAutoSave = async () => {
      // Wacht tot de recovery-keuze gemaakt is: anders zou deze schrijfactie de
      // recovery-snapshots overschrijven vóórdat de gebruiker heeft gekozen.
      if (!autoSaveEnabled.current) return;
      // Voorkom overlappende schrijfacties; vraag een herhaling aan als er
      // tijdens het schrijven nieuwe wijzigingen binnenkwamen.
      if (saving) { pending = true; return; }
      const state = useAppStore.getState();
      const docs = state.getOpenDocumentPayloads();
      if (!docs.some((d) => d.payload.isDirty)) return;
      saving = true;
      try {
        const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs');
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const dir = await appDataDir();

        for (const { id, payload } of docs) {
          const content = writeIFC({
            project: payload.project,
            calendar: payload.calendar,
            tasks: payload.tasks,
            sequences: payload.sequences,
            resources: payload.resources,
            assignments: payload.assignments,
            activityCodeTypes: payload.activityCodeTypes,
            customFieldDefs: payload.customFieldDefs,
            resourceCalendars: payload.calendars,
            baselines: payload.baselines,
            activeBaselineId: payload.activeBaselineId,
          });
          await writeTextFile(await join(dir, recoveryIfcName(id)), content);
        }

        const manifest: RecoveryManifest = {
          version: 1,
          activeDocumentId: state.activeDocumentId,
          documents: docs.map(({ id, payload }) => ({
            id, ifc: recoveryIfcName(id), filePath: payload.filePath, isDirty: payload.isDirty,
          })),
        };
        await writeTextFile(await join(dir, recoveryManifestName), JSON.stringify(manifest));

        // Ruim snapshots op van documenten die niet meer open zijn (zelfde slug).
        const keep = new Set(docs.map((d) => recoveryIfcName(d.id)));
        const prefix = `${recoveryBase}.`;
        for (const entry of await readDir(dir)) {
          const name = entry.name;
          if (name && name.startsWith(prefix) && name.endsWith('.ifc') && !keep.has(name)) {
            await remove(await join(dir, name));
          }
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        saving = false;
        if (pending) { pending = false; void runAutoSave(); }
      }
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useAppStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void runAutoSave(); }, 800);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
