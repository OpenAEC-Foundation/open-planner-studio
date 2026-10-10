# Aktualizace průběhu

Cíl: zapsat do plánu skutečný stav práce a plán přepočítat: které úkoly jsou hotové, které probíhají a kolik práce ještě zbývá.

## Kdy to potřebujete

Průběh aktualizujete v pevných okamžicích, například každý pátek, kdy stavbyvedoucí hlásí stav. Plán tak vidí, co se skutečně stalo, a zbývající práci vypočítává od data stavu. Proč aplikace funguje takto, je vysvětleno v [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang).

## Postup

### 1. Nastavte datum stavu

Datum stavu je den, ke kterému zjišťujete stav. Nastavte ho dříve, než zadáte průběh.

1. Přejděte na kartu *Plán › Směrné plány a průběh › Datum stavu*.
2. Zadejte datum do tří polí pro den, měsíc a rok (v pořadí, v jakém píšete datum), například 28, 06 a 2027, a stiskněte Enter. Aplikace přejde do dalšího pole sama.
3. Malým křížkem vedle pole datum stavu zase vymažete.

Pokud zjišťujete stav v pátek po pracovní době, nastavte datum stavu na další pracovní den, pondělí. Aplikace naplánuje zbývající práci od začátku data stavu.

Pokud zadáte průběh, když ještě není nastaveno datum stavu, aplikace ho nastaví na dnešek a zobrazí hlášení: *Datum stavu zatím nebylo nastaveno: nyní je nastaveno na dnešek (…), protože průběh se měří až do data stavu. Změnit ho lze na kartě Plán → Datum stavu*. Raději to proto udělejte nejdřív sami.

### 2. Zadejte průběh

Zvolte způsob, který odpovídá vaší situaci. Všechny dávají stejný výsledek.

**Jeden úkol v panelu vlastností.** Hodí se, když aktualizujete jeden úkol.

1. Klepněte na úkol. Pokud nevidíte panel *Vlastnosti*, zapněte ho na kartě *Zobrazení › Panely › Vlastnosti*.
2. Přetáhněte posuvník *Průběh (%)* na procento, které je hotové.
3. Pokud je třeba, doplňte *Skutečné zahájení* a *Skutečné dokončení*, stejně jako u data stavu. Aplikace pole *Zbývající* vypočítá sama; zde ho nelze změnit.

Milník má jedno pole, *Skutečné datum*.

**Výběr procenta v nabídce.** Hodí se pro rychlý stav.

1. Klepněte pravým tlačítkem na pruh úkolu v diagramu Gantt.
2. Zvolte *Průběh* a potom 0 %, 25 %, 50 %, 75 % nebo 100 %.

**Více úkolů v tabulce.** Hodí se, když aktualizujete celý seznam.

1. Klepněte na **+** vpravo v záhlaví tabulky úkolů (*Přidat sloupec*) a otevřete kategorii *Průběh*. Přidejte sloupce *Skutečné zahájení*, *Skutečné dokončení*, *Zbývající* a *Stav*. Sloupec *Průběh* je už na kartě *Tabulka*.
2. Dvakrát klepněte na buňku, zadejte hodnotu a stiskněte Enter. Procento zadáte jako `50` nebo `50%`, datum jako `25-06-2027`, zbývající dobu trvání jako `1`.
3. U sloupce *Stav* po dvojitém klepnutí stiskněte Enter a zvolte *Nezahájeno*, *Probíhá* nebo *Dokončeno*.

Když zadáte zbývající dobu trvání, aplikace dopočítá zpět procento: u úkolu s dobou trvání 2 pracovní dny znamená zbytek 1 procento 50 %. Zbytek 0 úkol dokončí. Když u sloupce *Stav* zvolíte *Nezahájeno*, procento přejde na 0 % a skutečná data zmizí.

**Vše o jednom úkolu v okně pro úpravu úkolu.** Klepněte pravým tlačítkem na úkol a zvolte *Upravit...*. Pole průběhu jsou tam také. Změny se použijí až po kliknutí na *Uložit*.

**Více úkolů najednou z tabulkového souboru.** Viz [Import průběhu z tabulkového souboru](docs://howto-voortgang-importeren).

### 3. Přepočítejte plán

Každá změna průběhu nebo data stavu způsobí, že plán je zastaralý: stavový řádek hlásí *Zastaralé — přepočítejte (F5)*. Stiskněte **Přepočítat** (F5), například na kartě *Plán › Plán › Přepočítat*. Pokud je zapnuta volba *Automaticky přepočítat* (na kartě *Nastavení › Projekt › Nastavení*, karta *Plán*), aplikace to udělá sama.

## Kontrola výsledku

- Na datu stavu ukazuje Gantt přerušovanou čáru s datem v záhlaví. U probíhajících úkolů se čára vyboulí k procentu v pruhu. Zapínáte je nebo vypínáte na kartě *Zobrazení › Směrné plány a průběh › Čára průběhu* a *Čára datumu stavu*.
- Dokončené úkoly nejsou nikdy červené: při nastaveném datu stavu není dokončený úkol kritický.
- Fáze ukazují odvozené procento a dokončení plánu se mohlo posunout.
- Pokud jste uložili směrný plán, pod každým pruhem je původní plán a typ sestavy *Odchylka* ukazuje odchylku.

## Úskalí a co aplikace dělá

**Datum po datu stavu.** Aplikace nepřijme skutečné zahájení ani skutečné dokončení, které je po datu stavu. V panelu to hlásí pod poli: *Skutečné hodnoty nemohou být po datu stavu*; v tabulce buňka hlásí *Skutečné datum je po datu stavu*. Nejdřív nastavte datum stavu později, nebo datum opravte.

**Úkol, který by měl začít až po datu stavu.** Když zadáte průběh úkolu, který podle plánu ještě neměl začít, otevře se okno *Zadejte skutečné zahájení*. Ptá se, kdy úkol skutečně začal; návrh je datum stavu. Tlačítkem *Použít průběh* to zaznamenáte, tlačítkem *Zrušit* se nic nezmění.

**100 % bez dat.** Když nastavíte úkol na 100 % bez skutečného dokončení, skutečné dokončení se stane datem stavu, i když byl úkol dokončen dříve. Potom skutečné dokončení doplňte sami.

**Procento pod 100 %.** Když vrátíte dokončený úkol pod 100 %, skutečné dokončení se zruší. Když vymažete jen skutečné dokončení, procento přejde na 0 % a úkol zůstane *Probíhá*. Chcete-li, aby úkol znovu počítal jako nezahájený, vymažte také skutečné zahájení, nebo v tabulce u sloupce *Stav* zvolte *Nezahájeno*.

**Změna doby trvání probíhajícího úkolu.** Hotová práce zůstane hotová a procento se upraví. Úkol s dobou trvání 5 pracovních dnů na 60 %, který nastavíte na 10 pracovních dnů, skončí na 30 %. Aplikace nepřijme dobu trvání kratší než práce, která je už hotová: *Úkol „Build inner cavity leaf“ je již dokončen z 60 %: doba trvání nemůže být kratší než již provedená práce. Doba trvání nebyla změněna.* V tabulce buňka hlásí *Tato doba trvání je kratší než práce, která je už hotová.*

**Zbývající doba trvání se zaokrouhluje.** Aplikace zaokrouhluje zbývající dobu trvání na celé pracovní dny. U úkolu s dobou trvání 2 pracovní dny dávají 50 % i 75 % zbytek 1 pracovní den.

**Fáze.** Fáze nemá vlastní průběh. V panelu to hlásí *Odvozeno z dílčích úkolů: průběh změňte tam. Souhrnný úkol se aktualizuje po přepočítání (F5).* V tabulce buňka hlásí *Průběh souhrnného úkolu se odvozuje z dílčích úkolů a zde se nedá měnit.*

**Posun data stavu později.** Zbývající práce probíhajících úkolů začíná novým datem stavu a práce, která ještě nezačala, nemůže ležet před tímto datem. Proto datum posouvejte jen spolu s aktualizací průběhu. Když nastavíte datum stavu bez zadání průběhu, veškerá práce, která ještě nezačala, se přesune na toto datum (kromě profilu Microsoft Project).

**Omyl.** Každou změnu průběhu lze vrátit jedním stisknutím Ctrl+Z.

## Viz také

- [Průběh, datum stavu a směrný plán](docs://uitleg-voortgang): jak aplikace vypočítává zbývající práci a datum stavu, s propočteným příkladem.
- [Import průběhu z tabulkového souboru](docs://howto-voortgang-importeren): načtení průběhu u více úkolů najednou.
- [Výběr režimu průběhu](docs://howto-voortgangsmodus-kiezen): co aplikace dělá s úkolem, který začal, zatímco jeho předchůdce ještě běží.
- [Ukládání a správa směrného plánu](docs://howto-baseline-opslaan-en-beheren): uložení původního plánu, se kterým se srovnává průběh.
