# Kritisk linje og slakk

Hvorfor er prosjektslutten din slik den er? Og hvilken aktivitet kan bli en dag forsinket uten at overleveringen flyttes? Disse spørsmålene handler om den kritiske linjen. Denne artikkelen forklarer nøyaktig hva appen beregner, med et gjennomregnet eksempel.

## Begrepet

En tidsplan er et nettverk av aktiviteter som er knyttet sammen med **avhengigheter**: avtaler som «vinduskarmene settes inn først når taket er lukket». Avhengighetene binder aktivitetene sammen. Noen kjeder av aktiviteter er lengre enn andre. Den lengste kjeden bestemmer hvor lang tid hele prosjektet tar.

Blir én aktivitet på den kritiske linjen en dag forsinket, flyttes overleveringen en dag. Det finnes ingen slakk i den.

Aktiviteter utenfor den kritiske linjen har plass. Den plassen kalles **slakk**. Murkaren som bygger den ytre hulmuren, kan starte to dager senere uten at noen merker det. Disse to dagene er aktivitetens slakk.

Kritisk betyr derfor ikke at en aktivitet er viktig. Det betyr bare at det ikke er tid å spare.

Beregningsmetoden heter **CPM** (Critical Path Method). Derfor kalles blokken med resultatene i panelet *Egenskaper* for *CPM-resultat*.

## Slik beregner appen

Appen omberegner ikke tidsplanen av seg selv. Beregningen starter med **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*. Hvis noe er endret siden forrige beregning, viser statuslinjen *Utdatert — omberegn (F5)*. Hvis *Beregne automatisk* er på (under *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Tidsplan*, overskriften *Beregning*), gjør appen dette selv.

En beregning går to ganger gjennom nettverket.

### Fremoverberegning

Appen starter ved prosjektstart og følger avhengighetene fra forgjenger til etterfølger. For hver aktivitet finner appen den tidligste dagen aktiviteten kan starte. Har en aktivitet flere forgjengere, venter den til den siste er ferdig. Slik får hver aktivitet sin **tidligste start** og **tidligste slutt**. Den største tidligste slutten av alle aktivitetene er prosjektslutten.

### Bakoverberegning

Deretter går appen bakover, fra prosjektslutten til starten. Nå finner appen for hver aktivitet den siste dagen aktiviteten må være ferdig, uten at prosjektslutten flyttes. Har en aktivitet flere etterfølgere, teller den som må starte først. Slik får aktiviteten **seneste start** og **seneste slutt**.

### Total og fri slakk

Forskjellen mellom en aktivitets seneste og tidligste datoer er **totalslakk**: antall arbeidsdager aktiviteten kan bli forsinket eller starte senere, før prosjektslutten flyttes. Appen teller i arbeidsdager i aktivitetens kalender. En helg eller en helligdag teller ikke.

**Fri slakk** er strengere. Det er plassen en aktivitet har før en av etterfølgerne må starte senere. Du kan bruke den plassen uten at en annen aktivitet merker det.

Totalslakk kan deles. Følger to ikke-kritiske aktiviteter etter hverandre, deler de den samme slakken. Bruker den første opp slakken, har den andre ingen igjen. Den første har da totalslakk, men ingen fri slakk. Den delen av totalslakken som ikke er fri, kalles **interfererende slakk**: bruker du den, flyttes også aktivitetene etter. Eksemplet under viser dette med tall.

### Negativ slakk

Slakk kan også bli negativ. Det skjer når en aktivitet har en tidsfrist, eller en begrensning som setter en seneste dato, og den datoen ligger før datoen appen beregner for aktiviteten. På papiret er aktiviteten allerede forsinket. Da blir aktiviteten, og kjeden som ligger foran den, kritiske.

### Når er en aktivitet kritisk?

Som standard er en aktivitet kritisk når totalslakken er 0 eller mindre. Dette kan du endre under *Innstillinger › Prosjekt › Prosjektinnstillinger*, i blokken *Beregningsprofil og beregningsalternativer*, ved *Beregningsalternativer for dette prosjektet*. Når du klikker på *Bruk*, omberegner appen tidsplanen med en gang. Alternativene hører til prosjektfilen, ikke til appen.

- **Kritisk definisjon** med *Totalslakk ≤ terskelverdi* og feltet *Terskelverdi (arbeidsdager)*. Terskelverdien er 0 som standard. Sett den for eksempel til 2 om du vil beskytte en buffer: alle aktiviteter med 2 arbeidsdager slakk eller mindre blir kritiske og røde. Hvis du velger *Lengste sti*, er en aktivitet kritisk når den ligger på den lengste kjeden til siste slutt. Slakken har da ingen betydning.
- **Flere slakkstier** nummererer kjedene etter slakken i kolonnen *Slakksti*. Sti 1 er den kritiske linjen. Se [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies).
- **Marker nesten kritisk** med egen *Terskelverdi*, som standard 2 arbeidsdager. En aktivitet med mer enn 0 og høyst så mye slakk får en gul stolpe. Da ser du hvilke aktiviteter som nesten ikke har slakk igjen, uten at de kalles kritiske.
- **Åpenende aktiviteter er kritiske**: en aktivitet uten etterfølger som ennå ikke er ferdig, regnes som kritisk. Nyttig som sikkerhetsnett mot glemte avhengigheter (se misforståelsene nedenfor).
- **Slakkberegning** bestemmer om totalslakk måles ved starten av aktiviteten, ved slutten, eller som den minste av de to. Nye prosjekter er satt til *Automatisk (standard)*. Hvis prosjektet bruker beregningsprofilen Primavera P6 og dette valget ikke er *Sluttslakk*, viser en oransje blokk i prosjektinnstillingene det. Knappen i blokken setter valget til *Sluttslakk*. For MS Project setter den samme knappen valget tilbake til *Automatisk (standard)*: med en statusdato beregner MS Project selv på den måten.

### Hvor du ser det

Kritiske aktiviteter har en rød stolpe i Gantt-diagrammet. Bak en ikke-kritisk stolpe ligger et grønt bånd opp til aktivitetens seneste slutt. Båndet viser slakken. Du slår båndet av eller på med *Visning › Grunnlinjer og fremdrift › Slakkbånd*.

For en valgt aktivitet viser panelet *Egenskaper* alt under *CPM-resultat*: tidligste og seneste start og slutt, totalslakk, fri slakk og interfererende slakk, og om aktiviteten ligger på den kritiske linjen. Slakken for alle aktiviteter står ved siden av hverandre i kolonnene under *Beregnet* (**+** til høyre i tabelloverskriften), for eksempel *Totalslakk*, *Fri slakk*, *Kritisk* og *Nesten kritisk*.

Statuslinjen nederst teller de kritiske aktivitetene, for eksempel *Kritisk linje: 21 aktiviteter, 45 arbeidsdager*.

## Gjennomregnet eksempel: House extension

Eksemplet er øvingsprosjektet *House extension* fra opplæringen, slik det ser ut når alle avhengigheter er på plass. I opplæring 2, «Avhengigheter og den kritiske linjen», bygger du det selv og kontrollerer tallene. Her leser du hvorfor tallene er som de er.

Tilbygget starter mandag 7. juni 2027. Etter beregningen er overleveringen fredag 6. august 2027, og statuslinjen viser *Kritisk linje: 21 aktiviteter, 45 arbeidsdager*. To aktiviteter er ikke kritiske: *Build outer cavity leaf* og *Painting*.

### To kjeder som møtes

Etter de bærende dekkene (*Lay hollow-core floor*, ferdig mandag 28. juni) deler arbeidet seg i to kjeder. Begge ender ved *Install window frames*:

- Innsiden: *Build inner cavity leaf* (5 arbeidsdager), deretter *Place roof elements* (1), deretter *Apply roofing* (2). Vindusrammene kan bare settes inn når taket er lukket.
- Utsiden: *Build outer cavity leaf* (6 arbeidsdager). Rammene sitter i fasaden, så den må også være ferdig.

**Framover.** Begge hulmurene kan starte tirsdag 29. juni. Den indre hulmuren er ferdig mandag 5. juli. Takelementene settes på tirsdag 6. juli, og takleggingen følger onsdag 7. og torsdag 8. juli. Den ytre hulmuren er ferdig tirsdag 6. juli. *Install window frames* venter på den siste av de to kjedene, takleggingen, og starter derfor fredag 9. juli.

**Bakover.** Rammene må starte senest fredag 9. juli, ellers flytter overleveringen. Den ytre hulmuren må derfor være ferdig senest torsdag 8. juli. Seks arbeidsdager tilbake gir en seneste start torsdag 1. juli.

**Slakk.** Den ytre hulmuren kan tidligst starte 29. juni og må starte senest 1. juli. Mellom disse datoene ligger 2 arbeidsdager: onsdag 30. juni og torsdag 1. juli. Det er totalslakken. Panelet viser *Totalslakk: 2 dager* og *Kritisk linje: Nei*. Den frie slakken er også 2 dager, fordi den eneste etterfølgeren, *Install window frames*, ligger på den kritiske linjen.

Den indre kjeden har ingen slakk. Hver dag den blir forsinket, flytter rammene og alt etter dem.

### Painting

*Painting* (3 arbeidsdager) starter etter pussarbeidet, mandag 26. juli, og er ferdig onsdag 28. juli. Neste aktivitet, *Snagging and cleaning*, venter også på flisleggingen. Den er først ferdig torsdag 5. august, fordi gulvavretningen må tørke i fem arbeidsdager først. Så *Painting* kan altså fortsette til torsdag 5. august. Det gir 6 arbeidsdager slakk: 29. og 30. juli, og 2. til 5. august. Også her er den frie slakken lik totalslakken, fordi etterfølgeren er kritisk.

### Når den ytre hulmuren blir forsinket

Tar den ytre hulmuren 8 arbeidsdager i stedet for 6, er den ferdig torsdag 8. juli: akkurat den seneste slutten. Slakken er borte, og aktiviteten blir rød. Da er begge kjedene kritiske, og statuslinjen teller 22 kritiske aktiviteter. Overleveringen er fortsatt fredag 6. august.

Tar den 9 arbeidsdager, er den ytre hulmuren først ferdig fredag 9. juli. Rammene flytter til mandag 12. juli, og overleveringen til mandag 9. august: én arbeidsdag senere. Den ytre kjeden er nå den kritiske linjen, og statuslinjen viser *Kritisk linje: 19 aktiviteter, 46 arbeidsdager*.

Den indre kjeden har da 1 arbeidsdag totalslakk, men den dagen deles:

- *Build inner cavity leaf*: totalslakk 1, fri slakk 0, interfererende slakk 1. Blir den indre hulmuren en dag forsinket, flytter takelementene med.
- *Place roof elements*: totalslakk 1, fri slakk 0, interfererende slakk 1.
- *Apply roofing*: totalslakk 1, fri slakk 1. Bare her gjør det ingen skade om den blir forsinket en dag.

Det er den samme ene dagen, delt av hele kjeden. Bruker den indre hulmuren den, er den borte for takelementene og takleggingen.

### Nesten kritisk og negativ slakk

Med *Marker nesten kritisk* på ved standardterskelverdien på 2 arbeidsdager, får den ytre hulmuren, med nøyaktig 2 dager slakk, en gul stolpe. *Painting* med 6 dager forblir blå.

Får overleveringen en tidsfrist onsdag 4. august, to arbeidsdager før den beregnede overleveringen, blir slakken negativ. Alle 21 aktiviteter på den kritiske linjen får en totalslakk på −2 arbeidsdager. Den ytre hulmuren har ingen slakk igjen og blir også kritisk. *Painting* beholder 4 arbeidsdager.

## Konsekvenser og misforståelser

**«Kritisk betyr viktig.»** Nei. En kontroll kan være avgjørende og likevel ha slakk. Omvendt kan en enkel jobb være kritisk: i eksemplet ligger *Snagging and cleaning* på den kritiske linjen. Kritisk handler bare om tid: det finnes ingen slakk igjen.

**«Denne aktiviteten har slakk, så den kan vente.»** Se først på den frie slakken. Har en aktivitet totalslakk, men ingen fri slakk, tar hver dag den blir forsinket, slakk fra aktivitetene etter den. Det samme skjer med den indre hulmuren i tilfellet med 9 arbeidsdager.

**En glemt avhengighet gir falsk slakk.** En aktivitet uten etterfølger får slakk helt til slutten av prosjektet. Hvis eksemplet manglet avhengigheten fra den ytre hulmuren til rammene, ville den ytre hulmuren plutselig ha 23 arbeidsdager slakk, helt til overleveringen 6. august. På papiret kunne den da bli flere uker forsinket uten at rammene venter. Med *Åpne-ende aktiviteter er kritiske* på, blir den ytre hulmuren kritisk i det tilfellet, og hullet blir synlig.

**Den kritiske linjen er ikke fast.** Blir en ikke-kritisk aktivitet forsinket mer enn slakken sin, blir en annen kjede den lengste. Du så det over med 9 arbeidsdager murarbeid. Derfor må tidsplanen omberegnes etter hver endring. Så lenge statuslinjen viser *Utdatert*, hører de røde stolpene fortsatt til forrige beregning.

**Slakk telles i arbeidsdager.** Slakken til *Painting*, 6 arbeidsdager, går fra torsdag 29. juli til torsdag 5. august: åtte dager i almanakken, fordi helgen ikke teller. En helligdag eller byggferie i kalenderen teller heller ikke.

## Se også

- [Legge til avhengigheter](docs://howto-relaties-leggen): stegene for å koble aktiviteter og sette en forsinkelse.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): hvordan avhengigheter og forsinkelse bestemmer de tidligste datoene.
- [Begrensninger og tidsfrister](docs://uitleg-constraints): hvordan en begrensning eller tidsfrist gir negativ slakk.
- [Spore en kjede](docs://howto-pad-traceren): følge kjeden bak en aktivitet.
- [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): den kritiske definisjonen, nesten kritisk og slakkberegningen, alternativ for alternativ.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): et stort prosjekt med flere slakkstier, nesten kritiske aktiviteter (terskelverdi 3 arbeidsdager), en hengekøye, en hard fastlåsing og en kobling mellom prosjekter.
