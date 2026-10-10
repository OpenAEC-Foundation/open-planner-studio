# Ukládání a správa směrného plánu

Cíl: zaznamenat plán jako dohodu (směrný plán), abyste později viděli, jak se provádění odchyluje, a abyste mohli uchovat, přejmenovat, vybrat a odstranit více směrných plánů.

## Kdy to potřebujete

Směrný plán zaznamenáte tehdy, když je plán schválen a stavební práce ještě nemají začít. Pokud se plán později formálně upraví, například po změnovém příkazu, uložíte druhý směrný plán a první si ponecháte. Díky tomu měříte provádění vůči první dohodě i vůči upravené. Co směrný plán přesně zaznamená a jak aplikace počítá odchylku, je vysvětleno v [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang).

## Postup

### Uložení směrného plánu

1. Stiskněte **Přepočítat** (F5), například na kartě *Plán › Plán › Přepočítat*. Směrný plán zaznamená data, která se v tu chvíli vypočítají.
2. Zvolte *Plán › Směrné plány a průběh › Spravovat směrné plány…*. Otevře se okno *Směrné plány*.
3. Pod nadpisem *Uložit nový směrný plán* je navržený název, například *Směrný plán 1 — (dnešní datum)*. Zadejte vlastní název, který později poznáte, například *Směrný plán*.
4. Klikněte na *Uložit*. Směrný plán je teď v seznamu a hned je aktivní.
5. Klikněte na *Zavřít*.

Pod každým pruhem úkolu v diagramu Gantt je teď tenký pruh s daty směrného plánu. Milník dostane malý kosočtverec. Překryv zapnete nebo vypnete na kartě *Zobrazení › Směrné plány a průběh › Překryv směrného plánu*.

### Výběr aktivního směrného plánu

Otevřete *Spravovat směrné plány…* a ve sloupci *Aktivní* zvolte směrný plán, se kterým chcete porovnávat. Dokud existují směrné plány, je právě jeden aktivní. Překryv v diagramu Gantt, typ sestavy *Odchylka* a *Sestava průběhu* používají aktivní směrný plán.

### Přejmenování směrného plánu

Změňte název v seznamu. Změna se použije ihned. Nemusíte klikat na *Uložit*.

### Odstranění směrného plánu

Klikněte na malou ikonu koše vedle směrného plánu v seznamu. Pokud odstraníte aktivní směrný plán, aplikace se zeptá: *Smazat aktivní směrný plán?*. Poté se nejnovější zbývající směrný plán stane aktivním. Pokud žádný další není, žádný směrný plán už není aktivní a překryv zmizí. Pomocí Ctrl+Z obnovíte smazaný směrný plán.

### Odchylky v tabulce úkolů

Každý směrný plán má v tabulce úkolů šest sloupců. Klikněte na **+** vpravo v záhlaví tabulky úkolů (*Přidat sloupec*) a otevřete kategorii *Směrný plán*. Pro každý směrný plán jsou k dispozici tyto sloupce: *Plánované zahájení*, *Plánované dokončení*, *Doba trvání*, *Odchylka zahájení*, *Odchylka dokončení* a *Odchylka doby trvání*, s názvem směrného plánu před nimi, například *Směrný plán — Odchylka dokončení*. Odchylky udávají počet pracovních dnů: plus znamená později, minus dříve. Pro úkol, který není součástí směrného plánu, ukazují sloupce pomlčku (—).

## Úskalí a co aplikace dělá

**Zastaralý plán.** Pokud je plán zastaralý, okno zobrazí *Plán je zastaralý — nejdřív přepočítat (F5)*. Jde o varování; uložení zůstává možné. Uložíte pak ale stará data. Zavřete okno, stiskněte **Přepočítat** a teprve potom uložte.

**Směrný plán s průběhem.** Pokud uložíte směrný plán poté, co zadáte průběh, zaznamená stav s těmito skutečnými daty. Odchylka je pak nulová a o provádění už nic neříká. Směrný plán uložte dříve, než začnou stavební práce.

**Směrný plán nejde upravit.** Pokud chcete dohodu změnit, uložte nový směrný plán a případně odstraňte starý.

**Jen úkoly bez dílčích úkolů.** Fáze není součástí směrného plánu: nemá pruh směrného plánu ani odchylku. Fáze vychází z úkolů pod ní.

**Nové a odstraněné úkoly.** Úkol, který přidáte po uložení, nemá pruh směrného plánu. V sestavě odchylek se zobrazí jako *Nový*. Úkol, který odstraníte, se zobrazí jako *Vypuštěno*.

**Přesun projektu.** V okně *Přesunout projekt…* je, jakmile existují směrné plány, zaškrtávací políčko *Posunout i směrné plány*. Výchozí stav je vypnutý: směrné plány zůstanou na místě, takže se posun ukáže jako odchylka. Viz [Přesun projektu](docs://howto-project-verplaatsen).

**Uloženo v souboru projektu.** Směrné plány a výběr aktivního směrného plánu se uloží s projektem a po otevření souboru se obnoví.

## Viz také

- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): co směrný plán zaznamená a jak se odchylka počítá.
- [Přesun projektu](docs://howto-project-verplaatsen): zaškrtávací políčko *Posunout i směrné plány*.
- [Aktualizace průběhu](docs://howto-voortgang-bijwerken): zadání skutečného stavu, který porovnáváte se směrným plánem.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): jeden směrný plán (*Baseline at start*) před zahájením, s průběhem a datem stavu 20. května 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dva směrné plány, *Contract* a *Re-baseline (variation order)*, s průběhem a datem stavu 5. července 2027.
