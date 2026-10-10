# Öppna och spara en fil

Mål: öppna ett projekt från en fil och behålla dina ändringar.

## När du behöver det

Du börjar dagen med gårdagens projekt, du får en fil från en kollega eller från ett annat paket, eller du vill spara ett mellanläge innan du ändrar något stort. Vad appen sparar i en fil, och varför bara IFC sparar hela ditt projekt, förklaras i [Filer och format](docs://uitleg-bestanden).

## Steg

### Öppna en fil

1. Välj *Start › Fil › Öppna*, eller *Fil › Öppna*, eller tryck på Ctrl+O (⌘+O på en Mac). *Öppna* finns också i raden högst upp. Gruppen *Fil* finns också på fliken *Tabell*.
2. Välj filen. Du öppnar en fil i taget. På datorn och i webbläsare med filåtkomst, som Chrome och Edge, visar fönstret en lista med filtyper: *Alla som stöds*, *IFC-filer*, *CSV-filer*, *XML-filer*, *MS Project-filer* och *Primavera XER-filer*.
3. Projektet öppnas i en ny flik. Om den aktuella fliken fortfarande var tom och oförändrad öppnas projektet i den.

En IFC-fil ger sitt filnamn till fliken. Ett projekt från ett annat format får sitt projektnamn.

Appen öppnar `.ifc`, `.csv`, `.xml` (MS Project XML eller Primavera P6 XML), `.mpp` och `.xer`. För de två sista finns separata steg i [Öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen) och [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen).

### Öppna ett nyligen använt projekt

Välj *Start › Fil › Senaste* och klicka på en fil i listan, eller välj *Fil › Senaste*. Listan behåller de tio senaste filerna som du öppnade, sparade eller exporterade. Skrivbordsappen visar sökvägen för varje fil, en webbläsare visar bara namnet.

Om appen inte längre kan läsa en fil i listan, till exempel för att du flyttade den, försvinner den från listan utan meddelande. I webbläsare utan filåtkomst, som Firefox, förblir *Senaste* tom.

### Öppna ett exempel

Välj *Fil › Exempel* och klicka på ett exempelprojekt. Det öppnas i en flik, utan fil: *Spara* frågar därför var du vill spara det.

### Spara

Välj *Start › Fil › Spara* eller *Fil › Spara*, eller tryck på Ctrl+S. Vad som händer beror då på ditt projekt:

1. Om projektet redan har en fil, för att du öppnade en IFC-fil eller sparade den tidigare, skriver appen till den filen. Inget fönster visas.
2. Om projektet ännu inte har en fil frågar appen var den ska ligga. Den föreslår projektnamnet med `.ifc`. Därefter är den filen projektets fil.
3. Om din webbläsare bara sparar via en nedladdning (som Firefox) hamnar filen i din mapp för nedladdningar, och varje sparning skapar en ny nedladdning. Första gången i en session ser du meddelandet *Sparad som nedladdning: ”name.ifc” finns i din mapp för nedladdningar. Den här webbläsaren tillåter inte att appen skriver till en egen plats, så varje sparning skapar en ny nedladdning. I Chrome, Edge eller skrivbordsappen uppdaterar* *Spara* *bara samma fil.*
4. Om din webbläsare inte kan skriva tillbaka till projektets fil, frågar appen varje gång du sparar var filen ska ligga. Det ser ut som *Spara som*, men det är en begränsning i webbläsaren. Första gången i en session förklarar meddelandet *Den här webbläsaren tillåter inte att appen skriver tillbaka till ”name.ifc”.* Mer om detta finns i [Filer](docs://uitleg-bestanden).

Efter sparandet försvinner markeringen *Ej sparad*: pricken på fliken, asterisken före projektnamnet överst och texten *Ej sparad* längst ned till höger i statusfältet.

### Spara under ett annat namn

Välj *Start › Fil › Spara som* eller *Fil › Spara som*, eller tryck på Ctrl+Shift+S. Välj ett namn och en plats (i Firefox laddar appen ner en ny fil i stället). Därefter arbetar projektet med den nya filen: nästa *Spara* skriver dit. Den gamla filen ligger kvar som den var när du senast sparade.

### Stänga ett projekt

Klicka på krysset på fliken, eller välj *Fil › Stänga projekt*. Om projektet har ändringar som du inte sparade frågar appen: *Osparade ändringar: ”name” har ändringar som ännu inte har sparats.* Du väljer *Avbryt* (projektet förblir öppet), *Spara inte* (projektet stängs och dina ändringar är borta) eller *Spara* (spara först och stäng sedan). Om du stänger hela appen på datorn (med stängknappen, Alt+F4 eller ditt operativsystems meny) frågar den detta för varje projekt med ändringar. *Avbryt*, eller ett sparande som misslyckas, stoppar stängningen. Efter en vanlig stängning rensar appen återställningskopiorna för den sessionen, så återställningsfönstret visas bara efter en riktig krasch. Om ett projekt har ändringar och du stänger webbläsarfliken eller -fönstret, frågar webbläsaren om bekräftelse.

## Fallgropar och vad appen gör då

**En öppnad IFC-fil är direkt projektets fil.** *Spara* skriver över den filen, även om den kommer från ett annat program. Vill du behålla originalet, välj då *Spara som* först.

**Andra format skrivs aldrig över.** En `.csv`, `.xml`, `.mpp` eller `.xer` har ingen fil efter öppnandet. *Spara* skriver en ny IFC-fil och lämnar originalet orört.

**I Firefox skapar varje sparning en ny fil.** Appen kan inte skriva i din fil där. Den laddar ner en ny fil varje gång, med projektnamnet som filnamn och inte namnet på filen du öppnade.

**Chrome och Edge frågar om tillstånd.** Vid det första *Spara* av en fil du öppnade frågar webbläsaren om appen får skriva till den. Om du nekar öppnar appen ett fönster där du väljer en ny fil. I Chrome och Edge får du det fönstret också om skrivningen till den befintliga filen misslyckas, till exempel för att filen försvann eller är låst.

**Sparandet kan misslyckas.** Om själva sparandet ger ett fel visar appen *Kunde inte spara*, med orsaken. Ditt projekt förblir öppet och är fortfarande markerat som *Ej sparad*.

## Se även

- [Filer och format](docs://uitleg-bestanden): vad som finns i en IFC-fil och hur appen behandlar format.
- [Slå på automatisk sparning](docs://howto-automatisch-opslaan): att låta appen uppdatera din fil själv.
- [Exportera](docs://howto-exporteren): att göra en kopia i ett annat format.
- [Återställa efter en krasch](docs://howto-herstellen-na-een-crash): vad du gör om appen inte stängdes på rätt sätt.
- [Import- och exportformat](docs://ref-import-exportformaten): per format vad som följer med och vad som inte gör det.
