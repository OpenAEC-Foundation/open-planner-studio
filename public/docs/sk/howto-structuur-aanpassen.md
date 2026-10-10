# Úprava štruktúry

Cieľ: usporiadať úlohy do fáz a čiastkových úloh, zmeniť ich poradie a udržať čísla WBS správne.

## Kedy to potrebujete

Váš plán je strom: fázy (súhrnné úlohy) s čiastkovými úlohami pod nimi, napríklad *Foundation* s *Groundwork*, *Reinforcement* a *Pouring*. Tento strom upravujete, keď chcete úlohy zaradiť pod fázu, úlohu z fázy vyňať alebo keď je poradie zlé. **Kód WBS** (1, 1.1, 1.2, 2, …) je číslo úlohy v tomto strome.

## Postup

### Zníženie úrovne úlohy

1. Vyberte úlohu. Môžete vybrať aj viac úloh.
2. Vyberte *Plán › Štruktúra › Znížiť úroveň*. Môžete tiež použiť Alt+→ (alebo Alt+Shift+→), alebo *Znížiť úroveň* v kontextovej ponuke.

Úloha sa stane poslednou čiastkovou úlohou predchádzajúcej úlohy na rovnakej úrovni. Predchádzajúca úloha sa tým stane súhrnnou úlohou. Ak vyberiete súvislý blok, celý blok sa presunie na nižšiu úroveň ako celok. Ak úloha nemá predchádzajúcu úlohu na rovnakej úrovni, nestane sa nič a nezobrazí sa žiadna správa.

### Zvýšenie úrovne úlohy

Vyberte *Plán › Štruktúra › Zvýšiť úroveň*, stlačte Alt+← (alebo Alt+Shift+←) alebo vyberte *Zvýšiť úroveň* v kontextovej ponuke.

Úloha sa stane rovnocennou úlohou hneď za fázou, pod ktorou bola zaradená. Jej vlastné čiastkové úlohy idú s ňou. Úlohy, ktoré boli v tej fáze za ňou, zostávajú v nej. Úlohu na najvyššej úrovni už nemožno zvýšiť.

### Presun úlohy

Máte tri možnosti.

- **Klávesnicou.** Alt+↑ a Alt+↓ vymenia úlohu so susednou úlohou na rovnakej úrovni. Súhrnná úloha si so sebou vezme svoje čiastkové úlohy. Na začiatku alebo na konci úrovne sa nestane nič. Ak máte vybratých viac úloh, presunie sa iba úloha, na ktorú ste klikli ako prvú.
- **Presúvanie v tabuľke úloh.** Stlačte tlačidlo myši na riadku a ťahajte ho zvisle. Horná štvrtina riadku znamená *pred*, dolná štvrtina *po*. Stred súhrnnej úlohy zaradí úlohu pod ňu ako jej poslednú čiastkovú úlohu. Stred bežnej úlohy sa počíta ako najbližší okraj. Ak presúvate riadok, ktorý je súčasťou výberu viacerých úloh, presunie sa celý výber.
- **Presúvanie v Gantt diagrame.** Presuňte pruh zvisle na iný riadok. Funguje to rovnako ako presúvanie v tabuľke úloh a nemení žiadne dátumy. Ak pruh presúvate vodorovne, namiesto toho posúvate dátumy.

Každý presun je jeden krok, ktorý vrátite príkazom *Vrátiť späť* (Ctrl+Z).

### Aktualizácia čísel WBS

Pozrite sa na tlačidlo *WBS automaticky* v *Plán › Štruktúra*.

- **Zapnuté (predvolené v novom projekte).** Aplikácia prečísluje celý strom pri každom pridaní, odstránení a presune. Kód WBS je potom iba na čítanie: nemôžete ho napísať v tabuľke úloh ani v paneli *Vlastnosti*. *Prečíslovať WBS* je nedostupné.
- **Vypnuté.** Kódy zostanú také, aké sú, aj po presune a znížení úrovne. Zadávate ich sami v stĺpci *WBS* alebo v poli *Kód WBS* v paneli *Vlastnosti*. Alebo ich raz prečíslujete príkazom *Prečíslovať WBS*. Tým sa prepíšu aj kódy, ktoré ste zadali sami.

Ak zapnete *WBS automaticky*, aplikácia hneď prečísluje strom. Obidve akcie, *WBS automaticky* aj *Prečíslovať WBS*, možno zrušiť príkazom *Vrátiť späť*.

## Úskalia a čo aplikácia robí

**Filtrovanie, zoskupovanie alebo triedenie je zapnuté.** Poradie, ktoré vidíte, potom nezodpovedá poradiu plánu, preto aplikácia štruktúru zamkne. *Znížiť úroveň* a *Zvýšiť úroveň* sú nedostupné, s popiskom *Nedostupné počas filtrovania, zoskupovania a triedenia*. Alt+→ a presúvanie zobrazia rovnaký text v lište s tlačidlom *Vymazať*. Tým sa naraz odstráni filter, zoskupovanie a triedenie, a Ctrl+Z ich nevráti. Príkazy *Znížiť úroveň* a *Zvýšiť úroveň* potom v kontextovej ponuke chýbajú.

Alt+↑ a Alt+↓ v takomto zobrazení fungujú bez správy. Pri samotnom filtri vidíte nové poradie hneď. Pri triedení sa poradie v pláne zmení, ale uvidíte ho až po *Vymazať*.

**WBS automaticky je vypnuté.** Nová úloha dostane kód, ktorý zodpovedá jej miestu v strome, aj keď ho už má iná úloha. Tak sa môžu objaviť duplicitné čísla. Aj po znížení úrovne už kódy nezodpovedajú stromu. *Prečíslovať WBS* opraví obidva problémy.

**Medzník dostane čiastkové úlohy.** Medzník je okamih a nemá čiastkové úlohy. Aplikácia odstráni príznak medzníka a oznámi vám to.

**Úloha s priradeniami zdrojov dostane čiastkové úlohy.** Súhrnná úloha sama žiadne priradenia nenesie. Aplikácia ich presunie na prvú novú čiastkovú úlohu, ktorá ich môže niesť, a oznámi vám to. Ak takáto čiastková úloha neexistuje alebo už má rovnaký zdroj, nestane sa nič a správa uvedie dôvod.

**Závislosť by vytvorila cyklus.** Závislosti súhrnnej úlohy platia aj pre jej čiastkové úlohy. Ak by presun kvôli tomu vytvoril cyklus, aplikácia ho odmietne so správou *Týmto presunom by v pláne vznikol cyklus (…)*. Nič sa nezmení.

**Závislosť medzi úlohou a jej vlastnou fázou.** Ak zaradíte úlohu pod fázu, s ktorou už má závislosť, táto závislosť zostane, ale do výpočtu sa už nepočíta. Aplikácia vás na to upozorní. Viac o závislostiach súhrnných úloh si môžete prečítať v článku [Závislosti a oneskorenie](docs://uitleg-relaties).

**Plán už nie je aktuálny.** Presun do inej fázy môže zmeniť dátumy. Stlačte **Prepočítať** (F5). Samotná zmena poradia v rámci tej istej fázy dátumy nemení.

## Pozri tiež

- [Pridávanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen): zaraďte nové úlohy na správne miesto.
- [Ukladanie a vkladanie šablón WBS](docs://howto-wbs-sjablonen): znovu použite celú fázu.
- [Pridávanie závislostí](docs://howto-relaties-leggen): prepojte úlohy.
- [Výber, odstraňovanie a vrátenie úloh](docs://howto-taken-selecteren-verwijderen): zrušte presun.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): štyri fázy s ich čiastkovými úlohami, tak ako ich vytvoríte príkazom *Znížiť úroveň*.
