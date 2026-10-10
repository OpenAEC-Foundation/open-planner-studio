# Nastavenia

Každé nastavenie aplikácie: čo robí, jeho počiatočná hodnota, čo sa mení a kde ho nájdete. Pre možnosti výpočtu projektu (profil výpočtu, definícia kritickej úlohy) pozrite [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): tie patria do súboru projektu, nie do aplikácie.

## Kde ich nájdete a ako fungujú

Panel nastavení je na troch miestach. Všade je to ten istý panel: ozubené koliesko v hornej časti okna, *Nastavenia › Projekt › Nastavenia* a *Súbor › Nastavenia*. Panel má tri karty: *Vzhľad*, *Plán* a *Rozšírené*. Každé nastavenie nižšie uvádza iba kartu.

Zmena sa prejaví okamžite. Nie je tu tlačidlo *Použiť* ani *Zrušiť*.

**Pre celú aplikáciu, nie pre jednotlivé projekty.** Všetky nastavenia v tomto článku platia pre všetky vaše projekty a patria tomuto zariadeniu. Aplikácia ich ukladá do úložiska aplikácie alebo vášho prehliadača, nie do súboru projektu. Keď iná osoba otvorí váš súbor, uvidí svoje vlastné nastavenia. Ak vymažete úložisko prehliadača, nastavenia sa vrátia na počiatočné hodnoty.

## Karta Vzhľad

**Motív** — farebná schéma rozhrania. Vyberte z možností *Tmavý*, *Svetlý* a *Vysoký kontrast*. Predvolené: *Tmavý*. Účinok: farby celého rozhrania, vrátane časovej osi Gantt a histogramu. Kde: v karte *Vzhľad*.

**Sledovať systémový motív** — nechá rozhodnúť farebnú schému vášho operačného systému. Predvolené: vypnuté. Účinok: aplikácia je *Svetlý* alebo *Tmavý*, podľa vášho systému; tri karty motívov sa potom vypnú. *Vysoký kontrast* sa podľa systému nemení. Vyberte ho sami. Ak to vypnete, zostane motív, ktorý bol práve na obrazovke. Kde: v karte *Vzhľad*, v riadku *Motív*.

**Jazyk** — jazyk rozhrania. Predvolené: jazyk vášho prehliadača alebo systému, ak ho aplikácia pozná, inak angličtina. Účinok: všetky texty v aplikácii. Štrnásť jazykov je zoradených podľa krátkeho kódu. Arabčina a perzština zrkadlia rozhranie sprava doľava. Jazyk článkov Pomocníka nastavíte osobitne. Nájdete ho v riadku *Jazyk dokumentácie* v *Súbor › Pomocník*. Kde: v karte *Vzhľad*.

**Písmo** — písmo celého rozhrania. Vyberte z možností *Predvolené*, *Systémové*, *Patkové* a *Monospace*. Predvolené: *Predvolené*. Účinok: nadpisy a text v okne a text v diagrame Gantt a v histograme. Webová aplikácia sama nepreberá systémové písmo. Preto ho vyberiete tu. Kde: v karte *Vzhľad*.

**Veľkosť textu** — mierka rozhrania. Vyberte z možností 90%, 100%, 110% a 125%. Predvolené: 100%. Účinok: text a rozloženie pása s nástrojmi, panelov a dialógov sa zväčšia alebo zmenšia. Výška riadkov tabuľky a diagramu Gantt sa mení spolu s nimi. Vyššiu hodnotu ako 125% nemôžete vybrať, pretože popisy tlačidiel v páse s nástrojmi sa potom zalomia na viac riadkov. Kde: v karte *Vzhľad*.

**Formát dátumu** — spôsob zobrazenia dátumov v aplikácii. Vyberte z možností *dd.mm.rrrr*, *mm-dd-rrrr* a *rrrr-mm-dd*. Predvolené: *dd.mm.rrrr*. Účinok: dátumy v tabuľke, v dialógoch, v zostavách a pri tlači. Súbory a výpočty sa nemenia, mení sa iba zobrazenie. Kde: v karte *Vzhľad*.

**Zobrazenie trvania** — v akej jednotke sa zobrazí trvanie úlohy. Vyberte z možností *Automaticky (vlastná jednotka každej úlohy)*, *Vždy dni* a *Vždy hodiny*. Predvolené: *Automaticky (vlastná jednotka každej úlohy)*. Účinok: v tabuľke úloh, v popiskoch pruhov v diagrame Gantt, v popise pri kurzore, pri tlači a v zostavách. Pri nastavení *Automaticky* úloha v dňoch zobrazí dni a hodinová úloha zobrazí hodiny. Pri nastavení *Vždy dni* alebo *Vždy hodiny* aplikácia premení údaje podľa počtu hodín na deň v kalendári úlohy. Ak sa jednotka úlohy líši, pridá jej vlastnú jednotku v zátvorke, napríklad `2.25d(18h)`. Mení sa iba zobrazenie. Úloha si zachová svoju jednotku. Kde: v karte *Vzhľad*.

**Štýl prepínania projektov** — ako prepínate medzi otvorenými projektmi. Vyberte z možností *Horizontálne karty*, *Vertikálne karty* a *Pilulka*. Predvolené: *Horizontálne karty*. Účinok: *Horizontálne karty* umiestnia lištu kariet pod pás s nástrojmi. *Vertikálne karty* umiestnia projektovú lištu vľavo. *Pilulka* zobrazí malé tlačidlo projektu v paneli s názvom. Kde: v karte *Vzhľad*.

### Časť Gantt

**Zobrazovať iba pracovné dni** — zhusťuje časovú os. Predvolené: vypnuté. Účinok: víkendy a sviatky z kalendára projektu sa preskočia. Úloha s 5 pracovnými dňami je tak presne 5 dní široká. Príkazy *Prejsť na dnešný deň* a *Prispôsobiť projektu* potom tiež počítajú v pracovných dňoch. Zostava má vlastné začiarkavacie políčko s rovnakým názvom. To nezávisí od tohto nastavenia. Kde: v karte *Vzhľad*, v časti *Gantt › Časová os*.

**Zobrazovať štvrťhodiny pri veľkom priblížení** — jemnejšia časová škála. Predvolené: vypnuté. Účinok: môžete priblížiť ešte viac a stupnica hodín dostane ďalší riadok so štvrťhodinami. Ťahanie hodinového pruhu sa potom môže prichytiť na štvrťhodiny namiesto celých hodín. Toto uvidíte iba vtedy, keď je zapnuté nastavenie *Zapnúť plánovanie v hodinách*. Kde: v karte *Vzhľad*, v časti *Gantt › Zoom po štvrťhodinách*.

**Pruhy úloh pri prestávkach** — či sa hodinová úloha kreslí v blokoch. Vyberte z možností *Nikdy nerozdeľovať*, *Rozdeliť pri výbere* a *Vždy rozdeliť*. Predvolené: *Rozdeliť pri výbere*. Účinok: pruh hodinovej úlohy sa potom kreslí po pracovných blokoch namiesto jedného súvislého bloku. *Rozdeliť pri výbere* to robí iba pre vybranú úlohu. Týka sa iba hodinových úloh. Skutočne rozdelená úloha (pomocou *Rozdeliť úlohu*) zobrazuje svoju prestávku bez ohľadu na toto nastavenie. Kde: v karte *Vzhľad*, v časti *Gantt*.

**Posúvanie a zoom › Režim** — čo robí koliesko myši nad diagramom Gantt. Vyberte z možností *Poloha*, *Klávesy* a *Zoom + ťahanie*. Predvolené: *Zoom + ťahanie*. Účinok: pri režime *Zoom + ťahanie* koliesko priblíži okolo kurzora. Shift + koliesko posúva riadky. Časovú os posuniete ťahaním pozadia. Ctrl + ťahanie (Cmd na Macu) nakreslí výberový rámček. Pri režime *Poloha* závisí funkcia kolieska od toho, kde je kurzor. Ctrl + koliesko vždy priblíži a Shift + koliesko vždy posúva vodorovne. Pri režime *Klávesy* si sami vyberiete, ktorá klávesa čo robí. Toto nastavenie platí aj pre druhú časovú os v rozdelenom zobrazení. Kde: v karte *Vzhľad*, v časti *Gantt › Posúvanie a zoom*.

**Posúvanie a zoom › Rozdelenie obrazovky** — kde musí byť kurzor, aby sa použila daná funkcia. Viditeľné iba pri režime *Poloha*. Vyberte z možností *Vľavo/vpravo*, *Hore/dole* a *Pravý horný roh*. Predvolené: *Vľavo/vpravo*. Účinok: pri nastavení *Vľavo/vpravo* koliesko posúva zvislo nad ľavou polovicou a vodorovne nad pravou polovicou. Pri nastavení *Hore/dole* koliesko posúva vodorovne v hornej 30% (pri časovej škále) a zvislo pod ňou. Pri nastavení *Pravý horný roh* koliesko posúva vodorovne v pravom hornom kvadrante a zvislo vo zvyšku. Kde: v karte *Vzhľad*, v časti *Gantt › Posúvanie a zoom*.

**Posúvanie a zoom › Vertikálne, Horizontálne, Priblíženie** — ktorá klávesa patrí ku ktorej funkcii kolieska. Viditeľné iba pri režime *Klávesy*. Pri každej funkcii vyberte z možností *Posúvanie*, *Ctrl + posúvanie* alebo *Shift + posúvanie*. Predvolené: *Vertikálne* je *Posúvanie*, *Priblíženie* je *Ctrl + posúvanie* a *Horizontálne* je *Shift + posúvanie*. Účinok: ak vyberiete kláves, ktorý už používa iná funkcia, vymení sa s ňou. Kde: v karte *Vzhľad*, v časti *Gantt › Posúvanie a zoom*.

## Karta Plán

**Zapnúť režim stavby** — východiskové hodnoty pre nové projekty, zamerané na stavbu. Predvolené: zapnuté. Účinok: zapnuté dá novému projektu kalendár *Bouwkalender NL* s holandskými štátnymi sviatkami. Umožní vybrať stavebný sviatok pri generovaní sviatkov. Ponúkne šablóny fázovania *Bytová výstavba* a *Nebytová výstavba / rekonštrukcia* a novým úlohám dá typ úlohy *Stavba*. Vypnuté dá kalendár *Standaardkalender* bez sviatkov, iba šablónu *Prázdny* a typ úlohy *Iné*. Nová úloha pod nadradenou úlohou, ktorá má typ úlohy, najprv prevezme tento typ. Až potom sa použije *Stavba* alebo *Iné*. Existujúce úlohy a kalendáre sa nemenia. Kde: v karte *Plán*.

**Zapnúť plánovanie v hodinách** — plánovanie v pracovných hodinách popri pracovných dňoch. Predvolené: vypnuté. Účinok: v *Zobrazenie › Časová škála* pribudne časová škála *Hodina*. V okne *Kalendáre* pribudne blok *Pracovná doba*. V okne *Nový projekt* pribudnú voľby *Pracovná zmena* a *Predvolená jednotka pre nové úlohy*. *Info o projekte* dostane tiež voľbu *Predvolená jednotka pre nové úlohy*. Keď je vypnuté, aplikácia pracuje po dňoch. Úlohy, ktoré už sú v hodinách, zostanú a zahrnú sa do výpočtu. Ich trvanie môžete upraviť až po zapnutí plánovania v hodinách. Kde: v karte *Plán*, v časti *Plánovanie v hodinách*. Pozrite si [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten).

**Povoliť zmiešané plánovanie dní a hodín** — či môžete jednotku vybrať pre každú úlohu. Viditeľné iba vtedy, keď je zapnuté nastavenie *Zapnúť plánovanie v hodinách*. Predvolené: zapnuté. Účinok: zapnuté zobrazí pri trvaní každej úlohy rozbaľovací zoznam *Jednotka trvania*. Vypnuté ho skryje. Kde: v karte *Plán*, v časti *Plánovanie v hodinách*. Pozrite si [Dni a hodiny](docs://uitleg-dagen-en-uren).

**Prvý deň týždňa** — s ktorým dňom sa týždeň začína. Vyberte z možností *Pondelok* a *Nedeľa*. Predvolené: *Pondelok*. Účinok: rozloženie týždňov a čísla týždňov na časovej škále v diagrame Gantt a v zostavách (tlač diagramu Gantt) a poradie dní v týždni v okne *Kalendáre*. Kde: v karte *Plán*.

**Automatický prepočet** — prepočíta plán hneď, ako nie je aktuálny. Predvolené: vypnuté. Účinok: vypnuté znamená, že *Prepočítať* (F5) stlačíte sami. Zapnuté spôsobí, že aplikácia prepočíta plán do zlomku sekundy po zmene úloh, závislostí alebo kalendára. Počas ťahania alebo písania do poľa aplikácia čaká a prepočíta raz, keď skončíte. Po neúspešnom prepočte sa znova prepočíta až vtedy, keď niečo zmeníte. Kde: v karte *Plán*, v časti *Prepočítanie*.

**Zobraziť pravidlá práce a prácu** — polia pravidla práce a práce v aplikácii. Predvolené: vypnuté. Účinok: zapnuté zobrazí pole *Pravidlo práce* pri úlohe a stĺpec práce pri priradeniach. Zapnuté tiež sprístupní stĺpec tabuľky *Pravidlo práce*. Vypnuté ich skryje. Trvanie a jednotky priradenia zostanú a práca sa podľa nich prispôsobí. Projekt, ktorý už obsahuje údaje o pravidle práce alebo o práci, napríklad zo súboru `.mpp` alebo `.xer`, ich vždy zobrazí, aj keď je nastavenie vypnuté. Kde: v karte *Plán*, v časti *Prepočítanie*. Pozrite si [Pravidlá práce: trvanie, jednotky a práca](docs://uitleg-werkregels).

## Karta Rozšírené

**Zapnúť režim AI** — umožní AI asistentovi pracovať s vaším plánom. Predvolené: vypnuté. Účinok: zapnuté zobrazí kartu *AI* s mostom MCP. AI asistent tak môže pracovať s vaším plánom cez Model Context Protocol. Vypnuté skryje kartu a zastaví most. Kde: v karte *Rozšírené*, v časti *Režim AI*. Pozrite si [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

**Spustiť most automaticky** — spustí most MCP pri spustení aplikácie. Dá sa zapnúť iba vtedy, keď je zapnuté nastavenie *Zapnúť režim AI*. Predvolené: vypnuté. Účinok: most je hneď aktívny, takže sa AI klient môže pripojiť bez toho, aby ste najprv otvorili kartu *AI*. Toto funguje iba v desktopovej aplikácii a iba raz pri každom spustení. Ak most potom vypnete sami, znova sa nespustí. Kde: v karte *Rozšírené*, v časti *Režim AI*.

**Zapnúť ladiaci terminál** — panel protokolu na riešenie problémov. Predvolené: vypnuté. Účinok: zapnuté pridá do stavového riadku tlačidlo terminálu, ktoré zobrazí alebo skryje panel protokolu. Vypnuté panel zavrie. Kde: v karte *Rozšírené*, v časti *Ladiaci terminál*.

**Benchmark…** — meria výkon plánovacieho motora. Účinok: otvorí okno. V ňom si nechajte vygenerovať testovací plán zvolenej veľkosti a zmerať hlavné fázy. Váš otvorený projekt zostane nedotknutý. Je to tlačidlo, nie nastavenie: nič sa neukladá. Kde: v karte *Rozšírené*, v časti *Benchmark*.

**Otvoriť štatistiky…** — koľkokrát sa aplikácia stiahla. Účinok: otvorí okno *Štatistiky sťahovania* s verejnými číslami z GitHub Releases. Od vás sa nič nezbiera. Je to tlačidlo, nie nastavenie. Kde: v karte *Rozšírené*, v časti *Štatistiky*. V okne:

- *Sťahovania podľa operačného systému* — pri každom systéme stĺpce *Sťahovania*, *Inštalátory* (to, čo človek stiahne) a *Aktualizácie* (to, čo stiahne aktualizátor v aplikácii), so súčtom *Celkom*. Na Linuxe sa tieto dva nedajú oddeliť. Aktualizátor stiahne ten istý súbor `.deb`, `.rpm` alebo `.AppImage`, ktorý ľudia sťahujú aj ručne. Preto sa tam ako inštalátor počíta iba súbor snap. Pod tým je *Kontroly aktualizácií z aplikácie*: koľkokrát aktualizátor v nainštalovanej aplikácii stiahol z GitHubu súbor s verziou, aby hľadal novú verziu. Sú to kontroly, nie inštalácie.
- *Podľa vydania* — tie isté sťahovania podľa verzie, s dátumom. Najprv šesť najnovších. Pre zvyšok použite *Zobraziť všetky vydania (…)*.
- *Zdroj* — dátum údajov (GitHub Releases, aktualizované každý týždeň) a *Obnoviť teraz*. Aplikácia drží načítané údaje pol hodiny. Ak načítanie zlyhá, okno to oznámi. Inštalácie cez Snap Store nejdú cez GitHub, a preto v údajoch chýbajú.

**Spustiť prehliadku** — úvodná prehliadka znova. Účinok: zavrie okno nastavení a spustí prehliadku od prvého kroku. Kde: v karte *Rozšírené*, v časti *Prehliadka*.

**Verzia** — číslo verzie aplikácie, s dvoma tlačidlami. *Skontrolovať aktualizácie* otvorí okno aktualizácií. *Čo je nové* zobrazí novinky aktuálnej verzie. Kde: v karte *Rozšírené*, v časti *Verzia*.

**Zobraziť klasické tlačidlá zobrazenia** — nahradená funkcia v časti *Staré funkcie*. Predvolené: vypnuté. Účinok: zapnuté vráti skupinu *Zobrazenie* na kartu *Zobrazenie* s osobitnými tlačidlami *Stĺpce…*, *Filtrovať…*, *Zoskupiť…* a *Triediť…*. Tie boli nahradené znamienkom plus v hlavičke tabuľky, tlačidlami rozloženia a oknom rozloženia. Kde: v karte *Rozšírené*, v časti *Staré funkcie*.

## Uložené voľby zobrazenia mimo panela

Aplikácia tiež uchováva tieto voľby na tomto zariadení. Nastavíte ich však priamo pri danej položke, nie v paneli nastavení.

**Prekrytie smerného plánu** — aktívny pôvodný plán ako tenký pruh pod pruhom úlohy. Predvolené: zapnuté. Kde: *Zobrazenie › Smerné plány a postup › Prekrytie smerného plánu*.

**Čiara postupu** — kľukatá čiara postupu, ktorá označuje dátum kontroly stavu. Predvolené: zapnuté. Účinok: čiara sa zobrazí, len ak má projekt dátum kontroly stavu. Potom nahradí samostatnú čiaru dátumu kontroly stavu. Kde: *Zobrazenie › Smerné plány a postup › Čiara postupu*.

**Čiara dátumu kontroly stavu** — bodkovaná čiara, ktorá označuje dátum kontroly stavu. Predvolené: zapnuté. Účinok: ak je zapnutá čiara postupu, ona sama kreslí označenie. Kde: *Zobrazenie › Smerné plány a postup › Čiara dátumu kontroly stavu*.

**Zvýraznenie zdrojov** — tenký pásik vo farbe zdroja pod pruhom úlohy. Predvolené: vypnuté. Kde: *Zobrazenie › Smerné plány a postup › Zvýraznenie zdrojov*.

**Pás časovej rezervy** — časová rezerva ako pás za pruhmi úloh, ktoré nie sú kritické. Predvolené: zapnuté. Kde: *Zobrazenie › Smerné plány a postup › Pás časovej rezervy*.

**Farby pruhov** — od čoho závisí farba pruhu. Vyberte jednu z možností *Kritická cesta*, *Podľa úlohy — automaticky* a *Podľa kategórie*. Predvolené: *Kritická cesta*. Účinok: platí súčasne pre diagram Gantt a zostavu. Kde: *Zobrazenie › Smerné plány a postup › Farby pruhov*.

**Histogram** — lišta histogramu pod diagramom Gantt. Predvolené: vypnuté. Kde: *Zdroje › Histogram › Histogram*, *Zobrazenie › Panely › Histogram* alebo Ctrl+Shift+H. Výšku lišty nastavíte ťahaním jej okraja. Predvolená výška je 160 pixelov, v rozsahu od 80 do 480.

**Mini-mapa** — prehľadová mapa časovej osi. Predvolené: vypnuté. Kde: *Zobrazenie › Prezentácia › Mini-mapa*.

**Zbaliť pás s nástrojmi** — kompaktný pás s nástrojmi. Predvolené: vypnuté. Kde: tlačidlo so šípkou v pravom dolnom rohu pásu s nástrojmi.

**Šírka tabuľky úloh** — predvolená šírka je 350 pixelov, v rozsahu od 150 do 800. Nastavíte ju ťahaním deliacej čiary vedľa tabuľky. Môžete tiež použiť šípku doľava a šípku doprava, keď je deliaca čiara aktívna.

**Šírka pravého panela** — predvolená šírka je 280 pixelov, v rozsahu od 200 do 900. Nastavíte ju ťahaním okraja panela.

**Výška *Vlastnosti* a *Upozornenia* v pravom paneli** — predvolená výška je 240 a 220 pixelov, v rozsahu od 120 do 2000. *Vlastnosti* majú túto výšku aj vtedy, keď je otvorený zoznam zdrojov. Výšku nastavíte ťahaním úchytu medzi sekciami. Aplikácia si nepamätá, či sú sekcie otvorené alebo zatvorené.

**Ďalšie hodnoty, ktoré sa uchovávajú, sú popísané inde** — stĺpce tabuľky úloh ([Úprava stĺpcov tabuľky úloh](docs://howto-tabelkolommen-aanpassen)), vaše rozloženia ([Vytvorenie a používanie rozloženia](docs://howto-layouts-gebruiken)), možnosti zostavy ([Typy zostáv](docs://ref-rapporttypes)), vaše vlastné šablóny profilu výpočtu ([Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies)) a *Jazyk dokumentácie* pomocníka (*Súbor › Pomocník*). Aplikácia uchováva aj tieto hodnoty na tomto zariadení. Nie sú súčasťou súboru projektu.

## Pozri tiež

- [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): možnosti, ktoré patria k projektu.
- [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten): kroky pre prepínač *Zapnúť plánovanie v hodinách*.
- [Dni a hodiny](docs://uitleg-dagen-en-uren): ako aplikácia počíta dni a hodiny.
- [Pravidlá práce: trvanie, jednotky priradenia a práca](docs://uitleg-werkregels): čo zobrazuje možnosť *Zobraziť pravidla práce a prácu*.
- [Klávesové skratky](docs://ref-sneltoetsen): všetky klávesy aplikácie, vrátane klávesov na priblíženie a posúvanie.
