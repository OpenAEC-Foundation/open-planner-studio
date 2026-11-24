# Relatielijnen op papier: de betekenis van het scherm, een eenvoudiger route

`drawDependencies` (`printPreview.ts`) neemt de lijnstijl van het scherm (`GanttRenderer.drawDependencyArrows`) over, de
conventie die een planner uit P6 kent: doorgetrokken is bepalend, gestreept niet-bepalend, en rood als een bepalende
relatie twee kritieke taken verbindt en `showCritical` aan staat. Een afdruk zonder dat onderscheid verliest informatie
die op het scherm wel staat. Zonder `drivingSequenceIds` is er niet gerekend en tekent de afdruk elke relatie neutraal
doorgetrokken, ook niet rood (ADR 0230). Toets: `check-dependency-style.ts`, secties 1 tot en met 3.

## Gevolgen

- Drie afwijkingen van het scherm. De neutrale lijn is op papier lichter grijs (`PRINT_PALETTE.dependency` tegen het
  schermpalet in `themePalette.ts`). `showCritical` stuurt alleen de kleur van de lijnen en de legendaregel; de balken
  volgen de balkkleurkeuze (`computeBarColors`). Een rijenbron met `multiBand` zet de lijnen uit en het vinkje vast aan
  (`studioRowPrintFields`, regel `reports`). Het dimmen bij het volgen van een pad (trace) is interactieve toestand en
  staat niet op papier.
- De ankers liggen op de balkgrenzen van `taskBarSpan`, met de uitloop weg van de balk: bij SS en SF vertrekt de lijn
  links van de voorganger, bij FF en SF komt ze rechts bij de opvolger aan.
- Het scherm tekent zijn lijnen onder de balken en zoekt daarom een route om tussenliggende balken heen. De afdruk
  tekent ze erboven (ADR 0232) en kent die omweg niet. Ze heeft twee routes: vooruit met één verticale knik op
  `DEP_STUB` naast de voorganger, en terug via de rijgoot van de opvolger, zodat de lijn niet dwars door de opvolgerbalk
  loopt.
- Een relatie staat er alleen als voorganger en opvolger allebei een afgedrukte rij hebben.
- Het streepjespatroon schaalt met de rapportlettergrootte (`m.s`). Bij *Passend maken* op één paginabreedte hangt de
  schaal van de pagineerder niet van de lettergrootte af, want de tijdas krimpt zoveel als de tabel groeit; een vast
  patroon bleef dan even fijn terwijl rijhoogte en tekst groeien. Toets: `check-dependency-style.ts`, sectie 5.
- Na de lijnen zet `drawDependencies` het streepjespatroon terug, want de kop en de tabel die erna komen, tekenen met
  dezelfde `Draw2D` (sectie 6 van dezelfde toets). De pijlpunt is een vulling en dus altijd massief.
