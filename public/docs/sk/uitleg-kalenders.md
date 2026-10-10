# Kalendáre a pracovné dni

Koľko pracovných dní trvá úloha a k akému dátumu je dokončená? To závisí od kalendára, v ktorom aplikácia počíta. V tomto článku zistíte, čo je kalendár, ako s ním aplikácia počíta pracovné dni a ktorý kalendár platí, keď sú zapojené viaceré kalendáre. Podrobný príklad pomáha sledovať čísla.

## Pojem

Plán počíta v **pracovných dňoch**, nie v kalendárnych dňoch. „Päť dní murovania“ znamená päť dní, v ktorých sa pracuje. Víkend alebo štátny sviatok sa nepočíta, takže úloha v diári zaberie viac ako päť dní.

V **kalendári** sa zapisuje, ktoré dni sú pracovné. Kalendár určuje tri veci:

- **Pracovný týždeň**: dni v týždni, v ktoré sa pracuje. Predvolená hodnota je pondelok až piatok.
- **Pracovné časy**: začiatok, koniec a prestávka. Dávajú **čisté hodiny za deň**. Predvolená hodnota je 07:00 až 16:00 s hodinovou prestávkou, teda 8 hodín.
- **Sviatky**: jednotlivé dni alebo celé úseky dní, v ktorých sa nepracuje, napríklad Deň kráľa, Vianoce alebo **stavebná dovolenka**.

Projekt má jednu **knižnicu kalendárov**. Jeden z nich je **kalendár projektu**. Platí pre každú úlohu, ktorá nemá vlastný kalendár. Jednotlivej úlohe môžete dať iný kalendár, napríklad šesťdňový pracovný týždeň pre subdodávateľa, ktorý pracuje aj v sobotu. Aj **zdroj** môže mať vlastný kalendár, ale ten robí niečo iné (pozri nižšie).

## Ako aplikácia počíta

Tento článok opisuje štandardný výpočet: profil výpočtu *Open Planner Studio*, s ktorým počíta nový projekt.

### Počítanie pracovných dní

Prvý pracovný deň úlohy sa počíta ako deň 1. Úloha s trvaním 5 dní preto končí piaty pracovný deň. Ak začiatok pripadne na nepracovný deň, úloha začína najbližším nasledujúcim pracovným dňom. Sviatok alebo stavebná dovolenka uprostred úlohy sa nepočíta: úloha ju jednoducho prejde a v diári sa predĺži.

Hodiny za deň nemajú vplyv na dátumy úlohy v dňoch. Počítajú sa len pracovný týždeň a sviatky. Pracovné časy sa uplatnia až pri úlohe v hodinách; to je opísané v [Dni a hodiny](docs://uitleg-dagen-en-uren).

### Ktorý kalendár platí

Aplikácia vyberie pre každú úlohu jeden kalendár:

1. Ak má úloha vlastný kalendár, aplikácia úlohu počíta celú v tomto kalendári: trvanie, dátum dokončenia aj časovú rezervu.
2. Ak vlastný kalendár nemá, platí kalendár projektu. Ak úloha ukazuje na kalendár, ktorý už neexistuje, platí tiež kalendár projektu.

Súhrnná úloha (fáza) nemá vlastnú prácu, a preto nemá ani vlastný kalendár. Jej trvanie vyplýva z dátumov jej úloh a aplikácia ju počíta v kalendári projektu.

Kalendár **zdroja** nemá vplyv na dátumy. V plánu, ktorý zostavujete v aplikácii, určuje len, kedy je zdroj k dispozícii: v histograme, pri preťažení a pri vyvažovaní.

### Úlohy v rôznych kalendároch

Keď sa prepoja dve úlohy s rôznymi kalendármi, platí toto:

- Pri závislosti dokončenie-začiatok sa nasledujúca úloha začína prvým pracovným dňom po dokončení predchádzajúcej úlohy. Počíta sa v kalendári **nasledujúcej úlohy**. Ak úloha končí v piatok, nasledujúca úloha so šesťdňovým pracovným týždňom začne v sobotu.
- Predvolená hodnota je, že **oneskorenie** sa počíta v kalendári **predchádzajúcej úlohy**. Môžete to zmeniť na karte *Nastavenia › Projekt › Info o projekte*, v bloku *Profil výpočtu a možnosti výpočtu*, v časti *Možnosti výpočtu tohto projektu*, voľbou *Kalendár oneskorenia*: *Predchádzajúca úloha* (predvolené), *Nasledujúca úloha*, *24-hodinový* alebo *Projektový kalendár*.
- **Celková časová rezerva** sa počíta v **pracovných dňoch** kalendára samotnej úlohy. V tomto profile sa **voľná časová rezerva** počíta v kalendári nasledujúcej úlohy.

Čo presne je oneskorenie, opisuje [Pridávanie závislostí](docs://howto-relaties-leggen); čo je časová rezerva, opisuje [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

### V Gantt

Sivé pozadie v Gantt vždy ukazuje nepracovné dni **kalendára projektu**. Úloha s vlastným kalendárom preto môže prebehnúť cez sivý deň, napríklad šesťdňová úloha cez sobotu. Súvislý rad sviatkov, široký tri dni alebo viac, dostane zobrazený názov, napríklad *Bouwvak (Noord)*. To sa nestane, keď je zapnuté *Zobraziť len pracovné dni*. Ak nechcete vidieť sivé dni vôbec, zapnite *Zobraziť len pracovné dni* na karte *Nastavenia › Projekt › Nastavenia*, na karte *Vzhľad*, v nadpise *Časová os*.

## Príklad: plán stavby

Príklad používa štandardný kalendár *Bouwkalender NL*: pondelok až piatok, s holandskými štátnymi sviatkami. Všetky úlohy trvajú celý počet dní. V návode o kalendároch (návod 3) si takýto kalendár vytvoríte sami.

### Víkend, sviatok a stavebná dovolenka

*Brickwork* trvá 5 pracovných dní a začína vo štvrtok 13. mája 2027. Štvrtok 13. a piatok 14. mája sú deň 1 a 2. Víkend a Svätodušný pondelok 17. mája sa nepočítajú. Utorok 18., streda 19. a štvrtok 20. mája sú deň 3, 4 a 5. Úloha končí **vo štvrtok 20. mája**: osem kalendárnych dní za päť pracovných dní.

Stavebná dovolenka situáciu zväčšuje. Vezmite *Bouwvak (Noord)* od 26. júla do 13. augusta 2027 vrátane a rovnakú úlohu s 5 pracovnými dňami od piatku 23. júla. Piatok 23. júla je deň 1. Potom kalendár tri týždne stojí. Pondelok 16. až štvrtok 19. augusta sú deň 2 až 5. Úloha končí **vo štvrtok 19. augusta**, 28 kalendárnych dní po začiatku. Bez stavebnej dovolenky by to bol štvrtok 29. júla.

### Úloha v sobotu

Tri úlohy nasledujú jedna za druhou, všetky so závislosťou dokončenie-začiatok bez oneskorenia: *Groundwork* (4 dni), *Pour foundation* (3 dni) a *Brickwork* (5 dní). Začiatok projektu je v pondelok 24. mája 2027.

Ak sú všetky tri na kalendári projektu, *Groundwork* beží od pondelka 24. do štvrtka 27. mája. *Pour foundation* beží od piatku 28. mája do utorka 1. júna (piatok, pondelok, utorok). *Brickwork* beží od stredy 2. júna do utorka 8. júna. Dokončenie projektu je **v utorok 8. júna**.

Dajte úlohe *Pour foundation* kalendár *Six-day week* (pondelok až sobota) a sobota sa počíta. Úloha beží od piatku 28. mája do **pondelka 31. mája** (piatok, sobota, pondelok). *Brickwork* zostáva na kalendári projektu, začína v utorok 1. júna a končí **v pondelok 7. júna**. Celý projekt je o deň kratší, pretože jedna úloha pracuje v sobotu.

### Oneskorenie cez dva kalendáre

*Pour floor* (šesťdňový týždeň, 4 dni) začína v pondelok 31. mája a končí vo štvrtok 3. júna. *Pointing* (kalendár projektu, 3 dni) nasleduje s oneskorením 2 pracovných dní. Bez oneskorenia by *Pointing* začínal v piatok 4. júna.

- Predvolená hodnota je, že oneskorenie sa počíta v kalendári predchádzajúcej úlohy, teda v šesťdňovom týždni. Od piatku 4. júna je prvý pracovný deň sobota 5. júna a druhý pondelok 7. júna. *Pointing* začína **v pondelok 7. júna** a končí v stredu 9. júna.
- Ak nastavíte *Kalendár oneskorenia* na *Nasledujúca úloha*, počíta sa kalendár projektu. Sobota sa potom nepočíta: pondelok 7. júna je prvý pracovný deň a utorok 8. júna druhý. *Pointing* začína **v utorok 8. júna** a končí vo štvrtok 10. júna.

### Časová rezerva vo vlastnom kalendári

*Brickwork* (5 dní, kalendár projektu) a *Crane hire* (3 dni, šesťdňový týždeň) začínajú v pondelok 24. mája. Obe sú predchádzajúcimi úlohami pre *Fit window frames* (2 dni, kalendár projektu).

*Brickwork* končí v piatok 28. mája, takže *Fit window frames* začína v pondelok 31. mája. *Crane hire* je už dokončená v stredu 26. mája. Celková časová rezerva *Crane hire* sa počíta v jej vlastnom kalendári: štvrtok 27., piatok 28. a sobota 29. mája, teda **3 pracovné dni**. Keby mala *Crane hire* kalendár projektu, boli by to 2 pracovné dni. Voľná časová rezerva je 2 pracovné dni (štvrtok a piatok), pretože sa počíta v kalendári nasledujúcej úlohy.

### Kalendár zdroja

V inom príkladovom projekte má zdroj *Bricklaying crew* kalendár *Crew Mon–Thu* (pondelok až štvrtok). Je priradený s 1 jednotkou priradenia za deň k úlohe *Brickwork* (5 dní, kalendár projektu, od pondelka 31. mája do piatka 4. júna).

Dátumy *Brickwork* sa nemenia. Piatok 4. júna je v histograme červený so správou *Podľa kalendára „Crew Mon–Thu“ sa v tento deň nepracuje*. Pás s nástrojmi hlási jeden zdroj v časti *Preťaženie*. Vyvažovanie tento konflikt nevyrieši. Posúvanie nepomôže, pretože päť pracovných dní za sebou vždy obsahuje piatok. V okne *Vyvažovanie zdrojov* je úloha preto uvedená v časti *Zostávajúce konflikty*, s dôvodom *Zdroj v niektoré dni, ktoré táto úloha potrebuje, nepracuje — posunutie to nevyrieši.*

## Dôsledky a nedorozumenia

**„Kalendár zdroja mi posúva úlohy.“** Nie. Kalendár zdroja nemení žiadny dátum. Len ukazuje preťaženie. Ak chcete, aby úloha bežala v iných dňoch, dajte úlohe vlastný kalendár.

**„Ak prepnem kalendár projektu, všetko sa posunie.“** Posunú sa len úlohy bez vlastného kalendára. Úloha, ktorej ste sami dali kalendár zo zoznamu, si ho ponechá, aj keď je to náhodou starý kalendár projektu. Ak kalendár vymažete, úlohy a zdroje, ktoré ho používali, sa vrátia na kalendár projektu.

**„Sviatky tam predsa sú, nie?“** Sviatky existujú len pre roky, pre ktoré boli vytvorené. Deň mimo týchto rokov je jednoducho pracovný deň. V dialógu kalendára to aplikácia hovorí takto: *Sviatky pokrývajú 2025–2028; projekt beží do 2030. Chcete ich vygenerovať znova?*

**„Viac hodín za deň mi skráti úlohu.“** Nie. Pri úlohe v dňoch nie: počíta sa celý počet pracovných dní, či má deň 6 alebo 8 hodín. Len pri úlohe so zdrojmi a pravidlom práce *Pevná práca* alebo *Pevné jednotky priradenia* sa trvanie mení s hodinami.

**Kalendár bez pracovných dní** aplikácia nedokáže vypočítať. Výpočet hlási *Kalendár nemá nastavené žiadne pracovné dni*.

## Pozri tiež

- [Dni a hodiny](docs://uitleg-dagen-en-uren): ako aplikácia počíta pracovnú dobu a čo sa stane, keď sa stretnú úlohy v dňoch a hodinové úlohy.
- [Vytvorenie a priradenie kalendára](docs://howto-kalender-maken-en-toewijzen): kroky na vytvorenie vlastného kalendára a jeho priradenie úlohám.
- [Generovanie sviatkov a stavebnej dovolenky](docs://howto-feestdagen-genereren): vyplnenie sviatkov krajiny a stavebnej dovolenky.
- [Nastavenie kalendára zdroja](docs://howto-resourcekalender-instellen): zaznamenanie dostupnosti zdroja.
- [Okná kalendárov](docs://ref-kalenders): všetky polia okien kalendára.
