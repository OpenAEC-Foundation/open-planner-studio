# Az óraalapú tervezés bekapcsolása

Cél: tevékenységek tervezése munkaórákban, a napokban tervezett tevékenységek mellett.

## Mikor van erre szükség

Óránként bérel darut, nem naponként. Egy hat órás betonozás nem fér bele egy teljes munkanapba. Az éjszakai csapat más időben dolgozik, mint a nappali csapat. Ehhez órában megadott időtartam kell, kezdési és befejezési időponttal óraidőben. Akkor is bekapcsolja, ha olyan fájlt nyit meg, amelyről az alkalmazás ezt jelzi: *Ez a fájl óraalapú tervezést tartalmaz.* Azt, hogy az alkalmazás miért számol másként napokat és órákat, a [Napok és órák](docs://uitleg-dagen-en-uren) oldalon olvashatja el.

## Lépések

### Az óraalapú tervezés engedélyezése

1. Válassza a *Beállítások › Projekt › Beállítások* lehetőséget, és nyissa meg az *Ütemezés* lapot.
2. Az *Óraalapú tervezés* alatt jelölje be az *Óraalapú tervezés bekapcsolása* jelölőnégyzetet. Ez azonnal működik. Az *Ez a fájl óraalapú tervezést tartalmaz.* üzenetben az *Óraalapú tervezés bekapcsolása* gomb ugyanezt teszi.
3. Alatta található a *Vegyes nap/óraalapú tervezés engedélyezése*, amely alapértelmezetten be van kapcsolva. Ezzel a beállítással tevékenységenként választhatja ki, hogy napokban vagy órákban számítson. Ha kikapcsolja, az *Időtartam-egység* lista eltűnik. Ekkor is megadhat időtartamot mértékegységgel, például `12h`.

Ez több annál, mint a tevékenység időtartamának megváltoztatása. A *Nézet › Időskála* alatt kiválaszthatja az *Óra* skálát. A *Naptárak* ablak megkapja a *Munkaórák* blokkot, az *Új projekt* ablak pedig a *Műszak* és az *Alapértelmezett egység új tevékenységekhez* lehetőséget.

### Egy tevékenység tervezése órákban

1. Jelölje ki a tevékenységet, és nézze meg a *Tulajdonságok* panelt. Az *Idő* alatt találja az *Időtartam* mezőt.
2. Írja be az időtartamot mértékegységgel, és nyomjon Entert: `12h` tizenkét órához, `1h 30m` másfél órához. A `12u` (a holland rövidítés) is működik. Az `1.5h` is megfelelő. Egység nélküli szám a tevékenység már meglévő egységében számít.
3. Ha egy meglévő tevékenységet szeretne átalakítani, válassza az *Órák* egységet az *Időtartam-egység* alatt. Az alkalmazás kiszámítja az időtartamot, és javaslatot tesz, például: *Pontos átszámítási javaslat: 16h. Alkalmazza ezt a javaslatot, vagy tartsa meg a jelenlegi mértékegységet.* Válassza a *Javaslat alkalmazása* gombot vagy a *Megtartás* gombot.
4. Napokra a `2d` megadásával vagy a *Napok* egység kiválasztásával térhet vissza.
5. Nyomja meg a **Számítás** gombot (F5), például a *Kezdőlap › Ütemezés › Számítás* útvonalon. Ezután a tevékenységnek óraidőben megadott kezdési és befejezési időpontja van.
6. Ha az órákat látni szeretné a Gantt-diagramban, válassza az *Óra* skálát a *Nézet › Időskála* listában.

### Új tevékenységek alapértelmezetten órában

1. Válassza a *Beállítások › Projekt › Projektinfó* lehetőséget.
2. Az *Alapértelmezett egység új tevékenységekhez* alatt válassza az *Órák* egységet, és kattintson az *Alkalmazás* gombra.

Egy új tevékenység ezután 5 órás időtartammal jön létre, 5 nap helyett. A meglévő tevékenységek nem változnak. Új projektnél ugyanez a választás az *Új projekt* ablakban található. Ha ott a *Műszak* alatt a *Nappali műszak* lehetőséget választja, az *Órák* le van tiltva. Válasszon másik műszakot, vagy állítsa be az alapértelmezett egységet a projekt létrehozása után, a *Projektinfó* ablakban.

## Valkuilok és mit tesz az alkalmazás ilyenkor

**Nincsenek érvényes munkaidők.** Ha a tevékenység naptárában nincsenek használható munkaidők, az alkalmazás ezt jelzi: *Ennek a naptárnak nincsenek érvényes munkaidői. Ellenőrizze a munkanapokat és a munkaidőket.* Számításkor megjelenhet ez az üzenet: *A(z) „name” óraalapú tevékenység naptárában nincsenek érvényes munkaórák.*

**Nincs tizedes szám napokkal.** Az időtartam napokban egész szám. Az `1.5d` megadása ezt az üzenetet adja: *Adjon meg egész számú napot vagy órát, például 2d vagy 12h.* Ha másfél napot szeretne, adja meg órákban.

**Átváltás, amely nem lehet pontos.** Tizenkét óra nem fér bele egész, 8 órás napokba. Az alkalmazás ekkor ezt jelzi: *Ez az időtartam a jelenlegi naptárral nem alakítható át pontosan egész napokra. A meglévő egység megmarad. Adjon meg maga új, érvényes értéket.* és meghagyja az egységet.

**A mező le van tiltva.** Egy szakasznál, hangmatnál vagy nulla időtartamú mérföldkőnél az időtartam másból következik, és nem írhatja be.

**Az óraalapú tervezés újbóli kikapcsolása.** Az órákban megadott tevékenységek megmaradnak, és az alkalmazás továbbra is kiszámítja őket. Az időtartamukat ekkor nem lehet szerkeszteni. A mező ezt írja: *Kapcsolja be az óraalapú tervezést, hogy szerkeszthesse ezt az óraalapú tevékenységet.* A mezőn egy gomb is van, amellyel újra bekapcsolhatja.

## Lásd még

- [Napok és órák](docs://uitleg-dagen-en-uren): hogyan számolja az alkalmazás az órákat, mi történik, ha napok és órák találkoznak, és hol kerekít.
- [Munkaidő beállítása](docs://howto-werktijden-instellen): egy naptár időpontjai naponként.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): órában megadott késleltetés két tevékenység között.
- [Beállítások](docs://ref-instellingen): a beállítás *Óraalapú tervezés bekapcsolása*, és mit változtat még.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): óraalapú tevékenységeket tartalmaz (vasalás és betonozás), saját órás naptárral, *Hourly calendar, rebar fixing & pouring*.
