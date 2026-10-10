# Vytvoření a tisk sestavy

Cíl: zvolte sestavu vašeho plánu, zkontrolujte ji v náhledu a uložte ji jako PDF, abyste ji mohli rozdat nebo vytisknout sami.

## Kdy to potřebujete

Pátek je schůzka na stavbě. Klient chce plán na papíře, stavbyvedoucí chce vědět, co začne v následujících týdnech, a mistr chce list jen se svými úkoly. Tyto přehledy vytváříte na kartě *Sestava*. Aplikace je vypočítá z vašeho plánu a nejprve je ukáže v náhledu. Potom je exportujete do PDF.

Aplikace sestavu tiskárně neodešle. Konečným výstupem je vždy PDF. Ten vytisknete ve čtečce PDF, nebo ho pošlete e-mailem.

## Postup

### 1. Otevřete kartu Sestava

Na pásu karet zvolte kartu *Sestava*, nebo stiskněte Ctrl+P. Ctrl+P vás přenese na tuto kartu. Pokud píšete do pole, je otevřené dialogové okno nebo je zapnutý režim prezentace, Ctrl+P nefunguje. V prohlížeči se potom otevře tiskový dialog prohlížeče. Ten vytiskne obrazovku, ne sestavu.

Vlevo je panel *Sestava* se seznamem *Typ sestavy*, souhrnem a nastaveními. Vpravo je náhled.

### 2. Zvolte typ sestavy

Seznam *Typ sestavy* obsahuje jedenáct sestav. Zvolte tu, která odpovídá vaší otázce.

- *Gantt-diagram*: plán jako pruhový graf, pro běžný plán k rozdání.
- *Diagram zdrojů*: stejné pruhy, ale s pásmem pro každý zdroj. Pro otázku „Co dělá parta X?“, pokud chcete, s listem na každou partu.
- *Přehled milníků*: všechny milníky s datem a stavem.
- *Odchylka*: aktuální plán vedle aktivního směrného plánu. Pro otázku „O kolik jsme se zpozdili?“.
- *Look-ahead*: co běží nebo začíná v následujícím období. Seznam pro týdenní schůzku.
- *Kritické a téměř kritické*: úkoly bez časové rezervy nebo s velmi malou časovou rezervou.
- *Sestava průběhu*: kde projekt stojí k datu stavu, tedy ke dni, ke kterému měříte průběh.
- *Stav plánu*: kontrola samotného plánu na chyby a neobvyklé hodnoty.
- *Vytížení zdrojů*: pro každý zdroj a každý týden nebo měsíc, co je potřeba a co je k dispozici.
- *Přiřazení zdrojů*: pro každý zdroj úkoly, ke kterým je přiřazen.
- *Souhrn WBS*: plán shrnutý po úrovních WBS, pro vedení.

### 3. Ujistěte se, že plán je aktuální

Aplikace nepřepočítává sama. Pokud jste od posledního přepočtu změnili úkoly, závislosti nebo kalendáře, stiskněte **Přepočítat** (F5). Tabulkové sestavy vás samy upozorní nahoře v sestavě: *Plán se od posledního přepočtu změnil — stiskněte Přepočítat (F5) pro aktuální hodnoty*. Nebo, pokud plán ještě nikdy nebyl přepočítán: *Ještě nepřepočítáno — stiskněte Přepočítat (F5) pro data a časovou rezervu*.

Pás karet na kartě Sestava nemá tlačítko Přepočítat, ale F5 zde funguje stejně dobře. *Exportovat PDF* také nejprve sám přepočítá, pokud je plán zastaralý. PDF tak nikdy nezaostává za vaším plánem.

### 4. Upravte sestavu

Pod položkou *Nastavení* jsou volby pro *Gantt-diagram* a *Diagram zdrojů*. Look-ahead, Kritické a téměř kritické, Sestava průběhu, Stav plánu, Vytížení zdrojů, Přiřazení zdrojů a Souhrn WBS mají jen volby *Papír* a *Orientace*, navíc blok *Možnosti sestavy* s volbami dané sestavy. Přehled milníků a Odchylka nemají vlastní volby. Období sestavy najdete v článku [Výběr období sestavy](docs://howto-rapportageperiode-kiezen).

- *Papír* a *Orientace* určují list. Ve výchozím stavu je to A3 na šířku, což se hodí pro stavební plán, ale ne každá tiskárna tiskne A3. Pokud máte tiskárnu A4, zvolte nyní A4. Aplikace pak rozloží stránky pro A4 a vy je nemusíte později zmenšovat.
- U Diagramu zdrojů dá zaškrtávací pole *Každý zdroj na nové stránce* list na každou partu.
- *Velikost písma*: (90% až 125%) zvětší nebo zmenší text a tabulku. Větší písmo zanechá méně místa pro časovou osu.
- *Sledovat zobrazení (filtr, seskupení, řazení)* se zobrazí jen pro *Gantt-diagram*. Ve výchozím stavu jde na papír celý strom úkolů. S tímto zaškrtávacím polem sestava vykreslí přesně ty řádky, které vidíte na obrazovce, včetně sbalených fází, například jen kritické úkoly z rozložení. Jak takové zobrazení vytvořit, je popsáno v článku [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken).
- *Zobrazit překryv směrného plánu* ukáže aktivní směrný plán vedle aktuálních pruhů. S volbou *Čára stavu*: zvolíte *Čára datumu stavu* nebo *Čára průběhu*.
- *Automaticky přizpůsobit papíru* je ve výchozím stavu zapnuto. Časová osa se pak přizpůsobí šířce stránky a počet stránek vyplyne z výšky. Když ho vypnete, sestava použije pevné měřítko a rozdělí se i do šířky, což rychle vytvoří mnoho stránek. S volbou *Časová osa na*: rozložíte časovou osu na 2 až 8 stránek do šířky při automatickém přizpůsobení. Hodí se to pro dlouhý plán, který chcete vytisknout v čitelné velikosti.

### 5. Zkontrolujte náhled

Pro Gantt-diagram a Diagram zdrojů vidíte papír se záhlavím stránky, tabulkou, časovou osou a legendou. Listujte stránkami. *Kvalita náhledu* určuje jen ostrost náhledu na obrazovce. PDF se podle ní nemění. Pokud pod stránkami stojí *… a ještě 1 stránka — pro celý dokument exportujte* (u více stránek *… a ještě 2 stránky — pro celý dokument exportujte*), náhled nemá všechny stránky připravené. PDF obsahuje všechny stránky.

Ostatní sestavy se zobrazí na obrazovce jako tabulka. Co vidíte, to je i v PDF.

### 6. Exportujte do PDF

V dolní části levého panelu klikněte na **Exportovat PDF**. Navržený název souboru je název projektu a za ním druh sestavy. U Gantt-diagramu je to například *Extension house-planning.pdf*.

- V desktopové aplikaci a v prohlížeči, který má dialog pro ukládání souborů, zvolíte, kam se PDF uloží. Pokud dialog zavřete bez uložení, nic se nestane.
- V prohlížeči bez takového dialogu uloží prohlížeč PDF do složky pro stahování.

### 7. Vytiskněte PDF

Otevřete PDF ve čtečce PDF a vytiskněte ho tam. Pokud vytisknete PDF na formát A3 na tiskárně A4, musí tiskový dialog stránky zmenšit. Nastavte proto velikost papíru nejprve v kroku 4.

## Záludnosti a co aplikace dělá

**Tlačítko Tisknout a Ctrl+P netisknou.** Tlačítko *Tisknout* ve skupině *Sestava* je přímo na kartě *Sestava* a nedělá nic navíc. Ctrl+P vás přenese na tuto kartu. Aplikace nemá žádný samostatný příkaz pro tisk: k papíru se dostanete přes PDF. Pokud Ctrl+P nefunguje (viz krok 1), otevře se tiskový dialog prohlížeče. Ten vytiskne obrazovku, ne sestavu.

**Společnost: přepsaný text se neuchová.** Pole *Společnost* v Gantt-diagramu se předvyplní společností z informací o projektu. Co do něj přepíšete, se neuchová. Do pole *Autor* zde psát nemůžete. Obojí změníte v nabídce *Nastavení › Projekt › Info o projektu*, v polích *Objednatel/organizace* a *Autor*, a potvrdíte tlačítkem *Použít*.

**Barvy pruhů: platí i pro obrazovku.** Volba *Barvy pruhů* v sestavě je stejná volba jako *Barvy pruhů* na kartě Zobrazení. Pokud ji změníte v sestavě, změní se i Gantt na obrazovce.

**Odchylka bez směrného plánu.** Směrný plán je uložená kopie vašeho plánu, se kterou později porovnáváte. Jak ho uložit, je popsáno v článku [Uložení a správa směrného plánu](docs://howto-baseline-opslaan-en-beheren). Pokud nemáte aktivní směrný plán, místo porovnání se zobrazí *Žádný aktivní směrný plán — uložte směrný plán nebo některý nastavte jako aktivní*.

**Čára stavu bez datumu stavu.** Pokud zvolíte *Čára stavu*: a projekt nemá datum stavu, sestava upozorní *Nejprve nastavte datum stavu* a nenakreslí nic. Datum stavu nastavíte v nabídce *Plán › Směrné plány a průběh › Datum stavu*.

**Plán obsahuje smyčku.** Pokud plán obsahuje smyčku, *Exportovat PDF* soubor nevytvoří a zobrazí chybu.

**Papír platí zatím pro všechny sestavy.** Pro *Papír* a *Orientace* je jedna volba, společná pro všechny sestavy. Přehled milníků a Odchylka nemají vlastní volbu papíru: používají to, co jste nastavili v jiné sestavě, ve výchozím stavu A3 na šířku. Zvolte tedy papír nejprve v sestavě, která ji nabízí, například v Gantt-diagramu, a potom se vraťte.

**Volby platí pro všechny projekty.** Papír, velikost písma, období a ostatní volby si aplikace pamatuje na tomto zařízení pro všechny vaše projekty. Nepatří do souboru projektu.

## Viz také

- [Výběr období sestavy](docs://howto-rapportageperiode-kiezen): look-ahead nebo sestava průběhu za určité časové období.
- [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken): nejprve filtrujte nebo seskupte, potom tiskněte s volbou *Sledovat zobrazení (filtr, seskupení, řazení)*.
- [Uložení a správa směrného plánu](docs://howto-baseline-opslaan-en-beheren): snímek, se kterým se porovnává odchylka.
- [Řešení přetížení](docs://howto-overbezetting-oplossen): co dělat, když Vytížení zdrojů ukazuje přetížené týdny.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): proč je úkol kritický nebo téměř kritický.
- [Typy sestav](docs://ref-rapporttypes): všechny typy sestav a jejich volby.
