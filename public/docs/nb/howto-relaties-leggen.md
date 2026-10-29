# Legge til avhengigheter

Mål: koble aktiviteter sammen, så en aktivitet bare starter når det som kommer før den er ferdig, og legg inn ventetid (forsinkelse) mellom dem der det trengs.

## Når du trenger dette

Uten avhengigheter vet ikke appen at murer først kan starte når fundamentet er støpt. Hver aktivitet starter da ved prosjektstart, og sluttdatoen betyr ingenting. En **avhengighet** registrerer den rekkefølgen. Den første aktiviteten er **forgjengeren**, den andre **etterfølgeren**.

Du legger til avhengigheter når du bygger en tidsplan, når en aktivitet legges til, eller når to aktiviteter viser seg likevel å avhenge av hverandre. En **forsinkelse** er ventetid mellom to aktiviteter, for eksempel betong som må herde, eller en gulvavretning som må tørke.

Standardtypen er **FS** (slutt-til-start): etterfølgeren kan bare starte når forgjengeren er ferdig. Appen kjenner også SS, FF og SF, som knytter en start eller en slutt til en start eller en slutt. Med SS (start-til-start) kan for eksempel pussarbeidet først starte når de tekniske installasjonene har startet.

Usikker på hvilken type du trenger? Under typevalget forklarer en setning med de virkelige aktivitetsnavnene det, for eksempel *Metselwerk kan først starte når Fundering er ferdig.* Velger du en annen type, endrer setningen seg. Du ser den i vinduet *Type avhengighet*, i blokken *Avhengigheter* og i kolonnen *Forgjengere* eller *Etterfølgere*.

## Stegene

Det finnes fire måter å legge til en avhengighet på. De lager den samme avhengigheten. Velg den som passer best for situasjonen din.

### Koble to valgte aktiviteter

Nyttig når du arbeider i aktivitetstabellen.

1. Klikk i aktivitetstabellen på aktiviteten som kommer først: forgjengeren.
2. Hold Ctrl (⌘ på Mac) nede og klikk på aktiviteten som kommer etter: etterfølgeren.
3. Velg *Hjem › Aktiviteter › Koble ▾ › Koble valgte aktiviteter*. Den samme knappen finnes også under *Tidsplan › Avhengigheter*.

Appen lager en slutt-til-start-avhengighet uten forsinkelse. Du ser den som en pil i Gantt og i kolonnen *Forgjengere*; en melding vises bare hvis appen avviser avhengigheten. Knappen virker bare med nøyaktig to valgte aktiviteter.

### Tegne en avhengighet i Gantt-diagrammet

Nyttig når du legger til mange avhengigheter etter hverandre.

1. Velg *Hjem › Aktiviteter › Koble ▾ › Tegn avhengighet*. Over tidsplanen vises meldingen *Koblingsmodus: dra fra én stolpe til en annen i Gantt for å koble dem med en avhengighet. Trykk Esc for å stoppe.*
2. Trykk på stolpen til forgjengeren og dra til stolpen til etterfølgeren. En stiplet linje med en pil følger deg.
3. Slipp museknappen. Et lite vindu *Type avhengighet* vises, med typen (FS som standard) og en boks for forsinkelsen.
4. Endre typen eller forsinkelsen om nødvendig, og trykk Enter, eller klikk utenfor vinduet. Avhengigheten er opprettet.
5. Legg til den neste med en gang: modusen blir på. Du stopper med Esc, med knappen *Stopp* i meldingen, eller ved å velge *Tegn avhengighet* igjen.

Trykker du Esc i vinduet *Type avhengighet*, lagres ingenting. For én enkelt avhengighet trenger du ikke slå på modusen: hold Shift nede mens du drar fra stolpe til stolpe. *Start avhengighet herfra* i høyreklikkmenyen til en stolpe slår på koblingsmodus; du må fortsatt dra selv. På fanen *Tabell*, uten Gantt, er *Tegn avhengighet* deaktivert.

### Legge til en avhengighet i egenskapspanelet

Nyttig når du ser på én aktivitet og vil legge til forgjengerne eller etterfølgerne.

1. Velg aktiviteten. Panelet *Egenskaper* ligger til høyre. Ser du det ikke, slå det på med *Visning › Paneler › Egenskaper*.
2. I blokken *Avhengigheter*, klikk på *Legg til avhengighet*.
3. La retningen stå på *Forgjenger* hvis den andre aktiviteten kommer først, eller velg *Etterfølger*.
4. Skriv en del av navnet på den andre aktiviteten. Velg den rette med piltastene og Enter, eller klikk på den.
5. Velg typen (FS som standard) og fyll inn en forsinkelse om nødvendig.
6. Trykk Enter, eller klikk på haken (*Lagre avhengighet*).

Avhengighetene til aktiviteten vises da i *Avhengigheter*, hver med WBS-nummeret til den andre aktiviteten, typen og forsinkelsen.

### Skrive avhengigheter i kolonnen Forgjengere

Nyttig når du arbeider raskt med tastaturet og kjenner WBS-nummerene.

1. Klikk på **+** til høyre i overskriften i aktivitetstabellen (*Legg til kolonne*), og velg under *Avhengigheter* kolonnen *Forgjengere*. Kolonnen *Etterfølgere* fungerer på samme måte.
2. Klikk i cellen til etterfølgeren i kolonnen *Forgjengere*.
3. Skriv WBS-nummeret til forgjengeren, et mellomrom og typen, for eksempel `2.6 FS`. Skriv forsinkelsen rett etter: `2.6 FS+1d`. Skill flere forgjengere med semikolon eller komma: `3.1 FS; 3.2 SS+2d`.
4. Trykk Enter.

Det du skriver erstatter hele cellen. Finnes det allerede forgjengere i cellen, skriv dem også (se fallgruvene). Trykker du Enter eller F2 i cellen i stedet for å skrive, åpnes et felt som beholder de eksisterende avhengighetene: du søker etter en aktivitet med WBS-nummer eller navn, og velger typen og forsinkelsen for hver avhengighet.

### Sette eller endre en forsinkelse

Du skriver en forsinkelse i boksen ved siden av typen, på hver av måtene over. Du endrer en eksisterende forsinkelse i *Avhengigheter*: klikk i forsinkelsesboksen, skriv den nye verdien og trykk Enter.

- `3` eller `3d`: 3 arbeidsdager. Helgen telles ikke med. Appen viser `+3d`.
- `3ed`: 3 kalenderdager. Helgen telles med, slik som for betong som også herder lørdag og søndag.
- `-1`: en negativ forsinkelse (ledetid). Etterfølgeren kan starte én dag tidligere, så aktivitetene overlapper.
- `4h`: 4 arbeidstimer; appen viser det som `+4h`. Hvis forgjengeren er en dagbasert aktivitet i en kalender uten egne tidsbånd, for eksempel standardkalenderen, gjør appen dette om til hele arbeidsdager, avrundet til nærmeste hele dag: `4h` virker dermed som 1 dag, `2h` som 0. I en kalender med egne tidsbånd, eller etter en timebasert aktivitet, telles forsinkelsen nøyaktig i timer.
- `50%`: halvparten av forgjengerens varighet.

Eksempel: fundamentbetongen må herde før murer kan arbeide på den, så *Pour foundation → Foundation brickwork* får en FS-avhengighet med forsinkelse `3`. Hvis støpingen er fredag 18. juni 2027, starter murverket etter **Beregn** torsdag 24. juni: mandag til onsdag er ventetid. Med `3ed` telles helgen med, og murverket starter tirsdag 22. juni.

### Til slutt: omberegn

En ny avhengighet flytter ingen stolper ennå. Statuslinjen viser *Utdatert — omberegn (F5)*. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*. Først da får etterfølgerne nye datoer. Vil du at appen gjør dette for deg, slå på *Beregne automatisk* under *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Tidsplan*.

## Fallgruver og hva appen gjør

**Omvendt rekkefølge.** Med *Koble valgte aktiviteter* teller rekkefølgen du klikker i, ikke rekkefølgen i listen. Klikker du først på den senere aktiviteten, blir avhengigheten feil vei. Slett den i *Avhengigheter* med søppelbøtteikonet, og legg den til igjen.

**Skriving i kolonnen fjerner det som sto der.** Inneholder cellen `3.4 FS; 3.2 FS`, og skriver du bare `3.2 FS`, er avhengigheten med 3.4 borte, uten melding. Skriv alle forgjengere, bruk Enter eller F2 for å legge til, eller angre med Ctrl+Z.

**En syklus.** Legger du til en avhengighet som fører tilbake til en aktivitet tidligere i kjeden, kan tidsplanen aldri starte. Appen avviser en slik avhengighet: *Denne avhengigheten ville skape en syklus i tidsplanen (…) og er ikke opprettet*, med aktivitetene i syklusen i parentes. Slett først avhengigheten som lukker syklusen.

**En aktivitet og sin egen hovedaktivitet.** En avhengighet mellom en aktivitet og hovedaktiviteten den ligger under, er ikke mulig. Appen melder *En avhengighet mellom en aktivitet og dens egen overordnede hovedaktivitet er ikke tillatt.*

**Dublett.** Finnes avhengigheten allerede, melder appen *Denne avhengigheten finnes allerede*, og ingenting endres.

**Kortere meldinger i kolonnen.** Kolonnen *Forgjengere* gir de samme avvisningene, med en kortere tekst under cellen: *Denne endringen ville skape en syklus i tidsplanen.*, *Denne avhengigheten finnes allerede.* eller *En aktivitet kan ikke ha en avhengighet til sin egen hovedaktivitet.* Skriver du bare et WBS-nummer, som `3.1`, mangler typen, og cellen melder *Bruk for eksempel 1.2 FS+2d.* Cellen forblir åpen. Rett det du skrev, eller trykk Esc for å avbryte.

**Ingen halve dager i forsinkelse.** En forsinkelse i dager er alltid et heltall: `1.5` blir `+2d`. En timeforsinkelse etter en dagbasert aktivitet i en kalender uten egne tidsbånd, avrundes til hele arbeidsdager. Inndata som ikke kan leses, for eksempel et ord, lagres ikke: boksen settes til forrige verdi.

## Se også

- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva appen beregner fra avhengighetene dine, og hvorfor en aktivitet blir kritisk.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): hva de fire typene avhengighet og en forsinkelse gjør med datoene.
- [Spore en kjede](docs://howto-pad-traceren): få kjeden av forgjengere og etterfølgere synlig.
- [Aktivitetsdialogen og egenskapspanelet](docs://ref-taak-eigenschappen): feltene for avhengigheter og forsinkelse i panelet og dialogen.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): en kjede av slutt-til-start-avhengigheter med én start-til-start (vegger og tak, forsinkelse på 2 dager) og én slutt-til-slutt (fliselegging og maling, forsinkelse på 1 dag).
