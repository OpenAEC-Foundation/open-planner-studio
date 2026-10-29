# Justere timefordelingen

Mål: for én tilordning bestemmer du selv hvor mye ressursen jobber på hver arbeidsdag i aktiviteten, i stedet for å bruke en standardkurve.

## Når du trenger dette

En kurve som *Klokkeformet* har en fast form. Noen ganger vet du det bedre selv. Murer starter på den ytre skallmuren med halv styrke, fordi stillaset fortsatt settes opp, og jobber deretter heltid. Eller du vil holde en topp like under kapasiteten. Da justerer du **timefordelingen**.

Du jobber med **faser**: sammenhengende arbeidsdager der ressursen jobber med de samme tildelingsenhetene. Fordelingen endrer bare timene per dag for denne ene tilordningen. Datoene for aktiviteten endres ikke.

## Trinn

Eksemplet er outer cavity leaf: 6 arbeidsdager, én bricklayer, 48 timer.

1. Velg aktiviteten. Panelet *Egenskaper* står til høyre. Ser du det ikke, slå det på med *Visning › Paneler › Egenskaper*.
2. I blokken *Tilordninger* klikker du på navnet til bricklayer. Under det vises *Kurve* og knappen *Rediger timefordeling…*. Klikk på *Rediger timefordeling…*. Vinduet *Timefordeling i faser* åpnes. Du begynner med det appen booker nå: for outer cavity leaf én fase på 6 dager med tildelingsenheter på 1.
3. Velg om nødvendig et startpunkt ved *Bruk form:*. Med *Klokkeformet* lager appen fem faser: 0,18 tildelingsenheter på den første og den siste dagen, 0,84 på den andre og den femte dagen og 1,98 på de to midterste dagene. Totalen forblir 48 timer.

### Justere fasene

Du kan arbeide i tabellen eller i stripen over den.

- Skriv andre *Tildelingsenheter (enh./dag)* i en fase. Kolonnene *Timer/dag* og *Timer* beregnes samtidig.
- Endre antallet *Dager* i en fase. Den siste fasen går alltid til slutten av aktiviteten og får de dagene som er igjen.
- Velg *Del* for å dele en fase i to, for 6 dager i 3 og 3. Velg *Slå sammen* for å slå sammen en fase med den neste.
- I stripen drar du en grense for å forlenge eller forkorte en fase, drar den øverste kanten for å sette tildelingsenhetene og dobbeltklikker en dag for å dele en fase.

### Bruke

Velg *Bruk*. Med *Avbryt* lukkes vinduet uten endring.

Et eksempel. Du velger *Del*, setter *Dager* i den første fasen til 2 og tildelingsenhetene i den fasen til 0,5. Den andre fasen går deretter 4 dager med 1 tildelingsenhet. Totalen er 2 × 0,5 × 8 + 4 × 1 × 8 = 40 timer.

Etter *Bruk* settes kurven for tilordningen til *Kontur*, som er deaktivert. *Tildelingsenheter* forblir som de var. Et stolpediagram-ikon vises nå ved siden av navnet, også når raden er klappet sammen. Histogrammet og overallokeringen følger den nye fordelingen med én gang. Det er ikke nødvendig å omberegne, fordi ingen dato flytter seg.

### Slipp fordelingen

Har tilordningen en egen fordeling, har vinduet også *Slipp fordelingen*. Da fjerner du din egen fordeling, og appen settes til *Tildelingsenheter* og kurven. Velg dette også hvis du vil endre kurven, fordi nedtrekkslisten *Kurve* er deaktivert så lenge det finnes en egen fordeling.

## Fallgruver og hva appen gjør da

**Totalen endrer seg med det.** Du deler ikke timene, du bestemmer dem. Hvis du setter en fase til 0,5 i stedet for 0,18, blir totalen større. Totalen i timer står nederst i vinduet, så kontroller den før du klikker på *Bruk*.

**Hva tildelingsenhetene gjør etterpå, avhenger av aktivitetstypen.** Med *Fast varighet og faste tildelingsenheter* endrer en annen verdi for *Tildelingsenheter* ingenting i fordelingen. Med *Fast varighet og fast arbeid* skalerer appen timene per dag sammen med de nye tildelingsenhetene: med 2 tildelingsenheter i stedet for 1 dobles hver dag, og det gjør totalen også (fra 32 til 64 timer), mens varigheten forblir den samme. Med *Fast arbeid* endrer tildelingsenhetene varigheten til aktiviteten: fordelingen presses sammen eller strekkes ut over den nye varigheten, med samme total. Med *Faste enheter* endrer tildelingsenhetene også varigheten; kontroller totalen nederst i vinduet etterpå.

**Hvis du endrer varigheten på aktiviteten, strekkes fordelingen med.** Formen forblir den samme. Med *Fast varighet og faste tildelingsenheter* og med *Faste enheter* vokser totalen i samme forhold som varigheten: hvis varigheten på en aktivitet med en egen fordeling dobles fra 4 til 8 arbeidsdager, dobles totalen også, fra 32 til 64 timer. Med *Fast varighet og fast arbeid* og med *Fast arbeid* forblir totalen den samme (32 timer forblir 32 timer), og tildelingsenhetene går ned.

**Arbeidet følger fordelingen.** *Arbeid (t)* blir summen av fasene dine, også under *Fast arbeid*. Varigheten til aktiviteten endrer seg ikke på grunn av det.

**Ugyldige tildelingsenheter.** En tom eller negativ verdi for tildelingsenheter får en rød kant, og *Bruk* er da deaktivert. En fase med 0 tildelingsenheter er tillatt. En slik fase holder seg innenfor varigheten til aktiviteten.

**Alt gjelder bare for denne ene tilordningen.** Appen sier det selv: *Fordelingen endrer bare timene per dag for denne tilordningen; datoene og delingene for aktiviteten forblir som de er.* Andre ressurser på samme aktivitet beholder sin egen fordeling.

**Utjevning følger fordelingen.** Utjevningen teller de samme timene per dag som histogrammet.

**Angre.** *Bruk* og *Slipp fordelingen* er hvert ett steg for *Angre* (Ctrl+Z).

## Se også

- [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen): sette en ressurs på en aktivitet og velge en kurve.
- [Løse overallokering](docs://howto-overbezetting-oplossen): hva du gjør når en ressurs har for mye å gjøre på én dag.
