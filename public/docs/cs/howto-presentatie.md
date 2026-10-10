# Prezentace na velké obrazovce

Cíl: zobrazit Gantt přes celou obrazovku bez pásu karet a panelů, například na projektoru nebo televizi na stavební poradě.

## Kdy to potřebujete

Deset lidí se dívá na jednu obrazovku ve stavební buňce. Pás karet, stavový řádek a panel vlastností pak zabírají místo, které plán potřebuje, a odvádějí pozornost. V **prezentačním režimu** aplikace ponechá jen tabulku úkolů a Gantt přes celou obrazovku.

## Postup

### Příprava zobrazení

Ve prezentačním režimu pás karet zmizí, proto zobrazení nastavte předem.

1. Stiskněte **Přepočítat** (F5), aby byly zobrazené termíny správné.
2. Nastavte zobrazení, které chcete ukázat, například rozložení, které zobrazuje jen kritické úkoly (viz [Vytváření a používání rozložení](docs://howto-layouts-gebruiken)).
3. Zvolte časovou osu a přiblížení, při kterém jsou názvy úkolů čitelné z dálky, a fáze sbalte nebo rozbalte pomocí *Sbalit* a *Rozbalit* ve skupině *Osnova* na kartě *Zobrazení*.
4. Pokud je chcete použít, zapněte *Rozdělené zobrazení* a *Minimapa* (viz [Používání rozděleného zobrazení a minimapy](docs://howto-split-view-en-mini-map)).

### Spuštění prezentace

Zvolte *Zobrazení › Prezentace › Prezentace*, nebo stiskněte F11. Pás karet, karty, stavový řádek a pravý panel zmizí. Vidíte tabulku úkolů, Gantt a případně, pokud jste je zapnuli, histogram a minimapu. Několik sekund se dole zobrazuje text *Stisknutím Esc nebo F11 ukončíte celou obrazovku.*

Prezentaci můžete spustit z libovolné karty, také z karty *Tabulka* nebo z karty *Sestava*. Vždy vidíte Gantt otevřeného projektu a po ukončení se vrátíte na kartu, ze které jste začali.

### Ukončení prezentace

Stiskněte Esc nebo F11. Pás karet a panely se vrátí na kartu, ze které jste začali.

## Úskalí a co aplikace dělá

**V prezentačním režimu můžete stále upravovat.** Klikání, tažení, úpravy buněk a klávesa Delete stále fungují. Když omylem přetáhnete pruh, přesune se a plán už není aktuální. Úkol, který omylem smažete, obnovíte klávesami Ctrl+Z, také v prezentačním režimu. Když pracujete se skupinou, klikejte proto opatrně.

**Upozornění zůstávají vidět.** Zpráva z aplikace, například chyba při ukládání, se zobrazí také v prezentačním režimu. Jinak tu není pás karet ani stavový řádek, takže taková zpráva je jediným znakem, že něco není v pořádku.

**Rozdělené zobrazení, minimapu a rozložení nastavte předem.** K tomu potřebujete pás karet, a ten v tomto režimu není. Přiblížení funguje kolečkem myši nebo klávesami Ctrl+= a Ctrl+-. Také + a - fungují, ale jen když je fokus v diagramu Gantt. Po F11 je fokus často v tabulce úkolů, proto nejprve klikněte do diagramu Gantt.

**Celá obrazovka nefunguje.** Kromě skrytí pásu karet aplikace skutečně požaduje celou obrazovku. Když to prohlížeč nebo okno odmítne, zmizí jen pás karet a panely. Prezentace ale funguje dál. Když celou obrazovku ukončíte jinak než klávesou Esc nebo F11, například klávesou operačního systému, skončí také prezentační režim.

**Prezentační režim se nepamatuje.** Po zavření a novém otevření aplikace je vypnutý.

## Viz také

- [Používání rozděleného zobrazení a minimapy](docs://howto-split-view-en-mini-map): dvě časová okna nebo přehledový proužek během prezentace.
- [Vytváření a používání rozložení](docs://howto-layouts-gebruiken): nastavení zobrazení, které chcete ukázat, jedním kliknutím.
- [Klávesové zkratky](docs://ref-sneltoetsen): F11 a další klávesy.
