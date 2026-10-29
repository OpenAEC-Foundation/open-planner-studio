# Eksport

Mål: overdrag din tidsplan som en fil i et andet format, til iemand, der ikke læser IFC, eller til et andet program.

## Hvornår du har brug for dette

Rådgiveren arbejder i MS Project, bygherren i Primavera, underentreprenøren vil have opgaverne i Excel, eller du sender en tidsplan til et program, der ikke kan håndtere IFC. En eksport er en kopi i et andet format. Vil du beholde selve projektet, så gem det: det skriver IFC og tager alt med. Hvad hvert format bevarer, og hvad det ikke bevarer, står i [Filer og formater](docs://uitleg-bestanden).

## Trin

1. Vælg *Start › Fil › Eksportér* og vælg et format fra listen, eller vælg *Fil › Eksportér*. Her er hvert format et kort med en kort beskrivelse.
2. I vinduet vælger du et navn og en placering. Appen foreslår projektnavnet med formatets filendelse. Fremdriftsarkene hedder *projektnavn-fremdrift* og åbnes i din downloadmappe, hvis det kan.
3. Bekræft. Der vises ingen besked, hvis eksporten lykkes, undtagen de beskeder herunder. Fra *Fil › Eksportér* vender du bagefter tilbage til fanen *Start*, også hvis du annullerer vinduet. Hvis du annullerer vinduet ved en eksport fra listen på fanen *Start*, sker der ikke noget.

Hvis din browser kun gemmer via en download (for eksempel Firefox), ligger filen i din downloadmappe straks efter trin 1. Du ser beskeden *Gemt som download: 'name.xml' ligger nu i din downloadmappe. Dette miljø tillader ikke, at appen skriver direkte til den valgte placering.*

### Hvilket format vælger du?

Listen på fanen *Start* og kortene i *Fil › Eksportér* tilbyder de samme formater:

- *Fremdrift (Excel)* og *Fremdrift (CSV)*, på kortene *Fremdriftsark (Excel)* og *Fremdriftsark (CSV)*: et smalt ark med id, WBS, navn, datoer og færdiggørelsesgrad, som du sender rundt til den, der udfylder fremdriften.
- *CSV (;)*, på kortet *CSV (semikolonsepareret)*: en opgaveliste, som du åbner i et regneark.
- *MS Project XML*: kan åbnes i Microsoft Project.
- *Primavera P6 XML*: til Oracle Primavera P6.
- *IFC*: appens eget format, med alt i det, i IFC-skemaet for projektet (standard IFC 4.3 ADD2).

### En IFC-eksport med en biblioteksfil

Hvis dit projekt er koblet til et bibliotek, står afkrydsningsfeltet *Gem biblioteksfilen ved siden af* under kortene i *Fil › Eksportér*. Hvis du sætter kryds i det og vælger *IFC*, spørger appen to gange om en placering: først for projektet, derefter for *projektnavn-bibliotek.ifc*. Dette afkrydsningsfelt findes kun i *Fil › Eksportér*, ikke i listen på fanen *Start*.

### Gendannelse af et fremdriftsark

Du læser et udfyldt fremdriftsark ind igen via *Fil › Importer*. Se [Import af fremdrift fra et regneark](docs://howto-voortgang-importeren).

## Faldgruber og hvad appen gør så

**Dit projekt ændres ikke.** Filen til dit projekt bliver den samme, og markeringen *Ikke gemt* bliver, hvis den var der.

**En forældet tidsplan genberegnes først.** Så får du de aktuelle datoer, også selv om du har glemt at trykke på *Beregn*.

**En eksport står også i Seneste.** Det gælder ikke for fremdriftsarkene. Hvis du åbner en eksport der, åbnes den som import af det format.

**En eksport bevarer ikke alt.** En CSV-fil har ingen ressourcer eller begrænsninger, og P6 XML har ingen oprindelige planer og deadlines. Beregningsprofilen følger heller ikke med: en genåbnet eksport beregnes som *Open Planner Studio*. Kun IFC bevarer alt. Du finder et eksempel med tal i [Filer og formater](docs://uitleg-bestanden).

**To formater med samme filendelse.** MS Project XML og Primavera P6 XML får begge navnet *projektnavn.xml*. Giv dem selv forskellige navne, ellers ved du senere ikke, hvilken fil der hører til hvilket format.

**En tidsplan med en cirkulær afhængighed eksporteres ikke.** Appen beregner først og stopper, hvis der er en løkke. På fanen *Start* får du beskeden *Tidsplanen kunne ikke beregnes*, og nedenunder står for eksempel *Cirkulær afhængighed mellem opgaver: Set up site → Demolish existing extension → Set up site*. I *Fil › Eksportér* står kun den anden tekst på siden. Løs løkken, og eksportér igen.

**Et projekt fra Primavera mister kildeoplysninger.** Hvis du eksporterer et sådant projekt til CSV, MS Project XML eller P6 XML, melder appen: *Ved eksport til CSV går XER-kildeoplysninger tabt.* For MS Project XML står der *MSPDI*, for P6 XML *P6*. Se [Åbn en Primavera P6-fil (.xer)](docs://howto-xer-openen).

**Opdelte opgaver mister deres opdelinger.** MS Project og Primavera kender kun en opdeling som en fordeling af timer. Hvis dit projekt indeholder opdelte opgaver uden en fordeling af timer, melder appen efter en eksport til MS Project XML eller P6 XML: *2 opgaver med afbrydelser er eksporteret uden afbrydelser: MS Project og P6 kender afbrydelser kun som fordeling af arbejde.* For én opgave står der *1 opgave med afbrydelse er eksporteret uden afbrydelse: MS Project og P6 kender afbrydelser kun som fordeling af arbejde.* Se [Opdeling af en opgave](docs://howto-taak-splitsen).

**En tidsplan i visningen *Datoer som registreret*.** Hvis du eksporterer til CSV, mens du ser datoerne fra kildefilen, lader appen `Critical` og `Total Float` stå tomme for opgaver, som kildefilen ikke har registreret det for. Se [Datoer som registreret](docs://uitleg-datums-zoals-opgeslagen).

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvad hvert format bevarer, og hvad det ikke bevarer.
- [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan): at beholde selve dit projekt som IFC.
- [Import af fremdrift fra et regneark](docs://howto-voortgang-importeren): indlæsning af et udfyldt fremdriftsark.
- [Import- og eksportformater](docs://ref-import-exportformaten): pr. format, hvad der overføres, og hvad der ikke overføres.
