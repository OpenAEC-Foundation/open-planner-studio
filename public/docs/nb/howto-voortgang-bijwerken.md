# Oppdatere fremdrift

Mål: legg den faktiske tilstanden til arbeidet inn i tidsplanen, og omberegn tidsplanen. Dette gjelder hvilke aktiviteter som er ferdige, hvilke som pågår, og hvor mye som gjenstår.

## Når du trenger dette

Du oppdaterer fremdriften på faste tidspunkter, for eksempel hver fredag når byggelederen rapporterer tilstanden. Slik får tidsplanen vite hva som faktisk har skjedd, og den beregner gjenstående arbeid fra statusdatoen. Hvorfor appen gjør det slik, står forklart i [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang).

## Trinn

### 1. Angi statusdatoen

Statusdatoen er dagen du gjør opp status. Angi den før du oppgir fremdriften.

1. Gå til *Tidsplan › Grunnlinjer og fremdrift › Statusdato*.
2. Skriv datoen i de tre feltene for dag, måned og år (i samme rekkefølge som datoformatet ditt), for eksempel 28, 06 og 2027, og trykk Enter. Appen hopper selv til neste felt.
3. Har kalenderen for prosjektet tidsbånd (blokken *Arbeidstider* i vinduet *Kalendere*)? Da regner appen i timer, og et tidsfelt vises til høyre, for eksempel 17:00. Skriv et annet klokkeslett, for eksempel 12:00, og trykk Enter. Tømmer du tidsfeltet, blir bare datoen igjen. Endrer du bare datoen, blir klokkeslettet stående. Klokkeslettet følger klokkeslettnotasjonen din (24 eller 12 timer). Uten tidsbånd regner appen i hele dager: da finnes det ikke noe tidsfelt, og linjen for statusdatoen står ved begynnelsen av dagen.
4. Med det lille krysset ved feltet tømmer du statusdatoen igjen.

Gjør du opp status på fredag etter arbeidstid, angir du statusdatoen til neste arbeidsdag, mandag. Appen planlegger det gjenstående arbeidet fra starten av statusdatoen.

Oppgir du fremdrift når det ennå ikke finnes noen statusdato, setter appen den til i dag og melder: *Statusdato satt til i dag (…).* Gjør heller dette selv først.

### 2. Oppgi fremdriften

Velg måten som passer situasjonen din. De gir samme resultat.

**Én aktivitet i egenskapspanelet.** Nyttig når du oppdaterer én enkelt aktivitet.

1. Klikk aktiviteten. Ser du ikke panelet *Egenskaper*, slår du det på med *Visning › Paneler › Egenskaper*.
2. Dra glideren *Fremdrift (%)* til prosenten som er utført.
3. Fyll eventuelt inn *Faktisk start* og *Faktisk slutt*, på samme måte som statusdatoen. Appen regner ut feltet *Gjenstående* selv. Du kan ikke endre det her.

En milepæl har ett felt, *Faktisk dato*.

**Velge en prosent i menyen.** Nyttig for en rask statusoppdatering.

1. Høyreklikk stolpen for aktiviteten i Gantt-diagrammet.
2. Velg *Fremdrift*, og velg deretter 0 %, 25 %, 50 %, 75 % eller 100 %.

**Flere aktiviteter i tabellen.** Nyttig når du oppdaterer en hel liste.

1. Klikk på **+** til høyre i overskriften i aktivitetstabellen (*Legg til kolonne*), og åpne kategorien *Fremdrift*. Legg til kolonnene *Faktisk start*, *Faktisk slutt*, *Gjenstående* og *Status*. Kolonnen *Fremdrift* finnes allerede på fanen *Tabell*.
2. Dobbeltklikk en celle, skriv verdien og trykk Enter. Du skriver en prosent som `50` eller `50%`, en dato som `25-06-2027`, en gjenstående varighet som `1`.
3. For *Status* gjelder: dobbeltklikk, trykk Enter, og velg *Ikke startet*, *Pågår* eller *Fullført*.

Hvis du skriver en gjenstående varighet, regner appen tilbake til prosenten: for en aktivitet på 2 arbeidsdager betyr en rest på 1 at prosenten er 50. En rest på 0 fullfører aktiviteten. Kolonnen *Faktisk varighet* (også i kategorien *Fremdrift*) virker omvendt: skriv hvor mye arbeid som allerede er gjort, og appen regner ut prosenten. For en aktivitet på 4 arbeidsdager betyr en faktisk varighet på 1 at prosenten er 25 %. Hvis du velger *Ikke startet* under *Status*, går prosenten til 0, og de faktiske datoene forsvinner.

**Alt for én aktivitet i redigeringsvinduet.** Høyreklikk aktiviteten og velg *Rediger...*. Fremdriftsfeltene finnes der også. De gjelder først når du klikker *Lagre*.

**Mange aktiviteter samtidig fra et regneark.** Se [Importere fremdrift fra et regneark](docs://howto-voortgang-importeren).

### 3. Omberegn tidsplanen

Hver endring av fremdrift eller statusdato gjør tidsplanen utdatert: statuslinjen viser *Utdatert — omberegn (F5)*. Trykk **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Er *Beregne automatisk* på (under *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Tidsplan*), gjør appen dette selv.

## Kontrollere resultatet

- På statusdatoen viser Gantt-diagrammet en stiplet linje med datoen i overskriften. Ved aktiviteter som pågår, bøyer linjen seg ut til prosenten i stolpen. Du slår disse av eller på med *Visning › Grunnlinjer og fremdrift › Fremdriftslinje* og *Statusdatolinje*.
- Den fullførte delen av en stolpe blir grå. Resten beholder fargen sin. En fullført aktivitet er helt grå, med en hake foran navnet og uten slakkområde. Stolpen for en fase blir også grå opp til den utledede prosenten, slik at du ser per fase hvor langt den er kommet. Hvis du viser forgjengerne eller etterfølgerne til en aktivitet, beholder stolpene deres markeringsfargen, også når de er ferdige.
- Fullførte aktiviteter er aldri røde: når du har en statusdato, er en fullført aktivitet ikke kritisk.
- Faser viser en utledet prosent, og slutten på tidsplanen kan ha flyttet seg.
- Hvis du har lagret en grunnlinje, ligger den opprinnelige tidsplanen under hver stolpe. Rapporttypen *Avvik* viser avviket.

## Fallgruver og hva appen gjør

**En dato etter statusdatoen.** Appen godtar ikke en faktisk start eller en faktisk slutt etter statusdatoen. I panelet står det under feltene *Faktiske verdier kan ikke ligge etter statusdatoen*; i tabellen viser cellen *Den faktiske datoen ligger etter statusdatoen.* Sett først statusdatoen senere, eller rett datoen.

**En aktivitet som først ville starte etter statusdatoen.** Oppgir du fremdrift for en aktivitet som ifølge tidsplanen ennå ikke skulle ha startet, åpnes vinduet *Oppgi faktisk start*. Vinduet spør når aktiviteten faktisk startet. Forslaget er statusdatoen. Med *Bruk fremdrift* lagrer du det. Med *Avbryt* endres ingenting.

**100 % uten datoer.** Setter du en aktivitet til 100 % uten faktisk slutt, blir den faktiske slutten statusdatoen, selv om aktiviteten var ferdig tidligere. Fyll deretter selv inn den faktiske slutten.

**En prosent under 100 %.** Setter du en fullført aktivitet tilbake under 100 %, fjernes den faktiske slutten. Fjerner du bare den faktiske slutten, går prosenten til 0, og aktiviteten forblir *Pågår*. Vil du at aktiviteten skal telle som ikke startet igjen, fjern også den faktiske starten, eller velg *Ikke startet* under *Status* i tabellen.

**Endre varigheten til en aktivitet som er i gang.** Arbeidet som er gjort, forblir gjort, og prosenten justeres. En aktivitet på 5 arbeidsdager ved 60 % som du setter til 10 arbeidsdager, ender på 30 %. Appen godtar ikke en varighet som er kortere enn arbeidet som allerede er gjort: *«Build inner cavity leaf» er allerede 60 % ferdig: en varighet kortere enn arbeidet som allerede er gjort, er ikke mulig. Varigheten er ikke endret.* I tabellen viser cellen *Denne varigheten er kortere enn arbeidet som allerede er gjort.*

**Appen runder av den gjenstående varigheten.** Appen runder den gjenstående varigheten av til hele arbeidsdager. For en aktivitet på 2 arbeidsdager gir både 50 % og 75 % en rest på 1 arbeidsdag.

**En fase.** En fase har ingen egen fremdrift. I panelet står det *Avledet fra delaktivitetene. Endre fremdriften der. Hovedaktiviteten oppdateres etter at du har beregnet (F5).* I tabellen viser cellen *Fremdriften til en hovedaktivitet utledes fra delaktivitetene og kan ikke endres her.*

**Flytt statusdatoen senere.** Gjenstående arbeid for aktiviteter som er i gang, starter på den nye statusdatoen. Arbeid som ennå ikke har startet, kan ikke ligge før den datoen. Flytt derfor statusdatoen bare sammen med en oppdatering av fremdriften. Angir du en statusdato uten å oppgi fremdrift, flyttes alt arbeid som ennå ikke har startet, til den datoen (unntatt i Microsoft Project-profilen).

**En feil.** Hver endring av fremdrift er ett steg som angres med Ctrl+Z.

## Se også

- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): hvordan appen beregner gjenstående arbeid og statusdatoen, med et gjennomregnet eksempel.
- [Importere fremdrift fra et regneark](docs://howto-voortgang-importeren): lese inn fremdrift for mange aktiviteter samtidig.
- [Velge fremdriftsmodus](docs://howto-voortgangsmodus-kiezen): hva appen gjør med en aktivitet som har startet mens forgjengeren fortsatt pågår.
- [Lagre og administrere en grunnlinje](docs://howto-baseline-opslaan-en-beheren): lagre den opprinnelige tidsplanen for å sammenligne fremdriften med.
