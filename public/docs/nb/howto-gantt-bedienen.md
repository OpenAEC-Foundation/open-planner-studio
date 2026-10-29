# Dra, forskyve og zoome i Gantt-diagrammet

Mål: bruke tidslinjen med musen: flytte en stolpe eller justere varigheten, forskyve tidslinjen, velge aktiviteter med en boks og zoome inn og ut.

## Når du trenger dette

Du ser i Gantt-diagrammet at murverket må starte to dager senere, eller at støpingen tar en dag lenger, og du vil gjøre det direkte på stolpen. Eller du har et prosjekt på flere måneder og vil raskt rulle til byggebransjens helligdag. Musen har noen få handlinger for det. Hvilken handling som gjør hva, avhenger av hvor du starter å dra, og av rulleinnstillingen din.

## Trinn

### Flytte en stolpe

1. Trykk på midten av en aktivitetsstolpe og dra vannrett. Start og slutt flyttes sammen, i hele dager. Varigheten forblir den samme.
2. Slipp. Stolpen blir stående på det nye stedet. Tidsplanen er da ikke lenger oppdatert: trykk *Beregn* (F5), eller la appen gjøre det selv hvis *Beregne automatisk* er på.

Hvis aktiviteten har en forgjenger, registrerer appen den nye starten som begrensningen *Start ikke tidligere enn (SNET)*, og den sier det etter at du har sluppet. Hvorfor det er slik, og hva som skjer med en annen begrensning, står i [Begrensninger og tidsfrister](docs://uitleg-constraints). Drar du tilbake til den opprinnelige starten, kommer den opprinnelige begrensningen også tilbake.

Drar du mest opp eller ned i stedet for til siden, flytter du aktiviteten til en annen rad, og datoene blir de samme. Retningen du velger i de første pikslene, gjelder for hele draget. Dermed endrer én handling aldri datoer og struktur samtidig. Se [Justere strukturen](docs://howto-structuur-aanpassen).

### Justere varigheten

1. Flytt musen til høyre kant av stolpen. Pekeren blir en pil som peker til venstre og høyre.
2. Dra kanten. Mens du drar, viser en liten etikett i temaets aksentfarge (oransje som standard) varigheten aktiviteten får nå, for eksempel *4d*. Den følger med, så du ser den nye varigheten før du slipper. Ved høyre kant står etiketten inni stolpen, ved venstre kant rett til venstre for den. Etiketten viser varigheten på samme måte som varighetskolonnen viser den.
3. Slipp. Varigheten er den som etiketten viste.

Venstre kant flytter starten og lar slutten stå, så aktiviteten blir kortere eller lengre foran. Den samme SNET-regelen gjelder som ved flytting. Drar du midten av stolpen, vises ikke etiketten: varigheten endres ikke.

Varigheten teller arbeidsdager i kalenderen til aktiviteten. Helger og fridager teller ikke, og en aktivitet i dager kan ikke bli kortere enn én arbeidsdag. For en aktivitet i timer runder appen av til trinnet på tidslinjen under musepekeren: minst én time, eller et kvarter hvis du zoomer langt nok inn og *Vis kvarter når du zoomer mye inn* er på.

Ett dra er ett trinn i *Angre*, uansett hvor lenge du drar. På en stolpe for en delt aktivitet virker kantene annerledes; se [Dele en aktivitet](docs://howto-taak-splitsen).

### Forskyve tidslinjen

Hva et dra på tom bakgrunn gjør, avhenger av rullemodusen din. Du velger den i *Appinnstillinger*, fanen *Utseende*, under *Gantt › Rulling og zoom* ved *Modus*:

- **Zoom + dra** (standard): Drar du på tom bakgrunn med venstre museknapp, beveger tidslinjen seg med musen, som på et kart. Pekeren er en hånd. På en stolpe starter et dra bare en handling på stolpen.
- **Posisjon** og **Taster**: Samme dra lager en markeringsboks. Du forskyver tidslinjen med rullehjulet (se [Appinnstillinger](docs://ref-instellingen)) eller med midtknappen.

**Midtknappen** (hjulet trykt ned) forskyver tidslinjen i alle moduser, også om du starter på en stolpe. Den virker ikke mens en annen handling pågår, for eksempel når du drar en stolpe.

### Velge aktiviteter med en boks

En boks velger alle aktiviteter i radene den berører. Bare høyden på boksen teller, ikke tidsaksen.

1. Start på tom bakgrunn. Med *Zoom + dra* holder du Ctrl (⌘ på Mac) nede mens du gjør det. Med *Posisjon* og *Taster* er det ikke nødvendig.
2. Dra over radene du vil velge. Markeringen får en ramme.
3. Slipp. Med Esc mens du drar avbryter du boksen, og markeringen blir værende som den var.

Mer om å velge er i [Velge, slette og angre aktiviteter](docs://howto-taken-selecteren-verwijderen). På tomt område i aktivitetstabellen selv skjer det ingenting når du drar.

### Zoome inn og ut

1. Bruk *Zoom +* og *Zoom -* (*Start › Zoom*), eller tastene + og -. Også rullehjulet zoomer; når det gjør det, avhenger av rullemodusen din (se [Appinnstillinger](docs://ref-instellingen)).
2. Vil du se hele prosjektet, velg *Visning › Tidsskala › Tilpass til prosjekt* eller trykk Ctrl+0. *Tilbakestill* (på fanen *Visning*) eller 0-tasten setter zoomen tilbake til standardzoomen.
3. Nederst til høyre i statuslinjen står zoomen i piksler per dag, for eksempel *Zoom: 15px/dag*.

Jo lenger du zoomer ut, jo færre rutelinjer er det. Ved 8 piksler per dag eller mer er det en linje for hver dag, med en tykkere linje ved skillet mellom ukene. Mellom 2 og 8 piksler per dag står bare skillet mellom ukene igjen. Under 2 piksler per dag, på årsnivå, er bare skillene mellom månedene igjen. Ellers ville lerretet bli et jevnt stripemønster der stolpene forsvinner. De grå helgene og fridagene, og ukebåndene som er farget annenhver gang, vises på alle nivåer; de viser ukestrukturen når linjene forsvinner. I tidslinjehodet vises ukenumrene og dagnumrene bare når det er plass til dem, og fra 40 piksler per dag vises også ukedagen før dagnummeret.

Aktivitetsnavnet vises i stolpen hvis det får plass helt. Får det ikke plass, for eksempel når du zoomer ut, vises hele navnet til høyre for stolpen.

### Se detaljene for en aktivitet

Hold musepekeren stille over en stolpe. Et lite kort vises med navnet på aktiviteten, *WBS*, *Varighet*, *Start*, *Slutt*, *Status*, *Kritisk* og *Totalslakk*. Under et dra, forskyving av tidslinjen, en markeringsboks eller en høyreklikkmeny er kortet borte.

## Fallgruver og hva appen gjør da

**Starten flyttes ikke.** Hvis aktiviteten har en forgjenger og en annen begrensning enn SNET, for eksempel *Så sent som mulig (ALAP)*, bruker appen ikke starten du dro til. Etter at du har sluppet, sier appen hvilken begrensning som holder starten tilbake. Endre den begrensningen for å flytte starten. Høyre kant virker, fordi den bare endrer varigheten.

**Handlingen gjør noe annet.** I avhengighetsmodus og i modus for delt aktivitet gjør handlinger på stolpen noe annet; Esc stopper disse modusene. Holder du Shift mens du drar fra en stolpe, lager du en avhengighet i stedet for å flytte en stolpe. Se [Legge til avhengigheter](docs://howto-relaties-leggen).

**I modus Posisjon eller Taster flyttes ikke tidslinjen med venstre museknapp.** Du ser da en vanlig peker i stedet for en hånd. Bruk rullehjulet eller midtknappen, eller sett modusen til *Zoom + dra*.

**Et klikk i en pause på en stolpe for en delt aktivitet** velger aktiviteten og starter ingen dra eller boks.

## Se også

- [Høyreklikkmenyer](docs://ref-contextmenus): menyene på en stolpe, en rad og en gruppeoverskrift.
- [Hurtigtaster](docs://ref-sneltoetsen): tastene for zoom og for å avbryte en handling.
- [Appinnstillinger](docs://ref-instellingen): rullemodusen og tidsaksen.
- [Begrensninger og tidsfrister](docs://uitleg-constraints): hvorfor en flyttet start blir en begrensning.
