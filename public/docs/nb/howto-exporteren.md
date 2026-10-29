# Eksportere

Mål: gi tidsplanen din videre som fil i et annet format, til noen som ikke leser IFC eller til et annet program.

## Når du trenger dette

Konsulenten jobber i MS Project, kunden i Primavera, underleverandøren vil ha aktivitetene i Excel, eller du sender en tidsplan til et program som ikke kan håndtere IFC. En eksport er en kopi i et annet format. Hvis du vil beholde selve prosjektet, lagrer du det: da skrives IFC, og alt tas med. Hva hvert format tar med og ikke tar med, står i [Filer og formater](docs://uitleg-bestanden).

## Steg

1. Velg *Hjem › Fil › Eksporter* og velg et format fra listen, eller velg *Fil › Eksporter*. Hvert format vises som et kort med en kort beskrivelse.
2. I vinduet velger du et navn og et sted. Appen foreslår prosjektnavnet, med filendelsen for formatet. Fremdriftsarkene heter *projectname-voortgang* og åpnes i nedlastingsmappen din der det er mulig.
3. Bekreft. Det kommer ingen melding hvis eksporten lykkes, bortsett fra meldingene under. Fra *Fil › Eksporter* går du etterpå tilbake til fanen *Hjem*, selv om du avbryter vinduet. Hvis du avbryter vinduet for en eksport fra listen på fanen *Hjem*, skjer det ingenting.

Hvis nettleseren din bare lagrer via en nedlasting (for eksempel Firefox), ligger filen i nedlastingsmappen din rett etter steg 1. Du ser meldingen *Lagret som nedlasting: 'name.xml' ligger nå i nedlastingsmappen din. Dette miljøet tillater ikke at appen skriver direkte til stedet du valgte.*

### Hvilket format velger du?

Listen på fanen *Hjem* og kortene i *Fil › Eksporter* tilbyr de samme formatene:

- *Fremdrift (Excel)* og *Fremdrift (CSV)*, på kortene *Fremdriftsark (Excel)* og *Fremdriftsark (CSV)*: et slankt ark med ID, WBS, navn, datoer og fullføringsgrad, som du sender til den som fyller inn fremdriften.
- *CSV (;)*, på kortet *CSV (semikolonseparert)*: en aktivitetstabell som du åpner i et regneark.
- *MS Project XML*: kan åpnes i Microsoft Project.
- *Primavera P6 XML*: for Oracle Primavera P6.
- *IFC*: appens eget format, med alt som er med, i IFC-skjemaet for prosjektet (standard IFC 4.3 ADD2).

### En IFC-eksport med en bibliotekfil

Hvis prosjektet ditt er koblet til et bibliotek, står avmerkingsboksen *Lagre bibliotekfilen ved siden av* under kortene i *Fil › Eksporter*. Hvis du krysser av og velger *IFC*, ber appen om et sted to ganger: først for prosjektet, en gang til for *projectname-bibliotheek.ifc*. Denne avmerkingsboksen står bare i *Fil › Eksporter*, ikke i listen på fanen *Hjem*.

### Lese inn et utfylt fremdriftsark igjen

Du leser et utfylt fremdriftsark inn igjen via *Fil › Importer*. Se [Importere fremdrift fra et regneark](docs://howto-voortgang-importeren).

## Fallgruver og hva appen gjør da

**Prosjektet ditt endres ikke.** Filen for prosjektet blir den samme, og markeringen *Ikke lagret* blir stående hvis den var der.

**En utdatert tidsplan blir omberegnet først.** Dermed får du de gjeldende datoene, selv om du glemte å trykke på *Beregn*.

**En eksport finnes også i Nylige.** Det gjelder ikke for fremdriftsarkene. Hvis du åpner en eksport der, åpnes den som en import av det formatet.

**En eksport tar ikke med alt.** En CSV-fil har ingen ressurser eller begrensninger, og P6 XML har ingen grunnlinjer og tidsfrister. Beregningsprofilen følger heller ikke med: en gjenåpnet eksport regnes ut som *Open Planner Studio*. Bare IFC tar med alt. Et eksempel med tall finner du i [Filer og formater](docs://uitleg-bestanden).

**To formater med samme filendelse.** MS Project XML og Primavera P6 XML får begge navnet *projectname.xml*. Gi dem ulike navn selv, ellers vet du ikke senere hvilket format hver fil har.

**En tidsplan med en sirkulær avhengighet eksporteres ikke.** Appen regner ut først, og stopper hvis det finnes en løkke. På fanen *Hjem* får du meldingen *Tidsplanen kunne ikke beregnes*, med under den for eksempel *Sirkulær avhengighet mellom aktiviteter: Set up site → Demolish existing extension → Set up site*. I *Fil › Eksporter* står bare den andre teksten på siden. Løs løkken og eksporter på nytt.

**Et prosjekt fra Primavera mister kildeinformasjon.** Hvis du eksporterer et slikt prosjekt til CSV, MS Project XML eller P6 XML, viser appen: *Eksport til CSV fører til tap av XER-kildeinformasjon.* For MS Project XML står det *MSPDI*, for P6 XML *P6*. Se [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen).

**Delte aktiviteter mister delingene sine.** MS Project og Primavera kjenner bare en deling som en fordeling av timer. Hvis prosjektet ditt har delte aktiviteter uten en fordeling av timer, viser appen etter en eksport til MS Project XML eller P6 XML: *2 aktiviteter med avbrudd er eksportert uten avbrudd: MS Project og P6 kjenner bare avbrudd som en arbeidsfordeling.* For én aktivitet står det *1 aktivitet med avbrudd er eksportert uten avbrudd: MS Project og P6 kjenner bare avbrudd som en arbeidsfordeling.* Se [Dele en aktivitet](docs://howto-taak-splitsen).

**En tidsplan i visningen *Datoer slik de er registrert*.** Hvis du eksporterer til CSV mens du ser datoene fra kildefilen, lar appen `Critical` og `Total Float` stå tomme for aktiviteter der kildefilen ikke registrerte dette. Se [Datoer slik de er registrert](docs://uitleg-datums-zoals-opgeslagen).

## Se også

- [Filer og formater](docs://uitleg-bestanden): hva hvert format tar med og ikke tar med.
- [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan): behold prosjektet ditt selv som IFC.
- [Importere fremdrift fra et regneark](docs://howto-voortgang-importeren): lese inn et utfylt fremdriftsark.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format hva som tas med og ikke.
