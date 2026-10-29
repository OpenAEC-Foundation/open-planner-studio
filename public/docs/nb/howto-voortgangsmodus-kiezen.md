# Velge fremdriftsmodus

Mål: bestem hvordan appen planlegger gjenstående arbeid for en aktivitet som allerede er startet, mens forgjengeren fortsatt pågår: etter avhengigheten (Retained Logic) eller etter det som faktisk skjer (Progress Override).

## Når du trenger dette

På byggeplassen går arbeidet ofte foran logikken. Maleren starter allerede i rommene som er pusset, mens pusseren fortsatt er opptatt andre steder. I tidsplanen er det for eksempel en avhengighet av typen slutt-til-start, der etterfølgeren starter før forgjengeren er ferdig. Appen kaller det **fremdrift utenfor rekkefølge**. Hvis statuslinjen viser *N avhengighet(er) utenfor rekkefølge*, har du et slikt tilfelle. Da bestemmer fremdriftsmodusen hvordan appen planlegger gjenstående arbeid for etterfølgeren. Hva de to fremdriftsmodusene gjør, med et gjennomgått eksempel, står i [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang).

## Steg

1. Oppdater fremdriften og sett statusdatoen, slik det er beskrevet i [Oppdatere fremdrift](docs://howto-voortgang-bijwerken).
2. Gå til *Tidsplan › Grunnlinjer og fremdrift › Fremdriftsmodus* og åpne listen.
3. Velg *Retained Logic* eller *Progress Override*.
4. Trykk **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Valget gjør tidsplanen utdatert: statuslinjen viser *Utdatert — omberegn (F5)*. Hvis *Beregne automatisk* er på, gjør appen dette selv.

Hvordan velger du?

- **Retained Logic** er standard. Avhengigheten gjelder fortsatt: gjenstående arbeid for etterfølgeren starter først når forgjengeren er ferdig. Velg dette hvis rekkefølgen virkelig er fast, eller hvis du vil planlegge forsiktig.
- **Progress Override** lar virkeligheten avgjøre. Gjenstående arbeid for etterfølgeren starter på statusdatoen, uten å vente på forgjengeren. Velg dette hvis etterfølgeren virkelig fortsetter å arbeide, og sluttdatoen ikke skal avhenge av en forgjenger som fortsatt pågår.

## Kontrollere resultatet

- Klikk på meldingen *N avhengighet(er) utenfor rekkefølge* i statuslinjen. Panelet *Advarsler* åpnes. Du kommer dit også via *Tidsplan › Tidsplan › Advarsler*. Hver avhengighet står der med teksten *Utenfor rekkefølge: fremdriften til etterfølgeren strider mot avhengigheten*, for eksempel *4.2 Plastering → 4.5 Painting (FS)*.
- Se på stolpen til etterfølgeren. Under Retained Logic varer den til etter at forgjengeren er ferdig. Under Progress Override blir den ferdig tidligere. I eksempelet i forklaringen gjelder det tirsdag 27. juli mot torsdag 22. juli.

## Fallgruver og hva appen gjør

**Ingen forskjell.** Fremdriftsmodusen har bare effekt på aktiviteter som allerede er startet, mens forgjengeren ennå ikke er ferdig. Uten en slik aktivitet endres ingenting.

**Meldingen blir stående.** Progress Override løser ikke meldingen om fremdrift utenfor rekkefølge. Fremdriftsmodusen bestemmer hvordan appen beregner. Motsigelsen mellom avhengighet og fremdrift blir stående. Hvis avhengigheten ikke lenger er riktig, endre den ([Legge til avhengigheter](docs://howto-relaties-leggen)).

**Den hører til prosjektet.** Valget lagres i prosjektfilen, gjelder for hele prosjektet og kan angres med Ctrl+Z. Et nytt prosjekt bruker Retained Logic.

**En P6-fil.** Hvis du åpner en Primavera P6-fil (.xer), henter appen fremdriftsmodusen fra filen. I tillegg til Retained Logic og Progress Override har P6 også Actual Dates. Appen kjenner ikke den tredje modusen. En slik fil beregnes derfor som Retained Logic. Importmeldingen teller dette som *1 P6-planleggingsinnstilling brukte en trygg reserveløsning.*

**Beregningsprofilen.** I profilen Primavera P6 virker Progress Override også bakover, i de seneste datoene og i den frie slakken til forgjengeren (beregningsregel *Progress Override ignorerer en startet etterfølger også bakover*). I profilene Open Planner Studio og Microsoft Project gjelder dette ikke. Du finner beregningsreglene under *Innstillinger › Prosjekt › Prosjektinnstillinger*, i delen *Beregningsprofil og beregningsalternativer*. I eksempelet i forklaringen ser du ikke denne effekten bakover.

## Se også

- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): forskjellen mellom de to fremdriftsmodusene, med tall.
- [Oppdatere fremdrift](docs://howto-voortgang-bijwerken): registrere fremdriften som fremdriftsmodusen virker på.
- [Legge til avhengigheter](docs://howto-relaties-leggen): endre en avhengighet som ikke lenger er riktig.
