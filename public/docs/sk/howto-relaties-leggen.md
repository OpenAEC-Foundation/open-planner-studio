# Pridanie závislostí

Cieľ: prepojte úlohy tak, aby úloha začala až vtedy, keď je dokončená činnosť pred ňou. Tam, kde treba, pridajte medzi úlohy čakací čas (oneskorenie).

## Kedy to potrebujete

Bez závislostí aplikácia nevie, že murár môže začať až po zalití základu. Každá úloha potom začne v deň začiatku projektu. Dátum dokončenia potom nemá žiadny význam. **Závislosť** zapisuje toto poradie. Prvá úloha je **predchádzajúca úloha**, druhá je **nasledujúca úloha**.

Závislosti pridávate pri tvorbe plánu, keď pridáte novú úlohu, alebo keď sa ukáže, že dve úlohy na sebe predsa závisia. **Oneskorenie** je čakací čas medzi dvoma úlohami, napríklad betón, ktorý musí vytvrdnúť, alebo poter, ktorý musí vyschnúť.

Predvolená závislosť je **FS** (dokončenie-začiatok): nasledujúca úloha môže začať až vtedy, keď je predchádzajúca úloha dokončená. Aplikácia pozná aj typy SS, FF a SF. Tie viažu začiatok alebo dokončenie na začiatok alebo dokončenie. Pri SS (začiatok-začiatok) napríklad omietkovanie môže začať až vtedy, keď začnú technické zariadenia budovy.

Nie ste si istí, aký typ potrebujete? Pod výberom typu vysvetľuje veta s názvami skutočných úloh, napríklad *Metselwerk môže začať, až keď skončí Fundering.* Ak vyberiete iný typ, veta sa zmení. Vidíte ju v okne *Typ závislosti*, v bloku *Závislosti* a v stĺpci *Predchádzajúce úlohy* alebo *Nasledujúce úlohy*.

## Postup

Závislosť môžete pridať štyrmi spôsobmi. Všetky vytvoria rovnakú závislosť. Vyberte ten, ktorý sa najlepšie hodí do vašej situácie.

### Prepojenie dvoch vybraných úloh

Užitočné, keď pracujete v tabuľke úloh.

1. V tabuľke úloh kliknite na úlohu, ktorá ide prvá, teda na predchádzajúcu úlohu.
2. Podržte Ctrl (⌘ na Macu) a kliknite na úlohu, ktorá ide ďalšia, teda na nasledujúcu úlohu.
3. Vyberte *Domov › Úlohy › Prepojiť ▾ › Prepojiť vybrané úlohy*. Rovnaké tlačidlo je aj na *Plán › Závislosti*.

Aplikácia vytvorí závislosť dokončenie-začiatok bez oneskorenia. Zobrazí napríklad hlásenie *Závislosť vytvorená: Foundation brickwork → Lay hollow-core floor*. Tlačidlo funguje len vtedy, keď sú vybrané presne dve úlohy.

### Kreslenie závislosti v diagrame Gantt

Užitočné, keď pridávate viacero závislostí za sebou.

1. Vyberte *Domov › Úlohy › Prepojiť ▾ › Nakresliť závislosť*. Nad plánom sa zobrazí upozornenie *Režim závislostí: potiahnite v Gantt z jedného pruhu na druhý a vytvorte závislosť. Esc ukončí režim.*
2. Na pruhu predchádzajúcej úlohy stlačte tlačidlo myši a potiahnite na pruh nasledujúcej úlohy. Prerušovaná čiara so šípkou sleduje váš kurzor.
3. Pustite tlačidlo myši. Zobrazí sa malé okno *Typ závislosti* s typom (predvolene FS) a poľom pre oneskorenie.
4. Ak je to potrebné, zmeňte typ alebo oneskorenie a stlačte Enter, alebo kliknite mimo okna. Závislosť sa vytvorí.
5. Pridajte ďalšiu hneď: režim zostane zapnutý. Ukončíte ho klávesom Esc, tlačidlom *Ukončiť* v upozornení alebo výberom *Nakresliť závislosť* znova.

Ak stlačíte Esc v okne *Typ závislosti*, nič sa nezaznamená. Pre jednu závislosť nemusíte režim zapínať. Podržte Shift a potiahnite z pruhu na pruh. *Vytvoriť závislosť odtiaľto* v kontextovej ponuke pruhu zapne režim závislostí; ťahanie musíte urobiť sami. Na karte *Tabuľka* bez diagramu Gantt je *Nakresliť závislosť* vypnuté.

### Pridanie závislosti cez panel vlastností

Užitočné, keď sa pozeráte na jednu úlohu a chcete pridať jej predchádzajúce alebo nasledujúce úlohy.

1. Vyberte úlohu. Panel *Vlastnosti* je na pravej strane. Ak ho nevidíte, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. V bloku *Závislosti* kliknite na *Pridať závislosť*.
3. Ak druhá úloha ide prvá, ponechajte smer na *Predchádzajúca úloha*, alebo vyberte *Nasledujúca úloha*.
4. Napíšte časť názvu druhej úlohy. Správnu vyberte šípkami a klávesom Enter, alebo na ňu kliknite.
5. Vyberte typ (predvolene FS) a podľa potreby vyplňte oneskorenie.
6. Stlačte Enter, alebo kliknite na značku (*Vytvoriť závislosť*).

Závislosti úlohy sa potom zobrazia v bloku *Závislosti*. Pri každej je číslo WBS druhej úlohy, typ a oneskorenie.

### Písanie závislostí v stĺpci Predchádzajúce úlohy

Užitočné, keď pracujete rýchlo s klávesnicou a poznáte čísla WBS.

1. Kliknite na **+** vpravo v hlavičke tabuľky úloh (*Pridať stĺpec*). V časti *Závislosti* vyberte stĺpec *Predchádzajúce úlohy*. Stĺpec *Nasledujúce úlohy* funguje rovnako.
2. V stĺpci *Predchádzajúce úlohy* kliknite na bunku nasledujúcej úlohy.
3. Napíšte WBS číslo predchádzajúcej úlohy, medzeru a typ, napríklad `2.6 FS`. Hneď za typ napíšte oneskorenie, napríklad `2.6 FS+1d`. Viacero predchádzajúcich úloh oddeľte bodkočiarkou alebo čiarkou: `3.1 FS; 3.2 SS+2d`.
4. Stlačte Enter.

To, čo napíšete, nahradí celú bunku. Ak tam už sú predchádzajúce úlohy, napíšte ich tiež (pozri Časté chyby nižšie). Ak v bunke stlačíte Enter alebo F2 bez písania, otvorí sa pole, ktoré zachová existujúce závislosti. Vyhľadáte úlohu podľa čísla WBS alebo názvu a pre každú závislosť vyberiete typ a oneskorenie.

### Nastavenie alebo zmena oneskorenia

Oneskorenie napíšete do poľa vedľa typu, pri každom spôsobe uvedenom vyššie. Existujúce oneskorenie zmeníte v bloku *Závislosti*: kliknite do poľa oneskorenia, napíšte novú hodnotu a stlačte Enter.

- `3` alebo `3d`: 3 pracovné dni. Víkend sa nepočíta. Aplikácia zobrazí `+3d`.
- `3ed`: 3 kalendárne dni. Víkend sa počíta, podobne ako pri betóne, ktorý vytvrdne aj v sobotu a v nedeľu.
- `-1`: predstih. Nasledujúca úloha môže začať o deň skôr, takže úlohy sa prekrývajú.
- `4h`: 4 hodiny pracovného času; aplikácia to zobrazí ako `+4u`. Ak je predchádzajúca úloha úloha v dňoch v kalendári bez vlastných blokov pracovného času, napríklad v štandardnom kalendári, aplikácia to prevedie na celé pracovné dni, zaokrúhlené na najbližší celý deň: `4h` potom pôsobí ako 1 deň, `2h` ako 0. V kalendári, ktorý má vlastné bloky pracovného času, alebo ak je predchádzajúca úloha hodinová úloha, sa oneskorenie počíta presne v hodinách.
- `50%`: polovica trvania predchádzajúcej úlohy.

Príklad: betón základu musí vytvrdnúť, kým na ňom môže murár pracovať, takže *Pour foundation → Foundation brickwork* dostane závislosť FS s oneskorením `3`. Ak sa zaliatie uskutoční v piatok 18. júna 2027, murivo začne po spustení príkazu **Prepočítať** vo štvrtok 24. júna: pondelok až streda je čakací čas. S `3ed` sa víkend počíta a murivo začne v utorok 22. júna.

### Nakoniec: prepočítajte

Nová závislosť zatiaľ nepresúva žiadne pruhy. Stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*. Až potom dostanú nasledujúce úlohy nové dátumy. Ak chcete, aby to aplikácia robila za vás, zapnite *Automatický prepočet* v menu *Nastavenia › Projekt › Nastavenia*, na karte *Plán*.

## Časté chyby a čo aplikácia robí

**Obrátené poradie.** Pri *Prepojiť vybrané úlohy* rozhoduje poradie kliknutí, nie poradie v zozname. Ak najskôr kliknete na neskoršiu úlohu, závislosť má zlý smer. Odstráňte ju v bloku *Závislosti* ikonou koša a pridajte ju znova.

**Písanie v stĺpci vymaže, čo tam bolo.** Ak bunka obsahuje `3.4 FS; 3.2 FS` a vy napíšete len `3.2 FS`, závislosť s 3.4 zmizne bez hlásenia. Napíšte všetky predchádzajúce úlohy, alebo použite Enter či F2 a pridajte nové. Prípadne zmenu vráťte klávesmi Ctrl+Z.

**Cyklus.** Ak pridáte závislosť, ktorá vedie späť k úlohe skôr v reťazi, plán by nemohol nikdy začať. Aplikácia takúto závislosť odmietne: *Táto závislosť by v pláne vytvorila cyklus (…) a nebola vytvorená*. V zátvorkách sú úlohy cyklu. Najskôr odstráňte závislosť, ktorá cyklus uzatvára.

**Úloha so svojou súhrnnou úlohou.** Závislosť medzi úlohou a súhrnnou úlohou, pod ktorou sa nachádza, nie je možná. Aplikácia hlási: *Závislosť medzi úlohou a jej vlastnou súhrnnou úlohou (aj vyššou) nie je povolená.*

**Duplicita.** Ak závislosť už existuje, aplikácia zobrazí *Táto závislosť už existuje* a nič sa nezmení.

**Kratšie hlásenia v stĺpci.** Stĺpec *Predchádzajúce úlohy* vracia rovnaké odmietnutia, ale s kratším textom pod bunkou: *Táto zmena by vytvorila cyklus v pláne.*, *Táto závislosť už existuje.* alebo *Úloha nemôže mať závislosť so svojou vlastnou súhrnnou úlohou.* Ak napíšete len číslo WBS, napríklad `3.1`, typ chýba a bunka zobrazí *Použite napríklad 1.2 FS+2d.* Bunka zostane otvorená. Opravte zadanie, alebo stlačte Esc a zrušte ho.

**Žiadne polovičné dni oneskorenia.** Oneskorenie v dňoch je vždy celé číslo: `1.5` sa zmení na `+2d`. Hodinové oneskorenie pri úlohe v dňoch v kalendári bez vlastných blokov pracovného času sa zaokrúhli na celé pracovné dni. Nečitateľný vstup, napríklad slovo, sa neuloží: pole sa vráti na predchádzajúcu hodnotu.

## Pozri tiež

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo aplikácia vypočíta z vašich závislostí a prečo je úloha kritická.
- [Závislosti a oneskorenie](docs://uitleg-relaties): čo štyri typy závislostí a oneskorenie robia s dátumami.
- [Sledovanie cesty](docs://howto-pad-traceren): zobrazenie reťazca predchádzajúcich a nasledujúcich úloh.
- [Dialóg úlohy a panel vlastností](docs://ref-taak-eigenschappen): polia pre závislosti a oneskorenie v paneli a v dialógu.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): reťaz závislostí typu dokončenie-začiatok s jednou závislosťou začiatok-začiatok (walls and roof, oneskorenie 2 dni) a jednou závislosťou dokončenie-dokončenie (tiling and painting, oneskorenie 1 deň).
