// #804 stap 8: de meldingen waarmee Automatisch opslaan bij een document met een gebouwmodel veilig stopt (ontwerp §4.10:
// "AutoSave naar het bestand geeft één melding en stopt voor dit document tot de planner kiest"). Weigeringen (rood, tot
// het kruisje); `fileAutoSave.ts` toont er één per document per sessie en probeert niet opnieuw tot de planner zelf
// opslaat of een ander doel kiest. Een gebouwmodel van een ander op het doel en een onleesbaar doel houden hun bestaande
// meldingen (`IFC_FOREIGN_TARGET_AUTOSAVE_NOTICE`, `IFC_UNREADABLE_TARGET_AUTOSAVE_NOTICE` in `ifcForeignGuard.ts`).
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

/** Op het eigen bestand staat niet meer precies de bron: iemand anders schreef het, of het is weg of onleesbaar. */
export const MODEL_AUTOSAVE_TARGET_CHANGED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignAutoSaveTargetChanged', dedupeKey: 'ifc-foreign-autosave-target-changed',
});
/** Vervangen kan op deze plek niet veilig: buiten de thuismap op de desktop (knownbug 1762), een link, of een
 *  bestandssysteem zonder de exclusieve stap. */
export const MODEL_AUTOSAVE_SAVE_AS_ONLY_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignAutoSaveSaveAsOnly', dedupeKey: 'ifc-foreign-autosave-save-as-only',
});
/** Het herstelrecord of het herstelmanifest kon de komende versie niet vastleggen (knownbug 1764). */
export const MODEL_AUTOSAVE_NOT_RECORDED_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignAutoSaveNotRecorded', dedupeKey: 'ifc-foreign-autosave-not-recorded',
});
/** Voor dit doel staat nog een herstelrecord van een eerdere, onderbroken vervanging (desktop). */
export const MODEL_AUTOSAVE_REMNANT_NOTICE: NotifyInput = refusalNotice({
  messageKey: 'notifications.ifcForeignAutoSaveRemnant', dedupeKey: 'ifc-foreign-autosave-remnant',
});
