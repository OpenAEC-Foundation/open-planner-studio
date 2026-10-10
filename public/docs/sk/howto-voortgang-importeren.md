# Import postupu z tabuľky

Cieľ: preniesť postup, ktorý zamestnanci na stavbe zapisujú do tabuľky, do plánu naraz, bez klikania na každú úlohu zvlášť.

## Kedy to potrebujete

Subdodávateľ alebo stavbyvedúci nemá aplikáciu, ale každý týždeň hlási svoj stav: koľko percent je hotových, kedy začal a kedy skončil. Pošlite mu tabuľku so svojimi úlohami. On vyplní tri stĺpce a pošle ju späť. Aplikácia z nej číta pri každej úlohe len tri hodnoty: percento dokončenia, skutočný začiatok a skutočné dokončenie. Zvyšok plánu zostane nezmenený. Čo aplikácia s týmto postupom robí, je vysvetlené v článku [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang).

## Kroky

### 1. Nastavte dátum kontroly stavu a prepočítajte

Nastavte dátum kontroly stavu podľa článku [Aktualizácia postupu](docs://howto-voortgang-bijwerken). Stavbyvedúci vyplní skutočné dátumy až do tohto dňa vrátane. Ak plán nie je prepočítaný, aplikácia ho pred vytvorením tabuľky prepočíta.

### 2. Vytvorte tabuľku

Vyberte *Plán › Postup › Exportovať tabuľku postupu*. Rovnaké tlačidlo je na kartách *Tabuľka* a *Zostava*. Aplikácia vytvorí súbor Excel a navrhne názov *(názov projektu)-voortgang.xlsx*. V prehliadači sa súbor uloží medzi vaše stiahnuté súbory. Radšej CSV? Vyberte *Súbor › Exportovať › Hárok postupu (CSV)*. Hárok Excel je tam tiež, ako *Hárok postupu (Excel)*.

Tabuľka má osem stĺpcov. Názvy stĺpcov zostávajú v angličtine a za nimi je krátky pokyn v jazyku aplikácie:

- `OPS Task ID`, `WBS` a `Name` slúžia len na rozpoznanie úlohy. Nemeňte ich.
- `Start` a `Finish` sú plánované dátumy, len na informáciu. Aplikácia ich nikdy nezapisuje späť.
- `Completion (%)`, `Actual Start` a `Actual Finish` sú stĺpce, ktoré vyplníte.

Hárok Excel je chránený bez hesla: upraviť sa dajú len tri stĺpce na vyplnenie. Excel kontroluje, že percento je medzi 0 a 100 a že skutočný dátum je dátum. Fáza (súhrnná úloha) je sivá a má označenie *— súhrnná úloha: nevypĺňajte*.

### 3. Nechajte tabuľku vyplniť

Pri každej úlohe stavbyvedúci vyplní:

- `Completion (%)`: od 0 do 100 vrátane. V hárku Excel sa smú zadať desatinné čísla (napríklad 33,3). V CSV pokyn žiada celé čísla.
- `Actual Start` a `Actual Finish`: v Exceli ako dátum podľa vášho regionálneho nastavenia; v CSV ako dd-mm-yyyy.

Čo zostane prázdne, sa nezmení. Prázdna bunka teda ani nevymaže existujúci postup. To sa dá urobiť len v aplikácii. Úlohu, ktorá sa ešte nezačala, nechá úplne prázdnu.

### 4. Načítajte tabuľku

1. Vyberte *Plán › Postup › Aktualizovať postup z tabuľky* (rovnako na kartách *Tabuľka* a *Zostava*), alebo *Súbor › Importovať › Aktualizovať postup z tabuľky*. Otvorí sa okno *Aktualizovať postup z tabuľky*.
2. Kliknite na *Vybrať súbor*… a vyberte vyplnený súbor `.xlsx` alebo `.csv`.
3. Ak sú dátumy v CSV nejednoznačné, aplikácia sa spýta *Najskôr deň alebo mesiac?* a ukáže dátum z vášho súboru načítaný dvoma spôsobmi. Kliknite na správny dátum.
4. Teraz vidíte náhľad. Hore sú štyri počítadlá: *Použité*, *Nezmenené*, *Čaká na prepojenie* a *Zamietnuté*. Pod nimi je pri každej úlohe vidieť, čo sa zmení, napríklad *Percento dokončenia: 0% → 100%*.
5. Skontrolujte náhľad a kliknite na *Použiť*. Okno zobrazí *Výsledok* s počítadlami a s riadkami, ktoré boli zamietnuté, a s dôvodom. Dokončite kliknutím na *Zavrieť*.

Náhľad nemôžete preskočiť. Tlačidlo *Použiť* je neaktívne, kým nie je čo použiť.

### 5. Prepočítajte plán

Samotné načítanie neprepočíta plán. Stlačte **Prepočítať** (F5), napríklad cez *Plán › Plán › Prepočítať*, pokiaľ nie je zapnutý *Automatický prepočet*.

## Riadky, ktoré nezapadajú hneď

Aplikácia prepojí každý riadok s úlohou. Najskôr podľa `OPS Task ID`, inak podľa čísla WBS.

**Prepojenie je pochybné.** Ak aplikácia úlohu našla len podľa čísla WBS, riadok je v zozname *Prepojenie je pochybné*, s tlačidlami *Potvrdiť* a *Zmeniť*. Riadok sa použije aj vtedy, ak nič neurobíte. Skontrolujte preto, či je úloha správna. *Potvrdiť* odstráni riadok z tohto zoznamu. Nič nemení na tom, čo sa použije. *Zmeniť* vám umožní vybrať inú úlohu. Pomocou *Zrušiť prepojenie* odstránite prepojenie, ktoré ste urobili sami. Pozor: tabuľka z iného projektu s rovnakými číslami WBS sa napriek tomu prepojí, v zozname *Prepojenie je pochybné*, a použije sa, keď kliknete na *Použiť*.

**Čaká na prepojenie.** Ak aplikácia nenašla žiadnu úlohu, alebo ich našla viac s rovnakým číslom WBS, riadok je v zozname *Čaká na prepojenie*. Pri *Vyberte úlohu*… vyberte správnu úlohu. Hľadáte podľa čísla WBS alebo názvu. Ak riadok neprepojíte, bude zamietnutý.

## Úskalia a čo aplikácia robí

Riadok, ktorý nezapadá, sa zamietne s dôvodom. Zvyšok tabuľky sa spracuje ďalej. Toto sú hlavné hlásenia:

- *Skutočný dátum je po dátume kontroly stavu*. Nastavte dátum kontroly stavu neskôr alebo opravte tabuľku.
- *Táto úloha sa podľa plánu začína až po dátume kontroly stavu. Najskôr v tabuľke vyplňte jej skutočný začiatok*. Aplikácia začiatok sama nevymyslí. Doplňte ho v tabuľke.
- *Percento je mimo rozsahu 0–100. Skontrolujte desatinnú čiarku: 8,38 môže tabuľkový procesor s iným jazykovým nastavením načítať ako 838*.
- *Súhrnné úlohy nemôžu dostať postup z tabuľky*. Postup fázy vyplýva z úloh pod ňou.
- *Skutočné dokončenie je pred skutočným začiatkom*.
- *Nečitateľný dátum* a *Nečitateľné percento*.
- *Zadané hodnoty si protirečia*. Napríklad skutočné dokončenie pri percente nižšom ako 100.
- *Pre tento riadok sa nenašla úloha*. Tabuľka uvádza ID úlohy a číslo WBS, ktoré sa v tomto projekte nenachádzajú.
- *Tento kód WBS sa vyskytuje pri viacerých úlohách. Riadok prepojte ručne*.
- *Iný riadok už túto úlohu prevzal*. Dva riadky ukazujú na tú istú úlohu.
- *Zamietnuté plánovačom*. Ďalšie zamietnutie zo strany samotného plánu, bez vlastného hlásenia.

Ak sa zamietne celý súbor, zobrazí sa v okne jedno z týchto hlásení: *Tento súbor nemá stĺpec „OPS Task ID“ ani „WBS“, ktorým by sa riadky prepojili s úlohami*; *Tento súbor nemá žiadny zo stĺpcov Percento dokončenia, Skutočný začiatok ani Skutočné dokončenie*; *Tento súbor je príliš veľký na čítanie ako tabuľka postupu* (viac ako 16 MB); *Tento súbor má príliš veľa riadkov na čítanie ako tabuľka postupu* (viac ako 50 000 riadkov); *Tento súbor je chránený heslom a nedá sa načítať*; alebo *Tento súbor sa nedal načítať ako tabuľka postupu*.

**Žiadny dátum kontroly stavu.** Ak ešte nie je nastavený dátum kontroly stavu a import použije postup, aplikácia ho nastaví na dnešný deň a oznámi vám to. Nastavte ho preto najskôr sami.

**Všetko naraz späť.** Celá tabuľka je jeden krok pre Ctrl+Z.

**Len to, čo vyplníte.** Riadok, ktorý sa od plánu nelíši, sa počíta ako *Nezmenené*. Úloha bez riadka v tabuľke zostane taká, aká bola.

## Pozri aj

- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): čo aplikácia počíta so skutočnými dátumami a percentami.
- [Aktualizácia postupu](docs://howto-voortgang-bijwerken): zadávanie postupu priamo v aplikácii.
