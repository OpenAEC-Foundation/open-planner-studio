# Gemte datoer

Du åbner en tidsplan fra Primavera eller MS Project, og datoerne er anderledes end i det program, du så dem i. Er importen gået galt? Normalt ikke. I denne artikel læser du, hvorfor appen selv genberegner, hvornår den viser datoerne fra filen, hvad der så er tomt, og hvordan du kommer tilbage til appens egen beregning. Eksemplet til sidst følger to opgaver gennem hele cyklussen.

## Begrebet

En tidsplanfil indeholder to slags data. Først logikken: opgaver, varigheder, afhængigheder, kalendere og begrænsninger. Dernæst de datoer, som programmet selv har beregnet ud fra logikken. Når du åbner filen, bruger Open Planner Studio logikken og beregner selv. Datoerne i filen er derfor ikke input.

Hvis appens egen beregning ender på andre datoer end filen angiver, ved du ikke, hvilken side der har ret. Filen kan mangle logik, som programmet brugte. Programmet kan også beregne anderledes end appen på et bestemt punkt. Derfor kan appen vise datoerne **som gemt**: de datoer, det andet program skrev i filen. Så sammenligner du med det, du så i det programm.

## Sådan håndterer appen det

### Hvilken beregningsprofil appen bruger

Appen beregner med en **beregningsprofil**: et sæt beregningsregler (konventioner), der bl.a. bestemmer, hvordan den behandler den planlagte start på en opgave og begrænsninger. Se [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen). Der er tre indbyggede profiler: *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. En `.xer` åbnes med *Primavera P6*, og en `.mpp` åbnes med *Microsoft Project*. CSV, MS Project XML og Primavera P6 XML åbnes med *Open Planner Studio*. Profilen for et projekt står under *Fil › Projektindstillinger*, ved *Beregningsprofil og beregningsindstillinger*. En IFC-fil fra appen beholder sin profil.

### Hvornår appen sammenligner

Når du åbner en fil, noterer appen, hvad filen sagde, og sammenligner det med sit eget resultat. Det gør den for:

- en Primavera-fil (`.xer`) og Primavera P6 XML;
- MS Project XML og MS Project-filer (`.mpp`);
- en IFC-fil fra et andet program, for de opgaver, hvis tidligste datoer står i filen;
- en IFC-fil fra appen selv, som har husket sin oprindelse. Nedenfor læser du, hvornår det er tilfældet.

Appen sammenligner aldrig en CSV-fil: startdatoen i en CSV er input, ikke resultatet af en beregning. En IFC-fil fra appen selv uden husket oprindelse sammenlignes heller ikke.

Hvis ingen opgave afviger, ser du ingenting. Hvis mindst én opgave afviger i en fil, du importerer nu, slår appen visningen til med det samme.

Ved en Primavera-fil beregner appen med beregningsprofilen *Primavera P6*. Den holder den planlagte start fra filen som tidligste startdato. En opgave, der står senere i filen, end afhængighederne kræver, men som også er planlagt der, bliver derfor, hvor den er: så er der ingen forskel.

### Hvad du ser

Under båndet er der en meddelelseslinje: *Du ser datoerne, som de står i filen; ved at genberegne forskydes 4 opgaver.* Ved en Primavera-kilde (en `.xer` eller Primavera P6 XML) står der *Du ser tidsplanen, som Primavera gemte den; ved at genberegne forskydes 1 opgave.* Til højre i meddelelseslinjen er knappen *Genberegn*. Meddelelseslinjen har intet kryds.

Der er også en besked: *12 opgaver viser datoerne, som de står i filen (ikke genberegnet).* Kun ved en `.xer` står der *12 opgaver viser datoerne, som Primavera gemte dem (ikke genberegnet).* Det tal tæller hver opgave, som filen har gemte datoer for, også de opgaver, der ikke afviger. Antallet af opgaver, der afviger efter genberegning, står i meddelelseslinjen. Hver opgave, som filen har gemte datoer for, får en orange blok i panelet *Egenskaber*, lige over *Start*: *Du ser de datoer, som Primavera gemte, ikke appens beregning.* Med en anden kilde står der *Du ser de datoer, som stod i filen, ikke appens beregning.* En anden linje siger, hvad der sker med denne opgave, når du genberegner: *Når du genberegner, ændrer denne opgave sig.* eller *Når du genberegner, forbliver denne opgave uændret.* Gantt, opgavetabellen og statuslinjen viser datoerne fra filen.

### Opgaver, der er startet eller færdige

En opgave, der er færdig, ligger på de dage, hvor den faktisk skete: fra den faktiske startdato til den faktiske slutdato. En opgave, der er i gang, starter på den dag, hvor den faktisk startede. Den slutter på den beregnede slutdato. Dette gælder i denne visning, efter genberegning og med alle beregningsprofiler, ligesom i Primavera og MS Project.

For en sådan opgave har filen ofte andre tidligste datoer. Primavera sætter den tidligste startdato for en opgave, der er i gang eller færdig, på statusdatoen. Du ser disse datoer i kolonnerne *Tidligste startdato* og *Tidligste slutdato*, ikke i *Start* og *Slutdato*. En opgave, der er færdig, tæller derfor aldrig som en forskel. En opgave, der er i gang, tæller kun, når slutdatoen afviger.

For en opgave, der er startet, kan du ikke længere skrive startdatoen. I opgavetabellen, i panelet *Egenskaber* og i *Rediger opgave* er startdatoen så skrivebeskyttet. For en opgave, der er færdig, gælder det også for slutdatoen i opgavetabellen. Ændr i stedet *Faktisk startdato* eller *Faktisk slutdato* med fremdriften. I Gantt flytter bjælken for en sådan opgave sig ikke; du får så en besked.

### Hvad der er tomt i denne visning

I denne visning beregner appen ingenting. Den viser kun, hvad filen har gemt. Du ser derfor kun slæk og kritisk vej, hvis filen indeholder dem. Hvis filen ikke har gemt nogen kritiske opgaver, viser statuslinjen 0 kritiske opgaver. Det siger intet om den kritiske vej i selve programmet. Det, der kun kommer ud af en beregning, findes ikke i denne visning: hvilke afhængigheder der styrer tidsplanen, overtrådte begrænsninger, opgaver der ligger ude af rækkefølge og næsten kritiske opgaver.

Gemmer filen ikke alt for en opgave, får den orange blok i panelet *Egenskaber* en tredje linje, for eksempel *Primavera har ikke gemt alt for denne opgave. Mangler: Tilladt slæk.* Med en anden kilde står der *Filen indeholder ikke alt for denne opgave.* De to første linjer bliver: for en sådan opgave ser du altså også, at datoerne kommer fra filen, og om opgaven ændrer sig, når du genberegner. De manglende værdier har samme navne som kolonnerne i opgavetabellen. I en CSV-eksport forbliver kolonnerne *Kritisk* og *Samlet slæk* tomme for en sådan opgave i stedet for et opdigtet nul.

### Sådan forlader du visningen

Du forlader visningen på to måder:

- Klik på *Genberegn* i meddelelseslinjen, eller vælg *Beregn* (F5). Appen beregner med sine egne regler.
- Ændr noget, der kan ændre datoerne, fx varigheden af en opgave eller en ny opgave. Appen forlader visningen og genberegner med det samme, også selv om *Beregn automatisk* er slået fra. Ændrer du et navn, en beskrivelse, en arbejdskategori eller en opgavetype, sker det ikke: visningen forbliver aktiv.

En kalenderændring fra ressourcebiblioteket lader visningen være aktiv og datoerne fra filen stå, men opdaterer tallet i meddelelseslinjen.

Når du har forladt visningen, er der ingen knap til at skifte tilbage. Ctrl+Z bringer den dog tilbage, lige efter at du har genberegnet, eller lige efter en sådan ændring. Ellers kan du åbne kildefilen igen. Ved en `.xer` slår det også visningen til igen, når du åbner en IFC-fil, som du gemte efter genberegningen, men ikke redigerede.

### Genoprettelse efter nedbrud

Genopretter du et projekt efter et nedbrud, der var i visningen, forbliver visningen aktiv. Var visningen slået fra, glemmer appen datoerne fra filen. Det aktive projekt viser samme meddelelseslinje som før. Et projekt på en anden fane viser meddelelseslinjen uden tal: *Du ser datoerne, som de står i filen. Der er ikke genberegnet.* Se [Genoprettelse efter nedbrud](docs://howto-herstellen-na-een-crash).

### Gemme og åbne igen

Gemmer du, mens du bruger visningen, skriver appen de viste datoer til IFC-filen sammen med kildeformatet. Åbner du IFC-filen igen senere, er visningen aktiv igen, uden en ny besked. Det gælder også, hvis du har ændret noget i visningen, der ikke påvirker datoerne, fx et navn. Appen åbner filen, sådan som du forlod den.

Gemmer du, efter du har forladt visningen, ved at genberegne eller ved en redigering, der kan ændre datoerne, indeholder filen appens egen beregning. Når du åbner den igen, ser du den beregning uden meddelelseslinje og uden blok i panelet *Egenskaber*. Der er én undtagelse: en `.xer`, som du kun har genberegnet og ikke redigeret (se ovenfor). Din redigerede tidsplan er nu tidsplanen; de gamle datoer fra kildepakken hører ikke længere til den. Vil du stadig se dem, så åbn kildefilen igen.

## Eksempel: tilbygningen

Stel dig, at du åbner en Primavera-fil *Uitbouw* (tilbygning) med to opgaver, på en kalender uden helligdage. I 2027 er 6. maj Kristi Himmelfartsdag, og 17. maj er pinsemandag: med helligdage i kalenderen kommer datoerne anderledes ud. *Fundering storten* (støbe fundamentet) tager 5 arbejdsdage, *Metselwerk* (murværk) 10 arbejdsdage, og Metselwerk følger Fundering med en afhængighed af typen slut til start. Filen gemmer, at Fundering løber fra mandag den 3. maj til fredag den 7. maj 2027, og at Metselwerk løber fra mandag den 17. maj til fredag den 28. maj 2027: en uge efter den tidligste startdato, som afhængigheden tillader. Den planlagte start for Metselwerk i filen er mandag den 10. maj 2027.

Lige efter at du har åbnet filen, ser du datoerne fra filen. Statuslinjen siger *Slut: 28-05-2027* og *Kritisk vej: 2 opgaver, 20 arbejdsdage*. Meddelelseslinjen melder, at 1 opgave afviger ved genberegning. Begge opgaver viser den orange blok *Du ser de datoer, som Primavera gemte, ikke appens beregning.* Under den siger Metselwerk *Når du genberegner, ændrer denne opgave sig.*, og Fundering siger *Når du genberegner, forbliver denne opgave uændret.*

Ved klik på *Genberegn* forbliver Fundering på 3. til 7. maj. Metselwerk starter nu mandag den 10. maj, den arbejdsdag efter Fundering slutter, og slutter fredag den 21. maj. Tidsplanen slutter 21. maj 2027 og spænder over 15 arbejdsdage i stedet for 20. Den kritiske vej består af de samme 2 opgaver.

Hvad hvis det er anderledes?

- Er Metselwerk også planlagt til mandag den 17. maj i filen, beholder beregningsprofilen *Primavera P6* den start. Beregningen giver 17. til 28. maj, der er ingen forskel, og visningen slår ikke til.
- Du tilføjer en opgave i visningen: det sker det samme som ved en genberegning. Metselwerk flyttes til 10. til 21. maj.
- Du gemmer i visningen og åbner IFC-filen igen uden at redigere: Metselwerk er tilbage på 17. til 28. maj.
- Du genberegner, gemmer uden at redigere mere og åbner IFC-filen igen: visningen er aktiv igen, og Metselwerk ligger på 17. til 28. maj.
- Du ændrer kun navnet på Metselwerk i visningen, gemmer og åbner igen: visningen er aktiv igen, og Metselwerk ligger på 17. til 28. maj.
- Du tilføjer en opgave i visningen, gemmer og åbner igen: appen glemmer datoerne fra filen. Metselwerk ligger på 10. til 21. maj, uden meddelelseslinje og uden blok.
- Fundering er allerede færdig i filen: den startede faktisk 3. maj og blev faktisk færdig 7. maj. Filen gemmer statusdatoen som dens tidligste startdato. Bjælken for Fundering ligger stadig på 3. til 7. maj, i visningen og efter genberegning. Fundering tæller ikke som en forskel.

## Konsekvenser og misforståelser

**En forskel er ikke en importfejl.** Appen beregner med sine egne regler: med en `.xer` med beregningsprofilen *Primavera P6*, med en `.mpp` med *Microsoft Project*, og med CSV, MS Project XML og Primavera P6 XML med *Open Planner Studio*. Hvorfor datoerne i kildepakken blev anderledes, kan ligge i filen eller i selve kildepakken. Visningen viser dig *at* de afviger.

**Visningen er ikke et beregningsresultat.** Appen har ikke beregnet datoerne. Overtag dem ikke bare som resultat af din egen tidsplan.

**Gemmer du i visningen, bevares datoerne fra kildepakken.** IFC-filen indeholder da det, kildepakken sagde, og ikke det, appen ville beregne.

**Efter en redigering, der kan ændre datoerne, kommer datoerne fra filen ikke tilbage.** Har du forladt visningen med en sådan redigering, ser du først appens egen beregning, når du har gemt og åbnet igen. En ændring af et navn tæller ikke: visningen forbliver så aktiv (se *Gemme og åbne igen*). Åbn kildefilen igen, hvis du vil se datoerne fra kildepakken.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvad appen gemmer i en fil, og hvad en import eller eksport bærer.
- [Åbn en Primavera P6-fil (.xer)](docs://howto-xer-openen): trinene og meddelelserne for en `.xer`-fil.
- [Åbn en MS Project-fil (.mpp)](docs://howto-mpp-openen): trinene og meddelelserne for en `.mpp`-fil.
- [Genoprettelse efter nedbrud](docs://howto-herstellen-na-een-crash): hvad der sker med dette projekt efter et nedbrud.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvordan appen beregner slæk og kritiskhed, når den faktisk beregner.
