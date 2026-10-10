# Osztott nézet és a mini-térkép használata

Cél: két szakaszt látni egymás mellett az idővonalból, és gyorsan mozogni egy hosszú ütemezésben.

## Mikor van erre szükség

Az alapozás kezdetéről tárgyal, és ugyanakkor az átadásról, kilenc hónappal később. Segítség nélkül folyton nagyítja és kicsinyíti a nézetet, és elveszti a nyomot, hogy hol volt. Az **osztott nézetben** ugyanazt az ütemezést két példányban látja, egymás mellett, mindegyik a saját időablakával. A **mini-térképen** a projekt teljes időszaka egyetlen keskeny csíkban látszik. Egy kattintással arra a részre ugorhat, amelyet keres.

## Lépések

### Az osztott nézet bekapcsolása

1. Válassza a *Nézet* lapot. A *Bemutató* csoportban a *Bemutató*, az *Osztott nézet* és a *Mini-térkép* gombok találhatók.
2. Kattintson az *Osztott nézet* gombra. A Gantt-diagram két részre oszlik. Mindkét ablak a jelenlegi nézet nagyításával és helyzetével indul.

A két ablak közös tevékenységtáblázatot, sorokat és függőleges görgetést használ. Mindegyik ablak saját időtengellyel rendelkezik: a nagyítással és a vízszintes helyzettel.

### Mindkét ablak saját időintervallumának beállítása

- Nagyítsa és görgesse azt az ablakot, amely fölött az egér van. Az alapértelmezett *Görgetés és nagyítás* beállítással (*Nagyítás + húzás*) az egérgörgő abban az ablakban nagyít, az egér helyére központosítva. Ha a beállítás más módot követ, a görgő mindkét ablakban azt teszi, amit az a mód előír.
- Az alapértelmezett beállítás mellett a sorokat a Shift billentyű és az egérgörgő együtt használatával görgeti. Ez egyszerre mindkét ablakra vonatkozik.
- A *Nagyítás +* és a *Kicsinyítés -* gombok, valamint az időskála listája (például *Negyedév*) csak a bal ablakban működnek. Ezért a jobb ablakot az egérgörgővel nagyítja.
- Húzza az elválasztót a két ablak között balra vagy jobbra, hogy az egyik szélesebb vagy keskenyebb legyen. Kezdetben mindkettő a felét foglalja el.

### Az osztott nézet kikapcsolása

Kattintson ismét az *Osztott nézet* gombra. Egy ablak marad, a bal ablak nézetével. Az új osztott nézet az adott pillanat nézetével indul újra.

### A mini-térkép bekapcsolása

1. A *Bemutató* csoportban kattintson a *Mini-térkép* gombra.
2. Az idővonal alatt megjelenik a teljes projekt időszakát mutató csík. A jelenlegi nézet tevékenységei vékony vonalakként látszanak; szűrés után csak azok a tevékenységek, amelyeket a szűrő megmutat. Egy keret jelzi a most látható részt.
3. Kattintson a csík bármely pontjára, a keret oda kerül. Az ablak erre a pontra központosul. Vagy fogja meg a keretet, és húzza.

A mini-térkép csak az időablakot mozgatja. A sorok változatlanok maradnak.

Ha az osztott nézet be van kapcsolva, mindkét ablak a saját idővonala alatt kap csíkot. Minden csík csak a fölötte lévő ablakot vezérli.

## Buktatók és az alkalmazás működése

**A mini-térkép nem tesz semmit, ha a teljes projekt már látszik.** Ha annyira kicsinyíti a nézetet, hogy az egész ütemezés elfér, nincs hova mozogni, és a kattintásnak nincs hatása. Először nagyítson be.

**A mini-térkép csak a Gantt-diagramon van.** A *Táblázat*, az *IFC* és a *Jelentés* lapokon, valamint a teljes erőforráspanelen (*Erőforrások*, nem *Erőforrás-dokkoló*) nincs idővonal. Így sincs mini-térkép és osztott nézet sem. Mindkettő újra megjelenik, amint visszatér a Gantt-diagramot tartalmazó nézetre.

**Az osztott nézet a projekthez tartozik, a mini-térkép nem.** Az osztott nézet a megnyitott projektre vonatkozik. Ha másik projektre vált, majd vissza, akkor is ott van. A mini-térkép minden projektre ugyanaz a választás, és újraindítás után is be- vagy kikapcsolva marad. Mindkettő képernyőbeállítás. Ezek nem kerülnek a projektfájlba, nem teszik a projektet „módosítottnak”, és nem szerepelnek a *Visszavonás* funkcióban.

**Osztott nézet és bemutató.** Mindkettő látható marad, ha bemutató módot kapcsol be (lásd [Bemutatás nagy képernyőn](docs://howto-presentatie)). Mivel a menüszalag ekkor eltűnik, ebben a módban már nem kapcsolhatja be vagy ki őket. Állítsa be őket rendesen, mielőtt elindítja.

## Lásd még

- [Bemutatás nagy képernyőn](docs://howto-presentatie): a Gantt-diagram teljes képernyőn, menüszalag nélkül.
- [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken): az időskála elrendezés részeként is menthető.
