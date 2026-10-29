import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { documentTitle } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import type { RecoveryEntry } from '@/components/dialogs/RecoveryDialog';
import { recoveryInputFromParsed, type RecoveryDocInput } from '@/state/documentContract';
import { loadRecovery, clearRecovery, holdRecoveryForLater } from '@/services/recovery/recoveryStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';

// In-app herstel-dialoog (vervangt de native OS-`ask()`): de gedetecteerde
// recovery-payload + de callbacks om te herstellen/verwerpen/uitstellen. Lokale
// state i.p.v. een ui.show*-flag houdt de detectie-logica (geparste IFC,
// opruim-closures) bij elkaar en vermijdt slice-wijzigingen.
export interface RecoveryState {
  entries: RecoveryEntry[];
  onRestore: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export interface RecoveryRestore {
  recovery: RecoveryState | null;
  // Reactief signaal "recovery-flow volledig afgehandeld" — waar
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
  // De reader heeft zelf geen `t(...)`; het label voor een snapshot zónder IFCPROJECT gaat mee.
  // (Snapshots zijn door OPS zelf geschreven en hebben er altijd een — dit is een vangnet.)
  const { t } = useTranslation('common');
  // Recovery is een opstartbewerking, geen taalreactieve weergave. De vertaler van die ene sessie
  // blijft daarom stabiel wanneer de gebruiker tijdens of na de check van taal wisselt.
  const startupTRef = useRef(t);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  // Gezet op exact dezelfde momenten als `autoSaveEnabled.current = true` (dezelfde
  // `finish()`-closure).
  const [recoveryResolved, setRecoveryResolved] = useState(false);
  const autoSaveEnabled = useRef(false);

  // Check op recovery-data bij het opstarten. Platform-agnostisch: het backend (Tauri-bestanden
  // of IndexedDB in de browser) zit achter `recoveryStore`.
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;

    void (async () => {
      // Poort opent zodra de keuze is gemaakt (of er niets te herstellen valt);
      // pas dan mag de auto-save de snapshots overschrijven.
      const finish = () => { autoSaveEnabled.current = true; setRecoveryResolved(true); };
      try {
        const loaded = await loadRecovery();
        const readFailures = loaded.readFailures ?? [];
        if (loaded.docs.length === 0 && readFailures.length === 0) { finish(); return; }
        for (const failure of readFailures) {
          useAppStore.getState().notify({
            severity: 'error', messageKey: 'notifications.recoveryReadFailed',
            detail: failure.detail, dedupeKey: 'recovery-read',
          });
        }

        // Parse elke snapshot vooraf zodat de dialoog projectnaam + taakaantal kan tonen, en
        // hergebruik dat resultaat bij het daadwerkelijke herstellen.
        const restored: RecoveryDocInput[] = [];
        const entries: RecoveryEntry[] = [];
        /** Zowel I/O- als parsefouten verhinderen opruimen, ook bij gedeeltelijk gezond herstel. */
        let failed = readFailures.length;
        for (const d of loaded.docs) {
          try {
            // Een snapshot met archiefVERWIJZING (eigenaarsbesluit plan (9)) haalt de bronbytes uit
            // de crashherstelopslag. Ontbreekt de blob, dan opent het document zonder archief en
            // met de `xerArchiveIssue`-melding ("openen met melding"), net als elk onbruikbaar archief.
            const parsed = await readIFCWithXerReconstruction(
              d.ifc, buildImportLabels(startupTRef.current),
              { resolveXerArchiveReference: (sha256) => loaded.archives.get(sha256) },
            );
            // Welke velden bij crashherstel meegaan bepaalt `recoveryInputFromParsed` — deze hook
            // houdt bewust geen veldkennis.
            restored.push(recoveryInputFromParsed(parsed, {
              id: d.id,
              filePath: d.filePath,
              // Het site-opslagdoel van vóór de crash (issue #309) en de versie waarop dit document
              // rustte: Ctrl+S schrijft na herstel weer naar de site, mét conflictcontrole. Ouder
              // manifest ⇒ `null`.
              siteFileId: d.siteFileId ?? null,
              siteFileVersion: d.siteFileVersion ?? null,
              isDirty: d.isDirty,
              datesAsRecorded: d.datesAsRecorded,
            }));
            entries.push({
              id: d.id,
              name: documentTitle(d.filePath, parsed.project.name, documentProjectCode(parsed.project, parsed.xer)),
              filePath: d.filePath,
              taskCount: parsed.tasks.length,
              mtime: d.mtime,
            });
          } catch (err) {
            // `readIFC` gooit een `IfcParseError` bij een bestand zonder STEP-kop of zonder
            // sluitmarkering (= afgekapt). Zo'n snapshot wordt dus NIET als volwaardig document
            // aangeboden; de overige documenten lopen gewoon door.
            failed++;
            console.error('Failed to read recovery document:', d.id, err);
            // dedupeKey: de lus hierboven itereert per document, dus bij vijf kapotte snapshots
            // willen we één regel met teller, geen vijf afzonderlijke meldingen.
            useAppStore.getState().notify({
              severity: 'error',
              messageKey: 'notifications.recoveryReadFailed',
              detail: (err as Error).message,
              dedupeKey: 'recovery-read',
            });
          }
        }

        // Ook uitsluitend onleesbare kopieën krijgen een expliciete keuze. Sluiten bewaart ze;
        // alleen bewust verwerpen mag ze wissen. Zonder die keuze bleven ze onbeperkt terugkomen.
        if (entries.length === 0 && failed === 0) {
          await clearRecovery();
          finish();
          return;
        }

        setRecovery({
          entries,
          // Volgorde is hier essentieel: `clearRecovery()` pas NADAT de documenten aantoonbaar in de
          // store staan (niet fire-and-forget ernaast); gooit het herstel, dan blijven de snapshots
          // op schijf staan.
          onRestore: () => {
            void (async () => {
              try {
                // `restoreDocuments` gooit niet op een corrupt-maar-parseerbaar document (bv. een
                // cyclische WBS-relatie die de solver laat gooien) — het slaat zo'n document zelf
                // over en geeft de overgeslagen id's terug.
                const skipped = restored.length > 0
                  ? useAppStore.getState().restoreDocuments(restored, loaded.activeDocumentId).skippedIds
                  : [];
                // Dialoog meteen weg zodra het herstel zelf klaar is — de opruimactie eronder is
                // bestands-I/O en mag de gebruiker niet laten wachten.
                setRecovery(null);
                // Alleen wissen als ALLES is meegenomen: ook vooraf onleesbare snapshots tellen
                // mee, niet alleen documenten die restoreDocuments oversloeg. Anders blijft de
                // volledige snapshotset staan — er is geen selectieve delete in `recoveryStore`, en
                // de enige kopie van een overgeslagen document wissen zou het bewijs met de data
                // weggooien (zelfde afweging als de parse-fout hierboven in de detectiefase).
                //
                // Prijs: de volgende start kan dezelfde set en foutmelding opnieuw tonen.
                // "Verwerpen" blijft de expliciete uitweg. De herstelde documenten blijven open;
                // hun volgende auto-save krijgt verse snapshots; pas daarna mag desktop de vervangen
                // gezonde generatie opruimen. De mislukte generatie
                // blijft beschermd via holdRecoveryForLater (web: vastgehouden generatie; Tauri:
                // overgenomen manifestregels die elke ronde meegaan, ook bij een v1-manifest).
                if (failed === 0 && skipped.length === 0) await clearRecovery();
                else await holdRecoveryForLater(restored.filter(doc => !skipped.includes(doc.id)).map(doc => doc.id));
              } catch (err) {
                // Snapshots blijven staan. `finish()` gaat bewust wél door: de auto-save-poort
                // dichthouden zou betekenen dat vanaf nu NIETS meer wordt weggeschreven — een
                // groter risico dan het verlies van deze ene snapshotgeneratie. De fout is ook
                // gebruikerszichtbaar via het meldingenkanaal; de debug-terminal houdt
                // via appLog de volledige stack bij.
                console.error('Recovery: herstellen mislukt — snapshots blijven staan:', err);
                if (!notifyRecoveryError(err, useAppStore.getState().notify)) useAppStore.getState().notify({
                  severity: 'error',
                  messageKey: 'notifications.recoveryRestoreFailed',
                  detail: (err as Error).message,
                });
                // "Blijven staan" vraagt op het web een expliciete hold: anders ruimt de eerste
                // crashherstel-ronde onder hetzelfde sessie-id deze generatie op (review 2026-09-28).
                // Op Tauri neemt hij de manifestregels over (zie `holdTauri`).
                try {
                  await holdRecoveryForLater();
                } catch (holdErr) {
                  console.error('Recovery: snapshots vasthouden na mislukt herstel mislukt:', holdErr);
                }
              } finally {
                setRecovery(null);
                finish();
              }
            })();
          },
          onDiscard: () => {
            void clearRecovery().catch((err: unknown) => {
              if (!notifyRecoveryError(err, useAppStore.getState().notify)) {
                console.error('Recovery: verwerpen mislukt:', err);
              }
            });
            setRecovery(null);
            finish();
          },
          // Uitstellen: snapshots laten staan, niet herstellen (zie RecoveryDialog). Eerst
          // vasthouden, dan pas de auto-save aan: anders overschrijft de eerste crashherstel-ronde
          // op het web de uitgestelde generatie (zelfde sessie-id na een herlaad).
          onClose: () => {
            setRecovery(null);
            void holdRecoveryForLater()
              .catch((err: unknown) => {
                if (!notifyRecoveryError(err, useAppStore.getState().notify)) {
                  console.error('Recovery: uitstellen kon de snapshots niet vasthouden:', err);
                }
              })
              .finally(finish);
          },
        });
      } catch (err) {
        if (!notifyRecoveryError(err, useAppStore.getState().notify)) {
          console.error('Recovery check failed:', err);
        }
        finish();
      }
    })();
  }, []);

  return { recovery, recoveryResolved, autoSaveEnabled };
}
