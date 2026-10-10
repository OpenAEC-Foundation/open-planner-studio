# Formáty pre import a export

Pre každý formát súboru: či ho môžete otvoriť, uložiť a exportovať, čo sa prenesie a čo nie a s akým profilom výpočtu sa otvorí. Dôvod a príklad s číslami nájdete v [Súbory a formáty](docs://uitleg-bestanden).

## Prehľad

**Otvorenie** funguje s formátmi IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` a `.xer`. Súbor s inou príponou aplikácia berie ako IFC.

**Ukladanie** vždy zapíše IFC. Cieľom pre uloženie sa stane len otvorený súbor IFC. Projekt z iného formátu nemá po otvorení žiadny súbor a *Uložiť* sa potom spýta, kam sa má súbor IFC uložiť.

**Export** funguje do formátov IFC 4x3, MS Project XML, Primavera P6 XML, CSV a dvoch hárkov postupu (Excel a CSV). Export nemení váš projekt.

**Len na čítanie** sú `.mpp` a `.xer`. Aplikácia ich môže otvoriť, nie zapísať.

**PDF** vzniká len zo zostavy (pozri [Typy zostáv](docs://ref-rapporttypes)). Aplikácia PDF nečíta.

**Kde.** Otvorenie: *Domov › Súbor › Otvoriť*, *Súbor › Otvoriť* alebo Ctrl+O. Export: *Domov › Súbor › Exportovať* alebo *Súbor › Exportovať*. Vyplnený hárok postupu načítate cez *Súbor › Importovať*, alebo tlačidlom *Aktualizovať postup z tabuľky* v skupine *Postup* na kartách *Plán*, *Tabuľka* a *Zostava*.

**Profil výpočtu pri otvorení.** Každý formát sa otvorí s profilom výpočtu. Čo to je, je v [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies). `.xer` sa otvorí s *Primavera P6*, `.mpp` s *Microsoft Project* a CSV, MS Project XML a P6 XML s *Open Planner Studio*. IFC zachováva profil uložený v súbore. Pri `.xer` a `.mpp` aplikácia oznámi, že projekt sa vypočítava týmto spôsobom. Len IFC prenáša profil výpočtu a možnosti výpočtu. Z možností výpočtu zapíše MS Project XML najviac kritickú prahovú hodnotu. Znovu otvorený export iného formátu sa vypočíta ako *Open Planner Studio*.

## IFC

**Otvorenie** — áno, `.ifc`. Aplikácia číta IFC 4.3. Profil výpočtu: ten, ktorý je v súbore.

**Uloženie** — áno. Je to jediný formát, do ktorého sa dá ukladať. *Uložiť* zapíše celý projekt ako súbor IFC. Súbor sa stane cieľom pre uloženie.

**Export** — áno, ako *IFC 4x3* (označený ako *Štandard BuildingSMART. 4D prepojenie s modelmi BIM*). Predvolený názov: názov projektu s príponou `.ifc`. Ak je váš projekt prepojený s knižnicou zdrojov, začiarkavacie políčko *Uložiť súbor knižnice vedľa* je pod dlaždicami v *Súbor › Exportovať*. Ak je políčko zaškrtnuté, aplikácia sa po projekte pýta na miesto pre *názovprojektu-knižnica.ifc*. Políčko nie je v zozname na karte *Domov*.

**Čo sa prenesie** — všetko, čo patrí k projektu: úlohy so štruktúrou, trvaním, dátumami a postupom; závislosti s oneskorením; obmedzenia a termíny; kalendáre; zdroje a priradenia vrátane rozloženia práce po hodinách; pôvodné plány; kódy aktivít a vlastné polia; poznámky; prepojenia medzi projektmi; prestávky; pravidlá práce a typy úloh; nastavenia projektu, ako dátum kontroly stavu, režim postupu, profil výpočtu a možnosti výpočtu; prepojenie s knižnicou zdrojov. Pri projekte z `.xer` sa prenesie aj pôvodný zdrojový súbor. Vlastný typ úlohy sa uloží ako typ IFC `USERDEFINED` s názvom v poli ObjectType, takže iné programy pre IFC čítajú úlohu normálne. Aplikácia tiež uchováva pevné id typu, takže premenovanie nepreruší prepojenie. Ak niekto otvorí súbor na inom počítači, typ sa tam zobrazí v časti *Z tohto projektu*, nie vo *Moje typy úloh*.

**Čo sa neprenesie** — spôsob, akým ste nastavili obrazovku (priblíženie, poloha posúvania, vybraná úloha, zbalené fázy, zvolený filter a zoskupenie), a nastavenia aplikácie ([Nastavenia](docs://ref-instellingen)). Karta *IFC* zobrazuje text IFC vášho projektu.

## MS Project XML (MSPDI)

**Otvorenie** — áno. Aplikácia rozpozná súbor `.xml` ako MS Project XML podľa koreňového prvku `Project` v mennom priestore MS Project (alebo bez menného priestoru). Profil výpočtu: *Open Planner Studio*.

**Ukladanie** — nie. Takýto projekt nemá cieľ pre uloženie.

**Export** — áno, ako *MS Project XML* (*Otvára sa v Microsoft Project. Úplná WBS*). Predvolený názov: názov projektu s príponou `.xml`.

**Čo sa prenesie** — úlohy so štruktúrou (úroveň a WBS), trvaním, dátumami a postupom; závislosti s oneskorením, aj v hodinách alebo percentách; obmedzenia vrátane termínu; kalendáre vrátane kalendárov úloh a zdrojov; zdroje a priradenia vrátane krivky alebo rozloženia práce po hodinách; dátum kontroly stavu; kritická prahová hodnota ako celé číslo pracovných dní od 0 vyššie s *Celková časová rezerva ≤ prahová hodnota*; popis úlohy (ako poznámka); pravidlo práce úlohy (ako typ úlohy MS Project); vlastný typ úlohy v poli voľného textu (`ExtendedAttribute`), ktorý aplikácia opäť načíta a ktorý MS Project môže ignorovať. Z vašich pôvodných plánov sa prenesie len aktívny, ako pôvodný plán 0. Úloha v hodinách si zachová jednotku a medzník si zachová svoj druh (začiatok, dokončenie alebo automatický).

**Čo sa neprenesie** — poznámky (kontrolný zoznam úlohy), prepojenia medzi projektmi, kódy aktivít a vlastné polia, druhé obmedzenie, označenie *Manuálne plánovaná*, oneskorenie pri vyvažovaní, bod pokračovania a zastavenia úlohy s postupom mimo poradia, pravidlá výpočtu *Zostávajúca práca pokračuje po uplynulom trvaní* a *Nepresúvať nezačaté úlohy na dátum kontroly stavu* profilu MS Project, a ostatné možnosti výpočtu. Úlohy s prestávkami bez rozloženia práce po hodinách sa prenesú bez týchto prestávok.

**Mení sa cestou** — obmedzenie *Musí začať dňa (MSO)* alebo *Musí skončiť dňa (MFO)* bez možnosti *Povinné (ukotvenie logiky)* sa zmení na *Začiatok nie skôr ako (SNET)* alebo *Dokončiť nie skôr ako (FNET)*. Hamak sa stane bežnou úlohou s vypočítanými dátumami.

## Súbor MS Project (`.mpp`)

**Otvorenie** — áno, od MS Project 2010 do 2021. Profil výpočtu: *Microsoft Project*. Aplikácia len číta súbor: váš `.mpp` nikdy nemení. Súbor z MS Project 2007 alebo staršieho a súbor chránený heslom odmietne so správou, ktorá ukazuje na export XML programu MS Project.

**Ukladanie** — nie. Nie je ani cieľ pre uloženie: *Uložiť* zapíše nový súbor IFC.

**Export** — nie.

**Čo sa prenesie** — úlohy so štruktúrou, trvaním a obmedzeniami; závislosti s oneskorením; kalendáre; zdroje a priradenia; postup; kód WBS, ktorý ste doplnili sami v MS Project. Dátumy a časová rezerva, ktoré MS Project vypočítal sám, sa tiež načítajú pre zobrazenie *Dátumy tak, ako sú zaznamenané*.

**Čo sa neprenesie** — pôvodné plány, náklady a štandardné sadzby, poznámky a vlastné polia programu MS Project. Pozri [Otváranie súboru MS Project (.mpp)](docs://howto-mpp-openen).

**Pôvod a licencia** — čítač `.mpp` bol napísaný pre Open Planner Studio a vychádza zo zdrojového kódu a štruktúrnych poznatkov knižnice MPXJ (`github.com/joniles/mpxj`, Jon Iles a ďalší), Java knižnice pod licenciou LGPL-2.1. Štruktúra a konštanty polí boli prenesené do TypeScriptu. Open Planner Studio je sám osebe open source pod licenciou LGPL-3.0. Čítač `.xer` nie je odvodenina: knižnica MPXJ sa tam použila len ako zdroj porozumenia.

## Primavera P6 XML

**Otvorenie** — áno. Aplikácia rozpozná súbor `.xml` ako P6 XML podľa koreňového prvku `APIBusinessObjects`. Profil výpočtu: *Open Planner Studio*.

**Ukladanie** — nie.

**Export** — áno, ako *Primavera P6 XML* (*Pre Oracle Primavera P6*). Predvolený názov: názov projektu s príponou `.xml`, teda rovnaký názov ako pri exporte MS Project XML. Dajte im rôzne názvy sami.

**Čo sa prenesie** — štruktúra WBS a úlohy s trvaním, dátumami a postupom; závislosti s oneskorením; obmedzenia (aj druhé, ako mäkké obmedzenie); kalendáre; zdroje a priradenia; dátum kontroly stavu (ako `DataDate`); vlastný typ úlohy v samostatnom poli `OPS Custom Task Type`, ktoré aplikácia opäť načíta a ktoré P6 môže ignorovať.

**Čo sa neprenesie** — pôvodné plány a termíny; kódy aktivít, vlastné polia, poznámky a prepojenia medzi projektmi; možnosti výpočtu; výnimka pracovného kalendára (výnimka, ktorá robí deň pracovným). P6 nemá oneskorenie v percentách: aplikácia ho prevedie na pevný počet dní. Oneskorenie v kalendárnych dňoch sa zmení na oneskorenie v pracovnom čase: 3 kalendárne dni sa stanú 3 pracovnými dňami. Hamak sa stane bežnou úlohou, manuálne plánovaná úloha sa stane bežnou úlohou s vypočítanými dátumami a oneskorenie pri vyvažovaní kratšie ako deň sa zahodí.

## Súbor Primavera (`.xer`)

**Otvorenie** — áno. Profil výpočtu: *Primavera P6*. Aplikácia len číta súbor: `.xer` nikdy nezapisuje a váš súbor nemení. Pre každý projekt s úlohami otvorí jednu kartu. Súbor bez úloh alebo s poškodenými tabuľkami odmietne so správou.

**Ukladanie** — nie. Nie je ani cieľ pre uloženie: *Uložiť* zapíše nový súbor IFC s pôvodným `.xer` vnútri.

**Export** — nie. Ak exportujete projekt z `.xer` do CSV, MS Project XML alebo P6 XML, aplikácia oznámi, že informácie zo zdroja XER sa stratia, aj keď ste projekt medzitým uložili ako IFC. Do IFC sa nič nestratí.

**Čo sa prenesie** — štruktúra WBS a úlohy s trvaním, dátumami, obmedzeniami a postupom; závislosti s oneskorením; kalendáre; zdroje s priradeniami; kódy aktivít; vlastné polia (UDF); poznámky; nastavenia plánovania P6. Úloha typu *Level of Effort* sa stane hamakom. Pôvodný plán projektu sa stane aktívnym pôvodným plánom projektu, ktorý naň odkazuje. Prepojenie medzi projektmi si aplikácia ponechá ako zdrojový údaj.

**Čo sa neprenesie** — projekt bez úloh a prepojenie medzi projektmi ako skutočná závislosť vo vašom pláne. Pozri [Otváranie súboru Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Otvorenie** — áno. Aplikácia číta `;` a `,` ako oddeľovač. Rozpozná hlavičky stĺpcov v angličtine a holandčine (napríklad `Name` alebo `Naam`, `Duration` alebo `Duur`, `Predecessors` alebo `Voorgangers`). Dátumy môžu byť *rrrr-mm-dd*, *dd.mm.rrrr* alebo *dd/mm/rrrr*. Predchádzajúcu úlohu zapíšete ako kód WBS, typ závislosti a oneskorenie, napríklad `1.2FS+2d`. Profil výpočtu: *Open Planner Studio*. Projekt sa volá *CSV Import*. Typ úlohy `Task Type`, ktorý nie je jedným z pevných kódov (ako `CONSTRUCTION` alebo `INSTALLATION`, ktoré aplikácia zapisuje sama), sa stane vlastným typom úlohy v časti *Z tohto projektu*, nie vo *Moje typy úloh*. S `OPS Custom Task Type ID` sa zachová id vlastného typu.

**Ukladanie** — nie.

**Export** — áno, ako *CSV (;)* (*Univerzálny export tabuľky. Všetky úlohy s dátumami a trvaním*), na dlaždici *CSV (oddelené bodkočiarkou)*. Súbor používa bodkočiarku ako oddeľovač, je v UTF-8 s BOM a má anglické hlavičky stĺpcov.

**Čo sa prenesie** — pre každú úlohu tieto stĺpce: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` a `Description`. Percento dokončenia je v celých percentách.

**Čo sa neprenesie** — zdroje, priradenia, kalendáre, obmedzenia, termíny, pôvodné plány a dátum kontroly stavu. Ak sú dátumy v zobrazení *Dátumy tak, ako sú zaznamenané*, export nechá stĺpce `Critical` a `Total Float` prázdne pri úlohách, v ktorých zdrojový súbor to nezaznamenal.

## Hárok postupu (Excel a CSV)

**Otvorenie** — áno, cez *Súbor › Importovať* (*Aktualizovať postup z tabuľky*), alebo cez tlačidlo s rovnakým názvom v skupine *Postup* na kartách *Plán*, *Tabuľka* a *Zostava*. Aplikácia číta `.xlsx` a `.csv`, až do 16 MB a 50 000 riadkov. Týmto sa projekt neotvorí: aktualizuje sa postup vášho otvoreného projektu. Pozri [Import postupu z tabuľky](docs://howto-voortgang-importeren).

**Ukladanie** — nie.

**Export** — áno, ako *Hárok postupu (Excel)* (*Postup (Excel)* v zozname) a *Hárok postupu (CSV)* (*Postup (CSV)*). Predvolený názov: *názovprojektu-postup*. Tlačidlo *Exportovať tabuľku postupu* v rovnakej skupine vytvorí hárok Excel jedným kliknutím. Hárok Excel má pevné šírky stĺpcov, uzamknuté polia a kontrolu dátumov. Hárok CSV má rovnaký obsah ako čistý text.

**Čo sa prenesie** — stĺpce `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` a `Actual Finish`. Pri načítaní aplikácia použije `Completion (%)`, `Actual Start` a `Actual Finish`. `Start` a `Finish` slúžia len na rozpoznanie zápisu dátumov a nemenia váš plán. Riadky priradí k úlohám podľa `OPS Task ID`, inak podľa jedinečného kódu WBS.

**Čo sa neprenesie** — všetko mimo týchto stĺpcov: trvanie, závislosti, zdroje a zvyšok vášho plánu. Súhrnná úloha nedostane postup z hárka.

## PDF

**Otvorenie** — nie.

**Ukladanie** — nie.

**Export** — áno, zo zostavy: na karte *Zostava* tlačidlo *Exportovať PDF*. Aplikácia zostavu neposiela priamo na tlačiareň. Na papier sa dostanete cez PDF. Obsah závisí od typu zostavy: pozri [Typy zostáv](docs://ref-rapporttypes) a [Tvorba a tlač zostavy](docs://howto-rapport-maken-en-afdrukken).

## Pozri tiež

- [Súbory a formáty](docs://uitleg-bestanden): prečo je IFC vlastný formát a čo export stratí, s príkladom.
- [Otvorenie a uloženie súboru](docs://howto-bestand-openen-en-opslaan): kroky.
- [Export](docs://howto-exporteren): výber formátu a hlásenia po exporte.
- [Dátumy tak, ako sú zaznamenané](docs://uitleg-datums-zoals-opgeslagen): prečo môže otvorený súbor zobrazovať iné dátumy.
- [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): profily výpočtu.
