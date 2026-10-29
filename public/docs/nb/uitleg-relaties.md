# Avhengigheter og forsinkelse

Hvorfor starter murverket først når fundamentet er ferdig? Og hvorfor utsettes monteringen av taket med en uke når takelementene leveres for sent? Det skyldes avhengighetene mellom aktivitetene dine. I denne artikkelen leser du hvilke fire typer avhengigheter appen kjenner, hva forsinkelse og ledetid gjør, i hvilken kalender en forsinkelse teller, hva som skjer med en avhengighet på en fase, og hvordan appen avgjør hvilken avhengighet som bestemmer startdatoen for en aktivitet.

Reglene og eksemplene gjelder for et nytt prosjekt, med beregningsprofilen *Open Planner Studio* og en arbeidsuke fra mandag til fredag.

## Begrepet

En **avhengighet** betyr at to aktiviteter avhenger av hverandre. Den første aktiviteten er **forgjengeren**, den andre er **etterfølgeren**. En avhengighet er en nedre grense. Etterfølgeren kan aldri starte eller slutte tidligere enn avhengigheten tillater, men den kan starte eller slutte senere. Har en aktivitet flere forgjengere, venter den på den seneste datoen som kommer ut av alle disse avhengighetene.

Det finnes fire typer. De skiller seg fra hverandre i hvilket tidspunkt for forgjengeren (start eller slutt) som er knyttet til hvilket tidspunkt for etterfølgeren:

- **FS (slutt-til-start).** Etterfølgeren starter først når forgjengeren er ferdig. Takelementene settes på først når veggene står. Dette er klart den mest brukte avhengigheten.
- **SS (start-til-start).** Etterfølgeren starter først når forgjengeren har startet. Aktivitetene kan overlappe: rørleggingen kan starte så snart murverket er i gang.
- **FF (slutt-til-slutt).** Etterfølgeren slutter først når forgjengeren er ferdig. Fugingen kan ikke være ferdig før murverket er ferdig, men den kan starte tidligere.
- **SF (start-til-slutt).** Etterfølgeren slutter først når forgjengeren har startet. Denne typen er sjelden. Et eksempel: den midlertidige lensingen kan bare stoppe når murverket på fundamentet har startet.

En avhengighet kan også ha en **forsinkelse**: ventetid mellom de to aktivitetene, for eksempel betong som må herde. En negativ forsinkelse kalles en **ledetid**. Etterfølgeren starter da før forgjengeren er ferdig, og aktivitetene overlapper.

## Hvordan appen regner ut

### De fire typene

For hver avhengighet regner appen ut den tidligste datoen etterfølgeren kan starte. Den tar den seneste av alle avhengighetene til en aktivitet. Uten forsinkelse fungerer det slik:

- Med FS starter etterfølgeren på den første arbeidsdagen etter forgjengerens slutt.
- Med SS starter etterfølgeren samme dag som forgjengeren.
- Med FF er etterfølgeren ferdig samme dag som forgjengeren. For å finne startdatoen teller appen tilbake over varigheten til etterfølgeren. En etterfølger på 3 arbeidsdager starter derfor 2 arbeidsdager før forgjengerens slutt.
- Med SF er etterfølgeren ferdig samme dag som forgjengeren starter. Også her teller appen tilbake over varigheten til etterfølgeren.

Dette er nedre grenser. Etterfølgeren starter senere hvis en annen avhengighet eller en begrensning krever det. Alle datoer vises først etter **Beregn** (F5). Så lenge statuslinjen viser *Utdatert — omberegn (F5)*, hører stolpene til den forrige beregningen.

### Forsinkelse og ledetid

En forsinkelse kan uttrykkes på fire måter:

- I **arbeidsdager** (`3` eller `3d`): appen hopper over fridager og helger. Dette er standard.
- I **kalenderdager** (`3ed`, e står for *elapsed*, altså forløpt tid): hver dag teller, også lørdag og søndag. Dette er enheten for noe som fortsetter uten at noen gjør noe med det, for eksempel herding.
- Som en **prosent** av varigheten til forgjengeren (`40%`): appen regner det ut på nytt ved hver beregning, og runder av til hele dager (2,5 dager blir 3).
- I **arbeidstimer** (`4h`): appen teller forsinkelsen i forsinkelseskalenderen. Som standard er det kalenderen til forgjengeren. Er forgjengeren en dagbasert aktivitet i en kalender uten egne tidsbånd, for eksempel standardkalenderen, da omregner appen timene til hele arbeidsdager. Det rundes av til nærmeste hele dag, en halv dag rundes opp. Med en arbeidsdag på 8 timer blir `2h` og `3h` derfor 0 dager, `4h` til og med `11h` blir 1 dag, og `12h` blir 2 dager. Har den kalenderen egne tidsbånd, eller er forgjengeren en timebasert aktivitet, teller forsinkelsen nøyaktig i arbeidstimer.

Regelen for en forsinkelse på N arbeidsdager med FS: de N arbeidsdagene etter forgjengerens slutt er ventetid, og etterfølgeren starter den arbeidsdagen etter dette. Med SS og FF legges forsinkelsen til henholdsvis forgjengerens start og slutt. En negativ ledetid teller tilbake. En ledetid på 1 arbeidsdag med FS lar etterfølgeren starte den dagen forgjengeren er ferdig.

En ledetid kan ikke sette en aktivitet før prosjektstarten. Skulle det skje, holder appen etterfølgeren på prosjektstarten. Den melder det i panelet *Advarsler*: *Ledetid kappet av prosjektstarten — avhengigheten er ikke fullt utnyttet*.

### I hvilken kalender forsinkelsen teller

Hver aktivitet kan ha sin egen kalender. Med en forsinkelse i arbeidsdager er det viktig hvilken kalender som teller arbeidsdagene. Med innstillingen *Forsinkelseskalender* velger du det, mellom fire valg: *Forgjenger*, *Etterfølger*, *24-timers* og *Prosjektkalender*. Som standard teller forsinkelsen i kalenderen til **forgjengeren**. Du finner innstillingen under *Innstillinger › Prosjekt › Prosjektinnstillinger*, i blokken *Beregningsprofil og beregningsalternativer*, under *Beregningsalternativer for dette prosjektet*. Valget hører til prosjektfilen og gjelder først etter at du klikker på *Bruk*. Tidsplanen omberegnes da.

En forsinkelse i kalenderdager (`3ed`) teller alltid alle dager, uansett hvilken *Forsinkelseskalender* du velger.

### Avhengigheter på hovedaktiviteter

Du kan legge en avhengighet på en fase (en hovedaktivitet) i stedet for på en aktivitet inni den. Internt legger appen den avhengigheten på hver aktivitet i fasen:

- En fase som **forgjenger** med FS eller FF: etterfølgeren venter til den aktiviteten i fasen som blir ferdig sist, er ferdig.
- En fase som **etterfølger** med FS eller SS: hver aktivitet i fasen venter på forgjengeren, uavhengig av de andre aktivitetene i fasen.
- En fase som **forgjenger** med SS eller SF: etterfølgeren venter på starten av aktiviteten i fasen som starter **sist**, ikke på starten av selve fasen. Dette er mer forsiktig enn du kanskje venter: etterfølgeren starter aldri for tidlig, men kanskje senere enn du mener. Vil du at etterfølgeren skal følge starten av fasen, legg avhengigheten på den første aktiviteten i fasen.
- En fase som **etterfølger** med FF eller SF: hver aktivitet i fasen må selv oppfylle kravet til slutt (med FF slutt på eller etter forgjengerens slutt, med SF på eller etter forgjengerens start). Det gjelder også en aktivitet som kunne vært ferdig mye tidligere. Legg heller en slik avhengighet på den siste aktiviteten i fasen.

En avhengighet mellom en aktivitet og fasen den ligger under, er ikke tillatt.

### Styrende avhengigheter

Har en etterfølger flere forgjengere, bestemmer vanligvis én avhengighet startdatoen. Det er avhengigheten som hindrer at etterfølgeren starter én dag tidligere enn nå. Slike avhengigheter heter **styrende avhengigheter**. Ved likhet finnes det flere styrende avhengigheter. Du kjenner igjen en styrende avhengighet på lynsymbolet i kolonnene *Forgjengere* og *Etterfølgere* i tabellen, på kolonnen *Styrende avhengighet* (**+** til høyre i tabelloverskriften, under *Avhengigheter*) og på den sterkere fargetonen når du sporer en sti. Hvordan du åpner den stien, står i [Spore en sti](docs://howto-pad-traceren).

Styrende avhengighet sier noe om datoer, ikke om varighet. En kort forgjenger kan også være styrende, for eksempel på grunn av en lang forsinkelse. Du ser det i eksemplet nedenfor.

## Gjennomregnet eksempel

Eksemplene bruker egne miniprosjekter. Alle starter mandag 7. juni 2027, med mindre annet står. Begreper som kritisk linje og slakk forklares i [Kritisk linje og slakk](docs://uitleg-kritiek-pad). Å bygge et nettverk av avhengigheter selv og kontrollere det, gjør du i opplæring 2, «Avhengigheter og den kritiske linjen».

### De fire typene side om side

*Pour foundation* tar 5 arbeidsdager: mandag 7. til fredag 11. juni. *Build walls* (5 arbeidsdager) følger med FS og går fra mandag 14. til fredag 18. juni. Fire aktiviteter på 3 arbeidsdager hver henger på *Build walls*, hver med en ulik type:

- *Place roof elements* (FS) starter mandag 21. juni, den første arbeidsdagen etter murverket, og er ferdig onsdag 23. juni.
- *Pipework* (SS) starter mandag 14. juni, samtidig med murverket, og er ferdig onsdag 16. juni.
- *Pointing* (FF) må være ferdig fredag 18. juni, samtidig med murverket. Med 3 arbeidsdager starter den derfor onsdag 16. juni.
- *Dewatering* (SF) må være ferdig mandag 14. juni, den dagen murverket starter. Teller man tilbake 3 arbeidsdager (torsdag 10., fredag 11. og mandag 14. juni), starter den torsdag 10. juni.

Bare *Place roof elements* ligger på den kritiske linjen. Prosjektet er ferdig onsdag 23. juni. *Pipework*, *Pointing* og *Dewatering* har henholdsvis 5, 3 og 7 arbeidsdager slakk.

### Forsinkelse og ledetid i tall

*Pour foundation* er ferdig fredag 18. juni. *Build walls* (2 arbeidsdager) følger med FS. Slik påvirker forsinkelsen startdatoen:

- Uten forsinkelse starter murverket mandag 21. juni.
- Med forsinkelse `3` (tre arbeidsdager) er mandag 21., tirsdag 22. og onsdag 23. juni ventetid. Murverket starter torsdag 24. juni.
- Med forsinkelse `3ed` (tre kalenderdager) teller lørdag, søndag og mandag. Murverket starter tirsdag 22. juni.
- Med forsinkelse `-1` (en ledetid på én arbeidsdag) starter murverket fredag 18. juni, den dagen støpingen er ferdig.
- Med forsinkelse `40%` er forsinkelsen 40% av 5 arbeidsdager, altså 2 arbeidsdager. Murverket starter onsdag 23. juni.
- Med forsinkelse `50%` er forsinkelsen 2,5 arbeidsdager, avrundet til 3 arbeidsdager. Murverket starter torsdag 24. juni.

### Hvilken kalender som teller forsinkelsen

*Build walls* (4 arbeidsdager) ligger i prosjektkalenderen (mandag til fredag) og er ferdig torsdag 10. juni. *Pointing* (2 arbeidsdager) følger med FS og forsinkelse `3`, og ligger i en kalender der også lørdag og søndag er arbeidsdager. Da avhenger startdatoen av *Forsinkelseskalender*:

- *Forgjenger* (standard): forsinkelsen teller i kalenderen til murverket. Fredag 11., mandag 14. og tirsdag 15. juni er ventetid. Pointing starter onsdag 16. juni.
- *Etterfølger*: forsinkelsen teller i kalenderen til pointing. Fredag 11., lørdag 12. og søndag 13. juni er ventetid. Pointing starter mandag 14. juni.
- *24-timers*: hver kalenderdag teller. Også her er fredag, lørdag og søndag ventetid. Pointing starter mandag 14. juni.
- *Prosjektkalender*: forsinkelsen teller i prosjektkalenderen, akkurat som med *Forgjenger*. Pointing starter onsdag 16. juni.

### Avhengigheter på en fase

*Foundation* er en fase med to aktiviteter: *Excavate* (2 arbeidsdager, mandag 7. og tirsdag 8. juni) og deretter *Pour* (3 arbeidsdager, onsdag 9. til fredag 11. juni). *Build walls* følger fasen *Foundation* med FS og starter mandag 14. juni. Appen får den til å vente på *Pour*, aktiviteten som blir ferdig sist.

Med en fase som etterfølger: *Permit* (3 arbeidsdager, ferdig onsdag 9. juni) går med FS til fasen *Struktur*. Fasen inneholder *Build walls* (4 arbeidsdager) og deretter *Lay floor* (2 arbeidsdager). Hver aktivitet i fasen venter på *Permit*: *Build walls* starter torsdag 10. juni og er ferdig tirsdag 15. juni. *Lay floor* venter også på murverket og går fra onsdag 16. til torsdag 17. juni.

Med SS fra en fase: fasen *Finishing* inneholder *Plastering* (2 arbeidsdager, 7. og 8. juni), deretter *Painting* (3 arbeidsdager, 9. til 11. juni) og deretter *Snagging* (2 arbeidsdager, 14. og 15. juni). *Cleaning* følger fasen med SS. Du ville forvente en start mandag 7. juni. Appen får *Cleaning* til å vente på starten av *Snagging*, aktiviteten som starter sist: mandag 14. juni.

### Hva er styrende

*Pour foundation* (2 arbeidsdager) går fra mandag 7. til tirsdag 8. juni. To grener følger:

- *Build walls* (5 arbeidsdager): onsdag 9. til tirsdag 15. juni.
- *Order roof elements* (2 arbeidsdager): onsdag 9. og torsdag 10. juni.

*Place roof elements* (3 arbeidsdager) følger begge: med FS etter murverket, og med FS og forsinkelse `5` etter bestillingen (leveringstiden). Fra murverket kunne plasseringen starte onsdag 16. juni. Fra bestillingen er fredag 11., mandag 14., tirsdag 15., onsdag 16. og torsdag 17. juni ventetid. Plasseringen starter derfor fredag 18. juni. Avhengigheten til bestillingen er derfor en styrende avhengighet, selv om bestillingen er mye kortere enn murverket. Murverket har 2 arbeidsdager slakk.

## Konsekvenser og misforståelser

**«En avhengighet låser aktivitetene fast.»** Nei, en avhengighet er en nedre grense. Etterfølgeren starter tidligst på datoen avhengigheten gir. Den starter senere hvis en annen avhengighet eller en begrensning krever det. Hvordan begrensninger passer inn, forklares i [Begrensninger og tidsfrister](docs://uitleg-constraints).

**«SS betyr at aktivitetene starter samtidig.»** SS sier bare at etterfølgeren ikke må starte før forgjengeren. Har etterfølgeren en annen forgjenger som blir ferdig senere, starter den senere.

**«Med FF starter etterfølgeren samme dag.»** Nei, med FF sammenfaller sluttdatoene. En kort etterfølger starter derfor senere enn forgjengeren, slik som pointing i eksemplet.

**«En forsinkelse i dager teller kalenderdager.»** Som standard teller en forsinkelse arbeidsdager, i kalenderen til forgjengeren. For herding eller tørking, der også helgen teller, bruker du kalenderdager (`ed`).

**«En aktivitet uten avhengigheter er ikke noe problem.»** En aktivitet uten forgjenger starter på sin planlagte startdato. En aktivitet uten etterfølger får slakk helt til slutten av prosjektet. Glemmer du en avhengighet, virker det derfor som om aktiviteten har mye rom. Se misforståelsene i [Kritisk linje og slakk](docs://uitleg-kritiek-pad).

**«En avhengighet på en fase er én avhengighet.»** For utregningen er det én avhengighet per aktivitet i fasen. Flytter du aktiviteter inn i eller ut av en fase, endres også avhengighetene som gjelder for disse aktivitetene.

## Se også

- [Legge til avhengigheter](docs://howto-relaties-leggen): stegene for å koble aktiviteter sammen og angi en forsinkelse.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva appen beregner ut fra avhengighetene dine, og hvorfor en aktivitet blir kritisk.
- [Begrensninger og tidsfrister](docs://uitleg-constraints): datoavtaler sammen med avhengighetene.
- [Spore en sti](docs://howto-pad-traceren): gjøre kjeden før eller etter en aktivitet synlig.
- [Opprette en hengekøye](docs://howto-hammock): en aktivitet med en avledet varighet, hengt på avhengigheter av typen SS og FF.
- [Koblinger mellom prosjekter](docs://howto-externe-relaties): avhengigheter med en aktivitet i en fil for et annet prosjekt.
