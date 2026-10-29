# Formáty pre import a export

Pre každý formát súboru: či ho môžete otvoriť, uložiť a exportovať, čo sa prenesie a čo nie a s akým profilom výpočtu sa otvorí. Dôvod a príklad s číslami nájdete v [Súbory a formáty](docs://uitleg-bestanden).

## Prehľad

**Otvorenie** funguje s formátmi IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` a `.xer`. Súbor s inou príponou aplikácia berie ako IFC.

**Ukladanie** vždy zapíše IFC. Cieľom pre uloženie sa stane len otvorený súbor IFC. Projekt z iného formátu nemá po otvorení žiadny súbor. Potom sa *Uložiť* spýta, kam sa má súbor IFC uložiť.

**Export** funguje do formátov IFC, MS Project XML, Primavera P6 XML, CSV a dvoch hárkov postupu (Excel a CSV). Export nemení váš projekt.

**Iba na čítanie** sú `.mpp` a `.xer`. Aplikácia ich môže otvoriť, nie zapísať.

**PDF** vzniká len zo zostavy (pozri [Typy zostáv](docs://ref-rapporttypes)). Aplikácia PDF nečíta.

**Kde.** Otvorenie: *Domov › Súbor › Otvoriť*, *Súbor › Otvoriť* alebo Ctrl+O. Export: *Domov › Súbor › Exportovať* alebo *Súbor › Exportovať*. Vyplnený hárok postupu načítate cez *Súbor › Importovať* alebo tlačidlom *Aktualizovať postup z tabuľky* v skupine *Postup* na páse s nástrojmi, na kartách *Plán*, *Tabuľka* a *Zostava*.

**Profil výpočtu pri otvorení.** Každý formát sa otvorí s profilom výpočtu. Čo to je, je v [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies). `.xer` sa otvorí s *Primavera P6*, `.mpp` s *Microsoft Project* a CSV, MS Project XML a P6 XML s *Open Planner Studio*. IFC zachová profil uložený v súbore. Pri `.xer` a `.mpp` aplikácia oznámi, že projekt sa vypočítava týmto spôsobom. Len IFC prenáša profil výpočtu a možnosti výpočtu. Z možností výpočtu zapíše MS Project XML najviac kritickú prahovú hodnotu. Znovu otvorený export iného formátu sa počíta ako *Open Planner Studio*.

## IFC

**Otvorenie** — áno, `.ifc`. Aplikácia číta IFC4 a IFC 4.3 (aj ADD2). Súbor v inej schéme, napríklad IFC2X3, sa tiež otvorí. Pri prvom uložení potom vyberiete schému, ktorú aplikácia dokáže zapísať (pozri [Výber schémy IFC](docs://howto-ifc-schema-kiezen)). Profil výpočtu: ten, ktorý je v súbore.

**Uloženie** — áno. Je to jediný formát, ktorý sa dá uložiť. *Uložiť* zapíše celý projekt ako súbor IFC v schéme IFC projektu (predvolene IFC 4.3 ADD2). Súbor sa stane cieľom pre uloženie.

**Export** — áno, ako *IFC*, v schéme IFC projektu (predvolene IFC 4.3 ADD2). Predvolený názov: názov projektu s príponou `.ifc`. Ak je váš projekt prepojený s knižnicou zdrojov, začiarkavacie políčko *Uložiť súbor knižnice vedľa* je pod dlaždicami v *Súbor › Exportovať*. Ak je políčko začiarknuté, aplikácia sa po projekte pýta na miesto pre *názovprojektu-knižnica.ifc*. Políčko nie je v zozname na karte *Domov*.

**Čo sa prenesie** — všetko, čo patrí k projektu: úlohy so štruktúrou, trvaním, dátumami a postupom; závislosti s oneskorením; obmedzenia a termíny; kalendáre; zdroje a priradenia vrátane rozloženia práce po hodinách; pôvodné plány; kódy aktivít a vlastné polia; poznámky; prepojenia medzi projektmi; prestávky; typy úloh a vlastné druhy prác; nastavenia projektu, napríklad dátum kontroly stavu, režim postupu, profil výpočtu a možnosti výpočtu; prepojenie s knižnicou zdrojov. Pri projekte z `.xer` sa prenesie aj pôvodný zdrojový súbor. Vlastný druh prác sa uloží ako typ IFC `USERDEFINED` s názvom v poli ObjectType. Iné programy pre IFC tak čítajú úlohu normálne. Aplikácia tiež uchováva pevné id druhu prác, takže premenovanie neporuší prepojenie. Ak niekto otvorí súbor na inom počítači, druh prác sa tam zobrazí v časti *Z tohto projektu*, nie v časti *Moje druhy prác*.

**Čo sa neprenesie** — spôsob, akým ste nastavili obrazovku (priblíženie, poloha posúvania, vybraná úloha, zbalené fázy, zvolený filter a zoskupenie), a [nastavenia aplikácie](docs://ref-instellingen). Karta *IFC* je editor s textom IFC vášho projektu. *Generovať IFC* ho obnoví, *Kopírovať* ho vloží do schránky a *Použiť* načíta text ako váš projekt a nahradí projekt na tejto karte.

## MS Project XML (MSPDI)

**Otvorenie** — áno. Aplikácia rozpozná súbor `.xml` ako MS Project XML podľa koreňového prvku `Project` v mennom priestore MS Project (alebo bez menného priestoru). Profil výpočtu: *Open Planner Studio*. Po otvorení vám aplikácia v jednej správe oznámi, čo neprevzala. Pozri [Otvorenie súboru MS Project (.mpp)](docs://howto-mpp-openen).

**Uloženie** — nie. Takýto projekt nemá cieľ pre uloženie.

**Export** — áno, ako *MS Project XML* (*Otvára sa v Microsoft Project. Úplná WBS*). Predvolený názov: názov projektu s príponou `.xml`.

**Čo sa prenesie** — úlohy so štruktúrou (úroveň a WBS), trvaním, dátumami a postupom; závislosti s oneskorením, aj v hodinách alebo percentách; obmedzenia vrátane termínu; kalendáre vrátane kalendárov úloh a zdrojov; zdroje a priradenia vrátane krivky alebo rozloženia práce po hodinách; dátum kontroly stavu; kritická prahová hodnota ako celé číslo pracovných dní, 0 alebo viac, s *Celková časová rezerva ≤ prahová hodnota*; popis úlohy (ako poznámka); typ úlohy (ako typ úlohy MS Project); vlastný druh prác vo voľnom poli (`ExtendedAttribute`), ktoré aplikácia opäť načíta a ktoré MS Project môže ignorovať. Z vašich pôvodných plánov sa prenesie len aktívny, ako pôvodný plán 0. Úloha v hodinách si zachová jednotku a medzník si zachová svoj druh (začiatok, dokončenie alebo automatický).

**Čo sa neprenesie** — poznámky (kontrolný zoznam úlohy), prepojenia medzi projektmi, kódy aktivít a vlastné polia, druhé obmedzenie, označenie *Manuálne plánovaná*, oneskorenie pri vyvažovaní, bod pokračovania a zastavenia úlohy s postupom mimo poradia, pravidlá výpočtu *Zostávajúca práca pokračuje po uplynulom trvaní* a *Nepresúvať nezačaté úlohy na dátum kontroly stavu* profilu MS Project, a ostatné možnosti výpočtu. Úlohy s prestávkami bez rozloženia práce po hodinách sa prenesú bez týchto prestávok.

**Sviatky pri otvorení.** Odvodený kalendár zdedí výnimky zo svojho základného kalendára. Kalendár s vlastným pracovným týždňom a bez výnimiek nedostane žiadne sviatky. Len úplne prázdny kalendár, bez základného kalendára, pracovného týždňa a výnimiek, si zachová štandardné holandské sviatky. Ak sviatky chýbajú, dátum dokončenia sa môže líšiť. Pozri [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren).

**Čo sa cestou zmení** — obmedzenie *Musí začať dňa (MSO)* alebo *Musí skončiť dňa (MFO)* bez voľby *Povinné (ukotvenie logiky)* sa zmení na *Začiatok nie skôr ako (SNET)* alebo *Dokončiť nie skôr ako (FNET)*. Hamak sa stane bežnou úlohou s vypočítanými dátumami. MS Project XML ukladá hodiny za deň len pre projektový kalendár. Iný kalendár s vlastnými hodinami za deň dostane pri otvorení súboru svoj pracovný čas ako hodiny za deň: 8 hodín za deň s pracovným časom 10 hodín sa stane 10. Úloha v dňoch na takom kalendári sa potom skráti, napríklad na 4 dni namiesto 5.

## Súbor MS Project (`.mpp`)

**Otvorenie** — áno, od MS Project 2010 do 2021. Profil výpočtu: *Microsoft Project*. Aplikácia len číta súbor, váš `.mpp` nikdy nemení. Súbor z MS Project 2007 alebo staršieho a súbor chránený heslom aplikácia odmietne so správou, ktorá odkazuje na export XML z programu MS Project. Po otvorení vám aplikácia v jednej správe oznámi, čo neprevzala.

**Uloženie** — nie, a nemá cieľ pre uloženie: *Uložiť* zapíše nový súbor IFC.

**Export** — nie.

**Čo sa prenesie** — úlohy so štruktúrou, trvaním a obmedzeniami; závislosti s oneskorením; kalendáre; zdroje a priradenia; postup; kód WBS, ktorý ste doplnili sami v MS Project. Dátumy a časovú rezervu, ktoré MS Project vypočítal sám, sa tiež načítajú pre zobrazenie *Dátumy podľa záznamu*.

**Čo sa neprenesie** — pôvodné plány, náklady a štandardné sadzby, poznámky, hypertextové odkazy, vlastné polia programu MS Project, prepojenie podprojektov a externých úloh a kritická prahová hodnota. Pozri [Otvorenie súboru MS Project (.mpp)](docs://howto-mpp-openen).

**Pôvod a licencia** — čítač `.mpp` bol napísaný pre Open Planner Studio a vychádza zo zdrojového kódu a štruktúrnych poznatkov knižnice MPXJ (`github.com/joniles/mpxj`, Jon Iles a ďalší), Java knižnice pod licenciou LGPL-2.1. Štruktúra a konštanty polí boli prenesené do TypeScriptu. Open Planner Studio je sám osebe open source pod licenciou LGPL-3.0. Čítač `.xer` nie je odvodenina: knižnica MPXJ sa tam len konzultovala ako zdroj porozumenia.

## Primavera P6 XML

**Otvorenie** — áno. Aplikácia rozpozná súbor `.xml` ako P6 XML podľa koreňového prvku `APIBusinessObjects`. Profil výpočtu: *Open Planner Studio*.

**Viac projektov v jednom súbore.** Každý projekt s úlohami sa otvorí na vlastnej karte s názvom *Názov projektu (ID projektu)*. Aplikácia preskočí projekt bez úloh. Aktívna karta je projekt s najväčším počtom úloh. Aplikácia neprenesie prepojenie medzi projektmi ani úlohu, ktorá nepatrí k žiadnemu projektu. Po otvorení aplikácia oznámi, koľko projektov otvorila.

**Sviatky pri otvorení.** Platia rovnaké pravidlá ako pri MS Project XML: kalendár s vlastným pracovným týždňom a bez výnimiek nedostane žiadne sviatky.

**Pôvodné plány.** `<BaselineProject>` v súbore sa stane pôvodným plánom svojho projektu. Pôvodný plán, ktorý P6 označí ako aktívny, je v aplikácii tiež aktívny.

**Rýchlosť priradenia.** Ak zostáva práca, zostávajúca rýchlosť (`RemainingUnitsPerTime`) sa stane hodnotou *Jedn./deň*. Inak je to plánovaná rýchlosť (`PlannedUnitsPerTime`). Pri materiáli zostáva plánovaná rýchlosť. Aplikácia pri otvorení súboru nič neprepočíta. Pri exporte do P6 XML zapíše plánovanú rýchlosť ako `PlannedUnitsPerTime`. Zostávajúcu rýchlosť zapíše ako `RemainingUnitsPerTime` len vtedy, keď má priradenie samostatnú plánovanú rýchlosť.

**Žiadne čitateľné úlohy.** Ak aplikácia nenájde žiadnu úlohu, ktorú dokáže prečítať, neotvorí kartu. Oznámi to a ak je dôvod známy, uvedie aj ten. Príklady: úlohy bez `ObjectId` alebo názvy stĺpcov XER v súbore XML. Potom projekt znovu exportujte z P6 ako P6 XML alebo ho otvorte ako `.xer`.

**Uloženie** — nie.

**Export** — áno, ako *Primavera P6 XML* (*Pre Oracle Primavera P6*). Predvolený názov: názov projektu s príponou `.xml`, a ak má projekt ID, to ID v zátvorkách. Export do MS Project XML dostane rovnaký názov. Dajte im vy sami rôzne názvy.

**Názov projektu a ID projektu.** Aplikácia drží ID projektu z P6 oddelene od názvu projektu, rovnako ako pri `.xer`. *Nastavenia projektu* zobrazia len názov, napríklad *Bid for Facility Extension*. Karta zobrazuje *Bid for Facility Extension (OZB-05)*. Ak projekt premenujete na *Hall extension*, karta sa volá *Hall extension (OZB-05)*. Export do P6 XML zapíše *OZB-05* späť ako ID projektu a *Hall extension* ako názov. Tak P6 projekt rozpozná. Projekt z `.xer` si tiež zachová svoje ID projektu. ID projektu zostane, keď uložíte projekt ako IFC. Zátvorky v samotnom názve, napríklad *New build (phase 2)*, zostanú v názve. Projekt bez ID projektu dostane pri exporte od aplikácie vlastné jedinečné ID, ktoré začína na *OPS:*.

**Čo sa prenesie** — štruktúra WBS a úlohy s trvaním, dátumami a postupom; závislosti s oneskorením; obmedzenia (aj druhé, ako mäkké obmedzenie); kalendáre; zdroje a priradenia; dátum kontroly stavu (ako `DataDate`); vlastný druh prác v samostatnom poli `OPS Custom Task Type`, ktoré aplikácia opäť načíta a ktoré P6 môže ignorovať.

**Čo sa neprenesie** — pôvodné plány a termíny; kódy aktivít, vlastné polia, poznámky a prepojenia medzi projektmi; možnosti výpočtu; názvy sviatkov. P6 nemá názov pre každý deň voľna: po opätovnom otvorení sa sviatok volá *Sviatok* a pracovná výnimka *Pracovná výnimka*. Po sebe idúce dni voľna sa vrátia ako jeden rozsah. Aplikácia skráti názov alebo kód, ktorý je dlhší, než P6 dovoľuje: názov úlohy na 120 znakov, ID úlohy alebo kód WBS na 40 a názov WBS alebo projektu na 100 znakov. Aplikácia hlási, koľko názvov a kódov skrátila. P6 nemá oneskorenie v percentách: aplikácia ho prevedie na pevný počet dní. Oneskorenie v kalendárnych dňoch sa stane oneskorením v pracovnom čase: 3 kalendárne dni sa stanú 3 pracovnými dňami. Hamak sa stane bežnou úlohou, manuálne plánovaná úloha bežnou úlohou s vypočítanými dátumami a oneskorenie pri vyvažovaní kratšie ako deň sa zahodí.

## Súbor Primavera (`.xer`)

**Otvorenie** — áno. Profil výpočtu: *Primavera P6*. Aplikácia len číta súbor: `.xer` nikdy nezapisuje a váš súbor nemení. Pre každý projekt s úlohami otvorí jednu kartu. Súbor bez úloh alebo s poškodenými tabuľkami odmietne so správou.

**Ukladanie** — nie. Cieľ uloženia neexistuje: *Uložiť* zapíše nový súbor IFC s pôvodným `.xer` vnútri.

**Export** — nie. Ak exportujete projekt z `.xer` do CSV, MS Project XML alebo P6 XML, aplikácia oznámi, že informácie zo zdroja XER sa stratia, aj keď ste projekt medzitým uložili ako IFC. Do IFC sa nič nestratí.

**Čo sa prenesie** — štruktúra WBS a úlohy s trvaním, dátumami, obmedzeniami a postupom; závislosti s oneskorením; kalendáre; zdroje s priradeniami; kódy aktivít; vlastné polia (UDF); poznámky; nastavenia plánovania P6. Úloha typu *Level of Effort* sa stane hamakom. Pôvodný plán projektu sa stane aktívnym pôvodným plánom projektu, ktorý naň odkazuje. Závislosť medzi dvoma projektmi si aplikácia ponechá ako zdrojový údaj.

**Výkon priradenia.** Ak zostáva práca, zostávajúci výkon (`remain_qty_per_hr`) sa stane hodnotou *Jedn./deň*. Inak je to plánovaný výkon (`target_qty_per_hr`). Plánovaná, skutočná a zostávajúca práca zostane rovnaká ako v súbore. Pri materiáli zostane plánovaný výkon.

**Voľná sobota alebo nedeľa, ktorá nie je v súbore.** Niektoré exporty P6 presunú voľný deň víkendu v rade viacerých voľných dní na predchádzajúci piatok alebo na nasledujúci pondelok. Ak kalendár pracuje v sobotu alebo v nedeľu, tento deň by sa nesprávne stal pracovným dňom. Ak aplikácia zistí tento vzor v rade aspoň troch voľných dní, tento deň víkendu napokon urobí voľným. V kalendári sa deň volá *Výnimka kalendára (obnova víkendu)* a počíta sa v riadku *N nálezov kalendára* v hlásení. Pri kalendári, ktorý o víkende nepracuje, sa nič nemení.

**Časová rezerva do dokončenia projektu bez dátumu dokončenia.** Je v P6 zapnutá možnosť prepočítať časovú rezervu do dokončenia projektu, ale súbor nemá dátum dokončenia projektu a žiadna úloha nemá plánovaný dátum dokončenia? Potom aplikácia vypne možnosť *Prepočítať časovú rezervu do dokončenia projektu*. Neskoré dátumy potom vypočíta spätne od najneskoršieho skorého dokončenia. To sa počíta v riadku *N nastavení plánu P6 s bezpečnou záložnou hodnotou*.

**Dokončené úlohy na dátume kontroly stavu.** Niektoré súbory nezaznamenávajú skutočné dátumy dokončenej úlohy, ale okno na dátume kontroly stavu. V zobrazení *Dátumy tak, ako sú zaznamenané* je takáto úloha potom úzky pruh na dátume kontroly stavu. Ak ju prepočítanie presunie na iné miesto, počíta sa do počtu úloh, ktoré dáva pruh. Pravidlo výpočtu *Dokončená úloha v okne dátumu kontroly stavu* vypočíta takéto okno. Len s týmto pravidlom dostane dokončená úloha skutočnú časovú rezervu cez možnosť výpočtu *Dokončená úloha: neskoré dátumy od dátumu kontroly stavu*. Toto pravidlo je približné: aplikácia toto správanie videla len vo výstupe P3 a Primavera ho nikde nepotvrdzuje. Preto je vypnuté v každom vstavanom profile výpočtu, aj pod *Primavera P6*. Zapnete ho v časti *Profil výpočtu a možnosti výpočtu*; projekt potom dostane vlastný profil výpočtu. Pozrite [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies).

**Čísla s čiarkou ako desatinným oddeľovačom.** P6 zaznamenáva desatinný oddeľovač a oddeľovač tisícov v tabuľke `CURRTYPE`. Aplikácia tieto znaky načíta skôr, ako prevedie trvania, prácu a časovú rezervu. Ak tieto údaje chýbajú, aplikácia použije bodku ako desatinný oddeľovač. Ak súbor stále obsahuje čísla s desatinnou čiarkou, aplikácia nič neotvorí. Takto sa plán s nesprávne načítanými číslami nikdy neotvorí.

**Čo sa neprenesie** — projekt bez úloh a závislosť medzi dvoma projektmi ako skutočná závislosť vo vašom pláne. Pozrite [Otváranie súboru Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Otvorenie** — áno. Aplikácia číta ako oddeľovač `;` a `,`. Rozpozná hlavičky stĺpcov v angličtine a holandčine (napríklad `Name` alebo `Naam`, `Duration` alebo `Duur`, `Predecessors` alebo `Voorgangers`). Dátumy môžu byť *rrrr-mm-dd*, *dd.mm.rrrr* alebo *dd/mm/rrrr*. Predchádzajúcu úlohu zapíšete ako kód WBS, typ závislosti a oneskorenie, napríklad `1.2FS+2d`. Profil výpočtu: *Open Planner Studio*. Projekt sa volá *CSV Import*. Stĺpec `Task Type` obsahuje druh prác, nie typ úlohy; aplikácia načíta aj hlavičky `Werksoort` a `Work category`. Hodnota `Task Type`, ktorá nie je žiadnym z pevných kódov (ako `CONSTRUCTION` alebo `INSTALLATION`, ktoré aplikácia zapisuje sama), sa stane vlastným druhom prác v časti *Z tohto projektu*, nie v časti *Moje druhy prác*. Cez `OPS Custom Task Type ID` sa zachová identifikátor vlastného druhu prác.

**Ukladanie** — nie.

**Export** — áno, ako *CSV (;)* (*Univerzálny export tabuľky. Všetky úlohy s dátumami a trvaním*), na dlaždici *CSV (oddelené bodkočiarkou)*. Súbor používa ako oddeľovač bodkočiarku, je v kódovaní UTF-8 s BOM a má anglické hlavičky stĺpcov.

**Čo sa prenesie** — pre každú úlohu tieto stĺpce: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` a `Description`. Stĺpec `Task Type` obsahuje druh prác. Percento dokončenia je v celých percentách. Oneskorenie v hodinách dostane značku hodín podľa jazyka aplikácie: `1.2FS+2h` v angličtine, `1.2FS+2u` v holandčine. Pri otváraní aplikácia načíta obe.

**Čo sa neprenesie** — zdroje, priradenia, kalendáre, obmedzenia, termíny, pôvodné plány a dátum kontroly stavu. Ak sú dátumy v zobrazení *Dátumy tak, ako sú zaznamenané*, export nechá stĺpce `Critical` a `Total Float` prázdne pri úlohách, ktorých zdrojový súbor to nezaznamenal.

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
