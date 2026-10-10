# Hantera och dela bibliotek med resurser

Mål: skapa och ta bort bibliotek, lägga kalendrar i dem och exportera eller importera ett bibliotek, som säkerhetskopia eller för att använda det på en annan dator.

## När du behöver detta

Biblioteket finns inte i dina projektfiler. Det finns i appen: i skrivbordsappen i en fil på den här datorn, och i webbläsaren i webbläsarens lagring. Det synkroniseras inte. Om du rensar webbplatsdata i webbläsaren, försvinner biblioteket. Exportera det därför som säkerhetskopia. Om en kollega vill arbeta med samma team och samma standardkostnader, lämnar du också över biblioteket som en fil. Har din organisation flera verksamhetsbolag med egna team, skapar du ett separat bibliotek för varje bolag. För ett nytt projekt väljer du vilket bibliotek det använder.

Vad ett bibliotek är står i [Resursbiblioteket](docs://uitleg-resourcebibliotheek). Du redigerar inte resurserna själva här. Gör det i resurspanelen. Se [Använda resursbiblioteket](docs://howto-resourcebibliotheek-gebruiken).

## Steg

### Öppna hanteringsvyn

Välj *Fil › Bibliotek*. Till vänster finns listan *Bibliotek*. Till höger visas detaljerna för biblioteket som du klickar på: namnet, knapparna och listan *Kalendrar*. Överst står det att du hanterar resurser på fliken *Resurser*.

### Skapa, byt namn och ange standard

1. Klicka på plusknappen ovanför listan (*Lägg till bibliotek*). Ett bibliotek med namnet *Nytt bibliotek* läggs till och markeras direkt.
2. Skriv det nya namnet i namnfältet överst till höger och tryck på Enter, eller klicka utanför fältet. Appen accepterar inget tomt namn.
3. Klicka på *Ange som standard* för att det här biblioteket ska vara förvalt för nya projekt från och med nu. Biblioteket som är standard har en stjärna i listan.

### Lägg en kalender i biblioteket

1. Klicka på *Från projekt* under *Kalendrar*. En lista öppnas med kalendrarna i ditt aktiva projekt.
2. Klicka på den lilla pilen efter den kalender som du vill ta över. Ovanför listan står *Tillagd.* En kalender som redan är kopplad till biblioteket har *redan kopplad* efter namnet.
3. Kalendern finns nu i listan *Kalendrar* i biblioteket. Med pennan (*Redigera*) ändrar du namnet och sparar med bockmarkeringen. Papperskorgen tar bort kalendern direkt, utan att fråga om bekräftelse. Kopiorna i projekten blir kvar.

Efter *Kalendrar* står ett versionsnummer, till exempel *v2*. Det går upp vid varje ändring i biblioteket. En kalender i biblioteket följer med till ett projekt när du tilldelar en resurs som använder den. Du kopplar den till en resurs i *Resurser*, vyn *Bibliotek*, i kolumnen *Kalender*.

### Exportera ett bibliotek

1. Välj biblioteket i listan.
2. Klicka på *Exportera*.
3. I skrivbordsappen och i Chrome och Edge väljer du var filen sparas. I andra webbläsare hamnar filen direkt i mappen för hämtade filer, och appen visar det. Filen heter `bibliotheek-` följt av namnet på biblioteket, med tillägget `.ifc`.

Under knapparna står *Exportera är även din säkerhetskopia. Spara filen på en säker plats.*

### Importera ett bibliotek

1. Klicka på *Importera*. Fönstret *Importera bibliotek* öppnas för biblioteket som du valde i listan.
2. Klicka på *Välj fil…* och välj en `.ifc`-fil från en export. Om filen inte innehåller något bibliotek, står det *Den här IFC-filen innehåller inget bibliotek.*
3. Appen visar vad filen innehåller, till exempel *2 kalendrar, 5 resurser (version 3).*
4. Välj vad du vill göra med filen, se nedan.
5. Klicka på *Lägg till* eller *Ersätt*, eller på *Avbryt* om du vill stoppa.

Du har två val:

- *Lägg till som nytt bibliotek*: filen blir ett separat bibliotek bredvid dina befintliga. Under knappen står vilket namn det får, till exempel *Läggs till som ”Mijn resourcebibliotheek (2)”.* Ingenting går förlorat, och ditt aktiva projekt är kvar kopplat till sitt eget bibliotek.
- *Ersätt ett befintligt bibliotek*: hela innehållet i det valda biblioteket ersätts med innehållet i filen. Appen säger det också: *Importen ersätter HELA innehållet i det valda biblioteket.* Har du två eller fler bibliotek väljer du vilket under *Importera till bibliotek*. Är ditt lokala bibliotek nyare än filen, varnar appen: *Ditt lokala bibliotek är nyare. Om du importerar kan dina ändringar skrivas över.*

Appen föreslår själv ett val. Om filen innehöll biblioteket som är standard, är *Lägg till som nytt bibliotek* förvalt. Om biblioteket i filen redan finns på din dator och inte är biblioteket som är standard, är *Ersätt ett befintligt bibliotek* förvalt, med just det biblioteket valt. Är du osäker, välj att lägga till. Då skrivs inget över.

### Ta bort ett bibliotek

1. Välj biblioteket i listan och klicka på *Ta bort bibliotek*. Knappen är grå för det sista biblioteket, eftersom minst ett bibliotek alltid måste finnas kvar.
2. Bekräfta med *Ta bort*. Frågan är *Ta bort det här biblioteket?* Om öppna projekt är kopplade till det, står det *Det här biblioteket är kopplat till 1 öppet projekt. Om du tar bort det kopplas projektet loss. Vill du fortsätta?* För fler projekt står samma text, med antalet, till exempel *kopplat till 2 öppna projekt*.

Biblioteket är då borta, med alla resurser och kalendrar i det. De öppna projekten som använde det kopplas loss. Deras resurser blir kvar som vanliga resurser i projektet. Exportera först om du vill behålla innehållet.

### Lämna över ett projekt tillsammans med dess bibliotek

En projektfil innehåller egna kopior av resurserna. Vill du lämna över hela biblioteket också, gör du följande. Exporten i sig beskrivs också i [Exportera](docs://howto-exporteren).

1. Öppna ett projekt som är kopplat till ett bibliotek och välj *Fil › Exportera*.
2. Markera *Spara biblioteksfilen bredvid*. Kryssrutan finns bara för ett kopplat projekt.
3. Välj kortet *IFC 4x3* och spara filen. Appen frågar då också efter en andra fil. Den får samma namn som projektet, med `-bibliotheek` efter namnet, och innehåller biblioteket.

Kryssrutan fungerar bara för IFC-exporten, inte för de andra exportformaten. Din kollega importerar den andra filen på det sätt som beskrivs ovan.

## Fallgropar och vad appen gör då

**Två planerare, två bibliotek.** Appen synkroniserar inte bibliotek mellan datorer. Importfönstret visar alltid en varning om det: *Obs: bibliotek synkroniseras inte mellan datorer. Om två planerare arbetar med samma bibliotek, kan biblioteken glida isär. Om din organisation delar team över verksamhetsbolag, väljer du medvetet ett gemensamt bibliotek.*

**Att ersätta skriver över allt.** Allt som fanns i det valda biblioteket är borta. Ändringar i biblioteket omfattas inte av *Ångra*. Exportera först om du är osäker.

**Att ta bort en kalender i listan sker direkt.** Appen frågar inte om bekräftelse, medan den gör det när du tar bort en resurs. Det kan se ut som en brist. Ändringar i biblioteket omfattas inte av *Ångra*.

## Se även

- [Resursbiblioteket](docs://uitleg-resourcebibliotheek): hur bibliotek och projekt hör ihop.
- [Använda resursbiblioteket](docs://howto-resourcebibliotheek-gebruiken): koppla resurser, tilldela dem och lösa avvikelser.
- [Exportera](docs://howto-exporteren): exportformaten, inklusive IFC med en fil för biblioteket.
