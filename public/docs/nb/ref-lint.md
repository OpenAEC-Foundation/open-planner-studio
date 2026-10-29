# Båndet, fane for fane

Båndet øverst på skjermen har faner, og hver fane har grupper med knapper. Denne artikkelen forklarer for hver knapp hva den gjør, og hvor du ser resultatet. Hvordan du gjør en jobb steg for steg, står i how-to-guidene; her slår du opp hva en knapp er. En knapp som bare finnes eller virker under en betingelse, har betingelsen like ved siden av.

## Slik virker båndet

- **Faner** — *Fil* står til venstre, deretter *Hjem*, *Tidsplan*, *Ressurser*, *Visning*, *Innstillinger*, *Tabell*, *IFC*, *Rapport* og, bare når AI-modus er på, *AI*.
- **Smalt vindu** — når båndet ikke får plass, krymper knappene til et ikon, fra høyre mot venstre. Navnet vises da som verktøytips på knappen. Hver knapp uten eget verktøytips viser navnet sitt.
- **Minimer båndet** — den lille pilen nederst til høyre på båndet gjør det om til en flat stripe med bare ikoner. Gruppene *Grunnlinjer og fremdrift* og *Tilkobling* på AI-fanen forsvinner da bak én knapp med en popup. Standard: utvidet. Valget ditt blir husket.
- **Knapper for utvidelser** — en utvidelse kan legge til sin egen gruppe på slutten av en fane. En slik knapp gjør det utvidelsen ga den.

## Fil

Når du klikker på *Fil*, tar et eget skjermbilde (Backstage) over arbeidsområdet. Det har ikke noe bånd. *Tilbake* lukker det. Hvis du har endret noe under *Prosjektinnstillinger* og ikke har klikket på *Bruk*, spør appen først hva du vil gjøre med det.

- **Nytt** — åpner vinduet *Nytt prosjekt* og lukker Backstage. Feltene finner du i [Nytt prosjekt og Prosjektinnstillinger](docs://ref-projectinfo).
- **Åpne** — velger en fil og åpner den som et dokument. Lukker Backstage.
- **Nylig** — en liste over nylig åpnede prosjekter; ett klikk åpner ett av dem. Vises bare når miljøet kan åpne filer på nytt: i skrivebordsappen og i nettlesere som tilbyr filtilgang, for eksempel Chrome og Edge. I andre nettlesere finnes knappen, men siden forblir tom.
- **Eksempler** — medfølgende eksempeltidsplaner, delt i *Fullstendige showcase-tidsplaner* (merke *Alle funksjoner*) og *Enkle eksempler*. Ett klikk åpner én i en ny fane.
- **Lagre** — skriver prosjektet til filen til dette dokumentet. Har dokumentet ingen fil ennå, velger du først et navn og en plassering. En fil du åpnet i et annet format enn IFC, blir aldri overskrevet; da spør *Lagre* etter et navn og en plassering for en IFC-fil.
- **Lagre som** — velger et nytt navn eller en ny plassering og lagrer der som IFC.
- **Eksporter** — ett kort per eksportformat, med en beskrivelse. Ett klikk konverterer prosjektet og lagrer det, og tar deg tilbake til *Hjem*. Har tidsplanen en syklus, vises feilen i Backstage, og du blir der. Er prosjektet koblet til et bibliotek med ressurser, vises avkrysningsboksen *Lagre bibliotekfilen ved siden av* under; den virker bare for IFC-kortet.
- **Importer** — øverst kortet *Oppdater fremdrift fra et regneark* (deaktivert uten aktiviteter), under de importfunksjonene som utvidelser legger til.
- **Skriv ut** — knappen *Åpne forhåndsvisning* tar deg til fanen *Rapport*.
- **Prosjektinnstillinger** — metadataene og beregningsprofilen for dette prosjektet. Endringer virker først etter *Bruk*. Se [Nytt prosjekt og Prosjektinnstillinger](docs://ref-projectinfo) og [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen).
- **Appinnstillinger** — de samme innstillingene som i vinduet *Appinnstillinger*.
- **Utvidelser** — administrasjon og installasjon av utvidelser; se [Installere og administrere en utvidelse](docs://howto-extensie-installeren).
- **Bibliotek** — administrasjon av bibliotek med ressurser; se [Administrere og dele bibliotek med ressurser](docs://howto-bibliotheken-beheren).
- **Hjelp** — den innebygde dokumentasjonen, også med F1. Søkefeltet søker i titler, overskrifter og selve teksten. Artiklene er i fire deler: *Opplæring*, *How-to-guider*, *Forklaring* og *Referanse*. Under *Dokumentasjonsspråk* velger du *Følg appspråket* eller et språk fra listen. Nederlandsk og engelsk er kildespråkene; de andre språkene har artiklene som er oversatt så langt. Mangler en artikkel på ditt språk, leser du den engelske versjonen, med en melding. Valget lagres på denne enheten, separat fra appens språk. Du kan også nå Hjelp fra et vindu eller et panel: mange vinduer og panelene *Egenskaper*, *Ressurser* og *Advarsler* har et spørsmålstegn øverst til høyre (*Hjelp om dette emnet*), som åpner Hjelp om artikkelen om vinduet eller panelet. Har du skrevet noe i vinduet som ikke er lagret ennå, spør appen først *Lagre*, *Avbryt* (forkast det du skrev) eller *Tilbake* (bli i vinduet). Deretter lukkes vinduet og Hjelp åpnes. Noen få vinduer, for eksempel *Rediger aktivitet* og *Utjevning av ressurser*, spør alltid. Uten endringer åpnes Hjelp med en gang.
- **Start rundvisning** — lukker Backstage og starter rundvisningen ved steg 1.
- **Lukk prosjekt** — lukker det aktive dokumentet. Har det ulagrede endringer, ber appen om bekreftelse.

## Hjem

### Hjem › Fil

- **Nytt**, **Lagre**, **Åpne** og **Lagre som** — de samme handlingene som i *Fil*.
- **Nylig** — rullegardinmeny med de nylige prosjektene; ett klikk åpner ett av dem. Vises bare under samme betingelse som *Fil › Nylig*. Uten nylige filer står det *Ingen nylige filer*.
- **Eksporter** — rullegardinmeny med eksportformatene (korte navn). Ett klikk konverterer prosjektet og lagrer det.

### Hjem › Rediger

- **Angre** — angrer den siste endringen. Deaktivert når det ikke er noe å angre.
- **Gjør om** — gjenoppretter den siste angrede endringen. Deaktivert når det ikke er noe å gjøre om.
- **Slett** — sletter de valgte aktivitetene, sammen med delaktivitetene deres, i ett trinn. Deaktivert uten valg.

### Hjem › Aktiviteter

- **Aktivitet** — legger til en aktivitet som heter *Ny aktivitet*, med en varighet på 5 arbeidsdager, og som starter ved prosjektstarten. (Er *Slå på timeplanlegging* på, og er *Standardenhet for nye aktiviteter* i *Prosjektinnstillinger* timer, er varigheten 5 timer.) Er en aktivitet valgt og visningen er det enkle treet, havner den nye rett under den nederste valgte aktiviteten (verktøytips *Ny aktivitet rett under valget*). Uten valg legges den nederst (verktøytips *Ny aktivitet nederst i listen*). Med et valg, men mens du filtrerer, grupperer eller sorterer, legges den også nederst. En rød melding sier da at appen ikke kan plassere den under valget, med knappen *Tøm*. Den nye aktiviteten blir det eneste valget, Gantt-diagrammet hopper til den, og navnet er klart til å overskrives i panelet *Egenskaper*.
- **Milepæl ▾** — rullegardinmeny som legger en milepæl (varighet 0) på samme sted som *Aktivitet*. *Startmilepæl* og *Sluttmilepæl* velger typen milepæl. Den nye milepælen heter *Ny milepæl* og får arbeidskategorien *Annet*. *Inspeksjonsmoment (påkrevd)* lager en sluttmilepæl med arbeidskategorien *Kontroll/inspeksjon* og flagget *Obligatorisk (kontraktuelt)*, og den heter *Nytt inspeksjonspunkt*.
- **Koble ▾** — rullegardinmeny med fire faste handlinger; hovedknappen endrer aldri betydning. Se *Tidsplan › Avhengigheter* for de fire handlingene.
- **Del aktivitet** — slår modus for delte aktiviteter av eller på. På: en stripe under båndet forklarer at du klikker på en stolpe der bruddet begynner, og drar til høyre for å angi lengden. Deaktivert når Gantt-diagrammet ikke vises (på fanene *Tabell*, *IFC* og *Rapport*, og under det fulle ressurspanelet); verktøytipset sier da *Bare tilgjengelig når Gantt-diagrammet vises*. Se [Dele en aktivitet](docs://howto-taak-splitsen).

### Hjem › Tidsplan

- **Beregn** — beregner tidsplanen: datoer, slakk, kritisk linje og ressursbelastning. Dette skjer aldri av seg selv, med mindre du slår på *Beregne automatisk* (*Appinnstillinger*, fanen *Tidsplan*, overskriften *Beregning*). Så lenge tidsplanen er utdatert, viser statuslinjen *Utdatert — omberegn (F5)*.

### Hjem › Zoom

- **Zoom +** — zoomer tidsaksen inn med 10 piksler per dag.
- **Zoom -** — zoomer tidsaksen ut med 10 piksler per dag.

## Tidsplan

### Tidsplan › Tidsplan

Knappen *Beregn* er den samme som på *Hjem*.

- **Flytt prosjekt…** — åpner vinduet *Flytt prosjekt*. Deaktivert uten prosjektstart. Se [Flytte et prosjekt](docs://howto-project-verplaatsen).
- **Advarsler** — viser eller skjuler panelet *Advarsler* i kolonnen til høyre. Knappen lyser opp mens du ser panelet. Slår du den på, utvides en sammenfoldet kolonne. Hva som ligger i den, er beskrevet i [Meldinger og advarsler](docs://ref-meldingen).

### Tidsplan › Avhengigheter

Gruppen har knappen *Koble ▾* med fire handlinger og knappen *Del aktivitet* (samme som på *Hjem*). De fire handlingene:

- **Tegn avhengighet** — slår koblingsmodus av eller på; en hake vises når den er på, og hovedknappen lyser opp. På: du drar fra én stolpe til en annen i Gantt-diagrammet for å lage en avhengighet, og en stripe under båndet sier hvordan du stopper (*Stopp* eller Esc). Deaktivert når Gantt-diagrammet ikke vises.
- **Koble valgte aktiviteter** — lager en slutt-til-start-avhengighet uten forsinkelse mellom to aktiviteter; den som er valgt først, blir forgjengeren. Bare tilgjengelig med nøyaktig to aktiviteter valgt (ellers *Velg nøyaktig to aktiviteter*). En avhengighet som finnes fra før, eller en syklus, blir avvist med en melding.
- **Legg til kobling mellom prosjekter…** — åpner et vindu for å legge til en forgjenger eller etterfølger fra et annet prosjekt til den valgte aktiviteten. Bare tilgjengelig med nøyaktig én aktivitet valgt (ellers *Velg nøyaktig én aktivitet*).
- **Oppdater alle koblinger mellom prosjekter** — oppdaterer ankrene for alle koblinger mellom prosjekter og viser i menyen hvor mange som ble oppdatert eller mangler. Bare tilgjengelig når prosjektet har koblinger mellom prosjekter (ellers *Dette prosjektet har ingen koblinger mellom prosjekter*).

Om bakgrunnen for avhengigheter, se [Lage avhengigheter](docs://howto-relaties-leggen) og [Avhengigheter og forsinkelse](docs://uitleg-relaties).

### Tidsplan › Banesporing

- **Forgjengere** — markerer i Gantt-diagrammet forgjengerne til de valgte aktivitetene, kjede for kjede.
- **Etterfølgere** — markerer etterfølgerne til de valgte aktivitetene.

Du kan ha begge på samtidig; ett nytt klikk på en knapp slår den siden av igjen. Styrende avhengigheter får en sterkere fargetone. Se [Spore en bane](docs://howto-pad-traceren).

### Tidsplan › Kalender

- **Kalender** — åpner vinduet *Kalendere* med prosjektets kalenderbibliotek. Se [Kalendervinduer](docs://ref-kalenders).

### Tidsplan › Struktur

- **Koder og felt** — åpner vinduet *Koder og felt* for aktivitetskoder og egendefinerte felt. Se [Koder og egendefinerte felt](docs://howto-codes-en-velden).
- **WBS auto** — slår automatisk nummerering av WBS-kodene av eller på. Standard: på i et nytt prosjekt. I en åpnet fil uten denne innstillingen: på hvis filen er tom, eller hvis alle koder allerede stemmer med nummereringen i treet; ellers av. På: hele treet nummereres om på én gang, kodene følger deretter hver strukturendring, og feltet *WBS-kode* i panelet og i dialogen er deaktivert.
- **Nummerer WBS på nytt** — nummererer WBS-kodene én gang, etter posisjonen i treet (1.2.3). Deaktivert mens *WBS auto* er på.
- **Maler** — rullegardinmeny med lagrede WBS-maler, hver med antall aktiviteter og avhengigheter. Ett klikk setter malen inn under den valgte aktiviteten, eller på øverste nivå uten valg. Søppelbøtte-ikonet sletter en mal. Uten maler står det hvordan du lagrer en (høyreklikk på en hovedaktivitet, *Lagre gren som mal*). Se [Lagre og sette inn WBS-maler](docs://howto-wbs-sjablonen).
- **Rykk inn** — gjør de valgte aktivitetene til delaktiviteter av aktiviteten foran dem. Deaktivert uten valg, og så snart du filtrerer, grupperer eller sorterer. Verktøytipset sier da *Ikke tilgjengelig under filtrering/gruppering/sortering*.
- **Reduser innrykk** — flytter de valgte aktivitetene ett nivå opp, rett etter den nåværende overordnede aktiviteten. Samme betingelser som *Rykk inn*.

### Tidsplan › Grunnlinjer og fremdrift

- **Administrer grunnlinjer…** — åpner vinduet for grunnlinjer. Se [Lagre og administrere en grunnlinje](docs://howto-baseline-opslaan-en-beheren).
- **Statusdato** — datoen fremdriften måles til. Skriv inn en dato; krysset (*Tøm statusdato*) fjerner den. Har kalenderen for prosjektet tidsbånd, beregner appen i timer, og et tidsfelt vises ved siden av datoen (MS Project lagrer ofte 17:00). Klokkeslettet teller da: 12:00 i stedet for 17:00 gir en halv dag med annet gjenstående arbeid. Uten tidsbånd beregner appen i hele dager, og det finnes ikke noe tidsfelt. Effekt: fremdriften måles til den datoen, og statusdatolinjen og fremdriftslinjen i Gantt-diagrammet står på den. Se [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang).
- **Fremdriftsmodus** — et valg mellom *Retained Logic* og *Progress Override*. Standard: *Retained Logic*. Effekt: med *Retained Logic* følger det gjenstående arbeidet for en startet etterfølger avhengigheten; med *Progress Override* starter det gjenstående arbeidet på statusdatoen, uten å vente på forgjengeren. Se [Velge fremdriftsmodus](docs://howto-voortgangsmodus-kiezen).

I det minimerte båndet står disse tre bak én flaggknapp med tittelen *Grunnlinjer og fremdrift*.

### Tidsplan › Fremdrift

- **Eksporter fremdriftsark** — lager et `.xlsx`-ark med aktivitetene, for å fylle inn fremdrift utenfor appen. Deaktivert uten aktiviteter.
- **Oppdater fremdrift fra et regneark** — åpner importvinduet for et tilbakesendt ark. Deaktivert uten aktiviteter. Se [Importere fremdrift fra et regneark](docs://howto-voortgang-importeren).

Denne gruppen finnes også på *Tabell* og *Rapport*.

## Ressurser

### Ressurser › Administrer

- **Ressurser** — åpner det fulle ressurspanelet; det tar over arbeidsområdet. Lyser mens du ser panelet. Se [Ressurspanel](docs://ref-resourcepaneel).
- **Ressursdokk** — dokker det kompakte ressurspanelet i kolonnen til høyre, ved siden av Gantt-diagrammet. Lyser mens dokken vises; ett nytt klikk lukker den. Dokken viser bare navn, farge, en advarsel ved overallokering og *Maksimalt antall*. Med et aktivitetsvalg viser den bare ressursene til disse aktivitetene.
- **Ny ressurs** — åpner det fulle ressurspanelet med en tom utkastrad for en ny ressurs. Ingenting lages før du skriver inn et navn; klikker du et annet sted, blir det ingenting igjen. Ressursen havner i biblioteket eller i prosjektet, avhengig av visningen.

### Ressurser › Tilordning

- **Tilordne ▾** — tilordner en ressurs til den valgte aktiviteten. Bare tilgjengelig med nøyaktig én aktivitet valgt, som ikke har delaktiviteter og ikke er en milepæl; ellers er knappen grå. I menyen setter du først *Enh./dag* (standard 1) og *Kurve* (standard *Jevn*). Ett klikk på en ressurs tilordner den med disse verdiene. Menyen viser bare ressurser som ikke er på aktiviteten ennå. Se [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen).

### Ressurser › Histogram

- **Histogram** — viser eller skjuler histogramstripen under Gantt-diagrammet. Standard: av. Valget ditt blir husket.
- **Forrige** og **Neste** — blar gjennom ressursene i velgeren for histogramstripen, med *Alle ressurser* som et ekstra trinn i runden. Deaktivert når histogrammet er av, eller når prosjektet ikke har ressurser.

### Ressurser › Utjevning

- **Utjevn…** — åpner vinduet *Utjevning av ressurser*. Se [Utjevning](docs://uitleg-nivelleren).
- **Fjern utjevning** — fjerner utsettelsene og avbruddene som utjevningen la til. Deaktivert når ingen aktivitet har et utjevningsresultat.

### Ressurser › Overallokering

- **Overallokering** — ikke en knapp, men en teller: antallet ressurser med minst én dag med overallokering, eller *Ingen*. Rød med et advarselsikon så snart det finnes én. Tallet oppdateres etter *Beregn* og etter endringer i ressurser og tilordninger. Endrer du datoene til aktiviteter, telles det først etter *Beregn*.

## Visning

### Visning › Tidsskala

- **Zoom +** og **Zoom -** — zoomer tidsaksen inn eller ut med 10 piksler per dag.
- **Tilbakestill** — setter zoomen tilbake til standarden, 30 piksler per dag.
- **Tilpass til prosjekt** — zoomer og ruller slik at hele prosjektet får plass i visningen.
- **Valg av skala** — en liste med *År*, *Kvartal*, *Måned*, *Uke*, *Dag* og, bare når *Slå på timeplanlegging* er på, *Time*. Et valg setter en fast zoom. Verdien som vises, følger gjeldende zoom. Under den vises zoomen i piksler per dag.

### Visning › Skjerm

- **Kolonner…**, **Filter…**, **Grupper…** og **Sorter…** — vises bare når *Vis klassiske visningsknapper* er på (*Appinnstillinger*, fanen *Avansert*, overskriften *Eldre funksjoner*). Standard: av. *Kolonner…* fører deg til *Tabell* og åpner kolonnevelgeren der. *Filter…* åpner filtervinduet med en gang, så lenge det ikke finnes et lagret filter. Med lagrede filtre åpnes en meny med *Filter…*, *Tøm* (bare når et filter er aktivt) og de lagrede filtrene. *Grupper…* tillater to nivåer. *Sorter…* tillater flere nivåer. En knapp lyser når den visningsinnstillingen er aktiv. I det gjeldende båndet gjør du dette med knapper for oppsett; se [Opprette og bruke et oppsett](docs://howto-layouts-gebruiken).

### Visning › Struktur

- **Skjul** — skjuler de valgte hovedaktivitetene. Uten valg skjules alle. I en gruppert visning skjuler den alle gruppene, og et valg har ingen effekt.
- **Utvid** — det motsatte.

### Visning › Oppsett

- **Knapper for oppsett** — hvert oppsett er en bryter med et ikon og et navn. *Ressursdiagram* er med. Ett klikk slår oppsettet på. Et nytt klikk slår det av og henter tilbake visningen fra før klikket. Oppsett med ulike deler kan være på samtidig. Høyreklikk på et oppsett: *Rediger…*, *Dupliser* og *Slett* (etter bekreftelse). Et innebygd oppsett kan bare dupliseres.
- **Nytt oppsett** — åpner oppsettvinduet for et nytt oppsett.

### Visning › Presentasjon

- **Presentasjon** — slår presentasjonsmodus av eller på (Esc for å stoppe; i skrivebordsappen også F11): bare Gantt-diagrammet fyller skjermen. Se [Presentere på en stor skjerm](docs://howto-presentatie).
- **Delt visning** — deler Gantt-diagrammet i to tidsvinduer som begge starter med gjeldende zoom og posisjon (50 prosent). Eller den gjør det til ett vindu igjen. Standard: av. Se [Bruke delt visning og minikartet](docs://howto-split-view-en-mini-map).
- **Minikart** — viser eller skjuler minikartet. Standard: av. Valget ditt huskes.

### Visning › Paneler

- **Egenskaper** — viser eller skjuler panelet *Egenskaper* i høyre kolonne. Standard: på. Se [Aktivitetsdialog og egenskapspanel](docs://ref-taak-eigenschappen).

Knappene *Ressurser*, *Ressursdokk* og *Histogram* er de samme som under *Ressurser*, og *Advarsler* er det samme som under *Tidsplan*.

**Den høyre kolonnen.** Kolonnen til høyre for Gantt-diagrammet vises så snart minst ett av panelene *Egenskaper*, *Ressursdokk* eller *Advarsler* er på. Er ingen av dem på, finnes det ingen kolonne. Hvis et fullt panel tar over arbeidsområdet, for eksempel det fulle ressurspanelet, forsvinner kolonnen. Bare på fanen *Tabell* blir den.

- **Bredde** — dra skillelinjen mellom arbeidsområdet og kolonnen. Én bredde gjelder for alle paneler i kolonnen.
- **Deling** — hvis to paneler er på, dra skillelinjen mellom dem. Hvis bare ett panel er på, fyller det hele kolonnen.
- **Skjul** — knappen *Skjul sidekolonne* i toppen skjuler kolonnen. En smal stripe med knappen *Utvid sidekolonne* henter den tilbake, med de samme panelene som før.
- **Lukk** — hvert panel har et kryss i toppen. Det er samme bryter som knappen i båndet.
- **Fullt panel** — i ressursdokken åpner knappen *Vis fullt panel* det fulle ressurspanelet.

### Visning › Grunnlinjer og fremdrift

Denne gruppen har samme navn som den under *Tidsplan*, men inneholder tegnealternativene for Gantt-diagrammet.

- **Grunnlinjeoverlegg** — viser den aktive grunnlinjen som en tynn stolpe under hver aktivitetsstolpe. Standard: på. Uten en aktiv grunnlinje er det ingenting å se.
- **Fremdriftslinje** — tegner en linje på statusdatoen som buler ut for hver aktivitet, i forhold til aktivitetens fremdrift. Standard: på. Uten statusdato er det ingenting å se. Når fremdriftslinjen er på, er den linjen også markøren for statusdatoen.
- **Statusdatolinje** — tegner en stiplet linje på statusdatoen. Standard: på. Du ser den bare når fremdriftslinjen er av. Ellers tar fremdriftslinjen dens plass. Etiketten med datoen i overskriften blir værende så lenge minst en av de to er på. Etiketten følger datoformatet ditt, for eksempel 20-09-2006. Hvis appen regner i timer, står linjen og etiketten på klokkeslettet, og etiketten viser også tiden, for eksempel 20-09-2006 17:00.
- **Stolpefarger** — velger hvordan stolpene får farge: *Kritisk linje* (standard), *Per aktivitet — automatisk* eller *Etter kategori* med et valg av felt. Hvis feltet ikke finnes i dette prosjektet, viser menyen at *Arbeidskategori* brukes midlertidig. Utenfor *Kritisk linje* viser en rød kant den kritiske linjen. Valget gjelder også for rapporten.
- **Ressursmarkering** — tegner en tynn strimmel i ressursens farge under hver stolpe for en aktivitet uten underaktiviteter. Strimmelen deles i forhold til tildelingsenheter per dag. Standard: av.
- **Slakkbånd** — tegner det grønne slakkbåndet etter en stolpe som ikke er kritisk, opp til aktivitetens seneste slutt. Standard: på.
- **Avhengighetslinjer** — viser eller skjuler avhengighetslinjene mellom aktivitetene. Standard: på. Valget hører til dokumentet og til oppsettet.

## Innstillinger

### Innstillinger › Prosjekt

- **Prosjektinnstillinger** — åpner vinduet *Prosjektinnstillinger*: metadataene for prosjektet og, i blokken *Beregningsprofil og beregningsalternativer*, hvordan prosjektet beregner. Se [Nytt prosjekt og Prosjektinnstillinger](docs://ref-projectinfo).
- **Appinnstillinger** — åpner vinduet *Appinnstillinger* med fanene *Utseende*, *Tidsplan* og *Avansert*. De samme innstillingene finnes under *Fil › Appinnstillinger*.

### Innstillinger › Kalender

Knappen *Kalender* er den samme som under *Tidsplan*.

### Innstillinger › Hurtigtaster

- **Hurtigtaster** — åpner vinduet *Hurtigtaster*.

## Tabell

Fanen *Tabell* viser aktivitetene som en full tabell i stedet for Gantt-diagrammet. Gruppene *Fil*, *Rediger*, *Aktiviteter*, *Tidsplan* og *Banesporing* er de samme som under *Hjem* og *Tidsplan*, og de virker på samme valg. Det finnes ingen gruppe *Zoom*, fordi zoom bare skalerer tidsaksen i Gantt-diagrammet. Knappene *Del aktivitet* og *Tegn avhengighet* er deaktivert her: det finnes ikke noe Gantt-diagram.

### Tabell › Kolonner

- **Kolonner…** — åpner kolonnevelgeren for denne tabellen. Den samme velgeren åpnes med plusset i tabelloverskriften. Verktøytipsen sier *Velg kolonnene i tabellvisningen*. Se [Justere tabellkolonner](docs://howto-tabelkolommen-aanpassen) og [Tabellkolonner](docs://ref-tabelkolommen).

## IFC

Fanen viser IFC-panelet i arbeidsområdet. Båndet har ingen knapper her, bare tekstlinjen *IFC - Industry Foundation Classes, i skjemaet for prosjektet (standard IFC 4.3 ADD2)*.

## Rapport

### Rapport › Rapport

- **Skriv ut** — bare på denne fanen, der den ikke gjør noe fordi *Rapport* allerede er åpen. Valgene for rapporten finnes på rapportskjermen.

## AI

Fanen *AI* finnes bare når *Slå på KI-modus* er på (*Appinnstillinger*, fanen *Avansert*, overskriften *KI-modus*). Standard: av. Når du slår det av, fjernes fanen, og broen stoppes. En KI-assistent arbeider med tidsplanen din via en MCP-bro som du starter her. Se [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Server

- **Start broen** og **Stopp broen** — starter eller stopper MCP-broen. Ved siden av er statusen: *Av*, *Aktiv på port …*, *Port … i bruk* (med årsaken) eller *Feil*. Deaktivert i webversjonen. Verktøytipsen sier *Broen fungerer bare i skrivebordsappen.* Den samme statusen vises som en prikk med *AI* i statuslinjen.

### AI › Tilkobling

- **Port** — porten til broen. Standard: 3877. Kan bare endres når statusen er *Av* (verktøytipsen: *Kan bare endres når serveren er stoppet.*).
- **Token** — passordet til broen, vist skjult. Små knapper *Vis token*/*Skjul token*, *Kopier* og *Opprett nytt token*. *Opprett nytt token* ber først om bekreftelse, fordi et nytt token bryter alle eksisterende tilkoblinger. Hvis broen kjører, starter den på nytt med det nye tokenet.
- **Koble til** — viser tilkoblingsdetaljene: endepunkt, token, et konfigurasjonsutdrag og en tilkoblingsprompt som du limer inn i KI-agenten din.

### AI › Sikkerhet

- **Pause** / **Fortsett** — avviser midlertidig alle endringer fra KI-assistenten. Lesing er fortsatt tillatt, og broen forblir aktiv. Knappen lyser rødt når den er pauset.
- **Skrivebeskyttet** — avviser alle verktøy som endrer data, så lenge dette er på.
- **Automatisk sikkerhetskopi: på** / **Automatisk sikkerhetskopi: av** — skriver automatisk en IFC-sikkerhetskopi før den første KI-endringen per dokument. Standard: på.
- **Ta sikkerhetskopi nå** — skriver en sikkerhetskopi med en gang og viser filnavnet. Bare i skrivebordsappen.
- **Åpne sikkerhetskopimappen** — åpner mappen med sikkerhetskopiene. Bare i skrivebordsappen.

### AI › Aktivitet

- **Aktivitetspanel** — viser eller skjuler panelet *KI-aktivitet* med kallene til broen, med argumentene og svarene for hvert kall.
