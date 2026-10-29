# Datoer slik de er lagret

Du åpner en tidsplan fra Primavera eller MS Project, og datoene avviker fra det du så i den pakken. Har importen gått galt? Vanligvis ikke. I denne artikkelen leser du hvorfor appen omberegner selv, når den viser datoene fra filen, hva som da er tomt, og hvordan du går tilbake til appens egen beregning. Eksemplet til slutt følger to aktiviteter gjennom hele forløpet.

## Begrepet

En tidsplanfil inneholder to slags data. For det første logikken: aktiviteter, varigheter, avhengigheter, kalendere og begrensninger. For det andre datoene som pakken selv har beregnet ut fra dette. Ved åpning bruker Open Planner Studio logikken og beregner selv. Datoene i filen er altså ikke inndata.

Hvis appens egen beregning gir andre datoer enn filen, vet du ikke hvilken side som har rett. Filen kan mangle logikk som pakken brukte. Pakken kan også beregne annerledes enn appen på et punkt. Derfor kan appen vise datoene **som lagret**: datoene den andre pakken skrev i filen. Da kan du sammenligne med det du så i den pakken.

## Slik håndterer appen det

### Hvilken beregningsprofil appen bruker

Appen beregner med en **beregningsprofil**: et sett med beregningsregler som bestemmer, for eksempel, hvordan den behandler planlagt start for en aktivitet og begrensninger. Se [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen). Det finnes tre innebygde profiler: *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. En `.xer`-fil åpnes med *Primavera P6* og en `.mpp`-fil med *Microsoft Project*. CSV, MS Project XML og Primavera P6 XML åpnes med *Open Planner Studio*. Profilen for et prosjekt finnes under *Fil › Prosjektinnstillinger*, ved *Beregningsprofil og beregningsalternativer*. En IFC-fil fra appen beholder sin profil.

### Når appen sammenligner

Ved åpning noterer appen hva filen sa, og sammenligner det med sitt eget resultat. Det gjør den for:

- en Primavera-fil (`.xer`) og Primavera P6 XML;
- MS Project XML og MS Project-filer (`.mpp`);
- en IFC-fil fra et annet program, for aktivitetene der de tidligste datoene står i filen;
- en IFC-fil fra appen selv som har husket sin opprinnelse. Nedenfor leser du når det er tilfelle.

Appen sammenligner aldri en CSV-fil: startdatoen i en CSV er inndata, ikke resultatet av en beregning. En IFC-fil fra appen selv uten husket opprinnelse sammenlignes heller ikke.

Avviker ingen aktivitet, merker du ingenting. Er minst én aktivitet forskjellig i en fil du importerer nå, slår appen visningen på med én gang.

Med en Primavera-fil beregner appen med beregningsprofilen *Primavera P6*. Den beholder den planlagte starten fra filen som tidligste start. En aktivitet som står senere i filen enn avhengighetene krever, men som også er planlagt der, blir derfor stående. Da er det ingen forskjell.

### Hva du ser

Under båndet står en meldingsrad: *Du ser datoene slik de står i filen. Ved omberegning avviker 4 aktiviteter*. Med en Primavera-kilde (en `.xer` eller Primavera P6 XML) står det *Du ser tidsplanen slik Primavera lagret den. Ved omberegning avviker 1 aktivitet*. Til høyre i meldingsraden er knappen *Omberegn*. Meldingsraden har ingen kryss.

Det står også en melding: *12 aktiviteter viser datoene slik de står i filen (ikke omberegnet).* Bare med en `.xer` står det *12 aktiviteter viser datoene slik Primavera lagret dem (ikke omberegnet).* Tallet teller alle aktiviteter som har datoer lagret i filen, også de som ikke avviker. Antallet aktiviteter som avviker etter omberegning, står i meldingsraden. Hver aktivitet som har datoer lagret i filen, viser et oransje merke i panelet *Egenskaper*, rett over *Start*: *Du ser datoene Primavera lagret, ikke appens beregning*. Med en annen kilde står det *Du ser datoene som lå i filen, ikke appens beregning*. En andre linje sier hva som skjer med aktiviteten når du omberegner: *Ved å omberegne endres denne aktiviteten* eller *Ved å omberegne forblir denne aktiviteten uendret*. Gantt-diagrammet, aktivitetstabellen og statuslinjen viser datoene fra filen.

### Aktiviteter som er startet eller ferdige

En aktivitet som er ferdig, ligger på de dagene den faktisk skjedde: fra faktisk start til faktisk slutt. En aktivitet som pågår, starter på dagen den faktisk startet. Den slutter på den beregnede slutten. Dette gjelder i denne visningen, etter omberegning og med alle beregningsprofiler, slik som i Primavera og MS Project.

For en slik aktivitet registrerer filen ofte andre tidligste datoer. Primavera setter den tidligste starten for en aktivitet som pågår eller er ferdig, på statusdatoen. Du ser de datoene i kolonnene *Tidligste start* og *Tidligste slutt*, ikke i *Start* og *Slutt*. En aktivitet som er ferdig, teller derfor aldri som en forskjell. En aktivitet som pågår, teller bare når slutten avviker.

For en aktivitet som er startet, kan du ikke lenger skrive inn starten. I aktivitetstabellen, i panelet *Egenskaper* og i *Rediger aktivitet* er starten da skrivebeskyttet. For en aktivitet som er ferdig, gjelder dette også slutten i aktivitetstabellen. Endre i stedet *Faktisk start* eller *Faktisk slutt*, via fremdriften. I Gantt-diagrammet flytter ikke stolpen for en slik aktivitet; du får da en melding.

### Hva som er tomt i denne visningen

I denne visningen beregner appen ingenting. Den viser bare det filen lagret. Du ser derfor slakk og kritisk linje bare hvis filen inneholder dem. Registrerer filen ingen kritiske aktiviteter, viser statuslinjen 0 kritiske aktiviteter. Det sier ingenting om den kritiske linjen i selve pakken. Det som bare kommer ut av en beregning, finnes ikke i denne visningen: hvilke avhengigheter som styrer tidsplanen, brutte begrensninger, aktiviteter som går ut av rekkefølge og nesten kritiske aktiviteter.

Registrerer filen ikke alt for en aktivitet, får det oransje merket i panelet *Egenskaper* en tredje linje, for eksempel *Primavera har ikke lagret alt for denne aktiviteten. Mangler: Fri slakk*. Med en annen kilde står det *Filen inneholder ikke alt for denne aktiviteten.* De to første linjene blir stående: for en slik aktivitet ser du også at datoene kommer fra filen, og om aktiviteten endres når du omberegner. De manglende verdiene har samme navn som kolonnene i aktivitetstabellen. I en CSV-eksport står kolonnene *Kritisk* og *Totalslakk* tomme for en slik aktivitet, i stedet for en oppdiktet null.

### Å forlate visningen

Du forlater visningen på to måter:

- Klikk på *Omberegn* i meldingsraden, eller velg *Beregn* (F5). Appen beregner med sine egne regler.
- Endre noe som kan endre datoene, for eksempel varigheten til en aktivitet eller en ny aktivitet. Appen forlater visningen og beregner med én gang, også når *Beregne automatisk* er av. Å endre et navn, en beskrivelse, en arbeidskategori eller en aktivitetstype gjør ikke det: visningen blir stående.

En kalenderendring fra ressursbiblioteket lar visningen og datoene fra filen bli stående, men oppdaterer tallet i meldingsraden.

Etter at du har forlatt visningen, finnes det ingen knapp for å gå tilbake til den. Ctrl+Z gir den tilbake rett etter omberegning eller rett etter en slik redigering. Ellers kan du åpne kildefilen på nytt. Med en `.xer` slår også det å åpne en IFC-fil som du lagret etter omberegning, men ikke redigerte, visningen på igjen.

### Gjenoppretting ved brudd

Gjenoppretter du et prosjekt etter et krasj som var i visningen, blir visningen stående. Var visningen av, glemmer appen datoene fra filen. Prosjektet som var aktivt, viser samme meldingsrad som før. Et prosjekt på en annen fane viser meldingsraden uten tall: *Du ser datoene slik de står i filen. Det er ikke omberegnet*. Se [Gjenoppretting ved brudd](docs://howto-herstellen-na-een-crash).

### Lagring og gjenåpning

Lagrer du mens du bruker visningen, skriver appen de viste datoene til IFC-filen, sammen med kildeformatet. Åpner du den IFC-filen igjen senere, er visningen på igjen, uten en ny melding. Det gjelder også om du har endret noe i visningen som ikke påvirker datoene, for eksempel et navn. Appen åpner filen slik du forlot den.

Lagrer du etter at du har forlatt visningen, ved omberegning eller ved en redigering som kan endre datoene, inneholder filen appens egen beregning. Når du åpner den på nytt, ser du den beregningen, uten meldingsrad og uten merke i panelet *Egenskaper*. Ett unntak finnes: en `.xer` som du bare har omberegnet og ikke redigert (se ovenfor). Den redigerte tidsplanen er nå den gjeldende tidsplanen; de gamle datoene fra kildepakken hører ikke lenger til den. Vil du likevel se dem, åpner du kildefilen på nytt.

## Eksempel: tilbygget

Anta at du åpner en Primavera-fil *Uitbouw* (tilbygg) med to aktiviteter, på en kalender uten helligdager. I 2027 er 6. mai Kristi himmelfartsdag, og 17. mai er pinsemandag. Med helligdager i kalenderen blir datoene annerledes. *Fundering storten* (støpe fundamentet) varer 5 arbeidsdager, *Metselwerk* (murverk) varer 10 arbeidsdager, og Metselwerk følger Fundering med en avhengighet av typen slutt-til-start. Filen registrerer at Fundering går fra mandag 3. mai til fredag 7. mai 2027, og Metselwerk fra mandag 17. mai til fredag 28. mai 2027: en uke etter den tidligste starten avhengigheten tillater. Den planlagte starten for Metselwerk i filen er mandag 10. mai 2027.

Rett etter åpning ser du datoene fra filen. Statuslinjen sier *Slutt: 28-05-2027* og *Kritisk linje: 2 aktiviteter, 20 arbeidsdager*. Meldingsraden melder at 1 aktivitet avviker ved omberegning. Begge aktivitetene viser det oransje merket *Du ser datoene Primavera lagret, ikke appens beregning*. Under det sier Metselwerk *Ved å omberegne endres denne aktiviteten*, og Fundering sier *Ved å omberegne forblir denne aktiviteten uendret*.

Ved *Omberegn* blir Fundering stående på 3. til 7. mai. Metselwerk starter nå mandag 10. mai, den første arbeidsdagen etter at Fundering slutter, og slutter fredag 21. mai. Tidsplanen slutter 21. mai 2027 og varer 15 arbeidsdager i stedet for 20. Den kritiske linjen består av de samme 2 aktivitetene.

Hva om det er annerledes?

- Er Metselwerk også planlagt på mandag 17. mai i filen, beholder beregningsprofilen *Primavera P6* den starten. Beregningen gir 17. til 28. mai. Det er ingen forskjell, og visningen slås ikke på.
- Du legger til en aktivitet i visningen. Det gir samme omberegning. Metselwerk flytter til 10. til 21. mai.
- Du lagrer i visningen og åpner IFC-filen igjen uten å redigere: Metselwerk står igjen på 17. til 28. mai.
- Du omberegner, lagrer uten å redigere mer og åpner IFC-filen igjen: visningen er på igjen, og Metselwerk står på 17. til 28. mai.
- Du endrer bare navnet på Metselwerk i visningen, lagrer og åpner igjen: visningen er på igjen, og Metselwerk står på 17. til 28. mai.
- Du legger til en aktivitet i visningen, lagrer og åpner igjen: appen glemmer datoene fra filen. Metselwerk står på 10. til 21. mai, uten meldingsrad og uten merke.
- Fundering er allerede ferdig i filen: den faktiske starten var 3. mai og den faktiske slutten 7. mai. Filen har statusdatoen som tidligste start. Stolpen for Fundering står fortsatt på 3. til 7. mai, i visningen og etter omberegning. Fundering teller ikke som en forskjell.

## Konsekvenser og misforståelser

**En forskjell er ikke en importfeil.** Appen beregner med sine egne regler: med en `.xer` og beregningsprofilen *Primavera P6*, med en `.mpp` og *Microsoft Project*, og med CSV, MS Project XML og Primavera P6 XML med *Open Planner Studio*. Hvorfor datoene i kildepakken ble annerledes, kan ligge i filen eller i pakken. Visningen viser deg *at* de avviker.

**Visningen er ikke et beregningsresultat.** Appen har ikke beregnet datoene. Ta dem ikke bare over som resultatet av din egen tidsplan.

**Lagring i visningen beholder datoene fra kildepakken.** IFC-filen inneholder da det kildepakken sa, ikke det appen ville ha beregnet.

**Etter en redigering som kan endre datoene, kommer ikke datoene fra filen tilbake.** Forlot du visningen med en slik redigering, ser du først appens egen beregning når du har lagret og åpnet filen på nytt. Å endre et navn teller ikke: visningen blir da stående (se *Lagring og gjenåpning*). Vil du se datoene fra kildepakken, åpner du kildefilen på nytt.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hva appen beholder i en fil, og hva en import eller eksport tar med.
- [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen): stegene og meldingene for en `.xer`-fil.
- [Åpne en MS Project-fil (.mpp)](docs://howto-mpp-openen): stegene og meldingene for en `.mpp`-fil.
- [Gjenoppretting ved brudd](docs://howto-herstellen-na-een-crash): hva som skjer med dette prosjektet etter et krasj.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvordan appen beregner slakk og kritisk linje, når den beregner.
