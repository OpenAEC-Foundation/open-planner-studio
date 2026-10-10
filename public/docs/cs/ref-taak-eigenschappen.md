# Dialogové okno úkolu a panel vlastností

Úkol můžete upravit na dvou místech: v okně *Upravit úkol* a v panelu *Vlastnosti*. Obě místa sdílejí téměř všechna pole. Tento článek popisuje u každého pole, co dělá, jaká je výchozí hodnota a čeho si u něj všimnete. Jak vytvořit a nastavit úkol, je popsáno v článku [Přidání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen). Proč výpočet vyjde právě tam, kde vyjde, je vysvětleno v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

## Dvě místa

- **Upravit úkol** — okno pro první vybraný úkol. Otevřete je klávesou F2, dvojklikem na pruh v diagramu Gantt, nebo kliknutím pravým tlačítkem na úkol v diagramu Gantt nebo v tabulce a volbou *Upravit*... Vaše změny zůstanou v konceptu, dokud nekliknete na *Uložit* (Enter). *Zrušit* (Esc) je zahodí. Tlačítko *Uložit* je vypnuto, dokud je název prázdný. Uložení se počítá jako jeden krok pod příkazem *Vrátit zpět*, včetně toho, co jste udělali v sekcích *Pravidlo pevné veličiny*, *Závislosti*, *Přiřazení* a *Kódy a pole*. Tyto sekce už během úprav působí na projekt a *Zrušit* je zruší.
- **Vlastnosti** — panel v pravém sloupci pro aktivní úkol. Každá změna se projeví okamžitě. Několik po sobě jdoucích změn stejného pole se počítá jako jeden krok pod příkazem *Vrátit zpět*. Bez úkolu se zobrazí *Vyberte úkol a zobrazte jeho vlastnosti.* Zapnete ho nebo vypnete na kartě *Zobrazení › Panely › Vlastnosti*. Výchozí hodnota: zapnuto. Panel je vedle diagramu Gantt a na kartě *Tabulka*, ne na kartách *IFC* a *Sestava* a ne pod úplným panelem zdrojů.

Jen v okně: *Nadřazený úkol* a tlačítka *Uložit* a *Zrušit*. Jen v panelu: koš *Odstranit úkol*, tlačítko *Přepočítat* dole, sekce *Přerušení práce*, tři značky pod *Pravidlo pevné veličiny* (dlouhé nepracovní období, MS Project, zaznamenaná data) a přidávání závislostí a skok na propojený úkol v sekci *Závislosti*. Všechna ostatní pole jsou na obou místech. Okno zobrazuje *Závislosti*, *Přiřazení* a *Kódy a pole* jen u existujícího úkolu.

Když jste změnili něco, co se týká dat, stiskněte *Přepočítat*. Přepočítání neproběhne samo, pokud není zapnuto *Automaticky přepočítat*.

## Obecné

- **Název** (v okně *Název \**) — název úkolu v diagramu Gantt, v tabulce a v sestavách. Povinné: prázdný název se neuloží. Výchozí hodnota pro nový úkol: *Nový úkol*.
- **Kód WBS** — kód struktury úkolu, například `RB-301`. Povinné. Když je zapnuto *Plán › Struktura › WBS auto*, pole je vypnuté (popisek: *Kódy WBS se číslují automaticky (Plánování → Struktura)*), protože kódy pak spravuje aplikace.
- **Popis** — volný text. Nemá vliv na výpočet. Můžete jej zobrazit jako sloupec *Popis* v tabulce.
- **Typ** — typ úkolu. Seznam má skupiny *Vestavěné typy* (*Stavba*, *Instalace*, *Demolice*, *Logistika*, *Kontrola/inspekce*, *Přesun*, *Renovace*, *Údržba*), *Moje typy úkolů* a *Z tohoto projektu*. *Ostatní* se zobrazí jen tehdy, když úkol už tento typ má. Dole jsou *+ Nový typ úkolu*… a *Spravovat typy úkolů*… Výchozí hodnota: typ nadřazeného úkolu, jinak *Stavba* (režim pro stavbu je zapnutý, výchozí nastavení) nebo *Ostatní*. Vliv: žádný na výpočet; podle typu můžete seskupovat a filtrovat úkoly a barvit pruhy. Aplikace si vlastní typ uchovává ve vašem zařízení; když jej zvolíte, kopie se přidá do projektu (*Z tohoto projektu*). Když u volby *+ Nový typ úkolu*… zadáte název, který už je ve skupině *Moje typy úkolů*, i s jinými velkými písmeny, aplikace nevytvoří druhý typ, ale zvolí existující. V okně *Spravovat typy úkolů*… upravíte nebo odstraníte jen své vlastní typy; prázdný název nebo název, který už existuje, se neuloží. Když odstraníte typ, který otevřený projekt používá, aplikace se nejprve zeptá a kopie v projektu zůstane. Typ ve skupině *Z tohoto projektu*, například ze souboru jiného uživatele, se přidá do vašeho seznamu až tehdy, když v okně *Spravovat typy úkolů*… kliknete na *Přidat do mých typů úkolů*.
- **Kalendář** — kalendář, podle kterého úkol počítá svou dobu trvání, datum dokončení a časovou rezervu. Výchozí hodnota: *Kalendář projektu: {name}*. Vliv: úkol s vlastním kalendářem pracuje v jiné dny než kalendář projektu. Po změně přepočítejte data příkazem *Přepočítat*. Viz [Kalendáře a pracovní dny](docs://uitleg-kalenders).
- **Nadřazený úkol** (jen v okně) — přesune úkol pod jiný úkol. Výchozí hodnota: současný nadřazený úkol. *- Žádný (kořen) -* jej přesune na nejvyšší úroveň. Volba, která by v závislostech vytvořila cyklus, se při *Uložit* odmítne se zprávou a okno zůstane otevřené.

## Poznámky

- **Poznámky** — kontrolní seznam u úkolu. *Přidat poznámku* přidá řádek; zaškrtnutí (*Hotovo*) jej přeškrtne; koš (*Odstranit*) jej smaže. Bez řádků je tu text *Zatím žádné poznámky.* Nemá vliv na výpočet; sloupec *Poznámky* v tabulce je zobrazí se znakem ✓ nebo ○ před textem.

## Milník

- **Milník** — z úkolu udělá milník. Výchozí hodnota: vypnuto. Vliv: doba trvání se změní na 0. Aplikace to odmítne u souhrnného úkolu (úkol s dílčími úkoly) a u úkolu s přiřazenými zdroji, se zprávou; nejprve odstraňte přiřazení. Když zrušíte zaškrtnutí, zmizí *Typ milníku* a *Povinný (smluvní)*.
- **Typ milníku** (jen u milníku) — *Automaticky*, *Milník zahájení* nebo *Milník dokončení*. Výchozí hodnota: *Automaticky*. Vliv: milník zahájení leží na začátku dne, milník dokončení na konci dne. Při volbě *Automaticky* se milník počítá jako milník zahájení, když je předchůdcem, a je na začátku dne.
- **Povinný (smluvní)** (jen u milníku) — označí smluvní milník, například kontrolu nebo předání. Výchozí hodnota: vypnuto. Vliv: značka pro diagram Gantt a sestavy; datum nehlídá. To děláte pomocí omezení nebo konečného termínu.

## Čas

- **Zahájení** (v okně *Datum zahájení*) — ukazuje vypočtený začátek, tedy stejné datum jako pruh v diagramu Gantt a sloupec *Zahájení*, ne nezpracovanou kotvu plánu. Povinné: prázdné pole se vrátí k původní hodnotě. Vliv při psaní: nové datum se stane plánovanou kotvou (sloupec *Plánované zahájení*). Když má úkol předchůdce a ještě nezačal, aplikace na tomto datu zaznamená nový začátek jako omezení *Zahájit nejdříve (SNET)* (nebo přesune existující SNET), se zprávou; po příkazu *Přepočítat* tak úkol nezačne dříve. Když existuje omezení jiné než *ASAP* nebo *SNET*, aplikace začátek nepoužije a řekne, které omezení začátek určuje.
- **Doba trvání** — jak dlouho úkol trvá. Zadejte `5d` pro dny, nebo `12h` či `1h 30m` pro hodiny. Číslo bez jednotky se počítá v jednotce úkolu. Dny jsou vždy celé; hodiny mohou mít desetinnou část. Neplatný zápis vypíše *Zadejte celé číslo dnů nebo hodin, například 2d nebo 12h.* a pole se vrátí na předchozí hodnotu. Výchozí hodnota pro nový úkol: 5 dnů (milník 0). Pole je vypnuté u souhrnného úkolu, překlenovacího úkolu a milníku s dobou trvání 0: jejich doba trvání vyplývá z jiných úkolů nebo je nulová. Úkol v hodinách je vypnutý, dokud je vypnuto *Zapnout plánování v hodinách*; je tu tlačítko se stejným názvem. Vliv: po příkazu *Přepočítat* určí doba trvání dokončení v kalendáři úkolu. Má-li úkol zdroje a pravidlo pevné veličiny, pravidlo rozhodne, zda se pohne práce, nebo jednotky přiřazení. Je-li úkol už částečně hotový, aplikace odmítne dobu trvání kratší než odvedená práce. Viz [Dny a hodiny](docs://uitleg-dagen-en-uren).
- **Jednotka doby trvání** — volba *Dny* nebo *Hodiny*, vedle ní je tlačítko s informacemi. Je vidět jen tehdy, když jsou zapnuty *Zapnout plánování v hodinách* a *Povolit smíšené plánování po dnech a v hodinách* (to druhé je ve výchozím stavu zapnuté, když je zapnuté plánování v hodinách). Vliv: aplikace převádí jen tehdy, když je výsledek přesný, a pak navrhne změnu (*Použít návrh*, nebo *Ponechat*). Když přesně nevychází, jednotka zůstane a aplikace to oznámí. Kalendář bez platné pracovní doby přepnutí odmítne.
- **Pravidlo pevné veličiny** — která veličina zůstane pevná, když se změní jedna ze tří: doba trvání × jednotky přiřazení = práce. Volby: *Výchozí pro projekt (Pevné trvání a jednotky)*, *Pevné trvání a jednotky*, *Pevné trvání a práce*, *Pevná práce* a *Pevné jednotky*. Výchozí hodnota: výchozí nastavení projektu. Pod volbou je, co pravidlo chrání (*Chráněno: …*), a u úkolu z MS Project *Z MS Project: řízeno úsilím*, nebo *Z MS Project: neřízeno úsilím*. Je vidět jen tehdy, když je zapnuto *Zobrazit pravidla pevné veličiny a práci* (*Nastavení*, na kartě *Plán*, nadpis *Výpočet*), nebo když soubor sám nese pravidla nebo uloženou práci. Jen u běžného úkolu: ne u souhrnného úkolu, milníku, překlenovacího úkolu ani u úkolu, který počítá uplynulou dobu trvání. Viz [Pravidla pevné veličiny: doba trvání, jednotky a práce](docs://uitleg-werkregels).

## Překlenovací úkol

- **Překlenovací úkol (odvozená doba trvání)** — nechá dobu trvání vyplynout ze dvou jiných úkolů, místo aby měl vlastní. Výchozí hodnota: vypnuto. Jen pro běžný úkol, tedy ne pro milník nebo souhrnný úkol. Po zapnutí ukáže *Hnací vazba zahájení* předchůdce se závislostí dokončení-zahájení nebo zahájení-zahájení, *Hnací vazba dokončení* ty se závislostí dokončení-dokončení nebo zahájení-dokončení, každý s typem závislosti za sebou. Když nemáte hnací vazbu dokončení, zobrazí se *Žádná hnací vazba dokončení (FF/SF) – rozpětí se nastaví na nulovou délku.* a doba trvání je nulová. Viz [Vytvoření překlenovacího úkolu](docs://howto-hammock).

## Omezení a konečný termín

U souhrnného úkolu nemá omezení ani konečný termín žádný vliv: výpočet počítá jen koncové úkoly a data souhrnného úkolu odvozuje z jeho dílčích úkolů.

- **Omezení** — omezení data pro úkol. Volby: *Co nejdříve (ASAP)*, *Co nejpozději (ALAP)*, *Zahájit nejdříve (SNET)*, *Zahájit nejpozději (SNLT)*, *Dokončit nejdříve (FNET)*, *Dokončit nejpozději (FNLT)*, *Musí začít (MSO)* a *Musí skončit (MFO)*. Výchozí hodnota: *ASAP*, což znamená žádné omezení. Když zvolíte ASAP, všechna omezení úkolu zmizí; když zvolíte ALAP, zmizí sekundární omezení. Vliv po příkazu *Přepočítat*: omezení posune úkol, nebo způsobí zápornou časovou rezervu. Viz [Omezení a konečné termíny](docs://uitleg-constraints).
- **Datum omezení** — datum, které patří k omezení. Vidět je u každého omezení kromě *Co nejpozději (ALAP)*. Povinné; nové omezení dostane jako datum plánované zahájení.
- **Povinné (logika připnutí)** — jen pro *Musí začít (MSO)* a *Musí skončit (MFO)*. Výchozí hodnota: vypnuto. Zapnuto: datum je pevné, přebíjí závislosti a připne pruh i bez ohledu na předchůdce. U předchůdců se porušení projeví zápornou časovou rezervou. Když jej poprvé zapnete, jednou se zobrazí vysvětlení.
- **Sekundární omezení** a **Sekundární datum** — druhé omezení, jen jedno z *Zahájit nejdříve (SNET)*, *Dokončit nejdříve (FNET)*, *Zahájit nejpozději (SNLT)* nebo *Dokončit nejpozději (FNLT)* (nebo *(žádné)*). Zobrazí se, jakmile je zvoleno primární omezení, které není *Co nejdříve (ASAP)*, *Co nejpozději (ALAP)* ani tvrdé připnutí. Vždy měkké. Nepovolená kombinace dostane červený okraj a důvod: sekundární omezení nesmí být tvrdé, nesmí být s MSO/MFO ani s tvrdým připnutím, nesmí být s ASAP/ALAP, musí být mez (nejdříve, nebo nejpozději) a primární a sekundární omezení nesmějí platit pro stejnou stranu. Platná dvojice je například SNET s FNLT.
- **Konečný termín** — cílové datum dokončení. Prázdné = žádný konečný termín. Vliv: úkol se kvůli němu nepohne. Když je nejdřívější dokončení později, časová rezerva je záporná a aplikace hlásí *Konečný termín … zmeškán — nejdřívější dokončení …*.

## Průběh

- **Průběh (%)** — posuvník od 0 do 100. Výchozí hodnota: 0. Vliv: nad 0 aplikace doplní chybějící *Skutečné zahájení* a 100 doplní *Skutečné dokončení*. Stav se řídí podle toho: *Nezahájeno* bez skutečného zahájení, *Probíhá* se skutečným zahájením a *Dokončeno* se skutečným dokončením. Zbývající doba trvání (*Zbývající*) je doba trvání × (1 − průběh), zaokrouhlená na celé dny u úkolu v dnech a na celé minuty u úkolu v hodinách. Odvedená práce se počítá do data stavu; když datum stavu ještě není, aplikace jej nastaví na dnešek a řekne to. U souhrnného úkolu je pole vypnuté: jeho průběh vyplývá z dílčích úkolů po příkazu *Přepočítat* (*Odvozeno z dílčích úkolů: průběh změňte tam. Souhrnný úkol se aktualizuje po přepočítání (F5).*).
- **Skutečné zahájení** — datum, kdy úkol skutečně začal. Datum po skutečném dokončení nebo po datu stavu aplikace odmítne. Když je úkol plánovaný na začátek až po datu stavu a nyní dostane průběh, okno se zeptá: *Zadejte skutečné zahájení*. U milníku je místo polí *Skutečné zahájení* a *Skutečné dokončení* jedno pole *Skutečné datum*.
- **Skutečné dokončení** — datum, kdy byl úkol skutečně hotov. Když jej vyplníte, průběh se nastaví na 100 a stav na *Dokončeno*; když jej vymažete, průběh se vrátí na 0 a stav na *Probíhá*. Stejná odmítnutí jako u *Skutečné zahájení*.
- **Zbývající** — jen pro čtení (ne u milníku): kolik doby trvání zbývá, v jednotce úkolu.

Okno použije tato pravidla na koncept; platí až po *Uložit*. Viz [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang).

## Výsledek CPM

- **Výsledek CPM** — jen pro čtení: výsledek posledního výpočtu: *Nejdřívější zahájení*, *Nejdřívější dokončení*, *Pozdní zahájení*, *Pozdní dokončení*, *Celková časová rezerva*, *Volná časová rezerva*, *Interferující časová rezerva* a *Kritická cesta* (*Ano* nebo *Ne*). Časová rezerva je v pracovních dnech se dvěma desetinnými místy. Zastaralé nebo ještě nevypočítané? Stiskněte *Přepočítat*.

## Závislosti

- **Závislosti** — závislosti tohoto úkolu, jeden řádek na závislost: propojený úkol (na panelu kód WBS, nebo název, když kód chybí; v okně název), ikona blesku, když je závislost hnací (*Hnací vazba (driving)*, po výpočtu), typ závislosti (*FS*, *SS*, *FF* nebo *SF*), prodleva a koš. Na panelu je kód WBS tlačítko: když na něj ukážete, zobrazí se úkol, kliknutím na něj přejdete k úkolu. Malá značka před kódem ukazuje roli: zlatý kulatý znak pro předchůdce a fialový čtvercový pro následníka, stejnými barvami jako v [Sledování cesty](docs://howto-pad-traceren). Role je také v názvu tlačítka pro čtečku obrazovky. V okně je to prostý text a sekce se zobrazí jen tehdy, když úkol má závislosti.
- **Prodleva** — zadejte číslo s jednotkou: `2d` pracovní dny, `3ed` kalendářní dny, `2u` nebo `2h` pracovní hodiny, `3eu` nebo `3eh` kalendářní hodiny, `50%` procento doby trvání předchůdce, `-25e%` procento v kalendářním čase. Mínus z ní udělá předstih. Bez jednotky se počítá v pracovních dnech. Neplatný zápis obarví pole červeně a pole se vrátí. Viz [Závislosti a prodleva](docs://uitleg-relaties).
- **Přidat závislost** (jen na panelu) — otevře řádek konceptu. V poli *Směr* zvolte *Předchůdce* nebo *Následník*, úkol najděte pomocí *Hledat úkol*… podle kódu WBS nebo názvu, zvolte typ a prodlevu a potvrďte tlačítkem *Vytvořit závislost* (nebo *Zrušit*). Duplicitní závislost nebo závislost s nadřazeným úkolem tohoto úkolu se odmítne se zprávou a řádek zůstane.

## Přerušení práce

Jen v panelu, a ne u milníku, souhrnného úkolu, překlenovacího úkolu, úkolu, u kterého je uplynulá doba trvání, ručně plánovaného úkolu nebo úkolu, který je na přerušení příliš krátký.

- **Přerušení práce** — pauzy v práci úkolu. Jedna řádka na jednu pauzu: *po* (kolik práce je před pauzou), *pauza* (délka) a jednotka (*pracovní dny*, u úkolu v hodinách *hodiny*), s rozsahem od–do dílu za ní níže. Pauza vytvořená *vyrovnáním* nese štítek *vyrovnání*. Pauza s délkou 0 se odstraní; odstraní ji také koš u každé řádky (*Odstranit přerušení práce*). Účinek: pruh se vykreslí přerušený a po příkazu *Přepočítat* se dokončení posune o pauzu.
- **Přidat přerušení práce** — přidá pauzu o jedné jednotce času uprostřed nejdelšího dílu. Tlačítko je neaktivní, když pro pauzu není místo.
- **Odstranit všechna přerušení práce** — zobrazí se, když přerušení pocházejí ze zdrojového souboru v podobě, kterou zde nelze upravit (*Tato přerušení práce pocházejí ze zdrojového souboru v podobě, kterou zde nelze upravit.*). Potom vidíte jen data.

Viz [Rozdělení úkolu](docs://howto-taak-splitsen).

## Přiřazení

- **Přiřazení** — zdroje u tohoto úkolu. U každého zdroje: jméno s košem (*Odstranit*), *Jedn./den*, *Práce (zbývá)*, *Křivka*, tlačítko *Rozložení práce v čase…* a *Přesunout na…*. Dole je seznam *Přiřadit zdroj*; ten přiřadí zdroj, s jednotkami přiřazení 1 za den. Bez zdrojů se zobrazí *Nejprve vytvořte zdroje (karta Zdroje).*; když jsou všechny přiřazené, zobrazí se *Všechny zdroje jsou už přiřazeny.* U milníku nebo souhrnného úkolu se zobrazí, že přiřazení není možné.
- **Jedn./den** — kolik zdroje úkol použije za den, číslo nad 0. Účinek: vytížení v histogramu, přetížení a, s pravidlem pevné veličiny, práce.
- **Práce (zbývá)** — zbývající práce v hodinách pro tento zdroj. Vidět jen, když jsou pravidla pevné veličiny zobrazena a úkol nějaké pravidlo má; u materiálu je pomlčka. Zámek ukazuje, který roh chrání pravidlo pevné veličiny (*Chráněno pravidlem pevné veličiny …*). Výstražný trojúhelník (*Liší se od jednotek přiřazení × doby trvání*) znamená, že uložená práce se nerovná součinu jednotek přiřazení a zbývající doby trvání; histogram pak sleduje uloženou práci.
- **Křivka** — jak se práce rozloží v době trvání: *Rovnoměrné*, *Vytížení na začátku*, *Vytížení na konci*, *Zvonovitý tvar*, *Brzká špička*, *Pozdní špička*, *Dvojitá špička* nebo *Želva*. Výchozí: *Rovnoměrné*. Když má přiřazení vlastní rozložení práce v čase, zobrazí se *Průběhová křivka* a seznam je neaktivní; importovaná křivka se nazývá *Importovaná křivka*.
- **Rozložení práce v čase…** — otevře rozložení práce v čase po pracovních dnech pro toto přiřazení. Viz [Úprava rozložení práce v čase](docs://howto-urenverdeling-aanpassen).
- **Přesunout na…** — přesune přiřazení na jiný úkol bez dílčích úkolů, který zdroj ještě nemá. Vidět jen, když takový úkol existuje.

## Kódy a pole

- **Kódy a pole** — vidět jen, když projekt má kódy aktivit nebo vlastní pole. Každý kód aktivity je seznam s *(žádné)* a hodnotami ve tvaru `kód — popis`; u každého typu zvolíte nejvýše jednu hodnotu. Každé vlastní pole má vstup, který odpovídá jeho typu: *Text*, *Číslo*, *Celé číslo*, *Náklady*, *Datum* nebo *Ano/ne*. Účinek: nemá vliv na výpočet; podle nich můžete seskupovat a filtrovat a zobrazit je jako sloupce. Viz [Kódy a vlastní pole](docs://howto-codes-en-velden).

## Značky u pravidla pevné veličiny

Jen v panelu a jen tehdy, když platí.

- **Dlouhé nepracovní období** — *Tento úkol probíhá přes nepracovní období o délce … dní (… až …).*, nebo s přidaným názvem svátku nebo stavební přestávky. Zobrazí se, když úkol probíhá přes souvislé období 8 dnů nebo delší, ve kterém je alespoň jeden svátek. Je to varování, ne zamítnutí; zkontrolujte, zda je plán takto myšlený.
- **Značka MS Project** — štítek *Řídí se rozložením práce v čase z MS Project*, *Okno dat MS Project se po úpravě už neuplatňuje — …* nebo *Vlastní rozložení práce v čase*, s *Číst více*. Ukazuje, zda rozložení práce v čase ze souboru MS Project ještě řídí data.
- **Zaznamenaná data** — štítek pro importovaný soubor se zaznamenanými daty: *Zobrazuje data tak, jak jsou pro tento úkol uložena v souboru* (u souboru Primavery *Zobrazuje vlastní uložená data Primavery pro tento úkol*), *Liší se od uložených dat* nebo *Záznam je částečně neúplný – viz sloupce pozdní zahájení, pozdní dokončení a časová rezerva*, s *Číst více*. Viz [Data tak, jak jsou uložena](docs://uitleg-datums-zoals-opgeslagen).

## Záhlaví a zápatí panelu

- **Odstranit úkol** — koš vedle nadpisu *Úkol*; smaže tento úkol spolu s jeho dílčími úkoly jako jeden krok, který lze vrátit příkazem *Vrátit zpět*. Plán je potom zastaralý, dokud nestisknete *Přepočítat*.
- **Přepočítat** — tlačítko dole; stejný výpočet jako na kartě *Domů › Plán › Přepočítat*.

## Co tu nenajdete

- **Priorita vyrovnání** — není v okně ani v panelu. Nastavíte ji kliknutím pravým tlačítkem a volbou *Priorita* (*Nízká* = 100, *Normální* = 500, *Vysoká* = 900), nebo zapsáním čísla od 0 do 1000 do sloupce *Priorita vyrovnání*. Výchozí: 500. Účinek: vyrovnání nejdřív nechá úkoly s vyšší prioritou beze změny dat; 1000 úkol zafixuje, takže jej vyrovnání nikdy nepřesune. Viz [Vyrovnání](docs://uitleg-nivelleren).
- **Ostatní údaje o úkolu** — zbytek, který úkol nese, například sloupce *Ručně plánováno*, *Barva* a technické sloupce, je jen v tabulce; viz [Sloupce tabulky](docs://ref-tabelkolommen).
