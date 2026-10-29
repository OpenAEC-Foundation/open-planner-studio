# Meldinger og advarsler

Appen viser deg hva som skjer på fire steder: statuslinjen nederst, panelet *Advarsler* i høyre kolonne, meldingene som vises kort nederst på skjermen og stripene under båndet. Denne artikkelen forklarer for hvert sted hva du ser, når det vises og hva du kan gjøre. Hvorfor en tidsplan er kritisk eller har overallokering, står i [Kritisk linje og slakk](docs://uitleg-kritiek-pad). Løsing av overallokering står i [Løse overallokering](docs://howto-overbezetting-oplossen). Å lage avhengigheter står i [Lage avhengigheter](docs://howto-relaties-leggen).

## Forskjellen mellom de fire

- **Statuslinjen** — en fast linje med tellere. De kommer fra siste beregning og blir stående til du beregner på nytt.
- **Panelet *Advarsler*** — listen bak disse tellerne, med alt den siste beregningen fant. Et klikk tar deg til aktiviteten, avhengigheten eller ressursen. Den er hentet fra siste beregning; ingenting lagres.
- **Meldinger** — korte beskjeder om noe du nettopp gjorde (lagring mislyktes, avhengighet avvist, import lest). En melding med informasjon forsvinner igjen, en feil blir stående til du lukker den. De er ikke med i panelet.
- **Stripe under båndet** — en farget stripe med en forklaring og én knapp. Den hører til en tilstand i dokumentet eller til en modus, og blir stående så lenge tilstanden gjelder. Se *Stripene under båndet*.

## Statuslinjen

Statuslinjen nederst viser, fra venstre mot høyre:

- **Aktiviteter:** — antall bladaktiviteter (hovedaktiviteter telles ikke med).
- **Milepæler:** — antall milepæler.
- **Kritisk linje: N aktiviteter, N arbeidsdager** — antall kritiske aktiviteter og prosjektets varighet. Vises bare etter en beregning.
- **Slutt:** — prosjektslutten fra beregningen. Vises bare etter en beregning; et tomt prosjekt har ingen.
- **N tidsfrist(er) oversett**, **N brutt begrensning(er)**, **N avhengighet(er) med fremdrift utenfor rekkefølge** og **N ressurs(er) med overallokering** — hver en knapp med et advarselsymbol. De vises bare når telleren er over 0 og det finnes en beregning. Et klikk åpner panelet *Advarsler* (verktøytips: *Åpne advarselspanelet (detaljer og navigasjon)*). Hvis du er på fanen *IFC* eller *Rapport*, hopper appen samtidig til *Hjem*, fordi høyre kolonne ikke finnes der. Telleren for *ressurs(er) med overallokering* oppdateres også etter endringer i ressurser og tilordninger. De andre tellerne endrer seg først etter *Beregn*. De fire tellerne er et utvalg: det panelet viser i tillegg (kappet ledetid, ignorert avhengighet, hengekøye uten sluttstyrende avhengighet, kappet sluttdato, tidsplanfeil) står ikke på statuslinjen.
- **Utdatert — omberegn (F5)** — med et advarselsymbol (verktøytips: *Tidsplanen er utdatert — trykk F5 for å omberegne*). Den vises så snart du endrer noe som påvirker tidsplanen og ikke har omberegnet. Hvis innstillingen *Beregne automatisk* er på, holder den seg borte. Unntaket er når beregningen ga en feil. Da blir den stående.
- **Valg: N aktivitet(er)** — antall valgte aktiviteter. Vises bare når du har et valg.
- **Skala:** og **Zoom: Npx/dag** — tidsskalaen for tidslinjen og zoomnivået. Skalaen følger av zoomen.
- **Ikke lagret** — så lenge dokumentet har endringer som ikke er i filen.
- **AI** — en farget prikk med ordet AI, bare når AI-modus er på. Verktøytipset viser *AI-bro:* med *Av*, *Aktiv på port N*, *Port N i bruk* eller *Feil*. Et klikk åpner fanen *AI*.
- **Feilsøkingsterminal** — en terminalknapp, bare når feilsøkingsterminalen er slått på. Den viser eller skjuler terminalen (*Vis feilsøkingsterminal* / *Skjul feilsøkingsterminal*).

## Panelet *Advarsler*

- **Åpning** — *Tidsplan › Tidsplan › Advarsler*, *Visning › Paneler › Advarsler*, eller en teller på statuslinjen. Panelet ligger i høyre kolonne, under *Egenskaper* og ressursdokken, og det åpner en sammenklappet kolonne. Som standard er det lukket, og det huskes ikke mellom økter. Når det står under andre paneler, drar du høyden i kanten. Den høyden huskes. Krysset øverst til høyre lukker det (*Lukk advarsler*).
- **Overskriftslinje** — *N feil, N advarsel(er)*. Hvis ingenting er beregnet ennå, står det *Ikke beregnet ennå — trykk på Beregn (F5) for å kjøre kontrollene*.
- **Beregn** — en knapp i overskriftslinjen. Den vises så lenge tidsplanen er utdatert eller ikke er beregnet ennå. Den gjør det samme som *Beregn* i båndet.
- **Advarselsymbol i overskriftslinjen** — når tidsplanen er utdatert, med verktøytipset *Tidsplanen er utdatert — denne listen kommer fra siste beregning. Omberegn (F5)*. Listen skjules ikke. Den merkes bare som utdatert.
- **Tom liste** — *Ingen advarsler. Tidsplanen klarer alle kontrollene*.
- **En linje** — øverst står stedet (aktivitet, avhengighet, ressurs eller prosjekt), og under det beskrivelsen. En feil har et eget åttekantet symbol, en advarsel et trekantet symbol. En aktivitet vises som `WBS-navn`. En avhengighet vises som `forgjenger → etterfølger (FS+2d)`, med type og forsinkelse. Et klikk tar deg til stedet (verktøytips: *Gå til: …*), se under. Linjen som hører til den aktive aktiviteten din (for en avhengighet: etterfølgeren) eller til ressursen du valgte i histogrammet, er uthevet.
- **Rekkefølge** — feil kommer først. Deretter per type, i rekkefølgen i listen under. Innenfor hver type kommer de i dokumentrekkefølge; for en avhengighet gjelder etterfølgeren, og for en ressurs gjelder ressurslisten. En aktivitet, avhengighet eller ressurs som ble slettet etter siste beregning, forsvinner fra listen.

### Typer advarsler

- **Tidsplanfeil** — *Tidsplanen kunne ikke beregnes: …* med årsaken etter den, se under. Et klikk: for en syklus velger appen alle aktiviteter i syklusen og hopper til den første. For andre feil er det ingenting å hoppe til, og linjen er ikke en knapp.
- **Tidsfrist oversett** — *Tidsfrist {date} oversett — tidligste slutt {date}*. Aktiviteten har en tidsfrist, og beregningen klarer den ikke. Et klikk hopper til aktiviteten. Slik løser du det: juster logikken eller varigheten, eller flytt tidsfristen.
- **Brutt begrensning** — *Begrensning {type and date} overstyres av logikken (negativ slakk)*. Begrensningen kan ikke oppfylles uten å bryte logikken. Slakken er negativ. Et klikk hopper til aktiviteten. Se [Begrensninger](docs://uitleg-constraints).
- **Utenfor rekkefølge** — *Utenfor rekkefølge: fremdriften til etterfølgeren strider mot avhengigheten*. Fremdriften til etterfølgeren passer ikke til avhengighetstypen. For eksempel: etterfølgeren er allerede i gang, mens forgjengeren ikke er ferdig ennå under en slutt-til-start-avhengighet. Et klikk velger begge aktivitetene, med etterfølgeren som aktiv. Kontroller de faktiske datoene eller avhengigheten.
- **Ledetid kappet** — *Ledetid kappet av prosjektstarten — avhengigheten er ikke fullt utnyttet*. Ledetiden (negativ forsinkelse) i avhengigheten rekker tilbake til før prosjektstarten. Et klikk velger begge aktivitetene.
- **Avhengighet ignorert** — *Avhengighet ignorert: forgjenger eller etterfølger mangler, eller er ikke en bladaktivitet*. Beregningen bruker ikke avhengigheten. Et klikk velger aktivitetene som fortsatt finnes. Se [Avhengigheter](docs://uitleg-relaties).
- **Hengekøye uten sluttstyrende avhengighet** — *Hengekøye uten sluttstyrende avhengighet (ingen FF/SF-forgjenger): varigheten settes til null*. Et klikk hopper til aktiviteten. Se [Hengekøyeaktiviteter](docs://howto-hammock).
- **Sluttdato kappet** — *Sluttdato kappet: kalenderen gir ingen brukbart tidsvindu for aktiviteten*. Beregningen nådde grensen for hvor mange dager den søker, for eksempel på grunn av en svært lang, sammenhengende periode med fridager i kalenderen. Et klikk hopper til aktiviteten. Se [Kalendere og arbeidsdager](docs://uitleg-kalenders).
- **Overallokering** — *Overallokering på N dag(er) (første – siste)*, med *ressursen jobber ikke disse dagene etter kalenderen sin* lagt til hvis alle dagene er fridager, eller *av disse N dag(er) jobber ikke ressursen etter kalenderen sin* ved en blanding. Et klikk velger aktivitetene med en tilordning på den ressursen, slår på histogrammet og velger den ressursen der. Fra *Tabell*, *IFC* eller *Rapport* hopper appen til *Ressurser*. Se [Ressurspanelet](docs://ref-resourcepaneel).

### Årsaker til tidsplanfeil

- *Sirkulær avhengighet mellom aktiviteter: {path}* — avhengighetene danner en syklus. Aktivitetene står i stien. Snu eller fjern én avhengighet.
- *Kalenderen har ingen arbeidsdager angitt* — gi kalenderen minst én arbeidsdag. Se [Kalendervinduer](docs://ref-kalenders).
- *Ugyldig varighet i dager for aktiviteten '{task}'* og *Ugyldig varighet i timer for aktiviteten '{task}'* — varigheten til aktiviteten er ikke et gyldig tall.
- *Timebasert aktivitet '{task}' har ingen gyldige arbeidstimer i kalenderen sin* — en timebasert aktivitet i en kalender uten arbeidstimer.
- *Ugyldig startdato for aktiviteten '{task}'* — startdatoen til aktiviteten er ikke gyldig.

## Stripene under båndet

En stripe ligger rett under båndet, over arbeidsområdet. Den har en tekst og én knapp. En stripe for en modus har ingen kryss. Du lukker de andre med krysset. De fem stripene:

- **Koblingsmodus** — *Koblingsmodus: dra fra én stolpe til en annen i Gantt for å koble dem med en avhengighet. Trykk Esc for å stoppe.* Den blir stående så lenge koblingsmodus er på. Knapp: *Stopp*. Se [Lage avhengigheter](docs://howto-relaties-leggen).
- **Delt aktivitet** — *Klikk på en stolpe på dagen avbruddet starter, og dra til høyre for lengden. Trykk Esc for å stoppe.* Den blir stående så lenge *Del aktivitet* er på. Knapp: *Stopp*.
- **Timeplanlegging i filen** — *Denne filen inneholder timeplanlegging.* Den vises når en åpnet fil inneholder timeplanlegging mens *Slå på timeplanlegging* er av. Knapp: *Slå på timeplanlegging*. Se [Å slå på timeplanlegging](docs://howto-urenplanning-aanzetten).
- **Struktur låst** — *Ikke tilgjengelig under filtrering/gruppering/sortering*. Den vises når det ikke er mulig å rykke inn eller redusere innrykk, fordi aktivitetstabellen er filtrert, gruppert eller sortert. Knapp: *Tøm*, som fjerner filteret, grupperingen og sorteringen.
- **Lagrede datoer** — etter å ha åpnet en fil der omberegning flyttet datoer: *Omberegningen flyttet N av M aktiviteter bort fra datoene i filen.* med knappen *Vis lagrede datoer*. Mens visningen er på: *Du ser datoene slik de er lagret i filen …* med knappen *Omberegn*. Se [Lagrede datoer](docs://uitleg-datums-zoals-opgeslagen).

## Meldinger

Meldinger vises nederst på skjermen, også i tabellen, i Backstage og i presentasjonsmodus. En melding er en *feil* eller en *info*. En feil er rød og blir liggende til du klikker på krysset. En info forsvinner etter 5 sekunder. En melding med mye forklaring blir liggende lenger. Tidtakerne starter på nytt så snart stabelen endres. Hver melding har et kryss øverst til høyre (verktøytips *Lukk melding*). Krysset lukker meldingen med en gang. Et klikk på teksten i meldingen gjør ingenting. En avvisning er alltid en feil. Det er en melding om at appen ikke utførte det du gjorde, for eksempel en avvist avhengighet, varighet, start eller milepæl. Dermed ser du den også hvis du ser bort et øyeblikk. En avvisning forsvinner etter Ctrl+Z eller Ctrl+Y, og når du går til et annet dokument, fordi den da ikke lenger stemmer. En annen feil, for eksempel *Kunne ikke lagre*, blir liggende. Det gjelder også når resten av samme handling lyktes, for eksempel når du limer inn i flere celler. Gjelder det flere aktiviteter, står det en linje under som sier hvilke som ikke er endret, for eksempel *Ikke endret: Foundation, Masonry.* Med mer enn fem slutter linjen med *og N flere aktiviteter*. Samme avvisning slås sammen til én linje med en teller når den gjentas. Høyst tre vises samtidig. Kommer en fjerde, forsvinner den eldste infoen først. Er det ingen info, forsvinner den eldste avvisningen først, deretter den eldste meldingen ved åpning som blir liggende, og til slutt den eldste feilen. Dermed kan en info eller avvisning aldri skyve ut en annen feil, for eksempel *Kunne ikke lagre*. Stabelen beveger seg bort fra knappene i en åpen dialog og fra faste handlingslinjer. En melding ved åpning av en fil blir også liggende til du klikker på krysset, hvis appen fylte inn, erstattet, reparerte eller utelot data under åpningen. Det gjelder en linje om funn fra parseren eller kalenderen, problemer med tallformat, enum-reserver, P6-planleggingsinnstillinger med en trygg reserveløsning, en beskyttende grunnlinje-reserve, ignorerte grunnlinjereferanser, aktiviteter uten planlagt start som fikk en start, avhengigheter mellom prosjekter eller aktiviteter uten prosjekt som ikke ble overtatt (P6 XML), noe fra en MS Project-fil som ikke ble overtatt (MS Project XML og `.mpp`) eller et ubrukelig XER-kildearkiv, og meldingene om dupliserte ID-er og avhengigheter som ikke tas med i beregningen. Inneholder meldingen bare informasjon uten en slik endring, for eksempel antall prosjekter, dokumenter eller tegnkoding, forsvinner den etter 5 sekunder.

- **Teller ×N** — en melding med en fast nøkkel slår en gjentakelse sammen til én linje med en teller, for eksempel en lagringsfeil som stadig kommer tilbake, eller en avvist avhengighet som du gjentar. Ikke alle meldinger gjør det.
- **Les mer** — noen meldinger har en lenke *Les mer* eller et eget tema (for eksempel *Aktivitetstyper forklart*) til veiledningen i Backstage › Hjelp.
- **Handlingsknapp** — meldingen om beregningsprofilen har en knapp *Åpne beregningsprofil* til Prosjektinfo.

Lista nedenfor er et utvalg, gruppert etter tema. Der det ikke står noe annet, er det en info.

### Lagring, åpning og gjenoppretting

- **Lagring mislyktes** (feil) — *Kunne ikke lagre* med årsaken under. Ved lagring, *Lagre som* og eksport av en rapport.
- **Lagret som nedlasting** (info) — *Lagret som nedlasting: '{name}' ligger nå i nedlastingsmappen din. …* Ved *Lagre som* og eksport, når miljøet ikke lar appen skrive direkte til stedet du valgte. To nedlastinger rett etter hverandre slås sammen.
- **Lagret som nedlasting (forklaring)** (info, 15 sekunder) — *Lagret som nedlasting: '{name}' ligger i nedlastingsmappen din. Denne nettleseren lar ikke appen skrive til et eget sted, …* Ved *Lagre* i en nettleser som bare lagrer via nedlasting. Én gang per økt, med en lenke til forklaringen om filer.
- **Nettleseren skriver ikke tilbake** (info, 15 sekunder) — *Denne nettleseren lar ikke appen skrive tilbake til '{name}'. …* Ved *Lagre* av et prosjekt som har en fil, når nettleseren må spørre etter et sted på nytt. Én gang per økt, med en lenke til forklaringen om filer.
- **Automatisk lagring mislyktes** (feil) — *Automatisk lagring mislyktes* med årsaken. Gjelder automatisk lagring til filen og gjenoppretting ved brudd.
- **Biblioteket kunne ikke lagres** (feil) — *Biblioteket kunne ikke lagres*, ved lagring av ressursbiblioteket.
- **Åpning av fil mislyktes** (feil) — *Kunne ikke åpne fil* med årsaken. For eksempel en nylig brukt fil eller en importert fil.
- **Eldre eller beskyttet .mpp** (feil) — *Denne .mpp-filen bruker et eldre format (Project 2007 eller tidligere)…* eller *Denne .mpp-filen er passordbeskyttet…*, begge med rådet om å eksportere som XML i MS Project og åpne den filen.
- **Ugyldig XER-fil** (feil) — en av *XER…*-tekstene, for eksempel *Dette er ikke en gyldig eller støttet XER-fil.* eller *XER-filen inneholder en tabell to ganger.*, med årsaken lagt til.
- **IFC kunne ikke leses** (feil) — *IFC kunne ikke leses* med årsaken, i IFC-visningen.
- **Gjenoppretting** (feil) — *Den gjenopprettede filen kunne ikke leses*, *Gjenoppretting mislyktes* og *N gjenopprettingsfiler kunne ikke lastes og er hoppet over.* Ved gjenoppretting etter en uventet avslutning.
- **Gren lagret som mal** (info) — *Gren lagret som mal '{name}'*.
- **Melding fra en utvidelse** (info, eller feil hvis utvidelsen melder en feil) — *Utvidelse {name}: {message}*. En utvidelse kan vise høyst tre nye meldinger per 10 sekunder, slik at stabelen ikke blir full. Mislykkes et steg i veiledningen til en utvidelse, står det *Et steg fra utvidelsen {name} gav en feil. Veiledningen fortsetter.*, og kan en prosjektfil fra en utvidelse ikke åpnes, *Prosjektfilen {file} fra utvidelsen {name} kunne ikke åpnes.* Begge er feil.
- **En endring kom imellom** (feil) — *En endring fra KI-assistenten eller en utvidelse kom imellom. …* Når du avbryter aktivitetsdialogen mens KI-assistenten eller en utvidelse i mellomtiden har endret noe: aktivitetsredigeringene fra før den endringen tilbakestilles ikke. De blir liggende som vanlige steg under *Angre*.

### Beregning

- **Tidsplanen kunne ikke beregnes** (feil) — *Tidsplanen kunne ikke beregnes* med årsaken under (se *Årsaker til en tidsplanfeil*). Ved *Beregn*, når du bytter dokument og når du åpner en fil.
- **Statusdato satt til i dag** (info) — *Statusdato satt til i dag ({date}).* Når du legger inn fremdrift i et prosjekt uten statusdato. Appen måler fremdrift frem til statusdatoen. Uten statusdato kan den ikke behandle fremdrift. Du stiller inn en annen dato under *Tidsplan › Grunnlinjer og fremdrift › Statusdato*. Med en lenke *Les mer* til [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang).
- **Varighet kortere enn utført arbeid** (feil) — *'{name}' er allerede {N} % ferdig: en varighet kortere enn arbeidet som er utført, er ikke mulig. Varigheten er ikke endret.*

### Avhengigheter og hierarki

- **Avhengighet avvist** (feil) — *Denne avhengigheten finnes allerede*, *En avhengighet mellom en aktivitet og dens egen overordnede hovedaktivitet er ikke tillatt* eller *Denne avhengigheten ville skape en syklus i tidsplanen ({cycle}) og er ikke opprettet.* Syklusen nevner aktivitetene, så du ser hvilken avhengighet du må fjerne eller snu først.
- **Flytting avvist** (feil) — *Denne flyttingen ville skape en syklus i tidsplanen ({cycle}): avhengighetene til en hovedaktivitet gjelder også for delaktivitetene. Ingenting er flyttet.*
- **Avhengigheter faller bort etter flytting** (info) — *Etter flyttingen kobler N avhengigheter en aktivitet til sin egen hovedaktivitet; de telles ikke lenger med i beregningen.*
- **Avhengigheter hoppet over ved innsetting** (feil) — *N avhengigheter ble ikke opprettet: ugyldig kobling…*, ved liming eller innsetting av en gren. En linje under sier hvilke avhengigheter, for eksempel *Ikke opprettet: Foundation → Masonry.*
- **Avhengigheter ikke tatt med etter import** (info) — *N avhengighet(er) kunne ikke tas med i beregningen. Kontroller kolonnene Forgjengere og Etterfølgere.*
- **Dupliserte ID-er etter import** (info) — *Objekter med samme ID i denne filen: N. De fikk hver sin egen ID…*

### Redigere aktiviteter

- **Start registrert som begrensning** (info) — *'{name}' starter tidligst {date} (SNET).* Når du endrer starten på en aktivitet med en forgjenger. Forgjengeren bestemmer starten, så appen registrerer datoen din som begrensningen *start ikke tidligere enn* (SNET). Etter omberegning (F5) starter aktiviteten ikke før den datoen. Hadde aktiviteten allerede en slik begrensning, står det *'{name}' starter nå tidligst {date} (SNET).* Ved flere aktiviteter viser meldingen et antall. Med en lenke *Les mer* til [Begrensninger og tidsfrister](docs://uitleg-constraints).
- **Ny start ikke brukt** (feil) — *Den nye starten til '{name}' ble ikke brukt: aktiviteten har en forgjenger, og begrensningen {type} {date} bestemmer starten. Endre den begrensningen for å flytte starten.*
- **Milepæl avvist** (feil) — *'{task}' har ressurstilordninger og kan ikke bli en milepæl. Fjern tilordningene først.* eller *'{task}' er en hovedaktivitet med delaktiviteter og kan ikke bli en milepæl.* Ved omgjøring i aktivitetsdialogen, egenskapspanelet, hurtigmenyen og tabellen.
- **Tilordninger flyttet til delaktivitet** (info) — *Tilordningen er flyttet til delaktiviteten '{child}'.* eller *N tilordninger er flyttet til delaktiviteten '{child}'.* Når en utvidelse gir delaktiviteter til en aktivitet med tilordninger. Den aktiviteten blir en hovedaktivitet, og en hovedaktivitet har ingen tilordninger selv. Derfor går de til den første nye delaktiviteten. I appen selv velger du dette i vinduet *Aktivitet blir en hovedaktivitet*. Da vises ikke denne meldingen. Med en lenke *Les mer* til [Endre strukturen](docs://howto-structuur-aanpassen).
- **Milepælsmarkering fjernet** (info) — *'{phase}' er ikke lenger en milepæl.* Når en milepæl får delaktiviteter. En milepæl er et tidspunkt uten delaktiviteter. Med delaktiviteter blir den en hovedaktivitet. Med en lenke *Les mer* til [Endre strukturen](docs://howto-structuur-aanpassen).
- **Spørsmål er utdatert** (feil) — *Aktivitetene eller tilordningene er endret mens spørsmålet var åpent. Ingenting er endret. Prøv igjen.* Når du velger i vinduet *Aktivitet blir en hovedaktivitet*, men spørsmålet ikke stemmer lenger.
- **Hovedaktivitet avvist** (feil) — *'{phase}' kan ikke bli en hovedaktivitet: …* med årsaken, og *Ingenting er endret.* Når en utvidelse gir delaktiviteter til en aktivitet med tilordninger, og tilordningene ikke kan gå til den første nye delaktiviteten. I appen selv vises ikke denne meldingen. Der spør vinduet *Aktivitet blir en hovedaktivitet* hva som skal skje, og *Flytt* er da slått av.
- **Celler hoppet over ved liming** (feil) — *N celler hoppet over: de er skrivebeskyttede (f.eks. automatisk nummererte WBS-koder eller beregnede kolonner).*
- **Referanser tømt ved liming** (info) — *N referanser fantes ikke i dette dokumentet og er tømt (aktivitetskalendere, egne arbeidskategorier, aktivitetskoder eller egendefinerte felt fra kildedokumentet).*
- **Strukturen er låst** (feil, rød stripe under båndet) — *Ikke tilgjengelig under filtrering/gruppering/sortering*, med knappen *Tøm*. Mens lista er filtrert, gruppert eller sortert: når du rykker inn, reduserer innrykk og drar, og med *Sett inn over* og *Sett inn under* (høyreklikkmenyen eller snarvei). Stripen blir liggende til du klikker på krysset, bruker Ctrl+Z eller Ctrl+Y, eller går til et annet dokument. Se [Endre strukturen](docs://howto-structuur-aanpassen).
- **Aktivitet lagt til bakerst** (feil) — *Den nye aktiviteten står bakerst. Mens du filtrerer, grupperer eller sorterer, kan appen ikke plassere den under utvalget ditt.* Med knappen *Tøm*. Med *Aktivitet* og *Milepæl ▾* mens en aktivitet er valgt og lista er filtrert, gruppert eller sortert. Aktiviteten blir lagt til, men nederst. *Tøm* fjerner filter, gruppering og sortering og lukker meldingen. Se [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen).
- **Aktivitetstypen justerte varigheter** (info) — *Etter kalenderendringen har aktivitetstypen justert varigheten til N aktiviteter (arbeidet består, timer per dag er endret).* Med en lenke *Aktivitetstyper forklart*.

### Primavera P6 XML

- **P6 XML-fil åpnet** (info) — *P6 XML-fil åpnet: N prosjektdokumenter.* Etter åpning av en P6 XML-fil.
- **Ikke overtatt** (blir liggende) — *N avhengigheter mellom prosjekter er ikke overtatt som avhengigheter.* og *N aktiviteter uten prosjekt er ikke lest inn.* Kontroller om tidsplanen din er komplett.
- **Tom eller ubrukelig** (feil) — ingenting åpnes. Det finnes tre årsaker: *Denne filen inneholder ingen aktiviteter som appen kan lese.*, *Aktivitetene har ingen ObjectId. …* og *Filen bruker XER-kolonnenavn … Åpne selve .xer-filen.*

### Primavera (XER)

- **XER-fil åpnet** (info) — *XER-fil åpnet: N prosjektdokumenter.* Én melding per fil, også når filen åpner flere prosjekter, med en lenke *Les mer* og detaljlinjer under. Alltid *N prosjekter funnet.* Bare når tallet er over 0: *N tomme prosjekter hoppet over.*, *N grunnlinjeprosjekter utelatt.*, *N grunnlinjer materialisert.*, *N løse grunnlinjereferanser ignorert.*, *Det ble brukt en beskyttende grunnlinje-reserve.* og *N koblinger mellom prosjekter bevart.* Bare ved en annen tegnkoding enn UTF-8: *Tegnkoding valgt: {encoding}.* Verder, når tallet er over 0: *N parserbevindinger.*, *N kalenderbevindinger.*, *N tallformatproblemer.*, *N enum-reserver.* og *N P6-planleggingsinnstillinger brukte trygge reserveløsninger.*
- **Datoer slik Primavera lagret dem** (detaljlinje i samme melding) — *N aktiviteter viser datoene slik Primavera lagret dem (ikke omberegnet).* N teller hver aktivitet som filen har datoer for, også de som ikke avviker. Eller, hvis modusen ikke ble slått på: *N aktiviteter avviker fra datoene i filen — du kan vise dem.*
- **XER-kildearkiv ubrukelig** (info) — *XER-kildearkivet i denne filen er ubrukelig og er utelatt; prosjektet selv er åpnet fullt ut.* med årsaken (for eksempel *Årsak: kontrollsummen passer ikke til kildebytene — arkivet er skadet.*) og konsekvensen (*Tidsplanen, beregningsprofilen og alle prosjektdata fra IFC er komplette. …*). Når du åpner en IFC-fil der et tidligere lagret XER-kildearkiv ikke kan brukes. Også ved gjenoppretting etter en uventet avslutning, hvis lagringen for gjenoppretting ikke lenger har XER-kildearkivet.
- **Eksport mister XER-informasjon** (info) — *Eksport til {format} fører til tap av XER-kildeinformasjon.* Etter en vellykket eksport til et annet format enn IFC av et prosjekt med data som bare finnes i en XER-fil. Med en lenke *Les mer*.

### Import, eksport og beregningsprofil

- **Datoer som i filen** (info) — *N aktiviteter viser datoene slik de står i filen (ikke omberegnet).* (N teller hver aktivitet med lagrede datoer) eller *N aktiviteter avviker fra datoene i filen — du kan vise dem.* Når du åpner en fil med lagrede datoer.
- **Arbeid og aktivitetstyper synlig** (info) — *Denne filen inneholder lagret arbeid eller aktivitetstyper; aktivitetstypen og gjenstående arbeid vises for dette prosjektet.*
- **MS Project-tidsplan lest** (info) — *Denne MS Project-filen inneholder N aktiviteter med en delt, utjevnet eller ressursdrevet tidsplan. De leses inn og vises slik.*
- **Avbrudd ikke eksportert** (info) — *N aktiviteter med avbrudd er eksportert uten avbrudd: MS Project og P6 kjenner bare avbrudd som en arbeidsfordeling.* Ved eksport til MS Project eller Primavera.
- **Prosjektstart flyttet** (info) — *N aktiviteter ble flyttet med prosjektstarten.* Når du setter prosjektstarten senere. Bare aktiviteter uten forgjenger og uten begrensning som ligger før den nye startdatoen, flyttes til den datoen. Med en lenke *Les mer* til [Nytt prosjekt og Prosjektinfo](docs://ref-projectinfo).
- **Datovindu styrer ikke lenger** (info) — *Datovinduet i MS Project styrer ikke lenger N aktiviteter etter denne endringen; …* Én gang per dokument.
- **Utjevningsforsinkelse avrundet** (info) — *Utjevning runder MS Projects minuttnøyaktige utjevningsforsinkelser for N aktiviteter av til hele arbeidsdager.* Én gang per dokument.
- **Beregningsprofil tatt i bruk** (info) — *Dette prosjektet beregner som {profile}. Endre det via Fil → «Prosjektinfo» → «Beregningsprofil og beregningsalternativer».* Med knappen *Åpne beregningsprofil*. Etter at du har tatt i bruk en beregningsprofil, kommer *Etter bruk er N aktiviteter forskjøvet.* hvis det er nødvendig.
