# Administrere ressurser

Mål: opprett, rediger og slett ressurser (personer, maskiner og materiale) i prosjektet, slik at du kan tilordne dem til aktiviteter.

## Når du trenger dette

Før du setter en murer eller en kran på en aktivitet, må personen eller maskinen finnes som ressurs. Ressursen registrerer hvor mye av den som finnes, og på hvilke dager den jobber. Med det regner appen ut om du ber om for mye av den på én dag. Du redigerer en ressurs når bemanningen endres, for eksempel når en andre murer blir med.

Her er to begreper. **Maksimalt antall** er kapasiteten per arbeidsdag: 1 er én person eller én maskin, 2 er to av dem. En **tilordning** er en ressurs på en aktivitet (se [Tildele ressurser med en kurve](docs://howto-resource-toewijzen)).

## Trinn

### Opprette en ressurs

1. Velg *Ressurser › Administrer › Ny ressurs*. Ressurspanelet tar over arbeidsområdet, og en tom rad vises nederst i tabellen. Du kan også åpne panelet med *Ressurser › Administrer › Ressurser* og deretter velge *Legg til ny ressurs i prosjektet*.
2. Skriv navnet, for eksempel *Bricklayer*.
3. Velg *Type*: *Arbeid* (standard), *Utstyr*, *Materiale*, *Underentreprenør* eller *Mannskap*.
4. Fyll inn de andre feltene hvis det trengs. Alt har en standardverdi: *Maksimalt antall* er 1, og *Kalender* er *Prosjektkalender*. *Standardsats/time* er tom. Du kan bare fylle inn *Enhet* for typen *Materiale*, for eksempel m³.
5. Trykk Enter eller klikk utenfor raden. Ressursen står nå i tabellen. Med Enter åpnes straks en tom rad under den, for den neste. Trykk Esc når du er ferdig.

Raden blir først en ressurs når den har et navn. Med Esc, eller ved å klikke bort uten navn, oppretter appen ingenting. Rekkefølgen du fyller inn feltene i, har ingen betydning: du kan velge typen først og skrive navnet etterpå.

### Redigere en ressurs

Rediger feltene i raden. Appen lagrer navnet, *Standardsats/time* og *Enhet* når du forlater feltet. De andre feltene lagres med en gang.

- *Maksimalt antall* godtas bare av appen hvis verdien er større enn 0. Med 0 eller mindre får feltet en rød kant og settes tilbake til forrige verdi.
- *Kalender* bestemmer på hvilke dager ressursen jobber. Velg *Prosjektkalender* eller en egen kalender. Med *+ Ressurskalender* oppretter du en ny kalender, og blyanten (*Rediger…*) åpner den valgte kalenderen. Hvis en aktivitet jobber en dag da ressursen er fri ifølge kalenderen, regnes den dagen som overallokert. Hvordan du oppretter en ressurskalender, står i [Sette opp en ressurskalender](docs://howto-resourcekalender-instellen).
- *Standardsats/time* og *Totalt*: *Totalt* er de belastede timene for den ressursen ganger standardsatsen. En pusser som er belastet i 32 timer, med en standardsats på 50 per time, gir 1 600,00. Nederst i tabellen står summen av alle ressurser.
- *Mannskap* grupperer en ressurs under en ressurs av typen *Mannskap*. Det er bare en gruppering: appen legger ikke kapasiteten eller belastningen til medlemmene sammen i mannskapet.
- Den fargede flisen til venstre er fargen til ressursen. Den er bare til visning og påvirker ikke tidsplanen.

### Kapasitet som endrer seg over tid

Kommer din andre murer først 19. juli? Klikk på pilen ved *Maksimalt antall*. Under *Tidsfasert kapasitet* velger du *Legg til trinn*. Hvert trinn har en dato (*Fra*) og et tall (*Maksimalt antall*). Fra den datoen gjelder det tallet. Uten trinn gjelder den faste verdien hele tiden.

Et nytt trinn starter med dagens dato og 1 tildelingsenhet. Endre begge, for ellers gjelder en kapasitet på 1 fra i dag.

### Slette en ressurs

1. Klikk på søppelkassen i raden.
2. Har ressursen tilordninger, spør appen om bekreftelse, for eksempel *'Bricklayer' har 4 tilordning(er). Vil du slette?* Klikk på haken for å slette, eller på krysset for å avbryte. Uten tilordninger forsvinner ressursen med en gang.

Tilordningene til ressursen slettes også. Har en aktivitet en aktivitetstype som ikke er *Fast varighet og faste tildelingsenheter*, fordeler appen arbeidet fra den fjernede ressursen mellom ressursene som er igjen. Avhengig av aktivitetstypen endres deres tildelingsenheter eller varigheten til aktiviteten. Hvis varigheten endres, er tidsplanen din ikke lenger oppdatert.

Du kan angre opprettelse, redigering og sletting med *Angre* (Ctrl+Z).

### Den lille oversikten i sidepanelet

*Ressurser › Administrer › Ressursdokk* legger en kompakt oversikt i høyre side, ved siden av *Egenskaper*. Der ser du navnet og fargen til hver ressurs, og et varselsymbol (*Overallokert*) ved en ressurs med overallokering. Du kan bare endre *Maksimalt antall* der. Velger du én eller flere aktiviteter, viser oversikten bare ressursene til disse aktivitetene.

## Fallgruver og hva appen gjør da

**Bare typen *Materiale* gjør en forskjell for beregningen.** Arbeid, Utstyr, Underentreprenør og Mannskap behandles likt. Materiale teller ikke med i varigheten til en aktivitet, og det jevnes ikke ut. I histogrammet teller raden *Alle ressurser* heller ikke materiale med.

**Ingen navn, ingen ressurs.** En tom rad forsvinner uten spor.

**Et nytt trinn i kapasiteten.** Hvis du glemmer å endre datoen og tallet, er kapasiteten 1 fra i dag.

**Å fjerne en ressurs du fortsatt trenger.** Har du den fjernet ved et uhell, trykk Ctrl+Z med en gang. Tilordningene kommer tilbake også.

## Se også

- [Tildele ressurser med en kurve](docs://howto-resource-toewijzen): sette en ressurs på en aktivitet.
- [Sette opp en ressurskalender](docs://howto-resourcekalender-instellen): fastsette arbeidsdagene til én ressurs.
- [Løse opp overallokering](docs://howto-overbezetting-oplossen): hva du gjør når en ressurs har for mye å gjøre på én dag.
- [Ressurspanelet](docs://ref-resourcepaneel): alle felt og knapper i ressurspanelet.
