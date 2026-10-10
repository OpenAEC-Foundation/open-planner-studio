# Přesun projektu

Cíl: posuňte celý plán na nové datum zahájení a předem zjistěte, co to udělá s dokončením.

## Kdy to potřebujete

Začátek práce se posune: povolení přijde později, nebo použijete plán dřívějšího domu pro další dům. Přesouvat každý úkol zvlášť je hodně práce. Pomocí **Přesunout projekt** zadáte jedno nové datum zahájení a aplikace posune všechno ostatní.

Dokončení projektu se neposune vždy o stejný počet dnů jako zahájení. **Kalendář** se nepřesune: svátky, přestávka na stavbě a zimní přerušení prací leží na pevných datech. Příklad: pomocí *Domů › Soubor › Nový* vytvoříte projekt s polem *Datum zahájení* 29-09-2026, polem *Země* nastaveným na *Nizozemsko* a polem *Letní stavební uzávěra* nastaveným na *Žádná*. Do něj vložíte plán s dobou trvání 30 pracovních dnů, který skončí 9. listopadu 2026. Když ho přesunete na 14. prosince 2026, tedy o 76 kalendářních dnů později, skončí 26. ledna 2027. To je o 78 dnů později, protože 25. prosince a 1. ledna jsou nyní v plánu volné dny. Doba trvání zůstává 30 pracovních dnů. Náhled v okně to ukáže, dřív než cokoli změníte.

## Postup

1. Zvolte *Plán › Plán › Přesunout projekt…*. Tlačítko je neaktivní, dokud projekt nemá datum zahájení.
2. V poli *Současné zahájení projektu* zjistěte, kdy projekt nyní začíná. V poli *Nové zahájení projektu* zvolte nové datum.
3. Pokud má projekt směrné plány, objeví se zaškrtávací políčko *Posunout i směrné plány*. Chcete-li posun dál vidět jako odchylku, nechte políčko vypnuté (viz Úskalí a co aplikace dělá).
4. Klikněte na *Přepočítat náhled*. Aplikace vypočítá celý posunutý plán, aniž by něco změnila ve vašem projektu.
5. Podívejte se na náhled (viz níže). Je-li správný, klikněte na *Přesunout*.

V náhledu uvidíte:

- posun v kalendářních dnech (*Posun v kalendářních dnech vpřed: 76*);
- *Zahájení projektu* a *Dokončení projektu*, před a po posunu;
- červené upozornění, když kalendář zasahuje, nebo zprávu, že doba trvání projektu zůstává stejná;
- počet posunutých úkolů a to, co se posune spolu s nimi;
- upozornění, která si máte přečíst (viz Úskalí a co aplikace dělá).

Aplikace vypočítá nový plán hned, takže nemusíte používat **Přepočítat** (F5), a přizpůsobí zobrazení celému projektu. Celé přesunutí je jeden krok pro *Vrátit zpět* (Ctrl+Z).

Tlačítko *Přesunout* funguje jen po náhledu bez chyby a jen tehdy, když se nové datum liší od současného. Když změníte datum nebo zaškrtávací políčko, náhled zmizí a znovu vypočítáte.

### Co se posune a co ne

Posune se: začátek a dokončení každého úkolu, skutečné zahájení a skutečné dokončení, data omezení (také u pevného omezení Mandatory, viz [Omezení a konečné termíny](docs://uitleg-constraints)), konečné termíny, datum stavu, kroky dostupnosti zdrojů a kotvy ve vazbách mezi projekty. Posune se také zahájení projektu a datum dokončení projektu, pokud jste ho vyplnili.

Neposune se:

- kalendáře, tedy svátky, přestávka na stavbě a zimní přerušení prací;
- směrné plány, pokud nezapnete *Posunout i směrné plány*;
- vyplněné vlastní pole typu *Datum*.

## Úskalí a co aplikace dělá

**Dokončení se posune o jiný počet dnů.** Pokud náhled zjistí, že se dokončení posune o více nebo méně kalendářních dnů než zahájení, nebo že se doba trvání projektu v pracovních dnech změní, zobrazí červené upozornění s čísly. Přesun můžete i potom zrušit.

**Směrné plány zůstanou na místě.** Směrný plán slouží k měření odchylky. Když projekt přesunete s vypnutým políčkem, uvidíte posun jako odchylku od směrného plánu. Když políčko zapnete, směrné plány se posunou spolu s plánem. Posunou se jen jejich data. Datum, ke kterému byl směrný plán uložen, se nemění.

**Běžící projekt.** Skutečná data se posunou spolu s plánem. V projektu, kde jste už zadali průběh, to není vždy to, co chcete. Aplikace upozorní: *Zkontrolujte, zda je to pro běžící projekt správně.*

**Vazby mezi projekty.** Kotva ve vašem projektu se posune spolu s plánem, zdrojový projekt ne. Po přesunu obnovte vazby přes *Domů › Úkoly › Propojit ▾ › Obnovit všechny vazby mezi projekty*. Viz [Vazby mezi projekty](docs://howto-externe-relaties).

**Svátky, které nesahají dostatečně daleko.** Kalendář s vygenerovanými svátky pokrývá několik let. Když přesunutý plán tuto dobu přesáhne, aplikace vypočítá ten rok bez svátků. Náhled na to upozorní, například: *Vygenerované svátky kalendáře „Bouwkalender NL“ pokrývají období 2025–2029; přesunutý plán sahá do roku 2030. Vygenerujte svátky znovu.* Nejprve projekt přesuňte. Potom otevřete *Plán › Kalendář › Kalendář*: vedle svátků je nyní tlačítko *Vygenerovat znovu*. Potvrďte tlačítkem *Použít* a aplikace přepočítá plán. Rozsah nových svátků se řídí daty projektu, takže vygenerování znovu před přesunem nepomůže.

**Datum je v minulosti.** To je povoleno, ale náhled na to upozorní: *Nové datum zahájení je v minulosti.*

**Změna zahájení projektu v Info o projektu je něco jiného.** Když změníte datum zahájení v *Nastavení › Projekt › Info o projektu* a zvolíte *Použít*, plán se nepřesune. Posunou se jen úkoly bez předchůdce nebo omezení, které by pak ležely před novým zahájením, a to na toto datum. Aplikace vám řekne, kolik jich je. Chcete-li posunout všechno, použijte *Přesunout projekt…*.

## Viz také

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): jak plán vypočítává data a proč se dokončení posouvá.
- [Přidávání závislostí](docs://howto-relaties-leggen): závislosti při přesunu prostě zůstanou na místě.
- [Nový projekt a Info o projektu](docs://ref-projectinfo): co dělá datum zahájení v Info o projektu.
