# Een lopende MS Project-taak hervat op haar opgeslagen hervattingsmoment

MS Project slaat het hervattingsmoment van een lopende taak letterlijk op (veld 99, `TaskField.RESUME`, gelezen naar
`task.time.resume`). Hervattingsmoment en restwerk zijn in de data van MS Project onafhankelijke feiten; de
afgeleide verstreken duur (totaal min rest) kan ze niet allebei reproduceren. Gemeten: de finish als hervatting plus
restwerk op de eigen kalender is 17 van 17 exact op alle bladtaken die buiten volgorde lopen, en 4 van 4 op de
minuut op de OzBuild-momentopnamen. Is `resume` er, dan begint het restwerk daar, buiten Progress Override.

## Gevolgen

- Alleen bij hoogstens één toewijzing. Bij meerdere gelijktijdige toewijzingen wandelt elke toewijzing haar eigen
  werk, en is het taakbrede paar van rest en resume geen rechte kalenderwandeling: "Task One" in
  `mpp14assignmentfields.mpp` (twee toewijzingen) wijkt via resume ongeveer 4,5 uur af, met Retained Logic exact.
- Een taak uit P6 gebruikt `resume` alleen na de gevalideerde suspend/resume (`hasValidP6SuspendResume`); de
  aanwezigheid van het veld alleen maakt een XER-taak geen MS Project-taak.
- Zonder resume begint het restwerk op het laatste van de statusdatum (of zonder statusdatum de werkelijke start)
  en de druk van de voorgangers. A22 (`resumeFromActualElapsed`, MS Project) voegt daar een derde ondergrens aan
  toe: werkelijke start plus de al verstreken duur, met dezelfde loper als het restwerk. Bewijs: in OzBuild
  "Create Technical Specification" (20 % van 5 d, start vr 08:00) geeft dat ma 08:00 plus 4 werkdagen precies de
  opgeslagen finish; de statusdatum alleen geeft te vroeg. Onder P6 Retained Logic geldt die derde grens niet
  (`cases-progress.json`, scenario A/B/C); daarom is het een conventie.
- A22 geldt alleen als er restwerk is. Bij rest 0 (inconsistente brondata) blijft het hervattingspunt het gewone
  maximum, anders komt de finish een blokgat voorbij de natuurlijke finish
  (`prog-T9-remaining-nul-hervattingspunt-onaangeroerd`).
- Het hervattingspunt van A22 in werktijd snapt naar het volgende werkmoment (een blokeinde wordt het volgende
  blokbegin); in kalendertijd telt het in klokminuten zonder snap.
- A23 (`unstartedIgnoresStatusDate`): MS Project verschuift een niet-gestarte taak niet vanzelf naar de statusdatum.
  In `calendar-exception-precedence.mpp` is de berekening zonder die vloer op de minuut exact en met de vloer
  ongeveer acht jaar af. P6 Retained Logic houdt de vloer (restwerk nooit in het verleden).
