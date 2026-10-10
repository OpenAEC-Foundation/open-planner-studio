# Přidání úkolů a milníků

Cíl: vložit nový úkol nebo milník do plánu, na místo, kam patří.

## Kdy to potřebujete

Sestavujete plán, přidává se práce, nebo chcete zaznamenat okamžik, například předání nebo kontrolu.

**Úkol** je práce, která trvá určitou dobu. Nový úkol trvá ve výchozím nastavení 5 pracovních dnů (při plánování v hodinách může být výchozí hodnota projektu v hodinách). **Milník** je okamžik bez doby trvání: 0 dní. Úkol s dílčími úkoly se nazývá **souhrnný úkol**, ve stavebnictví to bývá často fáze. Jeho doba trvání a data vyplynou z jeho dílčích úkolů, jakmile použijete **Přepočítat** (F5).

## Postup

### Přidání úkolu

1. Zvolte *Domů › Úkoly › Úkol*. Stejné tlačítko je na kartě *Tabulka*.
2. Otevře se panel *Vlastnosti* a vybrané je pole *Název*. Zadejte název a stiskněte Enter.

Nový úkol se nejdřív jmenuje *Nový úkol* a začíná na zahájení projektu.

Pokud je vybraný úkol, nový úkol se vloží přímo pod něj, na stejnou úroveň. Pokud je vybraný úkol souhrnný úkol, nový úkol se vloží pod celou fázi, tedy za její dílčí úkoly. Pokud není nic vybráno, vloží se na konec seznamu. Nápověda u tlačítka ukazuje, který z těchto dvou případů nastane: *Nový úkol přímo pod výběrem* nebo *Nový úkol na konci seznamu*. Když vyberete několik úkolů, vznikne jeden nový úkol pod nejnižším z výběru, tak jak ho vidíte na obrazovce.

### Rychlé přidávání jednoho úkolu za druhým v seznamu úkolů

Pod posledním úkolem v seznamu úkolů je vždy šedý řádek *Nový úkol*. Ještě to není úkol: není v diagramu Gantt a není v souboru.

1. Klikněte na buňku toho řádku, nebo na něj přejděte šipkou dolů.
2. Zadejte název a stiskněte Enter. Teď je to skutečný úkol, na stejné úrovni jako úkol nad ním. Kurzor je hned na novém šedém řádku pod ním.
3. Zadejte další název a tak dále.

Když na šedém řádku vyplníte jen dobu trvání nebo datum, úkol se jmenuje *Nový úkol*. Když odejdete, aniž byste cokoli vyplnili, nic se nestane: žádný úkol a žádný krok v *Vrátit zpět*. Vytvoření úkolu a jeho první hodnota jsou dohromady jeden krok v *Vrátit zpět*. Šedý řádek je vidět jen tehdy, když seznam úkolů není filtrovaný, seskupený ani seřazený.

### Pravým tlačítkem myši na prázdné místo

Klikněte pravým tlačítkem na prázdné místo: v seznamu úkolů pod posledním úkolem, nebo v diagramu Gantt vedle nebo pod pruhy. Zvolte *Nový úkol* nebo *Přidat milník*. Úkol se vloží na konec seznamu. V diagramu Gantt začíná na datu, na které jste klikli. V seznamu úkolů se hned otevře buňka názvu, abyste mohli psát.

### Nad nebo pod konkrétní úkol

Klikněte pravým tlačítkem na úkol a zvolte *Vložit nad* nebo *Vložit pod*. Funguje i klávesnice: Insert vloží nad vybraný úkol, Ctrl+I (na Macu ⌘+I) pod něj. V seznamu úkolů se po Insertu hned otevře buňka názvu, připravená k psaní.

Když je vybraných několik úkolů, vznikne jeden nový úkol: *Vložit nad* ho umístí nad nejvyšší vybraný úkol, *Vložit pod* pod nejnižší.

### Přidání dílčího úkolu

Klikněte pravým tlačítkem na úkol a zvolte *Přidat dílčí úkol*. Nový úkol se vloží na konec dílčích úkolů tohoto úkolu. V seznamu úkolů vedle diagramu Gantt má souhrnný úkol za svým názvem také malé **+**, které dělá totéž.

### Přidání milníku

1. Zvolte *Domů › Úkoly › Milník ▾* a potom *Milník zahájení*, *Milník dokončení* nebo *Kontrolní milník (povinný)*.
2. Zadejte název a stiskněte Enter. Umístění se řídí stejným pravidlem jako pro *Úkol*.

Tři druhy se liší takto:

- *Milník zahájení* patří na začátek dne, *Milník dokončení* na konec dne. V diagramu Gantt je kosočtverec vlevo, respektive vpravo od sloupce dne. Záleží na tom i pro následníka. Řekněme, že milník je v úterý 29. září 2026 a za ním následuje úkol se závislostí dokončení-zahájení: po milníku zahájení začne tento úkol ve stejné úterý, po milníku dokončení ve středu 30. září.
- *Kontrolní milník (povinný)* je milník dokončení s typem úkolu *Kontrola/inspekce* a zaškrtnutou volbou *Povinný (smluvní)*.

### Existující úkol změnit na milník

Klikněte pravým tlačítkem na úkol a zvolte *Přepnout milník*, nebo zaškrtněte *Milník* v panelu *Vlastnosti*. Položka nabídky platí pro celý výběr. Doba trvání se změní na 0.

Když to zase zrušíte, zůstane běžným úkolem s dobou trvání 0: dobu trvání zadejte sami.

### Další způsoby

- Ctrl+M (na Macu ⌘+M) vloží nový milník na konec seznamu, i když je vybraný úkol. Panel *Vlastnosti* se neotevře.
- *Přidat milník* v nabídce pravého tlačítka u úkolu udělá z milníku dílčí úkol tohoto úkolu, ne sourozence.

### Kopírování úkolu nebo celé větve

1. V diagramu Gantt klikněte na pruh úkolu. Další úkoly vyberte klepnutím se stisknutým Ctrl.
2. Stiskněte Ctrl+C (na Macu ⌘+C). Aplikace zkopíruje úkol se všemi jeho dílčími úkoly, závislosti mezi kopírovanými úkoly a jejich přiřazení zdrojů.
3. Pokud chcete, klikněte na pruh úkolu, vedle kterého má kopie být, a stiskněte Ctrl+V (⌘+V).

Kopie má stejný název, stejná data a stejný průběh. Vloží se jako sourozenec vybraného úkolu (u více úkolů ten, na který jste klikli jako první), na konec mezi tyto sourozence. Když není nic vybráno, vloží se na konec seznamu. Zkopírované úkoly jsou potom vybrány, kódy WBS (číslo každého úkolu ve stromu, například 1.2; viz [Úprava struktury](docs://howto-structuur-aanpassen)) se určí znovu a plán je zastaralý.

Schránka je společná pro celou aplikaci, takže můžete vložit i do jiného dokumentu. Co tam neexistuje, například kalendář úkolu, vlastní typ úkolu, kód úkolu nebo vlastní pole, aplikace vymaže a oznámí vám to.

### Potom

Nový úkol zatím nemění ostatní data. Stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například v nabídce *Domů › Plán › Přepočítat*.

## Úskalí a co aplikace dělá

**Každý nový úkol začíná na zahájení projektu.** Bez závislostí úkol na nic nečeká. Přidejte závislosti, viz [Přidání závislostí](docs://howto-relaties-leggen).

**Filtrování, seskupování nebo řazení je zapnuto.** Pořadí, které vidíte, pak není pořadím plánu. Když je úkol vybraný, *Úkol* a *Milník ▾* přidají nový úkol na konec a objeví se pruh *Není k dispozici při filtrování, seskupování nebo řazení*. *Vložit nad* a *Vložit pod* se odmítnou, se stejným pruhem. Tlačítko *Vymazat* v pruhu odstraní filtr, seskupení i řazení najednou. To není součást *Vrátit zpět*: Ctrl+Z je neobnoví.

**Dílčí úkol pod úkolem s přiřazeními zdrojů.** Úkol se stane souhrnným úkolem a souhrnný úkol sám žádná přiřazení nenese. Aplikace přesune přiřazení na nový dílčí úkol a oznámí vám to. Když to není možné, například protože jste zvolili *Přidat milník* a milník nemůže nést přiřazení, aplikace nic nepřidá a řekne proč.

**Dílčí úkol pod milníkem.** Milník se stane souhrnným úkolem a aplikace odstraní příznak milníku a zobrazí hlášení.

**Zapnutí milníku u souhrnného úkolu nebo u úkolu s přiřazeními.** Aplikace to odmítne a řekne proč. Při přiřazeních: nejdřív je odeberte.

**Kopírování v seznamu úkolů.** V seznamu úkolů (a na kartě *Tabulka*) Ctrl+C zkopíruje jen hodnoty vybraných buněk, jako v tabulkovém procesoru, a Ctrl+V vkládá do buněk. Kopírování úkolů proto funguje jen tehdy, když použijete diagram Gantt: nejdřív klikněte na pruh.

## Viz také

- [Úprava struktury](docs://howto-structuur-aanpassen): zvětšte odsazení a přesouvejte úkoly a udržujte čísla WBS aktuální.
- [Přidání závislostí](docs://howto-relaties-leggen): propojte úkoly dohromady.
- [Výběr, odstranění a vrácení úkolů](docs://howto-taken-selecteren-verwijderen): ukazuje, jak úkol zase odebrat.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co aplikace přepočítá, když existují závislosti.
- [Dialog úkolu a panel vlastností](docs://ref-taak-eigenschappen): všechna pole úkolu.
- [Nový projekt a Informace o projektu](docs://ref-projectinfo): začněte se šablonou fází.
- [Nabídky pravého tlačítka](docs://ref-contextmenus): všechny položky nabídky u úkolu.
- [Rekonstrukce a přístavba rodinného domu](examples://showcase-verbouwing-eengezinswoning.ifc): malý příkladový projekt (*Soubor › Příklady*) se čtyřmi fázemi, milníkem zahájení a povinným milníkem předání.
