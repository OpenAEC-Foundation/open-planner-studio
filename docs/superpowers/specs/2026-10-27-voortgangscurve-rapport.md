# Rapporttype Voortgangscurve (issue #689)

Status: gebouwd in de PR die issue #689 sluit. Besluit van Ethan, 27 oktober 2026: het overzicht komt
onder Rapport, als rapporttype, niet als los dashboard.

## Wat de gebruiker ziet

Rapport → Rapporttype *Voortgangscurve*. Het rapport heeft drie blokken:

1. **Vier kerncijfers.**
   - *Gereed*: de werkelijke voortgang in %, met daaronder de geplande voortgang op de statusdatum.
   - *Te laat*: het aantal open taken dat te laat is, met daaronder hoeveel daarvan kritiek zijn.
   - *Negatieve speling*: het aantal open taken met totale speling onder nul, met daaronder de
     grootste (meest negatieve) speling in werkdagen.
   - *Volgende mijlpaal*: de naam van de eerste open mijlpaal, met daaronder de datum en over hoeveel
     kalenderdagen (of hoeveel dagen geleden, als hij al voorbij is).
2. **De S-curve**: cumulatieve voortgang (0–100 %) over de tijd.
   - Geplande curve uit de actieve baseline (gestippeld).
   - Werkelijke curve tot de statusdatum (doorgetrokken).
   - Een band tussen de curve op vroegste data en de curve op laatste data: de "doelvoortgang hoog
     en laag" uit het issue.
   - Een verticale lijn op de statusdatum.
3. **Een tabel met risicotaken**: open taken die te laat zijn of negatieve speling hebben, gesorteerd
   op speling (laagste eerst).

Preview en PDF-export lopen zoals bij de andere tabelrapporten (`TableReportSpec` →
`TableReportView` en `makeSectionedRenderReport`). De ligging van de grafiek (assen, lijnen, band)
komt uit één pure functie (`layoutCurveChart`); het scherm tekent die als SVG in de themakleuren, de
PDF tekent hem via `Draw2D` op wit papier.

## Waar de gegevens vandaan komen

Alles is alleen-lezen: het rapport rekent niets opnieuw door, het leest wat de laatste berekening
(F5) op de taken zette. De rekenmotor verandert niet.

| gegeven | bron |
|---|---|
| taken | bladtaken zonder hammocks (`activityTasks`), net als de andere rapporten |
| gewicht van een taak | duur in werkdagen op de eigen kalender (`durationDays`); mijlpalen wegen 0 |
| statusdatum | `project.statusDate`; ontbreekt die, dan vandaag (`referenceDay`) |
| baseline | de actieve baseline (`ctx.baseline`), per taak `start`/`finish` |
| vroegste data | de getoonde data (`shownStart`/`shownFinish`): werkelijke data waar die er zijn, anders de berekende vroegste data |
| laatste data | `time.lateStart`/`time.lateFinish`; een gestarte taak begint op haar werkelijke start, een voltooide taak gebruikt haar werkelijke data |
| voortgang | `time.completion`, met `actualStart`/`actualFinish` |
| speling, kritiek | `time.totalFloat`, `time.isCritical` |

**Een curve.** Op een dag *d* telt elke taak mee met gewicht × het deel van haar venster dat op *d*
verstreken is. Dat deel is werkdagen(start, *d*) ÷ werkdagen(start, einde) op de kalender van de taak.
Beide grenzen tellen mee (zoals `workDaysBetween`), dus de waarde op een dag is de stand aan het
einde van die dag. Dat is dezelfde telling als de geplande voortgang in het voortgangsrapport.

Elk punt van de curve meet in de dagenmaat van de taakkalender: elke werkdag telt 1 en een taak mag midden
op de dag starten of eindigen. Een taak van maandag 12:00 tot woensdag 12:00 staat aan het einde van maandag
dus op 25 %. Een taak die hele dagen loopt, komt op de telling hierboven uit. Alle punten gebruiken dezelfde
fractie (`elapsedWorkFraction`), dus een curve daalt niet.

Een statusdatum mét tijd op een uur-projectkalender is een moment. Dat is een eigen meetpunt, naast het
einde van die dag: een taak van 08:00 tot 16:00 staat om 12:00 op 50 %, en de curve loopt op die dag door
tot 100 %. *Gepland* en de curves lezen hetzelfde moment, en de geplande voortgang van het voortgangsrapport
ook. Op een dag-projectkalender heeft de tijd geen betekenis, net als in de motor; daar telt de dag als geheel.

**De werkelijke curve** is een benadering. De app bewaart geen voortgang per week, alleen de stand van
nu. Per taak loopt de voortgang daarom lineair (in werkdagen) van de werkelijke start naar de huidige
voltooiing: tot het werkelijke einde bij een voltooide taak, tot de statusdatum bij een lopende taak.
Op de statusdatum is de curve precies de gewogen voortgang van nu. Het rapport zegt dit in een regel
onder de grafiek.

**Gepland % op de statusdatum** is de waarde van de geplande curve op die dag. Zonder baseline is het de
curve op vroegste data, met "(huidige planning)" erbij, zoals in het voortgangsrapport. Voor een taak op een dagkalender
deelt het voortgangsrapport het verstreken deel door de huidige duur; dit rapport door het eigen venster
van de baseline. Bij een baseline met andere duren dan nu kan het getal dus iets verschillen. Dat is
bewust: het getal moet gelijk zijn aan het punt in de grafiek. Voor een taak op een uur-kalender, en bij een
statusmoment met tijd, gebruiken beide rapporten dezelfde fractie. De kalender is die van de taak zelf
(`workTime`); `eng.isHourMode` zegt dat niet, want de motor geeft ook een dagkalender werkblokken.

**Te laat** is een open taak die
- volgens de planning al had moeten eindigen of starten (`scheduleSlip`, dezelfde regel als het
  voortgangsrapport), of
- met een actieve baseline: een prognose-einde na het baseline-einde heeft (op dagniveau).

**De as** loopt van de vroegste start (vroeg, laat, baseline, werkelijk) tot een dag na het laatste
einde, en altijd ook over de statusdatum. Er zijn hoogstens ongeveer 240 meetpunten; bij een lang
project ligt er dus meer dan één dag tussen de punten.

## Wat er gebeurt als iets ontbreekt

| ontbreekt | gevolg |
|---|---|
| baseline | geen geplande curve; *Gepland* komt uit de curve op vroegste data, met "(huidige planning)"; *Te laat* telt alleen de taken die volgens de planning al voorbij zijn. Melding boven het rapport. |
| statusdatum | het rapport rekent met vandaag en meldt dat (dezelfde melding als de andere rapporten). |
| voortgang | de werkelijke curve ligt op 0 %; melding "nog geen voortgang ingevoerd". |
| berekening (geen F5 of fout) | melding "niet berekend" (zoals de andere rapporten); de band op laatste data valt weg, want laatste data zijn er dan niet betrouwbaar. |
| planning verouderd | melding "verouderd" (zoals de andere rapporten); de curves tonen de laatste berekening. |
| taken met duur | geen curve; de grafiek toont "geen taken met duur". De kerncijfers blijven staan. |
| open mijlpaal | *Volgende mijlpaal* toont "—" en "geen open mijlpaal". |

## Niet in deze stap

- Geen voortgangshistorie per periode (dat zou nieuwe projectdata zijn, met IFC-round-trip).
- Geen curve op kosten of uren; alleen op duur.
- Geen opties in het rapportpaneel behalve papier en oriëntatie.
