# Řešení přetížení

Cíl: zjistit, kde má zdroj v jednom dni příliš mnoho práce, a to odstranit, obvykle vyrovnáním úkolů.

## Kdy to potřebujete

Na papíře váš plán funguje, ale Bricklayer pracuje na dvou stěnách, které běží ve stejných dnech. Aplikace tomu říká **přetížení**. Zdroj je v pracovním dni přetížen, když od něj plán ten den žádá víc, než je jeho kapacita (*Maximální počet jednotek*), nebo když ten den podle svého kalendáře nepracuje.

Nejdřív přetížení vyhledáte. Potom zvolíte řešení. **Vyrovnání** je řešení, které za vás spočítá aplikace: úkoly začnou později, dokud zdroj práci zvládne. Jak se to počítá, přečtete v článku [Vyrovnání zdrojů](docs://uitleg-nivelleren).

## Postup

### 1. Najděte přetížení

1. Na pásu karet, na kartě *Zdroje › Přetížení*, uvidíte buď *Žádné*, nebo červeně počet přetížených zdrojů, například *1 zdroj*. Po výpočtu stavový řádek navíc ukazuje *⚠ Přetížení zdrojů: 1*.
2. Klikněte na tuto zprávu ve stavovém řádku. Otevře se vpravo panel *Varování* s řádkem pro každý zdroj, například *Bricklayer* s *Přetížení v počtu dnů: 5 (29-06-2027 – 05-07-2027)*.
3. Klikněte na tento řádek. Aplikace zapne *Histogram*, vybere zdroj a označí všechny úkoly, na kterých je zdroj přiřazen.
4. Podívejte se na histogram pod diagramem Gantt. Červené sloupce jsou přetížené dny. Když přejedete myší přes den, uvidíte, které úkoly se na něm podílejí, například *2 úkoly přispívají dne 2027-06-30* a pod tím jejich názvy.

Histogram můžete zapnout i sami. Zvolte *Zdroje › Histogram › Histogram*. Vyberte zdroj v seznamu vlevo, nebo procházejte zdroje tlačítky *Předchozí* a *Další*. Červená tečka v seznamu znamená, že je zdroj přetížen. Řádek *Všechny zdroje* sečte zdroje dohromady, bez materiálu.

Když je úkol označen, histogram ukazuje jen práci tohoto úkolu a jen zdroje, které na něm jsou. Stiskněte klávesu Esc, zrušte výběr a zobrazte celý projekt znovu.

### 2. Zvolte řešení

- **Větší kapacita.** Pokud opravdu přijde druhý zedník, nastavte *Maximální počet jednotek* na 2 (viz [Správa zdrojů](docs://howto-resources-beheren)). Přetížení pak zmizí.
- **Méně jednotek za den.** Snižte *Jedn./den* nebo zvolte pro přiřazení jinou křivku (viz [Přiřazení zdrojů s křivkou](docs://howto-resource-toewijzen)).
- **Úkoly za sebou.** Přidejte mezi oba úkoly závislost, aby druhý začal až po dokončení prvního (viz [Přidání závislostí](docs://howto-relaties-leggen)).
- **Vyrovnání.** Aplikace nechá úkol začít později.

### 3. Vyrovnání

1. Ujistěte se, že je plán přepočítán příkazem **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*.
2. Zvolte *Zdroje › Vyrovnání › Vyrovnat…*. Otevře se okno *Vyrovnání zdrojů*.
3. Rozhodněte, zda se smí datum dokončení projektu posunout. Když políčko *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné* nezaškrtnete, datum dokončení se může posunout. Když ho zaškrtnete, aplikace posune úkoly jen v rámci jejich časové rezervy.
4. Pod položkou *Zdroje* jsou zdroje, které se vyrovnají. Ve výchozím stavu jsou zaškrtnuté všechny zdroje kromě materiálu. Odškrtněte zdroj, který chcete ponechat beze změny.
5. Klikněte na *Přepočítat*. Během výpočtu je tam *Probíhá přepočítání* a můžete ho zastavit tlačítkem *Zastavit*. Plán se zatím nezmění: jde o návrh.
6. Přečtěte si návrh. Nahoře je datum dokončení, například *Datum dokončení projektu: beze změny (30-08-2027)* nebo *Datum dokončení projektu: 25-08-2027 → 30-08-2027*. Pod ním je tabulka, která pro každý úkol ukazuje *Původní začátek*, *Nový začátek* a *Posun (dny)*, například *Build outer cavity leaf*, 29-06-2027, 06-07-2027 a *5 d*.
7. Zvolte *Použít*. Aplikace zapíše zpoždění do úkolů a plán hned přepočítá. Klávesu F5 nemusíte stisknout. *Zrušit* zavře okno bez změny.
8. Zkontrolujte *Zdroje › Přetížení*. Tam je teď *Žádné*.

Když v okně po kliknutí na *Přepočítat* změníte nějakou možnost, návrh zmizí. Potom klikněte na *Přepočítat* znovu. Když se plán změní, zatímco aplikace počítá, je tam *Plán se změnil během přepočítání. Klikněte znovu na Přepočítat*.

### Který úkol zůstane na místě

Aplikace umísťuje úkoly jeden po druhém. Úkoly, které jdou jako první, zůstanou na místě. Nejdřív jdou úkoly s nejvyšší prioritou. Při stejné prioritě jde nejdřív úkol s nejmenší časovou rezervou.

Když chcete sami rozhodnout, který úkol zůstane, dejte mu vyšší prioritu. Klikněte pravým tlačítkem na pruh úkolu v diagramu Gantt a zvolte položku *Priorita*, potom úroveň *Nízká* (100), *Normální* (500) nebo *Vysoká* (900). *Normální* je výchozí. Číslo od 0 do 1000 můžete zadat i sami do sloupce *Priorita vyrovnání*: klikněte na **+** vpravo v záhlaví tabulky úkolů (*Přidat sloupec*) a zvolte tento sloupec v nabídce *Plánování*. Vyšší číslo znamená, že úkol spíše zůstane na místě. Aplikace nepřijme číslo nad 1000. Úkol s prioritou 1000 se kvůli kapacitě nikdy nepřesune.

### Vrácení zpět a zrušení vyrovnání

- *Vrátit zpět* (Ctrl+Z) zruší *Použít* jedním krokem.
- *Zdroje › Vyrovnání › Zrušit vyrovnání* odstraní všechno vyrovnání z úkolů. Tlačítko je šedé, dokud není žádné vyrovnání. Přetížení, které tak získáte zpět, je pak prostě zase tam.
- Pokud jste plán mezitím změnili, zvolte znovu *Vyrovnat…*. Aplikace pak začne znovu od nuly: staré zpoždění se nezohlední.

## Úskalí a co aplikace potom udělá

**Ještě nebylo přepočítáno.** Když plán nebyl přepočítán, okno hlásí *Nejdříve přepočítejte plán (F5), až potom vyrovnávejte.* Tlačítko *Přepočítat* není dostupné.

**Zbývající konflikty.** Posunem nelze vyřešit každé přetížení. Úkoly, které zbydou, jsou uvedeny pod *Zbývající konflikty* s počtem dnů a důvodem:

- *V časové rezervě není dost volné kapacity, aby se tento konflikt vyřešil.* Uvidíte to, když je zapnuté políčko *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné*: v časové rezervě úkolu není žádný volný okamžik. Odškrtněte políčko a datum dokončení se může posunout.
- *Zdroj nepracuje ve všech dnech, které tento úkol potřebuje — posun tento problém nevyřeší.* Zdroj má ve svém kalendáři uprostřed úkolu dny volna. Změňte kalendář nebo úkol.
- *Bricklayer má ve špičce 2 jedn./den, kapacita je 1 — posunem nelze vyřešit.* Podle své křivky úkol sám žádá v jednom dni víc, než zdroj dokáže dodat. Zvolte jinou křivku nebo snižte jednotky přiřazení.

**Aplikace hlásí** *Žádné úkoly se nemusí posunout — plán je už bez konfliktů.* Když se tento řádek objeví spolu se seznamem *Zbývající konflikty* v návrhu, věřte seznamu. Řádek jen říká, že není co posunout. Když se řádek objeví bez seznamu a *Zdroje › Přetížení* ještě nějaký zdroj hlásí, jsou všechny kolidující úkoly připnuté na prioritu 1000, nebo už začaly. Nepohnou se a okno je nehlásí jako konflikt. Proto se po použití vždy podívejte na *Přetížení*.

**Úkoly, které se neposouvají.** Úkol, který už začal nebo je dokončen, se nikdy neposune. Jeho práce se ale počítá. Milníky a fáze se také neposouvají.

**Materiál se nevyrovnává.** Když materiálový zdroj žádá v jednom dni víc, než je jeho *Maximální počet jednotek*, počítá se v *Přetížení* jako přetížený, ale v okně *Vyrovnání zdrojů* není.

**Vyrovnání se nepřizpůsobí.** Zpoždění zůstanou tak, jak byla vypočtena. Když později změníte dobu trvání úkolu, vyrovnaný úkol zůstane tam, kde je, i když to místo už není potřeba. Potom vyrovnejte znovu.

**Přetížení kvůli kalendáři.** Když zdroj podle svého kalendáře ten den nepracuje, panel *Varování* hlásí například *Přetížení v počtu dnů: 5 (29-06-2027 – 05-07-2027), z toho nepracovních podle kalendáře zdroje: 1*. Když úkol vždy probíhá přes takový den, což je druhý důvod výše, vyrovnání to nevyřeší.

## Viz také

- [Vyrovnání zdrojů](docs://uitleg-nivelleren): co vyrovnání posouvá v rámci časové rezervy i za ni, a co nedělá.
- [Správa zdrojů](docs://howto-resources-beheren): úprava kapacity a kalendáře zdroje.
- [Přidání závislostí](docs://howto-relaties-leggen): řazení úkolů za sebou.
- [Oznámení a varování](docs://ref-meldingen): varování o přetížení v panelu *Varování*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): štukatéři jsou přetíženi v 5 dnech. Když je zapnuté políčko *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné*, dokončení zůstane 17. srpna 2027 a jeden konflikt zbývá. Když políčko nezaškrtnete (výchozí stav), vše se vyřeší a dokončení se posune na 24. srpna 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): věžový jeřáb je přetížen 65 dnů a štukatéři 15 dnů. Vyrovnání s nezaškrtnutým políčkem *Vyrovnat jen v rámci časové rezervy — datum dokončení projektu zůstane pevné* posune dokončení z 9. května na 12. října 2028.
