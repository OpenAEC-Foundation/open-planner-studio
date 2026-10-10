# Práce s přehledem obsazenosti

Cíl: zjistěte, ve kterých dnech dva nebo více otevřených projektů žádá společně o jeden zdroj víc, než má knihovna zdrojů.

## Kdy to potřebujete

Váš zednický tým pracuje na fasádách v jednom projektu a na garážích v jiném. Každý projekt ukazuje tým jako dobře naplánovaný, protože histogram a přetížení projektu se dívají jen na ten jeden projekt. Teprve když projekty položíte vedle sebe, ukáže se, že ve stejných dnech žádají dohromady víc zedníků, než máte. Přehled obsazenosti to srovnání udělá za vás.

Přehled počítá jen zdroje, které pocházejí z knihovny zdrojů, a to v projektech propojených se stejnou knihovnou. Jak se to počítá, si přečtete v článku [Knihovna zdrojů](docs://uitleg-resourcebibliotheek).

## Postup

### 1. Připravte projekty

1. Otevřete projekty, které chcete porovnat, každý v samostatné záložce. Viz [Práce s více projekty najednou](docs://howto-meerdere-projecten). Přehled vidí jen projekty, které jsou otevřené v této aplikaci.
2. Propojte každý projekt se stejnou knihovnou a v každém projektu používejte zdroj z knihovny. Bez propojení s knihovnou panel zdrojů přehled nezobrazí. Viz [Práce s knihovnou zdrojů](docs://howto-resourcebibliotheek-gebruiken).
3. Projekty přepočítejte příkazem *Přepočítat* (F5), nebo zapněte *Automaticky přepočítat*. Co přehled udělá se zastaralými projekty, je popsáno níže v části úskalí.

### 2. Otevřete přehled

1. Přejděte na jeden z projektů a na kartě *Zdroje* zvolte *Správa › Zdroje*.
2. Vpravo nahoře zvolte *Obsazenost*. Přehled patří ke knihovně projektu, ve kterém právě jste. V tomto panelu nemůžete nic měnit: je to okno jen pro čtení.

### 3. Přečtěte si tabulku

Každý zdroj z knihovny, který je zarezervovaný alespoň v jednom otevřeném projektu, dostane řádek. Zdroje bez rezervace se nezobrazují. Nahoře jsou řádky s nejvíce dny s přetížením, dál podle abecedy.

- *Dokumenty* říká, v kolika projektech je zdroj zarezervovaný, například *2 dokumenty*.
- *Období* jde od prvního do posledního dne, kdy je zdroj obsazen, a zapisuje se jako rrrr-mm-dd, například *2027-06-07 – 2027-06-14*.
- *Špička / Kapacita* porovnává nejvyšší denní obsazení všech projektů dohromady s kapacitou zdroje v knihovně, například *4.0 / 3.0*. Je-li alespoň jeden den s přetížením, zobrazí se červeně.
- Červená značka za řádkem, například *3 dny přetíženy*, počítá dny, na kterých je součet větší než kapacita. Když nad ní podržíte myš, uvidíte jednotlivá data.

### 4. Podívejte se na jednotlivé projekty

1. Klikněte na malou šipku před názvem zdroje. Řádek se rozbalí.
2. Nahoře jsou dny s přetížením: prvních pět a potom *… a 3 další*, pokud jich je víc. Pod tím je u každého projektu název s obdobím a špičkou samotného projektu, například *Houses North 2027-06-07 – 2027-06-11 Špička: 2.0*.
3. Klikněte na samotný řádek a dole se zobrazí histogram. Každý projekt má vlastní barvu a sloupce jsou naskládané. Čárkovaná čára je kapacita knihovny. Když se mění v čase, uvidíte schody. Dny s přetížením dostanou za sloupci červený pruh. Klikněte na řádek ještě jednou a histogram se zavře. Když není vybraný žádný řádek, zobrazí se text *Vyberte zdroj a zobrazí se histogram.*

### 5. Vyřešte to

Přehled problém ukáže, ale nevyřeší ho. Máte dvě možnosti:

- Přesuňte úkol v jednom z projektů, nebo mu přiřaďte méně jednotek přiřazení za den. Potom ten projekt přepočítejte klávesou F5.
- Pokud opravdu přibude někdo navíc, zvyšte *Maximální počet jednotek* zdroje v knihovně. Uděláte to na kartě *Zdroje › Správa › Zdroje*, v zobrazení *Knihovna*.

*Vyrovnat…* na pásu karet tady nepomůže: pracuje se zdroji jen jednoho projektu, ve kterém jste. Viz [Vyrovnání zdrojů](docs://uitleg-nivelleren).

## Úskalí a co aplikace potom udělá

**Přehled je prázdný.** Zobrazí se text *V otevřených dokumentech nejsou zarezervovány žádné zdroje z knihovny.* Pak žádný otevřený projekt nemá na žádném úkolu zdroj z knihovny.

**Tlačítko *Obsazenost* nevidíte.** Projekt, ve kterém jste, není propojený s knihovnou.

**Projekt se nepočítá.** Není otevřený v této aplikaci, je propojený s jinou knihovnou, nebo je zdroj v něm vlastní zdroj projektu. Dole v přehledu vždy stojí: *Tento přehled vidí jen dokumenty otevřené v této aplikaci.* Kopie zdroje, který byl mezitím odstraněn z knihovny, se také nepočítá.

**Kopie nebo varianta se počítá celá.** Počítá se každý otevřený projekt propojený s knihovnou, i když je kopií nebo variantou jiného otevřeného projektu, například variantou, kterou vytvořil AI asistent pomocí `planner_duplicate_document`. Originál a varianta dohromady pak mohou ukázat přetížení, které ve skutečnosti existuje jen jednou. Přehled to tiše nefiltruje: zavřete na chvíli variantu, nebo to při čtení berte v úvahu.

**Projekt je zastaralý.** Projekt je zastaralý, pokud jste v plánu něco změnili bez přepočítání. Přehled pak s takovým projektem zachází takto:

- U projektu, který není aktivní záložkou, přehled sám předem přepočítá, aniž by projekt změnil. Nad tabulkou pak stojí: *Změněné dokumenty byly pro tento přehled předem přepočítány; stiskněte F5 v dokumentu, nebo zapněte „Automaticky přepočítat“, aby to platilo trvale.* Za projektem stojí: *Pro tento přehled předem přepočítáno — samotný dokument ukazuje starší data, dokud v něm nestisknete F5 nebo nezapnete „Automaticky přepočítat“.* Je-li zapnuto *Automaticky přepočítat* (*Nastavení › Projekt › Nastavení*, karta *Plán*), aplikace takové projekty skutečně přepočítá ve chvíli, kdy se díváte na přehled, a zpráva zmizí. Je-li zastaralý i aktivní projekt, zobrazí se nad tabulkou místo toho zpráva z dalšího bodu.
- Přehled nepřepočítává projekt, ve kterém jste, sám. Je-li tento projekt zastaralý, zobrazí se: *Změněný dokument ještě nebyl přepočítán; zahrnuje se zde s naposledy přepočítanými čísly. Stiskněte F5 v tom dokumentu, nebo zapněte „Automaticky přepočítat“.* a za projektem: *Zastaralé: jde o naposledy přepočítaná čísla — stiskněte F5 v tomto dokumentu.* Pozor: výraz *naposledy přepočítaná čísla* není zcela přesný. Přehled vezme staré počáteční data, ale už změněnou dobu trvání nebo přiřazení. Čísla se proto mohou lišit od starého i nového plánu a od pruhů v diagramu Gantt. Důvěřujte jim až po stisknutí F5.
- Když přehled projekt nemůže přepočítat, například kvůli smyčce v jeho závislostech, tento projekt se nepočítá. Stále je uveden, s textem *Nezapočítává se: plán nebyl přepočítán — aktivujte tento dokument a stiskněte F5.* a nad tabulkou *Alespoň jeden dokument nebyl přepočítán a v obsazenosti se nezapočítává.*

**Přehled neodpovídá tomu, co čekáte.** Kapacita pochází z knihovny zdrojů (*Maximální počet jednotek* položky v knihovně zdrojů, nebo její *Kapacita podle období* v daném dni), ne z pole *Maximální počet jednotek* kopie v projektu. Součet rovný kapacitě není přetížení.

## Viz také

- [Knihovna zdrojů](docs://uitleg-resourcebibliotheek): jak se obsazenost počítá, s příkladem.
- [Práce s knihovnou zdrojů](docs://howto-resourcebibliotheek-gebruiken): propojení projektů a přiřazování zdrojů.
- [Řešení přetížení](docs://howto-overbezetting-oplossen): přetížení v rámci jednoho projektu.
