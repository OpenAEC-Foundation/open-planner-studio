# Přidání úkolů a milníků

Cíl: přidejte nový úkol nebo milník do plánu na místo, kam patří.

## Kdy to potřebujete

Sestavujete plán, přidávají se práce, nebo chcete zaznamenat okamžik, například předání nebo kontrolu.

**Úkol** je práce, která trvá určitou dobu. Nový úkol trvá ve výchozím nastavení 5 pracovních dnů (při plánování v hodinách může být výchozí hodnota projektu v hodinách). **Milník** je okamžik bez doby trvání: 0 dnů. Úkol s dílčími úkoly se nazývá **souhrnný úkol**, ve stavebnictví je to často fáze. Jeho doba trvání a data vycházejí z dílčích úkolů, jakmile použijete **Přepočítat** (F5).

## Postup

### Přidání úkolu

1. Zvolte *Domů › Úkoly › Úkol*. Stejné tlačítko je na kartě *Tabulka*.
2. Otevře se panel *Vlastnosti* a pole *Název* je vybrané. Napište název a stiskněte Enter.

Nový úkol se nejdřív jmenuje *Nový úkol* a začíná v den zahájení projektu.

Pokud je vybraný úkol, nový úkol přijde přímo pod něj, na stejnou úroveň. Pokud je vybraný úkol souhrnný úkol, přijde nový úkol pod celou fázi, tedy za jeho dílčí úkoly. Pokud není nic vybráno, přijde dole v seznamu. Nápověda u tlačítka ukazuje, co se stane: *Nový úkol přímo pod výběrem* nebo *Nový úkol na konci seznamu*. Pokud vyberete několik úkolů, vznikne jeden nový úkol pod nejnižším z výběru, tak jak ho vidíte na obrazovce.

### Rychle jeden za druhým v tabulce úkolů

Pod posledním úkolem v tabulce úkolů je vždy šedý řádek *Nový úkol*. Ještě to není úkol: není v diagramu Gantt a není v souboru.

1. Klikněte na buňku tohoto řádku, nebo se na něj přesuňte šipkou dolů.
2. Napište název a stiskněte Enter. Teď je to skutečný úkol na stejné úrovni jako úkol nad ním. Kurzor je hned na novém šedém řádku pod ním.
3. Napište další název a tak dál.

Pokud na šedém řádku vyplníte jen dobu trvání nebo datum, úkol se jmenuje *Nový úkol*. Pokud odejdete bez vyplnění čehokoli, nic se nestane: žádný úkol a žádný krok v *Zpět*. Vytvoření úkolu a jeho první hodnota tvoří dohromady jeden krok v *Zpět*. Šedý řádek je k dispozici jen tehdy, když tabulka úkolů není filtrovaná, seskupená ani řazená.

### Pravým tlačítkem na prázdné místo

Klikněte pravým tlačítkem na prázdné místo: v tabulce úkolů pod posledním úkolem, nebo v diagramu Gantt vedle pruhů nebo pod nimi. Zvolte *Nový úkol* nebo *Přidat milník*. Úkol přijde dole v seznamu. V diagramu Gantt začne na datu, na které jste klikli. V tabulce úkolů se hned otevře buňka názvu, takže můžete psát.

### Nad nebo pod konkrétní úkol

Klikněte na úkol pravým tlačítkem a zvolte *Vložit nad* nebo *Vložit pod*. Funguje i klávesnice: Insert přidá úkol nad vybraný úkol, Ctrl+I (na Macu ⌘+I) pod něj. V tabulce úkolů se po Insertu hned otevře buňka názvu, připravená k psaní.

Pokud je vybraných více úkolů, vznikne jeden nový úkol: *Vložit nad* ho dá nad nejvyšší vybraný úkol, *Vložit pod* pod nejnižší.

### Přidání dílčího úkolu

Klikněte na úkol pravým tlačítkem a zvolte *Přidat dílčí úkol*. Nový úkol přijde dole mezi dílčími úkoly tohoto úkolu. V tabulce úkolů vedle diagramu Gantt má souhrnný úkol za názvem také malé **+**, které dělá totéž.

### Přidání milníku

1. Zvolte *Domů › Úkoly › Milník ▾* a potom *Počáteční milník*, *Milník dokončení* nebo *Kontrolní milník (povinný)*.
2. Napište název a stiskněte Enter. Umístění se řídí stejným pravidlem jako u tlačítka *Úkol*.

Tři druhy se liší takto:

- *Počáteční milník* patří na začátek dne, *Milník dokončení* na závěr dne. V diagramu Gantt sedí kosočtverec vlevo, respektive vpravo od sloupce dne. Záleží na tom i u následníka. Řekněme, že milník je v úterý 29. září 2026 a za ním je navázán úkol se závislostí dokončení-zahájení: po počátečním milníku začíná tento úkol ve stejné úterý, po milníku dokončení ve středu 30. září.
- *Kontrolní milník (povinný)* je milník dokončení s typem úkolu *Kontrola/inspekce* a zaškrtnutým polem *Povinný (smluvní)*.

### Změna existujícího úkolu na milník

Klikněte na úkol pravým tlačítkem a zvolte *Přepnout milník*, nebo zaškrtněte *Milník* v panelu *Vlastnosti*. Položka nabídky platí pro celý výběr. Doba trvání se změní na 0.

Pokud to zase vypnete, zůstane běžný úkol s dobou trvání 0: dobu trvání zadejte sami.

### Další způsoby

- Ctrl+M (na Macu ⌘+M) přidá nový milník dole v seznamu, i když je vybraný úkol. Panel *Vlastnosti* se neotevře.
- *Přidat milník* v nabídce pravého tlačítka u úkolu udělá z milníku dílčí úkol tohoto úkolu, ne sourozence.

### Kopírování úkolu nebo celé větve

1. V diagramu Gantt klikněte na pruh úkolu. Další úkoly vyberte Ctrl+klikem.
2. Stiskněte Ctrl+C (na Macu ⌘+C). Aplikace zkopíruje úkol se všemi dílčími úkoly, závislostmi mezi zkopírovanými úkoly a jejich přiřazeními zdrojů.
3. Pokud chcete, klikněte na pruh úkolu, vedle kterého má kopie být, a stiskněte Ctrl+V (na Macu ⌘+V).

Kopie má stejný název, stejná data a stejný průběh. Vloží se jako sourozenec vybraného úkolu (u více úkolů ten, na který jste klikli jako první), dole mezi těmito sourozenci. Pokud nic není vybráno, přijde dole v seznamu. Zkopírované úkoly jsou potom vybrané, kódy WBS (číslo každého úkolu ve stromu, například 1.2; viz [Úprava struktury](docs://howto-structuur-aanpassen)) se určí znovu a plán je zastaralý.

Schránka je sdílená v celé aplikaci, takže můžete vložit i do jiného dokumentu. Co tam neexistuje, například kalendář úkolu, vlastní typ úkolu, kód aktivity nebo vlastní pole, aplikace vymaže a oznámí vám to.

### Potom

Nový úkol zatím nemění ostatní data. Stavový řádek ukazuje *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*.

## Časté chyby a co dělá aplikace

**Každý nový úkol začíná v den zahájení projektu.** Bez závislostí na nic nečeká. Přidejte závislosti, viz [Přidání závislostí](docs://howto-relaties-leggen).

**Filtrování, seskupování nebo řazení je zapnuté.** Pořadí, které vidíte, pak není pořadím plánu. Pokud je vybraný úkol, přidají tlačítka *Úkol* a *Milník ▾* nový úkol dole v seznamu a objeví se proužek *Není k dispozici při filtrování, seskupování nebo řazení*. *Vložit nad* a *Vložit pod* se odmítnou se stejným proužkem. Tlačítko *Vymazat* v proužku odstraní filtr, seskupení i řazení najednou. To není součástí *Zpět*: Ctrl+Z je nevrátí.

**Dílčí úkol pod úkolem s přiřazeními zdrojů.** Úkol se změní na souhrnný úkol a souhrnný úkol nemá přiřazení sám. Aplikace přesune přiřazení na nový dílčí úkol a oznámí vám to. Pokud to není možné, například protože jste zvolili *Přidat milník* a milník nemůže mít přiřazení, aplikace nepřidá nic a řekne proč.

**Dílčí úkol pod milníkem.** Milník se změní na souhrnný úkol, aplikace odstraní příznak milníku a zobrazí zprávu.

**Milník zapnutý u souhrnného úkolu nebo u úkolu s přiřazeními.** Aplikace to odmítne a řekne proč. Při přiřazeních je nejdřív odstraňte.

**Kopírování v tabulce úkolů.** V tabulce úkolů (a na kartě *Tabulka*) Ctrl+C kopíruje jen hodnoty vybraných buněk, jako v tabulkovém procesoru, a Ctrl+V vkládá do buněk. Kopírování úkolů proto funguje jen v diagramu Gantt: nejdřív klikněte na pruh.

## Viz také

- [Úprava struktury](docs://howto-structuur-aanpassen): zvětšit odsazení a přesunout úkoly, čísla WBS zůstanou aktuální.
- [Přidání závislostí](docs://howto-relaties-leggen): propojení úkolů.
- [Výběr, odstranění a vrácení úkolů](docs://howto-taken-selecteren-verwijderen): odebrání úkolu zase.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co aplikace vypočítá, až budou závislosti.
- [Dialog úkolu a panel vlastností](docs://ref-taak-eigenschappen): všechna pole úkolu.
- [Nový projekt a info o projektu](docs://ref-projectinfo): začít se šablonou fází.
- [Nabídky pravého tlačítka](docs://ref-contextmenus): všechny položky nabídky u úkolu.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): malý příkladový projekt (*Soubor › Příklady*) se čtyřmi fázemi, počátečním milníkem a povinným milníkem předání.
