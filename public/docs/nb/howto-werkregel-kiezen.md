# Velg en aktivitetstype

Mål: stel per aktivitet inn hva appen justerer når du endrer varigheten, tildelingsenhetene eller arbeidet: varigheten, tildelingsenhetene eller arbeidet selv.

## Når du trenger dette

Du har satt ressurser på en aktivitet, og du vil at appen skal beregne slik du selv gjør. Ett eksempel: kranen leies for én dag, og den dagen er fast. Et annet eksempel: du vet at det er 160 timer murarbeid i aktiviteten, og du vil se hvor lang tid det tar med tre personer i stedet for to. Disse to situasjonene krever ulike aktivitetstyper.

Aktivitetstypen bestemmer hvilken av de tre størrelsene varighet, tildelingsenheter og arbeid som følger med når du endrer en annen. Bakgrunn og utregnede eksempler står i [Aktivitetstyper: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels).

## Trinn

### Vis aktivitetstypen

Aktivitetstypen vises ikke som standard. Slå den på én gang:

1. Velg *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Tidsplan*.
2. Under overskriften *Beregning*, kryss av for *Bruk aktivitetstyper*.
3. Lukk vinduet med *Lukk*.

Dette er en innstilling i appen, ikke i prosjektfilen. Inneholder en fil allerede aktivitetstyper eller lagret arbeid, for eksempel en fil fra MS Project eller Primavera P6, viser appen aktivitetstypen for den filen, også uten denne innstillingen. Det samme gjelder når du selv velger en aktivitetstype i en fil. Visningen blir da stående på for den filen, også hvis du slår av innstillingen igjen. Den blir stående på så lenge filen er åpen. Etter ny åpning blir den stående på så lenge filen inneholder en aktivitetstype eller lagret arbeid.

### Sett aktivitetstypen for en aktivitet

1. Velg aktiviteten. Panelet *Egenskaper* er til høyre. Ser du det ikke, slå det på med *Visning › Paneler › Egenskaper*.
2. Ved *Aktivitetstype* velger du ett av de fem alternativene: *Prosjektstandard (Fast varighet og faste tildelingsenheter)*, *Fast varighet og faste tildelingsenheter*, *Fast varighet og fast arbeid*, *Fast arbeid* eller *Faste enheter*. Med *Prosjektstandard* følger aktiviteten prosjektets standard.
3. I den åpne rullegardinlisten har hvert alternativ et i-ikon. Hold pekeren over det, eller klikk eller trykk på det, for å se forklaringen. Å klikke på i-ikonet velger ikke aktivitetstypen ennå.
4. Ved siden av det lukkede feltet står også et i-ikon. Det forklarer aktivitetstypen som gjelder nå, for eksempel *Varigheten følger av arbeid og tildelingsenheter.* Med *Prosjektstandard* er det aktivitetstypen mellom parentesene.

*Prosjektstandard* er det første valget, og det en aktivitet har som standard. Aktivitetstypen mellom parentesene er den prosjektet har som standard akkurat nå. Appen har ingen knapp for å endre prosjektstandarden. Den kommer fra en import (for eksempel fra MS Project eller Primavera P6) eller fra MCP-forbindelsen. Vil du ha en annen aktivitetstype for én aktivitet, velg den her.

Du kan også velge aktivitetstypen i tabellen. Klikk på **+** til høyre i overskriften på aktivitetstabellen (*Legg til kolonne*). Velg deretter kolonnen *Aktivitetstype* under *Tidsplan*.

En aktivitet uten tilordning har ingenting å knytte sammen, så aktivitetstypen gjør ingenting der. Tilordne en ressurs først (se [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen)).

### Se og endre arbeidet

For en aktivitet med tilordninger vises en kolonne *Arbeid (t)* i blokken *Tilordninger* i panelet *Egenskaper*, ved siden av *Tildelingsenheter*. Det er det gjenstående arbeidet for den ressursen, i timer. Et lite hengelås over en kolonne viser hva aktivitetstypen holder fast: *Tildelingsenheter* med *Fast varighet og faste tildelingsenheter* og med *Faste enheter*, og *Arbeid (t)* med *Fast varighet og fast arbeid* og med *Fast arbeid*.

Vil du endre arbeidet selv, skriv inn timene i feltet og trykk Enter. Appen godtar ikke en verdi på 0 eller lavere: feltet hopper tilbake til forrige verdi.

### Se hva som skjer

Velger du en aktivitetstype, endres ingen tall ennå. Under en aktivitetstype som beskytter arbeid, låser appen bare det gjeldende arbeidet, så *Arbeid (t)* får en lagret verdi. Først ved neste endring bestemmer aktivitetstypen hva som følger med. Endre for eksempel *Tildelingsenheter* og se hva som skjer med varigheten og arbeidet.

Hvis det endrer varigheten til aktiviteten, viser statuslinjen *Utdatert — omberegn (F5)*. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*, for å se de nye datoene. Er *Beregne automatisk* på (samme fane *Tidsplan*, under overskriften *Beregning*), gjør appen dette selv.

## Hvilken aktivitetstype passer

- **Fast varighet og faste tildelingsenheter** passer når varigheten er avtalt og tildelingsenhetene er inndata du gir. Arbeidet følger av de to. Dette er standard. Kranen som leies for én dag hører hit: dagen er fast, og du bestemmer hvor mange kraner som er på den.
- **Fast varighet og fast arbeid** passer når aktiviteten må være ferdig innenfor en fast tidsramme, og du vet hvor mye arbeid det er i den. Endres varigheten, justerer appen tildelingsenhetene.
- **Fast arbeid** passer når du vet hvor mange timer arbeid det er i aktiviteten, og du vil se hvordan varigheten endrer seg med antall personer. De 160 timene murarbeid med tre personer i stedet for to hører hit. Pussarbeidet i øvingsprosjektet får denne aktivitetstypen.
- **Faste enheter** passer når tildelingsenhetene er faste, for eksempel én kran, og arbeidet bestemmer varigheten.

## Fallgruver og hva appen gjør da

**Feltet *Aktivitetstype* mangler.** Da er innstillingen *Bruk aktivitetstyper* av, og filen har ingen aktivitetstyper ennå. Eller du har valgt en milepæl, en fase, en hengekøye eller en aktivitet med varighetstypen *Forløpt tid*. Der finnes ingen aktivitetstype. Velg en vanlig aktivitet.

**Varigheten endres uten at du endrer den.** Under *Fast arbeid* og *Faste enheter* følger varigheten av tildelingsenheter og arbeid. Endrer du en av dem eller antall ressurser, justerer appen varigheten og runder opp til hele arbeidsdager. For en aktivitet i timer runder appen opp til hele minutter.

**Arbeidet stemmer ikke helt med tildelingsenheter × varighet.** Avrunding kan være årsaken. I feltet *Arbeid (t)* vises da et varselskilt, *Avviker fra tildelingsenheter × varighet*. Histogrammet følger det lagrede arbeidet.

**Materiale teller ikke.** For en materialressurs viser *Arbeid (t)* en strek. Materiale styrer aldri varigheten.

**En aktivitet med fremdrift.** Aktivitetstypen virker på den gjenstående delen. Derfor viser *Arbeid (t)* bare det som fortsatt må gjøres.

**Angring.** Å velge en aktivitetstype, og hver endring som aktivitetstypen beregner, angres i ett trinn med *Angre* (Ctrl+Z). Aktivitetstypen er da borte igjen, men feltet *Aktivitetstype* blir stående synlig.

## Se også

- [Aktivitetstyper: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels): hvordan appen knytter varighet, tildelingsenheter og arbeid sammen, med utregnede eksempler.
- [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen): å sette en ressurs på en aktivitet.
