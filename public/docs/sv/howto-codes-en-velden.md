# Koder och egna fält

Mål: koppla egna klassificeringar (uppgiftskoder, till exempel *Plats*) och egna fält (till exempel *Entreprenör*) till dina uppgifter.

## När du behöver det

Utöver de fasta data för en uppgift (namn, varaktighet, samband, …) kan du lägga till egna data. Om du vill klassificera uppgifter efter norra och södra flygeln, efter disciplin, eller hålla koll på vilken entreprenör som utför en uppgift, registrerar du det själv. Det finns två sätt. Skillnaden är viktig.

En **uppgiftskod** är en klassificering med en fast lista att välja från. Du skapar en **kodtyp** (till exempel *Plats*) med **värden** (*N* för norra flygeln, *Z* för södra flygeln). En uppgift får högst ett värde per kodtyp.

Ett **eget fält** (under *Egna fält* i fönstret) är ett fritt inmatningsfält med en typ: *Text*, *Tal*, *Heltal*, *Kostnad*, *Datum* eller *Ja/nej*. Fältet kan ha ett eget värde på varje uppgift.

## Steg

### Definiera koder och fält

1. Välj *Tidsplan › Struktur › Koder och fält*.
2. **Skapa en kodtyp.** Skriv namnet under *Ny kodtyp (t.ex. Plats)* och tryck på Retur, eller klicka på *Lägg till kodtyp*.
3. **Lägg till värden.** Klicka under kodtypen på *Lägg till värde*. Appen sätter där en tillfällig kod, till exempel *V1*. Ändra den i rutan *Kod* (kort, så som du skulle skriva den: *N*). Fyll vid behov i *Beskrivning* (*Norra flygeln*) och välj en *Färg*. En ändring gäller så snart du lämnar rutan eller trycker på Retur.
4. **Skapa ett eget fält.** Skriv namnet under *Nytt fält (t.ex. Entreprenör)*, välj typen och klicka på *Lägg till fält* (eller tryck på Retur).

Fönstret har ingen OK-knapp. Varje ändring gäller direkt. Du kan inte ändra typen på ett fält efteråt, bara namnet. Vill du ha en annan typ skapar du ett nytt fält.

### Fylla i en kod eller ett fält på en uppgift

Du har två ställen.

- **I panelen *Egenskaper*** (eller i fönstret som du öppnar med F2). Längst ner finns blocket *Koder och fält*: en valbar lista per kodtyp och ett inmatningsfält per fält. Blocket visas först när det finns minst en kodtyp eller ett fält.
- **Som kolumn i uppgiftstabellen.** Klicka på **+** till höger i tabellrubriken (*Lägga till kolumn*) och välj under *Anpassat* kodtypen eller fältet. I cellen för en kodtyp skriver du koden, till exempel `N`, eller väljer i listan. En kod som inte finns ger *Välj ett värde från den här uppgiftskoden.*

### Använda dem

Du kan använda en kodtyp eller ett eget fält för att filtrera, gruppera och sortera. Du gör det med en layout: *Visa › Layout › Ny layout*. Markera i fönstret de delar som du vill spara. Med *Spara* får du en knapp i *Visa › Layout* som du kan klicka på igen senare. Med *Tillämpa utan att spara* lägger du layouten på skärmen bara nu. Vid gruppering hamnar uppgifter utan värde under *(ingen)*.

För balkfärgen väljer du *Visa › Baslinjer & framdrift › Stapelfärger*, sedan *Efter kategori* och kodtypen. Varje balk får då färgen från fältet *Färg* för sitt värde.

## Fallgropar och vad appen gör

**Borttagning tar bort värdena på uppgifterna.** Om du tar bort en kodtyp, ett värde eller ett fält med papperskorgen frågar appen inte efter bekräftelse. Alla kopplingarna på alla uppgifter försvinner då också. En gruppering eller sortering på den kodtypen eller fältet upphör också att gälla. *Ångra* (Ctrl+Z) återställer kodtypen, värdet eller fältet och de ifyllda värdena, men inte grupperingen eller sorteringen. Dem ställer du in igen.

**Två värden med samma kod.** *Lägg till värde* räknar upp från antalet värden som finns. Om du tar bort ett och lägger till ett kan en kod därför förekomma två gånger. Skriver du den koden i en kolumncell, vägrar appen med *Det här värdet för uppgiftskoden förekommer mer än en gång. Välj det i listan.* Ge varje värde en egen kod.

**Mallar tar inte med sig koder och fält.** Se [Spara och infoga WBS-mallar](docs://howto-wbs-sjablonen). Om du klistrar in uppgifter i ett annat dokument rensar appen koder och fält som inte finns där, och appen meddelar dig om det.

**Ett datumfält följer inte med.** Om du flyttar hela projektet blir ifyllda egna fält av typen *Datum* kvar på sitt datum. Appen varnar för det i förhandsgranskningen.

## Se även

- [Ändra strukturen](docs://howto-structuur-aanpassen): WBS-trädet, det andra sättet att ordna uppgifter.
- [Flytta ett projekt](docs://howto-project-verplaatsen): vad som händer med datum när du flyttar projektet.
- [Skapa och använda en layout](docs://howto-layouts-gebruiken): gruppering och filtrering på en kod eller ett eget fält.
- [Ändra tabellkolumner](docs://howto-tabelkolommen-aanpassen): visa en kod eller ett eget fält som kolumn.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): uppgiftskoderna *House* och *Discipline*, det egna fältet *Cost estimate* och anteckningar (öppna och avslutade).
