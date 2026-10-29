# Justere strukturen

Mål: ordne aktiviteter i faser og delaktiviteter, endre rekkefølgen og holde WBS-nummerene riktige.

## Når du trenger dette

Tidsplanen din er et tre: faser (hovedaktiviteter) med delaktiviteter under seg, for eksempel *Foundation* med *Groundwork*, *Reinforcement* og *Pouring*. Du justerer treet når du vil legge aktiviteter under en fase, ta en aktivitet ut av en fase, eller når rekkefølgen er feil. **WBS-koden** (1, 1.1, 1.2, 2, …) er aktivitetens nummer i treet.

## Trinn

### Rykke inn en aktivitet

1. Velg aktiviteten. Det går bra å velge flere aktiviteter.
2. Velg *Tidsplan › Struktur › Rykk inn*. Du kan også bruke Alt+→ (eller Alt+Shift+→), eller *Rykk inn* i hurtigmenyen.

Aktiviteten blir den siste delaktiviteten til forrige aktivitet på samme nivå. Den forrige aktiviteten blir dermed en hovedaktivitet. Velger du et sammenhengende utvalg, rykkes utvalget inn som helhet. Har aktiviteten ingen forrige aktivitet på samme nivå, skjer ingenting, og det kommer ingen melding.

### Redusere innrykk for en aktivitet

Velg *Tidsplan › Struktur › Reduser innrykk*, trykk Alt+← (eller Alt+Shift+←), eller velg *Reduser innrykk* i hurtigmenyen.

Aktiviteten blir en aktivitet på samme nivå som fasen, rett etter fasen. Egne delaktiviteter følger med. Aktivitetene som kom etter den i fasen, blir i fasen. En aktivitet på øverste nivå får ikke mindre innrykk.

### Flytte en aktivitet

Du har tre måter.

- **Med tastaturet.** Alt+↑ og Alt+↓ bytter aktiviteten med naboen på samme nivå. En hovedaktivitet tar delaktivitetene sine med seg. Øverst eller nederst på nivået skjer ingenting. Når flere aktiviteter er valgt, flytter bare den aktiviteten du klikket på først.
- **Dra i aktivitetstabellen.** Trykk på en rad og dra loddrett. Den øverste fjerdedelen av en rad betyr *før*, den nederste fjerdedelen *etter*. Midten av en hovedaktivitet legger aktiviteten under den som siste delaktivitet. Midten av en vanlig aktivitet teller som nærmeste kant. Drar du en rad som er en del av flere valgte rader, flyttes hele utvalget.
- **Dra i Gantt-diagrammet.** Dra stolpen loddrett til en annen rad. Det virker på samme måte som å dra i aktivitetstabellen, og ingen datoer endres. Drar du vannrett, flytter du datoene i stedet.

Hver flytting kan angres i ett steg med *Angre* (Ctrl+Z).

### Holde WBS-nummerene oppdatert

Se på knappen *WBS auto* i *Tidsplan › Struktur*.

- **På (standard i et nytt prosjekt).** Den er også på etter at du åpner en fil uten denne innstillingen, hvis alle WBS-koder allerede stemmer med nummereringen i treet (1, 1.1, 1.2 …). Kodene endres ikke. En tom fil uten denne innstillingen får også *på*, akkurat som et nytt prosjekt. Appen nummererer hele treet på nytt ved hver tillegging, sletting og flytting. WBS-koden er da skrivebeskyttet: du kan ikke skrive den i aktivitetstabellen eller i panelet *Egenskaper*. *Nummerer WBS på nytt* er deaktivert.
- **Av.** Standard i en fil med egne koder, for eksempel *A1000*, eller med én kode som avviker fra treet. Kodene blir som de er, også etter flytting og innrykk. Du skriver dem selv, i kolonnen *WBS* eller i feltet *WBS-kode* i panelet *Egenskaper*. Eller du får dem nummerert én gang med *Nummerer WBS på nytt*. Det overskriver også koder du har skrevet selv.

Slår du på *WBS auto*, nummererer appen treet med en gang. Du kan angre både *WBS auto* og *Nummerer WBS på nytt* med *Angre*.

## Fallgruver og hva appen gjør

**Filtrering, gruppering eller sortering er på.** Rekkefølgen du ser, er da ikke rekkefølgen i tidsplanen, så appen låser strukturen. *Rykk inn* og *Reduser innrykk* er deaktivert, med verktøytipset *Ikke tilgjengelig under filtrering/gruppering/sortering*. Alt+→ og å dra viser samme tekst i en rød stripe, med knappen *Tøm*. Den fjerner filter, gruppering og sortering på en gang, og Ctrl+Z henter dem ikke tilbake. Stripen blir værende til du klikker på krysset, bruker Ctrl+Z eller Ctrl+Y, eller går til et annet dokument. *Rykk inn* og *Reduser innrykk* mangler da i hurtigmenyen.

Alt+↑ og Alt+↓ virker i en slik visning, uten melding. Med bare et filter ser du den nye rekkefølgen med en gang. Med sortering endres rekkefølgen i tidsplanen, men du ser det først etter *Tøm*.

**WBS auto er av.** En ny aktivitet får koden som passer til plassen i treet, også om en annen aktivitet allerede har den koden. Dermed kan like nummer oppstå. Også etter innrykk stemmer ikke kodene lenger med treet. *Nummerer WBS på nytt* retter begge deler.

**En milepæl får delaktiviteter.** En milepæl er et tidspunkt og har ingen delaktiviteter. Appen fjerner markeringen for milepæl og gir deg beskjed.

**En aktivitet med tilordninger av ressurser får delaktiviteter.** En hovedaktivitet har ingen tilordninger selv. Appen spør derfor først hva som skal skje med dem, i vinduet *Aktivitet blir en hovedaktivitet*. Det skjer når du rykker inn en aktivitet, bruker *Legg til delaktivitet* eller *Legg til milepæl* på en aktivitet, setter inn en mal, og i *Rediger aktivitet* når du velger en ny *Overordnet aktivitet*: for en eksisterende aktivitet og for en ny aktivitet. I *Rediger aktivitet* kommer spørsmålet før lagring. Velger du *Avbryt* der, blir *Rediger aktivitet* åpen med endringene dine. Du velger:

- *Avbryt*: ingenting endres, og også strukturen blir som den var.
- *Fjern tilordning*: aktiviteten får delaktiviteter, og tilordningene fjernes. Det faktiske arbeidet for disse tilordningene fjernes også.
- *Flytt til '…'*: tilordningene går til den første nye delaktiviteten som kan ta dem imot, med det faktiske arbeidet. En milepæl eller en hovedaktivitet tar ikke imot tilordninger.

Har den delaktiviteten allerede samme ressurs, eller finnes det ingen passende delaktivitet, er *Flytt* deaktivert. Et oransje felt i vinduet forteller deg hvorfor.

Har en tilordning allerede faktisk arbeid, forteller det oransje feltet hvor mange timer per ressurs, for eksempel *Tilordningen av Metselaar har allerede 8 timer med faktisk arbeid. Fjerning kaster det arbeidet bort.* *Avbryt* er da standardknappen: Enter endrer ingenting. Vil du likevel fjerne tilordningen, klikk på *Fjern tilordning* selv.

Mens vinduet er åpent, virker ingen snarvei utenfor vinduet, inkludert *Angre*, *Lim inn*, Delete, F5 og Ctrl+S. Skaper én handling flere hovedaktiviteter samtidig, viser vinduet ressursene per aktivitet, og valget ditt gjelder for alle. Én *Angre* (Ctrl+Z) herstiller hele handlingen.

**En avhengighet ville skape en syklus.** Avhengighetene til en hovedaktivitet gjelder også for delaktivitetene. Hvis en flytting på grunn av det ville skape en syklus, avviser appen den med meldingen *Denne flyttingen ville skape en syklus i tidsplanen (…)*. Ingenting endres.

**En avhengighet mellom en aktivitet og sin egen fase.** Hvis du legger en aktivitet under en fase den allerede har en avhengighet med, består avhengigheten, men den telles ikke lenger i beregningen. Appen gir deg beskjed. Du kan lese mer om avhengigheter for hovedaktiviteter i [Avhengigheter og forsinkelse](docs://uitleg-relaties).

**Tidsplanen er utdatert.** En flytting til en annen fase kan endre datoer. Trykk **Beregn** (F5). Å bare bytte rekkefølgen innenfor samme fase endrer ikke datoene.

## Se også

- [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen): legg nye aktiviteter på riktig plass.
- [Lagre og sette inn WBS-maler](docs://howto-wbs-sjablonen): gjenbruk en hel fase.
- [Legge til avhengigheter](docs://howto-relaties-leggen): koble aktiviteter sammen.
- [Velge, slette og angre aktiviteter](docs://howto-taken-selecteren-verwijderen): angre en flytting.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): fire faser med sine delaktiviteter, slik du bygger dem ved å rykke inn.
