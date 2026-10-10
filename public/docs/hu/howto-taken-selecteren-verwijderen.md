# Tevékenységek kijelölése, törlése és visszavonása

Cél: tevékenységek kiválasztása, eltávolítása és egy hiba visszavonása.

## Mikor van erre szüksége

Szinte minden művelet az ütemezésben a kijelölt tevékenységekkel dolgozik. Törölheti, lemásolhatja vagy behúzhatja őket, és be- vagy kikapcsolhatja a mérföldkövet. Tevékenységeket akkor távolít el, ha a munka elmarad, vagy ha az ütemezést átdolgozzák. Mivel az alkalmazás törléskor nem kér megerősítést, a *Visszavonás* a biztonsági háló.

## Lépések

### Tevékenységek kijelölése

- **Egy tevékenység.** Kattintson a sorra a tevékenységtáblázatban, vagy a sávra a Gantt-diagramban.
- **Több tevékenység.** A Ctrl+kattintás (Mac-en ⌘+kattintás) hozzáad egy tevékenységet a kijelöléshez, vagy eltávolítja onnan. A tevékenységtáblázatban a Shift+kattintás kijelöli az összes tevékenységet az aktív tevékenységtől a megkattintottig.
- **Az összes látható tevékenység.** Ctrl+A, ha a fókusz a tevékenységtáblázatban vagy a Gantt-diagramban van. A szűrő által elrejtett tevékenységek kimaradnak, ahogy az összecsukott szakasz altevékenységei is.
- **Keret a Gantt-diagramban.** Tartsa lenyomva a Ctrl-billentyűt, és húzzon az üres háttér fölött. A keret által érintett sorok összes tevékenysége kijelölődik, akkor is, ha a sávjuk a keret mellett van. Csak a keret magassága számít, nem az időtengely. Ha a Ctrl-billentyűt csak az egérgomb felengedése után engedi fel, a tevékenységek hozzáadódnak a meglévő kijelöléshez. Egyébként lecserélik azt. Ctrl nélkül ez a húzás az alapértelmezett beállításban az idővonalat görgeti.
- **Semmi.** Nyomja meg az Esc billentyűt, vagy kattintson a Gantt-diagram üres hátterére.

Ha egy összefoglaló tevékenységet jelöl ki, az altevékenységei nem jelölődnek ki vele együtt. A törlés és a másolás viszont magukkal viszi őket.

### Tevékenységek törlése

Jelölje ki a tevékenységeket, és válasszon az alábbi útvonalak közül:

- *Kezdőlap › Szerkesztés › Törlés*. Ugyanez a gomb a *Táblázat* lapon található.
- Nyomja meg a Delete vagy a Backspace billentyűt, ha a fókusz nincs a tevékenységtáblázatban. Ezért kattintson előbb a Gantt-diagram egyik sávjára.
- A *Törlés* a helyi menüben, amely a jobb egérgombbal nyílik meg. Ha a megkattintott tevékenység a kijelölés része, a parancs az egész kijelölésre vonatkozik. Egyébként csak erre az egy tevékenységre.
- A kis kuka a *Tulajdonságok* panel tetején (súgószöveg: *Tevékenység törlése*). Ez azt a tevékenységet törli, amelyet a panel mutat.

Az alkalmazás nem kér megerősítést. Ha több tevékenységet töröl egyszerre, az a *Visszavonás* egyetlen lépése.

Ezzel együtt eltűnik: a törölt összefoglaló tevékenység összes altevékenysége, a törölt tevékenységekhez tartozó összes kapcsolat, valamint ezek erőforrás-hozzárendelései. Ha egy összefoglaló tevékenység utolsó altevékenységét törli, az normál tevékenységként megmarad. Ha a *WBS automatikus* be van kapcsolva, az alkalmazás újraszámozza a fastruktúrát. Az ütemezés ezután már nem naprakész: nyomja meg az **ütemezés-számítás** (F5) parancsot, kivéve, ha az *Automatikus ütemezés-számítás* be van kapcsolva.

### Összecsukás és kibontás

Egy összefoglaló tevékenység neve előtt háromszög látható a tevékenységtáblázatban. Kattintson rá, ha el akarja rejteni vagy meg akarja jeleníteni az altevékenységeit. A *Nézet › Vázlat › Összecsukás* és a *Kibontás* paranccsal a kijelölt összefoglaló tevékenységeken végezheti el ezt, vagy mindegyiken, ha nincs kijelölés. Egy összefoglaló tevékenység helyi menüjében is van *Összecsukás* és *Kibontás* parancs. Csoportosított nézetben a gombok a csoportokon működnek.

Az alkalmazás az összecsukást és a kibontást megnyitott dokumentumonként őrzi meg. Ez nem tartozik a *Visszavonás* hatókörébe, és nincs benne a projektfájlban.

### Visszavonás és megismétlés

- *Kezdőlap › Szerkesztés › Visszavonás* és *Megismétlés* (a *Táblázat* lapon is), a címsorban lévő nyilak, vagy a Ctrl+Z a visszavonáshoz, illetve a Ctrl+Y vagy a Ctrl+Shift+Z a megismétléshez.
- Ha a *Visszavonás* után új műveletet végez, a *Megismétlés* már nem érhető el.

A *Visszavonás* a projektadatok (tevékenységek, kapcsolatok, erőforrások, naptárak és hasonlók) módosításait követi, valamint az elrendezés alkalmazását. A tevékenységtáblázat oszlopainak módosításai is lépések: oszlop hozzáadása, eltávolítása, áthelyezése, átméretezése, automatikus illesztése, rögzítése, valamint az oszlopelrendezés visszaállítása az alapértelmezettre. Ezek az oszloplépések magához a tevékenységtáblázathoz tartoznak. Az egész alkalmazásra hatnak, nem egyetlen dokumentumra. Az alkalmazás dokumentumonként az utolsó száz lépést őrzi meg, nagyon nagy projektnél kevesebbet.

## Buktatók és az alkalmazás viselkedése

**A tevékenységtáblázat Delete billentyűje nem töröl tevékenységet.** Ha a fókusz a tevékenységtáblázatban van, a Delete (vagy a Backspace) a kijelölt cellák tartalmát üríti. Kötelező vagy számított cella esetén, például a név vagy az időtartam esetén, az alkalmazás nem engedi, és üzenetet mutat a tevékenységtáblázat alatt. A névnél például így: *Ez az érték kötelező, nem maradhat üresen.* Ekkor semmi sem ürül ki, a többi kijelölt cella sem. Kattintson a Gantt-diagram egyik sávjára, vagy használja a *Törlés* parancsot (a *Táblázat* lapon, ahol nincs Gantt-diagram: *Táblázat › Szerkesztés › Törlés* vagy a helyi menü).

**Egy egész szakasz egyszerre tűnik el.** Ha összefoglaló tevékenységet töröl, az altevékenységei, azok kapcsolataik és hozzárendeléseik is vele együtt törlődnek. A *Visszavonás* (Ctrl+Z) mindent visszaállít, a kapcsolatokat és a hozzárendeléseket is.

**Ami nem áll vissza.** A kijelölés, az összecsukás és a kibontás, valamint a *Szűrés/csoportosítás/rendezés közben nem érhető el* üzenetsorban lévő *Törlés* gomb nem tartoznak a *Visszavonás* hatókörébe. Ha a *Törlés* gomb után használja a Ctrl+Z billentyűt, az előző lépést vonja vissza, nem a törlést.

**Olyan tevékenység törlése, amelytől mások függnek.** Az adott tevékenységhez tartozó kapcsolatok is megszűnnek. Azok a tevékenységek, amelyek csak ehhez voltak kötve, elszakadnak. Az **ütemezés-számítás** után ismét a saját tervezett kezdő dátumukon indulnak. Ha szükséges, adjon hozzá új kapcsolatokat, lásd: [Kapcsolatok hozzáadása](docs://howto-relaties-leggen).

## Lásd még

- [Tevékenységek és mérföldkövek hozzáadása](docs://howto-taken-en-mijlpalen-toevoegen): a fordított művelet, és tevékenységek másolása.
- [A szerkezet módosítása](docs://howto-structuur-aanpassen): tegye a tevékenységet egy másik szakasz alá a törlés helyett.
- [Húzás, mozgatás és nagyítás a Gantt-diagramban](docs://howto-gantt-bedienen): a kijelölő keret és a görgetési módok.
- [Helyi menük](docs://ref-contextmenus): mit csinál a *Törlés* és a többi elem a kijelöléssel.
