# Ťahanie, posúvanie a zoom v diagrame Gantt

Cieľ: ovládať časovú os myšou: presunúť pruh alebo upraviť jeho trvanie, posunúť časovú os, vybrať úlohy rámčekom a priblížiť alebo oddialiť.

## Kedy to potrebujete

V diagrame Gantt vidíte, že murovanie musí začať o dva dni neskôr, alebo že betonáž trvá o deň dlhšie. Chcete to upraviť priamo na pruhu. Alebo máte projekt na niekoľko mesiacov a chcete rýchlo prejsť na stavebný sviatok. Na to má myš niekoľko gest. Ktoré gesto čo robí, závisí od toho, kde začnete ťahať, a od nastavenia posúvania.

## Kroky

### Presúvanie pruhu

1. Stlačte stred pruhu úlohy a ťahajte vodorovne. Začiatok a dokončenie sa presunú spolu, po celých dňoch. Trvanie zostane rovnaké.
2. Pustite tlačidlo myši. Pruh zostane na novom mieste. Plán je potom neaktuálny: stlačte *Prepočítať* (F5), alebo nechajte, aby aplikácia plán počítala sama, ak je zapnutý *Automatický prepočet*.

Ak má úloha predchádzajúcu úlohu, aplikácia zapíše nový začiatok ako obmedzenie *Začiatok nie skôr ako (SNET)* a po pustení tlačidla to oznámi. Prečo tak je a čo sa stane pri inom obmedzení, je v článku [Obmedzenia a termíny](docs://uitleg-constraints). Ak ťaháte späť na pôvodný začiatok, vráti sa aj pôvodné obmedzenie.

Ak ťaháte hlavne nahor alebo nadol namiesto do strany, presuniete úlohu na iný riadok a dátumy zostanú. Smer, ktorý zvolíte v prvých niekoľkých pixeloch, platí pre celé ťahanie. Jedno gesto preto nikdy nemení dátumy a štruktúru naraz. Pozrite si [Úprava štruktúry](docs://howto-structuur-aanpassen).

### Úprava trvania

1. Presuňte myš na pravý okraj pruhu. Kurzor sa zmení na šípku ukazujúcu doľava a doprava.
2. Ťahajte okraj. Počas ťahania sa zobrazí malá bublina v akcentovej farbe motívu (štandardne oranžová). Bublina ukazuje trvanie, ktoré by úloha teraz dostala, napríklad *4d*. Bublina sa mení priebežne, takže novú dĺžku vidíte ešte pred pustením. Na pravom okraji je bublina vnútri pruhu, na ľavom okraji tesne vľavo od neho. Bublina ukazuje trvanie tak, ako ho ukazuje stĺpec trvania.
3. Pustite tlačidlo myši. Trvanie je to, ktoré ukázala bublina.

Ľavý okraj posúva začiatok a dokončenie nechá na mieste, takže úloha sa skráti alebo predĺži na začiatku. Pre tento okraj platí rovnaké pravidlo SNET ako pri presúvaní. Ak ťaháte stred pruhu, bublina sa nezobrazí: trvanie sa nemení.

Trvanie sa počíta v pracovných dňoch kalendára úlohy. Víkendy a dni voľna sa nerátajú. Úloha v dňoch nemôže byť kratšia ako jeden pracovný deň. Pre úlohu v hodinách aplikácia zaokrúhli na krok časovej osi pod kurzorom: najmenej na jednu hodinu, alebo na štvrťhodinu, ak priblížite dostatočne a je zapnuté *Zobraziť štvrťhodiny pri silnom priblížení*.

Jedno ťahanie je jeden krok v *Vrátiť späť*, bez ohľadu na to, ako dlho ťaháte. Na rozdelenom pruhu fungujú okraje inak; pozrite si [Rozdelenie úlohy](docs://howto-taak-splitsen).

### Posúvanie časovej osi

Čo robí ťahanie po prázdnom pozadí, závisí od režimu posúvania. Vyberiete ho v okne *Nastavenia*, na karte *Vzhľad*, v časti *Gantt › Posúvanie a zoom*, položka *Režim*:

- **Zoom + ťahanie** (predvolené): ak ťaháte po prázdnom pozadí ľavým tlačidlom myši, časová os sa pohybuje spolu s myšou, ako mapa. Kurzor je ruka. Na pruhu ťahanie len spustí gesto pruhu.
- **Poloha** a **Klávesy**: to isté ťahanie vytvorí výberový rámček. Časovú os posúvate kolieskom (pozri [Nastavenia](docs://ref-instellingen)) alebo stredným tlačidlom myši.

**Stredné tlačidlo myši** (stlačené koliesko) posúva časovú os v každom režime, aj keď začnete na pruhu. Nefunguje, kým prebieha iné gesto, napríklad ťahanie pruhu.

### Výber úloh rámčekom

Rámček vyberie všetky úlohy v riadkoch, ktorých sa dotkne. Počíta sa len výška rámčeka, nie časová os.

1. Začnite na prázdnom pozadí. Pri *Zoom + ťahanie* držte Ctrl (⌘ na Macu), keď tak robíte. Pri *Poloha* a *Klávesy* to nie je potrebné.
2. Ťahajte cez riadky, ktoré chcete vybrať. Výber dostane orámovanie.
3. Pustite tlačidlo myši. Ak počas ťahania stlačíte Esc, rámček sa zruší a výber zostane taký, aký bol.

Viac o výbere je v článku [Výber, odstránenie a vrátenie úloh späť](docs://howto-taken-selecteren-verwijderen). Na prázdnom mieste priamo v tabuľke úloh ťahanie nerobí nič.

### Priblíženie a oddialenie

1. Použite *Priblížiť +* a *Oddialiť -* (*Začiatok › Priblíženie*), alebo klávesy + a -. Koliesko myši tiež približuje; kedy to robí, závisí od režimu posúvania (pozri [Nastavenia](docs://ref-instellingen)).
2. Ak chcete vidieť celý projekt, zvoľte *Zobrazenie › Časová škála › Prispôsobiť projektu* alebo stlačte Ctrl+0. *Obnoviť* (na karte *Zobrazenie*) alebo klávesa 0 vráti priblíženie na predvolené.
3. V pravom dolnom rohu stavového riadku je priblíženie v pixeloch na deň, napríklad *Priblíženie: 15 px/deň*.

Čím viac oddialite, tým menej mriežkových čiar je. Pri 8 pixeloch na deň alebo viac je čiara pre každý deň, s hrubšou čiarou na hranici týždňa. Medzi 2 a 8 pixelmi na deň zostáva len hranica týždňa. Pod 2 pixelmi na deň, na úrovni roka, zostávajú len hranice mesiacov. Inak by plátno bolo rovnomerným pásikovým vzorom a pruhy úloh by v ňom zanikli. Sivé víkendy a dni voľna a pásy týždňov, ktoré sa striedajú vo farbe, zostávajú na každej úrovni; nesú štruktúru týždňov, keď čiary zmiznú. V hlavičke časovej osi sa čísla týždňov a čísla dní zobrazia len vtedy, keď je na ne miesto. Od 40 pixelov na deň sa pred číslo dňa zobrazí aj deň v týždni.

## Nástrahy a čo aplikácia vtedy urobí

**Začiatok sa nepresunie.** Ak má úloha predchádzajúcu úlohu a iné obmedzenie než SNET, napríklad *Čo najneskôr (ALAP)*, aplikácia nepoužije ťahaný začiatok. Po pustení tlačidla myši aplikácia oznámi, ktoré obmedzenie drží začiatok. Ak chcete začiatok presunúť, zmeňte toto obmedzenie. Pravý okraj funguje, lebo mení len trvanie.

**Gesto robí niečo iné.** V režime závislostí a v režime rozdelenej úlohy fungujú gestá pruhov inak; Esc tieto režimy zastaví. Ak pri ťahaní z pruhu podržíte Shift, vytvoríte závislosť namiesto presunu pruhu. Pozri [Pridávanie závislostí](docs://howto-relaties-leggen).

**V režimoch Poloha alebo Klávesy ľavé tlačidlo myši neposúva.** Namiesto ruky vidíte bežný kurzor. Použite koliesko alebo stredné tlačidlo myši, alebo nastavte režim na *Zoom + ťahanie*.

**Klik v prestávke rozdeleného pruhu** vyberie úlohu a nespustí ťahanie ani rámček.

## Pozri tiež

- [Kontextové ponuky](docs://ref-contextmenus): ponuky na pruhu, na riadku a na hlavičke skupiny.
- [Klávesové skratky](docs://ref-sneltoetsen): klávesy pre priblíženie a pre zrušenie gesta.
- [Nastavenia](docs://ref-instellingen): režim posúvania a časová os.
- [Obmedzenia a termíny](docs://uitleg-constraints): prečo sa presunutý začiatok stane obmedzením.
