# Tevékenységek és mérföldkövek hozzáadása

Cél: új tevékenységet vagy mérföldkövet helyezni az ütemezésbe, arra a helyre, ahová tartozik.

## Mikor van erre szüksége

Ütemezést készít, új munka kerül a projektbe, vagy Ön egy időpontot szeretne rögzíteni, például átadást vagy ellenőrzést.

A **tevékenység** olyan munka, amely időt vesz igénybe. Egy új tevékenység alapértelmezés szerint 5 munkanapig tart (óraalapú tervezés esetén a projekt alapértelmezése óra is lehet). Egy **mérföldkő** olyan időpont, amelynek nincs időtartama: 0 nap. Az altevékenységekkel rendelkező tevékenységet **összefoglaló tevékenységnek** nevezzük. Az építkezésben ez gyakran egy szakasz. Időtartama és dátumai az altevékenységekből következnek, amint az **ütemezés-számítás** (F5) parancsot használja.

## Lépések

### Tevékenység hozzáadása

1. Válassza a *Kezdőlap › Tevékenységek › Tevékenység* lehetőséget. Ugyanez a gomb a *Táblázat* lapon is megtalálható.
2. Megnyílik a *Tulajdonságok* panel, és a *Név* mező ki van jelölve. Írja be a nevet, és nyomja meg az Entert.

Az új tevékenység először az *Új tevékenység* nevet kapja, és a projektkezdés napján kezdődik.

Ha egy tevékenység ki van jelölve, az új tevékenység közvetlenül alá kerül, ugyanazon a szinten. Ha a kijelölt tevékenység összefoglaló tevékenység, az új tevékenység az egész szakasz alá kerül, tehát az altevékenységei után. Ha nincs kijelölés, a lista aljára kerül. A gomb súgószövege megmondja, melyik történik: *Új tevékenység közvetlenül a kijelölés alatt* vagy *Új tevékenység a lista alján*. Ha több tevékenységet jelöl ki, egy új tevékenység jön létre, a kijelölés legalsója alatt, ahogyan a képernyőn látja.

### Gyorsan egymás után a tevékenységtáblázatban

A tevékenységtáblázatban az utolsó tevékenység alatt mindig van egy szürke *Új tevékenység* sor. Ez még nem tevékenység: nincs benne a Gantt-ban, és a fájlban sincs benne.

1. Kattintson a sor egyik celláján, vagy menjen oda a lefelé nyíllal.
2. Írja be a nevet, és nyomja meg az Entert. Most már valódi tevékenység, ugyanazon a szinten, mint a fölötte lévő tevékenység. A kurzor azonnal az alatta lévő új, szürke soron van.
3. Írja be a következő nevet, és így tovább.

Ha a szürke sorban csak időtartamot vagy dátumot tölt ki, a tevékenység neve *Új tevékenység* lesz. Ha úgy hagyja el a sort, hogy semmit sem tölt ki, nem történik semmi: nincs tevékenység, és nem kerül be a *Visszavonás* lépései közé. A tevékenység létrehozása és az első érték együtt egy lépés a *Visszavonás* funkcióban. A szürke sor csak akkor látszik, ha a tevékenységtáblázat nincs szűrve, csoportosítva vagy rendezve.

### Jobb egérgombbal az üres területen

Kattintson a jobb egérgombbal egy üres területre: a tevékenységtáblázatban az utolsó tevékenység alatt, vagy a Gantt-ban a sávok mellett vagy alatt. Válassza az *Új tevékenység* lehetőséget, vagy a *Mérföldkő hozzáadása* lehetőséget. A tevékenység a lista aljára kerül. A Gantt-ban a dátumon kezdődik, ahol kattintott. A tevékenységtáblázatban a névcella azonnal megnyílik, így be tud gépelni.

### Egy adott tevékenység fölé vagy alá

Kattintson a tevékenységre a jobb egérgombbal, és válassza a *Beszúrás fölé* vagy a *Beszúrás alá* lehetőséget. A billentyűzet is használható: az Insert a kijelölt tevékenység fölé szúr be, a Ctrl+I (Mac-en ⌘+I) alá. A tevékenységtáblázatban az Insert után azonnal megnyílik a névcella, így be tud gépelni.

Ha több tevékenység van kijelölve, egy új tevékenység jön létre: a *Beszúrás fölé* a legfelső kijelölt tevékenység fölé teszi, a *Beszúrás alá* a legalsó alá.

### Altevékenység hozzáadása

Kattintson a tevékenységre a jobb egérgombbal, és válassza az *Altevékenység hozzáadása* lehetőséget. Az új tevékenység az adott tevékenység altevékenységeinek legalsó eleme lesz. A Gantt melletti tevékenységtáblázatban egy összefoglaló tevékenység neve után egy kis **+** jel is van, amely ugyanezt teszi.

### Mérföldkő hozzáadása

1. Válassza a *Kezdőlap › Tevékenységek › Mérföldkő ▾* lehetőséget, majd a *Kezdő mérföldkő*, a *Befejező mérföldkő* vagy az *Ellenőrzési pont (kötelező)* lehetőséget.
2. Írja be a nevet, és nyomja meg az Entert. Az elhelyezésre ugyanaz a szabály vonatkozik, mint a *Tevékenység* esetében.

A három fajta a következőképpen különbözik:

- A *Kezdő mérföldkő* a nap elején van, a *Befejező mérföldkő* a nap végén. A Gantt-ban a rombusz rendre a naposzlop bal, illetve jobb szélén áll. Ez az utódnál is számít. Ha egy mérföldkő 2026. szeptember 29., kedd, és egy tevékenység ezt követi befejezés-kezdés kapcsolattal, akkor kezdő mérföldkő után az a tevékenység ugyanazon a keddi napon kezdődik, befejező mérföldkő után pedig szeptember 30-án, szerdán.
- Az *Ellenőrzési pont (kötelező)* egy befejező mérföldkő, amelynek tevékenységtípusa *Ellenőrzés*, és be van jelölve a *Kötelező (szerződéses)* jelölőnégyzet.

### Meglévő tevékenység mérföldkővé alakítása

Kattintson a tevékenységre a jobb egérgombbal, és válassza a *Mérföldkő be/ki* lehetőséget, vagy jelölje be a *Mérföldkő* jelölőnégyzetet a *Tulajdonságok* panelen. A menüpont a teljes kijelölésre vonatkozik. Az időtartam 0 lesz.

Ha újra kikapcsolja, a tevékenység szokásos tevékenység marad, 0 időtartammal: az időtartamot Önnek kell megadnia.

### Egyéb módok

- A Ctrl+M (Mac-en ⌘+M) új mérföldkövet helyez a lista aljára akkor is, ha van kijelölt tevékenység. A *Tulajdonságok* panel nem nyílik meg.
- A *Mérföldkő hozzáadása* a tevékenység jobb egérgombos menüjében a mérföldkövet az adott tevékenység altevékenységévé teszi, nem azonos szintű elemmé.

### Tevékenység vagy egy teljes ág másolása

1. A Gantt-ban kattintson a tevékenység sávjára. Jelöljön ki további tevékenységeket Ctrl+kattintással.
2. Nyomja meg a Ctrl+C (Mac-en ⌘+C) billentyűkombinációt. Az alkalmazás lemásolja a tevékenységet az összes altevékenységével, a másolt tevékenységek közötti kapcsolatokkal és az erőforrás-hozzárendeléseikkel együtt.
3. Ha úgy szeretné, kattintson arra a tevékenységsávra, amely mellé a másolat kerüljön, és nyomja meg a Ctrl+V (Mac-en ⌘+V) billentyűkombinációt.

A másolat neve, dátumai és előrehaladása ugyanaz marad. Azonos szintű elemként kerül be a kijelölt tevékenység mellé (több kijelölésnél az, amelyre először kattintott), az azonos szintű elemek legalulára. Ha nincs kijelölés, a lista aljára kerül. A másolt tevékenységek utólag lesznek kijelölve, a WBS-kódok (minden tevékenység száma a fában, például 1.2; lásd [A szerkezet módosítása](docs://howto-structuur-aanpassen)) újra meghatározódnak, és az ütemezés elavult lesz.

A vágólap az egész alkalmazásban közös, így másik dokumentumba is be lehet illeszteni. Ami ott nem létezik, például a tevékenység naptára, egyéni tevékenységtípus, tevékenységkód vagy egyéni mező, azt az alkalmazás törli, és szól róla.

### Utána

Egy új tevékenység még nem módosítja a többi dátumot. Az állapotsorban ez áll: *Elavult — újraszámítsa (F5)*. Nyomja meg az **ütemezés-számítás** (F5) gombot, például a *Kezdőlap › Ütemezés › Számítás* lehetőségen keresztül.

## Buktatók és az alkalmazás viselkedése

**Minden új tevékenység a projektkezdés napján indul.** Kapcsolatok nélkül egy tevékenység semmire sem vár. Adjon kapcsolatokat, lásd: [Kapcsolatok hozzáadása](docs://howto-relaties-leggen).

**Szűrés, csoportosítás vagy rendezés van bekapcsolva.** A látott sorrend ilyenkor nem egyezik meg az ütemezés sorrendjével. Ha van kijelölt tevékenység, a *Tevékenység* és a *Mérföldkő ▾* az új tevékenységet a lista aljára teszi, és megjelenik a *Szűrés/csoportosítás/rendezés közben nem érhető el* üzenetsáv. A *Beszúrás fölé* és a *Beszúrás alá* parancsot az alkalmazás nem hajtja végre, ugyanezzel az üzenetsávval. Az üzenetsávban lévő *Törlés* gomb egyszerre távolítja el a szűrőt, a csoportosítást és a rendezést. Ez nem tartozik a *Visszavonás* hatókörébe: a Ctrl+Z nem állítja vissza őket.

**Altevékenység olyan tevékenység alatt, amelynek erőforrás-hozzárendelései vannak.** A tevékenység összefoglaló tevékenységgé válik, és egy összefoglaló tevékenységhez nem lehet közvetlenül hozzárendelést adni. Az alkalmazás áthelyezi a hozzárendeléseket az új altevékenységre, és szól erről. Ha ez nem lehetséges, például mert a *Mérföldkő hozzáadása* lehetőséget választotta, és egy mérföldkőhöz nem lehet hozzárendelés, az alkalmazás nem ad hozzá semmit, és megmondja az okát.

**Altevékenység mérföldkő alatt.** A mérföldkő összefoglaló tevékenységgé válik, az alkalmazás eltávolítja a mérföldkőjelölést, és üzenetet jelenít meg.

**Mérföldkő bekapcsolása összefoglaló tevékenységnél vagy hozzárendelésekkel rendelkező tevékenységnél.** Az alkalmazás nem hajtja végre, és megmondja az okát. Hozzárendelések esetén előbb távolítsa el azokat.

**Másolás a tevékenységtáblázatban.** A tevékenységtáblázatban (és a *Táblázat* lapon) a Ctrl+C csak a kijelölt cellák értékeit másolja, mint egy táblázatkezelőben, a Ctrl+V pedig cellákba illeszt. Tevékenységek másolása ezért csak a Gantt használatával működik: kattintson először egy sávra.

## Lásd még

- [A szerkezet módosítása](docs://howto-structuur-aanpassen): tevékenységek egy szinttel lejjebb helyezése és áthelyezése, és a WBS-számok naprakészen tartása.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): tevékenységek összekapcsolása.
- [Tevékenységek kijelölése, törlése és visszavonása](docs://howto-taken-selecteren-verwijderen): tevékenység eltávolítása.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): amit az alkalmazás kiszámít, ha vannak kapcsolatok.
- [Tevékenység párbeszédablak és a tulajdonságok panel](docs://ref-taak-eigenschappen): a tevékenység összes mezője.
- [Új projekt és Projektinfó](docs://ref-projectinfo): indulás szakaszolási sablonnal.
- [Jobb egérgombos menük](docs://ref-contextmenus): a tevékenység menüjének összes eleme.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): egy kis példaprojekt (*Fájl › Példák*) négy szakasszal, egy kezdő mérföldkővel és egy kötelező átadási mérföldkővel.
