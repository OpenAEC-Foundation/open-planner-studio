# Fremdrift, statusdato og oprindelig plan

En tidsplan er en prognose. Når arbejdet er i gang, vil du vide, hvad der er færdigt, hvad der stadig mangler, og hvad det betyder for aflevering. Denne artikel forklarer, hvordan appen håndterer fremdrift: hvad statusdatoen gør, hvordan appen beregner det resterende arbejde, hvorfor en opgave, der allerede er startet, nogle gange stadig venter på sin foregående opgave, og hvordan du sammenligner den aktuelle situation med den oprindelige aftale. Et gennemregnet eksempel viser tallene.

## Begrebet

**Fremdrift** er det, der faktisk er sket. For hver opgave registrerer appen tre ting: en procentdel, en **faktisk startdato** og en **faktisk slutdato**. Det, tidsplanen forudsagde, står ved siden af. Det faktiske er det, der virkelig skete.

**Statusdatoen** er den dag, hvor du opgør, hvor langt arbejdet er. Alt, der er sket før den dag, er et faktum. Alt, der stadig skal ske, planlægger appen fra starten af den dag. En faktisk dato må ligge på statusdatoen, men aldrig efter den.

Det **resterende arbejde** er det, der stadig skal gøres på en opgave. En opgave på 4 arbejdsdage, der er 25% færdig, har 3 arbejdsdage resterende arbejde.

En **oprindelig plan** er et øjebliksbillede af tidsplanen på et bestemt tidspunkt, normalt det tidspunkt, hvor aftalen blev godkendt. Senere lægger du den faktiske tidsplan ved siden af og ser, hvor meget udførelsen afviger.

## Sådan beregner appen

Eksemplet nedenfor bruger beregningsprofilen *Open Planner Studio*, som nye projekter bruger. Længere fremme kan du læse, hvad der er anderledes i profilerne Primavera P6 og Microsoft Project.

Appen genberegner ikke af sig selv. Efter hver ændring af fremdrift eller statusdato viser statuslinjen *Forældet — genberegn (F5)*. Tryk på **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Hvis *Beregn automatisk* er slået til (under *Indstillinger › Projekt › App-indstillinger*, fanen *Tidsplan*, overskriften *Beregning*), gør appen det selv.

### Statusdatoen

Statusdatoen gør tre ting.

For det første accepterer appen ikke en faktisk dato efter statusdatoen. En dato på selve statusdatoen er i orden.

For det andet kan arbejde, der ikke er startet, ikke ligge i fortiden. Er en sådan opgave planlagt før statusdatoen, flytter appen den til statusdatoen. Det gælder også for de efterfølgende opgaver, der flytter med via deres afhængigheder. Du kan se effekten i eksemplet nedenfor. I profilen Microsoft Project gør appen dette ikke.

For det tredje starter det resterende arbejde på en opgave, der allerede er i gang, på selve statusdatoen. Appen regner statusdatoen som begyndelsen af den dag. Opgør du fremdriften fredag efter arbejdstid, sætter du derfor statusdatoen til mandag. Sætter du den til fredag, planlægger appen stadig det resterende arbejde den fredag.

Hvis du endnu ikke har en statusdato og indtaster fremdrift, sætter appen statusdatoen til i dag og meddeler dig det. En anden dato sætter du under *Tidsplan › Oprindelige planer & fremdrift › Statusdato*. Uden statusdato beregner appen en opgave, der er i gang, fremad med dens resterende varighed, men baglæns med dens fulde varighed. Slækken bliver da negativ, og opgaven ser kritisk ud uden grund.

### Procent, faktiske datoer og resterende varighed

Felterne hænger sammen. Udfylder du et felt, udfylder appen de andre.

- En procentdel over 0 betyder, at opgaven er startet. Angiver du ingen faktisk startdato, bruger appen den planlagte startdato. Er opgaven planlagt til at starte efter statusdatoen, spørger appen først, hvornår den faktisk startede.
- En procentdel på 100 betyder, at opgaven er færdig. Angiver du ingen faktisk slutdato, bliver den statusdatoen, også selv om arbejdet i virkeligheden var færdigt tidligere.
- En faktisk slutdato gør opgaven til 100%. Sætter du en færdig opgave tilbage under 100%, fjernes den faktiske slutdato. Rydder du den faktiske slutdato, sættes procentdelen til 0, og opgaven forbliver *I gang*, indtil du også rydder den faktiske startdato.
- Den **resterende varighed** er varigheden gange det, der stadig skal gøres, afrundet til hele arbejdsdage. For en opgave på 2 arbejdsdage giver både 0% og 25% 2 arbejdsdage resterende arbejde, og både 50% og 75% giver 1. Ved 90% runder appen ned til 0: det resterende arbejde er da færdigt på statusdatoen. En opgave i timer regnes i hele minutter: en opgave på 5 timer ved 40% har 3 timers resterende arbejde.
- En milepæl har kun én faktisk dato.
- En fase (hovedopgave) har ingen egen fremdrift. Efter beregningen følger dens procentdel af opgaverne under den: det vægtede gennemsnit af deres procentdele, med varigheden i arbejdsdage som vægt. En milepæl vejer 0.

Ændrer du varigheden på en opgave, der allerede er i gang, forbliver det allerede udførte arbejde. Procentdelen tilpasses: en opgave på 5 arbejdsdage ved 60%, som du sætter til 10 arbejdsdage, ender på 30%. Appen accepterer ikke en varighed, der er kortere end det arbejde, der allerede er udført.

### Færdige og igangværende opgaver

En færdig opgave er låst til sine faktiske datoer. Den flytter ikke mere, og med en statusdato er den aldrig kritisk. Uden statusdato kan en færdig opgave stadig være kritisk.

En opgave, der er i gang, beholder sin faktiske startdato. Kun det resterende arbejde flytter. Hvor det resterende arbejde starter, afhænger af fremdriftsmetoden.

### Retained Logic og Progress Override

Hvad gør appen, hvis en opgave allerede er startet, mens dens foregående opgave stadig er i gang? En sådan afhængighed kaldes **fremdrift uden for rækkefølge**: fremdriften strider mod rækkefølgen. Tænk på maleren, der allerede begynder i et rum, der er pudset, mens pudseren stadig er optaget et andet sted.

To fremdriftsmetoder bestemmer, hvordan appen beregner det:

- **Retained Logic** (standard): afhængigheden gælder stadig. Det resterende arbejde på den efterfølgende opgave følger afhængigheden: med slut til start starter det først, når den foregående opgave er færdig, og aldrig før statusdatoen.
- **Progress Override**: virkeligheden vinder. Det resterende arbejde på den efterfølgende opgave starter på statusdatoen, uden at vente på den foregående opgave.

I denne profil ligger forskellen kun i det resterende arbejde på opgaver, der allerede er startet, mens deres foregående opgave endnu ikke er færdig. Andre opgaver beregnes ens i begge metoder. Appen viser en sådan afhængighed i begge metoder: i statuslinjen som *1 afhængighed(er) med fremdrift uden for rækkefølge* og i panelet *Advarsler*.

### Oprindelige planer og afvigelse

Når du gemmer, registrerer appen for hver opgave uden underopgaver den tidligste startdato, den tidligste slutdato, varigheden og milepælstypen. Faser er ikke med. Det, du ændrer bagefter, rører ikke den oprindelige plan. Du kan gemme flere oprindelige planer, men præcis én er **aktiv**. Gantt-diagrammet, afvigelsesrapporten og fremdriftsrapporten bruger den aktive oprindelige plan.

**Afvigelsen** er forskellen i arbejdsdage mellem den oprindelige plan og den aktuelle tidsplan. Et plus betyder senere, et minus tidligere. Appen tæller i kalenderen for projektet. Afvigelsesrapporten viser startafvigelsen og slutafvigelsen pr. opgave. Tilstanden bestemmes kun af slutdatoen: *Forsinket* ved plus, *Tidligere* ved minus, ellers *Efter tidsplanen*. En opgave, der er tilføjet efter den oprindelige plan, kaldes *Ny*. En opgave, der ikke længere findes, er *Udgået*.

To bemærkninger. Afvigelsen i varighed står i opgavetabellen (kolonnen *Varighedsafvigelse*), ikke i afvigelsesrapporten. Den sammenligner den planlagte varighed af opgaven nu med den i den oprindelige plan. Fremdrift ændrer ikke den planlagte varighed. En opgave, der var planlagt til to dage og tog tre dage, har derfor en slutafvigelse på +1, men en afvigelse i varighed på 0. Og gemmer du en oprindelig plan, efter at der er indtastet fremdrift, registreres tilstanden med de faktiske datoer; afvigelsen er da nul.

Fremdriftsrapporten sætter den planlagte fremdrift ved siden af den faktiske fremdrift. Begge vægtes efter arbejdsdage. Planlagt er den del af hver opgave, der ifølge den oprindelige plan skulle være færdig på statusdatoen. Faktisk er den procentdel, der er indtastet.

### Hvor du ser det

I Gantt-diagrammet markerer en stiplet linje statusdatoen, med datoen i overskriftsrækken. På hver opgave, der er i gang, buler linjen ud til det punkt på bjælken, som procentdelen angiver. Det er **fremdriftslinjen**. Slår du fremdriftslinjen fra og lader statusdatolinjen være tændt, forbliver en lige linje. Er begge slået fra, forsvinder linjen og mærkaten. Knapperne *Overlay for oprindelig plan*, *Fremdriftslinje* og *Statusdatolinje* sidder under *Visning › Oprindelige planer & fremdrift*. De ændrer ikke noget i beregningen. Den oprindelige plan vises som en tynd bjælke under hver opgavebjælke. Opgavetabellen har kolonner for fremdrift og, pr. oprindelig plan, for afvigelsen. På fanen *Rapport* finder du rapporttyperne *Afvigelse* og *Fremdriftsrapport*.

## Gennemregnet eksempel: tilbygningen efter tre uger

Eksemplet er øvelsesprojektet *House extension* fra selvstudierne, i den tilstand, hvor alle afhængigheder er tilføjet: uden byggeferie, ressourcer eller timer. I selvstudium 6 gør du dette selv i øvelsesprojektet. Det projekt har dengang mere i sig, så tallene dér er anderledes. Her læser du, hvorfor tallene er, som de er.

Tilbygningen starter mandag den 7. juni 2027. På den beregnede tidsplan gemmer appen en oprindelig plan med navnet *Oprindelig plan*: aflevering fredag den 6. august 2027, 45 arbejdsdage.

### Tilstanden mandag den 28. juni

Statusdatoen er mandag den 28. juni 2027. Dette er sket:

- *Start of construction*, *Set up site*, *Clear garden and paving* og *Set out the extension* er færdige efter planen, fra 7. til 10. juni.
- *Excavate foundation trench* var planlagt til 2 arbejdsdage (fredag den 11. og mandag den 14. juni) og tog 3: fra 11. til 15. juni.
- *Foundation formwork and reinforcement* går fra 16. til 18. juni. *Reinforcement inspection* er den 18. juni, *Pour foundation* er mandag den 21. juni.
- *Foundation brickwork* (2 arbejdsdage) startede fredag den 25. juni og er på 50%.

Efter **Beregn** regner appen det ud sådan her:

- Det resterende arbejde på Foundation brickwork er 2 × (1 − 0,5) = 1 arbejdsdag. Det starter på statusdatoen, så det er færdigt mandag den 28. juni.
- *Lay hollow-core floor* følger tirsdag den 29. juni. Dermed starter *Build inner cavity leaf* onsdag den 30. juni i stedet for tirsdag den 29. juni. Aflevering kommer mandag den 9. august: én arbejdsdag senere end den oprindelige plan. Den ene ekstra dag for udgravningen er derfor forsinkelsen af hele projektet, fordi den opgave lå på den kritiske vej.
- Statuslinjen viser *Kritisk vej: 13 opgaver, 46 arbejdsdage*, mod 21 opgaver og 45 arbejdsdage før fremdriften. De otte færdige opgaver, der lå på den kritiske vej, tæller ikke længere med.
- Fasen *Foundations* er på 77,8%. Opgaverne i den vejer 2 + 3 + 1 + 2 + 1 = 9 arbejdsdage. Færdige er 2 + 3 + 1 arbejdsdage, plus halvdelen af 2: 7 i alt. Og 7 ud af 9 er 77,8%. Milepælen *Reinforcement inspection* vejer 0.

Afvigelsesrapporten sætter dette ved siden af den oprindelige plan:

- *Excavate foundation trench*: startafvigelse 0, slutafvigelse +1 (oprindelig slutdato 14. juni, nu 15. juni).
- *Foundation brickwork*: startafvigelse +1 (24. juni blev 25. juni), slutafvigelse +1.
- *Build outer cavity leaf*: +1, +1. Den opgave er stadig ikke kritisk: den havde 2 arbejdsdage slæk og beholder dem.
- *Handover*: +1. Projektslutdatoen afviger med 1 arbejdsdag.
- I alt er 19 opgaver *Forsinket* og 4 *Efter tidsplanen*; ingen opgave er *Tidligere*.

Fremdriftsrapporten viser *Planlagt* 28,3% og *Faktisk* 23,9%. Opgaverne vejer 46 arbejdsdage sammen. Ifølge den oprindelige plan skulle 13 være færdige: 4 arbejdsdage til forberedelsen, 2 til udgravningen, 3 til armeringen, 1 til støbningen, 2 til Foundation brickwork og 1 til Lay hollow-core floor. I virkeligheden er 11 færdige: 4 + 2 + 3 + 1, plus den halve dag for Foundation brickwork.

### Hvad sker der, hvis du flytter statusdatoen?

Den samme fremdrift, en anden statusdato. Det resterende arbejde på Foundation brickwork starter altid på statusdatoen, så afleveringen flytter med den:

- Statusdato fredag den 25. juni: det resterende arbejde ligger fredag den 25. juni, og afleveringen forbliver fredag den 6. august.
- Mandag den 28. juni: aflevering mandag den 9. august.
- Tirsdag den 29. juni: aflevering tirsdag den 10. august, 2 arbejdsdage senere end den oprindelige plan.

### Hvad sker der, hvis du ændrer procentdelen?

Foundation brickwork har 2 arbejdsdage. Ved 0% eller 25% er det resterende arbejde 2 arbejdsdage: det er færdigt tirsdag den 29. juni, og afleveringen bliver tirsdag den 10. august. Ved 50% eller 75% er det 1 arbejdsdag: mandag den 28. juni, aflevering mandag den 9. august. Ved 90% er det resterende arbejde 0, og opgaven er færdig på statusdatoen.

### Hvad sker der, hvis du sætter en statusdato uden at indtaste fremdrift?

Hvis du kun sætter statusdatoen til mandag den 28. juni og ikke indtaster noget, er der ifølge tidsplanen endnu ikke sket noget. Arbejde, der ikke er startet, kan ikke ligge i fortiden. Appen flytter derfor alt til 28. juni: *Start of construction* ligger da på den dag, og aflevering kommer fredag den 27. august, 15 arbejdsdage efter den oprindelige plan. Indtast derfor først den fremdrift, der findes.

## Eksempel: pudser og maler

Her er et eksempel på fremdriftsmetoden. Samme tilbygning, men en anden tilstand: det er onsdag den 21. juli 2027. Alt op til og med *Install building services* er færdigt efter planen. *Plastering* (4 arbejdsdage) startede tirsdag den 20. juli og er på 25%. *Painting* (3 arbejdsdage) følger plastering, men maleren er allerede startet i dag og er på 33%.

Uden fremdrift var plastering planlagt fra tirsdag den 20. til fredag den 23. juli, og painting fra mandag den 26. til onsdag den 28. juli. Statuslinjen viser nu *1 afhængighed(er) med fremdrift uden for rækkefølge*: painting er startet, mens plastering ikke er færdig. I panelet *Advarsler* står der: *Uden for rækkefølge: fremdriften i den efterfølgende opgave strider mod afhængigheden*.

Plastering har 4 × (1 − 0,25) = 3 arbejdsdage med resterende arbejde: 21., 22. og 23. juli. Painting har 3 × (1 − 0,33) = 2 arbejdsdage med resterende arbejde.

- Med **Retained Logic** kan det resterende arbejde kun starte, når plastering er færdig. Det er fredag den 23. juli, så painting starter mandag den 26. juli og slutter tirsdag den 27. juli. Bjælken går fra den faktiske startdato 21. juli til 27. juli. Den samlede slæk er 7 arbejdsdage.
- Med **Progress Override** starter det resterende arbejde på statusdatoen. Painting slutter torsdag den 22. juli, før plastering er færdig. Den samlede slæk er 10 arbejdsdage.

Overdragelsen bliver fredag den 6. august i begge tilfælde: painting havde alligevel slæk.

### Andre beregningsprofiler

I profilerne Primavera P6 og Microsoft Project slutter painting i dette eksempel på de samme datoer (27. og 22. juli). De adskiller sig på følgende punkter. De er konventioner i profilen; du finder dem under *Indstillinger › Projekt › Projektindstillinger*, i blokken *Beregningsprofil og beregningsindstillinger*.

- I profilen Microsoft Project flyttes arbejde, der ikke er startet, ikke til statusdatoen (konvention *Flyt ikke ikke-startede opgaver til statusdatoen*). Hvis du i eksemplet ovenfor kun sætter en statusdato og ikke indtaster noget, bliver overdragelsen i den profil fredag den 6. august.
- I profilen Microsoft Project starter det resterende arbejde også tidligst ved den faktiske startdato plus den varighed, der allerede er forløbet (konvention *Resterende arbejde genoptages efter forløbet varighed*). Det er en ekstra nedre grænse ved siden af statusdatoen: den seneste af de to gælder. Tag *Build inner cavity leaf* (5 arbejdsdage). Den er startet tirsdag den 29. juni og er på 40% på statusdatoen, onsdag den 30. juni. (To murerhold arbejder samtidig, så 40% er allerede udført efter én dag.) Alt før den er færdigt efter planen. Open Planner Studio og Primavera P6 lader opgaven slutte fredag den 2. juli. Microsoft Project lader den slutte mandag den 5. juli, fordi tirsdag den 29. juni plus 2 forløbne arbejdsdage er torsdag den 1. juli, efter statusdatoen.
- I profilen Primavera P6 viser appen som tidligste startdato for en opgave i gang startpunktet for det resterende arbejde, ikke den faktiske startdato (i eksemplet med indermuren onsdag den 30. juni). Kolonnen *Start* og bjælken viser dog i alle profiler den faktiske startdato.
- I profilen Primavera P6 tæller afhængigheden til en efterfølgende opgave, der allerede er startet, under Progress Override heller ikke for den foregående opgave: den begrænser ikke længere dens seneste datoer og den tilladte slæk (konvention *Progress Override ignorerer også en startet efterfølgende opgave baglæns*). I eksemplet med pudser og maler ser du det ikke, fordi plastering alligevel er kritisk via gulvspartel: dens seneste datoer og den tilladte slæk er de samme under Retained Logic og Progress Override.
- Når du åbner en .xer-fil, henter appen fremdriftsmetoden fra filen. *Actual Dates*, den tredje P6-metode, kender appen ikke; en sådan fil beregnes med Retained Logic.

## Konsekvenser og misforståelser

**"Jeg flytter bare statusdatoen."** Hvis du flytter den, starter det resterende arbejde for opgaver i gang på den nye dato, og arbejde, der endnu ikke er startet, kan aldrig ligge før den dato. Flyt derfor kun statusdatoen sammen med en opdatering af fremdriften.

**"Indtastning af 100% registrerer den faktiske slutdato."** Kun hvis du også indtaster den faktiske slutdato. Hvis du sætter en opgave til 100% uden en faktisk slutdato, bliver den til statusdatoen. Var den faktisk færdig tidligere, så udfyld den faktiske slutdato.

**"0% betyder ikke startet."** Hvis en opgave har en faktisk startdato, tæller den som startet, også ved 0%. Det resterende arbejde er da hele varigheden og starter på statusdatoen. Slet den faktiske startdato, så tæller opgaven igen som ikke startet.

**"Progress Override løser advarslen."** Meddelelsen om fremdrift uden for rækkefølge forbliver. Fremdriftsmetoden bestemmer kun, hvordan appen beregner. Hvis afhængigheden ikke længere er korrekt, så ændr afhængigheden.

**"Pausen i en opdelt opgave forsvinder."** Nej: en pause i det, der endnu skal udføres, bliver i det resterende arbejde. Tag en opgave på 5 arbejdsdage med en pause på 1 dag efter 2 dage med arbejde, startet tirsdag den 29. juni og, med statusdatoen onsdag den 30. juni, på 40%. Det resterende arbejde på 3 arbejdsdage starter på statusdatoen og løber gennem pausen: slutdatoen er mandag den 5. juli. Uden pausen var den fredag den 2. juli.

**Timer og statusdatoen.** Du kan ikke indtaste et tidspunkt i båndet: du udfylder statusdatoen som en dato. Hvis du opgør fremdriften efter arbejdstid, så sæt statusdatoen til den næste arbejdsdag. En opgave i timer beregner det resterende arbejde fra starten af statusdatoen. Tag *Lay hollow-core floor* i øvelsesprojektet efter selvstudium 4, på det tidspunkt, hvor alt før den er færdigt: 5 timer, mandag den 28. juni, arbejdsdag fra 07:00. Med statusdatoen mandag den 28. juni og opgaven på 40% har den 3 timers resterende arbejde, der løber fra 07:00 til 10:00, selvom der allerede var udført arbejde den morgen. Hvordan appen tæller timer, forklares i [Dage og timer](docs://uitleg-dagen-en-uren).

**Opdatering af en oprindelig plan.** Det er ikke muligt. Du gemmer en ny og sletter den gamle. Hvis du flytter projektet, flytter de faktiske datoer og statusdatoen med, men de oprindelige planer gør som standard ikke. På den måde forbliver forskydningen synlig som afvigelse. Se [Flytning af et projekt](docs://howto-project-verplaatsen).

## Se også

- [Opdatering af fremdrift](docs://howto-voortgang-bijwerken): indstilling af statusdatoen og indtastning af fremdrift.
- [Import af fremdrift fra et regneark](docs://howto-voortgang-importeren): indlæsning af fremdrift fra medarbejdere på byggepladsen i én omgang.
- [Valg af fremdriftsmetode](docs://howto-voortgangsmodus-kiezen): indstilling af Retained Logic eller Progress Override.
- [Gemme og administrere en oprindelig plan](docs://howto-baseline-opslaan-en-beheren): registrering af en oprindelig plan og brug af den.
- [Flytning af et projekt](docs://howto-project-verplaatsen): hvad der sker med faktiske datoer, statusdatoen og oprindelige planer.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvorfor en opgave er kritisk, og hvad slæk betyder.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): fremdrift og en statusdato midtvejs i projektet (20. maj 2027).
