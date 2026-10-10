# Úprava struktury

Cíl: uspořádat úkoly do fází a dílčích úkolů, změnit jejich pořadí a udržet čísla WBS správně.

## Kdy to potřebujete

Váš plán je strom: fáze (souhrnné úkoly) s dílčími úkoly pod nimi, například *Foundation* s *Groundwork*, *Reinforcement* a *Pouring*. Tento strom upravíte, když chcete zavěsit úkoly pod fázi, vyjmout úkol z fáze nebo když je pořadí špatně. **Kód WBS** (1, 1.1, 1.2, 2, …) je číslo úkolu v tomto stromu.

## Postup

### Zvětšení odsazení úkolu

1. Vyberte úkol. Můžete vybrat i více úkolů.
2. Zvolte *Plán › Struktura › Zvětšit odsazení*. Můžete také použít Alt+→ (nebo Alt+Shift+→), případně *Zvětšit odsazení* v kontextové nabídce.

Úkol se stane posledním dílčím úkolem předchozího úkolu na stejné úrovni. Ten předchozí úkol se tím stane souhrnným úkolem. Když vyberete souvislou skupinu, odsadí se celá skupina najednou. Pokud úkol nemá předchozí úkol na stejné úrovni, nic se nestane. Aplikace nezobrazí žádné hlášení.

### Zmenšení odsazení úkolu

Zvolte *Plán › Struktura › Zmenšit odsazení*, stiskněte Alt+← (nebo Alt+Shift+←), nebo zvolte *Zmenšit odsazení* v kontextové nabídce.

Úkol se stane úkolem na stejné úrovni hned za fází, pod kterou visel. Jeho vlastní dílčí úkoly jdou s ním. Úkoly, které po něm následovaly v této fázi, v ní zůstanou. Úkol na nejvyšší úrovni se dál zmenšit nedá.

### Přesun úkolu

Máte tři způsoby.

- **Klávesnicí.** Alt+↑ a Alt+↓ vymění úkol se sousedem na stejné úrovni. Souhrnný úkol vezme své dílčí úkoly s sebou. Na začátku nebo na konci úrovně se nic nestane. Když je vybraných více úkolů, přesune se jen úkol, na který jste klikli jako první.
- **Přetažením v tabulce úkolů.** Stiskněte myší řádek a táhněte svisle. Horní čtvrtina řádku znamená *před*, spodní čtvrtina *po*. Střed souhrnného úkolu zavěsí úkol pod něj jako jeho poslední dílčí úkol. Střed běžného úkolu se počítá jako nejbližší okraj. Když přetáhnete řádek, který je součástí vícenásobného výběru, přesune se celý výběr.
- **Přetažením v Gantt diagramu.** Přetáhněte pruh svisle na jiný řádek. Funguje to stejně jako přetažení v tabulce a nemění to žádná data. Když táhnete vodorovně, posunete místo toho data.

Každý přesun je jeden krok pro *Vrátit zpět* (Ctrl+Z).

### Udržování čísel WBS aktuální

Podívejte se na tlačítko *WBS auto* na kartě *Plán › Struktura*.

- **Zapnuto (výchozí v novém projektu).** Aplikace přečísluje celý strom při každém přidání, smazání a přesunu. Kód WBS je pak jen pro čtení: nemůžete ho zapsat v tabulce úkolů ani v panelu *Vlastnosti*. Tlačítko *Přečíslovat WBS* je nedostupné.
- **Vypnuto.** Kódy zůstanou beze změny, i po přesunu a odsazení. Kódy zadáte sami ve sloupci *WBS* nebo v poli *Kód WBS* v panelu *Vlastnosti*. Případně je jednou nechte přečíslovat příkazem *Přečíslovat WBS*. Přečíslování přepíše i kódy, které jste zadali sami.

Když zapnete *WBS auto*, aplikace strom hned přečísluje. Obě akce, *WBS auto* i *Přečíslovat WBS*, můžete vrátit příkazem *Vrátit zpět*.

## Úskalí a co aplikace dělá

**Filtrování, seskupování nebo řazení je zapnuté.** Pořadí, které vidíte, pak neodpovídá pořadí plánu. Aplikace proto strukturu zamkne. *Zvětšit odsazení* a *Zmenšit odsazení* jsou nedostupné a nápověda říká *Není k dispozici při filtrování, seskupování nebo řazení*. Alt+→ a přetažení ukazují stejný text v liště s tlačítkem *Vymazat*. Tím se odstraní filtr, seskupení i řazení najednou, a Ctrl+Z je nevrátí. Potom chybí *Zvětšit odsazení* a *Zmenšit odsazení* i v kontextové nabídce.

Alt+↑ a Alt+↓ fungují v takovém zobrazení bez hlášení. Když je zapnutý jen filtr, uvidíte nové pořadí hned. Při řazení se pořadí v plánu změní, ale uvidíte ho až po kliknutí na tlačítko *Vymazat*.

**WBS auto je vypnuté.** Nový úkol dostane kód, který odpovídá jeho místu ve stromu, i když ho už má jiný úkol. Takto se mohou objevit duplicitní čísla. Po odsazení kódy také přestanou odpovídat stromu. *Přečíslovat WBS* opraví obojí.

**Milník dostane dílčí úkoly.** Milník je okamžik a žádné dílčí úkoly nemá. Aplikace odstraní příznak milníku a zobrazí hlášení.

**Úkol s přiřazeními zdrojů dostane dílčí úkoly.** Souhrnný úkol nenese přiřazení sám. Aplikace je přesune na první nový dílčí úkol, který je může unést, a zobrazí hlášení. Pokud takový dílčí úkol není, nebo už má stejný zdroj, nic se nestane a hlášení uvede proč.

**Závislost by vytvořila cyklus.** Závislosti souhrnného úkolu platí i pro jeho dílčí úkoly. Pokud by přesun kvůli nim vytvořil cyklus, aplikace ho odmítne. Zobrazí hlášení *Tento přesun by v plánu vytvořil cyklus (…)*. Nic se nezmění.

**Závislost mezi úkolem a jeho vlastní fází.** Když dáte úkol pod fázi, s kterou už má závislost, ta závislost zůstane. Do výpočtu se ale nepočítá. Aplikace vás na to upozorní. Více o závislostech u souhrnných úkolů si přečtete v [Závislosti a prodleva](docs://uitleg-relaties).

**Plán není aktuální.** Přesun do jiné fáze může změnit data. Stiskněte **Přepočítat** (F5). Pouhé prohození pořadí ve stejné fázi data nemění.

## Viz také

- [Přidání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen): vložte nové úkoly na správné místo.
- [Ukládání a vkládání šablon WBS](docs://howto-wbs-sjablonen): znovu použijte celou fázi.
- [Přidání závislostí](docs://howto-relaties-leggen): propojte úkoly.
- [Výběr, mazání a vrácení úkolů](docs://howto-taken-selecteren-verwijderen): vraťte přesun zpět.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): čtyři fáze s jejich dílčími úkoly, tak jak je vytvoříte zvětšením odsazení.
