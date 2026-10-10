# Nastavení

Každé nastavení aplikace: co dělá, jaká je jeho výchozí hodnota, co se změní a kde je najdete. Možnosti výpočtu projektu (profil výpočtu, definice kritického úkolu) najdete v článku [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies). Ty patří k souboru projektu, ne k aplikaci.

## Kde je najdete a jak fungují

Panel nastavení je na třech místech. Všude je stejný panel: ozubené kolečko nahoře v okně, na kartě *Nastavení › Projekt › Nastavení* a na kartě *Soubor › Nastavení*. Panel má tři karty: *Zobrazení*, *Plán* a *Pokročilé*. Každé nastavení níže uvádí jen kartu, na které je.

Změna se projeví hned. Tlačítko *Použít* tu není. Tlačítko *Zrušit* také ne.

**Pro celou aplikaci, ne pro jeden projekt.** Všechna nastavení v tomto článku platí pro všechny vaše projekty a patří k tomuto zařízení. Aplikace je ukládá do úložiště aplikace nebo vašeho prohlížeče, ne do souboru projektu. Když soubor otevře někdo jiný, uvidí proto svá vlastní nastavení. Prohlížeč, jehož úložiště vymažete, začne znovu s výchozími hodnotami.

## Karta Zobrazení

**Motiv** — barevné schéma rozhraní. Vyberte ze seznamu *Tmavý*, *Světlý* a *Vysoký kontrast*. Výchozí: *Tmavý*. Účinek: barvy celého rozhraní, včetně diagramu Gantt a histogramu. Kde: *Zobrazení*.

**Sledovat motiv systému** — nechá barevné schéma určit operačním systémem. Výchozí: vypnuto. Účinek: aplikace použije motiv *Světlý* nebo *Tmavý*, podle systému; tři karty motivů jsou pak nedostupné. *Vysoký kontrast* systém nesleduje, zvolíte si ho sami. Když to vypnete, zůstane motiv, který je právě na obrazovce. Kde: *Zobrazení*, pod *Motiv*.

**Jazyk** — jazyk rozhraní. Výchozí: jazyk vašeho prohlížeče nebo systému, pokud ho aplikace zná. Jinak angličtina. Účinek: všechny texty v aplikaci. Čtrnáct jazyků je seřazeno podle krátkého kódu. Arabština a perština zrcadlí rozhraní zprava doleva. Jazyk nápovědy nastavíte zvlášť na kartě *Soubor › Nápověda*, pod položkou *Jazyk dokumentace*. Kde: *Zobrazení*.

**Písmo** — písmo celého rozhraní. Vyberte ze seznamu *Výchozí*, *Systémové*, *Patkové* a *Monospace*. Výchozí: *Výchozí*. Účinek: nadpisy a text v okně, text v diagramu Gantt a v histogramu. Webová aplikace sama nesleduje systémové písmo. Proto ho zvolíte tady. Kde: *Zobrazení*.

**Velikost textu** — měřítko rozhraní. Vyberte ze seznamu 90%, 100%, 110% a 125%. Výchozí: 100%. Účinek: text a rozvržení pásu karet, panelů a dialogů se zvětší nebo zmenší. Výška řádků v tabulce a v diagramu Gantt se mění také. Nad 125% žádná volba není, protože by se popisky tlačítek v pásu karet zalamovaly do více řádků. Kde: *Zobrazení*.

**Formát data** — způsob zobrazení dat v aplikaci. Vyberte ze seznamu *dd-mm-rrrr*, *mm-dd-rrrr* a *rrrr-mm-dd*. Výchozí: *dd-mm-rrrr*. Účinek: data v tabulce, v dialozích, v každé sestavě a při tisku. Soubory a výpočty se nemění, mění se jen zobrazení. Kde: *Zobrazení*.

**Zobrazení doby trvání** — v jaké jednotce se zobrazí doba trvání úkolu. Vyberte ze seznamu *Automaticky (vlastní jednotka každého úkolu)*, *Vždy dny* a *Vždy hodiny*. Výchozí: *Automaticky (vlastní jednotka každého úkolu)*. Účinek: tabulka úkolů, popisky pruhů v diagramu Gantt, nápověda po najetí myší, tisk a každá sestava. Při nastavení *Automaticky* se u úkolu ve dnech zobrazí dny a u hodinového úkolu hodiny. Při nastavení *Vždy dny* nebo *Vždy hodiny* aplikace převede hodnoty podle počtu hodin na den v kalendáři úkolu. Má-li úkol jinou jednotku, připojí za hodnotu jeho vlastní jednotku v závorce, například `2.25d(18h)`. Mění se jen zobrazení; úkol si zachová svou jednotku. Kde: *Zobrazení*.

**Způsob přepínání projektů** — jak přepínáte mezi otevřenými projekty. Vyberte ze seznamu *Vodorovné karty*, *Svislé karty* a *Pilulka*. Výchozí: *Vodorovné karty*. Účinek: *Vodorovné karty* zobrazí lištu karet pod pásem karet. *Svislé karty* zobrazí lištu projektů vlevo. *Pilulka* zobrazí malé tlačítko projektu v záhlaví okna. Kde: *Zobrazení*.

### Sekce Gantt

**Zobrazit jen pracovní dny** — zhustí časovou osu. Výchozí: vypnuto. Účinek: víkendy a svátky z kalendáře projektu se přeskočí. Úkol s 5 pracovními dny je tak přesně 5 sloupců široký. Zkratky *Přejít na dnešek* a *Přizpůsobit projektu* pak také počítají v pracovních dnech. Sestava má vlastní zaškrtávací políčko se stejným názvem. To na tomto nastavení nezávisí. Kde: *Zobrazení*, pod *Gantt › Časová osa*.

**Při větším přiblížení zobrazit čtvrthodiny** — jemnější časová osa navíc. Výchozí: vypnuto. Účinek: můžete přiblížit ještě víc a stupnice hodin dostane řádek navíc s čtvrthodinami. Při tažení pruhu hodinového úkolu se pak může přichytit na čtvrthodiny místo na celé hodiny. Tuto volbu vidíte jen tehdy, když je zapnuto *Zapnout plánování v hodinách*. Kde: *Zobrazení*, pod *Gantt › Zoom po čtvrthodinách*.

**Pruhy úkolů při přerušení práce** — zda se pruh hodinového úkolu rozdělí na bloky. Vyberte ze seznamu *Nikdy nerozdělovat*, *Rozdělit při výběru* a *Vždy rozdělovat*. Výchozí: *Rozdělit při výběru*. Účinek: pruh hodinového úkolu se pak kreslí jako několik bloků místo jednoho souvislého bloku. *Rozdělit při výběru* to dělá jen u vybraného úkolu. Týká se jen hodinových úkolů. Rozdělený úkol (tlačítkem *Rozdělit úkol*) zobrazí své přerušení práce bez ohledu na toto nastavení. Kde: *Zobrazení*, pod *Gantt*.

**Posouvání a zoom › Režim** — co dělá kolečko myši nad diagramem Gantt. Vyberte ze seznamu *Pozice*, *Klávesy* a *Zoom + tažení*. Výchozí: *Zoom + tažení*. Účinek: u *Zoom + tažení* kolečko přibližuje kolem kurzoru. Shift + kolečko posouvá řádky. Časovou osu posunete tažením pozadí. Ctrl + tažení (na Macu Cmd + tažení) nakreslí výběrový rámeček. U *Pozice* závisí funkce kolečka na tom, kde je kurzor. Ctrl + kolečko vždy přibližuje a Shift + kolečko vždy posouvá vodorovně. U *Klávesy* si sami zvolíte, která klávesa co dělá. Volba platí i pro druhou časovou osu v rozděleném zobrazení. Kde: *Zobrazení*, pod *Gantt › Posouvání a zoom*.

**Posouvání a zoom › Rozdělení obrazovky** — kde má být kurzor pro jednotlivé funkce. Vidíte jen v režimu *Pozice*. Vyberte ze seznamu *Vlevo/vpravo*, *Nahoře/dole* a *Pravý horní roh*. Výchozí: *Vlevo/vpravo*. Účinek: u *Vlevo/vpravo* kolečko posouvá svisle nad levou polovinou a vodorovně nad pravou polovinou. U *Nahoře/dole* kolečko posouvá vodorovně v horních 30% (u časové osy) a svisle pod nimi. U *Pravý horní roh* kolečko posouvá vodorovně v pravém horním kvadrantu a svisle v ostatní části. Kde: *Zobrazení*, pod *Gantt › Posouvání a zoom*.

**Posouvání a zoom › Svisle, Vodorovně, Zoom** — která klávesa patří ke které funkci kolečka. Vidíte jen v režimu *Klávesy*. Pro každou funkci vyberete jednu z možností *Posouvání*, *Ctrl + kolečko* nebo *Shift + kolečko*. Výchozí: *Svisle* je *Posouvání*, *Zoom* je *Ctrl + kolečko* a *Vodorovně* je *Shift + kolečko*. Účinek: když vyberete klávesu, která se už používá, vymění se s funkcí, která ji měla. Kde: *Zobrazení*, pod *Gantt › Posouvání a zoom*.

## Karta Plán

**Zapnout režim stavby** — výchozí hodnoty pro nové projekty zaměřené na stavbu. Výchozí: zapnuto. Účinek: při zapnutí dostane nový projekt kalendář *Bouwkalender NL* s nizozemskými státními svátky. Můžete vybrat stavební svátek při generování svátků. Nabídnou se šablony etapizace *Bytová výstavba* a *Nebytová výstavba / rekonstrukce*. Nové úkoly dostanou typ úkolu *Stavba*. Při vypnutí dostane projekt kalendář *Standaardkalender* bez svátků, jen šablonu *Prázdný* a typ úkolu *Ostatní*. Nový úkol pod nadřazeným úkolem, který má typ úkolu, nejdřív převezme ten typ. Teprve potom se použije *Stavba* nebo *Ostatní*. Stávající úkoly a kalendáře se nemění. Kde: *Plán*.

**Zapnout plánování v hodinách** — plánování v pracovních hodinách vedle pracovních dnů. Výchozí: vypnuto. Účinek: na kartě *Zobrazení › Časová osa* se objeví stupnice *Hodina*. V okně *Kalendáře* přibude blok *Pracovní hodiny*. V okně *Nový projekt* přibudou volby *Směna* a *Výchozí jednotka pro nové úkoly*. *Info o projektu* dostane také volbu *Výchozí jednotka pro nové úkoly*. Když je vypnuto, pracuje aplikace po celých dnech. Úkoly, které už jsou v hodinách, zůstanou a vstoupí do výpočtu. Dobu trvání těchto úkolů můžete upravit teprve, až zapnete plánování v hodinách. Kde: *Plán*, pod *Plánování v hodinách*. Viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).

**Povolit smíšené plánování po dnech a hodinách** — zda si jednotku volíte pro každý úkol. Vidíte jen tehdy, když je zapnuto *Zapnout plánování v hodinách*. Výchozí: zapnuto. Účinek: při zapnutí se u doby trvání každého úkolu zobrazí rozbalovací seznam *Jednotka doby trvání*. Při vypnutí se seznam skryje. Kde: *Plán*, pod *Plánování v hodinách*. Viz [Dny a hodiny](docs://uitleg-dagen-en-uren).

**Začátek týdne** — první den týdne. Vyberte ze seznamu *Pondělí* a *Neděle*. Výchozí: *Pondělí*. Účinek: rozvržení týdnů a čísla týdnů na časové ose v diagramu Gantt a v každé sestavě (u tisku diagramu Gantt) a pořadí dnů v okně *Kalendáře*. Kde: *Plán*.

**Automaticky přepočítat** — přepočítá plán hned, jakmile přestane být aktuální. Výchozí: vypnuto. Účinek: při vypnutí stisknete *Přepočítat* (F5) sami. Při zapnutí aplikace přepočítá plán během zlomku sekundy po změně úkolů, závislostí nebo kalendáře. Během tažení nebo psaní do pole počká a přepočítá jednou, až skončíte. Po neúspěšném přepočtu přepočítá znovu teprve, až něco změníte. Kde: *Plán*, pod *Přepočítání*.

**Zobrazit pravidla pevné veličiny a práci** — pole pravidla pevné veličiny a práce v aplikaci. Výchozí: vypnuto. Účinek: při zapnutí se u úkolu zobrazí pole *Pravidlo pevné veličiny* a u přiřazení sloupec práce. Zpřístupní se také sloupec tabulky *Pravidlo pevné veličiny*. Při vypnutí se tato pole skryjí. Doba trvání a jednotky přiřazení zůstanou a práce se podle nich přizpůsobí. Projekt, který už obsahuje pravidla pevné veličiny nebo práci, například ze souboru `.mpp` nebo `.xer`, je vždy zobrazí, i když je nastavení vypnuté. Kde: *Plán*, pod *Přepočítání*. Viz [Pravidla pevné veličiny: doba trvání, jednotky přiřazení a práce](docs://uitleg-werkregels).

## Karta Pokročilé

**Zapnout režim AI** — umožní, aby AI asistent pracoval s vaším plánem. Výchozí: vypnuto. Účinek: při zapnutí se zobrazí karta *AI* s mostem MCP. AI asistent pak může pracovat s vaším plánem přes Model Context Protocol. Při vypnutí se karta skryje a most se zastaví. Kde: *Pokročilé*, pod *Režim AI*. Viz [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

**Spustit most automaticky** — spustí most MCP při spuštění aplikace. Jde zapnout jen tehdy, když je zapnuto *Zapnout režim AI*. Výchozí: vypnuto. Účinek: most je hned aktivní. AI klient se tak může připojit, aniž byste nejdřív otevřeli kartu *AI*. Funguje to jen v desktopové aplikaci a jen jednou za spuštění. Když most potom vypnete sami, znovu se nespustí. Kde: *Pokročilé*, pod *Režim AI*.

**Zapnout ladicí terminál** — panel s protokolem pro hledání chyb. Výchozí: vypnuto. Účinek: při zapnutí se ve stavovém řádku objeví tlačítko terminálu. To panel s protokolem zobrazí nebo skryje. Při vypnutí se panel zavře. Kde: *Pokročilé*, pod *Ladicí terminál*.

**Benchmark…** — měří výkon plánovacího jádra. Účinek: otevře okno, ve kterém si necháte vygenerovat zkušební plán zvolené velikosti a změřit hlavní fáze. Váš otevřený projekt zůstane beze změny. Je to tlačítko, ne nastavení: nic se neukládá. Kde: *Pokročilé*, pod *Benchmark*.

**Statistiky…** — kolikrát se aplikace stáhla. Účinek: otevře okno *Statistiky stahování* s veřejnými čísly z GitHub Releases. Nic se od vás nesbírá. Je to tlačítko, ne nastavení. Kde: *Pokročilé*, pod *Statistiky*. V okně:

- *Stažení podle operačního systému* — u každého systému sloupce *Stažení*, *Instalátory* (co si člověk stáhne) a *Aktualizace* (co si stáhne aktualizátor v aplikaci), s položkou *Celkem*. Na Linuxu nejdou tyto dvě věci oddělit. Aktualizátor stahuje stejný soubor `.deb`, `.rpm` nebo `.AppImage`, který lidé stahují i ručně. Jako instalátor se tam proto počítá jen soubor snap. Pod tím je *Kontroly aktualizací z aplikace*: kolikrát aktualizátor nainstalované aplikace stáhl z GitHubu soubor s verzí, aby hledal novou verzi. Jsou to kontroly, ne instalace.
- *Podle vydání* — stejná stažení podle verze, s datem. Nejdřív se ukáže šest nejnovějších. Pro zbytek slouží *Zobrazit všech … vydání*.
- *Zdroj* — datum čísel (GitHub Releases, každý týden aktualizováno) a tlačítko *Obnovit nyní*. Aplikace si stažená čísla drží půl hodiny. Když stahování selže, okno to napíše. Instalace přes Snap Store nevedou přes GitHub, a proto v číslech chybí.

**Spustit prohlídku** — úvodní prohlídku znovu. Účinek: zavře okno nastavení a spustí prohlídku od prvního kroku. Kde: *Pokročilé*, pod *Prohlídka*.

**Verze** — číslo verze aplikace, se dvěma tlačítky. *Zkontrolovat aktualizace* otevře okno aktualizací. *Co je nového* ukáže novinky aktuální verze. Kde: *Pokročilé*, pod *Verze*.

**Zobrazit klasická tlačítka zobrazení** — nahrazená funkce, v části *Starší funkce*. Výchozí: vypnuto. Účinek: při zapnutí se na kartu *Zobrazení* vrátí skupina *Zobrazení* se samostatnými tlačítky *Sloupce…*, *Filtr…*, *Seskupit…* a *Řadit…*. Nahradily je plus v záhlaví tabulky, tlačítka rozložení a okno rozložení. Kde: *Pokročilé*, pod *Starší funkce*.

## Zapamatované volby zobrazení mimo panel

Aplikace si tyto volby také uchovává na tomto zařízení. Nastavíte je ale přímo u daného prvku, ne v panelu nastavení.

**Překryv směrného plánu** — aktivní směrný plán jako tenký pruh pod pruhem úkolu. Výchozí: zapnuto. Kde: *Zobrazení › Směrné plány a průběh › Překryv směrného plánu*.

**Čára průběhu** — klikatá čára průběhu na datu stavu. Výchozí: zapnuto. Účinek: čára se zobrazí jen tehdy, když má projekt datum stavu, a nahradí pak samostatnou čáru datumu stavu. Kde: *Zobrazení › Směrné plány a průběh › Čára průběhu*.

**Čára datumu stavu** — tečkovaná čára na datu stavu. Výchozí: zapnuto. Účinek: pokud je zapnutá čára průběhu, kreslí značku sama. Kde: *Zobrazení › Směrné plány a průběh › Čára datumu stavu*.

**Zvýraznění zdrojů** — tenký proužek v barvě zdroje pod pruhem úkolu. Výchozí: vypnuto. Kde: *Zobrazení › Směrné plány a průběh › Zvýraznění zdrojů*.

**Pás časové rezervy** — časová rezerva jako pás za pruhy úkolů, které nejsou kritické. Výchozí: zapnuto. Kde: *Zobrazení › Směrné plány a průběh › Pás časové rezervy*.

**Barvy pruhů** — podle čeho závisí barva pruhu. Zvolte jednu z těchto možností: *Kritická cesta*, *Podle úkolu — automaticky* a *Podle kategorie*. Výchozí: *Kritická cesta*. Účinek: platí současně pro diagram Gantt a pro sestavu. Kde: *Zobrazení › Směrné plány a průběh › Barvy pruhů*.

**Histogram** — pás histogramu pod diagramem Gantt. Výchozí: vypnuto. Kde: *Zdroje › Histogram › Histogram*, *Zobrazení › Panely › Histogram* nebo Ctrl+Shift+H. Výšku pásu (výchozí 160 pixelů, v rozmezí 80 až 480) nastavíte tažením jeho okraje.

**Minimapa** — přehled celé časové osy. Výchozí: vypnuto. Kde: *Zobrazení › Prezentace › Minimapa*.

**Sbalení pásu karet** — kompaktní pás karet. Výchozí: vypnuto. Kde: tlačítko se šipkou vpravo dole na pásu karet.

**Šířka tabulky úkolů** — výchozí 350 pixelů, v rozmezí 150 až 800. Nastavíte ji tažením dělicí čáry vedle tabulky, nebo šipkami doleva a doprava, když je dělicí čára vybraná.

**Šířka pravého panelu** — výchozí 280 pixelů, v rozmezí 200 až 900. Nastavíte ji tažením okraje panelu.

**Výška *Vlastnosti* a *Upozornění* v pravém panelu** — výchozí 240 a 220 pixelů, v rozmezí 120 až 2000. *Vlastnosti* má tuto výšku také tehdy, když je otevřený seznam zdrojů. Nastavíte ji úchytem pro tažení mezi sekcemi. Aplikace si neuchovává, zda jsou sekce otevřené nebo zavřené.

**Také uchováno, popsáno jinde** — sloupce tabulky ([Úprava sloupců tabulky](docs://howto-tabelkolommen-aanpassen)), vaše rozložení ([Vytvoření a použití rozložení](docs://howto-layouts-gebruiken)), možnosti sestav ([Typy sestav](docs://ref-rapporttypes)), vaše vlastní šablony profilu výpočtu ([Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies)) a *Jazyk dokumentace* v nápovědě (*Soubor › Nápověda*). Tyto volby také uchovává aplikace na tomto zařízení, ne v souboru projektu.

## Viz také

- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): možnosti, které patří k projektu.
- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): postup pro přepínač *Zapnout plánování v hodinách*.
- [Dny a hodiny](docs://uitleg-dagen-en-uren): jak aplikace počítá dny a hodiny.
- [Pravidla pevné veličiny: doba trvání, jednotky přiřazení a práce](docs://uitleg-werkregels): co zobrazí *Zobrazit pravidla pevné veličiny a práci*.
- [Klávesové zkratky](docs://ref-sneltoetsen): všechny klávesy aplikace, včetně kláves pro přibližování a posouvání.
