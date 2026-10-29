# Importer fremdrift fra et ark

Mål: læg den fremdrift, som medarbejderne på pladsen udfylder i et regneark, ind i tidsplanen på én gang, uden at klikke på hver opgave selv.

## Hvornår har du brug for dette

En underentreprenør eller byggeleder har ikke appen, men melder sin fremdrift hver uge: hvor mange procent der er færdige, hvornår der er startet, hvornår der er afsluttet. Du sender ham et ark med dine opgaver. Han udfylder tre kolonner og sender det tilbage. Ud fra det læser appen kun tre værdier pr. opgave: færdiggørelsesgrad, faktisk startdato og faktisk slutdato. Resten af din tidsplan bliver urørt. Hvad appen gør med den fremdrift, står i [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang).

## Trin

### 1. Angiv statusdatoen og beregn

Angiv statusdatoen, som beskrevet i [Opdater fremdrift](docs://howto-voortgang-bijwerken). Byggelederen udfylder faktiske datoer til og med den dag. Hvis tidsplanen er forældet, genberegner appen den, før arket laves.

### 2. Lav arket

Vælg *Tidsplan › Fremdrift › Eksportér fremdriftsark*. Den samme knap står på fanerne *Tabel* og *Rapport*. Appen laver en Excel-fil og foreslår navnet *(projektnavn)-voortgang.xlsx*; i browseren havner filen i dine downloads. Foretrækker du en CSV? Vælg *Fil › Eksporter › Fremdriftsark (CSV)*. Excel-arket findes også, som *Fremdriftsark (Excel)*.

Arket har otte kolonner. Kolonnenavnene står på engelsk, med en kort instruktion på appens sprog efter dem:

- `OPS Task ID`, `WBS` og `Name` er kun der for at genkende opgaven. Lad dem være.
- `Start` og `Finish` er de planlagte datoer, til orientering. Appen skriver dem aldrig tilbage.
- `Completion (%)`, `Actual Start` og `Actual Finish` er dem, du udfylder.

Excel-arket er beskyttet uden adgangskode: kun de tre udfyldningskolonner kan redigeres. Excel kontrollerer, at en procentdel er mellem 0 og 100, og at en faktisk dato er en dato. En hovedopgave er markeret med grå farve og har teksten *— hovedopgave: udfyld ikke*.

### 3. Lad arket blive udfyldt

For hver opgave udfylder byggelederen:

- `Completion (%)`: 0 til og med 100. Appen læser også decimaltal, med komma eller punktum (for eksempel 33,3 eller 33.3). Instruktionen i CSV-filen beder stadig om hele tal: et regneark med en anden regional indstilling kan læse 8,38 som 838.
- `Actual Start` og `Actual Finish`: i Excel som en dato i din egen regionale indstilling; i CSV som dd-mm-åååå eller som åååå-mm-dd.

Det, der står tomt, ændrer ikke noget. En tom celle fjerner altså heller ikke eksisterende fremdrift; det kan kun gøres i appen. Byggelederen lader en opgave, der ikke er startet, være helt tom.

### 4. Læs arket ind

1. Vælg *Tidsplan › Fremdrift › Opdater fremdrift fra et ark* (også på fanerne *Tabel* og *Rapport*), eller *Fil › Importer › Opdater fremdrift fra et ark*. Vinduet *Opdater fremdrift fra et ark* åbnes.
2. Klik på *Vælg fil…* og vælg den udfyldte `.xlsx`- eller `.csv`-fil.
3. Hvis datoerne i en CSV-fil er tvetydige, spørger appen *Dag eller måned først?*, med datoen fra din fil læst på to måder. Klik på den dato, der er rigtig.
4. Nu ser du en forhåndsvisning. Øverst står fire tællere: *Anvendt*, *Uændret*, *Venter på sammenkædning* og *Afvist*. Nedenfor ser du pr. opgave, hvad der ændres, for eksempel *Færdiggørelsesgrad: 0% → 100%*.
5. Kontrollér forhåndsvisningen, og klik på *Anvend*. Vinduet viser *Resultat*, med tællerne og de rækker, der blev afvist, og hvorfor. Klik til sidst på *Luk*.

Du kan ikke springe forhåndsvisningen over. Knappen *Anvend* er slået fra, så længe der ikke er noget at anvende.

### 5. Genberegn tidsplanen

Indlæsning genberegner ikke af sig selv. Tryk på **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*, medmindre *Beregn automatisk* er slået til.

## Rækker, der ikke passer uden videre

Appen sammenkæder hver række med en opgave, først på `OPS Task ID` og ellers på WBS-nummeret.

**Sammenkædning er tvivlsom.** Hvis appen kun fandt opgaven via WBS-nummeret, står rækken under *Sammenkædning er tvivlsom*, med *Bekræft* og *Ændr*. Rækken bliver også anvendt, hvis du ikke gør noget; kontrollér derfor, at opgaven er rigtig. *Bekræft* fjerner rækken fra denne liste; det ændrer ikke noget ved det, der anvendes. *Ændr* lader dig vælge en anden opgave. Med *Fjern sammenkædning* fjerner du en sammenkædning, som du selv har lavet. Bemærk: et ark fra et andet projekt med de samme WBS-numre bliver alligevel sammenkædet, under *Sammenkædning er tvivlsom*, og anvendt, når du klikker på *Anvend*.

**Venter på sammenkædning.** Hvis appen ikke fandt nogen opgave, eller flere med samme WBS-nummer, står rækken under *Venter på sammenkædning*. Ved *Vælg en opgave…* vælger du den rigtige opgave; du søger på WBS-nummer eller navn. Hvis du ikke sammenkæder den, bliver rækken afvist.

## Faldgruber, og hvad appen gør

En række, der ikke passer, bliver afvist med en grund. Resten af arket fortsætter bare. Dette er de vigtigste beskeder:

- *Den faktiske dato ligger efter statusdatoen.* Sæt statusdatoen senere, eller ret arket.
- *Denne opgave er ifølge tidsplanen planlagt til at starte efter statusdatoen: udfyld først den faktiske startdato i arket.* Appen opfinder ingen startdato; du skal angive den i arket.
- *Procent uden for 0–100. Kontrollér decimaltegnet: 8,38 kan læses som 838 af et regneark med en anden lokalindstilling.*
- *Hovedopgaver kan ikke få fremdrift fra et ark.* Fremdriften for en fase følger af opgaverne under den.
- *Faktisk slutdato ligger før faktisk startdato.*
- *Ulæselig dato.* og *Ulæselig procent.*
- *De indtastede værdier strider mod hinanden.* For eksempel en faktisk slutdato med en procent under 100.
- *Ingen opgave fundet for denne række.* Arket nævner et opgave-ID og et WBS-nummer, som ikke findes i dette projekt.
- *Denne WBS-kode forekommer på flere opgaver — sammenkæd rækken manuelt.*
- *En anden række har denne opgave allerede.* To rækker peger på samme opgave.
- *Afvist af planværktøjet.* En anden afvisning fra tidsplanen selv, uden en egen besked.

Hvis hele filen afvises, vises en af disse beskeder i vinduet: *Denne fil har ingen kolonne “OPS Task ID” eller “WBS” til at sammenkæde rækker med opgaver.*, *Denne fil har ingen af kolonnerne Færdiggørelsesgrad, Faktisk startdato eller Faktisk slutdato.*, *Denne fil er for stor til at læse som fremdriftsark.* (mere end 16 MB), *Denne fil har for mange rækker til at læse som fremdriftsark.* (mere end 50.000 rækker) eller *Denne fil er beskyttet med adgangskode og kan ikke læses.* eller *Denne fil kunne ikke læses som fremdriftsark.*

**Ingen statusdato.** Hvis der endnu ikke er en statusdato, og importen anvender fremdrift, sætter appen den til i dag og siger det til dig. Angiv den selv først.

**Alt fortrydes på én gang.** Hele arket er ét trin for Ctrl+Z.

**Kun det du udfylder.** En række uden forskel til tidsplanen tæller som *Uændret*. En opgave uden række i arket forbliver, som den var.

## Se også

- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): hvad appen beregner med faktiske datoer og procenter.
- [Opdater fremdrift](docs://howto-voortgang-bijwerken): fremdrift indtastes i selve appen.
