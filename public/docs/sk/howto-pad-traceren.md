# Sledovanie cesty

Cieľ: zobraziť reťaz úloh pred alebo za úlohou, aby ste videli, čo určuje dátum úlohy a čo sa posunie, ak mešká.

## Kedy to potrebujete

Strešné práce sa začnú až o tri týždne a chcete vedieť, ktorá úloha to určuje. Alebo murár mešká o týždeň a chcete vidieť, ktoré úlohy po ňom sa posunú. V pláne s desiatkami závislostí to z čiar nevidíte. Pomocou **sledovania cesty** aplikácia zafarbí všetky **predchádzajúce úlohy** (úlohy, ktoré sú pred vybranou úlohou, priamo alebo cez iné úlohy) a **nasledujúce úlohy** (úlohy, ktoré sú za ňou) a ostatné stlmí.

## Postup

1. Vyberte úlohu, ktorej cestu chcete vidieť, v tabuľke úloh alebo na jej pruhu v diagrame Gantt. Ak vyberiete viac úloh, aplikácia sleduje cestu od úlohy, ktorú ste vybrali ako prvú.
2. Ak chcete vidieť všetko pred úlohou, vyberte *Plán › Sledovanie cesty › Predchádzajúce úlohy*. Ak chcete vidieť všetko za úlohou, vyberte *Plán › Sledovanie cesty › Nasledujúce úlohy*. Obe tlačidlá môžu byť zapnuté naraz. Tie isté dve tlačidlá sú na karte *Tabuľka*, v skupine *Sledovanie cesty*.
3. Ak chcete obe smery naraz, kliknite na úlohu pravým tlačidlom, v diagrame Gantt alebo v tabuľke úloh, a vyberte *Sledovať cestu*.
4. Pozrite sa na výsledok v diagrame Gantt a v tabuľke úloh. Ako ho čítať, je vysvetlené nižšie.
5. Sledovanie zastavíte tak, že znova kliknete na aktívne tlačidlo, alebo kliknete pravým tlačidlom na úlohu a vyberiete *Zastaviť sledovanie cesty*, alebo stlačíte Esc. Esc zároveň zruší výber.

Ak počas sledovania vyberiete inú úlohu, cesta sa prispôsobí novému výberu.

## Ako čítať výsledok

- Predchádzajúce úlohy sú zlaté, nasledujúce úlohy fialové. V diagrame Gantt sa pruhy zafarbia, v tabuľke úloh sa vľavo od riadku objaví prúžok: plný pre predchádzajúce úlohy, prerušovaný pre nasledujúce úlohy. Vybraná úloha má obrys.
- Tmavšia farba, v tabuľke úloh hrubší prúžok s tučným textom, označuje reťaz **určujúcich závislostí**: závislostí, ktoré skutočne určujú dátumy. Čo to znamená, vysvetľuje [Závislosti a oneskorenie](docs://uitleg-relaties).
- Všetky úlohy mimo cesty sú stlmené. Čiary závislostí, ktoré do cesty nepatria, sú bledšie a bodkované.

## Úskalia a čo aplikácia robí

**Nie je vybraná úloha.** Bez vybranej úlohy nie je čo sledovať: tlačidlo je zapnuté, ale na obrazovke sa nič nezmení. Najprv vyberte úlohu.

**Žiadne zvýraznenie reťaze určujúcich závislostí.** Zvýraznenie vychádza z posledného prepočtu. Ak plán ešte nebol prepočítaný, alebo prepočet hlási chybu, aplikácia zafarbí všetky predchádzajúce a nasledujúce úlohy rovnako silno. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*, a pozrite sa na cestu znova. Po zmene zostáva zvýraznenie pri predchádzajúcom prepočte, kým stavový riadok zobrazuje *Zastaralé — prepočítajte (F5)*.

**Závislosť na fáze.** Sledovanie ide po závislostiach tak, ako ste ich vytvorili. Závislosť z fázy alebo do fázy (súhrnnej úlohy) spája samotnú fázu. Pri prepočte platí pre každú úlohu v tejto fáze, ale cesta nepokračuje do úloh vnútri nej. Ak sledujete úlohu vnútri fázy, ktorá je naviazaná na inú úlohu závislosťou na samotnej fáze, túto závislosť preto nevidíte. V takom prípade vyberte samotnú fázu.

**Iba zvolený smer.** Ak je zapnuté iba *Predchádzajúce úlohy*, nevidíte, čo je za úlohou, a naopak.

## Pozri aj

- [Závislosti a oneskorenie](docs://uitleg-relaties): prečo je závislosť určujúca a ako aplikácia počíta dátum začiatku úlohy.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): ktorá reťaz určuje koniec projektu.
- [Pridanie závislostí](docs://howto-relaties-leggen): pridanie závislosti, ak vám v ceste chýba prepojenie.
