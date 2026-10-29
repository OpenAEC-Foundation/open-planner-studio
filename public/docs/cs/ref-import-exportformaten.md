# Formáty pro import a export

U každého formátu souboru vidíte, zda ho můžete otevřít, uložit a exportovat. Vidíte také, co se přenese a co ne, a s jakým profilem výpočtu se otevře. Důvody a příklad s čísly najdete v článku [Soubory a formáty](docs://uitleg-bestanden).

## Na první pohled

**Otevření** podporuje formáty IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` a `.xer`. Soubor s jinou příponou aplikace považuje za IFC.

**Uložení** vždy zapíše soubor IFC. Cílem uložení se stane jen otevřený soubor IFC. Projekt z jiného formátu nemá po otevření žádný soubor. Při volbě *Uložit* se pak aplikace zeptá, kam se má soubor IFC uložit.

**Export** podporuje formáty IFC, MS Project XML, Primavera P6 XML, CSV a dvě tabulky průběhu (Excel a CSV). Export váš projekt nezmění.

**Jen pro čtení** jsou `.mpp` a `.xer`: aplikace je umí otevřít, ale ne zapsat.

**PDF** vzniká jen ze sestavy (viz [Typy sestav](docs://ref-rapporttypes)). Aplikace PDF nečte.

**Kde.** Otevření: *Domů › Soubor › Otevřít*, *Soubor › Otevřít* nebo Ctrl+O. Export: *Domů › Soubor › Exportovat* nebo *Soubor › Exportovat*. Vyplněnou tabulku průběhu načtete přes *Soubor › Importovat*, nebo tlačítkem *Aktualizovat průběh z tabulky* ve skupině *Průběh* na kartách *Plán*, *Tabulka* a *Sestava*.

**Profil výpočtu při otevření.** Každý formát se otevře s profilem výpočtu. Co to je, najdete v článku [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies). `.xer` se otevře s *Primavera P6*, `.mpp` s *Microsoft Project* a CSV, MS Project XML a P6 XML s *Open Planner Studio*. IFC zachovává profil uložený v souboru. U `.xer` a `.mpp` aplikace oznámí, že se projekt takto vypočítává. Jen IFC přenáší profil výpočtu a možnosti výpočtu. Z možností výpočtu zapíše MS Project XML nejvýš kritickou prahovou hodnotu. Znovu otevřený export jiného formátu se vypočítává jako *Open Planner Studio*.

## IFC

**Otevření** — ano, `.ifc`. Aplikace čte IFC4 a IFC 4.3 (také ADD2). Soubor v jiném schématu, například IFC2X3, se také otevře. Při prvním uložení pak vyberete schéma, které aplikace umí zapsat (viz [Výběr schématu IFC](docs://howto-ifc-schema-kiezen)). Profil výpočtu: ten, který je v souboru.

**Uložení** — ano, a je to jediný formát, do kterého se dá ukládat. *Uložit* zapíše celý váš projekt jako soubor IFC ve schématu IFC projektu (ve výchozím nastavení IFC 4.3 ADD2). Tento soubor se stane cílem uložení.

**Export** — ano, jako *IFC*, ve schématu IFC projektu (výchozí IFC 4.3 ADD2). Výchozí název: název projektu s příponou `.ifc`. Je-li váš projekt propojen s knihovnou zdrojů, je zaškrtávací políčko *Uložit soubor knihovny zdrojů vedle* pod dlaždicemi v nabídce *Soubor › Exportovat*. Je-li zaškrtnuto, aplikace po exportu projektu požádá o místo pro *projectname-bibliotheek.ifc*. Zaškrtávací políčko není v seznamu na kartě *Domů*.

**Co se přenese** — vše, co k projektu patří: úkoly se strukturou, dobou trvání, daty a průběhem; závislosti s prodlevou; omezení a konečné termíny; kalendáře; zdroje a přiřazení, včetně rozložení práce po hodinách; směrné plány; kódy aktivit a vlastní pole; poznámky; vazby mezi projekty; přerušení práce; typy úkolů a vlastní druhy práce; nastavení projektu, například datum stavu, režim průběhu, profil výpočtu a možnosti výpočtu; vazbu na knihovnu zdrojů. U projektu z `.xer` se přenese i původní zdrojový soubor. Vlastní druh práce se uloží jako typ IFC `USERDEFINED` s názvem v poli ObjectType, takže jiné programy pro IFC čtou úkol normálně. Aplikace uchovává také pevné ID druhu práce, takže přejmenování vazbu neporuší. Otevře-li někdo soubor na jiném počítači, druh práce se tam zobrazí pod nadpisem *Z tohoto projektu*, ne v seznamu *Moje druhy práce* na jeho počítači.

**Co se nepřenese** — nastavení obrazovky (přiblížení, poloha posouvání, vybraný úkol, sbalené fáze, zvolený filtr a seskupení) a nastavení aplikace ([Nastavení](docs://ref-instellingen)). Karta *IFC* je editor s textem IFC vašeho projektu. *Generovat IFC* jej obnoví, *Kopírovat* jej zkopíruje do schránky a *Použít* načte text jako váš projekt a nahradí projekt na této kartě.

## MS Project XML (MSPDI)

**Otevření** — ano. Aplikace pozná soubor `.xml` jako MS Project XML podle kořenového prvku `Project` v jmenném prostoru MS Project (nebo bez jmenného prostoru). Profil výpočtu: *Open Planner Studio*. Po otevření aplikace napíše jednou zprávou, co nepřevzala; viz [Otevření souboru MS Project (.mpp)](docs://howto-mpp-openen).

**Uložení** — ne. Takový projekt nemá cíl uložení.

**Export** — ano, jako *MS Project XML* (*Lze otevřít v Microsoft Project. Úplná struktura WBS.*). Výchozí název: název projektu s příponou `.xml`.

**Co se přenese** — úkoly se strukturou (úroveň a WBS), dobou trvání, daty a průběhem; závislosti s prodlevou, také v hodinách nebo procentech; omezení, včetně konečného termínu; kalendáře, včetně kalendářů úkolů a zdrojů; zdroje a přiřazení, včetně křivky nebo rozložení práce po hodinách; datum stavu; kritickou prahovou hodnotu jako celé číslo pracovních dnů od 0 výše s volbou *Celková časová rezerva ≤ prahová hodnota*; popis úkolu (jako poznámku); typ úkolu (jako typ úkolu MS Project); vlastní druh práce ve volném poli (`ExtendedAttribute`), který aplikace načte zpět a který MS Project může ignorovat. Z vašich směrných plánů se přenese jen aktivní, jako směrný plán 0. Úkol v hodinách si zachová svou jednotku a milník svůj druh (začátek, dokončení nebo automatický).

**Co se nepřenese** — poznámky (kontrolní seznam u úkolu), vazby mezi projekty, kódy aktivit a vlastní pole, druhé omezení, označení *Ručně plánováno*, zpoždění vyrovnání, bod obnovení a zastavení úkolu s průběhem mimo posloupnost, konvence *Zbývající práce pokračuje po uplynulé době trvání* a *Nezahájené úkoly nepřesouvat na datum stavu* profilu MS Project a ostatní možnosti výpočtu. Přerušené úkoly bez rozložení práce po hodinách se přenesou bez svých přerušení práce.

**Svátky při otevření.** Odvozený kalendář převezme výjimky svého základního kalendáře. Kalendář s vlastním pracovním týdnem a bez výjimek nedostane žádné svátky. Jen holý kalendář bez základního kalendáře, pracovního týdne nebo výjimek si zachová standardní nizozemské svátky. Chybí-li svátky, může se vaše datum dokončení lišit: viz [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren).

**Co se během přenosu změní** — omezení *Musí začít (MSO)* nebo *Musí skončit (MFO)* bez volby *Povinný (pevné ukotvení)* se změní na *Zahájit nejdříve (SNET)* nebo *Dokončit nejdříve (FNET)*. Překlenovací úkol se změní na běžný úkol s vypočítanými daty. MS Project XML ukládá počet hodin za den jen pro kalendář projektu. Jiný kalendář s vlastním počtem hodin za den dostane při otevření souboru svou pracovní dobu jako počet hodin za den: 8 hodin za den s pracovní dobou 10 hodin se stane 10. Úkol v dnech na takovém kalendáři se pak zkrátí, například na 4 dny místo 5.

## Soubor MS Project (`.mpp`)

**Otevření** — ano, od MS Project 2010 do 2021. Profil výpočtu: *Microsoft Project*. Aplikace soubor jen čte, `.mpp` nikdy nezmění. Aplikace odmítne soubor z MS Project 2007 nebo starší a soubor chráněný heslem s hlášením, které ukazuje na export MS Project do XML. Po otevření aplikace napíše jednou zprávou, co nepřevzala.

**Uložení** — ne. Cíl uložení neexistuje: *Uložit* zapíše nový soubor IFC.

**Export** — ne.

**Co se přenese** — úkoly se strukturou, dobou trvání a omezeními; závislosti s prodlevou; kalendáře; zdroje a přiřazení; průběh; kód WBS, který jste sami vyplnili v MS Project. Data a časovou rezervu, které MS Project vypočítal sám, aplikace také načte, pro zobrazení *Data tak, jak byla zaznamenána*.

**Co se nepřenese** — směrné plány, náklady a standardní sazby, poznámky, hypertextové odkazy, vlastní pole MS Project, vazby podprojektů a externích úkolů a kritickou prahovou hodnotu. Viz [Otevření souboru MS Project (.mpp)](docs://howto-mpp-openen).

**Původ a licence** — čtečka `.mpp` byla napsána pro Open Planner Studio a vychází ze zdrojového kódu a strukturálních znalostí knihovny MPXJ (`github.com/joniles/mpxj`, Jon Iles a další), Java knihovny pod LGPL-2.1. Struktura a konstanty polí byly převedeny do TypeScriptu. Samotný Open Planner Studio je open source pod LGPL-3.0. Čtečka `.xer` není odvozené dílo: MPXJ se tam použila jen jako zdroj porozumění.

## Primavera P6 XML

**Otevření** — ano. Aplikace pozná soubor `.xml` jako P6 XML podle kořenového prvku `APIBusinessObjects`. Profil výpočtu: *Open Planner Studio*.

**Více projektů v jednom souboru.** Každý projekt s úkoly se otevře na vlastní kartě, pojmenované *Název projektu (ID projektu)*. Aplikace přeskočí projekt bez úkolů. Aktivní karta je projekt s nejvíce úkoly. Aplikace nepřenese vazbu na jiný projekt ani úkol, který nepatří k žádnému projektu. Po otevření aplikace oznámí, kolik projektů otevřela.

**Svátky při otevření.** Stejná pravidla platí jako u MS Project XML: kalendář s vlastním pracovním týdnem a bez výjimek nedostane žádné svátky.

**Směrné plány.** `<BaselineProject>` v souboru se stane směrným plánem svého projektu. Směrný plán, který P6 označí jako aktivní, je aktivní i v aplikaci.

**Sazba přiřazení.** Zbývá-li práce, zbývající sazba (`RemainingUnitsPerTime`) se stane hodnotou *Jedn./den*. Jinak je hodnotou plánovaná sazba (`PlannedUnitsPerTime`). U materiálu zůstane plánovaná sazba. Aplikace při otevření souboru nic nepřepočítává. Při exportu do P6 XML zapíše plánovanou sazbu jako `PlannedUnitsPerTime`. Zbývající sazbu zapíše jako `RemainingUnitsPerTime` jen tehdy, když má přiřazení samostatnou plánovanou sazbu.

**Žádné čitelné úkoly.** Pokud aplikace nenajde žádný čitelný úkol, neotevře kartu. Oznámí to a uvede důvod, je-li znám. Příklady: úkoly bez `ObjectId` nebo názvy sloupců XER v souboru XML. Pak projekt z P6 znovu exportujte jako P6 XML, nebo ho otevřete jako `.xer`.

**Uložení** — ne.

**Export** — ano, jako *Primavera P6 XML* (*Pro Oracle Primavera P6.*). Výchozí název: název projektu s příponou `.xml`, s ID projektu v závorce, pokud ho má. Export MS Project XML dostane stejný název: dejte jim proto různé názvy sami.

**Název projektu a ID projektu.** Aplikace drží ID projektu z P6 odděleně od názvu projektu, stejně jako u `.xer`. *Nastavení projektu* ukazuje jen název, například *Bid for Facility Extension*. Karta ukazuje *Bid for Facility Extension (OZB-05)*. Přejmenujete-li projekt na *Hall extension*, karta se jmenuje *Hall extension (OZB-05)*. Export do P6 XML zapíše *OZB-05* zpět jako ID projektu a *Hall extension* jako název. Tak P6 projekt pozná. Projekt z `.xer` si převezme i své ID projektu. ID projektu zůstane, když projekt uložíte jako IFC. Závorky v samotném názvu, například *New build (phase 2)*, zůstanou v názvu. Projekt bez ID projektu dostane při exportu od aplikace vlastní jedinečné ID, které začíná na *OPS:*.

**Co se přenese** — struktura WBS a úkoly s dobou trvání, daty a průběhem; závislosti s prodlevou; omezení (také druhé, jako měkké omezení); kalendáře; zdroje a přiřazení; datum stavu (jako `DataDate`); vlastní druh práce v samostatném poli `OPS Custom Task Type`, který aplikace načte zpět a který P6 může ignorovat.

**Co se nepřenese** — směrné plány a konečné termíny; kódy aktivit, vlastní pole, poznámky a vazby mezi projekty; možnosti výpočtu; názvy svátků. P6 nemá název pro jednotlivé volné dny: po novém otevření se svátek jmenuje *Svátek* a pracovní výjimka *Pracovní výjimka*. Po sobě jdoucí volné dny se vrátí jako jeden rozsah. Aplikace zkrátí název nebo kód, který je delší, než P6 dovolí: název úkolu na 120 znaků, ID úkolu nebo kód WBS na 40 a název WBS nebo projektu na 100. Aplikace nahlásí, kolik názvů a kódů zkrátila. P6 nemá prodlevu v procentech: aplikace ji převede na pevný počet dnů. Prodleva v kalendářních dnech se stane prodlevou v pracovní době: 3 kalendářní dny se stanou 3 pracovními dny. Překlenovací úkol se stane běžným úkolem, ručně plánovaný úkol běžným úkolem s vypočítanými daty a zpoždění vyrovnání kratší než jeden den se zahodí.

## Soubor Primavera (`.xer`)

**Otevření** — ano. Profil výpočtu: *Primavera P6*. Aplikace soubor jen čte: `.xer` nezapisuje a váš soubor nikdy nezmění. Otevře jednu záložku pro každý projekt s úkoly. Soubor bez úkolů nebo s poškozenými tabulkami odmítne s hlášením.

**Uložení** — ne, cíl uložení neexistuje: tlačítko *Uložit* zapíše nový soubor IFC s původním `.xer` uvnitř.

**Export** — ne. Když projekt z `.xer` exportujete do CSV, MS Project XML nebo P6 XML, aplikace oznámí, že se ztratí údaje o zdroji XER, i když jste projekt mezitím uložili jako IFC. Do IFC se nic neztratí.

**Co se přenese** — struktura WBS a úkoly s dobou trvání, daty, omezeními a průběhem; závislosti s prodlevou; kalendáře; zdroje s přiřazeními; kódy aktivit; vlastní pole (UDF); poznámky; nastavení plánování v P6. Úkol typu *Úroveň úsilí* se změní na překlenovací úkol. Směrný projekt se stane aktivním směrným plánem projektu, který na něj odkazuje. Vazbu mezi projekty si aplikace ponechá jako zdrojová data.

**Sazba přiřazení.** Pokud zbývá práce, stane se zbývající sazba (`remain_qty_per_hr`) hodnotou *Jedn./den*. Jinak je to plánovaná sazba (`target_qty_per_hr`). Plánovaná, skutečná a zbývající práce zůstanou tak, jak jsou v souboru. U materiálu zůstane plánovaná sazba.

**Volná sobota nebo neděle, která v souboru není.** Některé exporty z P6 přesunou volný víkendový den uvnitř souvislé řady několika volných dnů na předchozí pátek nebo na následující pondělí. Pracuje-li kalendář v sobotu nebo v neděli, ten den by se chybně stal pracovním dnem. Pozná-li aplikace tento vzor v souvislé řadě alespoň tří volných dnů, udělá ten víkendový den přesto volným. V kalendáři se ten den jmenuje *Výjimka kalendáře (rekonstrukce víkendu)* a počítá se do řádku *N nálezů kalendáře* v hlášení. U kalendáře, který o víkendu nepracuje, se nic nemění.

**Časová rezerva až do dokončení projektu, bez data dokončení.** Je v P6 zapnutá volba pro přepočítání časové rezervy až do dokončení projektu, ale soubor nemá datum dokončení projektu ani plánované dokončení u žádného úkolu? Potom aplikace vypne volbu *Přepočítat časovou rezervu až do dokončení projektu*. Pozdní termíny pak počítá zpět od nejpozdějšího nejdřívějšího dokončení. To se počítá do řádku *N nastavení plánování P6 používají bezpečnou záložní hodnotu* v hlášení.

**Dokončené úkoly k datu stavu.** Některé soubory nezaznamenají skutečné datum dokončeného úkolu, ale okno kolem data stavu. V zobrazení *Data tak, jak byla zaznamenána* je takový úkol potom úzký pruh na datu stavu. Pokud přepočítání úkol přesune jinam, počítá se do počtu úkolů, které uvádí hlášení. Konvence *Dokončený úkol v okně data stavu* takové okno počítá. Jen s touto konvencí dostane dokončený úkol skutečnou časovou rezervu přes volbu výpočtu *Dokončený úkol: pozdní termíny od data stavu*. Konvence je přibližná: aplikace toto chování viděla jen ve výstupu P3 a Primavera to nikde nepotvrzuje. Proto je vypnutá v každém vestavěném profilu, také pod *Primavera P6*. Zapnete ji v bloku *Profil výpočtu a možnosti výpočtu*; projekt potom dostane vlastní profil. Viz [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies).

**Čísla s desetinnou čárkou.** P6 zapisuje desetinný oddělovač a oddělovač tisíců do tabulky `CURRTYPE`. Aplikace tyto znaky přečte dříve, než převede doby trvání, práci a časovou rezervu. Chybí-li tyto údaje, použije aplikace jako desetinný oddělovač tečku. Obsahuje-li soubor přesto čísla s desetinnou čárkou, aplikace neotevře nic. Tak se plán se špatně přečtenými čísly nikdy neotevře.

**Co se nepřenese** — projekt bez úkolů a vazba mezi projekty jako skutečná závislost ve vašem plánu. Viz [Otevření souboru Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Otevření** — ano. Aplikace čte `;` a `,` jako oddělovač. Rozpozná záhlaví sloupců v angličtině a nizozemštině (například `Name` nebo `Naam`, `Duration` nebo `Duur`, `Predecessors` nebo `Voorgangers`). Data mohou být ve formátu *rrrr-mm-dd*, *dd-mm-rrrr* nebo *dd/mm/rrrr*. Předchůdce zapíšete jako kód WBS, typ závislosti a prodlevu, například `1.2FS+2d`. Profil výpočtu: *Open Planner Studio*. Projekt se jmenuje *CSV Import*. Sloupec `Task Type` obsahuje druh práce, ne typ úkolu; aplikace čte také záhlaví `Werksoort` a `Work category`. `Task Type`, který neodpovídá žádnému pevnému kódu (například `CONSTRUCTION` nebo `INSTALLATION`, které aplikace zapisuje sama), se stane vlastním druhem práce pod nadpisem *Z tohoto projektu*, ne v seznamu *Moje druhy práce*. S `OPS Custom Task Type ID` se zachová ID vlastního druhu práce.

**Uložení** — ne.

**Export** — ano, jako *CSV (;)* (*Univerzální export tabulky. Všechny úkoly, včetně dat a doby trvání*.), na dlaždici *CSV (oddělené středníkem)*. Soubor používá jako oddělovač středník, je v UTF-8 s BOM a má záhlaví sloupců v angličtině.

**Co se přenese** — u každého úkolu tyto sloupce: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` a `Description`. Sloupec `Task Type` obsahuje druh práce. Procento dokončení je v celých číslech. Prodleva v hodinách dostane značku hodin podle jazyka aplikace: `1.2FS+2h` v angličtině, `1.2FS+2u` v nizozemštině. Při otevírání se čtou obě varianty.

**Co se nepřenese** — zdroje, přiřazení, kalendáře, omezení, konečné termíny, směrné plány a datum stavu. Jsou-li data v zobrazení *Data tak, jak byla zaznamenána*, export nechá sloupce `Critical` a `Total Float` prázdné u úkolů, jejichž zdrojový soubor to nezaznamenal.

## Tabulka průběhu (Excel a CSV)

**Otevření** — ano, přes *Soubor › Importovat* (*Aktualizovat průběh z tabulky*) nebo přes tlačítko se stejným názvem ve skupině *Průběh* na kartách *Plán*, *Tabulka* a *Sestava*. Aplikace čte `.xlsx` a `.csv`, až 16 MB a 50 000 řádků. Projekt tím neotevřete: aktualizuje se průběh vašeho otevřeného projektu. Viz [Import průběhu z tabulky](docs://howto-voortgang-importeren).

**Uložení** — ne.

**Export** — ano, jako *Tabulka průběhu (Excel)* (v seznamu jako *Průběh (Excel)*) a *Tabulka průběhu (CSV)* (*Průběh (CSV)*). Výchozí název: *projectname-voortgang*. Tlačítko *Exportovat tabulku průběhu* ve stejné skupině pásu karet vytvoří tabulku Excel jedním kliknutím. Tabulka Excel má pevné šířky sloupců, zamčená pole a kontrolu dat. Tabulka CSV má stejný obsah jako prostý text.

**Co se přenese** — sloupce `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` a `Actual Finish`. Při načítání aplikace použije `Completion (%)`, `Actual Start` a `Actual Finish`. `Start` a `Finish` slouží jen k rozpoznání formátu data a váš plán nemění. Aplikace propojí řádky s úkoly podle `OPS Task ID`, jinak podle jedinečného kódu WBS.

**Co se nepřenese** — vše mimo tyto sloupce: doba trvání, závislosti, zdroje a zbytek vašeho plánu. Souhrnný úkol nezíská z tabulky žádný průběh.

## PDF

**Otevření** — ne.

**Uložení** — ne.

**Export** — ano, ze sestavy: na kartě *Sestava* je tlačítko *Exportovat PDF*. Aplikace sestavu tiskárně sama neodešle. Cesta na papír vede přes PDF. Obsah závisí na typu sestavy: viz [Typy sestav](docs://ref-rapporttypes) a [Vytvoření a tisk sestavy](docs://howto-rapport-maken-en-afdrukken).

## Viz také

- [Soubory a formáty](docs://uitleg-bestanden): proč je IFC vlastní formát a co export ztratí, s příkladem.
- [Otevření a uložení souboru](docs://howto-bestand-openen-en-opslaan): postup.
- [Export](docs://howto-exporteren): výběr formátu a zprávy po exportu.
- [Data tak, jak byla zaznamenána](docs://uitleg-datums-zoals-opgeslagen): proč může otevřený soubor ukazovat jiná data.
- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): profily výpočtu.
