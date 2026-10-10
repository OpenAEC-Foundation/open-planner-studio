# Kódy a vlastní pole

Cíl: připojte k úkolům vlastní klasifikace (kódy aktivit, například *Lokalita*) a vlastní pole (například *Zhotovitel*).

## Kdy to potřebujete

Kromě pevných údajů úkolu (název, doba trvání, závislosti, …) můžete přidat vlastní údaje. Chcete-li úkoly třídit podle severního a jižního křídla, podle oboru, nebo sledovat, který zhotovitel úkol provádí, zapíšete si to sami. Existují dva způsoby a rozdíl je důležitý.

**Kód aktivity** je klasifikace s pevně daným seznamem na výběr. Vytvoříte **typ kódu** (například *Lokalita*) s **hodnotami** (*N* pro severní křídlo, *Z* pro jižní křídlo). Úkol dostane nejvýše jednu hodnotu z každého typu kódu.

**Vlastní pole** (pod *Vlastní pole* v okně) je volné vstupní pole s typem: *Text*, *Číslo*, *Celé číslo*, *Náklady*, *Datum* nebo *Ano/ne*. Pole může mít na každém úkolu jinou hodnotu.

## Kroky

### Definice kódů a polí

1. Zvolte *Plán › Struktura › Kódy a pole*.
2. **Vytvoření typu kódu.** Pod *Nový typ kódu (např. Lokalita)* zadejte název a stiskněte Enter, nebo klikněte na tlačítko *Přidat typ kódu*.
3. **Přidání hodnot.** Pod typem kódu klikněte na tlačítko *Přidat hodnotu*. Aplikace tam vloží dočasný kód, například *V1*. Změňte ho v poli *Kód* (krátký, tak, jak byste ho napsali: *N*). Pokud je potřeba, vyplňte pole *Popis* (*Severní křídlo*) a v poli *Barva* vyberte barvu. Změna platí, jakmile opustíte pole, nebo stisknete Enter.
4. **Vytvoření vlastního pole.** Do pole *Nové pole (např. Zhotovitel)* zadejte název, zvolte typ a klikněte na tlačítko *Přidat pole* (nebo stiskněte Enter).

Okno nemá tlačítko OK: každá změna platí hned. Typ pole potom změnit nelze, jen jeho název. Pokud chcete jiný typ, vytvořte nové pole.

### Vyplnění kódu nebo pole u úkolu

Máte dvě místa.

- **V panelu *Vlastnosti*** (nebo v okně, které otevřete klávesou F2). Dole je část *Kódy a pole*: pro každý typ kódu seznam na výběr a pro každé pole vstupní políčko. Část se zobrazí, až když existuje aspoň jeden typ kódu nebo pole.
- **Jako sloupec v tabulce úkolů.** Klikněte na **+** vpravo v záhlaví tabulky (tlačítko *Přidat sloupec*) a pod položkou *Vlastní* zvolte typ kódu nebo pole. V buňce typu kódu zadáte kód, například `N`, nebo vyberete ze seznamu. Když kód neexistuje, aplikace zobrazí hlášení *Vyberte hodnotu z tohoto kódu aktivity.*

### Použití

Typ kódu nebo vlastní pole můžete použít k filtrování, seskupování a řazení. Nastavíte to pomocí rozložení. Zvolte *Zobrazení › Rozložení › Nové rozložení*. V okně zaškrtněte části, které chcete zachovat. Pokud zvolíte *Uložit*, objeví se v *Zobrazení › Rozložení* tlačítko, na které můžete později znovu kliknout. Pokud zvolíte *Použít bez uložení*, zobrazíte rozložení na obrazovce jen teď. Při seskupování skončí úkoly bez hodnoty pod *(žádné)*.

Pro barvy pruhů zvolte *Zobrazení › Směrné plány a průběh › Barvy pruhů*, potom *Podle kategorie* a typ kódu. Každý pruh pak dostane barvu, kterou má jeho hodnota v poli *Barva*.

## Úskalí a co aplikace dělá

**Mazání odstraní hodnoty u úkolů.** Když smažete typ kódu, hodnotu nebo pole pomocí koše, aplikace se nezeptá na potvrzení. Hodnoty na všech úkolech zmizí. Seskupení nebo řazení podle tohoto typu kódu nebo pole také přestane platit. *Vrátit zpět* (Ctrl+Z) obnoví typ kódu, hodnotu nebo pole i vyplněné hodnoty, ale ne seskupení ani řazení. Seskupení a řazení musíte nastavit znovu.

**Dvě hodnoty se stejným kódem.** *Přidat hodnotu* pokračuje v číslování od počtu hodnot, které existují. Když jednu smažete a jednu přidáte, může se stejný kód objevit dvakrát. Když takový kód zadáte do buňky sloupce, aplikace to odmítne hlášením *Tato hodnota kódu aktivity se vyskytuje víckrát. Vyberte ji ze seznamu.* Dejte každé hodnotě vlastní kód.

**Šablony nepřebírají kódy ani pole.** Viz [Ukládání a vkládání šablon WBS](docs://howto-wbs-sjablonen). Když úkoly vložíte do jiného dokumentu, aplikace vymaže kódy a pole, které tam neexistují, a upozorní vás na to.

**Pole typu datum se s projektem nepřesune.** Když přesunete celý projekt, vyplněná vlastní pole typu *Datum* zůstanou u svého data. Aplikace to upozorní v náhledu.

## Viz také

- [Úprava struktury](docs://howto-structuur-aanpassen): strom WBS, druhý způsob, jak uspořádat úkoly.
- [Přesun projektu](docs://howto-project-verplaatsen): co se stane s daty, když projekt přesunete.
- [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken): seskupení a filtrování podle kódu nebo vlastního pole.
- [Úprava sloupců tabulky](docs://howto-tabelkolommen-aanpassen): zobrazení kódu nebo vlastního pole jako sloupce.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): kódy aktivit *House* a *Discipline*, vlastní pole *Cost estimate* a poznámky (otevřené a dokončené).
