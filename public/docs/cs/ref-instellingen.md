# Nastavení

Každé nastavení aplikace: co dělá, jaká je jeho výchozí hodnota, co se změní a kde ho najdete. Možnosti výpočtu projektu (profil výpočtu, definice kritičnosti) najdete v článku [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies). Ty patří do souboru projektu, ne do aplikace.

## Kde je najdete a jak fungují

Panel nastavení najdete na třech místech. Všude je to stejný panel: ozubené kolečko v horní části okna, *Nastavení › Projekt › Nastavení* a *Soubor › Nastavení*. Panel má tři karty: *Zobrazení*, *Plán* a *Pokročilé*. U každého nastavení níže je uvedena jen karta.

Změna platí hned. Neexistuje tlačítko *Použít* ani *Zrušit*.

**Pro celou aplikaci, ne pro jednotlivé projekty.** Všechna nastavení v tomto článku platí pro všechny vaše projekty a patří k tomuto zařízení. Aplikace je uchovává v úložišti aplikace nebo prohlížeče, ne v souboru projektu. Když váš soubor otevře někdo jiný, vidí svá vlastní nastavení. Pokud vymažete úložiště prohlížeče, začne se znovu s výchozími hodnotami.

## Karta Zobrazení

**Motiv** — barevné schéma rozhraní. Vyberte z možností *Tmavý*, *Světlý* a *Vysoký kontrast*. Výchozí: *Tmavý*. Účinek: barvy celého rozhraní, včetně diagramu Gantt a histogramu. Kde: *Zobrazení*.

**Řídit se systémovým motivem** — nechá rozhodnout barevné schéma vašeho operačního systému. Výchozí: vypnuto. Účinek: aplikace použije motiv *Světlý* nebo *Tmavý* podle systému; tři karty motivů se pak vypnou. *Vysoký kontrast* se systému neřídí: vyberete ho sami. Když to vypnete, zůstane motiv, který byl v tu chvíli na obrazovce. Kde: *Zobrazení*, pod *Motiv*.

**Jazyk** — jazyk rozhraní. Výchozí: jazyk vašeho prohlížeče nebo systému, pokud ho aplikace zná, jinak angličtina. Účinek: všechny texty v aplikaci; čtrnáct jazyků je seřazeno podle krátkého kódu. Arabština a perština zrcadlí rozhraní zprava doleva. Jazyk článků nápovědy nastavíte zvlášť v *Soubor › Nápověda* v části *Jazyk dokumentace*. Kde: *Zobrazení*.

**Písmo** — písmo celého rozhraní. Vyberte z možností *Výchozí*, *Systémové*, *Patkové* a *Monospace*. Výchozí: *Výchozí*. Účinek: nadpisy a text v okně a text v diagramu Gantt a v histogramu. Webová aplikace si systémové písmo sama nepřebírá, proto ho vyberete zde. Kde: *Zobrazení*.

**Velikost textu** — měřítko rozhraní. Vyberte z 90%, 100%, 110% a 125%. Výchozí: 100%. Účinek: text a rozložení pásu karet, panelů a dialogů se zvětší nebo zmenší a výška řádků v tabulce a v diagramu Gantt se přizpůsobí. Nad 125% volba není, protože popisky tlačítek v pásu karet by se pak zalamovaly na více řádků. Kde: *Zobrazení*.

**Formát data** — jak se data zobrazují v aplikaci. Vyberte z možností *dd-mm-rrrr*, *mm-dd-rrrr* a *rrrr-mm-dd*. Výchozí: *dd-mm-rrrr*. Účinek: data v tabulce, v dialozích, v sestavách a při tisku. Soubory ani výpočty se nemění, mění se jen zobrazení. Kde: *Zobrazení*.

**Zobrazení doby trvání** — v jaké jednotce se zobrazí doba trvání úkolu. Vyberte z možností *Automaticky (vlastní jednotka každého úkolu)*, *Vždy dny* a *Vždy hodiny*. Výchozí: *Automaticky (vlastní jednotka každého úkolu)*. Účinek: v tabulce úkolů, u popisků pruhů v diagramu Gantt, v bublině nápovědy, při tisku a v sestavách. Při nastavení *Automaticky* ukazuje úkol ve dnech dny a hodinový úkol hodiny. Při nastavení *Vždy dny* nebo *Vždy hodiny* aplikace převede podle hodin za den v kalendáři úkolu a když se jednotka úkolu liší, připojí za něj jeho vlastní jednotku v závorce, například `2.25d(18h)`. Mění se jen zobrazení; úkol si ponechá svou jednotku. Kde: *Zobrazení*.

**Způsob přepínání dokumentů** — jak přepínáte mezi otevřenými projekty. Vyberte z možností *Vodorovné karty*, *Svislé karty* a *Pilulka*. Výchozí: *Vodorovné karty*. Účinek: *Vodorovné karty* zobrazí pruh karet pod pásem karet; *Svislé karty* panel projektů vlevo; *Pilulka* malé tlačítko projektu v záhlaví okna. Kde: *Zobrazení*.

### Oddíl Gantt

**Zobrazit jen pracovní dny** — zhušťuje časovou osu. Výchozí: vypnuto. Účinek: víkendy a svátky z kalendáře projektu se přeskočí, takže úkol o délce 5 pracovních dnů je přesně 5 sloupců široký. Zkratky *Přejít na dnešek* a *Přizpůsobit projektu* pak také počítají v pracovních dnech. Sestava má vlastní zaškrtávací políčko se stejným názvem, které na tomto nastavení nezávisí. Kde: *Zobrazení*, v části *Gantt › Časová osa*.

**Zobrazit čtvrthodiny při velkém přiblížení** — jemnější časová stupnice navíc. Výchozí: vypnuto. Účinek: přiblížení jde dál a stupnice hodin dostane navíc řádek čtvrthodin. Tažení pruhu hodinového úkolu pak může přichytávat po čtvrthodinách místo po celých hodinách. Uvidíte to jen tehdy, když je zapnutá volba *Zapnout plánování v hodinách*. Kde: *Zobrazení*, v části *Gantt › Zoom po čtvrthodinách*.

**Pruhy úkolů při přerušení práce** — zda se hodinový úkol kreslí v blocích. Vyberte z možností *Nikdy nerozdělovat*, *Rozdělit při výběru* a *Vždy rozdělovat*. Výchozí: *Rozdělit při výběru*. Účinek: pruh hodinového úkolu se pak kreslí po pracovních blocích místo jako jeden souvislý blok. *Rozdělit při výběru* to dělá jen pro vybraný úkol. Týká se jen hodinových úkolů; rozdělený úkol (vytvořený volbou *Rozdělit úkol*) ukáže své přerušení práce bez ohledu na toto nastavení. Kde: *Zobrazení*, v části *Gantt*.

**Posouvání a zoom › Režim** — co dělá kolečko myši nad diagramem Gantt. Vyberte z možností *Pozice*, *Klávesy* a *Zoom + tažení*. Výchozí: *Zoom + tažení*. Účinek: Při režimu *Zoom + tažení* kolečko přibližuje kolem kurzoru, Shift + kolečko posouvá řádky, časovou osu posunete tažením pozadí a Ctrl + tažení (na Macu Cmd + tažení) nakreslí výběrový rámeček. Při režimu *Pozice* závisí funkce kolečka na tom, kde je kurzor; Ctrl + kolečko vždy přibližuje a Shift + kolečko vždy posouvá vodorovně. V režimu *Klávesy* si sami zvolíte, která klávesa co dělá. Volba platí i pro druhou časovou osu v rozděleném zobrazení. Kde: *Zobrazení*, v části *Gantt › Posouvání a zoom*.

**Posouvání a zoom › Rozdělení obrazovky** — kde musí být kurzor pro jakou funkci. Viditelné jen v režimu *Pozice*. Vyberte z možností *Vlevo/vpravo*, *Nahoře/dole* a *Pravý horní roh*. Výchozí: *Vlevo/vpravo*. Účinek: Při nastavení *Vlevo/vpravo* kolečko posouvá svisle nad levou polovinou a vodorovně nad pravou polovinou. Při nastavení *Nahoře/dole* kolečko posouvá vodorovně v horních 30% (u časové stupnice) a svisle pod ní. Při nastavení *Pravý horní roh* kolečko posouvá vodorovně v pravém horním kvadrantu a svisle v ostatních. Kde: *Zobrazení*, v části *Gantt › Posouvání a zoom*.

**Posouvání a zoom › Svisle, Vodorovně, Zoom** — která klávesa patří ke které funkci kolečka. Viditelné jen v režimu *Klávesy*. Pro každou funkci vyberete z možností *Posouvání*, *Ctrl + kolečko* nebo *Shift + kolečko*. Výchozí: *Svisle* je *Posouvání*, *Zoom* je *Ctrl + kolečko* a *Vodorovně* je *Shift + kolečko*. Účinek: když vyberete klávesu, která se už používá, vymění se s funkcí, která ji měla. Kde: *Zobrazení*, v části *Gantt › Posouvání a zoom*.

## Karta Plán

**Zapnout stavební režim** — výchozí hodnoty pro nové projekty zaměřené na stavbu. Výchozí: zapnuto. Účinek: při zapnutí dostane nový projekt kalendář *Bouwkalender NL* s nizozemskými státními svátky, při generování svátků můžete zvolit stavební svátek, nabídnou se šablony fází *Bytová výstavba* a *Nebytová výstavba / rekonstrukce* a nové úkoly dostanou typ úkolu *Stavba*. Při vypnutí dostane projekt kalendář *Standaardkalender* bez svátků, jen šablonu *Prázdný* a typ úkolu *Ostatní*. Nový úkol pod nadřazeným úkolem, který má typ úkolu, nejdřív převezme tento typ; *Stavba* nebo *Ostatní* se použije až potom. Existující úkoly a kalendáře se nemění. Kde: *Plán*.

**Zapnout plánování v hodinách** — plánování v pracovních hodinách vedle pracovních dnů. Výchozí: vypnuto. Účinek: na kartě *Zobrazení › Časová osa* se objeví stupnice *Hodina*, v okně *Kalendáře* přibude blok *Pracovní hodiny* a v okně *Nový projekt* přibudou volby *Směna* a *Výchozí jednotka pro nové úkoly*. *Info o projektu* dostane také volbu *Výchozí jednotka pro nové úkoly*. Při vypnutí pracuje aplikace po dnech. Úkoly, které už jsou v hodinách, zůstanou a zahrnou se do výpočtu; jejich dobu trvání půjde upravit až po zapnutí plánování v hodinách. Kde: *Plán*, v části *Plánování v hodinách*. Viz [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten).

**Povolit smíšené plánování dnů a hodin** — zda si jednotku volíte u každého úkolu. Viditelné jen tehdy, když je zapnutá volba *Zapnout plánování v hodinách*. Výchozí: zapnuto. Účinek: zapnuto zobrazí u doby trvání každého úkolu rozbalovací seznam *Jednotka doby trvání*. Vypnuto ho skryje. Kde: *Plán*, v části *Plánování v hodinách*. Viz [Dny a hodiny](docs://uitleg-dagen-en-uren).

**Týden začíná** — první den týdne. Vyberte z možností *Pondělí* a *Neděle*. Výchozí: *Pondělí*. Účinek: rozložení týdne a čísla týdnů na časové ose v diagramu Gantt a v sestavách (tisk diagramu Gantt) a pořadí dnů v týdnu v okně *Kalendáře*. Kde: *Plán*.

**Automaticky přepočítat** — přepočítá plán hned, jakmile přestane být aktuální. Výchozí: vypnuto. Účinek: při vypnutí stisknete *Přepočítat* (F5) sami. Při zapnutí aplikace přepočítá plán do zlomku sekundy po změně úkolů, závislostí nebo kalendáře. Během tažení nebo při psaní v poli aplikace počká a přepočítá jednou, až budete hotovi. Po neúspěšném přepočtu přepočítá znovu, až něco změníte. Kde: *Plán*, v části *Přepočítání*.

**Zobrazit pravidla pevné veličiny a práci** — pole pravidla pevné veličiny a práce v aplikaci. Výchozí: vypnuto. Účinek: zapnuto zobrazí pole *Pravidlo pevné veličiny* u úkolu a sloupec práce u přiřazení a zpřístupní sloupec *Pravidlo pevné veličiny* v tabulce úkolů. Při vypnutí je skryje; doba trvání a jednotky přiřazení zůstanou a práce se přizpůsobí. Projekt, který už obsahuje pravidlo pevné veličiny nebo data o práci, například ze souboru `.mpp` nebo `.xer`, je zobrazí vždy, i když je nastavení vypnuto. Kde: *Plán*, v části *Přepočítání*. Viz [Pravidla pevné veličiny: doba trvání, jednotky a práce](docs://uitleg-werkregels).

## Karta Pokročilé

**Zapnout režim AI** — umožní, aby s vaším plánem pracoval AI asistent. Výchozí: vypnuto. Účinek: zapnuto zobrazí kartu *AI* s mostem MCP, takže AI asistent může s plánem pracovat přes Model Context Protocol. Vypnuto kartu skryje a most zastaví. Kde: *Pokročilé*, v části *Režim AI*. Viz [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

**Spustit most automaticky** — spustí most MCP při startu aplikace. Lze ho zapnout jen tehdy, když je zapnutá volba *Zapnout režim AI*. Výchozí: vypnuto. Účinek: most je hned aktivní, takže se AI klient může připojit, aniž byste nejdřív otevřeli kartu *AI*. Funguje jen v desktopové aplikaci a jen jednou při každém spuštění: když ho potom vypnete sami, znovu se nespustí. Kde: *Pokročilé*, v části *Režim AI*.

**Zapnout ladicí terminál** — panel záznamů pro řešení problémů. Výchozí: vypnuto. Účinek: zapnuto přidá do stavového řádku tlačítko terminálu, které panel záznamů zobrazí nebo skryje. Vypnuto panel zavře. Kde: *Pokročilé*, v části *Ladicí terminál*.

**Benchmark…** — měří výkon motoru plánování. Účinek: otevře okno, ve kterém si nechte vygenerovat zkušební plán zvolené velikosti a změřit hlavní fáze výpočtu. Váš otevřený projekt zůstane beze změny. Je to tlačítko, ne nastavení; není co si pamatovat. Kde: *Pokročilé*, v části *Benchmark*.

**Statistiky…** — kolikrát se aplikace stáhla. Účinek: otevře okno *Statistiky stahování* s veřejnými čísly z GitHub Releases; nic se o vás nesbírá. Je to tlačítko, ne nastavení. Kde: *Pokročilé*, v části *Statistiky*. V okně:

- *Stažení podle operačního systému* — u každého systému sloupce *Stažení*, *Instalátory* (co si člověk stáhne) a *Aktualizace* (co stahuje aktualizátor v aplikaci), se součtem *Celkem*. U Linuxu nejdou tyto dva oddělit: aktualizátor stáhne stejný soubor `.deb`, `.rpm` nebo `.AppImage`, jaký lidé stahují i ručně, takže se tam jako instalátor počítá jen soubor snap. Pod tím *Kontroly aktualizací z aplikace*: jak často aktualizátor v nainstalované aplikaci stáhl z GitHubu soubor s verzí, aby hledal novou verzi. Jsou to kontroly, ne instalace.
- *Podle vydání* — stejná stažení podle verze, s datem; nejdřív šest nejnovějších, u zbytku *Zobrazit všech … vydání*.
- *Zdroj* — datum údajů (GitHub Releases, aktualizováno jednou týdně) a *Obnovit nyní*. Aplikace si stažené údaje drží půl hodiny. Když stahování selže, okno to oznámí. Instalace přes Snap Store nejdou přes GitHub, proto v údajích chybí.

**Spustit prohlídku** — úvodní prohlídka znovu. Účinek: zavře okno nastavení a spustí prohlídku od prvního kroku. Kde: *Pokročilé*, v části *Prohlídka*.

**Verze** — číslo verze aplikace se dvěma tlačítky. *Zkontrolovat aktualizace* otevře okno aktualizací. *Co je nového* zobrazí novinky aktuální verze. Kde: *Pokročilé*, v části *Verze*.

**Zobrazit klasická tlačítka zobrazení** — nahrazená funkce, v části *Starší funkce*. Výchozí: vypnuto. Účinek: zapnuto vrátí na kartu *Zobrazení* skupinu *Zobrazení* s oddělenými tlačítky *Sloupce…*, *Filtr…*, *Seskupit…* a *Řadit…*. Nahradily je znaménko plus v záhlaví tabulky, tlačítka rozložení a okno rozložení. Kde: *Pokročilé*, v části *Starší funkce*.

## Zapamatovaná nastavení zobrazení mimo panel

Aplikace si tyto volby také ukládá v tomto zařízení. Nastavíte je ale přímo u dané položky, ne v panelu nastavení.

**Překryv směrného plánu** — aktivní směrný plán jako tenký pruh pod pruhem úkolů. Výchozí: zapnuto. Kde: na kartě *Zobrazení › Směrné plány a průběh › Překryv směrného plánu*.

**Čára průběhu** — klikatá čára průběhu v datu stavu. Výchozí: zapnuto. Účinek: čára se zobrazí jen tehdy, když má projekt datum stavu. Potom nahradí samostatnou čáru datumu stavu. Kde: na kartě *Zobrazení › Směrné plány a průběh › Čára průběhu*.

**Čára datumu stavu** — tečkovaná čára v datu stavu. Výchozí: zapnuto. Účinek: pokud je zapnutá čára průběhu, kreslí označení sama. Kde: na kartě *Zobrazení › Směrné plány a průběh › Čára datumu stavu*.

**Zvýraznění zdrojů** — tenký proužek v barvě zdroje pod pruhem úkolu. Výchozí: vypnuto. Kde: na kartě *Zobrazení › Směrné plány a průběh › Zvýraznění zdrojů*.

**Pás časové rezervy** — časová rezerva jako pás za pruhy nekritických úkolů. Výchozí: zapnuto. Kde: na kartě *Zobrazení › Směrné plány a průběh › Pás časové rezervy*.

**Barvy pruhů** — na čem závisí barva pruhu. Vyberte z možností *Kritická cesta*, *Podle úkolu — automaticky* a *Podle kategorie*. Výchozí: *Kritická cesta*. Účinek: platí současně pro diagram Gantt a sestavu. Kde: na kartě *Zobrazení › Směrné plány a průběh › Barvy pruhů*.

**Histogram** — pruh histogramu pod diagramem Gantt. Výchozí: vypnuto. Kde: na kartě *Zdroje › Histogram › Histogram*, na kartě *Zobrazení › Panely › Histogram* nebo klávesami Ctrl+Shift+H. Výšku pruhu (výchozí 160 pixelů, v rozmezí 80 až 480 pixelů) nastavíte přetažením jeho okraje.

**Minimapa** — přehledová mapa časové osy. Výchozí: vypnuto. Kde: na kartě *Zobrazení › Prezentace › Minimapa*.

**Sbalení pásu karet** — kompaktní pás karet. Výchozí: vypnuto. Kde: šipka vpravo dole na pásu karet.

**Šířka tabulky úkolů** — výchozí 350 pixelů, v rozmezí 150 až 800 pixelů. Nastavíte ji přetažením dělicí čáry vedle tabulky, nebo klávesami šipka vlevo a šipka vpravo, když má dělicí čára fokus.

**Šířka pravého panelu** — výchozí 280 pixelů, v rozmezí 200 až 900 pixelů. Nastavíte ji přetažením okraje panelu.

**Výška sekcí *Vlastnosti* a *Upozornění* v pravém panelu** — výchozí 240 a 220 pixelů, v rozmezí 120 až 2000 pixelů. *Vlastnosti* mají tuto výšku, i když je otevřený seznam zdrojů. Výšku nastavíte úchytem přetažení mezi sekcemi. Aplikace si nepamatuje, zda jsou sekce otevřené, nebo zavřené.

**Další uložená nastavení, popsaná jinde** — sloupce tabulky ([Úprava sloupců tabulky](docs://howto-tabelkolommen-aanpassen)), vaše rozložení ([Vytvoření a použití rozložení](docs://howto-layouts-gebruiken)), možnosti sestavy ([Typy sestav](docs://ref-rapporttypes)), vaše vlastní šablony profilů výpočtu ([Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies)) a *Jazyk dokumentace* nápovědy (v nabídce *Soubor › Nápověda*) ukládá aplikace také v tomto zařízení, ne v souboru projektu.

## Viz také

- [Možnosti výpočtu a konvence](docs://ref-rekenopties-en-conventies): možnosti, které patří k projektu.
- [Zapnutí plánování v hodinách](docs://howto-urenplanning-aanzetten): postup pro přepínač *Zapnout plánování v hodinách*.
- [Dny a hodiny](docs://uitleg-dagen-en-uren): jak aplikace počítá dny a hodiny.
- [Pravidla pevné veličiny: doba trvání, jednotky přiřazení a práce](docs://uitleg-werkregels): co ukáže *Zobrazit pravidla pevné veličiny a práci*.
- [Klávesové zkratky](docs://ref-sneltoetsen): všechny klávesy aplikace, včetně těch pro přibližování a posouvání.
