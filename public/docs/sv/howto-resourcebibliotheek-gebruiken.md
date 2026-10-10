# Använda resursbiblioteket

Mål: använda resurser från resursbiblioteket i ditt projekt, och lägga en resurs som du har gjort i ett projekt i biblioteket, så att alla projekt använder samma data.

## När du behöver det

Du har en fast murarbesättning, en kran och en gipsare som finns i flera projekt. Utan bibliotek skriver du in dem igen i varje projekt. Då finns risk för olika namn och standardkostnader. Dessutom ser inget projekt att ett annat projekt också begär samma besättning. I biblioteket registrerar du dem en gång.

Vad biblioteket är och vad ett projekt tar över från det, läser du i [Resursbiblioteket](docs://uitleg-resourcebibliotheek). Den här artikeln handlar om åtgärderna. Att skapa, exportera och ta bort bibliotek beskrivs i [Hantera och dela resursbibliotek](docs://howto-bibliotheken-beheren).

## Steg

### 1. Länka projektet till ett bibliotek

Du arbetar bara med biblioteket om projektet är länkat till det. Utan länk visar panelen *Resurser* inte växlingen *Bibliotek*, *Projekt* och *Beläggning*.

För ett nytt projekt:

1. Välj *Fil › Ny*. Fönstret *Nytt projekt* öppnas.
2. Titta på *Resursbibliotek*. Fältet är inställt på standardbiblioteket. Du kan välja ett annat, *inget bibliotek (fristående projekt)* eller *+ Nytt resursbibliotek*…
3. Klicka på *Skapa*.

För ett befintligt projekt:

1. Välj *Fil › Projektinfo*.
2. Välj biblioteket under *Resursbibliotek*.
3. Klicka på *Tillämpa*. Tills dess står det längst ner *Ändringarna är inte tillämpade — klicka på Tillämpa för att spara dem*.

Om projektet redan har resurser med samma namn som ett biblioteksobjekt, öppnas fönstret *Länka resursbibliotek* med avsnittet *Igenkända*. Varje resurs med en träff säger *Förslag: Bricklayer*. Klicka på *Länka* om du vill länka den. Klicka på *Länka alla förslag* om det finns mer än ett förslag. Appen jämför namn utan hänsyn till versaler eller dubbla mellanslag. Vid länkning tar resursen över namn, typ, standardkostnad, enhet och beskrivning från biblioteksobjektet. *Max enheter* behåller värdet som du hade i projektet. Fönstret visar också projektets kalendrar som har samma namn som en bibliotekskalender. Med *Bestämma senare* stänger du fönstret utan att länka.

### 2. Lägg en resurs i biblioteket

1. Välj *Resurser › Hantera › Resurser*. Resurspanelen tar över hela arbetsytan. Den öppnas alltid på *Projekt*, även för ett länkat projekt.
2. Välj *Bibliotek* uppe till höger. Ovanför tabellen står det *Detta redigerar biblioteket och gäller alla projekt — kan inte ångras*.
3. Klicka på *Ny resurs i biblioteket*. En tom rad visas längst ner i tabellen.
4. Skriv namnet, till exempel *Bricklayer*, och tryck på Enter. Resursen finns nu i biblioteket. En tom rad öppnas direkt för nästa. Tryck på Esc när du är klar. Utan namn skapar appen inget.
5. Fyll i resten av raden. *Typ* är *Arbete* som standard. Under *Max enheter* anger du hur många av den här resursen det finns totalt, till exempel 3 för tre murare. Beläggningsöversikten använder det talet som kapacitet. *Standardkostnad/timme* är valfritt. Du kan bara fylla i *Enhet* för typen *Material*. Under *Kalender* väljer du en kalender från biblioteket, eller *+ Resurskalender* för att skapa en. Se [Ställa in en resurskalender](docs://howto-resourcekalender-instellen). Appen sparar namn, standardkostnad och enhet när du lämnar fältet. De andra fälten sparas direkt.

Varje ändring i biblioteket slår direkt igenom på de kopior i dina öppna projekt som du inte har ändrat.

### 3. Tilldela en resurs till projektet

1. I vyn *Bibliotek* väljer du *Tilldela till projekt* på resursen. Ovanför tabellen står det *Tillagd.* Om du klickar igen står det *Finns redan i projektet*, och ingen andra kopia visas.
2. Välj *Projekt*. Kopian finns i tabellen med en liten bibliotekssymbol bredvid namnet, märkt *Från biblioteket*. Namn, typ, standardkostnad och enhet är vanlig text. Om du håller musen över dem ser du *Biblioteksvärde — redigera i bibliotekvyn, eller koppla loss den här resursen från biblioteket*.
3. Ställ in *Max enheter* för det här projektet. Fältet börjar med värdet från biblioteket och det går att ändra i projektet.
4. Tilldela nu resursen till uppgifter, som vilken annan resurs som helst. Se [Tilldela resurser med en kurva](docs://howto-resource-toewijzen). *Resurser › Tilldelning › Tilldela* visar bara resurser som redan finns i projektet. Tilldela därför först en bibliotekresurs till projektet på det här sättet.

*Tilldela till projekt* finns bara i vyn *Bibliotek* i ett projekt som är länkat till det biblioteket.

### 4. Lägg en resurs från ditt projekt i biblioteket

Du gör detta för en resurs som du har skapat i projektet och använder oftare, till exempel en hyrd kran.

1. I vyn *Projekt* väljer du *Till biblioteket* på resursen. Knappen visas bara på en resurs som har ett namn och som inte redan kommer från biblioteket, i ett länkat projekt.
2. Läs meddelandet ovanför tabellen.

Meddelandet kan säga tre saker:

- *Tillagd.* Biblioteket hade inget objekt med det namnet. Ett nytt objekt skapades och din resurs är länkad till det.
- *Fanns redan i biblioteket. Nu kopplad*. Det fanns ett objekt med samma namn och samma data. Din resurs är länkad till det.
- *Kopplad till det befintliga biblioteksobjektet. Värdena skiljer sig åt, se markeringen*. Det fanns ett objekt med samma namn men med annan data. Din resurs är länkad och markeras direkt med *avviker — bestäm*. Fortsätt med steg 6.

### 5. Koppla loss en kopia

Om du vill avvika från biblioteket i ett projekt, till exempel med en annan standardkostnad, kopplar du loss kopian.

1. I vyn *Projekt* klickar du på ikonen *Koppla loss från biblioteket* i slutet av raden.
2. Resursen är nu en vanlig projektresurs. Alla fält kan redigeras. Den följer inte längre biblioteket. Kalendern som följde med resursen kopplas också loss, om inte en annan resurs i projektet fortfarande följer den.

Med *Ångra* (Ctrl+Z) tar du tillbaka losskopplingen.

### 6. Lös en avvikelse

En kopia som säger *avviker — bestäm* skiljer sig från biblioteksobjektet. Appen väljer inte vem som har rätt.

1. Klicka på markeringen *avviker — bestäm* på resursen. Fönstret *Länka resursbibliotek* öppnas. Det öppnas också av sig självt när du öppnar en fil med en sådan kopia.
2. Välj i avsnittet *Avvikelser* vad du vill ha för objektet. Se nedan.
3. Klicka på *Bestämma senare* om du inte vill välja ännu. Fönstret stängs och markeringen blir kvar.

För en avvikelse har du två val:

- *Använda biblioteksvärden*: kopian får data från biblioteket.
- *Ta över filvärden till biblioteket*: biblioteket får data från din kopia. Under det står *Obs! Detta ändrar biblioteket och gäller alla dina projekt*. Kopiorna i andra öppna projekt följer med.

## Fallgropar och vad appen gör då

**Exempelprojekten har ett eget bibliotek.** Om du öppnar ett av de tre exempelprojekten (*Fil › Exempel*, eller via en länk i Hjälp) skapar appen en gång biblioteket *Demo-resursbiblioteket* och länkar projektet till det. Resurser i projektet med samma namn som ett biblioteksobjekt länkas direkt. Kalendrar länkas inte. Dina egna bibliotek lämnas ifred. Om du öppnar två exempel bredvid varandra visar de tillsammans konflikter i [Använda beläggningsöversikten](docs://howto-bezettingsoverzicht-gebruiken). Ett exempel är konflikten om *Masonry crew* mellan *Refurbishment & Extension of a Family Home* och *6 New Terraced Houses, De Akkers*.

**Du ser inte växlingen.** Projektet är inte länkat till något bibliotek. Gör steg 1.

**Du redigerar biblioteket av misstag.** Panelen öppnas alltid på *Projekt* för att förhindra det. Ändringar i vyn *Bibliotek* gäller alla projekt och ligger utanför *Ångra*.

**Du tar bort en resurs från biblioteket.** Appen frågar först: *Ta bort 'Bricklayer' från biblioteket? Detta gäller alla projekt och kan inte ångras*. Kopiorna i dina projekt finns kvar och fungerar fortfarande. De får markeringen *inte längre i biblioteket* och kan redigeras fullt ut. Med *Ta bort från projekt* tar du en kopia ur projektet.

**Under *Resursbibliotek* väljer du ett annat bibliotek eller *inget bibliotek (fristående projekt)*.** Ursprungsmärkena från det föregående biblioteket försvinner. Resurserna finns kvar i projektet som vanliga projektresurser. Med ett annat bibliotek letar appen igen efter resurser med samma namn.

**En resurs har inget förslag i *Igenkända*.** Där står *Inget förslag — välj manuellt*, men fönstret har ingen knapp för det. Det ser ut som en brist i appen. Lägg en sådan resurs i biblioteket med *Till biblioteket* (steg 4).

## Se också

- [Resursbiblioteket](docs://uitleg-resourcebibliotheek): vad biblioteket bestämmer, vad projektet bestämmer, och hur kopior följer med.
- [Hantera och dela resursbibliotek](docs://howto-bibliotheken-beheren): skapa, exportera och importera bibliotek.
- [Använda beläggningsöversikten](docs://howto-bezettingsoverzicht-gebruiken): se om två projekt begär samma resurs samtidigt.
- [Hantera resurser](docs://howto-resources-beheren): resurserna i ett enskilt projekt.
