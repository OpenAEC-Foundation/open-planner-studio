# Hurtigtaster

Her finner du alle tastekombinasjonene i appen, gruppert som i vinduet *Hurtigtaster*. Du kan ikke endre tastene. Bruk av musen og menyene står i veiledningene. Her slår du opp en tast.

## Slik leser du listen

**Mac.** Overalt der artikkelen sier Ctrl, bruker du Cmd (⌘) på en Mac. Alt er Option (⌥). På en Mac viser vinduet *Hurtigtaster* symbolene ⌥, ⇧ og ⌘ i stedet for Alt, Shift og Ctrl. Ctrl virker også i appen på en Mac.

**Nøyaktig kombinasjon.** Appen sammenligner Ctrl, Shift og Alt nøyaktig. Ctrl+Alt+S gjør derfor ingenting. Tastene må stemme helt med listen.

**Åpne vinduet.** Trykk Ctrl+/ eller velg *Innstillinger › Hurtigtaster › Hurtigtaster*. Ctrl+/ lukker også vinduet igjen. Vinduet er skrivebeskyttet. Det viser ikke alle tastene i denne listen. Av tabelltastene viser det bare de seks første, og ikke dialogtastene nederst i artikkelen.

**Når en tast ikke virker.** Hver oppføring sier hvilke begrensninger den har. Tre regler gjelder nesten overalt:

- I et inntastingsfelt, en rullegardinliste eller en tekstboks griper appen ikke inn på tastene, så du kan bare skrive. Unntak: F5, Ctrl+S, F11 og Esc under presentasjonen virker også i et felt. Har fokus en lukket rullegardinliste, virker også tastene med Ctrl, for eksempel Ctrl+Z etter et valg (ikke Ctrl+Delete og Ctrl+Backspace). Det gjelder ikke i en åpen liste eller i en dialog. I den ferdige appen (på skrivebordet og i nettversjonen på nettstedet) gjelder det også for Ctrl+Shift+S, Ctrl+O og Ctrl+N.
- Når en dialog eller et annet vindu er åpent, virker ikke tastene som er merket *Ikke i en dialog* nedenfor. Det gjelder også omvisningen, velkomstdialogen og spørsmål som venter på svar, for eksempel spørsmålet om du vil lagre endringene, og samtykket når du installerer en utvidelse. De fleste av disse tastene virker heller ikke i presentasjonsmodus. Unntak: redigeringstastene Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y og Delete/Backspace virker under presentasjonen.
- Bytte av dokument (Ctrl+1 til 9, Ctrl+N, Ctrl+O) virker heller ikke så lenge *Fil › Prosjektinnstillinger* har endringer som du ikke har bekreftet med *Bruk*. Forkast eller bruk dem først.

## Fil

**F5** — *Beregn*: omberegner tidsplanen, som knappen *Beregn* (*Hjem › Tidsplan › Beregn*). Virker også i et inntastingsfelt.

**Ctrl+S** — *Lagre*: lagrer prosjektet. Virker også i et inntastingsfelt.

**Ctrl+Shift+S** — *Lagre som*: spør hvor filen skal lagres. I en utviklingsversjon virker den ikke i et inntastingsfelt.

**Ctrl+O** — *Åpne*: åpner en fil, vanligvis i en ny fane. Ikke i en dialog og ikke med prosjektinnstillinger som ikke er brukt.

**Ctrl+N** — *Nytt prosjekt*: åpner vinduet *Nytt prosjekt*. Ikke i en dialog og ikke med prosjektinnstillinger som ikke er brukt.

Den ferdige appen (på skrivebordet og i nettversjonen på nettstedet) blokkerer også en del nettleserstaster, så de ikke står i veien: Ctrl+R og Ctrl+Shift+R (last inn på nytt), F12, Ctrl+Shift+I og Ctrl+Shift+J (utviklerverktøy), Ctrl+U (vis kilde) og Ctrl+G, Ctrl+F og Ctrl+L (søk og adressefelt). Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N og F5 går til selve appen.

## Rediger

**Ctrl+C** — *Kopier*: kopierer de markerte aktivitetene. Bare når du har markert aktiviteter. Ikke i en dialog. Ikke i *Fil*, ikke på fanene *Rapport* og *IFC* og ikke når det fulle ressurspanelet er åpent. I aktivitetstabellen kopierer Ctrl+C de markerte cellene. Aktivitetstabellen håndterer det selv.

**Ctrl+V** — *Lim inn*: limer inn kopierte aktiviteter. Ikke i en dialog. Ikke i *Fil*, ikke på fanene *Rapport* og *IFC* og ikke når det fulle ressurspanelet er åpent, fordi aktivitetstabellen ikke er synlig der. I aktivitetstabellen limes cellene inn.

**Ctrl+Z** — *Angre*. Ikke i en dialog: lukk vinduet først.

**Ctrl+Y** eller **Ctrl+Shift+Z** — *Gjør om*: gjentar det du angret. Ikke i en dialog.

**Delete** eller **Backspace** — *Slett*: sletter de markerte aktivitetene. Bare når du har markert aktiviteter. Ikke i en dialog. Ikke i *Fil*, ikke på fanene *Rapport* og *IFC* og ikke når det fulle ressurspanelet er åpent, fordi aktivitetstabellen ikke er synlig der. I en celle i aktivitetstabellen tømmer Delete og Backspace bare innholdet i cellen (se *Tabell*).

**F2** — *Rediger...*: åpner aktivitetsdialogen for den første markerte aktiviteten. Bare når du har markert aktiviteter. Ikke i en dialog. I en celle i aktivitetstabellen starter F2 redigering av cellen.

**Ctrl+A** — *Velg alle*: velger alle aktiviteter. Ikke i en dialog.

**Esc** — *Fjern markering*: fjerner markeringen og slår samtidig av avhengighetsmodus, modus for delt aktivitet og banesporing. Den lukker også aktivitetsdialogen og prosjektoversikten. Under presentasjonen lukker Esc bare presentasjonen (se *Visning*). I et inntastingsfelt gjør Esc ingen av disse tingene.

## Struktur

**Alt+Shift+→** eller **Alt+→** — *Rykk inn*: gjør de markerte aktivitetene ett nivå dypere i WBS. Bare når du har markert aktiviteter, ikke i en dialog.

**Alt+Shift+←** eller **Alt+←** — *Reduser innrykk*: flytter de markerte aktivitetene ett nivå opp. Bare når du har markert aktiviteter, ikke i en dialog.

Rykk inn og reduser innrykk, og innsetting over eller under en markert aktivitet, virker bare i den vanlige trevisningen: uten filter, gruppering eller sortering. I alle andre visninger avviser appen dem med en melding, fordi rekkefølgen som vises da ikke er prosjektets rekkefølge. Innsetting uten markering virker i alle visninger.

**Insert** — *Sett inn over*: setter inn en ny aktivitet over den øverste markerte aktiviteten, på samme nivå. Uten markering kommer aktiviteten nederst, i alle visninger. Ikke i en dialog.

**Ctrl+I** — *Sett inn under*: setter inn en ny aktivitet under den nederste markerte aktiviteten, på samme nivå. Uten markering kommer aktiviteten nederst. Ikke i en dialog.

**Ctrl+M** — *Legg til milepæl*: legger til en ny milepæl nederst i listen, også når du har markert en aktivitet. Ikke i en dialog.

**Alt+↑** — *Flytt aktivitet opp*: flytter den første markerte aktiviteten ett sted opp innenfor sitt nivå. Bare når du har markert aktiviteter, ikke i en dialog.

**Alt+↓** — *Flytt aktivitet ned*: det samme, ett sted ned.

## Visning

**F11** — *Presentasjon*: slår presentasjonsmodus av eller på. Appen ber også vinduet om fullskjerm. Virker også i et inntastingsfelt. I nettleseren starter ikke F11 presentasjonen: nettleseren setter vinduet i fullskjerm selv, og appen forblir som den er. F11 stopper likevel en pågående presentasjon i nettleseren.

**Esc** (under presentasjonen) — *Avslutt presentasjon*. Virker også i et inntastingsfelt. Dette går foran *Fjern markering*.

**Ctrl+=** — *Zoom inn*: zoomer tidslinjen inn med et fast trinn. Ikke i et inntastingsfelt.

**Ctrl+-** — *Zoom ut*: zoomer ut med et fast trinn.

**+** eller **=** — *Zoom inn*: zoomer inn med 10% rundt midten av Gantt-området. Ikke i et inntastingsfelt, og bare når Gantt-tidslinjen er synlig (altså ikke på fanene *Tabell*, *IFC* og *Rapport*).

**-** — *Zoom ut*: zoomer ut med 10%. Samme begrensninger.

**0** — *Tilbakestill zoom*: setter zoomen tilbake til standard og ruller til starten. Samme begrensninger.

**Ctrl+0** — *Tilpass til prosjekt*: zoomer slik at hele prosjektet får plass i visningen. Samme begrensninger.

**Ctrl+/** — *Vis hurtigtaster*: åpner og lukker vinduet *Hurtigtaster*. Virker også når en annen dialog er åpen, men ikke under omvisningen og velkomstdialogen.

**Ctrl+Shift+H** — *Histogram*: slår histogrammet av eller på, som knappen *Histogram* (*Ressurser › Histogram › Histogram* eller *Visning › Paneler › Histogram*). Appen husker valget ditt.

**Ctrl+Shift+L** — *Advarsler*: slår advarselspanelet av eller på, som knappen *Advarsler* (*Visning › Paneler › Advarsler* eller *Tidsplan › Tidsplan › Advarsler*).

## Navigasjon

**Ctrl+P** — *Gå til rapportfanen*: tar deg til fanen *Rapport*. Det er derfor ingen utskriftskommando. Ikke i en dialog.

**F1** — *Åpne hjelp*: åpner *Fil › Hjelp*. Ikke i et inntastingsfelt og ikke i en dialog. I et vindu bruker du spørsmålstegnet øverst til høyre: det åpner hjelpen om artikkelen om det vinduet (se [Båndet, fane for fane](docs://ref-lint), under *Hjelp*).

**Ctrl+1** til **Ctrl+9** — *Bytt dokument*: går til det første til det niende åpne dokumentet. Finnes ikke dokumentet, skjer ingenting. Ikke i en dialog og ikke med prosjektinnstillinger som ikke er brukt.

**Ctrl+Home** — *Gå til i dag*: ruller tidslinjen slik at en dato står helt til venstre i visningen. Det er statusdatoen hvis du har satt en, ellers i dag. Derfor sier etiketten «i dag», også når tidslinjen hopper til statusdatoen. Zoomen og starten av tidslinjen blir som de var. Har en celle i aktivitetstabellen fokus, går Ctrl+Home i stedet til den første cellen i tabellen (se *Tabell*).

## Tabell

Disse tastene virker i aktivitetstabellen (på fanen *Tabell* og i tabellen til venstre for Gantt) når en celle har fokus. Vinduet *Hurtigtaster* viser de seks første oppføringene. De andre står ikke der.

**Tab** og **Shift+Tab** — *Neste/forrige celle*: går til neste eller forrige celle, og ved slutten av en rad til neste rad. På den aller siste cellen (Tab) eller den aller første (Shift+Tab) forlater fokus tabellen.

**Enter** eller **F2** — *Rediger celle*: åpner redigeringsfeltet for cellen. Hvis cellen er skrivebeskyttet, viser tabellen en melding.

**En bokstav, et siffer eller et annet tegn** — *Skriving erstatter celleinnholdet*: starter redigering og erstatter innholdet med det du skriver.

**Insert** — *Sett inn over*: setter inn en aktivitet over den aktive raden.

**Delete** eller **Backspace** — *Tøm celleinnhold*: tømmer innholdet i de markerte cellene, ikke selve aktiviteten. Vinduet *Hurtigtaster* viser bare Delete.

**Esc** — *Fjern markering*: flytter fokus til tabellen som helhet, slik at neste Tab forlater tabellen. Den fjerner også markeringen, som beskrevet ovenfor.

**Piltaster** — går til cellen over, under, til venstre eller til høyre. Legg til Shift for å utvide markeringen.

**Home** og **End** — til første eller siste kolonne i raden. Med Ctrl til første celle i første rad og siste celle i siste rad. Legg til Shift for å utvide markeringen.

**Page Up** og **Page Down** — én skjermhøyde opp eller ned. Legg til Shift for å utvide markeringen.

**Enter** (under redigering) — bekrefter det du har skrevet og går til samme kolonne i neste rad. Shift+Enter går til forrige rad.

**Esc** (under redigering) — avbryter redigeringen uten å beholde det du har skrevet.

Ressurstabellen har sin egen tastehåndtering mellom inndatafeltene. Den står ikke i denne listen.

## Dialoger og andre vinduer

Disse tastene står ikke i vinduet *Hurtigtaster*.

**Esc** — lukker den øverste dialogen (avbryter). Også i *Fil* (Backstage) lukker Esc skjermbildet, med mindre en dialog eller en åpen rullegardinliste ligger øverst.

**Enter** — bekrefter den øverste dialogen, som hovedknappen, i dialoger som støtter det. Enter gjør ikke det i en tekstboks med flere linjer, i en åpen rullegardinliste eller under IME-inntasting.

**Esc** under en bevegelse i Gantt — avbryter en markeringsboks (markeringen blir som den var) og en delingsbevegelse (en deling som allerede er gjort, blir angret).

**Enter** og **Esc** i velgeren for avhengighetstype — Enter bekrefter, Esc avbryter.

**Venstrepil og høyrepil** på skillelinjen mellom aktivitetstabellen og tidslinjen — flytter skillelinjen 10 piksler om gangen, 40 med Shift. Skillelinjen må ha tastaturfokus.

**Opp- og nedpil** i ressurslisten i histogrammet — velg forrige eller neste ressurs. Histogramfeltet må ha fokus.

## Se også

- [Lage og skrive ut en rapport](docs://howto-rapport-maken-en-afdrukken): hvorfor Ctrl+P ikke åpner et utskriftsvindu.
- [Dele en aktivitet](docs://howto-taak-splitsen): delebevegelsen som Esc avbryter.
- [Presentere på en stor skjerm](docs://howto-presentatie): F11 og Esc i praksis.
- [Slå på automatisk lagring](docs://howto-automatisch-opslaan): lagring med Ctrl+S ved siden av automatisk lagring.
- [Dra, panorere og zoome i Gantt](docs://howto-gantt-bedienen): musebevegelsene ved siden av tastene.
