# Installere og administrere en utvidelse

Mål: installere en utvidelse, lese tillatelsesspørsmålet og senere deaktivere eller fjerne utvidelsen.

## Når du trenger dette

En utvidelse legger til noe i appen uten at du må vente på en ny versjon. En utvidelse kan for eksempel legge til et importformat som vises under *Fil › Importer*, sette en knapp i båndet eller levere en skrift for PDF-eksporten. Den offisielle katalogen deler dem inn i kategorier: *Import/eksport*, *Tidsplan*, *Rapportering*, *Verktøy*, *Skrifter* og *Annet*.

Tenk deg godt om før du installerer en. En utvidelse er programkode som kjører med samme rettigheter som selve appen, og appen kan ikke begrense det. Derfor spør appen om tillatelse ved hver installasjon. Det du ser i det spørsmålet, forklares nedenfor.

## Steg

### Installer en utvidelse fra katalogen

1. Velg *Fil › Utvidelser*.
2. Velg fanen *Bla gjennom*. Appen henter katalogen mens den viser *Laster katalog...*. Hva som finnes i katalogen, bestemmes av OpenAEC Foundation, som vedlikeholder den. Det kan endre seg.
3. Søk etter en utvidelse i feltet *Søk etter utvidelser...*. Feltet søker i navn, beskrivelse, forfatter og etiketter.
4. Hvert kort viser navn, versjon, kategori, beskrivelse og forfatter. Klikk *Installer*.
5. Vinduet *Installer utvidelse?* åpnes. Les det, og se neste steg.
6. Klikk *Installer* for å fortsette. Med *Ikke installer* skjer ingenting. Esc eller et klikk ved siden av vinduet betyr også at du sier nei, og appen viser da ingen feilmelding.

Etter installasjonen er utvidelsen aktivert med en gang. På kortet under *Bla gjennom* står det nå *Installert*. Hva utvidelsen legger til, ser du i selve appen: en ny knapp i båndet, eller et importformat under *Fil › Importer*. Noen utvidelser viser også en melding. Du kjenner den igjen på forstavelsen *Utvidelse* etterfulgt av navnet på utvidelsen.

**Opplæringer.** Opplæringene er en utvidelse. Hvis du ser knappen *Installer opplæringer* under *Opplæringer* i *Hjelp*, åpner den *Fil › Utvidelser* på fanen *Bla gjennom*. Spørsmålet etter den første rundturen installerer også denne utvidelsen. Begge veiene viser samme tillatelsesspørsmål. Du kan si nei til det.

### Installer en utvidelse fra en fil

Hvis du har fått en utvidelse som fil, installerer du den slik.

1. Velg *Fil › Utvidelser*.
2. Øverst til høyre klikker du *ZIP* for en ZIP-fil, eller *JS* for en separat JavaScript-fil.
3. Velg filen. Vinduet *Installer utvidelse?* åpnes, som ovenfor.

En ZIP-fil må inneholde en `manifest.json` og hovedfilen til utvidelsen. Hvis du installerer en utvidelse som allerede er installert, erstatter den nye versjonen den gamle. Hvis appen ikke kan installere filen, for eksempel fordi en ZIP-fil er skadet, skjer ingenting: appen viser ingen feilmelding for ZIP og JS, og utvidelsen vises ikke i listen. Årsaken står likevel i feilsøkingsterminalen. Slå den på med *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Avansert*, *Slå på feilsøkingsterminal*, og åpne den med knappen *Vis feilsøkingsterminal* i statuslinjen. Der står det for eksempel *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (appen skriver denne tekniske teksten på nederlandsk).

### Les tillatelsesspørsmålet

Spørsmålet viser hva du må avgjøre.

- *Forfatter* og *Repositorium* viser hvem som har laget utvidelsen, og hvor kildekoden ligger.
- *Opprinnelse* viser hvor filen kommer fra, og om den er kontrollert. Hvis det står med rød tekst at nedlastingen ikke er bekreftet, installer den bare hvis du kjenner kilden.
- *Hva du sier ja til* gjentar at en utvidelse er programkode som kjører med samme rettigheter som appen selv, og hva det betyr på plattformen din. Installer bare utvidelser der du stoler på utvikleren.
- *Det denne utvidelsen sier at den bruker* viser tillatelsene som utvikleren har oppgitt, som små etiketter. Det er en erklæring, ikke en begrensning. Hvis det står *Ingenting oppgitt.*, kan utvidelsen likevel lese og endre dataene i tidsplanen din.

Hva hver etikett betyr, og de nøyaktige tekstene i vinduet, står i [Utvidelsestillatelser](docs://ref-extensiepermissies).

### Deaktiver, aktiver på nytt eller fjern en utvidelse

1. Velg *Fil › Utvidelser* og fanen *Installert*. Hver utvidelse har et kort med navn, versjon, kategori, beskrivelse og forfatter.
2. Med bryteren på kortet deaktiverer du utvidelsen (*Deaktiver*) eller aktiverer den igjen (*Aktiver*). Når utvidelsen er deaktivert, forsvinner knappene og importformatene som utvidelsen la til, men utvidelsen forblir installert. Den forblir også av etter at du har startet appen på nytt. En aktivert utvidelse starter av seg selv når appen starter.
3. Klikk *Fjern*. Knappen endres til *Bekreft*, med forklaringen *Klikk igjen for å fjerne for godt*. Klikk én gang til for å fjerne utvidelsen. Appen rydder også opp i innstillingene som utvidelsen har lagret.

## Problemer og hva appen gjør da

**Katalogen laster ikke.** Det står *Kunne ikke laste katalogen:* med den tekniske årsaken etter, og knappen *Prøv igjen*. Det kan skyldes at du ikke har internettforbindelse.

**Det står *Installasjonen mislyktes.* under et kort i katalogen.** Nedlastingen eller installasjonen mislyktes, for eksempel fordi sjekksummen ikke stemte. Da er ingenting installert. Dette er noe annet enn å si nei til spørsmålet. Ved et nei vises ingen feilmelding.

**Det står *Hoppet over katalogoppføringer: 1* over listen.** Katalogen inneholdt et element som appen ikke kan bruke. Du kan installere de andre utvidelsene som vanlig.

**En utvidelse starter ikke.** Kortet viser da en feilmelding, for eksempel at utvidelsen trenger en nyere versjon av Open Planner Studio, med den nåværende versjonen din vist, eller feilen som utvidelsen selv ga. Utvidelsen er da ikke aktiv. Oppdater appen, eller fjern utvidelsen.

**Et kort med *Karantene*.** Appen kunne ikke bruke den lagrede utvidelsen. Under navnet står det *Årsak:* med årsaken. Med *Fjern fra lagring* rydder du opp.

**Skrive en utvidelse selv.** Veiledningen for utviklere av utvidelser (manifest, API, tillatelser) ligger i repositoriet `OpenAEC-Foundation/open-planner-studio` på GitHub, i filen `docs/extensions.md`.

**En utvidelse hører ikke til et prosjekt.** Utvidelser lagres i appen: i desktopappen på denne datamaskinen, og i nettleseren i nettleserens lagring. De gjelder for alle prosjektene dine og er ikke en del av prosjektfilen din. Hvis du sletter nettstedsdataene i nettleseren, er utvidelsene borte.

## Se også

- [Oppdatere appen](docs://howto-app-bijwerken): en utvidelse kan be om en nyere versjon av appen.
- [Tillatelser for utvidelser](docs://ref-extensiepermissies): hva hver tillatelse i installasjonsspørsmålet betyr.
