# Pás karet, karta po kartě

Pás karet nahoře na obrazovce má karty. Každá karta má skupiny tlačítek. Tento článek popisuje u každého tlačítka, co dělá a kde uvidíte výsledek. Jak postupovat krok za krokem, najdete v návodech. Tady zjistíte, co tlačítko dělá. Tlačítko, které existuje nebo funguje jen za určité podmínky, má tuto podmínku hned vedle.

## Chování pásu karet

- **Karty** — *Soubor* je vlevo, potom *Domů*, *Plán*, *Zdroje*, *Zobrazení*, *Nastavení*, *Tabulka*, *IFC*, *Sestava* a jen při zapnutém režimu AI také *AI*.
- **Úzké okno** — když se pás karet nevejde, tlačítka se zmenší na ikony zprava doleva. Název je potom v textu nápovědy na tlačítku. Každé tlačítko bez vlastního textu nápovědy ukáže svůj název.
- **Sbalit pás karet** — malá šipka vpravo dole na pásu karet ho změní na plochý proužek jen s ikonami. Skupina *Směrné plány a průběh* a skupina *Připojení* na kartě *AI* potom zmizí za jedno tlačítko s vyskakovacím oknem. Výchozí: rozbaleno. Vaše volba se zapamatuje.
- **Tlačítka rozšíření** — rozšíření může přidat vlastní skupinu za poslední skupinu karty. Takové tlačítko dělá to, co mu rozšíření přidalo.

## Soubor

Kliknutím na *Soubor* se otevře vlastní obrazovka (Backstage), která převezme celou pracovní plochu. Nemá pás karet. Tlačítko *Zpět* ji zavře. Pokud jste něco změnili v části *Info o projektu* a nepoužili jste to, aplikace se nejdřív zeptá, co s tím má udělat.

- **Vytvořit** — otevře okno *Nový projekt* a zavře Backstage. Pole najdete v článku [Nový projekt a Info o projektu](docs://ref-projectinfo).
- **Otevřít** — vybere soubor a otevře ho jako dokument. Zavře Backstage.
- **Nedávné** — seznam nedávno otevřených projektů. Kliknutím se otevře jeden z nich. Seznam je vidět jen tehdy, když prostředí umí soubory znovu otevřít: v desktopové aplikaci a v prohlížečích s přístupem k souborům, například Chrome a Edge. V jiných prohlížečích je tlačítko také vidět, ale stránka zůstane prázdná.
- **Příklady** — přiložené ukázkové plány, rozdělené na *Úplné ukázkové plány* (štítek *Všechny funkce*) a *Jednoduché příklady*. Kliknutím se jeden z nich otevře na nové kartě.
- **Uložit** — zapíše projekt do souboru tohoto dokumentu. Pokud dokument ještě nemá soubor, nejdřív zvolíte název a místo. Soubor, který jste otevřeli v jiném formátu než IFC, se nikdy nepřepíše. Tlačítko *Uložit* potom požádá o název a místo pro soubor IFC.
- **Uložit jako** — vybere nový název nebo místo a uloží tam projekt jako IFC.
- **Exportovat** — karty pro jednotlivé formáty exportu, každá s popisem. Kliknutím se projekt převede a uloží a vrátí vás na kartu *Domů*. Pokud plán obsahuje cyklus, chyba se zobrazí v Backstage a zůstanete tam. Pokud je projekt propojen s knihovnou zdrojů, pod kartami se objeví zaškrtávací políčko *Uložit soubor knihovny zdrojů vedle*. Funguje jen u karty IFC.
- **Importovat** — nahoře karta *Aktualizovat průběh z tabulky* (bez úkolů je nedostupná), pod ní importéry, které přidají rozšíření.
- **Tisknout** — tlačítko *Otevřít náhled tisku* vás přenese na kartu *Sestava*.
- **Info o projektu** — metadata a profil výpočtu tohoto projektu. Změny platí až po tlačítku *Použít*. Viz [Nový projekt a Info o projektu](docs://ref-projectinfo) a [Profily výpočtu a konvence](docs://uitleg-rekenprofielen).
- **Nastavení** — stejná nastavení jako v okně *Nastavení*.
- **Rozšíření** — správa a instalace rozšíření. Viz [Instalace a správa rozšíření](docs://howto-extensie-installeren).
- **Knihovna zdrojů** — správa knihoven zdrojů. Viz [Správa a sdílení knihoven zdrojů](docs://howto-bibliotheken-beheren).
- **Nápověda** — vestavěná dokumentace, také s klávesou F1. Vyhledávací pole hledá v názvech, nadpisech i přímo v textu. Články jsou ve čtyřech částech: *Kurzy*, *Návody*, *Vysvětlení* a *Reference*. Pod položkou *Jazyk dokumentace* zvolíte *Podle jazyka aplikace*, *Nederlands* nebo *English*. Nápověda existuje jen v nizozemštině a angličtině. Je-li aplikace v jiném jazyce, čtete anglickou verzi s upozorněním. Volba se uchová na tomto zařízení odděleně od jazyka aplikace. Nápovědu otevřete také z okna nebo panelu: mnoho oken a panelů *Vlastnosti*, *Zdroje* a *Varování* má v pravém horním rohu otazník (*Nápověda k této části*). Ten otevře nápovědu k článku o daném okně nebo panelu. Pokud jste v okně něco zadali a ještě to není uloženo, aplikace se nejdřív zeptá: *Uložit*, *Zrušit* (zahodit zadání) nebo *Zpět* (zůstat v okně). Potom se okno zavře a otevře se nápověda. Některá okna, například *Upravit úkol* a *Vyrovnání zdrojů*, se ptají vždy. Bez zadání se nápověda otevře hned.
- **Spustit prohlídku** — zavře Backstage a spustí prohlídku od kroku 1.
- **Zavřít projekt** — zavře aktivní dokument. Má-li neuložené změny, aplikace požádá o potvrzení.

## Domů

### Domů › Soubor

- **Vytvořit**, **Uložit**, **Otevřít** a **Uložit jako** — stejné akce jako na kartě *Soubor*.
- **Nedávné** — rozbalovací seznam nedávných projektů. Kliknutím se otevře jeden z nich. Je vidět za stejných podmínek jako *Soubor › Nedávné*. Bez nedávných souborů se zobrazí *Žádné nedávné soubory*.
- **Exportovat** — rozbalovací seznam formátů exportu (krátké názvy). Kliknutím se projekt převede a uloží.

### Domů › Úpravy

- **Vrátit zpět** — vrátí poslední změnu. Je nedostupné, když není co vrátit.
- **Znovu** — obnoví poslední vrácenou změnu. Je nedostupné, když není co obnovit.
- **Odstranit** — odstraní vybrané úkoly spolu s jejich dílčími úkoly jedním krokem. Bez výběru je nedostupné.

### Domů › Úkoly

- **Úkol** — přidá úkol s názvem *Nový úkol* a dobou trvání 5 pracovních dnů, který začíná v den zahájení projektu. (Je-li zapnutá volba *Zapnout plánování v hodinách* a *Výchozí jednotka pro nové úkoly* v *Info o projektu* je nastavena na hodiny, je doba trvání 5 hodin.) Je-li vybrán úkol a zobrazení je prostý strom, přidá se hned pod nejnižší vybraný úkol (text nápovědy *Nový úkol přímo pod výběrem*). Bez výběru se přidá dolů do seznamu (text nápovědy *Nový úkol na konci seznamu*). Je-li něco vybráno, ale probíhá filtrování, seskupování nebo řazení, přidá se také dolů a proužek zobrazí *Není k dispozici při filtrování, seskupování nebo řazení*. Nový úkol se stane jediným výběrem, diagram Gantt na něj přeskočí a jeho název můžete hned přepsat v panelu *Vlastnosti*.
- **Milník ▾** — rozbalovací seznam, který vloží milník (doba trvání 0) na stejné místo jako *Úkol*. *Milník zahájení* a *Milník dokončení* nastaví druh milníku. Nový milník se jmenuje *Nový milník* a dostane typ úkolu *Ostatní*. *Kontrolní milník (povinný)* vytvoří milník dokončení s typem úkolu *Kontrola/inspekce* a příznakem *Povinný (smluvní)*. Jmenuje se *Nový kontrolní bod*.
- **Propojit ▾** — rozbalovací seznam se čtyřmi pevnými akcemi. Hlavní tlačítko nikdy nezmění význam. Čtyři akce jsou popsány v části *Plán › Závislosti*.
- **Rozdělit úkol** — zapne nebo vypne režim rozdělení. Po zapnutí se pod pásem karet objeví proužek. Ten vysvětlí, že klikáte na pruh v místě, kde má mezera začít, a táhnete doprava podle délky mezery. Je nedostupné, když diagram Gantt není vidět, tedy na kartách *Tabulka*, *IFC* a *Sestava* a pod úplným panelem zdrojů. Text nápovědy potom říká *Dostupné jen tehdy, když je diagram Gantt vidět*. Viz [Rozdělení úkolu](docs://howto-taak-splitsen).

### Domů › Rozvrh

- **Přepočítat** — vypočítá plán: data, časové rezervy, kritickou cestu a vytížení zdrojů. To se nikdy nestane samo, pokud nezapnete *Automaticky přepočítat* (*Nastavení*, karta *Plán*, nadpis *Přepočítání*). Dokud je plán zastaralý, stavový řádek zobrazuje *Zastaralé — přepočítejte (F5)*.

### Domů › Měřítko

- **Přiblížit +** — přiblíží časovou osu o 10 pixelů na den.
- **Oddálit -** — oddálí časovou osu o 10 pixelů na den.

## Plán

### Plán › Rozvrh

Tlačítko *Přepočítat* je stejné jako na kartě *Domů*.

- **Přesunout projekt…** — otevře okno *Přesunout projekt*. Bez data zahájení projektu je nedostupné. Viz [Přesun projektu](docs://howto-project-verplaatsen).
- **Varování** — zobrazí nebo skryje panel *Varování* v pravém sloupci. Tlačítko svítí, dokud panel vidíte. Zapnutím se sbalený sloupec rozbalí. Co panel obsahuje, popisuje článek [Upozornění a varování](docs://ref-meldingen).

### Plán › Závislosti

Skupina obsahuje tlačítko *Propojit ▾* se čtyřmi akcemi a tlačítko *Rozdělit úkol* (stejné jako na kartě *Domů*). Čtyři akce jsou:

- **Nakreslit závislost** — zapne nebo vypne režim propojování. Když je zapnutý, objeví se zaškrtnutí a hlavní tlačítko svítí. Po zapnutí přetáhnete myší z jednoho pruhu na druhý v diagramu Gantt. Tím vznikne závislost. Pod pásem karet se zobrazí proužek s pokynem, jak režim ukončit (*Zastavit* nebo klávesa Esc). Je nedostupné, když diagram Gantt není vidět.
- **Propojit vybrané úkoly** — vytvoří závislost dokončení-zahájení bez prodlevy mezi dvěma úkoly. Úkol vybraný jako první se stane předchůdcem. Je dostupné jen při výběru přesně dvou úkolů, jinak se zobrazí *Vyberte přesně dva úkoly*. Duplicitní závislost nebo cyklus se odmítnou a zobrazí se hlášení.
- **Přidat vazbu mezi projekty…** — otevře okno, ve kterém k vybranému úkolu přidáte předchůdce nebo následníka z jiného projektu. Je dostupné jen při výběru přesně jednoho úkolu, jinak se zobrazí *Vyberte přesně jeden úkol*.
- **Obnovit všechny vazby mezi projekty** — obnoví kotvy všech vazeb mezi projekty. V nabídce ukáže, kolik vazeb bylo aktualizováno a kolik jich chybí. Je dostupné jen tehdy, když projekt vazby mezi projekty obsahuje, jinak se zobrazí *Tento projekt neobsahuje vazby mezi projekty*.

Princip závislostí popisují články [Vytváření závislostí](docs://howto-relaties-leggen) a [Závislosti a prodleva](docs://uitleg-relaties).

### Plán › Sledování cesty

- **Předchůdci** — zvýrazní v diagramu Gantt předchůdce vybraných úkolů, řetěz po řetězu.
- **Následníci** — zvýrazní následníky vybraných úkolů.

Můžete mít zapnuté obě strany současně. Druhé kliknutí na tlačítko tuto stranu zase vypne. Hnací vazby dostanou silnější odstín. Viz [Sledování cesty](docs://howto-pad-traceren).

### Plán › Kalendář

- **Kalendář** — otevře okno *Kalendáře* s knihovnou kalendářů projektu. Viz [Okna kalendářů](docs://ref-kalenders).

### Plán › Struktura

- **Kódy a pole** — otevře okno *Kódy a pole* pro kódy aktivit a vlastní pole. Viz [Kódy a vlastní pole](docs://howto-codes-en-velden).
- **WBS auto** — zapne nebo vypne automatické číslování kódů WBS. Výchozí: vypnuto. Zapnuto: celý strom se přečísluje najednou, kódy pak sledují každou změnu struktury. Pole *Kód WBS* v panelu i v okně je nedostupné.
- **Přečíslovat WBS** — přečísluje kódy WBS jednou podle pozice ve stromu (1.2.3). Je nedostupné, dokud je zapnuté *WBS auto*.
- **Šablony** — rozbalovací seznam uložených šablon WBS, u každé je počet úkolů a závislostí. Kliknutím se šablona vloží pod vybraný úkol, nebo bez výběru na nejvyšší úroveň. Ikona koše šablonu odstraní. Bez šablon se zobrazí, jak ji uložit: klikněte pravým tlačítkem na souhrnný úkol a zvolte *Uložit větev jako šablonu*. Viz [Ukládání a vkládání šablon WBS](docs://howto-wbs-sjablonen).
- **Zvětšit odsazení** — udělá z vybraných úkolů dílčí úkoly úkolu, který je před nimi. Je nedostupné bez výběru a jakmile filtrujete, seskupujete nebo řadíte. Text nápovědy potom říká *Není k dispozici při filtrování, seskupování nebo řazení*.
- **Zmenšit odsazení** — přesune vybrané úkoly o jednu úroveň výš, hned za jejich nadřazený úkol. Stejné podmínky jako u *Zvětšit odsazení*.

### Plán › Směrné plány a průběh

- **Spravovat směrné plány…** — otevře okno směrných plánů. Viz [Uložení a správa směrného plánu](docs://howto-baseline-opslaan-en-beheren).
- **Datum stavu** — datum, do kterého měříte průběh. Zadejte datum. Křížek (*Vymazat datum stavu*) ho odstraní. Účinek: průběh se měří do tohoto data a čára data stavu i čára průběhu v diagramu Gantt na něm leží. Viz [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang).
- **Režim průběhu** — volba mezi *Retained Logic* a *Progress Override*. Výchozí: *Retained Logic*. Účinek: u *Retained Logic* zbývající práce již začatého následníka sleduje závislost. U *Progress Override* zbývající práce začne v datu stavu, bez čekání na předchůdce. Viz [Volba režimu průběhu](docs://howto-voortgangsmodus-kiezen).

Na sbaleném pásu karet jsou tyto tři položky za jedním tlačítkem s příznakem *Směrné plány a průběh*.

### Plán › Průběh

- **Exportovat tabulku průběhu** — vytvoří list `.xlsx` s úkoly. Průběh se vyplní mimo aplikaci. Bez úkolů je nedostupné.
- **Aktualizovat průběh z tabulky** — otevře okno importu pro vrácenou tabulku. Bez úkolů je nedostupné. Viz [Import průběhu z tabulky](docs://howto-voortgang-importeren).

Tato skupina je také na kartách *Tabulka* a *Sestava*.

## Zdroje

### Zdroje › Správa

- **Zdroje** — otevře úplný panel zdrojů, který převezme celou pracovní plochu. Svítí, dokud tento panel vidíte. Viz [Panel zdrojů](docs://ref-resourcepaneel).
- **Ukotvit panel zdrojů** — ukotví kompaktní panel zdrojů do pravého sloupce vedle diagramu Gantt. Svítí, dokud je ukotvený panel vidět. Druhé kliknutí ho zavře. Ukotvený panel ukazuje jen název, barvu, varování při přetížení a *Maximální počet jednotek*. Je-li vybrán úkol, ukazuje jen zdroje těchto úkolů.
- **Vytvořit zdroj** — otevře úplný panel zdrojů s prázdným řádkem pro nový zdroj. Nic se nevytvoří, dokud nezadáte název. Když kliknete mimo řádek, nezůstane nic. Zdroj se podle zobrazení uloží do knihovny zdrojů nebo do projektu.

### Zdroje › Přiřazení

- **Přiřadit ▾** — přiřadí zdroj k vybranému úkolu. Je dostupné jen při výběru přesně jednoho úkolu, který je koncový a není milník. Jinak je tlačítko šedé. V nabídce nejdřív nastavíte *Jedn./den* (výchozí 1) a *Křivka* (výchozí *Rovnoměrné*). Kliknutím na zdroj ho přiřadíte s těmito hodnotami. Nabídka ukazuje jen zdroje, které na úkolu ještě nejsou. Viz [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen).

### Zdroje › Histogram

- **Histogram** — zobrazí nebo skryje proužek histogramu pod diagramem Gantt. Výchozí: vypnuto. Vaše volba se zapamatuje.
- **Předchozí** a **Další** — procházejí zdroje ve výběru proužku histogramu. Jako další krok v pořadí je *Všechny zdroje*. Jsou nedostupné, když je histogram vypnutý nebo projekt nemá zdroje.

### Zdroje › Vyrovnání

- **Vyrovnat…** — otevře okno *Vyrovnání zdrojů*. Viz [Vyrovnání](docs://uitleg-nivelleren).
- **Vymazat vyrovnání** — odstraní zpoždění a mezery, které vyrovnání přidalo. Je nedostupné, když žádný úkol nemá výsledek vyrovnání.

### Zdroje › Přetížení

- **Přetížení** — není to tlačítko, ale počítadlo: počet zdrojů s alespoň jedním přetíženým dnem, nebo *Žádné*. Jakmile je alespoň jeden, počítadlo je červené s ikonou varování. Počet se obnoví po kliknutí na *Přepočítat* a po změnách zdrojů a přiřazení. Když změníte data úkolů, počítá se to až po kliknutí na *Přepočítat*.

## Zobrazení

### Zobrazení › Časová osa

- **Zoom +** a **Zoom -** — přiblíží nebo oddálí časovou osu o 10 pixelů na den.
- **Resetovat** — nastaví zoom zpět na výchozí hodnotu 30 pixelů na den.
- **Přizpůsobit projektu** — přiblíží a posune tak, aby se celý projekt vešel do zobrazení.
- **Volba měřítka** — seznam s položkami *Rok*, *Čtvrtletí*, *Měsíc*, *Týden*, *Den* a *Hodina* (jen když je zapnuté *Zapnout plánování v hodinách*). Volba nastaví pevný zoom. Zobrazená hodnota odpovídá aktuálnímu zoomu. Pod ní se ukazuje tento zoom v pixelech na den.

### Zobrazení › Zobrazovací prvky

- **Sloupce…**, **Filtr…**, **Seskupit…** a **Řadit…** — viditelné jen tehdy, když je zapnuté *Zobrazit klasická tlačítka zobrazení* (*Nastavení*, karta *Pokročilé*, nadpis *Starší funkce*). Výchozí: vypnuto. *Sloupce…* vás přesune do zobrazení *Tabulka* a tam otevře výběr sloupců. *Filtr…* otevře okno filtru hned, pokud není uložený žádný filtr. Pokud uložené filtry existují, otevře nabídku s položkami *Filtr…*, *Vymazat* (jen když je filtr aktivní) a uloženými filtry. *Seskupit…* umožňuje dvě úrovně. *Řadit…* umožňuje více úrovní. Tlačítko se rozsvítí, když je dané nastavení zobrazení aktivní. V aktuálním pásu karet to děláte pomocí tlačítek rozložení; viz [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken).

### Zobrazení › Osnova

- **Sbalit** — sbalí vybrané souhrnné úkoly. Bez výběru sbalí všechny. V seskupeném zobrazení sbalí všechny skupiny a výběr nemá žádný účinek.
- **Rozbalit** — opak.

### Zobrazení › Rozložení

- **Tlačítka rozložení** — každé rozložení je přepínač s ikonou a názvem. Zahrnuje *Diagram zdrojů*. Jedno kliknutí rozložení zapne. Další kliknutí ho vypne a vrátí zobrazení, které bylo před kliknutím. Rozložení s různými částmi lze zapnout najednou. Klikněte pravým tlačítkem na rozložení: *Upravit…*, *Duplikovat* a *Odstranit* (po potvrzení). Zahrnuté rozložení lze pouze duplikovat.
- **Vytvořit rozložení** — otevře okno rozložení pro nové rozložení.

### Zobrazení › Prezentace

- **Prezentace** — zapne nebo vypne režim prezentace (ukončíte klávesou F11 nebo Esc): jen Gantt vyplní celou obrazovku. Viz [Prezentování na velké obrazovce](docs://howto-presentatie).
- **Rozdělené zobrazení** — rozdělí Gantt na dvě časová okna. Obě začínají s vaším aktuálním zoomem a pozicí (rozdělení 50 procent). Nebo se Gantt zase sloučí do jednoho okna. Výchozí: vypnuto. Viz [Rozdělené zobrazení a minimapa](docs://howto-split-view-en-mini-map).
- **Minimapa** — zobrazí nebo skryje minimapu. Výchozí: vypnuto. Vaše volba se zapamatuje.

### Zobrazení › Panely

- **Vlastnosti** — zobrazí nebo skryje panel *Vlastnosti* v pravé části obrazovky. Výchozí: zapnuto. Viz [Dialog úkolu a panel vlastností](docs://ref-taak-eigenschappen).

Tlačítka *Zdroje*, *Ukotvit zdroje* a *Histogram* jsou stejná jako na kartě *Zdroje*, a *Varování* je stejné jako na kartě *Plán*.

### Zobrazení › Směrné plány a průběh

Tato skupina má stejný název jako skupina na kartě *Plán*, ale drží možnosti kreslení Ganttu.

- **Překryv směrného plánu** — zobrazí aktivní směrný plán jako tenký pruh pod každým pruhem úkolu. Výchozí: zapnuto. Bez aktivního směrného plánu nic nevidíte.
- **Čára průběhu** — nakreslí čáru na datu stavu. Čára se u každého úkolu vyboulí podle jeho průběhu. Výchozí: zapnuto. Bez data stavu nic nevidíte. Když je čára průběhu zapnutá, je zároveň značkou data stavu.
- **Čára data stavu** — nakreslí přerušovanou čáru na datu stavu. Výchozí: zapnuto. Vidíte ji jen tehdy, když je čára průběhu vypnutá, protože jinak ji nahrazuje. Popisek s datem v záhlaví zůstane, dokud je zapnutá alespoň jedna z obou čar.
- **Barvy pruhů** — vybere, jak se pruhy barví: *Kritická cesta* (výchozí), *Podle úkolu — automaticky* nebo *Podle kategorie* s volbou pole. Pokud toto pole v projektu není, nabídka uvede, že se dočasně používá *Typ úkolu*. Pokud není zvolena volba *Kritická cesta*, označuje červený obrys kritickou cestu. Volba platí i pro sestavu.
- **Akcent zdroje** — nakreslí tenký proužek v barvě zdroje pod každým pruhem úkolu bez podúkolů. Proužek se rozdělí podle jednotek přiřazení za den. Výchozí: vypnuto.
- **Pásmo časové rezervy** — nakreslí zelené pásmo za nekritickým pruhem až do pozdního dokončení úkolu. Výchozí: zapnuto.
- **Čáry závislostí** — zobrazí nebo skryje čáry závislostí mezi úkoly. Výchozí: zapnuto. Volba patří k dokumentu a k rozložení.

## Nastavení

### Nastavení › Projekt

- **Info o projektu** — otevře okno *Info o projektu*: metadata projektu a v části *Profil výpočtu a možnosti výpočtu* i to, jak projekt počítá. Viz [Nový projekt a info o projektu](docs://ref-projectinfo).
- **Nastavení** — otevře okno *Nastavení* s kartami *Zobrazení*, *Plán* a *Pokročilé*. Stejná nastavení jsou na kartě *Soubor › Nastavení*.

### Nastavení › Kalendář

Tlačítko *Kalendář* je stejné jako na kartě *Plán*.

### Nastavení › Klávesové zkratky

- **Klávesové zkratky** — otevře okno *Klávesové zkratky*.

## Tabulka

Karta *Tabulka* zobrazuje úkoly jako úplnou tabulku místo Ganttu. Skupiny *Soubor*, *Upravit*, *Úkoly*, *Plán* a *Sledování cesty* jsou stejné jako na kartách *Domů* a *Plán* a působí na stejný výběr. Skupina *Zoom* tu není, protože zoom jen mění měřítko časové osy Ganttu. Tlačítka *Rozdělit úkol* a *Nakreslit závislost* jsou tu nedostupná, protože není Gantt.

### Tabulka › Sloupce

- **Sloupce…** — otevře výběr sloupců této tabulky. Stejný výběr se otevře plusem v záhlaví tabulky. Popisek říká *Vyberte sloupce zobrazení Tabulka*. Viz [Úprava sloupců tabulky](docs://howto-tabelkolommen-aanpassen) a [Sloupce tabulky](docs://ref-tabelkolommen).

## IFC

Karta zobrazuje panel IFC v pracovní ploše. Pás karet tu nemá žádná tlačítka, jen řádek textu *IFC 4x3 - Industry Foundation Classes*.

## Sestava

### Sestava › Sestava

- **Tisknout** — jen na této kartě, kde nic neudělá, protože *Sestava* je už otevřená. Volby sestavy jsou na obrazovce sestavy.

## AI

Karta *AI* existuje jen tehdy, když je zapnuté *Zapnout režim AI* (*Nastavení*, karta *Pokročilé*, nadpis *Režim AI*). Výchozí: vypnuto. Vypnutím se karta odstraní a most se zastaví. AI asistent pracuje s vaším plánem přes most MCP, který tady spustíte. Viz [Připojení AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Server

- **Spustit most** a **Zastavit most** — spustí nebo zastaví most MCP. Vedle něj je stav: *Vypnuto*, *Běží na portu …*, *Port … je obsazen* (s důvodem) nebo *Chyba*. V webové verzi je nedostupné. Popisek říká *Most funguje pouze v desktopové aplikaci.* Stejný stav se ukazuje jako tečka s *AI* ve stavovém řádku.

### AI › Připojení

- **Port** — port mostu. Výchozí: 3877. Lze ho upravit jen tehdy, když je stav *Vypnuto* (popisek *Lze změnit pouze při zastaveném serveru.*).
- **Token** — heslo mostu, zobrazené jako skryté. Malá tlačítka *Zobrazit token* / *Skrýt token*, *Kopírovat* a *Nový token*. *Nový token* se nejdřív ptá na potvrzení, protože nový token přeruší všechna stávající připojení. Pokud most běží, restartuje se s novým tokenem.
- **Připojit** — zobrazí podrobnosti připojení: koncový bod (endpoint), token, úryvek konfigurace a výzvu pro připojení, kterou vložíte do svého AI agenta.

### AI › Bezpečnost

- **Pozastavit** / **Obnovit** — dočasně odmítne všechny změny od AI. Čtení zůstává povoleno a most zůstává aktivní. Tlačítko se při pozastavení rozsvítí červeně.
- **Jen pro čtení** — odmítne všechny nástroje, které mění data, dokud je to zapnuté.
- **Automatická záloha: zapnuto** / **Automatická záloha: vypnuto** — automaticky zapíše zálohu IFC před první změnou od AI u každého dokumentu. Výchozí: zapnuto.
- **Zálohovat hned** — zapíše zálohu okamžitě a oznámí název souboru. Jen desktopová aplikace.
- **Otevřít složku záloh** — otevře složku se zálohami. Jen desktopová aplikace.

### AI › Činnost

- **Panel činnosti** — zobrazí nebo skryje panel *Činnost AI* s voláními mostu, jejich argumenty a odpověďmi.
