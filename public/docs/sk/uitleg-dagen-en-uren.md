# Dni a hodiny

Úloha s trvaním 2 dni a úloha s trvaním 16 hodín vyzerajú rovnako, ale aplikácia ich počíta inak. Prečo môžete vybrať medzi dňami a hodinami? Čo sa stane, keď je úloha v hodinách naviazaná na úlohu v dňoch? V tomto článku prečítate, ako aplikácia počíta dni a hodiny a kde zaokrúhľuje. Príklad s žeriavom ukazuje čísla.

## Pojem

**Úloha v dňoch** má trvanie v celých pracovných dňoch, napríklad `5d`. Zaberá celé pracovné dni. V štandardnom kalendári má dátum začiatku a dátum dokončenia bez času.

**Hodinová úloha** má trvanie v hodinách pracovnej doby, napríklad `12h` alebo `1h 30m`. Má začiatok a dokončenie s hodinovým časom, napríklad utorok 11:00.

Jednotka trvania patrí k úlohe, nie k projektu. V jednom pláne môžete kombinovať úlohy v dňoch a hodinové úlohy. Tomu sa hovorí **zmiešané plánovanie**.

Hodiny použijete pre činnosti, ktoré sa nezmestia do celých dní: žeriav, ktorý si prenajmete na dvanásť hodín, betónovanie na šesť hodín, alebo úlohu, ktorá môže začať až po obede. Na všetko ostatné stačia dni a sú prehľadnejšie.

**Plánovanie v hodinách** je predvolene vypnuté. Kým je vypnuté, aplikácia pracuje v dňoch. Ak súbor obsahuje plánovanie v hodinách, napríklad úlohy v hodinách, aplikácia zobrazí *Tento súbor obsahuje plánovanie v hodinách.* Tieto úlohy sa stále vypočítajú, ale trvanie môžete upraviť až po zapnutí plánovania v hodinách.

## Ako aplikácia počíta

### Pracovné časy a štandardný pracovný deň

Každý kalendár má pre každý pracovný deň **bloky pracovného času** (v aplikácii nazývané *bloky*). Štandardný kalendár má časy 07:00 až 12:00 a 13:00 až 16:00. Čas medzi blokmi je prestávka. Aplikácia odvodí tieto bloky z hodnôt kalendára *Začiatok (hodina)*, *Dokončenie (hodina)* a prestávky. Nemusíte pre to nič nastavovať. Ak nastavíte vlastné bloky pre jednotlivé dni v týždni, majú prednosť.

**Štandardný pracovný deň** je pracovný deň, ktorý sa vyskytuje najčastejšie. Jeho dĺžka je súčet jeho blokov. Nie je to priemer: pri pondelku so 16 hodinami a utorku až piatku po 10 hodinách je štandardný pracovný deň 10 hodín. Ak sa pracovné dni dĺžkou líšia, platí najčastejší denný súčet. Pri rovnosti platí najvyšší. Pri štyroch dňoch po 8 hodinách a piatku s 5 hodinami je štandardný pracovný deň preto 8 hodín. Kalendár s vlastnými hodinami za deň (napríklad z Primavera P6) sa tiež počíta s týmto denným súčtom a okno kalendára ho zobrazí. Jeho vlastná hodnota sa zachová pre export. Ak sa líši, okno kalendára zobrazí oranžový pruh pod poľom *Štandardný pracovný deň*. Úloha s 1870 hodinami na blokoch po 10 hodinách preto trvá 187 dní, aj keď jej vlastná hodnota je 8 hodín za deň.

### Úloha v hodinách

Aplikácia počíta pracovné minúty od začiatku cez bloky pracovného času. Prestávky, večery, víkendy a sviatky sa nepočítajú. Úloha s trvaním 12 hodín sa preto nezmestí do jedného pracovného dňa s 8 hodinami: pokračuje do nasledujúceho dňa.

### Úloha v dňoch

Aplikácia počíta celé pracovné dni. Hodiny za deň nemajú žiadny vplyv. Úloha s trvaním 5 dní sa dokončí v ten istý deň, či má kalendár 6 alebo 8 hodín za deň.

### Prevod dní a hodín

Deň je štandardný pracovný deň kalendára úlohy. Aplikácia to používa na troch miestach:

- Pre *Zobrazenie trvania*. V *Nastavenia › Projekt › Nastavenia aplikácie*, na karte *Vzhľad*, vyberiete *Automaticky (vlastná jednotka každej úlohy)*, *Vždy dni* alebo *Vždy hodiny*. Úloha s 18 hodinami sa pri voľbe *Vždy dni* zobrazí ako `2.25d(18h)`: pôvodná jednotka zostane v zátvorkách.
- Pre oneskorenie v hodinách za úlohou v dňoch (pozri *Zaokrúhľovanie*).
- Pri zmene jednotky úlohy. Aplikácia potom počíta dni od začiatku úlohy, každý deň s vlastnými hodinami, a trvanie hneď prevedie, ak je výsledok presný. Dva dni sa zmenia na `16h`. V kalendári, kde má piatok 5 hodín, sa 5 dní od pondelka zmení na `37h`. Dvanásť hodín sa nedá previesť na celé dni v kalendári s dňami po 8 hodinách: aplikácia potom jednotku nezmení.

### Úlohy v dňoch a hodinové úlohy spolu

Pravidlá nižšie platia pre závislosť dokončenie-začiatok v kalendári bez vlastných blokov pracovného času, napríklad v štandardnom kalendári.

- **Hodina → hodina.** Nasledujúca úloha sa začne v okamihu, keď sa predchádzajúca úloha dokončí, aj keď je to uprostred dňa.
- **Hodina → deň.** Úloha v dňoch sa nikdy nezačne uprostred dňa. Začne sa prvým pracovným dňom po dni, v ktorom sa hodinová úloha dokončí. Zvyšok toho dňa zostane nevyužitý a vráti sa ako časová rezerva hodinovej úlohy.
- **Deň → hodina.** Úloha v dňoch zaberá celý svoj posledný deň. Hodinová úloha sa začne prvým pracovným dňom po nej, na začiatku prvého bloku pracovného času.

### Zaokrúhľovanie

Aplikácia zaokrúhľuje alebo odmieta na štyroch miestach:

- **Úloha v dňoch za hodinovou úlohou** sa začne nasledujúcim pracovným dňom. Hodinová úloha sa tak v podstate zaokrúhli nahor na celé dni.
- **Oneskorenie v hodinách** sa počíta v kalendári oneskorenia. Predvolený je kalendár predchádzajúcej úlohy. Ak je predchádzajúca úloha úlohou v dňoch v kalendári bez vlastných blokov pracovného času, napríklad v štandardnom kalendári, aplikácia prevedie oneskorenie na celé pracovné dni: oneskorenie delené počtom hodín štandardného pracovného dňa, zaokrúhlené na celé číslo; pol dňa sa zaokrúhli nahor. Pri 8 hodinách za deň sa 1 hodina počíta ako 0 dní, 4 hodiny ako 1 deň a 12 hodín ako 2 dni. To platí aj vtedy, ak je nasledujúca úloha hodinová. Ak je predchádzajúca úloha hodinová alebo jej kalendár má vlastné bloky pracovného času, oneskorenie sa počíta presne v hodinách pracovnej doby a prestávka sa nepočíta.
- **Trvanie v dňoch** je vždy celé číslo. Ak napíšete `1.5d`, aplikácia zobrazí *Zadajte celé číslo dní alebo hodín, napríklad 2d alebo 12h*. Trvanie v hodinách môže byť `1.5h` alebo `1h 30m`.
- **Zmena jednotky** nastane len vtedy, ak je výsledok presný (pozri vyššie).

## Príklad: žeriav

Kalendár platí od pondelka do piatka od 07:00 do 12:00 a od 13:00 do 16:00: štandardný pracovný deň má 8 hodín. Projekt sa začína v pondelok 7. júna 2027.

### Hodina, hodina a deň

*Place crane* trvá 12 hodín. Pondelok má 8 hodín pracovnej doby (5 do 12:00 a 3 po prestávke) a utorok posledné 4 hodiny. Úloha sa začne v pondelok o 07:00 a dokončí sa v **utorok 8. júna o 11:00**.

*Adjust elements* trvá 8 hodín a nadväzuje závislosťou dokončenie-začiatok. Začne sa hneď v utorok o 11:00: to je 1 hodina do prestávky a 3 hodiny po nej. Posledné 4 hodiny sú v stredu od 07:00 do 11:00. Dokončenie je **v stredu 9. júna o 11:00**.

*Finishing* trvá 2 dni a nadväzuje na *Adjust elements*. Úloha v dňoch sa nezačne uprostred dňa, preto sa začne v **štvrtok 10. júna** a dokončí sa v piatok 11. júna.

### Zaokrúhľovanie pri prechode

Ak vynecháte *Adjust elements* a naviažete *Finishing* priamo na *Place crane*, *Finishing* sa začne v stredu 9. júna a dokončí sa vo štvrtok 10. júna. Zvyšok utorka (4 pracovné hodiny) sa nedá využiť. Tieto 4 hodiny uvidíte znova ako celkovú časovú rezervu úlohy *Place crane*: pol pracovného dňa.

Ak poradie obrátite, je to jednoduchšie. *Pour foundation* trvá 2 dni, od pondelka 7. júna do utorka 8. júna. *Place crane* teraz trvá 4 hodiny a nadväzuje na ňu. Začne sa **v stredu 9. júna o 07:00** a dokončí sa o 11:00.

### Oneskorenie v hodinách

Medzi *Place crane* (12 hodín) a *Adjust elements* (8 hodín) vložíte oneskorenie 2 hodiny. *Adjust elements* sa potom nezačne o 11:00, ale v utorok o **14:00**: 1 hodina do prestávky a 1 hodina po nej. Dokončenie sa posunie na **stredu 9. júna o 14:00**.

Za úlohou v dňoch funguje oneskorenie inak. *Pour foundation* sa dokončí v utorok 8. júna. Bez oneskorenia sa *Finishing* začne v stredu 9. júna. S oneskorením 4 hodiny je to pol dňa, a aplikácia ho zaokrúhli nahor: *Finishing* sa začne v **štvrtok 10. júna**. Pri oneskorení 1 hodina aplikácia zaokrúhli nadol a *Finishing* sa jednoducho začne v stredu.

### Voľné popoludnie v piatok

Teraz má piatok iba jeden blok, od 07:00 do 12:00: 5 hodín. Ostatné dni zostávajú na 8 hodinách. Štandardný pracovný deň zostáva 8 hodín, lebo to je najčastejší denný súčet. Týždeň má teraz 37 hodín pracovnej doby.

Úloha s trvaním 40 hodín od pondelka 7. júna 07:00 zaberie pondelok až štvrtok (32 hodín) a piatok (5 hodín). Posledné 3 hodiny pripadnú na nasledujúci pondelok, od 07:00 do 10:00. Dokončenie je **v pondelok 14. júna o 10:00**. Úloha s trvaním 5 dní by zaberala 37 hodín od pondelka, a to aplikácia navrhne, ak zmeníte jednotku z 5 dní na hodiny.

V návode 4 o plánovaní v hodinách naplánujete sami úlohu s žeriavom v hodinách.

## Dôsledky a nedorozumenia

**„8 hodín je 1 deň.“** Len ak má kalendár dni po 8 hodinách. V kalendári s voľným piatkovým popoludním je 5 dní 37 hodín, nie 40.

**„Ak nastavím viac hodín za deň, moja úloha v dňoch sa dokončí skôr.“** Nie. Úloha v dňoch počíta celé pracovné dni. Hodiny za deň menia len to, koľko hodín je deň, napríklad v zobrazení a pri oneskorení v hodinách. Trvanie sa zmení len pri úlohe, ku ktorej sú priradené zdroje, a pri type úlohy *Pevná práca* alebo *Pevné jednotky priradenia*, lebo práca zostáva rovnaká: 40 hodín práce je 5 dní pri 8 hodinách za deň a 7 dní pri 6 hodinách za deň.

**„Úloha s trvaním 8 hodín trvá jeden deň.“** Len ak sa začne na začiatku dňa. Ak sa začne neskôr, napríklad ako *Adjust elements* v utorok o 11:00, pokračuje do nasledujúceho dňa.

**Kalendár s vlastnými blokmi pracovného času** sa správa inak ako štandardný kalendár. Takýto kalendár získate tak, že nastavíte pracovné časy podľa dňa v týždni alebo vyberiete predvoľbu zmien (*2 pracovné zmeny*, *3 pracovné zmeny*, *Nočná pracovná zmena* alebo *24/7*). V takom kalendári sa oneskorenie v hodinách počíta presne v hodinách pracovnej doby, aj za úlohou v dňoch.

**Vypnutie plánovania v hodinách** nič neodstráni. Hodinové úlohy zostávajú a stále sa vypočítajú, ale upraviť ich nemôžete, kým plánovanie v hodinách znovu nezapnete.

## Pozri aj

- [Zapnutie plánovania v hodinách](docs://howto-urenplanning-aanzetten): postup na naplánovanie hodinovej úlohy.
- [Nastavenie pracovných časov](docs://howto-werktijden-instellen): úprava blokov pracovného času v kalendári.
- [Kalendáre a pracovné dni](docs://uitleg-kalenders): ako aplikácia počíta pracovné dni a ktorý kalendár má prednosť.
- [Pridanie závislostí](docs://howto-relaties-leggen): postup na pridanie závislosti alebo oneskorenia.
