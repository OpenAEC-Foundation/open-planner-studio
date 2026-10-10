# Vytvorenie a tlač zostavy

Cieľ: vyberte zostavu vášho plánu, skontrolujte ju v náhľade a uložte ju ako PDF, aby ste ju mohli rozdať alebo vytlačiť sami.

## Kedy to potrebujete

V piatok je stavebná porada. Klient chce plán na papieri, stavbyvedúci chce vedieť, čo sa začne v najbližších týždňoch, a majster chce list iba so svojimi úlohami. Tieto prehľady vytvárate na karte *Zostava*. Aplikácia ich vypočíta z vášho plánu a najprv ich zobrazí ako náhľad. Potom ich exportujete do PDF.

Aplikácia zostavu na tlačiareň sama neposiela. Konečným výstupom je vždy PDF. To vytlačíte vo svojom čítači PDF alebo to pošlete e-mailom.

## Kroky

### 1. Otvorte kartu *Zostava*

Na páse s nástrojmi vyberte kartu *Zostava* alebo stlačte Ctrl+P. Ctrl+P vás prenesie na túto kartu. Ak píšete v poli, je otvorený dialóg alebo je zapnutý režim prezentácie, Ctrl+P nefunguje. V prehliadači sa potom otvorí tlačový dialóg prehliadača a ten vytlačí obrazovku, nie zostavu.

Vľavo je stĺpec *Zostava* so zoznamom *Typ zostavy*, súhrnom a nastaveniami. Vpravo je náhľad.

### 2. Vyberte typ zostavy

Zoznam *Typ zostavy* obsahuje jedenásť zostáv. Vyberte tú, ktorá zodpovedá vašej otázke.

- *Gantt-zostava*: plán ako pruhový graf, pre bežný plán na rozdanie.
- *Diagram zdrojov*: rovnaké pruhy, ale s oddielom pre každý zdroj. Pre otázku „Čo robí tím X?“ môžete mať, ak chcete, hárok pre každý tím.
- *Prehľad medzníkov*: všetky medzníky s dátumom a stavom.
- *Odchýlky*: aktuálny plán vedľa aktívneho pôvodného plánu. Pre otázku „Koľko meškáme?“.
- *Look-ahead*: čo beží alebo sa začína v nasledujúcom období. Zoznam pre týždennú poradu.
- *Kritické a takmer kritické*: úlohy s nulovou alebo takmer nulovou časovou rezervou.
- *Zostava postupu*: kde projekt stojí k dátumu kontroly stavu, teda dňu, ku ktorému meriate postup.
- *Stav plánu*: kontrola samotného plánu na chyby a neobvyklé hodnoty.
- *Zaťaženie zdrojov*: pre každý zdroj za týždeň alebo mesiac, čo je potrebné oproti tomu, čo je k dispozícii.
- *Priradenia zdrojov*: pre každý zdroj úlohy, ku ktorým je priradený.
- *Súhrn WBS*: plán zhrnutý po úrovniach WBS, pre vedenie.

### 3. Overte, že plán je aktuálny

Aplikácia sama nevypočítava. Ak ste od posledného prepočtu zmenili úlohy, závislosti alebo kalendáre, stlačte **Prepočítať** (F5). Tabuľkové zostavy vás na to upozornia samy, v hornej časti zostavy: *Plán sa zmenil od posledného prepočtu — stlačte Prepočítať (F5) pre aktuálne hodnoty.* Alebo, ak plán ešte nikdy nebol prepočítaný: *Ešte nie je prepočítané — stlačte Prepočítať (F5) pre dátumy a časovú rezervu.*

Pás s nástrojmi na karte *Zostava* nemá tlačidlo Prepočítať, ale klávesa F5 tu funguje tiež. Aj *Exportovať PDF* najprv sám vypočíta plán, ak je zastaraný. PDF tak nikdy nezaostáva za vaším plánom.

### 4. Upravte zostavu

Pod *Nastavenia* sú voľby pre zostavy *Gantt-zostava* a *Diagram zdrojov*. Look-ahead, Kritické a takmer kritické, Zostava postupu, Stav plánu, Zaťaženie zdrojov, Priradenia zdrojov a Súhrn WBS majú len *Papier:* a *Orientácia:*, a k tomu oddiel *Možnosti zostavy* s voľbami danej zostavy. *Prehľad medzníkov* a *Odchýlky* nemajú vlastné voľby. Obdobie zostavy nastavíte v článku [Výber obdobia zostavy](docs://howto-rapportageperiode-kiezen).

- *Papier:* a *Orientácia:* určujú hárok. Predvolene je to A3 na šírku, čo sa hodí pre stavebný plán, ale nie každá tlačiareň tlačí A3. Ak máte tlačiareň A4, vyberte teraz A4. Aplikácia potom rozloží stránky pre A4 a nemusíte ich neskôr zmenšovať.
- Pri diagrame zdrojov dá začiarkavacie políčko *Každý zdroj na novej stránke* hárok pre každý tím.
- *Veľkosť písma:* (90% až 125%) zväčší alebo zmenší text a tabuľku. Väčšie písmo zanechá menej miesta pre časovú os.
- *Sledovať zobrazenie (filter, zoskupenie, zoradenie)* sa zobrazí len pri Gantt-zostave. Predvolene sa na papier dostane celý strom úloh. Pri tomto začiarkavacom políčku zostava vykreslí presne riadky, ktoré vidíte na obrazovke, vrátane zbalených fáz, napríklad iba kritické úlohy z rozloženia. Ako takéto zobrazenie vytvoríte, je v článku [Vytvorenie a použitie rozloženia](docs://howto-layouts-gebruiken).
- *Zobraziť prekryv pôvodného plánu* zobrazí aktívny pôvodný plán vedľa aktuálnych pruhov. Vo voľbe *Stavová čiara:* vyberiete *Čiara dátumu kontroly stavu* alebo *Čiara postupu*.
- *Prispôsobiť papieru* je predvolene zapnuté: časová os sa potom prispôsobí šírke stránky a počet strán vyplynie z výšky. Ak ho vypnete, zostava použije pevné priblíženie a rozdelí sa aj na šírku, čo rýchlo vytvorí veľa strán. Vo voľbe *Časová os na:* rozložíte časovú os na 2 až 8 strán na šírku s automatickým prispôsobením. Hodí sa to pre dlhý plán, ktorý chcete vytlačiť v čitateľnej veľkosti.

### 5. Skontrolujte náhľad

Pri Gantt-zostave a Diagrame zdrojov vidíte papier s hlavičkou stránky, tabuľkou, časovou osou a legendou. Posúvajte sa a pozrite si stránky. *Kvalita náhľadu* určuje len ostrosť náhľadu na obrazovke. PDF sa podľa nej nemení. Ak pod stránkami stojí *… a ešte 1 stránka — pre celý dokument exportujte* (pri viacerých stránkach *… a ešte 2 stránky — pre celý dokument exportujte*), náhľad ešte nemá všetky stránky pripravené. PDF obsahuje všetky stránky.

Ostatné zostavy sa na obrazovke zobrazujú ako tabuľka. Čo vidíte, to sa dostane do PDF.

### 6. Exportujte do PDF

Dole v ľavom stĺpci kliknite na **Exportovať PDF**. Navrhovaný názov súboru je názov projektu a za ním druh zostavy. Pre Gantt-zostavu je to napríklad *Extension house-planning.pdf*.

- V desktopovej aplikácii a v prehliadači, ktorý má dialóg na ukladanie súborov, vyberiete, kam sa PDF uloží. Ak dialóg zatvoríte bez uloženia, nestane sa nič.
- V prehliadači bez takéhoto dialógu prehliadač uloží PDF do priečinka na stiahnuté súbory.

### 7. Vytlačte PDF

Otvorte PDF vo svojom čítači PDF a vytlačte ho tam. Ak vytlačíte PDF vo formáte A3 na tlačiarni A4, tlačový dialóg musí stránky zmenšiť. Preto formát papiera nastavte najprv v kroku 4.

## Úskalia a čo aplikácia robí

**Tlačidlo Tlačiť a Ctrl+P netlačia.** Tlačidlo *Tlačiť* v skupine *Zostava* je na samotnej karte *Zostava* a nerobí nič navyše. Ctrl+P vás prenesie na túto kartu. Aplikácia nemá samostatný príkaz na tlač. Cesta na papier vedie cez PDF. Ak Ctrl+P nefunguje (pozri krok 1), otvorí sa v prehliadači tlačový dialóg prehliadača a ten vytlačí obrazovku, nie zostavu.

**Pole Spoločnosť: prepísanie sa neuchová.** Pole *Spoločnosť:* v Gantt-zostave sa začína spoločnosťou z info o projekte. Text, ktorý tam prepíšete, sa neuchová. Do poľa *Autor:* tu nemôžete písať. Obe hodnoty zmeníte cez *Nastavenia › Projekt › Info o projekte*, v poliach *Objednávateľ/organizácia* a *Autor*, a potvrdíte tlačidlom *Použiť*.

**Farby pruhov: platí aj pre vašu obrazovku.** Voľba *Farby pruhov:* v zostave je tá istá voľba ako *Farby pruhov* na karte *Zobrazenie*. Ak ju zmeníte v zostave, zmení sa s ňou aj váš Gantt na obrazovke.

**Odchýlky bez pôvodného plánu.** Pôvodný plán je uložená kópia vášho plánu, s ktorou neskôr porovnávate. Ako ho uložiť, je v článku [Ukladanie a údržba pôvodného plánu](docs://howto-baseline-opslaan-en-beheren). Ak nemáte aktívny pôvodný plán, namiesto porovnania sa zobrazí hláška: *Žiadny aktívny pôvodný plán — uložte pôvodný plán alebo nastavte jeden ako aktívny.*

**Stavová čiara bez dátumu kontroly stavu.** Ak vyberiete *Stavová čiara:*, keď projekt nemá dátum kontroly stavu, zostava upozorní hláškou *Najprv nastavte dátum kontroly stavu* a nič nevykreslí. Dátum kontroly stavu nastavíte cez *Plán › Smerné plány a postup › Dátum kontroly stavu*.

**Plán obsahuje slučku.** Ak plán obsahuje slučku, *Exportovať PDF* nevytvorí súbor a zobrazí chybu.

**Papier zatiaľ platí pre všetky zostavy.** Pre voľby *Papier:* a *Orientácia:* platí jedna spoločná voľba pre všetky zostavy. *Prehľad medzníkov* a *Odchýlky* nemajú vlastnú voľbu papiera. Použijú to, čo ste nastavili v inej zostave, predvolene A3 na šírku. Papier preto najprv vyberte v zostave, ktorá ho ponúka, napríklad v Gantt-zostave, a potom sa vráťte.

**Nastavenia platia pre všetky projekty.** Papier, veľkosť písma, obdobie a ďalšie voľby si aplikácia pamätá na tomto zariadení, pre všetky vaše projekty. Nepatria do súboru projektu.

## Pozri tiež

- [Výber obdobia zostavy](docs://howto-rapportageperiode-kiezen): výhľad alebo zostava postupu za určitý časový úsek.
- [Vytvorenie a použitie rozloženia](docs://howto-layouts-gebruiken): najprv filtrujte alebo zoskupte, potom tlačte s *Sledovať zobrazenie*.
- [Ukladanie a údržba pôvodného plánu](docs://howto-baseline-opslaan-en-beheren): pôvodný plán, s ktorým porovnáva *Odchýlky*.
- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): čo robiť, keď Zaťaženie zdrojov ukazuje preťažené týždne.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): prečo je úloha kritická alebo takmer kritická.
- [Typy zostáv](docs://ref-rapporttypes): všetky typy zostáv a ich voľby.
