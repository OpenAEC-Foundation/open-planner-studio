# Úprava sloupců tabulky

Cíl: zvolte, které sloupce vidíte v tabulce úkolů, v jakém pořadí a jak široké.

## Kdy to potřebujete

Na poradě chcete vidět konečný termín a celkovou časovou rezervu u každého úkolu. Stavbyvedoucí chce vedle názvu jen zahájení a dokončení. Nebo je některý sloupec tak úzký, že se jeho záhlaví ořízne. Tabulka úkolů se skládá ze sloupců, které si zvolíte sami. Je jich desítky, od *Název úkolu* a *Doba trvání* až po *Konečný termín*, *Volná časová rezerva* a *Přiřazené zdroje*.

Existují dvě tabulky úkolů. Každá má vlastní sloupce:

- **Tabulka úkolů vedle Gantt** je vlevo od časové osy na kartách mimo jiné *Domů*, *Plán* a *Zobrazení*. Ve výchozím nastavení má sloupce *WBS*, *Název úkolu* a *Doba trvání*, aby zbylo místo pro časovou osu.
- **Tabulka na kartě Tabulka** zabírá celý pracovní prostor. Ve výchozím nastavení má sloupce *WBS*, *Název úkolu*, *Doba trvání*, *Zahájení*, *Dokončení*, *Typ úkolu*, *Kritický*, *Celková časová rezerva* a *Průběh*, a navíc sloupec pro každý kód aktivity a vlastní pole projektu.

Změna v jedné tabulce nezmění druhou.

## Postup

### Přidání sloupce

1. Klikněte na plus (**+**) vpravo v záhlaví tabulky. Na kartě *Tabulka* můžete také použít *Tabulka › Sloupce › Sloupce…*. Otevře se okno *Vybrat sloupec*.
2. Najděte sloupec. Nahoře, pokud jste už dříve nějaké sloupce zvolili, je *Naposledy použité*. Do pole *Hledat* zadejte část názvu, například *kon* pro *Konečný termín*, nebo otevřete kategorii: *Úkol*, *Plán*, *Omezení*, *Závislosti*, *Zdroje*, *Průběh*, *Vypočítané*, *Směrný plán*, *Vlastní* nebo *Technické*.
3. Klikněte na sloupec. Sloupec se přidá na konec tabulky a okno se zavře.

Sloupec, který už v tabulce je, je šedý a nelze ho zvolit.

### Odebrání sloupce

Klikněte na znaménko minus v záhlaví sloupce (*Odebrat: Konečný termín*). Nebo klikněte pravým tlačítkem na záhlaví a zvolte *Odebrat: Konečný termín*. Klávesou Ctrl+Z sloupec vrátíte, nebo ho zvolíte znovu pomocí plusu.

### Úprava šířky

Přetáhněte pravý okraj záhlaví sloupce doleva nebo doprava. Dvojitě klikněte na tento okraj, nebo v nabídce záhlaví (pravé tlačítko myši) zvolte *Přizpůsobit*. Sloupec se tak rozšíří na šířku svého obsahu, nejvýše na 480 pixelů. Pokud má okraj fokus, šipky klávesnice šířku zvětšují nebo zmenšují po krocích.

### Připnutí sloupců

Klikněte pravým tlačítkem na záhlaví a zvolte *Připnout*. Připnuté sloupce se přesunou na začátek a při vodorovném posouvání zůstanou vlevo. To platí, dokud nejsou společně širší než okno. *Odepnout* je vrátí zpět do řady.

### Změna pořadí

Přetáhněte záhlaví sloupce na jiné místo. Připnutý sloupec přesouváte mezi připnutými sloupci, běžný sloupec mezi běžnými sloupci.

### Návrat k výchozímu nastavení

Otevřete okno *Vybrat sloupec* a dole klikněte na *Obnovit výchozí*. Tlačítko je šedé, pokud jsou sloupce už výchozí. Pro tabulku na kartě *Tabulka* se přidá také sloupec pro každý kód aktivity a vlastní pole projektu, i když jste je dříve odebrali. Tyto sloupce patří do projektu, ve kterém je daný kód nebo pole. O těchto kódech a polích si můžete přečíst v článku [Kódy a vlastní pole](docs://howto-codes-en-velden).

## Úskalí a co dělá aplikace

**Záhlaví je oříznuté.** Úzký sloupec ořízne svůj název, například *Celk…* z *Celková časová rezerva*. Dvojitě klikněte na okraj záhlaví, aby se sloupec přizpůsobil.

**Upravujete špatnou tabulku.** Sloupce tabulky úkolů vedle Gantt a sloupce na kartě *Tabulka* jsou oddělené. Pokud jste na kartě *Zobrazení* nebo *Domů*, upravujete tabulku vedle Gantt. Plus na kartě *Tabulka* upravuje velkou tabulku.

**Rozložení vrátí sloupce zpět.** Pokud má rozložení zaškrtnutou část *Sloupce*, kliknutí na tlačítko rozložení vrátí sloupce tabulky úkolů vedle Gantt do uloženého stavu. Tabulka na kartě *Tabulka* zůstane beze změny. Viz [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken).

**Sloupce jsou v zařízení, ne v projektu.** Aplikace uchovává váš výběr sloupců pro všechny vaše projekty na tomto zařízení a neukládá ho do souboru projektu. Také tím projekt neoznačí jako změněný. Každou změnu sloupců můžete vrátit pomocí *Vrátit zpět* (Ctrl+Z). Kroky se nazývají například *Přidat sloupec Konečný termín* a *Změnit šířku sloupce Název úkolu*.

## Viz také

- [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken): sloupce na tlačítku spolu s filtrem nebo řazením.
- [Kódy a vlastní pole](docs://howto-codes-en-velden): vytváření vlastních sloupců, které tady můžete zvolit.
- [Sloupce tabulky](docs://ref-tabelkolommen): všechny sloupce a co zobrazují.
