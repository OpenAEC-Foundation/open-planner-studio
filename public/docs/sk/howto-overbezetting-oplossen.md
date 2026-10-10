# Riešenie preťaženia

Cieľ: zistiť, kde má zdroj v jeden deň priveľa práce, a to odstrániť, zvyčajne vyvažovaním úloh.

## Kedy to potrebujete

Na papieri váš plán funguje, ale bricklayer pracuje na dvoch stenách, ktoré sa stavajú v tých istých dňoch. Aplikácia to nazýva **preťaženie**. Zdroj je v pracovnom dni preťažený, ak mu plán v ten deň žiada viac, než je jeho kapacita (*Maximálny počet jednotiek*), alebo ak podľa svojho kalendára v ten deň nepracuje.

Najprv zistite preťaženie. Potom vyberiete riešenie. **Vyvažovanie** je riešenie, ktoré aplikácia vypočíta za vás: úlohy začínajú neskôr, kým ich zdroj zvládne. Ako to presne počíta, si prečítajte v článku [Vyvažovanie zdrojov](docs://uitleg-nivelleren).

## Kroky

### 1. Zistite preťaženie

1. Pozrite sa na pás s nástrojmi, na *Zdroje › Preťaženie*. Tam je buď *Žiadne*, alebo červeným písmom počet preťažených zdrojov, napríklad *1 zdroj*. Po prepočítaní stavový riadok zobrazí aj *⚠ Preťažené zdroje: 1*.
2. Kliknite na toto hlásenie v stavovom riadku. Vpravo sa otvorí panel *Upozornenia* s riadkom pre každý zdroj, napríklad *Bricklayer* s hlásením *Preťaženie, počet dní: 5 (29-06-2027 – 05-07-2027)*.
3. Kliknite na tento riadok. Aplikácia zapne histogram, vyberie zdroj a označí všetky úlohy, na ktorých zdroj pracuje.
4. Pozrite sa na histogram pod diagramom Gantt. Červené stĺpce sú preťažené dni. Ak prejdete myšou po dni, uvidíte, ktoré úlohy sa na ňom podieľajú, napríklad *2 úlohy prispievajú na 2027-06-30* s názvami pod tým.

Histogram môžete zapnúť aj sami cez *Zdroje › Histogram › Histogram*. Vyberte zdroj v zozname vľavo, alebo prechádzajte zdroje tlačidlami *Predchádzajúci* a *Nasledujúci*. Červená bodka v zozname znamená, že zdroj je preťažený. Riadok *Všetky zdroje* sčíta zdroje dohromady, bez materiálu.

Ak je vybraná úloha, histogram zobrazí len zaťaženie tej úlohy a len zdroje, ktoré na nej sú. Stlačte kláves Esc. Tým zrušíte výber a znova uvidíte celý projekt.

### 2. Vyberte riešenie

- **Vyššia kapacita.** Ak naozaj príde druhý bricklayer, nastavte *Maximálny počet jednotiek* na 2 (pozri [Správa zdrojov](docs://howto-resources-beheren)). Preťaženie potom zmizne.
- **Menej jednotiek za deň.** Znížte *Jedn./deň* alebo vyberte pre priradenie inú krivku (pozri [Priradenie zdrojov s krivkou](docs://howto-resource-toewijzen)).
- **Úlohy za sebou.** Pridajte závislosť medzi dvoma úlohami, aby druhá začala až po dokončení prvej (pozri [Pridávanie závislostí](docs://howto-relaties-leggen)).
- **Vyvažovanie.** Aplikácia nechá úlohu začať neskôr.

### 3. Vyvažovanie

1. Skontrolujte, či je plán prepočítaný príkazom **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*.
2. Vyberte *Zdroje › Vyvažovanie › Vyvažovať…*. Otvorí sa okno *Vyvažovanie zdrojov*.
3. Rozhodnite, či sa môže dátum dokončenia projektu posunúť. Ak políčko *Vyvažovať len v rámci časovej rezervy (vyhladzovanie) — dátum dokončenia projektu zostane pevný* necháte vypnuté, dátum dokončenia sa môže posunúť. Ak ho zapnete, aplikácia posúva úlohy len v rámci ich časovej rezervy.
4. Pod nadpisom *Zdroje* sú zdroje, ktoré sa vyvážia. Ako predvolené sú označené všetky zdroje okrem materiálu. Odznačte zdroj, ktorý chcete nechať bez zmeny.
5. Kliknite na *Prepočítať*. Počas výpočtu sa zobrazuje *Prepočítava sa…* a výpočet môžete zastaviť tlačidlom *Zastaviť*. Plán sa zatiaľ nemení: ide o návrh.
6. Prečítajte si návrh. Hore je dátum dokončenia, napríklad *Dátum dokončenia projektu: bez zmeny (30-08-2027)* alebo *Dátum dokončenia projektu: 25-08-2027 → 30-08-2027*. Pod ním je tabuľka. Pre každú úlohu je v nej *Pôvodný začiatok*, *Nový začiatok* a *Posunuté dni*, napríklad *Build outer cavity leaf*, 29-06-2027, 06-07-2027 a *5 d*.
7. Vyberte *Použiť*. Aplikácia zapíše odklady do úloh a plán hneď prepočíta. Stlačenie F5 nie je potrebné. *Zrušiť* zavrie okno bez zmeny.
8. Skontrolujte *Zdroje › Preťaženie*. Teraz je tam *Žiadne*.

Ak zmeníte možnosť v okne po tom, ako ste kliknuli na *Prepočítať*, návrh zmizne. Potom znova kliknite na *Prepočítať*. Ak sa plán zmení, kým aplikácia počíta, zobrazí sa *Plán sa počas výpočtu zmenil. Znova kliknite na Prepočítať.*

### Rozhodnutie, ktorá úloha ostane na mieste

Aplikácia umiestňuje úlohy jednu po druhej. Úlohy, ktoré sú v pláne skôr, ostanú tam, kde sú. Najprv idú úlohy s najvyššou prioritou. Pri rovnakej priorite ide prvá úloha s najmenšou časovou rezervou.

Ak chcete sami určiť, ktorá úloha ostane na mieste, dajte jej vyššiu prioritu. Kliknite pravým tlačidlom na pruh úlohy v diagrame Gantt a vyberte *Priorita*, potom *Nízka* (100), *Normálna* (500) alebo *Vysoká* (900). *Normálna* je predvolená hodnota. Číslo od 0 do 1000 môžete zadať aj sami v stĺpci *Priorita vyvažovania*: kliknite na **+** vpravo v hlavičke tabuľky úloh (*Pridať stĺpec*) a vyberte tento stĺpec v skupine *Plánovanie*. Vyššie číslo znamená, že úloha pravdepodobnejšie ostane na mieste. Aplikácia neprijme číslo nad 1000. Úloha s prioritou 1000 sa kvôli kapacite nikdy nepresunie.

### Vrátenie späť a opakovanie

- *Vrátiť späť* (Ctrl+Z) zruší *Použiť* v jednom kroku.
- *Zdroje › Vyvažovanie › Zrušiť vyvažovanie* odstráni všetky vyvažovania z úloh. Tlačidlo je sivé, kým nie je žiadne vyvažovanie. Preťaženie, ktoré takto vrátite, sa jednoducho znova objaví.
- Ak ste odvtedy plán zmenili, jednoducho znova vyberte *Vyvažovať…*. Aplikácia potom začne od začiatku: staré odklady sa nepočítajú.

## Časté problémy a čo vtedy robí aplikácia

**Ešte nie je prepočítané.** Ak plán nebol prepočítaný, okno zobrazí *Pred vyvažovaním najprv prepočítajte plán (F5)* a tlačidlo *Prepočítať* nie je dostupné.

**Zostávajúce konflikty.** Nie každé preťaženie sa dá vyriešiť posúvaním. Úlohy, ktoré zostanú, sú uvedené pod nadpisom *Zostávajúce konflikty* s počtom dní a dôvodom:

- *V rámci časovej rezervy nie je dostatok voľnej kapacity na vyriešenie tohto konfliktu.* Uvidíte to pri možnosti *vyhladzovanie*: v rámci časovej rezervy úlohy nie je žiadny voľný okamih. Odznačte políčko a dátum dokončenia sa môže posunúť.
- *Zdroj v niektoré dni, ktoré táto úloha potrebuje, nepracuje — posunutie to nevyrieši.* Zdroj má vo svojom kalendári uprostred úlohy dni voľna. Zmeňte kalendár alebo úlohu.
- *Bricklayer má v špičke 2 jedn./deň, kapacita je 1 — posunutím sa to nedá vyriešiť.* Podľa svojej krivky úloha sama žiada v jeden deň viac, než zdroj dokáže dodať. Vyberte inú krivku alebo znížte jednotky.

**Okno zobrazí** *Žiadne úlohy sa nemusia posunúť — plán je už bez konfliktov.* Ak sa tento riadok objaví spolu so zoznamom *Zostávajúce konflikty* v návrhu, verte zoznamu. Riadok len hovorí, že nie je čo posúvať. Ak sa riadok objaví bez zoznamu, hoci *Zdroje › Preťaženie* stále hlási zdroj, potom sú všetky kolidujúce úlohy s prioritou 1000 alebo sa už začali. Nehýbu sa a okno ich nehlási ako konflikt. Preto po použití vždy pozrite na *Preťaženie*.

**Úlohy, ktoré sa neposúvajú.** Úloha, ktorá sa už začala alebo je dokončená, sa nikdy neposúva. Jej zaťaženie sa však počíta. Medzníky a fázy sa tiež neposúvajú.

**Materiál sa nevyvažuje.** Ak zdroj materiálu žiada na deň viac, než je jeho *Maximálny počet jednotiek*, počíta sa ako preťažený v položke *Preťaženie*, ale nie je v okne vyvažovania.

**Vyvažovanie sa neprispôsobí.** Odklady zostanú také, aké sa vypočítali. Ak neskôr zmeníte trvanie úlohy, vyvážená úloha ostane tam, kde je, aj keď to miesto už nie je potrebné. Potom vyvažujte znova.

**Preťaženie kvôli kalendáru.** Ak zdroj podľa svojho kalendára v daný deň nepracuje, panel *Upozornenia* napríklad zobrazí *Preťaženie, počet dní: 5 (29-06-2027 – 05-07-2027). Z toho v dňoch, keď zdroj podľa svojho kalendára nepracuje: 1*. Ak úloha vždy prebieha cez taký deň, čo je druhý dôvod vyššie, vyvažovanie to nevyrieši.

## Pozri tiež

- [Vyvažovanie zdrojov](docs://uitleg-nivelleren): čo vyvažovanie posúva v rámci časovej rezervy aj mimo nej a čo nerobí.
- [Správa zdrojov](docs://howto-resources-beheren): úprava kapacity a kalendára zdroja.
- [Pridávanie závislostí](docs://howto-relaties-leggen): zaradenie úloh za sebou.
- [Hlásenia a upozornenia](docs://ref-meldingen): upozornenie na preťaženie v paneli *Upozornenia*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): omietkári sú preťažení na 5 dní. Ak je zapnuté *Vyvažovať len v rámci časovej rezervy (vyhladzovanie) — dátum dokončenia projektu zostane pevný*, dokončenie zostane na 17. auguste 2027 a zostane jeden konflikt. S vypnutým políčkom (predvolené nastavenie) sa všetko vyrieši a dokončenie sa posunie na 24. augusta 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): vežový žeriav je preťažený na 65 dní a omietkári na 15 dní. Vyvažovanie s vypnutým políčkom *Vyvažovať len v rámci časovej rezervy (vyhladzovanie) — dátum dokončenia projektu zostane pevný* posunie dokončenie z 9. mája na 12. októbra 2028.
