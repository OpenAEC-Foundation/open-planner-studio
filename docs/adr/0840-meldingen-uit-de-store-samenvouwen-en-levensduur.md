# Meldingen uit de store: weigeringen, samenvouwen en eenmalig per document

Een weigering (de app voerde een handeling niet of niet helemaal uit) is rood en blijft staan tot het kruisje, ook als
een deel lukte: een blauwe info verdwijnt na 5 s en is zo te missen (eigenaarsbesluiten 2026-10-17 en 2026-10-19).
Ze gaat weg bij een documentwissel (ADR 0472) en na elke undo- of redo-stap, omdat ze dan niet meer klopt met wat de
planner ziet; een echte fout blijft. Elke weigering komt uit `refusalNotice` en draagt de vlag `refusal`, zodat bij
een volle stapel eerst een weigering wegvalt en herhaalde weigeringen een echte fout niet wegduwen. `clearRefusals`
draait binnen de `set` van de wissel of het herstel, vóór er iets nieuws gemeld wordt; een weigering die de wissel of
de undo zelf oplevert, blijft dus staan.

## Gevolgen

- Samenvouwen (`dedupeKey`) vervangt de parameters van de oude melding en telt een teller op. Een melding met een
  aantal krijgt daarom geen vaste sleutel (`taskTypesNotice.ts`) of een sleutel per exacte set taken
  (`refusedSetKey`): anders leest "3 taken" na een tweede bewerking als "2 taken ×2".
- Een melding die eenmaal per document per sessie mag komen (`timephasedLossNotice.ts`, `taskTypesNotice.ts`) houdt
  dat bij in modulestaat en niet met `dedupeKey`: samenvouwen werkt alleen zolang de eerdere melding nog in de lijst
  staat, en een info verdwijnt na 5 s. Die registratie staat niet in `DOCUMENT_FIELDS`, zodat ze een documentwissel
  heen en terug overleeft. Alleen `newProject` en `createNewProject`, die het actieve document-id hergebruiken voor een
  vers document, wissen haar voor dat id; heropenen in hetzelfde tabblad niet.
- De melding over de uren van andere resources (`otherWorkNotice.ts`, #954) verdwijnt definitief zodra het document de
  stand van haar stap verlaat (`watchNotice`); ook Ctrl+Z van later werk brengt haar niet terug. Zo kloppen haar
  cijfers zolang ze er staat en zet haar knop alleen haar eigen stap terug.
