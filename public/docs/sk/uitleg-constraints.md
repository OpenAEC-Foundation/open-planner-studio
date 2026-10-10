# Obmedzenia a termíny

Tehly sa dodajú až 21. júna. Povolenie ešte neprišlo. Strecha musí byť uzavretá pred stavebným sviatkom. Závislosti zaznamenávajú, že úloha čaká na inú úlohu. Dohody o dátume však nevyplývajú z poradia prác. Na to slúžia obmedzenia a termíny. V tomto článku sa dozviete, čo robí každý typ, kedy sa úloha posunie a kedy sa mení iba časová rezerva, čo je pevné ukotvenie a ako aplikácia hlási konflikt.

Pravidlá a príklady platia pre nový projekt s profilom výpočtu *Open Planner Studio* a pracovným týždňom od pondelka do piatka.

## Pojem

**Obmedzenie** je dátumová hranica pre jednu úlohu, nezávislá od jej závislostí. Takáto hranica môže fungovať dvoma spôsobmi:

- Obmedzenie **posúva**: úloha nesmie začať ani skončiť skôr ako dátum. Ak by úloha kvôli svojim závislostiam začala skôr, presunie sa na tento dátum.
- Obmedzenie **stráží**: úloha musí začať alebo skončiť najneskôr v tomto dátume. Aplikácia nič nepresúva. Ak plán tento dátum nespĺňa, **časová rezerva** úlohy a reťazca pred ňou sa stane záporná. Časová rezerva je priestor, ktorý má úloha, kým sa posunie dátum dokončenia projektu. Záporná hodnota znamená, že na papieri už meškáte (pozri [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad)).

Termín je jednoduchšia forma stráženia: cieľový dátum dokončenia úlohy, bez toho, aby ju niečo presúvalo.

Všetky obmedzenia sú **mäkké**: výpočet pokračuje, aj keď dátum nie je splnený. Jedinou výnimkou je **pevné ukotvenie**, ktoré prepíše závislosti. Viac o ňom je uvedené nižšie.

## Ako aplikácia vypočítava

### Osem typov

Typ zvolíte pomocou poľa *Obmedzenie* v paneli *Vlastnosti*. Takto počíta každý typ:

- *Čo najskôr (ASAP)*: bez hranice. Toto je predvolené nastavenie: úloha začne čo najskôr, ako to dovolia jej závislosti.
- *Čo najneskôr (ALAP)*: úloha sa posunie čo najneskôr, bez toho, aby nasledujúca úloha musela začať neskôr. Preto využije svoju voľnú časovú rezervu. Ak jej po tom zostane celková časová rezerva, pretože nasledujúce úlohy majú vlastný priestor, zostane nekritická. Ak sa vyčerpá aj táto rezerva, úloha sa počíta ako kritická.
- *Začiatok nie skôr ako (SNET)*: dolná hranica pre začiatok. Ak by úloha začala skôr, presunie sa na dátum. Ak je dátum skorší, než dovoľujú závislosti, obmedzenie nič nerobí.
- *Dokončiť nie skôr ako (FNET)*: rovnako, ale pre dokončenie úlohy.
- *Začiatok nie neskôr ako (SNLT)* a *Dokončiť nie neskôr ako (FNLT)*: horná hranica pre začiatok alebo dokončenie. Nepresúvajú nič. Ak sa hranica nesplní, aplikácia nahlási porušené obmedzenie a časová rezerva sa stane záporná.
- *Musí začať dňa (MSO)* a *Musí skončiť dňa (MFO)*: dolná a horná hranica zároveň. Úloha sa presunie na dátum, ak je neskorší, než vyžadujú závislosti. Ak je dátum skorší, než dovoľujú závislosti, úloha ostane tam, kam ju postavili závislosti, a časová rezerva sa stane záporná.

Ak dátum pripadne na sobotu, nedeľu alebo nepracovný deň, aplikácia ho číta ako pracovný deň: dolnú hranicu (SNET, FNET) ako nasledujúci pracovný deň, hornú hranicu (SNLT, FNLT) ako predchádzajúci pracovný deň.

### Čo znamená záporná časová rezerva

Horná hranica pôsobí spätne. Ak obmedzenie položí neskorý dátum úlohy pred jej skorý dátum, celková časová rezerva sa stane záporná. Platí to aj pre úlohy pred ňou. Ak musí brickwork začať najneskôr v piatok 11. júna a nemôže začať skôr ako v pondelok 14. júna, úlohy pred brickwork tiež meškajú o jeden pracovný deň. Všetky úlohy so zápornou časovou rezervou sú kritické. Ako to funguje, vysvetľuje [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

Horná hranica nepresúva pruhy. Konflikt uvidíte v poli *Celková časová rezerva*, ktoré má zápornú hodnotu, v červenom kosoštvorci nad pruhom, v hlásení na stavovom riadku (napríklad *Porušené obmedzenia: 1*) a v paneli *Upozornenia*.

### Pevné ukotvenie

Pri MSO a MFO sa zobrazí začiarkavacie políčko *Povinné (ukotvenie logiky)*. Keď ho začiarknete, úlohu ukotvíte na dátume, aj keď jej predchádzajúce úlohy do tohto dátumu nie sú dokončené. Závislosti sa prepíšu takto:

- Úloha je na dátume (pri MSO sa na ňom začne, pri MFO sa na ňom skončí) a prekrýva sa s predchádzajúcimi úlohami.
- Predchádzajúce úlohy dostanú zápornú časovú rezervu. Aplikácia nahlási porušené obmedzenie, ak by závislosti dovolili úlohe začať neskôr, než je ukotvenie. Ukotvená úloha si sama ponechá časovú rezervu 0.
- Nasledujúce úlohy sa počítajú od ukotvenej úlohy. Môžu preto začať skôr, než by začali bez ukotvenia, aj keď logika pred ňou nie je dokončená. V príklade nižšie sa dátum dokončenia projektu kvôli tomu posunie o tri pracovné dni dopredu.

Keď prvýkrát zapnete ukotvenie, aplikácia zobrazí krátke vysvetlenie: pevné ukotvenie prepíše závislosti, pruh je pevne na dátume, aj pred svojimi predchádzajúcimi úlohami.

### Sekundárne obmedzenie

Úloha má jedno primárne obmedzenie. Ak chcete aj druhú hranicu, napríklad úlohu, ktorá nesmie začať skôr ako 14. júna a musí byť dokončená do 17. júna, pridáte **sekundárne obmedzenie**. Musí to byť skutočná hranica (SNET, FNET, SNLT alebo FNLT). Musí obmedzovať na opačnú stranu než primárne obmedzenie: dolná hranica (SNET alebo FNET) s hornou hranicou (SNLT alebo FNLT). SNET so SNLT je preto povolené, SNET s FNET nie je. Aplikácia ostatné kombinácie označí červenou farbou a uvedie dôvod, napríklad *Primárne a sekundárne obmedzenie nesmie hraničiť na rovnakú stranu.* Pri ASAP, ALAP, MSO, MFO a pevnom ukotvení sekundárne obmedzenie nie je povolené.

### Termín

Termín je samostatný dátum úlohy, popri obmedzení. Je to horná hranica dokončenia: nič nepresúva, ale ak úloha nie je dokončená včas, časová rezerva sa stane záporná. Aplikácia potom v paneli *Upozornenia* uvedie *Termín … zmeškaný — skoré dokončenie …* a stavový riadok spočíta zmeškané termíny. V diagrame Gantt je na dátume termínu šípka smerom nadol: zelená, kým je úloha dokončená včas, a červená, keď mešká. Termín na sobotu sa počíta až do piatku pred ním vrátane.

Pre časovú rezervu robí termín to isté ako FNLT. Rozdiel je v tom, ako ho používate. Termín je cieľový dátum, ktorý chcete strážiť. Stojí mimo obmedzenia, takže úloha môže mať obmedzenie aj termín. FNLT je obmedzenie: porušenie sa zobrazí ako porušené obmedzenie, nie ako zmeškaný termín.

### Čo obmedzenie nerobí

- Pri **fáze** (súhrnnej úlohe) obmedzenie ani termín neplatia: aplikácia počíta s úlohami vo fáze. Nastavte ho priamo na úlohu.
- Úloha, ktorá už má skutočný začiatok alebo postup, si tento začiatok ponechá. SNET s neskorším dátumom ju nepresunie.
- **Zadanie dátumu začiatku** pri úlohe s predchádzajúcou úlohou nefunguje ako pevný začiatok: rozhoduje ďalej predchádzajúca úloha. Preto aplikácia zadaný dátum premení na SNET. Stane sa tak v paneli *Vlastnosti*, v okne *Upraviť úlohu*, v tabuľke a vtedy, keď pruh v diagrame Gantt presuniete. Aplikácia vás o tom informuje. Ak úloha už má iné obmedzenie (napríklad ALAP alebo MSO), aplikácia nový začiatok neuplatní a aj o tom vás informuje. Potom zmeňte toto obmedzenie.

Všetky zmeny sa zobrazia až po spustení príkazu **Prepočítať** (F5).

## Prepracovaný príklad

Príklad je malá sieť úloh pre prístavbu domu. Začína v pondelok 7. júna 2027:

- *Groundwork* (3 pracovné dni): pondelok 7. až streda 9. júna.
- *Pour foundation* (2): štvrtok 10. a piatok 11. júna.
- *Brickwork* (5): pondelok 14. až piatok 18. júna.
- *Roofing* (3): pondelok 21. až streda 23. júna.
- *Scaffolding* (2): nadväzuje na úlohu *Pour foundation* a predchádza úlohe *Roofing*. Beží v pondelok 14. a v utorok 15. júna a má 3 pracovné dni časovej rezervy.

Kritická cesta je *Groundwork*, *Pour foundation*, *Brickwork* a *Roofing*. Projekt skončí v stredu 23. júna. Čo sa zmení, ak pri *Brickwork* nastavíte jedno obmedzenie?

- **SNET pondelok 21. júna** (tehly prídu až vtedy): *Brickwork* beží od pondelka 21. do piatka 25. júna, *Roofing* od pondelka 28. do stredy 30. júna. Projekt skončí v stredu 30. júna. *Groundwork* a *Pour foundation* teraz majú 5 pracovných dní časovej rezervy a nie sú kritické. *Scaffolding* má 8 pracovných dní.
- **SNET streda 9. júna**: bez účinku. Závislosti aj tak dovolia začať *Brickwork* až v pondelok 14. júna.
- **SNLT streda 16. júna**: bez účinku. *Brickwork* začína v pondelok 14. júna a hranicu spĺňa s rezervou.
- **SNLT piatok 11. júna**: príliš tesné. *Brickwork* aj tak začína v pondelok 14. júna, o jeden pracovný deň neskoro. *Groundwork*, *Pour foundation* a *Brickwork* dostanú −1 pracovný deň časovej rezervy a aplikácia hlási *Logika plánu prekračuje obmedzenie Začiatok nie neskôr ako (SNLT) 11-06-2027 (záporná časová rezerva)*. Nič sa nepresunie.
- **MSO streda 16. júna** (bez pevného ukotvenia): *Brickwork* sa presunie na stredu 16. júna a skončí v utorok 22. júna. *Roofing* beží od stredy 23. do piatka 25. júna, projekt skončí v piatok 25. júna.
- **MSO piatok 11. júna** (bez pevného ukotvenia): dátum je skorší, než dovoľujú závislosti. *Brickwork* aj tak začína v pondelok 14. júna a časová rezerva sa stane −1, rovnako ako pri SNLT.
- **MSO streda 9. júna s pevným ukotvením**: *Brickwork* začína v stredu 9. júna a skončí v utorok 15. júna, kým *Pour foundation* stále beží do piatka 11. júna. *Roofing* beží od stredy 16. do piatka 18. júna: projekt skončí o tri pracovné dni skôr, než bez ukotvenia. *Groundwork* a *Pour foundation* dostanú −3 pracovné dni časovej rezervy.

A pri obmedzení alebo termíne na inej úlohe:

- **ALAP** pri úlohe *Scaffolding*: úloha sa presunie na štvrtok 17. a piatok 18. júna, čo je najneskorší okamih pred *Roofing*. *Roofing* je jej jediná nasledujúca úloha a mala priestor presne na 3 pracovné dni časovej rezervy. Tie sú teraz vyčerpané a *Scaffolding* je kritická.
- **SNET sobota 19. júna** pri úlohe *Scaffolding*: hranica sa počíta ako pondelok 21. júna. *Scaffolding* beží v pondelok 21. a v utorok 22. júna a *Roofing* sa posunie na stredu 23. až piatok 25. júna.
- **Termín piatok 18. júna** pri úlohe *Roofing*: nič sa nepresunie. *Roofing* zostane od pondelka 21. do stredy 23. júna. *Groundwork*, *Pour foundation*, *Brickwork* a *Roofing* dostanú −3 pracovné dni časovej rezervy a aplikácia hlási *Termín 18-06-2027 zmeškaný — skoré dokončenie 23-06-2027*. *Scaffolding* si ponechá 0 pracovných dní časovej rezervy a tiež sa stane kritická.
- **SNET pondelok 21. júna** pri úlohe *Brickwork*, **termín piatok 25. júna** pri úlohe *Roofing*: obmedzenie posunie *Brickwork* o týždeň neskôr a aplikácia hlási, že *Roofing* mešká v stredu 30. júna. *Brickwork* a *Roofing* dostanú −3 pracovné dni časovej rezervy; *Groundwork* a *Pour foundation* si ponechajú 2 pracovné dni časovej rezervy.

V návode 3 nastavíte sami obmedzenie a termín v projekte návodu a uvidíte, ako sa plán posunie.

## Dôsledky a časté omyly

**„Obmedzenie presúva úlohu.“** Iba SNET, FNET, MSO a MFO môžu úlohu posunúť neskôr, než vyžadujú jej závislosti, a ALAP ju môže posunúť čo najneskôr v rámci svojej voľnej časovej rezervy. SNLT a FNLT nikdy nič nepresúvajú: iba upozorňujú. Splniť dátum potom znamená skrátiť reťazec pred ním.

**„Záporná časová rezerva je chyba aplikácie.“** Je to signál, že plán je v konflikte s vašou dohodou o dátume. Vyriešite ju skrátením reťazca, zmiernením dohody alebo tak, že konflikt vedome prijmete.

**„Pevné ukotvenie vyrieši konflikt.“** Pevné ukotvenie konflikt skrýva: úloha je na dátume, ale jej predchádzajúce úlohy na ňu nie sú pripravené, a nasledujúce úlohy sa počítajú, akoby pripravené boli. Použite ho iba pri dátume, ktorý je naozaj pevný, napríklad pri zákonnom dátume odovzdania, a nie ako spôsob, ako dostať úlohu na dátum.

**„Stačí mi zadať dátum začiatku.“** Pri úlohe s predchádzajúcou úlohou sa zadaný dátum stane SNET. Ak je tento dátum skorší, než dovoľuje predchádzajúca úloha, nerobí nič.

**„Termín, alebo FNLT?“** Zvoľte termín pre cieľový dátum, ktorý chcete strážiť, a obmedzenie pre dátum, ktorý je naozaj hraničnou podmienkou plánu.

**„Obmedzenie na fáze.“** To neplatí. Nastavte ho priamo na úlohu.

## Pozri aj

- [Nastavenie obmedzenia alebo termínu](docs://howto-constraint-deadline-zetten): kroky na nastavenie obmedzenia alebo termínu.
- [Závislosti a oneskorenie](docs://uitleg-relaties): závislosti, ktoré stoja popri obmedzeniach.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): ako vzniká záporná časová rezerva a aký má vplyv na kritickú cestu.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): pevné ukotvenie (*Musí začať dňa (MSO)*) pri *Municipal road closure (permitted closure period)* a sekundárne obmedzenie (*Začiatok nie neskôr ako (SNLT)*) pri *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): termín, ktorý sa nesplnil, so zápornou časovou rezervou.
