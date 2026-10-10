# Omezení a konečné termíny

Cihly se dodají až 21. června. Stavební povolení ještě nedorazilo. Střecha musí být zakrytá před stavebním svátkem. Závislosti zaznamenávají, že úkol čeká na jiný úkol. Dohody o termínu ale z pořadí prací nevyplývají. Právě k tomu slouží omezení a konečné termíny. V tomto článku se dozvíte, co dělá každý typ, kdy se úkol posune a kdy se mění jen časová rezerva. Dozvíte se také, co je pevné ukotvení a jak aplikace hlásí konflikt.

Pravidla a příklady platí pro nový projekt s profilem výpočtu *Open Planner Studio* a pracovním týdnem od pondělí do pátku.

## Pojem

**Omezení** je časové omezení jednoho úkolu, nezávislé na jeho závislostech. Takové omezení může fungovat dvěma způsoby:

- Omezení **posouvá**: úkol nesmí začít ani skončit dříve než v daný termín. Pokud by úkol kvůli svým závislostem začal dříve, přesune se na tento termín.
- Omezení **hlídá**: úkol musí začít nebo skončit nejpozději v daný termín. Aplikace nic nepřesouvá. Pokud plán daný termín nesplňuje, **časová rezerva** úkolu a úkolů před ním se stane zápornou. Časová rezerva je prostor, který úkol má, než se posune termín dokončení projektu. Záporná hodnota znamená, že na papíře už máte zpoždění (viz [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad)).

**Konečný termín** je jednodušší forma hlídání: cílový termín dokončení úkolu. Úkol se ničím nepřesouvá.

Všechna omezení jsou **měkká**: výpočet pokračuje, i když termín není splněn. Jedinou výjimkou je **pevné ukotvení**, které přepisuje závislosti. Více o něm je níže.

## Jak aplikace počítá

### Osm typů

Typ zvolíte v poli *Omezení* v panelu *Vlastnosti*. Každý typ počítá takto:

- *Co nejdříve (ASAP)*: žádné omezení. Toto je výchozí nastavení: úkol začne, jakmile to závislosti dovolí.
- *Co nejpozději (ALAP)*: úkol se posune co nejpozději, aniž by musel některý následník začít později. Spotřebuje tedy svou volnou časovou rezervu. Pokud mu po tom zbývá celková časová rezerva, protože jeho následníci mají sami prostor, zůstane nekritický. Pokud se i ta vyčerpá, počítá se jako kritický.
- *Zahájit nejdříve (SNET)*: dolní omezení začátku. Pokud by úkol začal dříve, přesune se na tento termín. Pokud je termín dříve, než dovolují závislosti, omezení nic nedělá.
- *Dokončit nejdříve (FNET)*: stejné, ale pro dokončení úkolu.
- *Zahájit nejpozději (SNLT)* a *Dokončit nejpozději (FNLT)*: horní omezení začátku nebo dokončení. Nic nepřesouvají. Pokud omezení není splněno, aplikace nahlásí porušené omezení a časová rezerva se stane zápornou.
- *Musí začít (MSO)* a *Musí skončit (MFO)*: dolní a horní omezení zároveň. Úkol se přesune na tento termín, pokud je pozdější, než vyžadují jeho závislosti. Pokud je termín dříve, než dovolují závislosti, úkol zůstane tam, kam ho závislosti postavily, a časová rezerva se stane zápornou.

Pokud termín připadne na sobotu, neděli nebo na volný den, aplikace ho čte jako pracovní den: dolní omezení (SNET, FNET) jako nejbližší následující pracovní den, horní omezení (SNLT, FNLT) jako předchozí.

### Co znamená záporná časová rezerva

Horní omezení působí zpětně. Pokud omezení postaví pozdní termín úkolu před jeho dřívější termín, celková časová rezerva se stane zápornou. Totéž platí pro úkoly před ním: pokud musí brickwork zahájit nejpozději v pátek 11. června a nemůže začít dříve než v pondělí 14. června, jsou i úkoly před brickwork o jeden pracovní den pozdě. Všechny úkoly se zápornou časovou rezervou jsou kritické. Jak to funguje, je vysvětleno v [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

Pruhy se kvůli hornímu omezení nepřesouvají. Konflikt uvidíte v záporné hodnotě v poli *Celková časová rezerva*, v červeném kosočtverci nad pruhem, v hlášení na stavovém řádku (například *Porušená omezení: 1*) a v panelu *Varování*.

### Pevné ukotvení

U MSO a MFO se zobrazí zaškrtávací pole *Povinný (pevné ukotvení)*. Zaškrtnutím tohoto pole připevníte úkol k termínu, i když jeho předchůdci do té doby nebudou dokončeni. Závislosti se přepisují:

- Úkol je na termínu (u MSO na něm začíná, u MFO na něm končí) a překrývá se se svými předchůdci.
- Předchůdci dostanou zápornou časovou rezervu. Aplikace nahlásí porušené omezení ve chvíli, kdy by závislosti dovolily úkolu začít později, než je pevné ukotvení. Úkol s pevným ukotvením si sám zachová časovou rezervu 0.
- Následníci se počítají od úkolu s pevným ukotvením. Mohou proto začít dříve než bez pevného ukotvení, ačkoli logika před ním není dokončena. V příkladu níže se kvůli tomu dokončení projektu posune dříve o tři pracovní dny.

Když poprvé zapnete pevné ukotvení, aplikace zobrazí krátké vysvětlení: pevné ukotvení přepisuje závislosti, pruh je upevněn na termínu, i dříve než jeho předchůdci.

### Sekundární omezení

Úkol má jedno primární omezení. Pokud chcete ještě druhé omezení, například úkol, který nesmí začít před 14. června a musí být dokončen do 17. června, přidáte **sekundární omezení**. Musí to být skutečné omezení (SNET, FNET, SNLT nebo FNLT) a musí omezovat v opačném směru než primární: dolní omezení (SNET nebo FNET) s horním omezením (SNLT nebo FNLT). Kombinace SNET a SNLT je tedy povolena, SNET a FNET nikoli. Aplikace ostatní kombinace označí červeně s důvodem, například *Primární a sekundární omezení nesmí omezovat stejnou stranu*. U ASAP, ALAP, MSO, MFO a pevného ukotvení není sekundární omezení povoleno.

### Konečný termín

**Konečný termín** je samostatný termín u úkolu, vedle omezení. Je to horní omezení dokončení: nic nepřesouvá, ale pokud úkol není dokončen včas, časová rezerva se stane zápornou. Aplikace pak v panelu *Varování* hlásí *Konečný termín … nesplněn — nejdřívější dokončení …* a stavový řádek počítá nesplněné konečné termíny. V diagramu Gantt je na datu konečného termínu šipka dolů: zelená, dokud je úkol dokončen včas, červená, jakmile má úkol zpoždění. Konečný termín na sobotu platí až do předchozího pátku včetně.

Pro časovou rezervu dělá konečný termín totéž co FNLT. Rozdíl je v tom, jak ho použijete. Konečný termín je cílový termín, který chcete hlídat. Stojí samostatně vedle omezení, takže úkol může mít omezení i konečný termín. FNLT je omezení: porušení se objeví jako porušené omezení místo nesplněného konečného termínu.

### Co omezení nedělá

- U **fáze** (souhrnný úkol) se omezení nebo konečný termín nepočítají: aplikace počítá s úkoly ve fázi. Nastavte ho přímo na úkolu.
- Úkol, který už má skutečné zahájení nebo průběh, si toto zahájení zachová. SNET s pozdějším termínem jej nepřesune.
- **Zadání data zahájení** u úkolu s předchůdcem nefunguje jako pevné zahájení: o termínu dál rozhoduje předchůdce. Proto aplikace převede zadané datum na SNET, a to v panelu *Vlastnosti*, v okně *Upravit úkol*, v tabulce i při přesunu pruhu v diagramu Gantt. Aplikace vás o tom informuje. Pokud úkol už má jiné omezení (například ALAP nebo MSO), aplikace nový začátek neuplatní a také o tom informuje. Pak toto omezení změňte.

Všechny změny se zobrazí až po spuštění příkazu **Přepočítat** (F5).

## Ukázkový příklad

Příklad je malá síť pro přístavbu domu. Začíná v pondělí 7. června 2027:

- *Groundwork* (3 pracovní dny): pondělí 7. až středa 9. června.
- *Pour foundation* (2): čtvrtek 10. a pátek 11. června.
- *Brickwork* (5): pondělí 14. až pátek 18. června.
- *Roofing* (3): pondělí 21. až středa 23. června.
- *Scaffolding* (2): navazuje na *Pour foundation* a předchází *Roofing*. Běží v pondělí 14. a v úterý 15. června a má 3 pracovní dny časové rezervy.

Kritická cesta je *Groundwork*, *Pour foundation*, *Brickwork* a *Roofing*. Projekt je hotový ve středu 23. června. Co se změní s jedním omezením na *Brickwork*?

- **SNET pondělí 21. června** (cihly dorazí až tehdy): *Brickwork* běží od pondělí 21. do pátku 25. června, *Roofing* od pondělí 28. do středy 30. června. Projekt je hotový ve středu 30. června. *Groundwork* a *Pour foundation* mají nyní 5 pracovních dnů časové rezervy a už nejsou kritické, *Scaffolding* má 8 pracovních dnů.
- **SNET středa 9. června**: bez vlivu. Závislosti stejně dovolí začít *Brickwork* až v pondělí 14. června.
- **SNLT středa 16. června**: bez vlivu. *Brickwork* začíná v pondělí 14. června a omezení splňuje s rezervou.
- **SNLT pátek 11. června**: příliš těsné. *Brickwork* i tak začíná v pondělí 14. června, o jeden pracovní den pozdě. *Groundwork*, *Pour foundation* a *Brickwork* dostanou −1 pracovní den časové rezervy a aplikace hlásí *Omezení Zahájit nejpozději (SNLT) 11-06-2027 je přepsáno logikou (záporná časová rezerva)*. Nic se nepřesune.
- **MSO středa 16. června** (bez pevného ukotvení): *Brickwork* se přesune na středu 16. června a je hotový v úterý 22. června. *Roofing* běží od středy 23. do pátku 25. června, projekt je hotový v pátek 25. června.
- **MSO pátek 11. června** (bez pevného ukotvení): termín je dříve, než dovolují závislosti. *Brickwork* i tak začíná v pondělí 14. června a časová rezerva se stane −1, stejně jako u SNLT.
- **MSO středa 9. června s pevným ukotvením**: *Brickwork* začíná ve středu 9. června a je hotový v úterý 15. června, zatímco *Pour foundation* běží ještě do pátku 11. června. *Roofing* běží od středy 16. do pátku 18. června: projekt je hotový o tři pracovní dny dříve než bez pevného ukotvení. *Groundwork* a *Pour foundation* dostanou −3 pracovní dny časové rezervy.

A s omezením nebo konečným termínem u jiného úkolu:

- **ALAP na** *Scaffolding*: úkol se přesune na čtvrtek 17. a pátek 18. června, což je nejpozdější okamžik před *Roofing*. *Roofing* je jeho jediný následník a měl prostor přesně pro svou časovou rezervu, 3 pracovní dny. Ta je nyní vyčerpána a *Scaffolding* je kritický.
- **SNET sobota 19. června na** *Scaffolding*: omezení se počítá jako pondělí 21. června. *Scaffolding* běží v pondělí 21. a v úterý 22. června a *Roofing* se posune s ním na středu 23. až pátek 25. června.
- **Konečný termín pátek 18. června na** *Roofing*: nic se nepřesune, *Roofing* zůstává od pondělí 21. do středy 23. června. *Groundwork*, *Pour foundation*, *Brickwork* a *Roofing* dostanou −3 pracovní dny časové rezervy a aplikace hlásí *Konečný termín 18-06-2027 nesplněn — nejdřívější dokončení 23-06-2027*. *Scaffolding* si zachová 0 pracovních dnů časové rezervy a také se stane kritický.
- **SNET pondělí 21. června na** *Brickwork*, **konečný termín pátek 25. června na** *Roofing*: omezení posune brickwork o týden později a konečný termín hlásí, že *Roofing* má zpoždění: dokončí se ve středu 30. června. *Brickwork* a *Roofing* dostanou −3 pracovní dny časové rezervy. *Groundwork* a *Pour foundation* si zachovají 2 pracovní dny.

V kurzu 3 nastavíte omezení a konečný termín v projektu kurzu sami a uvidíte, jak se plán posune.

## Důsledky a mylné představy

**„Omezení posouvá úkol.“** Pouze SNET, FNET, MSO a MFO mohou dát úkol později, než dovolují jeho závislosti. ALAP ho může posunout později v rámci své volné časové rezervy. SNLT a FNLT nikdy nic nepřesouvají: pouze varují. Dodržet termín pak znamená zkrátit řetěz před ním.

**„Záporná časová rezerva je chyba v aplikaci.“** Je to signál, že plán je ve sporu s vaší dohodou o termínech. Řešíte ji zkrácením řetězu, uvolněním dohody, nebo tím, že konflikt záměrně přijmete.

**„Pevné ukotvení vyřeší konflikt.“** Pevné ukotvení konflikt skrývá: úkol je na termínu, ale jeho předchůdci na něj nejsou připraveni, a následníci se počítají, jako by připraveni byli. Používejte ho jen pro termín, který je opravdu pevný, například zákonný termín předání, a ne jako způsob, jak dostat úkol na termín.

**„Prostě zadám datum zahájení.“** U úkolu s předchůdcem se z něj stane SNET. Pokud je ten termín dříve, než dovoluje předchůdce, nic se nestane.

**„Konečný termín, nebo FNLT?“** Zvolte konečný termín pro cílový termín, který chcete hlídat, a omezení pro termín, který je opravdu hraniční podmínkou plánu.

**„Omezení na fázi.“** To se nepočítá. Nastavte ho přímo na úkolu.

## Viz také

- [Nastavení omezení nebo konečného termínu](docs://howto-constraint-deadline-zetten): kroky pro nastavení omezení nebo konečného termínu.
- [Závislosti a prodleva](docs://uitleg-relaties): závislosti, vedle nichž omezení existují.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): jak vzniká záporná časová rezerva a co dělá s kritickou cestou.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): pevné ukotvení s typem *Musí začít (MSO)* na *Municipal road closure (permitted closure period)* a sekundární omezení *Zahájit nejpozději (SNLT)* na *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): konečný termín, který není splněn, se zápornou časovou rezervou.
