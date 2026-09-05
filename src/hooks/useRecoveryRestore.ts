import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { documentTitle } from '@/utils/documents';
import type { RecoveryEntry } from '@/components/dialogs/RecoveryDialog';
import { recoveryInputFromParsed, type RecoveryDocInput } from '@/state/documentContract';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { buildImportLabels } from '@/i18n/importLabels';

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
        if (loaded.docs.length === 0) { finish(); return; }

        // Parse elke snapshot vooraf zodat de dialoog projectnaam + taakaantal kan tonen, en
        // hergebruik dat resultaat bij het daadwerkelijke herstellen.
        const restored: RecoveryDocInput[] = [];
        const entries: RecoveryEntry[] = [];
        /** Hoeveel snapshots op het parsen stukliepen — bepaalt of we mogen opruimen (zie onder). */
        let failed = 0;
        for (const d of loaded.docs) {
          try {
            const parsed = await readIFCWithXerReconstruction(
              d.ifc, buildImportLabels(startupTRef.current),
            );
            // Welke velden bij crashherstel meegaan bepaalt `recoveryInputFromParsed` (bevinding
            // K3) — deze hook houdt bewust geen veldkennis.
            restored.push(recoveryInputFromParsed(parsed, {
              id: d.id,
              filePath: d.filePath,
              isDirty: d.isDirty,
            }));
            entries.push({
              id: d.id,
              name: documentTitle(d.filePath, parsed.project.name),
              filePath: d.filePath,
              taskCount: parsed.tasks.length,
              mtime: d.mtime,
            });
          } catch (err) {
            // Vuurt sinds K4 ook echt: `readIFC` gooit nu een `IfcParseError` bij een bestand
            // zonder STEP-kop of zonder sluitmarkering (= afgekapt). Zo'n snapshot wordt dus NIET
            // meer als volwaardig document aangeboden; de overige documenten lopen gewoon door.
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

        // Niets bruikbaars geparst → geen dialoog. Wél of niet opruimen hangt af van de RÉDEN:
        // stond er domweg niets, dan is wissen correct. Liepen de snapshots stuk op het parsen,
        // dan is dit de enige kopie van werk dat de gebruiker nooit heeft kunnen opslaan — die
        // weggooien zonder iets te vragen wist het bewijs mét de data. De melding uit de catch
        // hierboven blijft staan; de bestanden blijven op schijf, zodat een volgende versie (of
        // een handmatige reparatie) er alsnog bij kan.
        if (entries.length === 0) {
          if (failed === 0) await clearRecovery();
          finish();
          return;
        }

        setRecovery({
          entries,
          // Volgorde is hier de hele bevinding (K4): `clearRecovery()` liep vroeger NAAST het
          // herstellen (fire-and-forget, `void`), dus de snapshots konden al gewist zijn terwijl
          // het herstel nog moest slagen. Nu pas wissen NADAT de documenten aantoonbaar in de
          // store staan; gooit het herstel, dan blijven de snapshots op schijf staan.
          onRestore: () => {
            void (async () => {
              try {
                // `restoreDocuments` gooit sinds de recovery-robuustheidsfix niet meer op een
                // corrupt-maar-parseerbaar document (bv. een cyclische WBS-relatie die de solver
                // laat gooien) — het slaat zo'n document zelf over en geeft de overgeslagen id's
                // terug. Zolang er niets is overgeslagen is het resultaat byte-voor-byte hetzelfde
                // als voorheen.
                const skipped = restored.length > 0
                  ? useAppStore.getState().restoreDocuments(restored, loaded.activeDocumentId).skippedIds
                  : [];
                // Dialoog meteen weg zodra het herstel zelf klaar is — de opruimactie eronder is
                // bestands-I/O en mag de gebruiker niet laten wachten.
                setRecovery(null);
                // Alleen wissen als ALLES is meegenomen. Is er iets overgeslagen, dan blijft de
                // volledige snapshotset staan — er is geen selectieve delete in `recoveryStore`, en
                // de enige kopie van een overgeslagen document wissen zou het bewijs met de data
                // weggooien (zelfde afweging als de parse-fout hierboven in de detectiefase).
                //
                // Prijs daarvan: de dialoog komt bij de volgende start opnieuw met dezelfde set, en
                // de melding hierboven dus ook. Dat is bewust geaccepteerd en géén doodlopende weg —
                // "Verwerpen" in de dialoog blijft de uitweg, en die keuze hoort bij de gebruiker
                // en niet bij een stille `clearRecovery()`. Het is ook geen regressie: vóór deze fix
                // gooide `restoreDocuments` op zo'n snapshot, kwam `clearRecovery()` net zo min aan
                // bod en herstelde bovendien géén enkel document. De herstelde documenten zelf zijn
                // hierna gewoon open, dus de eerstvolgende auto-save-ronde schrijft hún snapshots
                // vers weg; de overgeslagen snapshot blijft ernaast bestaan via de carry-over in
                // `planRecoveryCleanup` (een manifest van een vorige sessie is `foreign`).
                if (skipped.length === 0) await clearRecovery();
              } catch (err) {
                // Snapshots blijven staan. `finish()` gaat bewust wél door: de auto-save-poort
                // dichthouden zou betekenen dat vanaf nu NIETS meer wordt weggeschreven — een
                // groter risico dan het verlies van deze ene snapshotgeneratie. De fout is nu
                // ook gebruikerszichtbaar via het meldingenkanaal (K8b); de debug-terminal houdt
                // via appLog de volledige stack bij.
                console.error('Recovery: herstellen mislukt — snapshots blijven staan:', err);
                useAppStore.getState().notify({
                  severity: 'error',
                  messageKey: 'notifications.recoveryRestoreFailed',
                  detail: (err as Error).message,
                });
              } finally {
                setRecovery(null);
                finish();
              }
            })();
          },
          onDiscard: () => { void clearRecovery(); setRecovery(null); finish(); },
          // Uitstellen: snapshots laten staan, niet herstellen (zie RecoveryDialog).
          onClose: () => { setRecovery(null); finish(); },
        });
      } catch (err) {
        console.error('Recovery check failed:', err);
        finish();
      }
    })();
  }, []);

  return { recovery, recoveryResolved, autoSaveEnabled };
}
