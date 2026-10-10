# Nastavení omezení nebo konečného termínu

Cíl: zapsat dohodu o datu u úkolu, aby plán s ní počítal, nebo ukázat, že ji nesplňujete.

## Kdy to potřebujete

Cihly se dodají až 21. června, proto zdivo nesmí začít dříve: **omezení** *Zahájit nejdříve*. Střecha musí být uzavřená před stavebním svátkem a chcete být upozorněni, když to nevyjde: **konečný termín**. Betonáž je pevně určena na den, protože ji betonárna slíbila: *Musí začít*. Který typ se hodí kdy a co s ním aplikace dělá, je vysvětleno v článku [Omezení a konečné termíny](docs://uitleg-constraints).

## Postup

Omezení a konečný termín nastavíte v panelu *Vlastnosti*.

1. Vyberte úkol. Pokud panel *Vlastnosti* nevidíte, zapněte jej na kartě *Zobrazení › Panely › Vlastnosti*.
2. U pole *Omezení* zvolte typ, například *Zahájit nejdříve (SNET)*.
3. U všech typů kromě *Co nejdříve (ASAP)* a *Co nejpozději (ALAP)* se objeví pole *Datum omezení*. Zadejte datum do tří políček pro den, měsíc a rok, například 21, 06 a 2027, a stiskněte Enter. Aplikace přeskočí do dalšího políčka sama, jakmile je políčko plné. Po zvolení typu je datum už vyplněné: datum předchozího omezení, nebo jinak původní plánované zahájení úkolu. Může se lišit od zahájení, které panel zobrazuje, proto vždy zadejte datum, které myslíte, sami.
4. Pokud chcete úkol pevně ukotvit k datu, i před jeho předchůdci, zvolte *Musí začít (MSO)* nebo *Musí skončit (MFO)* a zaškrtněte *Povinný (pevné ukotvení)*. Je to pevné ukotvení; používejte ho jen pro datum, které je opravdu pevné.
5. Pokud chcete také druhou mez, například úkol, který nesmí začít před 14. června a musí být dokončen do 17. června, zvolte typ u pole *Sekundární omezení* a vyplňte pole *Sekundární datum*. Toto pole se objeví u každého omezení, které má datum, kromě pevného ukotvení. U MSO a MFO sekundární omezení není povoleno: aplikace ho pak označí červeně.
6. U konečného termínu vyplňte pole *Konečný termín* stejným způsobem jako datum omezení. Konečný termín je nezávislý na omezení: obojí můžete nastavit u stejného úkolu.
7. Stiskněte **Přepočítat** (F5), například na kartě *Domů › Plán › Přepočítat*. Do té doby stavový řádek zobrazuje *Zastaralé — přepočítejte (F5)*.

Pole jsou také v okně *Upravit úkol*. Otevřete ho pravým tlačítkem na úkol a zvolte *Upravit...*; potvrďte tlačítkem *Uložit*.

V tabulce pracujete se sloupci. Klikněte na **+** v záhlaví tabulky a pod položkou *Omezení* zvolte sloupce *Typ omezení*, *Datum omezení* a *Konečný termín* (jsou tu také *Pevné omezení*, *Typ sekundárního omezení* a *Datum sekundárního omezení*). Dvakrát klikněte na buňku, abyste ji upravili: typ vyberete ze seznamu a datum zadáte s pomlčkami, například 21-06-2027. *Pevné omezení* lze změnit jen u MSO a MFO.

Pokud má úkol předchůdce, existuje zkratka pro *Zahájit nejdříve*: stačí zadat nové datum zahájení do pole *Zahájení* (v panelu *Vlastnosti*, v okně *Upravit úkol* nebo v tabulce), nebo posunout pruh v diagramu Gantt. Aplikace z něj pak sama udělá omezení *Zahájit nejdříve (SNET)* a oznámí vám to.

## Kontrola výsledku

- V diagramu Gantt je nad pruhem malý kosočtverec: na straně zahájení u omezení zahájení a na straně dokončení u omezení dokončení. Je modrý pro SNET a FNET, fialový pro SNLT, FNLT, MSO a MFO, a červený, když je omezení porušené. Pevné ukotvení se pozná podle špendlíku. Konečný termín je šipka směřující dolů v den konečného termínu: zelená, dokud je úkol dokončen včas, a červená, pokud má zpoždění.
- Porušené omezení nebo nedodržený konečný termín se objeví v panelu *Varování* (*Plán › Plán › Varování*) a ve stavovém řádku. *Celková časová rezerva* úkolu a úkolů před ním je pak záporná.
- U horní meze (*Zahájit nejpozději*, *Dokončit nejpozději*) nebo u konečného termínu platí: pokud varování chybí, plán datum splňuje.

## Odstranění omezení nebo konečného termínu

U pole *Omezení* znovu zvolte *Co nejdříve (ASAP)*. Tím se odstraní i sekundární omezení. Konečný termín odstraníte tak, že vyprázdníte tři políčka a stisknete Enter. Potom stiskněte **Přepočítat**.

## Úskalí a co aplikace dělá

**Omezení u fáze.** Omezení nebo konečný termín u fáze (souhrnného úkolu) nemá žádný účinek. Zadejte ho přímo u samotného úkolu.

**Úkol, který už začal.** Pokud úkol má skutečné zahájení nebo průběh, zachová si své skutečné zahájení. *Zahájit nejdříve* s pozdějším datem jej nepřesune.

**Zadání data zahájení vedle jiného omezení.** Pokud má úkol předchůdce a už má jiné omezení, například *Co nejpozději (ALAP)*, aplikace zadané zahájení neuplatní. Zpráva uvádí, které omezení to je. Pokud chcete zahájení posunout, změňte právě toto omezení.

**Datum o víkendu.** Datum v sobotu, v neděli nebo ve volný den se počítá jako pracovní den: spodní mez (*Zahájit nejdříve*, *Dokončit nejdříve*) jako následující pracovní den, horní mez (*Zahájit nejpozději*, *Dokončit nejpozději*) jako předchozí.

**Sekundární omezení, které není povoleno.** Aplikace označí neplatnou kombinaci červeně s důvodem, například *Primární a sekundární omezení nesmí omezovat stejnou stranu.* Sekundární omezení není povoleno u ASAP, ALAP, MSO, MFO a pevného ukotvení.

**Pevné ukotvení.** Když ho zapnete poprvé, aplikace vás upozorní, že pevné ukotvení přepisuje závislosti. Úkol je pak na datu, i před svými předchůdci; tito předchůdci dostanou zápornou časovou rezervu.

**Po nastavení se nic nezměnilo.** Omezení se projeví až po přepočítání (**Přepočítat**). Pokud horní mez (*Zahájit nejpozději*, *Dokončit nejpozději*) nemá na pruhy žádný vliv, je to normální: horní mez nic nepřesouvá; když datum není splněno, způsobí zápornou časovou rezervu.

## Viz také

- [Omezení a konečné termíny](docs://uitleg-constraints): co dělá každý typ a vysvětlení pevného ukotvení, záporné časové rezervy a konečného termínu.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): co záporná časová rezerva udělá s kritickou cestou.
- [Závislosti a prodleva](docs://uitleg-relaties): závislosti, vedle nichž omezení působí.
- [Oznámení a varování](docs://ref-meldingen): varování pro porušené omezení nebo nedodržený konečný termín.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): omezení z povolení *Zahájit nejdříve* u *Demolish existing extension* (14. května 2027) a konečný termín, který je splněn s rezervou.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): záměrně těsný konečný termín u *Contractual project handover* (15. července 2027): po přepočítání je dokončení 17. srpna a mnoho úkolů má zápornou časovou rezervu.
