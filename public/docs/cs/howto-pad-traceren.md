# Sledování cesty

Cíl: zviditelnit řetězec úkolů před úkolem nebo za ním. Uvidíte, co určuje datum úkolu a co se posune, když se zpozdí.

## Kdy to potřebujete

Pokládka střechy začne až za tři týdny. Chcete zjistit, který úkol to určuje. Nebo zedník má zpoždění o týden a chcete vidět, které úkoly za ním se posunou. V plánu s desítkami závislostí to z čar nepoznáte. S **sledováním cesty** aplikace obarví všechny **předchůdce** (úkoly, které předcházejí zvolenému úkolu, přímo nebo přes jiné úkoly) a **následníky** (úkoly, které za ním následují). Ostatní úkoly ztlumí.

## Postup

1. Vyberte úkol, jehož cestu chcete vidět, v tabulce úkolů nebo na jeho pruhu v diagramu Gantt. Pokud vyberete více úkolů, aplikace sleduje od úkolu, který jste vybrali jako první.
2. Zvolte *Plán › Sledování cesty › Předchůdci* pro vše, co předchází úkolu. Zvolte *Plán › Sledování cesty › Následníci* pro vše, co za úkolem následuje. Obě tlačítka mohou být zapnutá současně. Stejná dvě tlačítka jsou na kartě *Tabulka*, ve skupině *Sledování cesty*.
3. Chcete-li obě směry najednou, klikněte pravým tlačítkem myši na úkol v diagramu Gantt nebo v tabulce úkolů a zvolte *Sledovat cestu*.
4. Podívejte se na výsledek v diagramu Gantt a v tabulce úkolů. Jak ho číst, je vysvětleno níže.
5. Zastavíte to kliknutím na aktivní tlačítko znovu, kliknutím pravým tlačítkem na úkol a volbou *Zastavit sledování cesty*, nebo klávesou Esc. Esc také zruší výběr.

Pokud při sledování vyberete jiný úkol, cesta se řídí novým výběrem.

## Jak číst výsledek

- Předchůdci jsou zlatí, následníci fialoví. V diagramu Gantt se změní barva pruhů. V tabulce úkolů se vlevo od řádku objeví proužek: plný pro předchůdce, čárkovaný pro následníky. Zvolený úkol má obrys.
- Tmavší barva a v tabulce úkolů silnější proužek s tučným textem označují **hnací vazby**. Jsou to hnací vazby, které tvoří řetězec a skutečně určují data. Co to znamená, je vysvětleno v [Závislosti a prodleva](docs://uitleg-relaties).
- Všechny úkoly mimo cestu jsou ztlumené. Čáry závislostí, které do cesty nepatří, jsou slabší a tečkované.

## Časté potíže a co aplikace dělá

**Žádný vybraný úkol.** Bez vybraného úkolu není co sledovat. Tlačítko je zapnuté, ale na obrazovce se nic nezmění. Nejdříve vyberte úkol.

**Hnací vazby nejsou zvýrazněné.** Zvýraznění pochází z posledního přepočtu. Pokud plán ještě nebyl přepočítán, nebo přepočet hlásí chybu, aplikace obarví všechny předchůdce a následníky stejně silně. Stiskněte *Přepočítat* (F5), například přes *Domů › Plán › Přepočítat*, a podívejte se na cestu znovu. Po změně zůstane zvýraznění u předchozího přepočtu, dokud stavový řádek hlásí *Zastaralé — přepočítejte (F5)*.

**Závislost na fázi.** Sledování jde po závislostech tak, jak jste je vytvořili. Závislost vedoucí z fáze nebo do fáze spojuje samotnou fázi (souhrnný úkol). Pro výpočet platí pro každý úkol ve fázi. Cesta ale nepokračuje k úkolům uvnitř ní. Pokud sledujete úkol uvnitř fáze, která je závislostí na fázi spojena s jiným úkolem, tuto závislost neuvidíte. V takovém případě vyberte přímo fázi.

**Jen zvolený směr.** Pokud je zapnuté jen tlačítko *Předchůdci*, nevidíte, co následuje za úkolem. A naopak.

## Viz také

- [Závislosti a prodleva](docs://uitleg-relaties): proč je závislost hnací vazbou a jak aplikace počítá začátek úkolu.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): který řetězec určuje konec projektu.
- [Přidání závislostí](docs://howto-relaties-leggen): přidání závislosti, když vám v cestě chybí spojení.
