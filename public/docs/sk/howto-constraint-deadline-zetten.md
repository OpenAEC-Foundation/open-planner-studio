# Nastavenie obmedzenia alebo termínu

Cieľ: zaznamenať dohodu o dátume pri úlohe, aby plán s ňou počítal, alebo ukázal, že ju nedodržiavate.

## Kedy to potrebujete

Tehly sa dodajú až 21. júna, preto murovanie nesmie začať skôr: **obmedzenie** *začiatok nie skôr ako*. Strecha musí byť uzavretá pred stavebným sviatkom, teda kolektívnou dovolenkou. Ak chcete byť upozornení, keď to nevyjde, nastavte **termín**. Betónovanie je pevne určené na deň, lebo betonáreň to sľúbila: *musí začať dňa*. Ktorý typ sa hodí kedy a čo s ním aplikácia robí, vysvetľuje [Obmedzenia a termíny](docs://uitleg-constraints).

## Postup

V paneli *Vlastnosti* nastavíte obmedzenie a termín.

1. Vyberte úlohu. Ak nevidíte panel *Vlastnosti*, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. V poli *Obmedzenie* vyberte typ, napríklad *Začiatok nie skôr ako (SNET)*.
3. Pole *Dátum obmedzenia* sa zobrazí pri každom type okrem *Čo najskôr (ASAP)* a *Čo najneskôr (ALAP)*. Zadajte dátum do troch polí pre deň, mesiac a rok, napríklad 21, 06 a 2027, a stlačte Enter. Aplikácia sa sama presunie do ďalšieho poľa, keď je pole plné. Po výbere typu je dátum už vyplnený: dátum predchádzajúceho obmedzenia, alebo inak pôvodný plánovaný začiatok úlohy. Môže sa líšiť od začiatku, ktorý panel zobrazuje, preto vždy zadajte dátum, ktorý chcete, sami.
4. Ak chcete úlohu pevne ukotviť k dátumu aj pred jej predchádzajúcimi úlohami, vyberte *Musí začať dňa (MSO)* alebo *Musí skončiť dňa (MFO)* a zaškrtnite *Povinné (ukotvenie logiky)*. Je to pevné ukotvenie; používajte ho len pre dátum, ktorý je naozaj pevný.
5. Ak chcete aj druhú hranicu, napríklad úlohu, ktorá nesmie začať pred 14. júnom a musí byť dokončená do 17. júna, vyberte typ v poli *Sekundárne obmedzenie* a vyplňte *Sekundárny dátum*. Toto pole sa zobrazí pri každom obmedzení, ktoré má dátum, okrem pevného ukotvenia. Pri MSO a MFO sekundárne obmedzenie nie je povolené: aplikácia ho potom označí červenou farbou.
6. Ak chcete nastaviť termín, vyplňte pole *Termín* rovnakým spôsobom ako *Dátum obmedzenia*. Termín je samostatný od obmedzenia: obe môžete nastaviť pre tú istú úlohu.
7. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*. Dovtedy stavový riadok zobrazuje *Zastaralé — prepočítajte (F5)*.

Polia sú aj v okne *Upraviť úlohu*, ktoré otvoríte kliknutím pravým tlačidlom myši na úlohu a výberom položky *Upraviť...*; potvrdíte tlačidlom *Uložiť*.

V tabuľke pracujete so stĺpcami. Kliknite na **+** v hlavičke tabuľky a v časti *Obmedzenia* vyberte stĺpce *Typ obmedzenia*, *Dátum obmedzenia* a *Termín* (sú tam aj *Pevné obmedzenie*, *Typ sekundárneho obmedzenia* a *Dátum sekundárneho obmedzenia*). Dvakrát kliknite na bunku, ktorú chcete upraviť: typ vyberiete zo zoznamu a dátum zadáte s pomlčkami, napríklad 21-06-2027. *Pevné obmedzenie* sa dá zmeniť len pri MSO a MFO.

Ak má úloha predchádzajúcu úlohu, existuje skratka pre *začiatok nie skôr ako*: zadajte nový dátum začiatku do poľa *Začiatok* (v paneli *Vlastnosti*, v okne *Upraviť úlohu* alebo v tabuľke), alebo posuňte pruh v diagrame Gantt. Aplikácia z toho potom sama vytvorí obmedzenie *Začiatok nie skôr ako (SNET)* a dá vám to vedieť.

## Kontrola výsledku

- V diagrame Gantt je nad pruhom malý kosoštvorec: na strane začiatku pri obmedzení začiatku a na strane dokončenia pri obmedzení dokončenia. Modrá je pre SNET a FNET, fialová pre SNLT, FNLT, MSO a MFO, červená, ak je obmedzenie porušené. Pevné ukotvenie má ikonu špendlíka. Termín je šípka smerujúca nadol na dátume termínu: zelená, pokiaľ je úloha dokončená včas, červená, ak je neskoro.
- Porušené obmedzenie alebo zmeškaný termín sa zobrazí v paneli *Upozornenia* (*Plán › Plán › Upozornenia*) a v stavovom riadku. *Celková časová rezerva* úlohy a úloh pred ňou je potom záporná.
- Pri hornej hranici (*začiatok nie neskôr ako*, *dokončiť nie neskôr ako*) alebo pri termíne znamená absencia upozornenia, že plán dodržiava dátum.

## Odstránenie obmedzenia alebo termínu

V poli *Obmedzenie* znovu vyberte *Čo najskôr (ASAP)*. Tým sa odstráni aj sekundárne obmedzenie. Termín odstránite vyprázdnením troch polí a stlačením klávesu Enter. Potom stlačte **Prepočítať**.

## Úskalia a čo aplikácia robí

**Obmedzenie na fáze.** Obmedzenie alebo termín na fáze (súhrnnej úlohe) nemá žiadny účinok. Nastavte ho na samotnú úlohu.

**Úloha, ktorá už začala.** Ak má úloha skutočný začiatok alebo postup, zachová si svoj skutočný začiatok. *Začiatok nie skôr ako* s neskorším dátumom ju nepresunie.

**Zadanie dátumu začiatku vedľa iného obmedzenia.** Ak má úloha predchádzajúcu úlohu a už má iné obmedzenie, napríklad *Čo najneskôr (ALAP)*, aplikácia zadaný začiatok neuplatní. Hlásenie uvedie obmedzenie; ak chcete začiatok presunúť, zmeňte ho.

**Dátum cez víkend.** Dátum v sobotu, v nedeľu alebo vo voľný deň sa počíta ako pracovný deň: dolná hranica (*začiatok nie skôr ako*, *dokončiť nie skôr ako*) sa posunie na nasledujúci pracovný deň, horná hranica (*začiatok nie neskôr ako*, *dokončiť nie neskôr ako*) na predchádzajúci.

**Nepovolené sekundárne obmedzenie.** Aplikácia označí nepovolenú kombináciu červenou farbou spolu s dôvodom, napríklad *Primárne a sekundárne obmedzenie nesmie hraničiť na rovnakú stranu.* Sekundárne obmedzenie nie je povolené pri ASAP, ALAP, MSO, MFO a pevnom ukotvení.

**Pevné ukotvenie.** Pri prvom zapnutí aplikácia upozorní, že pevné ukotvenie prepíše závislosti. Úloha je potom na dátume, aj pred svojimi predchádzajúcimi úlohami; tieto predchádzajúce úlohy potom dostanú zápornú časovú rezervu.

**Nič sa nezmenilo po nastavení.** Obmedzenia sa uplatnia až po kliknutí na **Prepočítať**. Ak horná hranica (*začiatok nie neskôr ako*, *dokončiť nie neskôr ako*) nemá vplyv na pruhy, je to normálne: horná hranica nič nepresúva; ak dátum nie je splnený, spôsobí zápornú časovú rezervu.

## Pozri aj

- [Obmedzenia a termíny](docs://uitleg-constraints): čo robí každý typ a vysvetlenie pevného ukotvenia, zápornej časovej rezervy a termínu.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo záporná časová rezerva robí s kritickou cestou.
- [Závislosti a oneskorenie](docs://uitleg-relaties): závislosti, ktoré platia spolu s obmedzením.
- [Oznámenia a upozornenia](docs://ref-meldingen): upozornenia na porušené obmedzenie alebo zmeškaný termín.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): obmedzenie z povolenia *začiatok nie skôr ako* na *Demolish existing extension* (14. mája 2027) a termín, ktorý sa splní s dostatočnou rezervou.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): zámerne tesný termín na *Contractual project handover* (15. júla 2027): po prepočítaní je dokončenie 17. augusta a mnohé úlohy majú zápornú časovú rezervu.
