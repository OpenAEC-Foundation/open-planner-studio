# Zapnutí plánování v hodinách

Cíl: plánovat úkoly v pracovních hodinách vedle úkolů ve dnech.

## Kdy to potřebujete

Jeřáb si pronajímáte po hodinách, ne po dnech. Betonáž v délce šesti hodin se do celého pracovního dne nevejde. Noční četa pracuje v jiné době než denní četa. Pro takovou práci potřebujete dobu trvání v hodinách a začátek a dokončení s přesnou hodinou. Zapnete to také tehdy, když otevřete soubor a aplikace zobrazí hlášení *Tento soubor obsahuje plánování v hodinách*. Proč aplikace počítá dny a hodiny jinak, si můžete přečíst v článku [Dny a hodiny](docs://uitleg-dagen-en-uren).

## Postup

### Aktivace plánování v hodinách

1. Zvolte na kartě *Nastavení › Projekt › Nastavení* a otevřete kartu *Plán*.
2. Pod nadpisem *Plánování v hodinách* zaškrtněte *Zapnout plánování v hodinách*. Funguje to hned. V hlášení *Tento soubor obsahuje plánování v hodinách* udělá totéž tlačítko *Zapnout plánování v hodinách*.
3. Pod ním je *Povolit smíšené plánování po dnech a v hodinách*, ve výchozím stavu zapnuté. S tímto nastavením zvolíte pro každý úkol, zda se počítá ve dnech, nebo v hodinách. Když ho vypnete, seznam *Jednotka doby trvání* zmizí. Dobu trvání pak můžete stále zadat s jednotkou, například `12h`.

To nemění jen dobu trvání úkolu. Na kartě *Zobrazení › Časová osa* můžete zvolit měřítko *Hodina*. Okno *Kalendáře* dostane blok *Pracovní hodiny* a okno *Nový projekt* dostane volby *Směna* a *Výchozí jednotka pro nové úkoly*.

### Plánování úkolu v hodinách

1. Vyberte úkol a podívejte se do panelu *Vlastnosti*, v části *Čas*, na pole *Doba trvání*.
2. Zadejte dobu trvání s jednotkou a stiskněte Enter: `12h` (`12u`, nizozemská zkratka, také funguje) pro dvanáct hodin, `1h 30m` pro hodinu a půl. Také `1.5h` je v pořádku. Číslo bez jednotky platí v jednotce, kterou úkol už má.
3. Pokud chcete převést stávající úkol, zvolte v části *Jednotka doby trvání* jednotku *Hodiny*. Aplikace dobu trvání za vás určí a navrhne ji, například *Přesný návrh převodu: 16h. Použijte tento návrh, nebo ponechte stávající jednotku*. Zvolte *Použít návrh* nebo *Ponechat*.
4. Zpět na dny se dostanete pomocí `2d` nebo jednotky *Dny*.
5. Stiskněte **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*. Úkol teď má začátek a dokončení s přesnou hodinou.
6. Pokud chcete vidět hodiny v diagramu Gantt, zvolte měřítko *Hodina* na kartě *Zobrazení › Časová osa*.

### Nové úkoly jako výchozí v hodinách

1. Zvolte na kartě *Nastavení › Projekt › Info o projektu*.
2. Pod nadpisem *Výchozí jednotka pro nové úkoly* zvolte jednotku *Hodiny* a klikněte na *Použít*.

Nový úkol potom bude mít dobu trvání 5 hodin místo 5 dnů. Stávající úkoly se nezmění. U nového projektu je stejná volba v okně *Nový projekt*. Pokud tam v části *Směna* zvolíte *Denní směna*, je *Hodiny* nedostupné. Zvolte jinou směnu, nebo nastavte výchozí jednotku až po vytvoření projektu v okně *Info o projektu*.

## Časté problémy a co aplikace potom dělá

**Žádné platné pracovní hodiny.** Pokud kalendář úkolu nemá použitelné pracovní hodiny, aplikace zobrazí hlášení *Tento kalendář nemá platné pracovní hodiny. Zkontrolujte pracovní dny a pracovní hodiny*. Při přepočítání se může zobrazit hlášení *Hodinový úkol 'name' nemá v kalendáři platné pracovní hodiny*.

**Žádná desetinná čísla u dnů.** Doba trvání ve dnech je celé číslo. `1.5d` zobrazí hlášení *Zadejte celé číslo dnů nebo hodin, například 2d nebo 12h*. Pokud chcete den a půl, plánujte v hodinách.

**Převod, který nemůže být přesný.** Dvanáct hodin se nevejde do celých dnů po 8 hodinách. Aplikace pak zobrazí hlášení *Tuto dobu trvání nelze v aktuálním kalendáři přesně převést na celé dny. Stávající jednotka se zachová; zadejte novou platnou hodnotu sami* a jednotku ponechá beze změny.

**Pole je nedostupné.** U fáze, překlenovacího úkolu nebo milníku s nulovou dobou trvání vyplývá doba trvání z něčeho jiného a vy ji nemůžete zadat.

**Vypnutí plánování v hodinách.** Úkoly v hodinách zůstanou a dál se vypočítávají. Jejich dobu trvání pak nelze upravit. Pole zobrazí *Zapněte plánování v hodinách, abyste mohli upravit tento hodinový úkol*, s tlačítkem, které je zapne znovu.

## Viz také

- [Dny a hodiny](docs://uitleg-dagen-en-uren): jak aplikace počítá hodiny, co se stane, když se dny a hodiny setkají, a kde zaokrouhluje.
- [Nastavení pracovních hodin](docs://howto-werktijden-instellen): časy kalendáře podle dne v týdnu.
- [Přidání závislostí](docs://howto-relaties-leggen): prodleva v hodinách mezi dvěma úkoly.
- [Nastavení](docs://ref-instellingen): nastavení Zapnout plánování v hodinách a co dalšího mění.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): obsahuje úkoly v hodinách (rebar fixing and pouring) s vlastním hodinovým kalendářem, *Hourly calendar, rebar fixing & pouring*.
