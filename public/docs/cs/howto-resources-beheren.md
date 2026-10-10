# Správa zdrojů

Cíl: vytvořit, upravit a odstranit zdroje (lidi, stroje a materiál) ve vašem projektu, abyste je mohli přiřadit k úkolům.

## Kdy to potřebujete

Dřív než přidělíte zedníka nebo jeřáb k úkolu, musí tato osoba nebo stroj existovat jako zdroj. Zdroj eviduje, kolik jich je a v kterých dnech pracují. Aplikace podle toho zjistí, jestli na něj v jeden den nepožadujete příliš mnoho. Zdroj upravíte, když se změní obsazení, například když k týmu přibude druhý zedník.

Dva pojmy. **Maximální počet jednotek** je kapacita za pracovní den: 1 znamená jednu osobu nebo jeden stroj, 2 znamená dva. **Přiřazení** je zdroj na úkolu (viz [Přiřazení zdrojů pomocí křivky](docs://howto-resource-toewijzen)).

## Postup

### Vytvoření zdroje

1. Zvolte *Zdroje › Správa › Nový zdroj*. Panel zdrojů převezme pracovní plochu a na konci tabulky se objeví prázdný řádek. Panel můžete otevřít také na kartě *Zdroje › Správa › Zdroje* a pak zvolte *Nový zdroj v projektu*.
2. Zadejte název, například *Bricklayer*.
3. Zvolte *Typ*: *Práce* (výchozí), *Vybavení*, *Materiál*, *Subdodavatel* nebo *Parta*.
4. Vyplňte ostatní pole, pokud je potřebujete. Každé pole má výchozí hodnotu: *Maximální počet jednotek* je 1 a *Kalendář* je *Projektový kalendář*. *Standardní sazba/hod* je prázdná. Pole *Jednotka* lze vyplnit jen u typu *Materiál*, například m³.
5. Stiskněte Enter nebo klikněte mimo řádek. Zdroj je v tabulce. Po stisku Enter se hned pod ním otevře prázdný řádek pro další zdroj. Až budete hotovi, stiskněte Esc.

Řádek se stane zdrojem, až když má název. Pokud stisknete Esc nebo kliknete mimo řádek bez názvu, aplikace nic nevytvoří. Pořadí, v jakém pole vyplníte, nehraje roli: typ můžete zvolit dřív a název napsat potom.

### Úprava zdroje

Upravte pole v řádku. Aplikace uloží název, standardní sazbu a jednotku, když opustíte pole, a ostatní pole hned.

- *Maximální počet jednotek* aplikace přijme jen tehdy, když je hodnota větší než 0. Při 0 nebo méně dostane pole červený rámeček a vrátí se na předchozí hodnotu.
- *Kalendář* určuje, v kterých dnech zdroj pracuje. Zvolte *Projektový kalendář* nebo vlastní kalendář. Tlačítkem *+ Kalendář zdroje* vytvoříte nový kalendář a tužka (*Upravit…*) otevře zvolený kalendář. Pokud úkol běží v den, kdy zdroj podle svého kalendáře nepracuje, počítá se ten den jako přetížení. Jak vytvořit kalendář zdroje, je popsáno v [Nastavení kalendáře zdroje](docs://howto-resourcekalender-instellen).
- *Standardní sazba/hod* a *Celkem*: *Celkem* je počet vytížených hodin tohoto zdroje násobený sazbou. Omítkář, který je vytížen 32 hodin se sazbou 50 za hodinu, vyjde na 1,600.00. Na konci tabulky je součet všech zdrojů.
- *Parta* seskupí zdroj pod zdroj typu *Parta*. Je to jen seskupení: aplikace nesčítá kapacitu ani vytížení členů do party.
- Barevný čtvereček vlevo je barva zdroje. Slouží jen k zobrazení a na plán nemá žádný vliv.

### Kapacita, která se mění v čase

Přijde váš druhý zedník až 19. července? Klikněte na šipku vedle pole *Maximální počet jednotek*. Pod nadpisem *Kapacita podle období* zvolte *Přidat krok*. Každý krok má datum (*Od*) a číslo (*Maximální počet jednotek*). Od tohoto data platí toto číslo. Bez kroků platí vždy jedna pevná hodnota.

Nový krok začíná dnešním datem a 1 jednotkou. Změňte obojí, jinak platí kapacita 1 od dneška.

### Odstranění zdroje

1. Klikněte v řádku na koš.
2. Pokud má zdroj přiřazení, aplikace požádá o potvrzení, například *'Bricklayer' má 4 přiřazení — odstranit?* Klikněte na fajfku pro odstranění nebo na křížek pro zrušení. Bez přiřazení zdroj hned zmizí.

Přiřazení zdroje zmizí spolu s ním. Pokud má úkol pravidlo pevné veličiny jiné než *Pevné trvání a jednotky*, aplikace rozdělí práci odstraněného zdroje mezi zbývající zdroje. Podle pravidla se tím změní jejich jednotky přiřazení nebo doba trvání úkolu. Když se doba trvání změní, plán už není aktuální.

Vytvoření, úpravu i odstranění zdroje můžete vrátit pomocí *Vrátit zpět* (Ctrl+Z).

### Malý přehled v postranním sloupci

*Zdroje › Správa › Ukotvit zdroje* umístí kompaktní přehled do pravého sloupce vedle panelu *Vlastnosti*. Vidíte tam název a barvu každého zdroje a výstražnou značku (*Přetížen*) u zdroje, který je přetížen. Zde můžete změnit jen *Maximální počet jednotek*. Když vyberete jeden nebo více úkolů, přehled ukáže jen zdroje těchto úkolů.

## Úskalí a co aplikace udělá

**Jen typ *Materiál* ovlivňuje výpočet.** Typy Práce, Vybavení, Subdodavatel a Parta se počítají stejně. Materiál se nezapočítává do doby trvání úkolu a nevyrovnává se. V histogramu se materiál do řádku *Všechny zdroje* také nezapočítává.

**Bez názvu není zdroj.** Prázdný řádek zmizí bez stopy.

**Nový krok v kapacitě.** Když zapomenete změnit datum i číslo, kapacita je od dneška 1.

**Odstranění zdroje, který ještě potřebujete.** Když ho odstraníte omylem, hned stiskněte Ctrl+Z. Přiřazení se vrátí také.

## Viz také

- [Přiřazení zdrojů pomocí křivky](docs://howto-resource-toewijzen): přidělení zdroje k úkolu.
- [Nastavení kalendáře zdroje](docs://howto-resourcekalender-instellen): pevné nastavení pracovních dnů jednoho zdroje.
- [Řešení přetížení](docs://howto-overbezetting-oplossen): co dělat, když má zdroj v jeden den příliš mnoho práce.
- [Panel zdrojů](docs://ref-resourcepaneel): všechna pole a tlačítka panelu zdrojů.
