# Filer og formater

Hva er egentlig i filen du lagrer? Og hva skjer med tidsplanen din når du eksporterer den til et annet program? I denne artikkelen leser du hvordan appen håndterer filer: IFC som eget format, de andre formatene som oversettere, hva en eksport lar være igjen, og hvordan lagring, automatisk lagring og gjenoppretting ved brudd skiller seg fra hverandre. Eksemplet til slutt viser med tall hva en eksport gjør.

## Begrepet

Open Planner Studio har et eget filformat: **IFC**, et åpent utvekslingsformat for byggeinformasjon fra buildingSMART. Appen skriver IFC-skjemaet for prosjektet, som standard IFC 4.3 ADD2 (se [Velge IFC-skjema](docs://howto-ifc-schema-kiezen)); i eksportlisten heter det *IFC*. Det finnes ikke et annet, proprietært prosjektformat. *Lagre* skriver hele prosjektet ditt som en IFC-fil (`.ifc`), og *Åpne* leser en slik fil tilbake. Vil du se hva som går inn i filen? Fanen *IFC* er en redigeringsvisning som viser IFC-teksten for prosjektet ditt. *Generer IFC* oppdaterer teksten, og *Kopier* legger den på utklippstavlen. Endrer du teksten, laster *Bruk* den inn som prosjektet ditt. Det erstatter hele prosjektet i den fanen.

Alle andre formater er **adaptere**: oversettere mellom modellen i et annet program og modellen i appen. Appen leser CSV, MS Project XML, Primavera P6 XML, MS Project-filer (`.mpp`) og Primavera-filer (`.xer`). Den skriver CSV, MS Project XML, Primavera P6 XML og to fremdriftsark. Du kan ikke eksportere til `.mpp` eller `.xer`.

Hvorfor er den forskjellen viktig? En oversetter kan bare ta med det begge sidene kjenner til. IFC-filen til appen beholder alt som hører til prosjektet ditt. Hvert annet format mangler en del av det, og den delen blir liggende igjen.

## Hvordan appen håndterer filer

### Hva åpning gjør

Appen velger leseren etter filendelsen: `.ifc`, `.csv`, `.xml`, `.mpp` eller `.xer`. Med en `.xml`-fil ser den inni filen for å finne ut om det er MS Project XML eller Primavera P6 XML. En ukjent filendelse behandles som IFC. Hvis filen ikke er IFC, melder appen *Kunne ikke åpne fil*, med årsaken.

Hver fil åpnes i en egen fane. Unntaket er en fane som fortsatt er tom og uendret: den fanen tar over filen. Én Primavera-fil kan gi flere faner, én for hvert prosjekt som har aktiviteter.

Etter åpning omberegner appen alltid. Hvis filen kommer fra et annet program, kan datoene avvike fra det filen sa. Dette er beskrevet i [Datoer slik de er lagret](docs://uitleg-datums-zoals-opgeslagen).

Bare en IFC-fil blir **lagringsmålet**: filen *Lagre* skriver tilbake til. En CSV-, XML-, `.mpp`- eller `.xer`-fil blir det ikke. Et slikt prosjekt har ingen fil etter åpning; *Lagre* spør da hvor den nye IFC-filen skal ligge. Slik overskriver Ctrl+S aldri den opprinnelige filen din med IFC-tekst.

### Hva lagring skriver

*Lagre* skriver alltid hele prosjektet. Dette tas med:

- aktiviteter med struktur, varighet, datoer og fremdrift;
- avhengigheter med forsinkelse, begrensninger og tidsfrister;
- kalendere, ressurser og tilordninger, inkludert kurvene;
- grunnlinjer, aktivitetskoder, egendefinerte felt og notater;
- koblinger mellom prosjekter;
- prosjektinnstillingene, for eksempel statusdatoen, beregningsprofilen og beregningsvalgene;
- koblingen til et bibliotek med ressurser.

Det du setter på skjermen, hører ikke til prosjektet, og det tas ikke med: zoom, rulleposisjon, den valgte aktiviteten og sammenklappede faser. Innstillingene dine i appen, for eksempel språk og tema, er heller ikke i filen. Appen holder dem selv, i appen eller i nettleseren din.

En eksport til et annet format endrer ikke prosjektet ditt. Etter en eksport har prosjektet fortsatt samme lagringsmål, og det er fortsatt merket *Ikke lagret* hvis det var det før.

### Hva en eksport mister

Hver adapter tar med det formatet kjenner til.

**MS Project XML** tar med aktiviteter, avhengigheter, kalendere, ressurser, tilordninger, begrensninger, tidsfrister og statusdatoen. Av grunnlinjene dine tas bare den aktive med. Aktivitetskoder, egendefinerte felt, notater og koblinger mellom prosjekter tas ikke med. En annen begrensning på en aktivitet tas ikke med. En begrensning *Må starte på (MSO)* eller *Må slutte på (MFO)* uten valget *Obligatorisk (fastlåsing)* kommer tilbake som *Start ikke tidligere enn (SNET)* eller *Slutt ikke tidligere enn (FNET)*. *Manuelt planlagt* og *Utjevningsforsinkelse* for en aktivitet kommer ikke tilbake. En hengekøye blir en vanlig aktivitet med beregnede datoer.

**Primavera P6 XML** tar med aktiviteter, avhengigheter, kalendere, ressurser, tilordninger, begrensninger og statusdatoen. Grunnlinjer og tidsfrister tas ikke med, og heller ikke aktivitetskoder, egendefinerte felt, notater og koblinger mellom prosjekter. En hengekøye blir også her en vanlig aktivitet. P6 har ingen forsinkelse i prosent: appen gjør en slik forsinkelse om til et fast antall dager. En forsinkelse i kalenderdager blir en forsinkelse i arbeidsdager.

**CSV** er en aktivitetsliste. Filen har disse kolonnene for hver aktivitet: task id, WBS, level, name, duration, start, finish, predecessors, work category, ID-en til en egendefinert arbeidskategori (`OPS Custom Task Type ID`), status, completion, actual start and finish, critical, total float og description. Ressurser, tilordninger, kalendere, begrensninger, tidsfrister, grunnlinjer og statusdatoen er ikke med. Kolonneoverskriftene er alltid på engelsk.

**Bare IFC tar med beregningsprofilen og beregningsvalgene.** Hvis du eksporterer til CSV, MS Project XML eller Primavera P6 XML, er profilen ikke med i filen. Av beregningsvalgene skriver MS Project XML høyst den kritiske terskelverdien. En slik fil åpnes igjen som *Open Planner Studio*. Hvis prosjektet ditt ble beregnet med *Primavera P6* eller *Microsoft Project*, for eksempel fordi det kommer fra en `.xer`- eller `.mpp`-fil, kan datoene forskyves på grunn av det. Hva en beregningsprofil er, forklares i [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen).

Kommer prosjektet ditt fra en Primavera-fil (`.xer`), også når du har lagret det som IFC på et mellomtrinn, melder appen etter en eksport til CSV, MS Project XML eller P6 XML: *Eksport til CSV fører til tap av XER-kildeinformasjon*. For MS Project XML står det *MSPDI* i stedet for *CSV*, for P6 XML står det *P6*. Du får ikke den meldingen for IFC: IFC-filen tar med kildefilen fra Primavera. Se [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen).

Appen gjør to ting til ved en eksport. Hvis tidsplanen ikke lenger er oppdatert, omberegner den først og eksporterer etterpå. Og den eksporterer ikke en tidsplan med en sirkulær avhengighet: du får en melding med sløyfen, for eksempel *Sirkulær avhengighet mellom aktiviteter: Set up site → Demolish existing extension → Set up site*.

### Lagre, automatisk lagring og gjenoppretting ved brudd

Dette er tre forskjellige ting. De ser like ut, men de skriver til et annet sted.

**Lagre** gjør du selv. Appen skriver prosjektet ditt til filen din og fjerner merket *Ikke lagret*.

**Automatisk lagring** er som standard av, og du slår den på selv for hvert prosjekt. Appen skriver da uten dialogboks til samme fil når det er endringer, høyst én gang hvert tiende sekund. Det virker bare hvis prosjektet allerede har en fil. Se [Slå på automatisk lagring](docs://howto-automatisch-opslaan).

**Gjenoppretting ved brudd** er alltid på. Så snart det er en endring et sted, lagrer appen også høyst én gang hvert tiende sekund en gjenopprettingskopi av alle åpne prosjekter, også prosjekter du selv ikke har endret. Den kopien ligger ikke i prosjektfilen din: i skrivebordsappen ligger den i datamappen til appen, i nettleseren ligger den i nettleserens lagring. Ved neste start tilbyr appen den kopien. Du leser mer om det i [Gjenoppretting etter et brudd](docs://howto-herstellen-na-een-crash). Gjenoppretting ved brudd skriver aldri til prosjektfilen din.

Fordi en kopi høyst lagres hvert tiende sekund, kan du miste de siste sekundene med arbeid ved et brudd.

### Skrivebord og nettleser

Skrivebordsappen og nettleserversjonen gjør det samme med prosjektet ditt, men de skriver filer på en annen måte.

På skrivebordet arbeider appen med virkelige stier. *Lagre* skriver rett til filen din. Vanligvis skriver appen først til en midlertidig fil ved siden av (`.ops-save.tmp`), og erstatter filen din først da. Slik ødelegger et brudd midt i skrivingen ikke den gamle filen din. Hvis du lukker appen med ulagrede endringer, spør den for hvert prosjekt om du vil lagre. Ved en ren avslutning tømmer den gjenopprettingskopiene sine.

I en nettleser som kan lagre filer hvor som helst (for eksempel Chrome og Edge), får du et vanlig vindu for å åpne og lagre. Deretter skriver *Lagre* rett til filen. For en fil du har åpnet, spør nettleseren én gang om tillatelse. Listen *Nylig* fungerer, med bare filnavn.

I en nettleser uten denne mulighet (for eksempel Firefox) åpner appen en fil via filvelgeren og lagrer via en nedlasting. Med *Lagre* forklarer meldingen *Lagret som nedlasting: 'name.ifc' ligger i nedlastingsmappen din. …* dette én gang per økt. Med *Lagre som* og eksporter ser du *Lagret som nedlasting: 'name.ifc' ligger nå i nedlastingsmappen din. Dette miljøet tillater ikke at appen skriver direkte til stedet du valgte.* Hvis nettleseren kan vise et lagringsvindu, men ikke skrive tilbake til prosjektets fil, spør *Lagre* hver gang etter et sted på nytt. En melding forklarer også dette én gang per økt. *Fil › Nylig* finnes, men åpner en tom side, og automatisk lagring er ikke tilgjengelig. Du får samme melding i alle omgivelser som ikke lar appen skrive til stedet du valgte.

## Eksempel: eksport av eksempelprosjektet

Ta eksempelet *Refurbishment & Extension of a Family Home* (*Fil › Eksempler*). Det har 20 aktiviteter, av dem 4 faser og 2 milepæler, og 16 avhengigheter. Det har 6 ressurser med 8 tilordninger, 1 grunnlinje og en kobling til *Demo-bibliotek*. Aktiviteten *Demolish existing extension* har begrensningen *Start ikke tidligere enn (SNET)* på 14. mai 2027, og *Handover inspection* har en tidsfrist 29. juli 2027. Tidsplanen slutter 7. juli 2027.

Slik kommer prosjektet tilbake fra hvert format, målt etter at eksportfilen er åpnet igjen:

- IFC-filen gir alt tilbake: 20 aktiviteter, 16 avhengigheter, 6 ressurser, 8 tilordninger, grunnlinjen, begrensningen, tidsfristen og koblingen til biblioteket. Tidsplanen slutter igjen 7. juli 2027.
- MS Project XML-filen gir også alt tilbake, unntatt koblingen til biblioteket. Tidsplanen slutter 7. juli 2027.
- P6 XML-filen gir tilbake aktivitetene, avhengighetene, ressursene, tilordningene og begrensningen. Grunnlinjen og tidsfristen mangler. Tidsplanen slutter fortsatt 7. juli 2027, fordi begrensningen fortsatt er med.
- CSV-filen gir tilbake 20 aktiviteter og 16 avhengigheter. Ressurser, tilordninger, grunnlinje, begrensning og tidsfrist mangler, og prosjektet heter *CSV Import*. Uten begrensningen flytter arbeidet seg fremover: tidsplanen slutter 2. juli 2027, fem kalenderdager tidligere.

Uten den begrensningen slutter eksemplet selv også 2. juli 2027. Forskjellen kommer altså fra begrensningen som CSV-filen ikke tar med.

## Konsekvenser og misforståelser

**En eksport er ikke en sikkerhetskopi.** Bare IFC beholder alt. Vil du beholde prosjektet ditt, lagre det som IFC. Eksporter bare for noen som trenger det andre formatet.

**Å åpne en eksport igjen gir ikke alltid samme tidsplan.** Appen omberegner alltid ved åpning, med beregningsprofilen som hører til formatet. Hvis logikken mangler, slik som begrensningen i CSV-eksemplet, eller hvis profilen beregner annerledes, endres resultatet.

**En eksport er også i Nylig.** På skrivebordet og i nettlesere med filtilgang havner en eksport i *Nylig*, akkurat som et lagret prosjekt (fremdriftsarkene gjør ikke det). Åpner du den der, åpnes den som en import av det formatet.

**Lagre er ikke det samme som gjenoppretting ved brudd.** Gjenoppretting ved brudd hjelper etter et brudd, men erstatter ikke lagring. Lagre derfor før du lukker en fane eller appen.

## Se også

- [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan): stegene for å åpne, lagre og lagre som.
- [Eksportere](docs://howto-exporteren): velge et format og hva du får.
- [Datoer slik de er lagret](docs://uitleg-datums-zoals-opgeslagen): hvorfor en importert tidsplan kan vise andre datoer.
- [Begrensninger og tidsfrister](docs://uitleg-constraints): hva en begrensning gjør, og dermed hva som forsvinner hvis den mangler.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): hva en forsinkelse er, og hvordan appen regner den ut.
- [Lage en hengekøye](docs://howto-hammock): hva en hengekøye er, som en eksport skriver som en vanlig aktivitet.
- [Aktivitetskoder og egendefinerte felt](docs://howto-codes-en-velden): aktivitetskoder og egendefinerte felt, som bare IFC beholder.
- [Koblinger mellom prosjekter](docs://howto-externe-relaties): koblinger som MS Project XML og P6 XML ikke tar med.
- [Lagre og administrere en grunnlinje](docs://howto-baseline-opslaan-en-beheren): grunnlinjer, der MS Project XML bare tar med den aktive.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format hva som tas med, og hva som ikke tas med.
