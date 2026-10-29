# Sådan åbner du en MS Project-fil (.mpp)

Mål: åbn en tidsplan fra Microsoft Project direkte i appen, uden at eksportere den først.

## Hvornår du har brug for dette

En entreprenør, konsulent eller opdragsgiver sender dig deres tidsplan som en `.mpp`-fil. Du vil se den, beregne den eller videreudvikle den. Appen læser `.mpp`-filer fra MS Project 2010 op til og med 2021. Den læser kun: den skriver ikke `.mpp` og ændrer aldrig din fil. Fra filen henter den selve tidsplanen: opgaver med struktur, varighed og begrænsninger, afhængigheder med forsinkelse, kalendere, ressourcer, tildelinger og fremdrift. Den læser også datoerne og slækken, som MS Project selv har beregnet. Den bruger dem kun til visningen *Datoer som de står i filen*, aldrig som input.

## Trin

1. Vælg *Start › Fil › Åbn* eller tryk på Ctrl+O. Vælg `.mpp`-filen.
2. Projektet åbnes i en ny fane, eller i den aktuelle fane, hvis den stadig er tom og uændret. Projektet har ingen fil: *Gem* skriver senere en ny IFC-fil. Derefter forklarer et vindue kort, hvad appen har overtaget fra filen, og hvordan gemning fungerer; se [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan).
3. Læs meddelelsen nederst: *Dit projekt beregnes som Microsoft Project. Ændr det via Fil → Projektinfo → Beregningsprofil og beregningsindstillinger.* Appen beregner dette projekt med beregningsreglerne i MS Project: beregningsprofilen *Microsoft Project*. Med *Åbn beregningsprofil* går du til indstillingen. *Læs mere* åbner hjælpen om beregningsprofiler.
4. Kontrollér, om der står en meddelelseslinje under båndet: *Du ser datoerne, som de står i filen; ved at genberegne forskydes 4 opgaver.* Så afviger appens resultat for disse opgaver fra de datoer, som MS Project har gemt. Under meddelelsen fra trin 3 står der så også en linje: *4 opgaver viser datoerne, som de står i filen (ikke genberegnet).* Hvad det betyder, og hvordan du skifter til appens egen beregning, står i [Datoer som de står i filen](docs://uitleg-datums-zoals-opgeslagen).
5. Hvis der står *Denne fil indeholder timeplanlægning.* med knappen *Slå timeplanlægning til*, indeholder filen data i timer. Se [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten).

Hvis filen indeholder opgaver med afbrydelser, udjævning eller ressourcestyret tidsplan, tilføjes en anden meddelelse, for eksempel *Denne MS Project-fil indeholder 3 opgaver med afbrydelser, udjævning eller ressourcestyret tidsplan. De indlæses og vises sådan.* Gælder det kun én opgave, står meddelelsen i ental.

## Faldgruber, og hvad appen gør så

**Ikke alt følger med.** Efter åbningen fortæller appen dig i één meddelelse, hvad den ikke har overtaget: *Ikke alt fra denne MS Project-fil er overtaget.* Under den står der én linje pr. punkt med antallet, for eksempel *2 oprindelige planer er ikke overtaget.* Ved en `.mpp` er sætningen om beregningsprofilen fra trin 3 så den første linje i denne meddelelse. Meddelelsen bliver stående, til du klikker på krydset. Er der intet gået tabt, får du ikke denne meddelelse. En linje kan handle om:

- indsatte projekter (underprojekter): appen læser dem som en almindelig opgave, uden forbindelsen til den anden fil;
- eksterne opgaver fra et andet projekt: appen læser dem som en almindelig opgave;
- oprindelige planer: fra en `.mpp` overtager appen ingen oprindelig plan, fra MS Project XML kun oprindelig plan 0 for opgaver, og af dén kun datoerne og varigheden (for en opgave i timer også tidspunktet; ikke arbejde og omkostning, og ingen oprindelige planer for ressourcer og tildelinger);
- med MS Project XML: en tildeling, hvis oprindelige plan har andre datoer end opgaven. Appen beholder kun den oprindelige plan for opgaven. Er de ens, går der intet tabt, og appen melder intet. Et andet tidspunkt på samme dag tæller også som forskel;
- brugerdefinerede felter med værdier, for eksempel brugerdefinerede felter, værdier fra en opslagstabel og outline-koder (appen tæller ikke ja/nej-felter i en `.mpp`);
- noter (også en note, der kun består af et billede) på ressourcer og tildelinger, og fra en `.mpp` også på opgaver (fra MS Project XML følger noten på en opgave med som dens beskrivelse);
- hyperlinks;
- de faste omkostninger for opgaver;
- satserne for ressourcer: fra en `.mpp` overhovedet ingen sats, fra MS Project XML kun standardsatsen;
- kun med MS Project XML: manuelt planlagte opgaver (appen beregner dem automatisk), inaktive opgaver (de er med i beregningen) og udjævningsforskydningen;
- kun med en `.mpp`: den kritiske grænseværdi fra MS Project; appen bruger grænseværdi 0.

En WBS-kode, som du selv har udfyldt i MS Project, overtages; ellers nummererer appen opgaverne efter strukturen.

**En fil fra MS Project 2007 eller ældre.** Appen afviser den og melder: *Denne .mpp-fil har et gammelt format (Project 2007 eller ældre). Eksportér den i MS Project som XML (Fil → Gem som → XML), og åbn den fil.* Under meddelelsen tilføjer appen en teknisk årsag på engelsk.

**En fil med adgangskode.** Appen melder: *Denne .mpp-fil er beskyttet med en adgangskode. Eksportér den i MS Project som XML (Fil → Gem som → XML), og åbn den fil.* Også her følger en teknisk årsag på engelsk med meddelelsen.

**En fil, der viser sig ikke at være en `.mpp`.** Du får *Kunne ikke åbne filen* med en teknisk årsag.

**XML-vejen beregner anderledes.** Hvis du åbner XML-eksporten fra MS Project i stedet for `.mpp`, beregner appen med beregningsprofilen *Open Planner Studio*, og du ser ikke meddelelsen om *Microsoft Project*. Datoerne kan så blive anderledes end med `.mpp`-filen. Også med XML-eksporten fortæller appen dig, hvad den ikke overtager; se *Ikke alt følger med*.

**En redigering slipper MS Projects styring.** Hvis du redigerer en opgave, hvis tidsplan blev styret af MS Projects datovindue, melder appen det één gang pr. projekt: *Datovinduet fra MS Project styrer ikke længere 2 opgaver efter denne redigering; selve fordelingen af arbejde gælder stadig og er gemt i filen.* Gælder det kun én opgave, står meddelelsen i ental.

**Gemning overskriver aldrig din `.mpp`.** Projektet har ingen fil. *Gem* spørger, hvor den nye IFC-fil skal gemmes.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor en `.mpp` kun læses, og hvad gemning skriver.
- [Datoer som de står i filen](docs://uitleg-datums-zoals-opgeslagen): visningen af MS Projects egne datoer.
- [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten): hvis filen indeholder data i timer.
- [Sådan åbner du en Primavera P6-fil (.xer)](docs://howto-xer-openen): det samme for Primavera.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format, hvad der overtages, og hvad der ikke overtages.
- [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen): hvorfor en MS Project-fil åbnes med sin egen beregningsprofil.
