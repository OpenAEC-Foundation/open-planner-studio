# Externt samband med ett annat projekt

Mål: länka en uppgift i det här projektet till en uppgift i en annan projektfil. Då tar din tidsplan hänsyn till arbete som är planerat på annat håll.

## När du behöver detta

Din tillbyggnad kan bara börja när platsen har gjorts redo för byggande. Det arbetet ligger i entreprenörens projekt. Eller så kan installatören bara börja när din stomme är klar, och han planerar i sin egen fil. Ett vanligt samband fungerar bara mellan uppgifter i samma projekt. Ett **externt samband** länkar en uppgift till en uppgift i en annan fil.

Ett externt samband beräknas inte löpande tillsammans med det andra projektet. Appen sparar ett fast **ankardatum**: datumet för den externa uppgiften när du länkar den. Beräkningen använder det datumet som gräns. Om det andra projektet ändras flyttas ingenting i ditt projekt förrän du uppdaterar ankardatumet.

## Steg

1. Välj exakt en uppgift i det här projektet: uppgiften som beror på den externa uppgiften, eller uppgiften som den externa uppgiften beror på.
2. Välj *Start › Uppgifter › Länka ▾ › Lägga till externt samband…*. Samma meny finns under *Tidsplan › Samband* och under *Tabell › Uppgifter*. Posten är bara tillgänglig om exakt en uppgift är vald.
3. I fönstret *Externt samband (över projekt)* väljer du en av två vägar. Med *Källfil* väljer du projektfilen under *Välj en nyligen använd fil* och sedan *Källuppgift*. Appen läser filen utan att ändra den, öppnar den inte som dokument och hämtar själv ankardatumet. Den här vägen fungerar bara i skrivbordsappen och bara för en fil i listan över nyligen använda filer. Annars är knappen *Källfil* inaktiv. Med *Manuellt (reserv)* fyller du i *Projekt-id* och *Uppgift-id* för den externa uppgiften, eventuellt *Uppgiftsnamn (valfritt)*, och *Ankardatum*. I webbversionen är det här den enda vägen.
4. Under *Riktning* väljer du om den externa uppgiften är din föregående uppgift eller din efterföljande uppgift: *Föregående (extern → mig)* eller *Efterföljande (jag → extern)*.
5. Välj *Sambandstyp* (FS, SS, FF eller SF) och fyll i *Fördröjning (arbetsdagar)* om det behövs, till exempel `0d` eller `2d`.
6. Klicka på *Lägg till samband* och tryck på **Beräkna** (F5).

Vilket datum du anger som ankardatum för ett manuellt samband beror på riktningen och typen:

- Vid en extern **föregående** uppgift räknar den första bokstaven i typen: F betyder slutdatumet för den externa uppgiften, S startdatumet. Med FS och FF anger du alltså slutdatumet, med SS och SF startdatumet.
- Vid en extern **efterföljande** uppgift räknar den andra bokstaven: S är startdatumet för den externa uppgiften, F slutdatumet. Med FS och SS anger du alltså startdatumet, med FF och SF slutdatumet.

Om du planerar i timmar (timplanering på, och en uppgift i en kalender med arbetstid) frågar fältet *Ankardatum* också efter en tid.

Exempel: projektet för byggplatsen slutar fredag 18 juni 2027. Du länkar *Groundwork* med en extern föregående uppgift av typen FS, ankardatum 18 juni 2027. Efter **Beräkna** börjar groundwork måndag 21 juni, den första arbetsdagen efter ankardatumet. En extern efterföljande uppgift fungerar åt andra hållet: den begränsar hur sent din uppgift högst får vara klar.

## Vad du ser och hur du hanterar det

- Externa samband visas som text i kolumnerna *Föregående* och *Efterföljande* i uppgiftstabellen (du lägger till dem med **+** i tabellrubriken, under *Samband*). Texten visar namnet på projektet och uppgiften, samt typen. En liten triangel med *Källa saknas* visar att källan inte har lästs in. Håll muspekaren över sambandet för att se projektet (raden *Projekt-id* visar projektnamnet när det är känt), uppgifts-ID, ankardatumet och källstatusen.
- I Gantt-diagrammet finns en grå spökbalk vid uppgiften. Vid en föregående uppgift slutar den på ankardatumet, vid en efterföljande uppgift startar den på det. En streckad kant med den röda etiketten *föråldrad* betyder att källan inte har lästs in. Vid ett manuellt samband är det alltid så.
- Högerklicka på ett samband i kolumnen för *Redigera externt samband…* och *Ta bort samband*. Om sambandet har en källfil finns *Uppdatera källa* också.
- Välj *Länka ▾ › Uppdatera alla externa samband* för att läsa källfilerna igen och uppdatera ankardatumen. Det fungerar bara i skrivbordsappen. Om du bara har manuella samband säger appen *Inga källor att uppdatera (sökväg till fil saknas).* Tryck på **Beräkna** efter uppdateringen.
- Om du ändrar typen eller riktningen så att ankaret behöver en annan sida av den externa uppgiften (startdatumet i stället för slutdatumet, eller tvärtom), frågar appen efter ett nytt ankare vid ett manuellt samband: *Välj ett nytt ankare: sambandstypen använder nu den andra sidan av källuppgiften.* Vid ett samband med en källfil läser appen ankaret själv igen.

## Fallgropar och vad appen gör

**Det andra projektet följer inte med.** Om den externa uppgiften får ett nytt datum fortsätter din tidsplan att beräkna med det gamla ankardatumet tills du uppdaterar det eller ändrar ankardatumet. Med den manuella vägen ändrar du ankardatumet själv: högerklicka på sambandet och välj *Redigera externt samband…*.

**En extern föregående uppgift är en nedre gräns.** Om din uppgift startar senare än ankardatumet kräver på grund av sina egna föregående uppgifter, då vinner det interna sambandet. Ankardatumet skjuter bara på.

**En extern efterföljande uppgift är en övre gräns.** Om ankardatumet är för snävt ser du det som negativt slack på din uppgift och på uppgifterna före den. Ingen separat varning visas, så håll koll på kolumnen *Totalt slack*.

**Bara en fast fördröjning.** För ett externt samband kan du inte ange en fördröjning i kalenderdagar eller procent. Appen säger *Externa samband stöder bara en fast fördröjning i arbetsdagar eller arbetstid.* Arbetsdagarna räknas i kalendern för din egen uppgift. En fördröjning i timmar räknas bara för en uppgift som är planerad i timmar. För en uppgift i dagar ignorerar beräkningen den. Använd då arbetsdagar.

**Projekt-id för en annan fil.** Projekt-id finns inte i ett fält eller en kolumn. Det sparas som `InternalProjectId` i IFC-filen för det projektet. Öppna projektet, gå till fliken *IFC* och välj *Generera IFC*. Beräkningen använder bara ankardatumet. Id:t är inte bara en etikett: vid uppdatering känner appen först igen en källfil på dess projekt-id, och sedan på dess sökväg. Om du anger samma id i ett manuellt samband som en källfil har, uppdateras sambandet också när den filen uppdateras. Du hittar *Uppgifts-ID* för en uppgift i det andra projektet i uppgiftstabellen för projektet, i kolumnen *Uppgifts-ID* under *Teknisk*.

## Se även

- [Samband och fördröjning](docs://uitleg-relaties): hur appen beräknar ett samband och en fördröjning.
- [Lägg till samband](docs://howto-relaties-leggen): samband mellan uppgifter i samma projekt.
- [Restriktioner och måldatum](docs://uitleg-constraints): datumgränser för en uppgift, utan ett annat projekt.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): innehåller ett externt samband på *Car park paving* (en extern föregående uppgift).
