# Tillatelser for utvidelser

Alle tillatelser en utvidelse kan oppgi i manifestet: hva de tillater, hva som skjer når de mangler, og hva du ser av dem når du installerer en utvidelse. Hvordan du administrerer og installerer utvidelser, står i [Installere og administrere en utvidelse](docs://howto-extensie-installeren).

## Hva en tillatelse er og ikke er

En tillatelse er en **erklæring fra utvikleren**: hvilke deler av appgrensesnittet utvidelsen vil bruke. Den er ikke en barriere. Koden i en utvidelse kjører i samme miljø som appen selv, og kan derfor gjøre mer enn tillatelsene sier: det finnes ingen sandkasse. Appen sier det også i installasjonsvinduet. Installer bare utvidelser fra utviklere du stoler på.

Appen håndhever en tillatelse på en av tre måter, og forskjellen er viktig:

**Hardt håndhevet.** Mangler tillatelsen, gir den tilsvarende metoden en feil (på nederlandsk, for eksempel *Extensie «…» mist permissie: ribbon*) før noe skjer.

**Advarsel.** Mangler tillatelsen, fungerer metoden fortsatt, men appen skriver en advarsel til loggen. I en fremtidig versjon blir det en avvisning.

**Bare informativ.** Tillatelsen er ikke knyttet til noen del av grensesnittet. Appen viser den når du installerer, og gjør ikke noe mer med den.

Det som ikke krever tillatelse, er grunnlaget for utvidelsesgrensesnittet: lese prosjektet, kalenderen, aktivitetene, avhengighetene, ressursene og tilordningene; legge til aktiviteter og avhengigheter og endre aktiviteter; laste et prosjekt, omberegne og samle flere endringer; beholde sine egne innstillinger, lese sine egne medfølgende filer og vise et varsel.

**Manifestet.** Tillatelsene står i manifestet som en liste. En utvidelse du installerer nå, med en tillatelse denne versjonen av appen ikke kjenner, blir avvist. For en eldre utvidelse som allerede er lagret, fjerner appen ukjente tillatelser og skriver det i loggen.

## Hvordan appen spør

Når du installerer, fra katalogen (*Fil › Utvidelser › Bla gjennom › Installer*) eller fra en fil (*ZIP* eller *JS*), viser appen vinduet *Installer utvidelse?*. Spørsmålet kommer én gang, når du installerer: ikke hver gang du slår på utvidelsen.

Vinduet viser navnet, versjonen, beskrivelsen, forfatteren og, hvis det finnes, depotet. Under *Opprinnelse* står det hvor utvidelsen kommer fra (*Fra den nettbaserte utvidelseskatalogen*, *Fra en ZIP-fil på denne datamaskinen* eller *Fra en JavaScript-fil på denne datamaskinen*), og om nedlastingen er verifisert: med sjekksummen fra katalogen, ikke verifisert fordi katalogen ikke gir noen, eller en fil du valgte selv. Under *Hva du sier ja til* står det at en utvidelse er programkode som kjører med samme rettigheter som appen, og hva det betyr i praksis: i skrivebordsappen blant annet lesing og skriving av filer hvor som helst i brukermappen din, pluss tilgang til prosjektene, innstillingene og utklippstavlen din; i nettleseren tilgang til de lagrede prosjektene og innstillingene dine, til filene du har gitt tilgang til, og til nettverket.

Under *Det denne utvidelsen sier at den bruker* står tillatelsene fra manifestet, som korte etiketter med navnet som nedenfor. Det står: *Dette er utviklerens erklæring, ikke en begrensning — koden kan uansett gjøre mer.* Hvis utvidelsen ikke har noen tillatelser, står det *Ingenting oppgitt.* To tillatelser får en forklaring: *importSource* og *help*. De andre seks får bare etiketten.

Med *Installer* sier du ja. *Ikke installer*, Esc og å klikke utenfor vinduet avviser installasjonen.

## Tillatelsene

**ribbon** — plassere en knapp i båndet. Effekt: utvidelsen kan legge til en knapp i en gruppe på en båndfane. En utvidelse uten denne tillatelsen får en feil når den prøver. Knappene vises på slutten av den valgte fanen, under en gruppeetikett for utvidelsen, og forsvinner når du slår av utvidelsen eller fjerner den. Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: hardt. Hvor: på fanen utvidelsen valgte.

**events** — følge appens hendelser og selv sende hendelser. Effekt: utvidelsen kan abonnere på og avslutte abonnement på hendelser, og selv sende hendelser. Appen selv sender fire hendelser: et prosjekt er lastet (etter import, åpning eller lasting av en utvidelse), et tomt prosjekt er opprettet, tidsplanen beregnes på nytt, og brukeren ber om en opplæring. Den siste går bare til opplæringsutvidelsen. Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: hardt. Hvor: ingensteds; utvidelsen reagerer på hendelsen.

**backstage** — tilby et importformat. Effekt: utvidelsen kan registrere en importør; den vises under *Fil › Importer*, der du klikker på et format og velger en fil. De innebygde formatene er atskilt fra dette (se [Formater for import og eksport](docs://ref-import-exportformaten)). Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: advarsel. Hvis tillatelsen mangler, fungerer registreringen fortsatt, med en advarsel i loggen. Det er en overgangsordning, fordi eksisterende utvidelser ikke alltid oppgir tillatelsen. Hvor: *Fil › Importer*.

**pdf-fonts** — levere en skrift for PDF-eksporten. Effekt: utvidelsen kan registrere en skriftleverandør. PDF-eksporten bruker den for tegn som de innebygde skriftene ikke dekker, for eksempel kinesiske, japanske og koreanske tegn. Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: hardt. Hvor: i PDF-en til en rapport; i installasjonsvinduet står bare etiketten.

**importSource** — lese de opprinnelige bytene i en importert fil. Effekt: utvidelsen kan be om hele innholdet i kildefilen til et importert prosjekt (foreløpig: en Primavera-fil), også feltene appen bevisst ikke tar med inn i prosjektet ditt, som revisjons- og proveniensfelt, kostnader, gjennomgangs- og plasseringsfelt. Det er mye bredere enn resten av grensesnittet, og er derfor en egen tillatelse. Uten tillatelsen leser appen ikke en eneste byte av kildefilen: hver metode gir da en feil før noe hentes. Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: hardt, avvist som standard. Hvor: i installasjonsvinduet følger en forklaring med: *importSource — alle opprinnelige kildebytene fra hver importert fil (for eksempel en rå Primavera-fil), også felt som aldri havner i prosjektet.*

**help** — legge til hjelpeartikler og veiledning. Effekt: utvidelsen kan registrere og trekke tilbake hjelpeartikler (opplæringer), åpne en medfølgende `.ifc`-fil som et nytt dokument og starte og stoppe en veiledning som peker på deler av appen. Et medfølgende prosjekt overskriver aldri dokumentet du jobber i: det åpnes som et nytt dokument, eller tar bare over en tom, uendret fane. Fra kontraktversjon 1.4.0. Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: hardt. Hvor: i vinduet *Hjelp* (artiklene), som en ny fane (prosjektet) og som en veiledning som peker på knapper. I installasjonsvinduet følger en forklaring med: *help — kan legge til hjelpeartikler, åpne medfølgende prosjekter som nytt dokument og vise en veiledning som peker på deler av appen.*

**filesystem** — utvidelsen sier at den bruker filer. Effekt: ingen; ingen del av grensesnittet er knyttet til den, og appen kan ikke håndheve den. Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: bare informativ. Hvor: som en etikett i installasjonsvinduet.

**network** — utvidelsen sier at den bruker nettverket. Effekt: ingen; likt *filesystem*. Standard: ikke gitt; bare det som står i manifestet. Håndhevelse: bare informativ. Hvor: som en etikett i installasjonsvinduet.

## Se også

- [Formater for import og eksport](docs://ref-import-exportformaten): formatene appen kjenner selv, ved siden av det utvidelser legger til under *Fil › Importer*.
- [Installere og administrere en utvidelse](docs://howto-extensie-installeren): installere, deaktivere og fjerne en utvidelse.
