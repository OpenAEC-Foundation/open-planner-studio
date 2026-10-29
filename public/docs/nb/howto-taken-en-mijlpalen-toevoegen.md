# Legge til aktiviteter og milepæler

Mål: sett en ny aktivitet eller milepæl inn i tidsplanen, på riktig sted.

## Når du har bruk for dette

Du bygger en tidsplan, nytt arbeid legges til, eller du vil registrere et tidspunkt, for eksempel overlevering eller en inspeksjon.

En **aktivitet** er arbeid som tar tid. En ny aktivitet varer 5 arbeidsdager som standard (med timeplanlegging kan standarden for prosjektet være timer). En **milepæl** er et tidspunkt uten varighet: 0 dager. En aktivitet med delaktiviteter kalles en **hovedaktivitet**; i bygg er det ofte en fase. Varigheten og datoene følger av delaktivitetene så snart du bruker **Beregn** (F5).

## Steg

### Legge til en aktivitet

1. Velg *Hjem › Aktiviteter › Aktivitet*. Den samme knappen finnes på fanen *Tabell*.
2. Panelet *Egenskaper* åpnes, og feltet *Navn* er valgt. Skriv navnet og trykk Enter.

Den nye aktiviteten heter først *Ny aktivitet* og starter ved prosjektstarten.

Hvis en aktivitet er valgt, plasseres den nye aktiviteten rett under den, på samme nivå. Hvis den valgte aktiviteten er en hovedaktivitet, plasseres den nye aktiviteten under hele fasen, altså etter delaktivitetene. Hvis ingenting er valgt, plasseres den nederst i listen. Verktøytipset for knappen viser hvilket av de to som skjer: *Ny aktivitet rett under valget* eller *Ny aktivitet nederst i listen*. Hvis du velger flere aktiviteter, lages én ny aktivitet under den nederste av valget, slik du ser det på skjermen.

### Raskt etter hverandre i aktivitetstabellen

Under den siste aktiviteten i aktivitetstabellen finnes alltid en grå rad *Ny aktivitet*. Det er ennå ikke en aktivitet: den finnes ikke i Gantt-diagrammet, og den finnes ikke i filen.

1. Klikk i en celle på den grå raden, eller gå dit med pil ned.
2. Skriv navnet og trykk Enter. Nå er det en ekte aktivitet, på samme nivå som aktiviteten over. Markøren står med én gang på den nye grå raden under.
3. Skriv neste navn, og så videre.

Hvis du bare fyller inn en varighet eller en dato på den grå raden, heter aktiviteten *Ny aktivitet*. Hvis du går uten å fylle inn noe, skjer ingenting: ingen aktivitet og ingen steg i *Angre*. Det å opprette aktiviteten og den første verdien er ett steg i *Angre*. Den grå raden finnes bare når aktivitetstabellen ikke er filtrert, gruppert eller sortert.

### Med høyre museknapp på et tomt område

Høyreklikk på tomt område: i aktivitetstabellen under den siste aktiviteten, eller i Gantt-diagrammet ved siden av eller under stolpene. Velg *Opprett aktivitet* eller *Legg til milepæl*. Aktiviteten plasseres nederst i listen. I Gantt-diagrammet starter den på datoen der du klikket. I aktivitetstabellen åpnes navnecellen med én gang, slik at du kan skrive.

### Over eller under en bestemt aktivitet

Høyreklikk aktiviteten og velg *Sett inn over* eller *Sett inn under*. Tastaturet fungerer også: Insert legger til over den valgte aktiviteten, Ctrl+I (⌘+I på Mac) under den. I aktivitetstabellen åpnes navnecellen med én gang etter Insert, klar for skriving.

Når flere aktiviteter er valgt, lages én ny aktivitet: *Sett inn over* plasserer den over den øverste valgte aktiviteten, *Sett inn under* under den nederste.

### Legge til en delaktivitet

Høyreklikk aktiviteten og velg *Legg til delaktivitet*. Den nye aktiviteten plasseres nederst blant delaktivitetene til den aktiviteten. I aktivitetstabellen ved siden av Gantt-diagrammet har også en hovedaktivitet et lite **+** etter navnet sitt, som gjør det samme.

### Legge til en milepæl

1. Velg *Hjem › Aktiviteter › Milepæl ▾* og deretter *Startmilepæl*, *Sluttmilepæl* eller *Inspeksjonsmoment (påkrevd)*.
2. Skriv navnet og trykk Enter. Plasseringen følger samme regel som for *Aktivitet*.

De tre typene skiller seg slik fra hverandre:

- En *Startmilepæl* hører til ved begynnelsen av dagen, en *Sluttmilepæl* ved slutten av dagen. I Gantt-diagrammet står diamanten til venstre eller høyre for dagkolonnen. Det har også betydning for etterfølgeren. Si at en milepæl er tirsdag 29. september 2026, og at en aktivitet følger etter med en avhengighet av typen slutt-til-start: etter en startmilepæl starter aktiviteten samme tirsdag, etter en sluttmilepæl onsdag 30. september.
- Et *Inspeksjonsmoment (påkrevd)* er en sluttmilepæl med arbeidskategorien *Kontroll/inspeksjon* og haken *Obligatorisk (kontraktuelt)*.

### Gjøre en eksisterende aktivitet til en milepæl

Høyreklikk aktiviteten og velg *Slå milepæl av/på*, eller sett haken i *Milepæl* i panelet *Egenskaper*. Menyvalget gjelder for hele valget. Varigheten blir 0.

Hvis du slår den av igjen, forblir den en vanlig aktivitet med varighet 0: skriv inn varigheten selv.

### Andre måter

- Ctrl+M (⌘+M på Mac) legger en ny milepæl nederst i listen, selv om en aktivitet er valgt. Panelet *Egenskaper* åpnes ikke.
- En milepæl du lager med Ctrl+M eller via høyreklikkmenyen, får arbeidskategorien *Kontroll/inspeksjon*. En *Startmilepæl* eller *Sluttmilepæl* fra *Milepæl ▾* får *Annet*. Endre arbeidskategorien i *Egenskaper* hvis du trenger det.
- *Legg til milepæl* i høyreklikkmenyen til en aktivitet gjør milepælen til en delaktivitet av den aktiviteten, ikke til en aktivitet på samme nivå.

### Kopiere en aktivitet eller en hel gren

1. Klikk stolpen til aktiviteten i Gantt-diagrammet. Velg flere aktiviteter med Ctrl+klikk.
2. Trykk Ctrl+C (⌘+C på Mac). Appen kopierer aktiviteten med alle delaktivitetene, avhengighetene mellom de kopierte aktivitetene og ressurstilordningene deres.
3. Klikk eventuelt stolpen til aktiviteten som kopien skal plasseres ved siden av, og trykk Ctrl+V (⌘+V).

Kopien har samme navn, samme datoer og samme fremdrift. Den plasseres som en aktivitet på samme nivå som den valgte aktiviteten (ved flere valgte aktiviteter: den du klikket først), nederst blant disse. Hvis ingenting er valgt, plasseres den nederst i listen. De kopierte aktivitetene er valgt etterpå. WBS-kodene (hver aktivitets nummer i treet, for eksempel 1.2; se [Justere strukturen](docs://howto-structuur-aanpassen)) fastsettes på nytt, og tidsplanen er ikke lenger oppdatert.

Utklippstavlen deles av hele appen, så du kan også lime inn i et annet dokument. Det som ikke finnes der, for eksempel en aktivitetskalender, en egendefinert arbeidskategori, en aktivitetskode eller et egendefinert felt, tømmer appen og gir deg beskjed.

### Etterpå

En ny aktivitet endrer ikke de andre datoene ennå. Statuslinjen sier *Utdatert — omberegn (F5)*. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*.

## Fallgruver og hva appen gjør

**Hver ny aktivitet starter ved prosjektstarten.** Uten avhengigheter venter ingen aktivitet på noe. Legg til avhengigheter, se [Legge til avhengigheter](docs://howto-relaties-leggen).

**Filtrering, gruppering eller sortering er på.** Rekkefølgen du ser, er da ikke rekkefølgen i tidsplanen. Når en aktivitet er valgt, legger *Aktivitet* og *Milepæl ▾* den nye aktiviteten nederst. En rød melding sier da *Den nye aktiviteten står bakerst. Mens du filtrerer, grupperer eller sorterer, kan appen ikke plassere den under utvalget ditt*. *Sett inn over* og *Sett inn under* avvises, med stripen *Ikke tilgjengelig under filtrering/gruppering/sortering*. Knappen *Tøm* i meldingen eller i stripen fjerner filtrering, gruppering og sortering i ett trekk. Dette er ikke en del av *Angre*: Ctrl+Z henter dem ikke tilbake.

**En delaktivitet under en aktivitet med tilordninger.** Aktiviteten blir en hovedaktivitet, og en hovedaktivitet har selv ingen tilordninger. Appen flytter tilordningene til den nye delaktiviteten og gir deg beskjed. Hvis det ikke er mulig, for eksempel fordi du valgte *Legg til milepæl* og en milepæl ikke kan ha tilordninger, legger appen ikke til noe og forklarer hvorfor.

**En delaktivitet under en milepæl.** Milepælen blir en hovedaktivitet, og appen fjerner milepælsmerket og viser en melding.

**Milepæl slått på for en hovedaktivitet eller en aktivitet med tilordninger.** Appen avviser det og forklarer hvorfor. Med tilordninger: fjern dem først.

**Kopiere i aktivitetstabellen.** I aktivitetstabellen (og på fanen *Tabell*) kopierer Ctrl+C bare verdiene i de valgte cellene, som i et regneark, og Ctrl+V limer inn i celler. Å kopiere aktiviteter fungerer derfor bare hvis du bruker Gantt-diagrammet: klikk først på en stolpe.

## Se også

- [Justere strukturen](docs://howto-structuur-aanpassen): rykke inn og flytte aktiviteter og holde WBS-nummer oppdatert.
- [Legge til avhengigheter](docs://howto-relaties-leggen): koble aktiviteter sammen.
- [Velge, slette og angre aktiviteter](docs://howto-taken-selecteren-verwijderen): fjerne en aktivitet igjen.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva appen beregner når det finnes avhengigheter.
- [Aktivitetsdialogen og egenskapspanelet](docs://ref-taak-eigenschappen): alle felt for en aktivitet.
- [Nytt prosjekt og Prosjektinfo](docs://ref-projectinfo): starte med en mal for faseinndeling.
- [Høyreklikkmenyer](docs://ref-contextmenus): alle punkter i menyen for en aktivitet.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): et lite eksempelprosjekt (*Fil › Eksempler*) med fire faser, en startmilepæl og en obligatorisk overleveringsmilepæl.
