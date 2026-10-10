# Rozdelenie úlohy

Cieľ: vložiť do úlohy prestávku, aby sa práca zastavila a neskôr pokračovala, bez toho, aby sa z nej stali dve úlohy.

## Kedy to potrebujete

Kladenie výstuže trvá osem pracovných dní. Po štyroch dňoch však musí žeriav odísť na inú stavbu a práca pokračuje o dva dni neskôr. Ak urobíte dve samostatné úlohy, musíte závislosti a priradenia udržiavať dvakrát. S **prestávkou** zostane jedna úloha, s jedným pruhom, ktorý má medzeru. Aplikácia pre ňu používa aj výraz *prestávka*.

Rozsah práce zostane rovnaký, ale úloha teraz trvá dlhšie v kalendári. Príklad: úloha s trvaním 8 pracovných dní, ktorá začína v utorok 29. septembra 2026, sa dokončí vo štvrtok 8. októbra. Ak po 4 pracovných dňoch vložíte prestávku v dĺžke 2 pracovných dní, dokončí sa v pondelok 12. októbra. Trvanie zostane 8 pracovných dní, mení sa len dokončenie, a to o dva pracovné dni.

## Kroky

### Rozdelenie v diagrame Gantt

1. Vyberte *Domov › Úlohy › Rozdeliť úlohu* (alebo *Plán › Závislosti › Rozdeliť úlohu*). Nad plánom sa zobrazí upozornenie *Kliknite na pruh v deň, keď prestávka začína, a potiahnite doprava pre jej trvanie. Esc ukončí*. Tlačidlo je aj na karte *Tabuľka* (*Tabuľka › Úlohy › Rozdeliť úlohu*), ale tam je vypnuté.
2. Presuňte myš nad pruh. Čiarkovaná čiara a popis s dátumom ukazujú, kde by prestávka začala. Stlačte tlačidlo myši na pruhu v deň, keď prestávka začína.
3. Potiahnite doprava. Popis ukazuje dĺžku, napríklad *Prestávka: 2 pracovné dni*: vzdialenosť v pracovných dňoch k dňu pod myšou. Pustite tlačidlo myši.

Ak len kliknete bez potiahnutia, prestávka bude trvať jeden pracovný deň. Potiahnutím doľava sa prestávka opäť skráti, najmenej na jeden pracovný deň. Pri hodinovej úlohe sa počíta v hodinách.

Režim zostane zapnutý, takže môžete rozdeliť ďalšie úlohy. Ukončíte ho klávesom Esc alebo tlačidlom *Zastaviť* v upozornení. Ak počas potiahnutia stlačíte Esc, aplikácia prestávku zruší a režim sa ukončí. Každé potiahnutie je jeden krok, ktorý vrátite príkazom *Vrátiť späť*.

Po rozdelení váš plán už nie je aktuálny. Stlačte **Prepočítať** (F5), aby ste získali konečné dátumy.

### Presúvanie existujúcej prestávky v diagrame Gantt

Funguje to bez režimu rozdelenia, priamo na pruhu, ktorý má prestávku.

- Potiahnite časť **za** prestávkou doprava alebo doľava. Prestávka sa predĺži alebo skráti, popis je *Prestávka: 3 pracovné dni*. Ak ju potiahnete späť, kým prestávka nebude 0, popis ukazuje *Zlúčiť* a obe časti tvoria opäť jednu úlohu.
- Potiahnite pravý okraj časti **pred** prestávkou. Táto časť sa predĺži alebo skráti, popis je *Časť: 5 pracovných dní*. Trvanie úlohy sa s ňou zmení.
- Ak potiahnete prvú časť, presuniete celú úlohu, ako pri každom pruhu.

### Rozdelenie a úprava v paneli vlastností

Vyberte úlohu. V paneli *Vlastnosti* je sekcia *Prestávky* pod sekciou *Závislosti* a nad sekciou *Priradenia*. Ak je to potrebné, posuňte sa k nej.

- *Pridať prestávku* vloží prestávku v dĺžke jedného pracovného dňa uprostred najdlhšej časti.
- Každá prestávka má dve polia: *po* (koľko pracovných dní práce je pred prestávkou) a *prestávka* (dĺžka prestávky). Vedľa nich sú dátumy časti za prestávkou. Pri hodinovej úlohe zobrazujú hodiny.
- Ak nastavíte pole *prestávka* na 0, prestávka zmizne. Malý kôš (*Odstrániť prestávku*) robí to isté.

Dajte pozor na *po*: toto pole predĺži alebo skráti časť práce pred prestávkou a s ňou aj trvanie celej úlohy. Pri poli *prestávka* sa mení iba dokončenie.

### Odstránenie prestávky

Kliknite pravým tlačidlom myši na prestávku v diagrame Gantt alebo na časť za ňou a vyberte *Odstrániť prestávku*. *Odstrániť všetky prestávky* je v kontextovej ponuke každého pruhu, ktorý má prestávku. Alebo použite sekciu *Prestávky* v paneli *Vlastnosti*, ako je uvedené vyššie.

### S AI asistentom

Pripojený AI asistent nastaví prestávky nástrojom `planner_set_task_splits`, v rovnakej podobe ako panel: po koľkých pracovných dňoch (alebo pracovných hodinách) práce a koľko pracovných dní (alebo pracovných hodín) prestávky. Vždy pošle celý zoznam; prázdny zoznam odstráni všetky prestávky. Prestávky načíta späť nástrojom `planner_get_task`. Platia rovnaké pravidlá ako nižšie: úlohu, ktorú nemôžete rozdeliť, nemôže rozdeliť ani asistent. Na rozdiel od rozdelenia, ktoré urobíte sami, aplikácia plán po zmene prepočíta sama. Ako pripojiť asistenta, je popísané v článku [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen).

## Úskalia a čo aplikácia robí

**Nie každú úlohu možno rozdeliť.** Nemôžete rozdeliť medzník, súhrnnú úlohu, úlohu so zapnutým *Hamak (odvodené trvanie)* (pozri [Vytvorenie hamaka](docs://howto-hammock)), úlohu s typom trvania *Uplynulé trvanie*, úlohu, ktorá je *Manuálne plánovaná*, ani úlohu kratšiu ako dva pracovné dni. V režime rozdelenia sa pri myši zobrazí zakázaný kurzor a nič sa nestane. Pri takej úlohe v paneli *Vlastnosti* chýba aj sekcia *Prestávky*.

**Na karte Tabuľka tlačidlo nefunguje.** *Rozdeliť úlohu* je tam vypnuté, s popisom *Dostupné len vtedy, keď je Gantt zobrazený*. Gesto potrebuje pruh. Režim rozdelenia a režim prepojenia sa navzájom vypnú.

**Klik bez účinku.** Prestávka nemôže začať prvým dňom úlohy ani vnútri existujúcej prestávky. Každá časť práce musí tiež zostať aspoň jeden pracovný deň dlhá. Ak kliknete na takéto miesto, nič sa nestane a nezobrazí sa žiadne upozornenie.

**Úloha s postupom.** Ak úloha má postup, prestávka môže začať až po práci, ktorá je už hotová. Pri 50% z 8 pracovných dní je to najskôr piaty pracovný deň. Klik v hotovej časti nič nerobí. Úloha, ktorej percento dokončenia je 100%, sa už nedá rozdeliť. Vtedy je v paneli vypnuté tlačidlo *Pridať prestávku*. To platí aj vtedy, keď stred najdlhšej časti pripadne na hotovú prácu, napríklad pri 75% z 8 pracovných dní.

**Vyvažovanie tiež vytvára prestávky.** Zobrazia sa v sekcii *Prestávky* s popisom *vyvažovanie*. *Zdroje › Vyvažovanie › Zrušiť vyvažovanie* ich odstráni. Ak sami upravíte prestávky takej úlohy, všetky jej prestávky z vyvažovania sa stanú vaše a *Zrušiť vyvažovanie* ich už neodstráni.

**Prestávky sa neprenášajú do MS Project ani do Primavery.** Ak exportujete do *MS Project XML* alebo *Primavera P6 XML*, tento program pozná prestávku len ako rozloženie práce v priradení. Bez takého rozloženia úloha príde bez prestávky a aplikácia oznámi, koľko takých úloh to je: *1 úloha s prestávkami bola exportovaná bez prestávok: MS Project a P6 ich poznajú len ako rozloženie práce*. V súbore IFC aplikácie sa prestávky zachovajú.

**Súbor s prestávkami, ktoré aplikácia nedokáže upraviť.** Prestávky zo zdrojového súboru, ktoré nezodpovedajú štruktúre aplikácie, zobrazia v paneli upozornenie *Tieto prestávky pochádzajú zo zdrojového súboru v tvare, ktorý sa tu nedá upraviť* a v paneli je iba tlačidlo *Odstrániť všetky prestávky*.

## Pozri tiež

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): ako plán počíta v pracovných dňoch a prečo sa dokončenie posúva.
- [Pridávanie závislostí](docs://howto-relaties-leggen): ďalší režim v diagrame Gantt, ktorý použijete potiahnutím pruhu.
- [Dialóg úlohy a panel vlastností](docs://ref-taak-eigenschappen): sekcia Prestávky v paneli vlastností.
