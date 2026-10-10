# Öppna en Primavera P6-fil (.xer)

Mål: öppna en tidsplan från Primavera P6 direkt i appen, utan att först exportera den till XML.

## När du behöver det

En beställare eller huvudentreprenör arbetar i Primavera och levererar sin tidsplan som en `.xer`-fil. Du vill visa den, beräkna den eller lägga till i den. Appen läser bara `.xer`-filer: den skriver inte `.xer` och ändrar aldrig din fil. Från filen hämtar appen WBS-strukturen och uppgifterna med varaktighet, datum, restriktioner och framdrift, samband med fördröjning, kalendrar och resurser med deras tilldelningar, plus uppgiftskoder, egna fält (UDF), anteckningar och P6:s beräkningsinställningar. En uppgift av typen *Level of Effort* blir en hängmatta.

## Steg

1. Välj *Start › Fil › Öppna* eller tryck på Ctrl+O. Välj filen `.xer`.
2. Appen öppnar en flik för varje projekt som har uppgifter. Projektet med flest uppgifter är den aktiva fliken. En flik heter *Projektnamn (Projekt-ID)* om P6-projekt-ID:t skiljer sig från namnet.
3. Läs meddelandet längst ner. För en fil med tre projekt kan det se ut så här: *XER-fil öppnad: 3 projektdokument.* Under det finns rader som förklarar vad appen gjorde. Se rubriken nedan.
4. Kontrollera om det finns ett meddelandefält under menyfliksområdet: *Du ser tidsplanen så som Primavera sparade den; när du beräknar om skulle 1 uppgift flyttas.* Primavera sparar egna beräknade datum i filen. Om appens beräkning skiljer sig från dem visar appen Primaveras datum så länge du inte ändrar något. Vad det betyder och hur du byter till appens egna beräkning står i [Datum så som de sparades](docs://uitleg-datums-zoals-opgeslagen). Meddelandet *Den här filen innehåller timplanering.* kan också visas, med knappen *Aktivera timplanering*. Se [Så aktiverar du timplanering](docs://howto-urenplanning-aanzetten).
5. Spara projektet med Ctrl+S. Eftersom en `.xer`-fil aldrig skrivs över frågar appen var den nya IFC-filen ska sparas. Den föreslår *Projektnamn (Projekt-ID)* som filnamn.

### Raderna under meddelandet

Den första raden i meddelandet anger hur många flikar som öppnades. Under den visas bara de rader som gäller. Dessa kräver din uppmärksamhet:

- *Det här projektet beräknas enligt Primavera P6. Ändra det via Arkiv → Projektinfo → Beräkningsprofil och beräkningsalternativ.* Appen beräknar det här projektet med Primaveras beräkningsregler. Med *Öppna beräkningsprofil* går du till inställningen.
- *1 baslinjeprojekt exkluderat.* och *1 baslinje materialiserad.* Om ett projekt i P6 anger ett annat projekt som sin baslinje öppnas inte det andra projektet som en egen flik. Det blir i stället den aktiva baslinjen för projektet som hänvisar till det.
- *En skyddande baslinje-reserv användes.* Om utpekandet av baslinjer skulle innebära att inget projekt öppnas alls, om ett projekt hänvisar till sig självt eller om projekt hänvisar till varandra i en cirkel, öppnar appen helt enkelt alla projekt och skapar inga baslinjer.
- *1 externt samband bevarat.* Ett samband mellan två projekt. Appen behåller det som källdata, men gör det inte till ett samband i din tidsplan.
- *1 uppgift visar datumen så som Primavera sparade dem (inte beräknas om).* Det är antalet uppgifter du ser i vyn *Datum så som de sparades*.

De andra raderna är diagnostik av själva läsningen: antalet projekt som hittades, ett överhoppat tomt projekt, en ignorerad hängande baslinjereferens, en teckenkodning som inte är vanlig UTF-8 och räknare för fynd i tabellerna, kalendrarna och talen, för okända fältvärden och för P6:s beräkningsinställningar som appen ersatte med ett säkert val. De kräver inget av dig. *Läs mer* öppnar hjälpen om att öppna Primavera-filer.

## Fallgropar och vad appen gör då

**Inte allt blir en flik eller ett samband.** Ett projekt utan uppgifter öppnas inte. Ett baslinjeprojekt öppnas inte som en egen flik, och ett samband mellan två projekt blir inte ett samband i din tidsplan. Appen rapporterar det på raderna under meddelandet.

**Varje flik är ett eget projekt.** Om du sparar en flik behåller IFC-filen hela den ursprungliga `.xer`-filen. Om du öppnar IFC-filen senare känner appen fortfarande till Primaveras datum. Om källarkivet är skadat, eller om ett annat IFC-program skrev om filen, rapporterar appen: *XER-källarkivet i den här filen är oanvändbart och har utelämnats. Projektet självt öppnades helt.* Tidsplanen, beräkningsprofilen och alla projektdata är kompletta. Det som saknas är datumen så som Primavera lagrade dem och källinformationen för AI och tillägg. Öppna den ursprungliga `.xer`-filen igen för att få tillbaka arkivet.

**En export till CSV, MS Project XML eller P6 XML förlorar data.** Appen varnar: *Export till CSV gör att XER-källinformation går förlorad.* IFC förlorar ingenting.

**En fil som appen inte kan läsa.** Du får ett felmeddelande med orsaken. Några exempel:

- *Den här filen är ingen giltig eller stödd XER-fil.*
- *En XER-tabell saknar obligatoriska kolumner.*
- *P6-projektet i den här XER-filen innehåller inga uppgifter.*

Då öppnas ingenting. Kontrollera filen i P6 eller be avsändaren om en ny export.

## Se även

- [Filer och format](docs://uitleg-bestanden): varför en `.xer` bara läses och vad en export förlorar.
- [Datum så som de sparades](docs://uitleg-datums-zoals-opgeslagen): vyn med Primaveras egna datum.
- [Öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen): samma sak för MS Project.
- [Så aktiverar du timplanering](docs://howto-urenplanning-aanzetten): om filen innehåller data i timmar.
- [Import- och exportformat](docs://ref-import-exportformaten): per format vad som tas med och vad som inte tas med.
- [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen): varför en P6-fil öppnas med sin egen beräkningsprofil.
