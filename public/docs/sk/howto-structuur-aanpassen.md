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

- **Zap (predvolené v novom projekte).** *Zap* je aj vtedy, keď otvoríte súbor bez tohto nastavenia, ak všetky kódy WBS už zodpovedajú číslovaniu stromu (1, 1.1, 1.2 …). Kódy sa nemenia. Prázdny súbor bez tohto nastavenia dostane tiež *zap*, rovnako ako nový projekt. Aplikácia prečísluje celý strom pri každom pridaní, odstránení a presune. Kód WBS je potom iba na čítanie: nemôžete ho napísať v tabuľke úloh ani v paneli *Vlastnosti*. *Prečíslovať WBS* je nedostupné.
- **Vyp.** Predvolené je pri súbore s vlastnými kódmi, napríklad *A1000*, alebo pri súbore s jedným kódom, ktorý sa líši od stromu. Kódy zostanú také, aké sú, aj po presune a znížení úrovne. Zadáte ich sami v stĺpci *WBS* alebo v poli *Kód WBS* v paneli *Vlastnosti*. Alebo ich raz prečíslujete príkazom *Prečíslovať WBS*. Tým sa prepíšu aj kódy, ktoré ste zadali sami.

Ak zapnete *WBS automaticky*, aplikácia hneď prečísluje strom. Obidve akcie, *WBS automaticky* aj *Prečíslovať WBS*, možno zrušiť príkazom *Vrátiť späť*.

## Úskalia a čo aplikácia robí

**Filtrovanie, zoskupovanie alebo triedenie je zapnuté.** Poradie, ktoré vidíte, potom nezodpovedá poradiu plánu, preto aplikácia štruktúru zamkne. *Znížiť úroveň* a *Zvýšiť úroveň* sú nedostupné, s popiskom *Nedostupné počas filtrovania, zoskupovania a triedenia*. Alt+→ a presúvanie zobrazia rovnaký text v červenej lište s tlačidlom *Vymazať*. Tým sa naraz odstráni filter, zoskupovanie a triedenie, a Ctrl+Z ich nevráti. Lišta zostane, kým nekliknete na krížik, nepoužijete Ctrl+Z alebo Ctrl+Y, alebo neprejdete do iného dokumentu. Príkazy *Znížiť úroveň* a *Zvýšiť úroveň* potom v kontextovej ponuke chýbajú.

Alt+↑ a Alt+↓ v takomto zobrazení fungujú bez správy. Pri samotnom filtri vidíte nové poradie hneď. Pri triedení sa poradie v pláne zmení, ale uvidíte ho až po *Vymazať*.

**WBS automaticky je vypnuté.** Nastane to pri súbore s vlastnými kódmi, alebo pri súbore, ktorý ukladá nastavenie ako *vyp*. Nová úloha dostane kód, ktorý zodpovedá jej miestu v strome, aj keď ho už má iná úloha. Tak sa môžu objaviť duplicitné čísla. Aj po znížení úrovne už kódy nezodpovedajú stromu. *Prečíslovať WBS* opraví obidva problémy.

**Medzník dostane čiastkové úlohy.** Medzník je okamih a nemá čiastkové úlohy. Aplikácia odstráni príznak medzníka a oznámi vám to.

**Úloha s priradeniami zdrojov dostane čiastkové úlohy.** Súhrnná úloha sama žiadne priradenia nenesie. Aplikácia sa preto najprv opýta, čo s nimi urobiť, v okne *Úloha sa stane súhrnnou úlohou*. Táto otázka sa objaví, keď úlohu znížite, použijete *Pridať čiastkovú úlohu* alebo *Pridať medzník* na úlohe, vložíte šablónu, alebo v *Upraviť úlohu* zmeníte pole *Nadradená úloha*. Platí to pre existujúcu aj novú úlohu. V *Upraviť úlohu* sa otázka objaví pred uložením. Ak tam zvolíte *Zrušiť*, *Upraviť úlohu* ostane otvorené so zmenami. Vyberiete jednu z možností:

- *Zrušiť*: nič sa nezmení a štruktúra ostane taká, aká bola.
- *Odstrániť priradenie*: úloha dostane čiastkové úlohy a jej priradenia sa odstránia. Skutočná práca týchto priradení sa tiež odstráni.
- *Presunúť do „…“*: priradenia prejdú na prvú novú čiastkovú úlohu, ktorá ich môže niesť, spolu so svojou skutočnou prácou. Medzník ani súhrnná úloha žiadne priradenia nenesie.

Ak už táto čiastková úloha má rovnaký zdroj alebo nie je vhodná žiadna čiastková úloha, *Presunúť* je nedostupné. Oranžový blok v okne vám povie, prečo.

Ak má priradenie už skutočnú prácu, oranžový blok uvedie počet hodín na zdroj, napríklad *Priradenie zdroja Metselaar už má 8 hodín skutočnej práce. Odstránením sa táto práca zahodí.* *Zrušiť* je potom predvolené tlačidlo: Enter nič nezmení. Ak chcete priradenie odstrániť aj tak, kliknite sami na *Odstrániť priradenie*.

Kým je okno otvorené, žiadna skratka mimo okna nefunguje, vrátane *Vrátiť späť*, *Vložiť*, Delete, F5 a Ctrl+S. Ak jedna akcia vytvorí naraz viac súhrnných úloh, okno ukáže zdroje na každú úlohu a vaša voľba platí pre všetky. Jedno *Vrátiť späť* (Ctrl+Z) vráti celú akciu.

**Závislosť by vytvorila cyklus.** Závislosti súhrnnej úlohy platia aj pre jej čiastkové úlohy. Ak by presun kvôli tomu vytvoril cyklus, aplikácia ho odmietne so správou *Týmto presunom by v pláne vznikol cyklus (…)*. Nič sa nezmení.

**Závislosť medzi úlohou a jej vlastnou fázou.** Ak zaradíte úlohu pod fázu, s ktorou už má závislosť, táto závislosť ostane, ale do výpočtu sa už nepočíta. Aplikácia vás na to upozorní. Viac o závislostiach súhrnných úloh si môžete prečítať v článku [Závislosti a oneskorenie](docs://uitleg-relaties).

**Plán je zastaraný.** Presun do inej fázy môže zmeniť dátumy. Stlačte **Prepočítať** (F5). Samotné prehodenie poradia v rámci tej istej fázy dátumy nemení.

## Pozri tiež

- [Pridávanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen): zaraďte nové úlohy na správne miesto.
- [Ukladanie a vkladanie šablón WBS](docs://howto-wbs-sjablonen): znovu použite celú fázu.
- [Pridávanie závislostí](docs://howto-relaties-leggen): prepojte úlohy.
- [Výber, odstraňovanie a vrátenie úloh](docs://howto-taken-selecteren-verwijderen): zrušte presun.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): štyri fázy s ich čiastkovými úlohami, tak ako ich vytvoríte príkazom *Znížiť úroveň*.
