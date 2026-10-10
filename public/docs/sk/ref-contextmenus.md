# Ponuky pravého tlačidla myši

Ktoré ponuky otvorí pravé tlačidlo myši v diagrame Gantt a v tabuľke úloh, čo robí každá položka a na ktoré úlohy sa vzťahuje. Položky, ktoré existujú aj ako tlačidlo alebo klávesová skratka, nájdete v [Pás s nástrojmi, karta po karte](docs://ref-lint) a v [Klávesové skratky](docs://ref-sneltoetsen).

## Ktorá ponuka kde

Existujú štyri ponuky. Ktorú dostanete, závisí od miesta kliknutia:

- **Na pruhu úlohy v diagrame Gantt** — ponuka úlohy, s položkou *Vytvoriť závislosť odtiaľto* na začiatku.
- **Na úlohe v tabuľke úloh** — rovnaká ponuka úlohy, bez tej jednej položky na začiatku. Platí to pre tabuľku úloh naľavo od diagramu Gantt a na karte *Tabuľka*.
- **Na hlavičke skupiny v tabuľke úloh** — malá ponuka na rozbalenie a zbalenie skupín. Hlavičky skupín sa zobrazia len vtedy, keď zoskupujete, napríklad pri rozložení *Diagram zdrojov*.
- **Na prázdnom mieste** — v diagrame Gantt vedľa pruhov alebo pod nimi a v tabuľke úloh pod poslednou úlohou alebo na sivom riadku *Nová úloha*. Ponuka obsahuje *Vytvoriť úlohu*, *Pridať medzník* a *Vložiť*; v diagrame Gantt aj *Obnoviť zoom* a *Prispôsobiť projektu*. Nová úloha alebo medzník sa pridá na koniec zoznamu. V diagrame Gantt začína na dátume, kde ste klikli; v tabuľke úloh sa hneď otvorí bunka názvu, aby ste mohli písať.

Na pruhu hlavičky skupiny v diagrame Gantt pravé tlačidlo myši neotvorí žiadnu ponuku. Kliknutie pravým tlačidlom v hlavičke časovej osi tiež nič nerobí. Hlavičky stĺpcov tabuľky úloh majú vlastnú ponuku, popísanú v [Úprava stĺpcov tabuľky](docs://howto-tabelkolommen-aanpassen).

**Na ktoré úlohy sa položka vzťahuje?** Kliknete na jednu úlohu, ale výber určuje rozsah. Ak je úloha, na ktorú kliknete, súčasťou výberu, položka sa vzťahuje na celý výber. Ak nie, vzťahuje sa len na túto jednu úlohu. Ak kliknete pravým tlačidlom na pruh v diagrame Gantt alebo na riadok v tabuľke úloh, táto úloha nahradí výber, ak v ňom nebola. Každá položka, ktorá niečo mení, sa dá vrátiť jedným krokom *Vrátiť späť*, aj pre celý výber.

## Ponuka úlohy

Položky sú v tomto poradí. Čiara medzi skupinami je oddeľovač v ponuke.

**Vytvoriť závislosť odtiaľto** — len v diagrame Gantt, na pruhu. Zapne režim závislostí s touto úlohou vybranou; potom ťahajte k nasledujúcej úlohe. Pozrite si [Pridanie závislostí](docs://howto-relaties-leggen).

**Odstrániť prestávku** a **Odstrániť všetky prestávky** — len v diagrame Gantt, na pruhu s prestávkami. *Odstrániť prestávku* sa zobrazí len vtedy, keď kliknete na prestávku alebo na časť za ňou a prestávku možno upraviť; odstráni len túto jednu prestávku. *Odstrániť všetky prestávky* odstráni všetky, vrátane prestávok zo zdrojového súboru, ktoré nemožno upraviť. Pozrite si [Rozdelenie úlohy](docs://howto-taak-splitsen).

**Upraviť...** — otvorí okno *Upraviť úlohu* pre túto úlohu. Pozrite si [Dialógové okno úlohy a panel vlastností](docs://ref-taak-eigenschappen).

**Vložiť nad** a **Vložiť pod** — vloží jednu novú úlohu nad najvyššiu úlohu alebo pod najnižšiu úlohu rozsahu, na rovnakej úrovni. Funguje len v čistom stromovom zobrazení, bez filtra, zoskupovania alebo triedenia. Inak aplikácia odmietne akciu a zobrazí správu. Pozrite si [Pridanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen).

**Pridať čiastkovú úlohu** — pridá novú čiastkovú úlohu k úlohe, na ktorú ste klikli, na koniec jej čiastkových úloh. Len pre túto jednu úlohu, nie pre celý výber.

**Pridať medzník** — pridá medzník ako čiastkovú úlohu k úlohe, na ktorú ste klikli. Len pre túto jednu úlohu.

**Pridať závislosť** — robí to isté ako *Vytvoriť závislosť odtiaľto*: zapne režim závislostí s touto úlohou vybranou. V tabuľke úloh je položka neaktívna, ak Gantt nie je zobrazený, s popisom *Dostupné len vtedy, keď je Gantt zobrazený*.

**Znížiť úroveň** a **Zvýšiť úroveň** — presunú úlohy rozsahu o jednu úroveň nižšie alebo vyššie v WBS. Tieto dve sú len v čistom stromovom zobrazení. Pozrite si [Úprava štruktúry](docs://howto-structuur-aanpassen).

**Prepnúť medzník** — premení úlohu na medzník, alebo späť. Nový stav vyplýva z úlohy, na ktorú ste klikli, a platí pre celý rozsah: ak je to úloha, všetky úlohy v rozsahu sa stanú medzníkmi. Súhrnná úloha a úloha s priradeniami sa medzníkom nestanú; zvyšok rozsahu sa medzníkmi stane. Dostanete jednu správu pre každý dôvod.

**Priradiť kalendár ▸** — podponuka s *Projektový kalendár* (úloha potom nemá vlastný kalendár) a pod ňou dostupné kalendáre. Aktuálna voľba má značku začiarknutia. Úloha, ktorá už na tomto kalendári je, sa nezmení a nevytvorí žiadny ďalší krok *Vrátiť späť*. Pozrite si [Vytvorenie a priradenie kalendára](docs://howto-kalender-maken-en-toewijzen).

**Postup ▸** — podponuka s 0%, 25%, 50%, 75% a 100%. Aktuálna hodnota má značku začiarknutia. Súhrnná úloha nemá vlastný postup: ak je v rozsahu, jej koncové úlohy dostanú toto percento. Bez dátumu kontroly stavu aplikácia nastaví dnešný dátum a zobrazí správu. Úloha, ktorej plánovaný začiatok je až po dátume kontroly stavu a ktorá ešte nemá skutočný začiatok, najprv vyvolá otázku na skutočný začiatok; ak ju zrušíte, nič sa nezmení. Pozrite si [Aktualizácia postupu](docs://howto-voortgang-bijwerken).

**Priorita ▸** — podponuka s *Nízka* (100), *Normálna* (500) a *Vysoká* (900), priorita vyvažovania úlohy. Aktuálna hodnota má značku začiarknutia. Pozrite si [Vyvažovanie zdrojov](docs://uitleg-nivelleren).

**Sledovať cestu** — zobrazí predchádzajúce úlohy a nasledujúce úlohy pre túto úlohu. Ak je sledovanie už zapnuté, položka sa volá *Zastaviť sledovanie cesty*. Pozrite si [Sledovanie cesty](docs://howto-pad-traceren).

**Zbaliť**, **Rozbaliť** a **Uložiť vetvu ako šablónu** — len pre súhrnnú úlohu. *Zbaliť* a *Rozbaliť* sú tam vždy obe, aj keď je úloha už zbalená alebo rozbalená, a platia pre celý rozsah. *Uložiť vetvu ako šablónu* uloží úlohu aj s jej čiastkovými úlohami a závislosťami medzi nimi ako šablónu WBS. Pozrite si [Uloženie a vloženie šablón WBS](docs://howto-wbs-sjablonen).

**Odstrániť** — odstráni úlohy rozsahu aj s ich čiastkovými úlohami. Potvrdenie sa nezobrazí; vrátite ich pomocou Ctrl+Z, jeden krok pre celý rozsah. Pozrite si [Výber, odstraňovanie a vrátenie úloh](docs://howto-taken-selecteren-verwijderen).

## Ponuka hlavičky skupiny

Táto ponuka existuje len v tabuľke úloh, na hlavičke skupiny:

**Zbaliť skupinu** alebo **Rozbaliť skupinu** — zbalí alebo rozbalí len túto skupinu. Položka ukazuje, čo môžete urobiť.

**Rozbaliť všetko** a **Zbaliť všetko** — rozbalí alebo zbalí naraz všetky skupiny.

Zoskupovanie nastavíte pomocou rozloženia. Pozrite si [Vytvorenie a použitie rozloženia](docs://howto-layouts-gebruiken).

## Pozrite si tiež

- [Ťahanie, posúvanie a zoom v diagrame Gantt](docs://howto-gantt-bedienen): čo robí ťahanie ľavým a prostredným tlačidlom myši.
- [Pás s nástrojmi, karta po karte](docs://ref-lint): tlačidlá s rovnakými akciami.
- [Klávesové skratky](docs://ref-sneltoetsen): klávesy, ktoré k nim patria.
