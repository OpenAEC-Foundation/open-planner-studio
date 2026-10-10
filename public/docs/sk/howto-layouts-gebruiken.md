# Vytvorenie a používanie rozloženia

Cieľ: prepínať medzi zobrazeniami plánu jedným kliknutím, napríklad len kritické úlohy, úlohy podľa pracovnej čaty alebo iné poradie triedenia.

## Kedy to potrebujete

Na stretnutí na stavbe chce klient vidieť iba kritické úlohy. Potom chce vedúci stavby vidieť podľa pracovnej čaty, kto je kedy potrebný. Potom chcete znova celý plán. Opakovane nastavovať filtre, skupiny a poradie triedenia je zdĺhavé. **Rozloženie** uloží takéto zobrazenie ako tlačidlo na páse s nástrojmi.

Rozloženie môže uložiť šesť vecí: filter, zoskupenie, triedenie, stĺpce tabuľky úloh vedľa diagramu Gantt, časovú škálu a čiary závislostí a prekrytia (pôvodný plán, čiaru postupu, čiaru dátumu kontroly stavu, zvýraznenie zdrojov, pruh časovej rezervy a farby pruhov). Pri kliknutí na tlačidlo sa zmení iba to, čo zaškrtnete. Zvyšok zobrazenia zostane nezmenený.

Filter, zoskupenie a triedenie nastavujete pomocou rozloženia. Samostatné tlačidlá *Filtrovať…*, *Zoskupiť…* a *Triediť…* existujú teraz iba za skrytým nastavením (pozri úskalia).

## Kroky

### Použitie existujúceho rozloženia

1. Vyberte kartu *Zobrazenie*. V skupine *Rozloženie* je tlačidlo pre každé rozloženie. Predvolené je *Diagram zdrojov*.
2. Kliknite na ňu. *Diagram zdrojov* zoskupí úlohy podľa zdrojov, v každej skupine triedi podľa začiatku a vypne čiary závislostí. Úloha s dvoma zdrojmi sa zobrazí pod oboma.
3. Kliknite znova, aby ste rozloženie vypli. Zobrazenie sa vráti do stavu pred vaším kliknutím.

Každé kliknutie je jeden krok pre príkaz *Vrátiť späť* (Ctrl+Z), a to pri zapnutí aj pri vypnutí.

### Vytvorenie vlastného rozloženia

1. V skupine *Rozloženie* kliknite na *Nové rozloženie*. Otvorí sa okno *Nové rozloženie*.
2. V poli *Názov* zadajte názov a v poli *Ikona* vyberte ikonu.
3. V časti *Čo toto rozloženie ukladá?* sú šesť častí, každá s políčkom. Okno začína so všetkými časťami zaškrtnutými a s tým, čo je teraz na obrazovke. Odškrtnite všetko, čo rozloženie nesmie meniť. Ak chcete iba filter, nechajte zaškrtnuté iba *Filtrovať*. *Prevziať aktuálne zobrazenie* znova vyplní všetky časti podľa obrazovky.
4. Nastavte jednotlivé časti.
5. Kliknite na *Uložiť*.

Rozloženie je teraz tlačidlo na páse s nástrojmi, ale ešte nie je použité. Kliknutím na tlačidlo ho zapnete.

### Nastavenie filtra

V časti *Filtrovať* vytvárate pravidlá. Kliknite na *+ pravidlo*. V zozname *Pole* vyberte požadované pole, v zozname *Operátor* operátor a zadajte hodnotu. Ak chcete iba kritické úlohy: pole *Kritická*, operátor *je rovné*, hodnota *Áno*. Polia zahŕňajú *Názov úlohy*, *Začiatok*, *Dokončenie*, *Celková časová rezerva*, *Postup* a *Medzník*, plus vlastné kódy aktivít a polia a *Zdroje*. Operátory závisia od druhu poľa: pri texte môžete zvoliť *obsahuje*, pri číslach a dátumoch *medzi*.

Ktoré operátory dostanete, závisí od druhu poľa:

- Text (*Názov úlohy*, *WBS*): *je rovné*, *nie je rovné*, *obsahuje*, *začína na* a *je prázdne*.
- Číslo a dátum (*Celková časová rezerva*, *Začiatok*, *Postup*): *je rovné*, *nie je rovné*, *menšie ako*, *menšie alebo rovné*, *väčšie ako*, *väčšie alebo rovné*, *medzi* a *je prázdne*. Pri *medzi* sú dve polia: pri čísle s nápovedou *Od* a *Do*, pri dátume bez nápovedy (prvý dátum je začiatok, druhý dátum je dátum dokončenia).
- Áno/nie (*Kritická*, *Medzník*, *Takmer kritická*): *je rovné* a *nie je rovné*, s hodnotou *Áno* alebo *Nie*.
- Výber (*Typ*, kód aktivity): *je rovné*, *nie je rovné*, *je jedno z* (s hodnotami na zaškrtnutie) a *je prázdne*.
- *Zdroje*: *je jedno z* a *je prázdne*.
- *Prebieha*: iba *medzi*, s dvoma dátumami (od a do).

S poľom *Prebieha*, operátorom *medzi* a dvoma dátumami dostanete všetky úlohy, ktoré počas tohto obdobia bežia v ľubovoľnom okamihu, napríklad všetko, čo je aktívne v júni.

Viacero pravidiel skombinujete pomocou zoznamu hore: *Všetky z nasledujúcich (AND)* zobrazí úlohy, ktoré spĺňajú všetky pravidlá. *Ktorékoľvek z nasledujúcich (OR)* zobrazí úlohy, ktoré spĺňajú aspoň jedno pravidlo. Pomocou tlačidla *+ skupina* pridáte podskupinu s vlastnými pravidlami.

Filter sa pozerá na samotné úlohy. Fázy (súhrnné úlohy), pod ktoré úloha patrí, zostanú viditeľné sivou farbou, takže vidíte, kam úloha patrí. Ak zapnete aj zoskupenie, tieto sivé fázy zmiznú.

### Zoskupenie a triedenie

V časti *Zoskupiť* pridáte pole tlačidlom *+ úroveň*. Najviac sú dve úrovne zoskupenia. Bez zoskupenia vidíte stromovú štruktúru WBS. V časti *Triediť* pridáte pole tlačidlom *+ úroveň* a vyberiete *Vzostupne* alebo *Zostupne*. Pri dvoch úrovniach rozhodne druhá úroveň vtedy, keď sú hodnoty na prvej úrovni rovnaké.

### Rýchle vyskúšanie bez tlačidla

V okne kliknite na *Použiť bez uloženia*. Zaškrtnuté časti sa zobrazia na obrazovke, ale nepridá sa žiadne tlačidlo. To je užitočné pri filtri, ktorý potrebujete iba raz. Ctrl+Z ho vráti späť.

### Zmena, kopírovanie alebo odstránenie rozloženia

Kliknite pravým tlačidlom myši na tlačidlo rozloženia. Vyberiete *Upraviť…*, *Duplikovať* alebo *Odstrániť*. *Odstrániť* najprv vyžiada potvrdenie. Kópia sa volá *názov (kópia)*. Vstavané rozloženie, napríklad *Diagram zdrojov*, nemôžete upraviť ani odstrániť; duplikujete ho, aby ste si vytvorili vlastnú verziu.

### Viac rozložení naraz

Rozloženia, ktoré neukladajú tie isté časti, môžu byť zapnuté naraz. Ak máte rozloženie, ktoré ukladá iba filter *Kritická je rovné Áno* (nazvite ho napríklad *Iba kritické*), a zapnete ho spolu s rozložením *Diagram zdrojov* (zoskupenie, triedenie, čiary závislostí), dostanete kritické úlohy podľa zdrojov. Ak dve rozloženia ukladajú tú istú časť, napríklad oba filtre, druhé rozloženie nahradí prvé a prvé sa vypne. Ak druhé rozloženie znova vypnete, vrátite sa do zobrazenia pred prvým kliknutím, nie do prvého rozloženia.

## Úskalia a čo aplikácia robí

**Zabudnete odškrtnúť časti.** Rozloženie, ktoré ukladá aj stĺpce, časovú škálu a prekrytia, pri každom kliknutí vráti tieto časti do uloženého stavu. Priblíženie sa potom zmení, hoci ste chceli zmeniť iba filter. Skontrolujte v okne, že sú zaškrtnuté iba zamýšľané časti.

**Neúplné pravidlo nič nezobrazí.** Ak pri poli áno/nie nevyberiete hodnotu (stále je tam *—*) alebo necháte prázdne dátumy pri *Prebieha*, žiadna úloha sa nezhoduje a zoznam ostane prázdny. Dokončite pravidlo.

**Ručná zmena vypne rozloženie.** Ak sami zmeníte časť, ktorú rozloženie ukladá, napríklad *Čiary závislostí*, keď je zapnutý *Diagram zdrojov*, toto rozloženie sa vypne a ostatné časti sa vrátia do zobrazenia pred rozložením. Zmena priblíženia vypne rozloženie, ktoré ukladá časovú škálu, a zväčšenie šírky stĺpca vypne rozloženie, ktoré ukladá stĺpce. Zvyšok zobrazenia potom zostane taký, aký je. *Diagram zdrojov* časovú škálu neukladá, takže priblíženie ho neovplyvní.

**Stĺpce sa týkajú tabuľky úloh vedľa diagramu Gantt.** Časť *Stĺpce* ukladá stĺpce tabuľky vľavo od časovej osi. Tabuľka na karte *Tabuľka* si ponecháva vlastné stĺpce. Ako vyberiete stĺpce, je popísané v článku [Úprava stĺpcov tabuľky](docs://howto-tabelkolommen-aanpassen).

**Znížiť úroveň a zvýšiť úroveň sú vypnuté.** Kým je zapnuté filtrovanie, zoskupovanie alebo triedenie, zobrazené poradie nie je poradie plánu. *Znížiť úroveň* a *Zvýšiť úroveň* sú potom vypnuté a ich nápoveda hovorí *Nedostupné počas filtrovania, zoskupovania a triedenia*. Ak chcete znova upraviť štruktúru, rozloženie vypnite, ako je popísané v článku [Úprava štruktúry](docs://howto-structuur-aanpassen).

**Stavový riadok sa neprispôsobí.** *Úlohy:* v stavovom riadku sa zobrazuje počet úloh celého projektu, aj keď filter ukazuje iba ich časť.

**Rozloženia sú uložené v zariadení, nie v projekte.** Aplikácia uchováva vaše rozloženia a stĺpce pre všetky vaše projekty na tomto zariadení. Prekrytia z rozloženia (pôvodný plán, čiara postupu a ostatné) platia pre všetky vaše projekty. Filter, zoskupenie a triedenie, ktoré sú práve zapnuté, patria k otvorenému projektu, ale nezapisujú sa do súboru projektu: po uložení a opätovnom otvorení je zobrazenie čisté. Ani neoznačujú projekt ako „zmenený“.

**Oddelené tlačidlá sú skryté.** Samostatné tlačidlá *Stĺpce…*, *Filtrovať…*, *Zoskupiť…* a *Triediť…* na karte *Zobrazenie* sú starý spôsob zobrazenia. Vrátite ich tlačidlom *Zobraziť klasické tlačidlá zobrazenia* v časti *Staré funkcie* na karte *Rozšírené* v okne nastavení (⚙ v záhlaví okna). Používajte radšej rozloženia.

## Pozri aj

- [Úprava stĺpcov tabuľky](docs://howto-tabelkolommen-aanpassen): výber, presúvanie a ukotvenie samotných stĺpcov.
- [Vytvorenie a tlač zostavy](docs://howto-rapport-maken-en-afdrukken): vytlačenie zobrazenia na papier pomocou *Sledovať zobrazenie*.
- [Úprava štruktúry](docs://howto-structuur-aanpassen): prečo počas filtrovania nemôžete znížiť úroveň úloh.
