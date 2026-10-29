# Tilordne ressurser med en kurve

Mål: sett en ressurs på en aktivitet, med tildelingsenheter per dag og en kurve som bestemmer hvordan tildelingsenhetene fordeles over dagene i aktiviteten.

## Når du trenger dette

Så snart du vil se hvem som jobber hvor og når: murer på ytterskallen, kranen på hulldekkeelementene. Uten tilordning finnes ingen belastning, og derfor heller ingen histogram eller overallokering.

To begreper. **Tildelingsenhetene** (kolonnen *Tildelingsenheter* i panelet og feltet *Enh./dag* i vinduet *Tilordne*) er hvor mye av ressursen som jobber på aktiviteten per arbeidsdag: 1 er én murer, 2 er to av dem, 0,5 er en halv dag. Kurven bestemmer hvordan totalen, tildelingsenheter ganger varighet, fordeles over aktivitetens arbeidsdager. Arbeid er sjelden jevnt fordelt: på en vegg er starten rolig, midten travel og slutten rolig igjen.

Ytterskallen tar 6 arbeidsdager. Med én murer og kurven *Jevn* blir det 1 tildelingsenhet på hver av de 6 dagene, til sammen 6. Med kurven *Klokkeformet* er det fortsatt 6 tildelingsenheter til sammen, men fordelingen blir 0, 1, 2, 2, 1 og 0.

## Fremgangsmåte

Du kan tilordne en ressurs på to måter. Ressursen må finnes allerede (se [Administrere ressurser](docs://howto-resources-beheren)).

### Via båndet

1. Velg én aktivitet i aktivitetstabellen. Den må være en vanlig aktivitet, ikke en milepæl og ikke en fase.
2. Velg *Ressurser › Tilordning › Tilordne ▾*.
3. Fyll inn *Enh./dag* (standard 1) i vinduet, og velg *Kurve* (standard *Jevn*). De gjelder for ressursen du velger nå.
4. Klikk på ressursen. Vinduet lukkes, og tilordningen er der.

For en andre ressurs åpner du vinduet igjen. Ressurser som allerede er på aktiviteten, mangler i listen.

### Via egenskapspanelet

1. Velg aktiviteten. Panelet *Egenskaper* er til høyre. Hvis du ikke ser det, slår du det på med *Visning › Paneler › Egenskaper*.
2. I blokken *Tilordninger*, helt nederst, velger du ressursen ved *Tildel ressurs*. Tilordningen starter med tildelingsenheter på 1 og kurven *Jevn*.
3. For hver tilordning endrer du *Tildelingsenheter*. Klikk på navnet på ressursen for å vise *Kurve*, og velg en annen kurve der.

Slik endrer du også en eksisterende tilordning. Med søppelbøtten (*Fjern*) på slutten av linjen fjerner du tilordningen fra aktiviteten. Ressursen selv blir værende. Med *Flytt til…* (vises etter et klikk på navnet) flytter du tilordningen til en annen aktivitet.

### Kurvene

- *Jevn*: lik hver dag. Dette er standard, og passer til arbeid som er like tungt hver dag.
- *Tidlig belastet*: starten er tyngre enn slutten. Passer til arbeid som starter tungt, for eksempel utsetting.
- *Sent belastet*: slutten er tyngre enn starten. Passer til arbeid som blir travlere mot slutten.
- *Klokkeformet*: en topp i midten, med en rolig start og slutt. Passer til en vegg som starter rolig, er i full gang i midten og avtar.
- *Tidlig topp*: en topp før midten. Passer til arbeid som kommer raskt i gang.
- *Sen topp*: en topp etter midten. Passer til arbeid der den travle perioden først kommer sent.
- *Dobbel topp*: to topper. Passer til arbeid med to travle øyeblikk.
- *Skilpadde*: en rolig start og slutt, med en bred topp i midten. Passer til langt arbeid som bygger seg opp og avtar gradvis.

Kurven endrer bare fordelingen. Varigheten, datoene og totalen blir de samme. Du trenger ikke å omberegne etterpå. Histogrammet tilpasses med en gang. Velg *Ressurser › Histogram › Histogram* for å se det. Hvis du velger en aktivitet, viser histogrammet bare belastningen for den aktiviteten.

## Fallgruver og hva appen gjør da

**En kurve kan gi en topp som er høyere enn tildelingsenhetene dine.** Med et heltall som tildelingsenheter runder appen verdien per dag av til hele tildelingsenheter, og totalen blir den samme. En murer med tildelingsenheter på 1 på ytterskallen og kurven *Klokkeformet* gir 0, 1, 2, 2, 1, 0. På de to midtdagene er det 2 tildelingsenheter mot *Maksimalt antall* på 1. Histogrammet farger disse dagene røde, og ressursen får en overallokering. Velg en annen kurve, eller fordel timene selv (se [Justere timefordelingen](docs://howto-urenverdeling-aanpassen)). Med tildelingsenheter som 0,5 runder appen av til hundredeler. På en kort aktivitet med hele tildelingsenheter blir fasongen derfor grov: over 10 dager gir *Skilpadde* med tildelingsenheter på 1 fordelingen 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, akkurat lik *Tidlig topp*.

**Ingen milepæl eller fase.** Knappen *Tilordne* er da utilgjengelig, og *Egenskaper* sier *Tilordninger kan ikke settes på milepæler.* eller *Tilordninger kan ikke settes på hovedaktiviteter.*

**Én ressurs bare én gang per aktivitet.** Er ressursen allerede på aktiviteten, står den ikke lenger i listen. Er alle ressursene allerede på aktiviteten, sier appen *Alle ressurser er allerede tildelt.* Finnes det ennå ingen ressurs, sier den *Opprett ressurser først (fanen Ressurser).*

**Tildelingsenhetene må være større enn 0.** Appen tar ikke imot en verdi på 0 eller lavere.

**Materiale.** For en materialressurs er tildelingsenhetene mengden per dag, i ressursens enhet, for eksempel m³. Materiale teller ikke mot varigheten til aktiviteten.

**En aktivitetstype kan justere varigheten.** Står aktiviteten på *Fast arbeid* eller *Faste enheter*, endrer en andre ressurs varigheten til aktiviteten. Tidsplanen er da ikke lenger oppdatert; trykk **Beregn** (F5). Se [Aktivitetstyper: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels).

**En egen fordeling.** Har tilordningen allerede en egen timefordeling, er kurven deaktivert og viser *Kontur*. Slipp den fordelingen først via *Rediger timefordeling…*.

**Angre.** Du kan angre oppretting, endring eller fjerning av en tilordning med *Angre* (Ctrl+Z).

## Se også

- [Justere timefordelingen](docs://howto-urenverdeling-aanpassen): sette timene per dag selv.
- [Løse overallokering](docs://howto-overbezetting-oplossen): hva du gjør når én ressurs har for mye å gjøre på en dag.
- [Aktivitetstyper: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels): hva som skjer med varigheten når du endrer tildelingsenhetene.
- [Ressurspanel](docs://ref-resourcepaneel): alle felt og knapper i ressurspanelet.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): alle fem ressurstyper, seks av de åtte kurvene og et tårnkran med et kapasitetssteg fra 30. august 2027.
