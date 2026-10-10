# Závislosti a oneskorenie

Prečo murivo začne až vtedy, keď je hotový základ? A prečo sa montáž strechy posunie o týždeň, keď sa strešné prvky dodajú neskoro? To záleží od závislostí medzi vašimi úlohami. V tomto článku sa dozviete, aké štyri typy závislostí aplikácia pozná, čo robia oneskorenie a predstih, v ktorom kalendári sa oneskorenie počíta, čo sa stane so závislosťou na fáze a ako aplikácia určí, ktorá závislosť rozhoduje o dátume začiatku úlohy.

Pravidlá a príklady platia pre nový projekt s profilom výpočtu *Open Planner Studio* a pracovným týždňom od pondelka do piatku.

## Pojem

**Závislosť** zaznamenáva, že dve úlohy na sebe závisia. Prvá úloha je **predchádzajúca úloha**, druhá je **nasledujúca úloha**. Závislosť je dolná hranica: nasledujúca úloha nesmie začať ani dokončiť sa skôr, než dovoľuje závislosť, ale môže začať alebo dokončiť sa neskôr. Ak má úloha viac predchádzajúcich úloh, čaká na najneskorší dátum, ktorý vyplynie zo všetkých týchto závislostí.

Existujú štyri typy. Líšia sa tým, ktorý okamih predchádzajúcej úlohy (začiatok alebo dokončenie) je spojený s ktorým okamihom nasledujúcej úlohy:

- **FS (dokončenie-začiatok).** Nasledujúca úloha začne až vtedy, keď je predchádzajúca úloha dokončená. Strešné prvky sa osadia až po postavení stien. Tento typ závislosti je zďaleka najčastejší.
- **SS (začiatok-začiatok).** Nasledujúca úloha začne až vtedy, keď sa predchádzajúca úloha začala. Úlohy sa môžu prekrývať: rozvody môžu začať, len čo murivo prebieha.
- **FF (dokončenie-dokončenie).** Nasledujúca úloha sa dokončí až vtedy, keď je predchádzajúca úloha dokončená. Škárovanie sa nedá dokončiť skôr, než je murivo hotové, ale môže začať skôr.
- **SF (začiatok-dokončenie).** Nasledujúca úloha sa dokončí až vtedy, keď sa predchádzajúca úloha začala. Tento typ je zriedkavý. Príklad: dočasné odvodnenie sa smie zastaviť až vtedy, keď sa začalo murovanie základov.

Závislosť môže mať aj **oneskorenie**: čakací čas medzi dvoma úlohami, napríklad betón, ktorý musí vytvrdnúť. Oneskorenie so zápornou hodnotou sa nazýva **predstih**: nasledujúca úloha potom začne skôr, než sa predchádzajúca úloha dokončí, takže sa úlohy prekrývajú.

## Ako aplikácia počíta

### Štyri typy

Pre každú závislosť aplikácia vypočíta najskorší dátum, kedy môže nasledujúca úloha začať, a použije najneskorší zo všetkých závislostí úlohy. Bez oneskorenia to funguje takto:

- Pri FS nasledujúca úloha začína prvým pracovným dňom po dokončení predchádzajúcej úlohy.
- Pri SS nasledujúca úloha začína v ten istý deň ako predchádzajúca úloha.
- Pri FF sa nasledujúca úloha dokončí v ten istý deň ako predchádzajúca úloha. Na zistenie začiatku aplikácia spätne odpočíta trvanie nasledujúcej úlohy. Nasledujúca úloha s trvaním 3 pracovné dni preto začína 2 pracovné dni pred dokončením predchádzajúcej úlohy.
- Pri SF sa nasledujúca úloha dokončí v deň, keď sa predchádzajúca úloha začína. Aj tu aplikácia spätne odpočíta trvanie nasledujúcej úlohy.

Ide o dolné hranice. Nasledujúca úloha začne neskôr, ak si to vyžaduje iná závislosť alebo obmedzenie. Všetky dátumy sa zobrazia až po príkaze **Prepočítať** (F5). Dokiaľ stavový riadok zobrazuje *Zastaralé — prepočítajte (F5)*, pruhy patria k predchádzajúcemu výpočtu.

### Oneskorenie a predstih

Oneskorenie sa dá zapísať štyrmi spôsobmi:

- Ako počet **pracovných dní** (`3` alebo `3d`): aplikácia preskakuje dni voľna a víkendy. Toto je predvolený spôsob.
- Ako **kalendárne dni** (`3ed`, e znamená *uplynutý* čas): počíta sa každý deň vrátane soboty a nedele. Táto jednotka sa hodí na dej, ktorý pokračuje bez práce, napríklad vytvrdnutie.
- Ako **percento** z trvania predchádzajúcej úlohy (`40%`): aplikácia to pri každom výpočte znova určí a zaokrúhli na celé dni (2,5 dňa sa zmení na 3).
- Ako hodiny **pracovnej doby** (`4h`): aplikácia počíta oneskorenie v kalendári oneskorenia, predvolene v kalendári predchádzajúcej úlohy. Ak je predchádzajúca úloha úloha v dňoch v kalendári bez vlastných blokov pracovného času, napríklad v štandardnom kalendári, aplikácia prevedie hodiny na celé pracovné dni, zaokrúhlené na najbližší celý deň (pol dňa sa zaokrúhli nahor). Pri pracovnom dni s 8 hodinami preto `2h` a `3h` dávajú 0 dní, `4h` až vrátane `11h` dávajú 1 deň a `12h` dáva 2 dni. Ak má tento kalendár vlastné bloky pracovného času alebo je predchádzajúca úloha hodinová úloha, oneskorenie sa počíta presne v hodinách pracovnej doby.

Pravidlo pre oneskorenie N pracovných dní pri FS: N pracovných dní po dokončení predchádzajúcej úlohy je čakací čas a nasledujúca úloha začína nasledujúci pracovný deň. Pri SS a FF sa oneskorenie pripočíta k začiatku, respektíve k dokončeniu predchádzajúcej úlohy. Oneskorenie so zápornou hodnotou sa počíta spätne: predstih o 1 pracovný deň pri FS umožní, aby nasledujúca úloha začala v deň, keď sa predchádzajúca úloha dokončí.

Predstih nemôže posunúť úlohu pred začiatok projektu. Ak by k tomu malo dôjsť, aplikácia nechá nasledujúcu úlohu na začiatku projektu a upozorní v paneli *Upozornenia*: *Predstih bol skrátený začiatkom projektu — závislosť nie je využitá v plnom rozsahu*.

### V ktorom kalendári sa oneskorenie počíta

Každá úloha môže mať svoj vlastný kalendár. Pri oneskorení v pracovných dňoch záleží na tom, ktorý kalendár počíta pracovné dni. Nastavenie *Kalendár oneskorenia* o tom rozhoduje a ponúka štyri možnosti: *Predchádzajúca úloha*, *Nasledujúca úloha*, *24-hodinový* a *Projektový kalendár*. Predvolene sa oneskorenie počíta v kalendári **predchádzajúcej úlohy**. Nastavenie nájdete v *Nastavenia › Projekt › Info o projekte*, v bloku *Profil výpočtu a možnosti výpočtu*, v riadku *Možnosti výpočtu tohto projektu*. Voľba patrí do súboru projektu a platí až potom, ako kliknete na tlačidlo *Použiť*; plán sa potom prepočíta.

Oneskorenie v kalendárnych dňoch (`3ed`) sa vždy počíta vo všetkých dňoch, bez ohľadu na to, ktorý *Kalendár oneskorenia* zvolíte.

### Závislosti na súhrnných úlohách

Závislosť môžete priradiť k fáze (súhrnnej úlohe) namiesto úlohy v nej. Interne aplikácia priradí túto závislosť ku každej úlohe vo fáze:

- Fáza ako **predchádzajúca úloha** pri FS alebo FF: nasledujúca úloha čaká, kým nie je dokončená úloha vo fáze, ktorá sa dokončí ako posledná.
- Fáza ako **nasledujúca úloha** pri FS alebo SS: každá úloha vo fáze čaká na predchádzajúcu úlohu, nezávisle od ostatných úloh vo fáze.
- Fáza ako **predchádzajúca úloha** pri SS alebo SF: nasledujúca úloha čaká na začiatok úlohy vo fáze, ktorá sa začne **ako posledná**, nie na začiatok samotnej fázy. Je to opatrnejšie, než by ste čakali: nasledujúca úloha nikdy nezačne príliš skoro, ale môže začať neskôr, než chcete. Ak chcete, aby nasledujúca úloha závisela od začiatku fázy, priraďte závislosť k prvej úlohe vo fáze.
- Fáza ako **nasledujúca úloha** pri FF alebo SF: každá úloha vo fáze musí sama splniť požiadavku na dokončenie (pri FF na deň dokončenia predchádzajúcej úlohy alebo neskôr, pri SF na deň začiatku predchádzajúcej úlohy alebo neskôr), aj úloha, ktorú bolo možné dokončiť oveľa skôr. Takúto závislosť radšej priraďte k poslednej úlohe vo fáze.

Závislosť medzi úlohou a fázou, v ktorej sa nachádza, nie je povolená.

### Určujúce závislosti

Ak má nasledujúca úloha viac predchádzajúcich úloh, zvyčajne jedna závislosť určuje jej dátum začiatku: závislosť, ktorá nedovolí, aby nasledujúca úloha začala o jeden deň skôr, než začína teraz. Taká závislosť sa nazýva **určujúca závislosť**. Pri zhode je určujúcich závislostí viac. Určujúcu závislosť spoznáte podľa symbolu blesku v stĺpci *Predchádzajúce úlohy* a v stĺpci *Nasledujúce úlohy* tabuľky, podľa stĺpca *Určujúca závislosť* (znamienko **+** vpravo v hlavičke tabuľky, pod *Závislosti*) a podľa silnejšieho odtieňa, keď sledujete cestu. Ako cestu otvoriť, je v článku [Sledovanie cesty](docs://howto-pad-traceren).

Určujúca závislosť hovorí o dátumoch, nie o trvaní. Krátka predchádzajúca úloha môže byť určujúca tiež, napríklad kvôli dlhému oneskoreniu; uvidíte to v príklade nižšie.

## Ukážkový príklad

Príklady používajú samostatné mini-projekty, všetky začínajú v pondelok 7. júna 2027, ak nie je uvedené inak. Pojmy ako kritická cesta a časová rezerva sú vysvetlené v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad). Vytvoriť sieť závislostí a overiť ju je to, čo robíte v návode 2, „Závislosti a kritická cesta“.

### Štyri typy vedľa seba

*Pour foundation* trvá 5 pracovných dní: od pondelka 7. júna do piatka 11. júna. *Build walls* (5 pracovných dní) nasleduje s FS a beží od pondelka 14. júna do piatka 18. júna. Štyri úlohy po 3 pracovné dni závisia od úlohy *Build walls*, každá s iným typom závislosti:

- *Place roof elements* (FS) začína v pondelok 21. júna, prvým pracovným dňom po murive, a je hotová v stredu 23. júna.
- *Pipework* (SS) začína v pondelok 14. júna spolu s murivom a je hotová v stredu 16. júna.
- *Pointing* (FF) musí byť dokončená v piatok 18. júna spolu s murivom. Pri 3 pracovných dňoch preto začína v stredu 16. júna.
- *Dewatering* (SF) sa musí dokončiť v pondelok 14. júna, v deň, keď sa začína murivo. Ak spätne odpočítame 3 pracovné dni (štvrtok 10., piatok 11., pondelok 14. júna), začiatok je vo štvrtok 10. júna.

Na kritickej ceste je iba *Place roof elements*; projekt je hotový v stredu 23. júna. *Pipework*, *Pointing* a *Dewatering* majú v tomto poradí časovú rezervu 5, 3 a 7 pracovných dní.

### Oneskorenie a predstih v číslach

*Pour foundation* je hotová v piatok 18. júna. *Build walls* (2 pracovné dni) nasleduje s FS. Takto oneskorenie mení dátum začiatku:

- Bez oneskorenia murivo začína v pondelok 21. júna.
- Pri oneskorení `3` (tri pracovné dni) sú čakacím časom pondelok 21., utorok 22. a streda 23. júna; murivo začína vo štvrtok 24. júna.
- Pri oneskorení `3ed` (tri kalendárne dni) sa počítajú sobota, nedeľa a pondelok; murivo začína v utorok 22. júna.
- Pri oneskorení `-1` (predstih o jeden pracovný deň) murivo začína v piatok 18. júna, v deň, keď je betonáž hotová.
- Pri oneskorení `40%` je oneskorenie 40 % z 5 pracovných dní, teda 2 pracovné dni; murivo začína v stredu 23. júna.
- Pri oneskorení `50%` je oneskorenie 2,5 pracovného dňa, zaokrúhlené na 3 pracovné dni; murivo začína vo štvrtok 24. júna.

### Ktorý kalendár počíta oneskorenie

*Build walls* (4 pracovné dni) je v kalendári projektu (pondelok až piatok) a je hotová vo štvrtok 10. júna. *Pointing* (2 pracovné dni) nasleduje s FS a oneskorením `3` a je v kalendári, v ktorom sú pracovné dni aj sobota a nedeľa. Potom dátum začiatku závisí od nastavenia *Kalendár oneskorenia*:

- *Predchádzajúca úloha* (predvolené): oneskorenie sa počíta v kalendári úlohy *Build walls*. Piatok 11., pondelok 14. a utorok 15. júna sú čakacím časom; *Pointing* začína v stredu 16. júna.
- *Nasledujúca úloha*: oneskorenie sa počíta v kalendári úlohy *Pointing*. Piatok 11., sobota 12. a nedeľa 13. júna sú čakacím časom; *Pointing* začína v pondelok 14. júna.
- *24-hodinový*: počíta sa každý kalendárny deň. Aj tu sú piatok, sobota a nedeľa čakacím časom; *Pointing* začína v pondelok 14. júna.
- *Projektový kalendár*: oneskorenie sa počíta v kalendári projektu, rovnako ako pri možnosti *Predchádzajúca úloha*; *Pointing* začína v stredu 16. júna.

### Závislosti na fáze

*Foundation* je fáza s dvoma úlohami: *Excavate* (2 pracovné dni, pondelok 7. a utorok 8. júna) a potom *Pour* (3 pracovné dni, streda 9. až piatok 11. júna). *Build walls* nasleduje po fáze *Foundation* s FS a začína v pondelok 14. júna: aplikácia ho nechá čakať na *Pour*, poslednú úlohu, ktorá sa dokončí.

Pri fáze ako nasledujúcej úlohe: *Permit* (3 pracovné dni, hotová v stredu 9. júna) ide s FS do fázy *Štruktúra*. Fáza obsahuje *Build walls* (4 pracovné dni) a potom *Lay floor* (2 pracovné dni). Každá úloha vo fáze čaká na *Permit*: *Build walls* začína vo štvrtok 10. júna a je hotová v utorok 15. júna. *Lay floor* čaká aj na murivo a beží od stredy 16. do štvrtka 17. júna.

Pri SS z fázy: fáza *Finishing* obsahuje *Plastering* (2 pracovné dni, 7. a 8. júna), potom *Painting* (3 pracovné dni, 9. až 11. júna) a potom *Snagging* (2 pracovné dni, 14. a 15. júna). *Cleaning* nasleduje po fáze s SS. Očakávali by ste začiatok v pondelok 7. júna, ale aplikácia nechá *Cleaning* čakať na začiatok úlohy *Snagging*, ktorá sa začne ako posledná: pondelok 14. júna.

### Čo je určujúce

*Pour foundation* (2 pracovné dni) beží od pondelka 7. do utorka 8. júna. Nasledujú dve vetvy:

- *Build walls* (5 pracovných dní): streda 9. až utorok 15. júna.
- *Order roof elements* (2 pracovné dni): streda 9. a štvrtok 10. júna.

*Place roof elements* (3 pracovné dni) nasleduje po oboch: s FS po murive a s FS a oneskorením `5` po objednávke (dodacia lehota). Od muriva by osadenie mohlo začať v stredu 16. júna. Od objednávky sú čakacím časom piatok 11., pondelok 14., utorok 15., streda 16. a štvrtok 17. júna; osadenie začína v piatok 18. júna. Závislosť s objednávkou je preto určujúca, hoci objednávka je oveľa kratšia než murivo. Murivo má časovú rezervu 2 pracovné dni.

## Dôsledky a omyly

**„Závislosť pevne určuje úlohy.“** Nie, závislosť je dolná hranica. Nasledujúca úloha začne najskôr na dátum, ktorý dáva závislosť, a neskôr, ak si to vyžiada iná závislosť alebo obmedzenie. Ako obmedzenia zapadajú, je vysvetlené v článku [Obmedzenia a termíny](docs://uitleg-constraints).

**„SS znamená, že úlohy začnú v rovnaký čas.“** SS len hovorí, že nasledujúca úloha nesmie začať pred predchádzajúcou úlohou. Ak má nasledujúca úloha inú predchádzajúcu úlohu, ktorá sa dokončí neskôr, začne neskôr.

**„Pri FF nasledujúca úloha začína v ten istý deň.“** Nie, pri FF sa zhodujú dátumy dokončenia. Krátka nasledujúca úloha preto začína neskôr než predchádzajúca úloha, ako *Pointing* v príklade.

**„Oneskorenie v dňoch počíta kalendárne dni.“** Predvolene aplikácia počíta oneskorenie ako pracovné dni v kalendári predchádzajúcej úlohy. Pri vytvrdzovaní alebo schnutí, kde sa počíta aj víkend, použijete kalendárne dni (`ed`).

**„Úloha bez závislostí nie je problém.“** Úloha bez predchádzajúcej úlohy začína v plánovanom dátume začiatku a úloha bez nasledujúcej úlohy dostane časovú rezervu až do konca projektu. Ak zabudnete pridať závislosť, úloha potom vyzerá, akoby mala veľa miesta; pozrite si omyly v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

**„Závislosť na fáze je jedna závislosť.“** Pri výpočte je to jedna závislosť na každú úlohu vo fáze. Ak presuniete úlohy do fázy alebo von z nej, závislosti, ktoré platia pre tieto úlohy, sa tiež zmenia.

## Pozri tiež

- [Pridanie závislostí](docs://howto-relaties-leggen): postup, ako prepojiť úlohy a nastaviť oneskorenie.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo aplikácia počíta z vašich závislostí a prečo sa úloha stane kritickou.
- [Obmedzenia a termíny](docs://uitleg-constraints): dohody o dátumoch spolu so závislosťami.
- [Sledovanie cesty](docs://howto-pad-traceren): zobrazenie reťazca pred úlohou alebo za úlohou.
- [Vytvorenie hamaka](docs://howto-hammock): úloha s odvodeným trvaním, zavesená na závislostiach typu SS a FF.
- [Prepojenia medzi projektmi](docs://howto-externe-relaties): závislosti s úlohou v inom súbore projektu.
