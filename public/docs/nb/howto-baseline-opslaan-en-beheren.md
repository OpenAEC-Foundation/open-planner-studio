# Lagre og administrere en grunnlinje

Mål: registrer tidsplanen som en avtale (en grunnlinje), så du senere kan se hvor langt utførelsen avviker. Du kan også beholde, gi nytt navn til, velge og slette flere grunnlinjer.

## Når du trenger dette

Du registrerer en grunnlinje når tidsplanen er godkjent og arbeidet ennå ikke er startet. Hvis tidsplanen senere blir formelt revidert, for eksempel etter en endringsordre, lagrer du en ny grunnlinje og beholder den første. Slik måler du utførelsen mot både den første avtalen og den reviderte. Hva en grunnlinje registrerer nøyaktig, og hvordan appen beregner avviket, forklares i [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang).

## Steg

### Lagre en grunnlinje

1. Trykk **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Grunnlinjen registrerer datoene som er beregnet på det tidspunktet.
2. Velg *Tidsplan › Grunnlinjer og fremdrift › Administrer grunnlinjer…*. Vinduet *Grunnlinjer* åpnes.
3. Under *Lagre ny grunnlinje* står et forslag til navn, for eksempel *Grunnlinje 1 — (dagens dato)*. Skriv et eget navn som du kjenner igjen senere, for eksempel *Grunnlinje*.
4. Klikk på *Lagre*. Grunnlinjen står nå i listen og er med en gang den aktive grunnlinjen.
5. Klikk på *Lukk*.

Under hver aktivitetsstolpe i Gantt-diagrammet finnes nå en tynn stolpe med grunnlinjedatoene. En milepæl får en liten diamant. Du slår overlegget av eller på med *Visning › Grunnlinjer og fremdrift › Grunnlinjeoverlegg*.

### Velge den aktive grunnlinjen

Åpne *Administrer grunnlinjer…* og velg i kolonnen *Aktiv* grunnlinjen du vil sammenligne med. Så lenge det finnes grunnlinjer, er nøyaktig én aktiv. Gantt-overlegget, rapporttypen *Avvik* og *Fremdriftsrapport* bruker den aktive grunnlinjen.

### Gi en grunnlinje nytt navn

Endre navnet i listen. Endringen gjelder med en gang. Du trenger ikke klikke på *Lagre*.

### Slette en grunnlinje

Klikk på den lille søppelbøtta ved siden av grunnlinjen i listen. Hvis du sletter den aktive grunnlinjen, spør appen *Slette den aktive grunnlinjen?*. Deretter blir den nyeste gjenværende grunnlinjen den aktive. Finnes det ingen andre, er det ikke lenger noen aktiv grunnlinje, og overlegget forsvinner. Med Ctrl+Z henter du en slettet grunnlinje tilbake. Lukk vinduet først; Ctrl+Z fungerer ikke inne i et vindu.

### Avvik i aktivitetstabellen

Hver grunnlinje har seks kolonner i aktivitetstabellen. Klikk på **+** til høyre i overskriften for aktivitetstabellen (*Legg til kolonne*) og åpne kategorien *Grunnlinje*. Per grunnlinje finnes *Planlagt start*, *Planlagt slutt*, *Varighet*, *Startavvik*, *Sluttavvik* og *Varighetsavvik*, med navnet på grunnlinjen foran, for eksempel *Grunnlinje — Sluttavvik*. Avvikene er i arbeidsdager: et pluss betyr senere, et minus betyr tidligere. En aktivitet som ikke finnes i grunnlinjen, viser en strek (—) i disse kolonnene.

## Fallgruver og hva appen gjør

**En utdatert tidsplan.** Hvis tidsplanen er utdatert, står det i vinduet *Tidsplanen er utdatert — omberegn først (F5)*. Det er en advarsel. Lagring er fortsatt mulig, men da lagrer du de gamle datoene. Lukk vinduet, trykk **Beregn** og lagre først etter det.

**En grunnlinje med fremdrift.** Lagrer du en grunnlinje etter at du har registrert fremdrift, registrerer den tilstanden med de faktiske datoene. Avviket er da null, og det sier ikke lenger noe om utførelsen. Registrer grunnlinjen før arbeidet starter.

**En grunnlinje kan ikke oppdateres.** Vil du revidere avtalen, lagre en ny grunnlinje og slett den gamle hvis det er nødvendig.

**Et ⚠ ved Varighet eller Varighetsavvik.** For en aktivitet i timer er en dag arbeidstiden i kalenderen. Har kalenderen egne timer per dag (for eksempel 8 med tidsbånd på 10 timer, fra Primavera P6), telte en eldre versjon av appen dagene annerledes. En grunnlinje fra den versjonen beholder det gamle tallet: en aktivitet på 1870 timer er 233,75 dager i grunnlinjen og 187 dager nå. Appen konverterer ikke en slik grunnlinje. Kolonnene *Varighet* og *Varighetsavvik* for den grunnlinjen viser da et ⚠. Hold musepekeren over det for forklaringen. Datoene i grunnlinjen er riktige. Lagre en ny grunnlinje og slett den gamle hvis det er nødvendig.

**Bare aktiviteter uten delaktiviteter.** En fase står ikke i grunnlinjen. Den har ingen stolpe i grunnlinjen og heller ikke noe avvik. Fasen følger av aktivitetene under den.

**Nye og slettede aktiviteter.** En aktivitet du legger til etter lagring, har ingen stolpe i grunnlinjen. I avviksrapporten vises den som *Ny*. En aktivitet du sletter, vises som *Fjernet*.

**Flytt prosjekt.** I vinduet *Flytt prosjekt…* finnes avkrysningsboksen *Flytt grunnlinjer med* så snart det finnes grunnlinjer. Som standard er boksen av. Grunnlinjene blir da stående der de er, så forskyvningen viser seg som avvik. Se [Flytte et prosjekt](docs://howto-project-verplaatsen).

**Lagret i prosjektfilen.** Grunnlinjer og valget av aktiv grunnlinje lagres med prosjektet. De kommer tilbake når du åpner filen.

## Se også

- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): hva en grunnlinje registrerer, og hvordan avviket beregnes.
- [Flytte et prosjekt](docs://howto-project-verplaatsen): avkrysningsboksen *Flytt grunnlinjer med*.
- [Oppdatere fremdrift](docs://howto-voortgang-bijwerken): registrere den faktiske tilstanden som du sammenligner med grunnlinjen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): én grunnlinje (*Grunnlinje ved start*) før start, med fremdrift og en statusdato på 20. mai 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): to grunnlinjer, *Kontrakt* og *Ny grunnlinje (endringsordre)*, med fremdrift og en statusdato på 5. juli 2027.
