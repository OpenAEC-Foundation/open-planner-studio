# Výběr, odstranění a vrácení úkolů

Cíl: vyberte úkoly, odstraňte je a vraťte chybný krok zpět.

## Kdy to potřebujete

Téměř každá akce v plánu pracuje s úkoly, které jste vybrali: odstranění, kopírování, zvětšení odsazení a zapnutí nebo vypnutí milníku. Úkoly odstraňujete, když práce odpadne nebo se plán přepracuje. Protože aplikace při odstraňování nevyžaduje potvrzení, je *Vrátit zpět* vaší pojistkou.

## Postup

### Výběr úkolů

- **Jeden úkol.** Klikněte na řádek v tabulce úkolů nebo na pruh v diagramu Gantt.
- **Více úkolů.** Ctrl+klik (⌘+klik na Macu) přidá úkol do výběru nebo ho z výběru odebere. V tabulce úkolů vyberete klávesou Shift+klik všechny úkoly od aktivního úkolu po ten, na který jste klikli.
- **Všechny viditelné úkoly.** Ctrl+A, když je fokus v tabulce úkolů nebo v diagramu Gantt. Úkoly skryté filtrem do výběru nepatří a stejně tak ani dílčí úkoly ve sbalené fázi.
- **Rámeček v diagramu Gantt.** Podržte Ctrl a táhněte přes prázdné pozadí: vyberou se všechny úkoly v řádcích, kterých se rámeček dotýká, i když jejich pruh leží vedle něj. Počítá se jen výška rámečku, ne časová osa. Když pustíte Ctrl až po tlačítku myši, přidají se k existujícímu výběru; jinak ho nahradí. Bez Ctrl takové tažení ve výchozím nastavení posouvá časovou osu.
- **Zrušení výběru.** Stiskněte Esc nebo klikněte na prázdné pozadí diagramu Gantt.

Když vyberete souhrnný úkol, jeho dílčí úkoly se tak nevyberou. Při odstranění a kopírování se ale zahrnou.

### Odstranění úkolů

Vyberte úkoly a zvolte jeden z těchto postupů:

- *Domů › Upravit › Odstranit*. Stejné tlačítko je na kartě *Tabulka*.
- Klávesy Delete nebo Backspace, pokud fokus není v tabulce úkolů. Nejdřív proto klikněte na pruh v diagramu Gantt.
- *Odstranit* v kontextové nabídce. Pokud úkol, na který jste klikli, patří do výběru, platí to pro celý výběr; jinak jen pro tento jeden úkol.
- Malá ikona koše v horní části panelu *Vlastnosti* (bublina nápovědy *Odstranit úkol*). Ta odstraní úkol, který panel zobrazuje.

Aplikace nežádá o potvrzení. Když odstraníte více úkolů najednou, *Vrátit zpět* to bere jako jeden krok.

Spolu s nimi zmizí: všechny dílčí úkoly odstraněného souhrnného úkolu, všechny závislosti vedoucí z odstraněných úkolů a do nich a jejich přiřazení zdrojů. Když odstraníte poslední dílčí úkol souhrnného úkolu, zůstane jako běžný úkol. Je-li zapnuto *WBS auto*, aplikace přečísluje strom. Plán potom není aktuální: stiskněte **Přepočítat** (F5), pokud není zapnuto *Automaticky přepočítat*.

### Sbalování a rozbalování

Souhrnný úkol má v tabulce úkolů před názvem trojúhelník. Kliknutím na něj skryjete nebo zobrazíte jeho dílčí úkoly. Pomocí *Zobrazení › Osnova › Sbalit* a *Rozbalit* to uděláte pro vybrané souhrnné úkoly, nebo pro všechny, když není nic vybráno. Kontextová nabídka souhrnného úkolu má také *Sbalit* a *Rozbalit*. V seskupeném zobrazení pracují tlačítka se skupinami.

Aplikace uchovává sbalení a rozbalení zvlášť pro každý otevřený dokument. Není součástí *Vrátit zpět* a není v souboru projektu.

### Vrácení zpět a znovu

- *Domů › Upravit › Vrátit zpět* a *Znovu* (také na kartě *Tabulka*), šipky v záhlaví okna, nebo Ctrl+Z pro vrácení zpět a Ctrl+Y nebo Ctrl+Shift+Z pro opětovné provedení.
- Když po použití příkazu *Vrátit zpět* provedete něco nového, *Znovu* zmizí.

*Vrátit zpět* se týká změn dat projektu (úkolů, závislostí, zdrojů, kalendářů a podobně) a použití rozložení. Také změny sloupců tabulky úkolů jsou kroky: přidání, odebrání, přesun, změna velikosti, automatické přizpůsobení šířky, připnutí a obnovení výchozího rozložení sloupců. Tyto kroky patří samotné tabulce úkolů a platí pro celou aplikaci, ne pro jeden dokument. Aplikace uchovává posledních sto kroků na dokument; u velmi velkého projektu jich je méně.

## Úskalí a co aplikace dělá

**Klávesa Delete v tabulce úkolů úkol neodstraní.** Když je fokus v tabulce úkolů, Delete (nebo Backspace) vymaže obsah vybraných buněk. U povinné nebo vypočítané buňky, například u názvu nebo doby trvání, aplikace odmítne a zobrazí zprávu pod tabulkou úkolů. U názvu například *Tato hodnota je povinná a nesmí zůstat prázdná.* Potom se nevymaže nic, ani v dalších vybraných buňkách. Klikněte na pruh v diagramu Gantt nebo použijte *Odstranit* (na kartě *Tabulka*, kde není diagram Gantt: *Tabulka › Upravit › Odstranit* nebo kontextová nabídka).

**Celá fáze zmizí najednou.** Když odstraníte souhrnný úkol, zmizí s ním jeho dílčí úkoly, jejich závislosti a přiřazení. *Vrátit zpět* (Ctrl+Z) vrátí vše zpět, včetně závislostí a přiřazení.

**Co se nevrátí.** Výběr, sbalení a rozbalení a tlačítko *Vymazat* v liště *Není k dispozici při filtrování, seskupování nebo řazení* nejsou součástí příkazu *Vrátit zpět*. Když stisknete Ctrl+Z po stisku tlačítka *Vymazat*, vrátíte tedy zpět svůj předchozí krok, ne vymazání.

**Odstranění úkolu, na kterém jiné úkoly závisí.** Zmizí také závislosti vedoucí z tohoto úkolu a do něj. Úkoly, které na něm jen visely, se uvolní a po přepočítání (**Přepočítat**) začnou zase od svého plánovaného začátku. Pokud je třeba, přidejte nové závislosti, viz [Přidání závislostí](docs://howto-relaties-leggen).

## Viz také

- [Přidání úkolů a milníků](docs://howto-taken-en-mijlpalen-toevoegen): opak, a kopírování úkolů.
- [Úprava struktury](docs://howto-structuur-aanpassen): zařaďte úkol pod jinou fázi místo jeho odstranění.
- [Tažení, posouvání a přibližování v diagramu Gantt](docs://howto-gantt-bedienen): rámeček výběru a režimy posouvání.
- [Kontextové nabídky](docs://ref-contextmenus): co dělá *Odstranit* a další položky s výběrem.
