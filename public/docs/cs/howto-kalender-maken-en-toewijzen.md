# Vytvoření a přiřazení kalendáře

Cíl: vytvořte vlastní kalendář, například šestidenní pracovní týden, a přiřaďte ho úkolům, které se v něm mají vypočítávat.

## Kdy to potřebujete

Subdodavatel pracuje také v sobotu. Četa pracuje jen od pondělí do čtvrtka. Úkol spadá do časového úseku, v němž stojí jen tento úkol. Projektový kalendář pak má špatné pracovní dny. S vlastním kalendářem aplikace vypočítá tyto úkoly ve správné dny a zbytek zůstane na projektovém kalendáři. Přesně to, co aplikace s kalendářem dělá, si můžete přečíst v [Kalendáře a pracovní dny](docs://uitleg-kalenders).

## Postup

### Vytvoření kalendáře

1. Zvolte *Plán › Kalendář › Kalendář*. Stejné tlačítko je na kartě *Nastavení › Kalendář › Kalendář*. Otevře se okno *Kalendáře*. Vlevo jsou kalendáře projektu; projektový kalendář má hvězdičku.
2. Pod seznamem klikněte na tlačítko s plusem (*Nový kalendář*). Nový kalendář je kopie standardního kalendáře: pondělí až pátek, 07:00 až 16:00 s hodinovou přestávkou a, je-li zapnutý *Stavební režim*, nizozemské státní svátky. Chcete-li za základ existující kalendář, vyberte ho v seznamu a klikněte na tlačítko se dvěma listy pod seznamem (*Duplikovat*).
3. Dejte kalendáři název v poli *Název*, který říká, kdo ho používá, například *Six-day week*.
4. V části *Pracovní dny* klikněte na dny v týdnu, abyste je zapnuli nebo vypnuli. *Po–Pá* obnoví standardní týden, od 07:00 do 16:00. *Nepřetržitě (24/7)* zapne všech sedm dnů, od 00:00 do 24:00.
5. Upravte pracovní dobu podle potřeby: *Začátek (hodina)*, *Dokončení (hodina)*, *Přerušení práce začíná* a *Doba trvání přestávky (minuty)*. Časy zadáváte ve formátu HH:MM. Šipkami je zvyšujete nebo snižujete o čtvrt hodiny. Když nastavíte dobu trvání přestávky na 0, kalendář pracuje bez přestávky. *Čistých hodin za den* dopočítá aplikace sama. Pokud je zapnuté plánování v hodinách a kalendář má bloky pracovní doby pro jednotlivé dny, tato pole neuvidíte; viz [Nastavení pracovní doby](docs://howto-werktijden-instellen).
6. Upravte podle potřeby svátky. Jak to funguje, popisuje [Generování svátků a letní stavební uzávěry](docs://howto-feestdagen-genereren).
7. Klikněte na *Použít*. Aplikace hned přepočítá plán a okno zavře. Tlačítkem *Zrušit* změny zahodíte. Když hodnotu v poli potvrdíte klávesou Enter, aplikace ji průběžně uloží a také přepočítá, okno se ale nezavře. *Zrušit* pak vrátí jen změny, které jste provedli potom.

### Přiřazení kalendáře úkolům

Nový kalendář začne něco dělat až ve chvíli, kdy ho úkol použije. Existují dva způsoby.

**Přes panel vlastností**

1. Vyberte úkol. Pokud nevidíte panel *Vlastnosti*, zapněte ho na kartě *Zobrazení › Panely › Vlastnosti*.
2. V části *Úkol* zvolte kalendář v seznamu *Kalendář*. Horní volba *Projektový kalendář* s názvem za ní znamená, že úkol nemá vlastní kalendář.

**Přes kontextovou nabídku**

1. Klikněte pravým tlačítkem na úkol v tabulce úkolů nebo na pruh v diagramu Gantt.
2. Zvolte *Přiřadit kalendář* a potom kalendář, nebo *Projektový kalendář*, chcete-li vlastní kalendář úkolu znovu odebrat. Kalendář, který platí, má zaškrtnutí.
3. Chcete-li dát jeden kalendář více úkolům najednou, nejdřív je vyberte s klávesou Ctrl (⌘ na Macu) a klikněte pravým tlačítkem na jeden z vybraných úkolů. Volba platí pro všechny vybrané úkoly. Když pravým tlačítkem kliknete na úkol, který není vybraný, platí volba jen pro tento úkol.

Nová volba kalendáře zatím neudělá plán aktuální: stavový řádek hlásí *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*. Je-li zapnuté *Automaticky přepočítat* (*Nastavení › Projekt › Nastavení*, karta *Plán*, nadpis *Přepočítání*), aplikace to udělá sama.

### Změna projektového kalendáře

1. Otevřete na kartě *Plán › Kalendář › Kalendář* a v seznamu zvolte kalendář.
2. Nad formulářem klikněte na *Nastavit jako výchozí pro projekt*. Hvězdička se přesune na tento kalendář.
3. Klikněte na *Použít*.

Přesunou se jen úkoly, které nemají vlastní kalendář.

### Odstranění kalendáře

1. Otevřete okno *Kalendáře* a v seznamu zvolte kalendář.
2. Pod seznamem klikněte na tlačítko s košem (*Odstranit*). Toto tlačítko je zakázané, dokud v seznamu zůstane jen jeden kalendář.
3. Klikněte na *Použít*. Úkoly a zdroje, které kalendář používaly, se vrátí k projektovému kalendáři. Odstraníte-li samotný projektový kalendář, první kalendář v seznamu se stane projektovým kalendářem.

## Časté problémy a co aplikace potom dělá

**Žádné pracovní dny.** Když vypnete všechny dny v týdnu, aplikace nemůže vypočítávat. Při přepočítání hlásí *Kalendář nemá nastaveny žádné pracovní dny*.

**Neplatný vstup.** Přestávka mimo pracovní den, čas začátku po čase konce nebo svátek s chybným datem dostane u pole červenou zprávu. Tlačítko *Použít* je zakázané, dokud chybu neopravíte. U neplatné přestávky nebo svátku je navíc vedle kalendáře v seznamu výstražný znak (*Tento kalendář obsahuje neplatné údaje*).

**Kalendář u fáze.** Fáze vždy používá projektový kalendář, protože její doba trvání vyplývá z jejích úkolů. Kalendář přiřaďte přímo úkolům.

**Stejný kalendář, dvě volby.** V seznamu je projektový kalendář dvakrát: jako *Projektový kalendář: název* a jako běžný kalendář s tímto názvem. Zvolíte-li druhou možnost, je to samostatná volba pro tento úkol. Úkol se pak nepřesune, až později zvolíte jiný projektový kalendář.

**Jiný počet hodin za den.** Změníte-li pracovní dobu nebo přestávku tak, že se změní hodnota *Čistých hodin za den*, úkol v dnech dál počítá stejný počet dnů. U úkolu se zdroji, u něhož je pravidlo pevné veličiny *Pevná práce* nebo *Pevné jednotky*, se doba trvání skutečně změní, protože práce zůstane stejná. Čtyřicet hodin práce je 5 dnů při 8 hodinách denně a 7 dnů při 6 hodinách denně. Aplikace ohlásí, kolika úkolům se doba trvání změnila.

## Viz také

- [Kalendáře a pracovní dny](docs://uitleg-kalenders): jak aplikace počítá pracovní dny a který kalendář má přednost.
- [Dny a hodiny](docs://uitleg-dagen-en-uren): co dělají čisté hodiny za den.
- [Nastavení kalendáře zdroje](docs://howto-resourcekalender-instellen): kalendář pro zdroj místo úkolu.
- [Okna kalendáře](docs://ref-kalenders): všechna pole oken kalendáře.
