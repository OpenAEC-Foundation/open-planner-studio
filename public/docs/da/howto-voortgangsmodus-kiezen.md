# Vælg fremdriftsmetode

Mål: afgør hvordan appen planlægger det resterende arbejde på en opgave, der allerede er startet, mens dens foregående opgave stadig kører: efter afhængigheden (Retained Logic) eller efter det, der faktisk sker (Progress Override).

## Hvornår du har brug for det

På byggepladsen løber arbejdet ofte foran logikken. Maleren går allerede i gang i de rum, der er blevet pudset, mens pudseren stadig er optaget et andet sted. I tidsplanen er det for eksempel en afhængighed af typen slut til start, hvor den efterfølgende opgave starter, før den foregående opgave er færdig. Appen kalder det **fremdrift uden for rækkefølge**. Ser du *N afhængighed(er) med fremdrift uden for rækkefølge* i statuslinjen, har du et sådant tilfælde. Fremdriftsmetoden bestemmer så, hvordan appen planlægger det resterende arbejde for den efterfølgende opgave. Hvad de to metoder gør, med et uddybet eksempel, står i [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang).

## Trin

1. Opdater fremdriften, og angiv statusdatoen, som beskrevet i [Opdatering af fremdrift](docs://howto-voortgang-bijwerken).
2. Gå til *Tidsplan › Oprindelige planer & fremdrift › Fremdriftstilstand*, og åbn listen.
3. Vælg *Retained Logic* eller *Progress Override*.
4. Tryk på **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Valget gør tidsplanen forældet: statuslinjen viser *Forældet — genberegn (F5)*. Hvis *Beregn automatisk* er slået til, gør appen det selv.

Hvordan vælger du?

- **Retained Logic** er standard. Afhængigheden forbliver gældende: det resterende arbejde for den efterfølgende opgave starter først, når den foregående opgave er færdig. Vælg dette, hvis rækkefølgen virkelig er fast, eller hvis du vil være forsigtig i tidsplanen.
- **Progress Override** lader virkeligheden vinde. Det resterende arbejde for den efterfølgende opgave starter på statusdatoen, uden at vente på den foregående opgave. Vælg dette, hvis den efterfølgende opgave virkelig fortsætter med at arbejde, og slutdatoen ikke skal afhænge af en foregående opgave, der stadig kører.

## Kontroller resultatet

- Klik på meddelelsen *N afhængighed(er) med fremdrift uden for rækkefølge* i statuslinjen. Panelet *Advarsler* åbner sig, også via *Tidsplan › Tidsplan › Advarsler*. Hver afhængighed står i det med teksten *Uden for rækkefølge: fremdriften i den efterfølgende opgave strider mod afhængigheden*, for eksempel *4.2 Plastering → 4.5 Painting (FS)*.
- Kig på bjælken for den efterfølgende opgave. Under Retained Logic bliver den ved, indtil efter slutdatoen for den foregående opgave. Under Progress Override slutter den tidligere. I eksemplet i forklaringen er det tirsdag den 27. juli mod torsdag den 22. juli.

## Faldgruber, og hvad appen gør

**Ingen forskel.** Fremdriftstilstanden har kun virkning på opgaver, der allerede er startet, mens deres foregående opgave endnu ikke er færdig. Uden en sådan opgave ændrer intet sig.

**Meddelelsen bliver.** Progress Override løser ikke meddelelsen om fremdrift uden for rækkefølge. Fremdriftstilstanden bestemmer, hvordan appen beregner. Uoverensstemmelsen mellem afhængighed og fremdrift består. Hvis afhængigheden ikke længere er rigtig, ændr den ([Tilføjelse af afhængigheder](docs://howto-relaties-leggen)).

**Den hører til projektet.** Valget gemmes i projektfilen, gælder for hele projektet, og du kan fortryde det med Ctrl+Z. Et nyt projekt bruger Retained Logic.

**En P6-fil.** Åbner du en Primavera P6-fil (.xer), tager appen fremdriftstilstanden fra filen. Ud over Retained Logic og Progress Override har P6 også Actual Dates. Appen kender ikke den tredje tilstand. En sådan fil beregnes som Retained Logic. Importmeddelelsen tæller det som *1 P6-planindstilling brugte en sikker reserve.*

**Beregningsprofilen.** I Primavera P6-beregningsprofilen virker Progress Override også baglæns, i de seneste datoer og i tilladt slæk for den foregående opgave (konvention *Progress Override ignorerer også en startet efterfølgende opgave baglæns*). I beregningsprofilerne Open Planner Studio og Microsoft Project gør den det ikke. Konventionerne finder du under *Indstillinger › Projekt › Projektindstillinger*, i blokken *Beregningsprofil og beregningsindstillinger*. I eksemplet i forklaringen kan den baglæns virkning ikke ses.

## Se også

- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): forskellen mellem de to metoder, med tal.
- [Opdatering af fremdrift](docs://howto-voortgang-bijwerken): at indtaste den fremdrift, som metoden arbejder med.
- [Tilføjelse af afhængigheder](docs://howto-relaties-leggen): ændring af en afhængighed, der ikke længere er rigtig.
