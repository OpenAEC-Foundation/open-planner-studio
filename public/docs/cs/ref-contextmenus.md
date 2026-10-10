# Nabídky pravého tlačítka

Které nabídky otevírá pravé tlačítko myši v diagramu Gantt a v tabulce úkolů, co každá položka dělá a na které úkoly se vztahuje. Položky, které existují také jako tlačítko nebo klávesová zkratka, najdete v [Pás karet, karta po kartě](docs://ref-lint) a [Klávesové zkratky](docs://ref-sneltoetsen).

## Která nabídka kde

Existují čtyři nabídky. Která se otevře, závisí na tom, kam kliknete:

- **Na pruhu úkolu v diagramu Gantt** — nabídka úkolu, nahoře s položkou *Začít závislost odsud*.
- **Na úkolu v tabulce úkolů** — stejná nabídka úkolu, bez té jedné položky nahoře. To platí pro tabulku úkolů vlevo od diagramu Gantt a pro kartu *Tabulka*.
- **Na záhlaví skupiny v tabulce úkolů** — malá nabídka pro rozbalení a sbalení skupin. Záhlaví skupin se zobrazí jen tehdy, když seskupujete, například s rozložením *Diagram zdrojů*.
- **Na prázdném místě** — v diagramu Gantt vedle pruhů nebo pod nimi a v tabulce úkolů pod posledním úkolem nebo na šedém řádku *Nový úkol*. Nabídka obsahuje *Nový úkol*, *Přidat milník* a *Vložit*; v diagramu Gantt také *Obnovit zoom* a *Přizpůsobit projektu*. Nový úkol nebo milník se přidá na konec seznamu. V diagramu Gantt začne na datu, na které jste klikli; v tabulce úkolů se hned otevře buňka názvu, abyste mohli psát.

Na pruhu záhlaví skupiny v diagramu Gantt pravé tlačítko myši žádnou nabídku neotevře. Kliknutí pravým tlačítkem v záhlaví časové osy také nic neudělá. Záhlaví sloupců tabulky úkolů má vlastní nabídku, popsanou v [Úprava sloupců tabulky](docs://howto-tabelkolommen-aanpassen).

**Na které úkoly se položka vztahuje?** Kliknete na jeden úkol, ale výběr určuje rozsah. Pokud je úkol, na který kliknete, součástí výběru, položka se vztahuje na celý výběr. Pokud není, vztahuje se jen na tento jeden úkol. Při pravém kliknutí na pruh v diagramu Gantt nebo na řádek v tabulce úkolů nahradí tento úkol výběr, pokud do něj nepatřil. Každá položka, která něco mění, je jeden krok v příkazu *Vrátit zpět*, i pro celý výběr.

## Nabídka úkolu

Položky jsou v tomto pořadí. Čára mezi skupinami je oddělovač v nabídce.

**Začít závislost odsud** — jen v diagramu Gantt, na pruhu. Zapne režim závislostí s tímto úkolem vybraným; potom přetáhnete na následníka. Viz [Přidávání závislostí](docs://howto-relaties-leggen).

**Odstranit přerušení práce** a **Odstranit všechna přerušení práce** — jen v diagramu Gantt, na pruhu s přerušeními. *Odstranit přerušení práce* je tam jen tehdy, když kliknete na přerušení nebo na úsek za ním a přerušení je upravitelné; odstraní jen to jedno přerušení. *Odstranit všechna přerušení práce* odstraní všechna, včetně přerušení ze zdrojového souboru, které nemůžete upravit. Viz [Rozdělení úkolu](docs://howto-taak-splitsen).

**Upravit...** — otevře okno *Upravit úkol* pro tento úkol. Viz [Dialog úkolu a panel vlastností](docs://ref-taak-eigenschappen).

**Vložit nad** a **Vložit pod** — vloží jeden nový úkol nad nejvyšší úkol rozsahu nebo pod nejnižší úkol rozsahu, na stejné úrovni. Funguje jen v čistém stromovém zobrazení, bez filtru, seskupení nebo řazení; jinak aplikace odmítne a zobrazí zprávu. Viz [Přidávání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen).

**Přidat dílčí úkol** — přidá nový úkol jako dílčí úkol k úkolu, na který jste klikli, na konec jeho dílčích úkolů. Jen pro tento jeden úkol, ne pro celý výběr.

**Přidat milník** — přidá milník jako dílčí úkol úkolu, na který jste klikli. Jen pro tento jeden úkol.

**Přidat závislost** — dělá totéž co *Začít závislost odsud*: zapne režim závislostí s tímto úkolem vybraným. V tabulce úkolů je položka neaktivní, když diagram Gantt není vidět, s nápovědou *Dostupné jen tehdy, když je diagram Gantt vidět*.

**Zvětšit odsazení** a **Zmenšit odsazení** — přesune úkoly rozsahu o jednu úroveň hlouběji nebo o jednu úroveň výš v WBS. Tyto dvě položky jsou jen v čistém stromovém zobrazení. Viz [Úprava struktury](docs://howto-structuur-aanpassen).

**Přepnout milník** — změní úkol na milník, nebo zpět. Nový stav vychází z úkolu, na který jste klikli, a platí pro celý rozsah: je-li to úkol, všechny úkoly v rozsahu se stanou milníky. Souhrnný úkol a úkol s přiřazeními se nestanou milníkem; zbytek rozsahu ano, a dostanete zprávu pro každý důvod.

**Přiřadit kalendář ▸** — podnabídka s položkou *Projektový kalendář* (úkol pak nemá vlastní kalendář) a pod ní dostupné kalendáře. Aktuální volba má zaškrtnutí. Úkol, který už na tom kalendáři je, se nepočítá a nevytvoří další krok v příkazu *Vrátit zpět*. Viz [Vytvoření a přiřazení kalendáře](docs://howto-kalender-maken-en-toewijzen).

**Průběh ▸** — podnabídka s 0%, 25%, 50%, 75% a 100%. Aktuální hodnota má zaškrtnutí. Souhrnný úkol nemá vlastní průběh: je-li jeden v rozsahu, dostanou jeho listové úkoly zvolenou procentuální hodnotu. Pokud není nastaveno datum stavu, aplikace jej nastaví na dnešek a zobrazí zprávu. U úkolu, jehož plánované zahájení je až po datu stavu a který ještě nemá skutečné zahájení, se nejprve objeví dotaz na skutečné zahájení; když dotaz zrušíte, nic se nezmění. Viz [Aktualizace průběhu](docs://howto-voortgang-bijwerken).

**Priorita ▸** — podnabídka s položkami *Nízká* (100), *Normální* (500) a *Vysoká* (900), priorita úkolu při vyrovnání. Aktuální hodnota má zaškrtnutí. Viz [Vyrovnání zdrojů](docs://uitleg-nivelleren).

**Sledovat cestu** — zobrazí předchůdce a následníky tohoto úkolu. Pokud je sledování už zapnuté, položka se jmenuje *Zastavit sledování cesty*. Viz [Sledování cesty](docs://howto-pad-traceren).

**Sbalit**, **Rozbalit** a **Uložit větev jako šablonu** — jen u souhrnného úkolu. *Sbalit* a *Rozbalit* jsou tam vždy obě, i když je úkol už sbalený nebo rozbalený, a platí pro celý rozsah. *Uložit větev jako šablonu* uloží úkol s jeho dílčími úkoly a závislostmi mezi nimi jako šablonu WBS. Viz [Ukládání a vkládání šablon WBS](docs://howto-wbs-sjablonen).

**Odstranit** — smaže úkoly rozsahu i s jejich dílčími úkoly. Aplikace nežádá o potvrzení; vrátit je můžete pomocí Ctrl+Z, jedním krokem pro celý rozsah. Viz [Výběr, mazání a vrácení úkolů](docs://howto-taken-selecteren-verwijderen).

## Nabídka záhlaví skupiny

Tato nabídka existuje jen v tabulce úkolů, na záhlaví skupiny:

**Sbalit skupinu** nebo **Rozbalit skupinu** — sbalí nebo rozbalí jen tuto skupinu. Položka ukazuje, co můžete udělat.

**Rozbalit vše** a **Sbalit vše** — rozbalí nebo sbalí všechny skupiny najednou.

Seskupování nastavíte pomocí rozložení, viz [Vytvoření a použití rozložení](docs://howto-layouts-gebruiken).

## Viz také

- [Přetahování, posouvání a přibližování v diagramu Gantt](docs://howto-gantt-bedienen): co dělá přetahování levým a prostředním tlačítkem myši.
- [Pás karet, karta po kartě](docs://ref-lint): tlačítka se stejnými akcemi.
- [Klávesové zkratky](docs://ref-sneltoetsen): klávesy, které k nim patří.
