# Húzás, mozgatás és nagyítás a Gantt-diagramban

Cél: az idővonal kezelése az egérrel. Sáv mozgatása vagy az időtartamának módosítása, az idővonal eltolása, tevékenységek kijelölése kerettel, és nagyítás vagy kicsinyítés.

## Mikor van erre szüksége

A Gantt-diagramon látja, hogy a falazatnak két nappal később kell kezdődnie, vagy hogy a betonozás egy nappal tovább tart. Ezt közvetlenül a sávon szeretné módosítani. Vagy van egy több hónapos projektje, és gyorsan az építési ünnepnapra szeretne görgetni. Az egér erre több mozdulatot ismer. Az, hogy melyik mozdulat mit tesz, attól függ, hogy hol kezdi a húzást, és hogy milyen a görgetési beállítása.

## Lépések

### Sáv mozgatása

1. Nyomja meg a tevékenységsáv közepén, és húzza vízszintesen. A kezdés és a befejezés együtt mozdul, egész napokban. Az időtartam nem változik.
2. Engedje el. A sáv az új helyén marad. Az ütemezés ekkor már nem naprakész. Nyomja meg a *Számítás* gombot (F5), vagy hagyja, hogy az alkalmazás maga végezze el, ha az *Automatikus ütemezés-számítás* be van kapcsolva.

Ha a tevékenységnek van előde, az alkalmazás az új kezdést *Nem korábban kezdődő (SNET)* korlátozásként rögzíti, és ezt az elengedés után jelzi. Hogy miért van ez így, és mi történik más korlátozással, azt itt olvashatja: [Korlátozások és határidők](docs://uitleg-constraints). Ha visszahúzza az eredeti kezdésre, az eredeti korlátozás is visszatér.

Ha inkább fel vagy le húzza, és nem oldalra, akkor a tevékenységet egy másik sorba helyezi, a dátumok pedig maradnak. Az első néhány pixelben választott irány a teljes húzásra érvényes. Így egy mozdulat sosem módosítja egyszerre a dátumokat és a szerkezetet. Lásd: [A szerkezet módosítása](docs://howto-structuur-aanpassen).

### Az időtartam módosítása

1. Vigye az egeret a sáv jobb szélére. A kurzor balra és jobbra mutató nyíllá változik.
2. Húzza a szélt. Húzás közben egy kis címke jelenik meg a téma kiemelőszínében (alapértelmezés szerint narancs). A címke mutatja az időtartamot, amelyet a tevékenység most kapna, például *4d*. Ez élőben követi a húzást, így az elengedés előtt látja az új időtartamot. A jobb szélen a címke a sávon belül van, a bal szélen közvetlenül a sávtól balra. A címke ugyanúgy mutatja az időtartamot, ahogy az időtartam-oszlop mutatja.
3. Engedje el. Az időtartam az, amit a címke mutatott.

A bal szél a kezdést mozgatja, a befejezést pedig helyben hagyja. Így a tevékenység elején lesz rövidebb vagy hosszabb. Ugyanaz az SNET-szabály érvényes, mint a mozgatásnál. Ha a sáv közepét húzza, a címke nem jelenik meg, mert az időtartam nem változik.

Az időtartam a tevékenység naptárának munkanapjait számolja. A hétvégék és az ünnepnapok nem számítanak, és napban megadott tevékenység nem lehet egy munkanapnál rövidebb. Órában megadott tevékenységnél az alkalmazás az egér alatti idővonal lépésközéhez kerekít: legalább egy órára, vagy negyedórára, ha elég erősen nagyít, és a *Negyedórák megjelenítése erős nagyításnál* be van kapcsolva.

Egy húzás egy lépésnek számít a *Visszavonás* funkcióban, bármilyen hosszú is a húzás. Megszakított tevékenység sávján a szélek másként működnek. Lásd: [Tevékenység megszakítása](docs://howto-taak-splitsen).

### Az idővonal eltolása

Hogy mit tesz a húzás az üres háttéren, az a görgetési módtól függ. A *Beállítások* ablakban, a *Megjelenés* lapon, a *Gantt › Görgetés és nagyítás* alatt, a *Mód* beállításnál választhatja ki:

- **Nagyítás + húzás** (alapértelmezett): ha az üres háttéren a bal egérgombbal húz, az idővonal az egérrel együtt mozog, mint egy térképen. A kurzor kéz lesz. Egy sávon a húzás egyszerűen sávmozgatást kezd.
- **Pozíció** és **Billentyűk**: ugyanez a húzás kijelölő keretet hoz létre. Az idővonalat a görgővel (lásd: [Beállítások](docs://ref-instellingen)) vagy az egér középső gombjával tolja el.

**Az egér középső gombja** (a lenyomott görgő) minden módban eltolja az idővonalat, akkor is, ha egy sávon kezdi. Nem működik, ha már másik mozdulat zajlik, például sáv húzása közben.

### Tevékenységek kijelölése kerettel

A keret kijelöli az összes tevékenységet a sorokban, amelyeket érint. Csak a keret magassága számít, az időtengely nem.

1. Kezdjen az üres háttéren. Ha a *Nagyítás + húzás* módot használja, tartsa lenyomva a Ctrl billentyűt (Mac gépen a ⌘ billentyűt). A *Pozíció* és a *Billentyűk* módban erre nincs szükség.
2. Húzzon a sorok fölé, amelyeket ki szeretne jelölni. A kijelölés keretet kap.
3. Engedje el. Az Esc billentyű húzás közben megszakítja a keretet, és a kijelölés nem változik.

Többet a kijelölésről itt olvashat: [Tevékenységek kijelölése, törlése és visszavonása](docs://howto-taken-selecteren-verwijderen). A tevékenységtáblázat üres részén a húzás nem tesz semmit.

### Nagyítás és kicsinyítés

1. Használja a *Nagyítás +* és a *Kicsinyítés -* gombokat (*Kezdés › Nagyítás*), vagy a + és a - billentyűt. A görgő is nagyít. Hogy mikor, az a görgetési módtól függ (lásd: [Beállítások](docs://ref-instellingen)).
2. Ha az egész projektet látni szeretné, válassza a *Nézet › Időskála › Illesztés a projekthez* lehetőséget, vagy nyomja meg a Ctrl+0 billentyűt. A *Visszaállítás* (a *Nézet* lapon) vagy a 0 billentyű visszaállítja a nagyítást az alapértelmezettre.
3. Az állapotsor jobb alsó sarkában látja a nagyítást pixel/napban, például *Nagyítás: 15 px/nap*.

Minél jobban kicsinyít, annál kevesebb a rácsvonal. 8 pixel/nap vagy több esetén minden naphoz tartozik vonal, a hét határán vastagabb vonallal. 2 és 8 pixel/nap között csak a hét határa marad meg. 2 pixel/nap alatt, év szinten, csak a hónapok határai maradnak. Különben a vászon egyenletes csíkmintává válna, amelyben a sávok eltűnnének. A szürke hétvégék és ünnepnapok, valamint a váltakozva színezett hétsávok minden szinten megmaradnak. Ha a vonalak eltűnnek, ezek mutatják a hetek szerkezetét. Az idővonal fejlécében a hétszámok és a napszámok csak akkor jelennek meg, ha van hely rájuk. 40 pixel/nap felett a hét napja is megjelenik a napszám előtt.

## Buktatók és az alkalmazás reakciója

**A kezdés nem mozdul.** Ha a tevékenységnek van előde, és az SNET-től eltérő korlátozása van, például *Lehető legkésőbb (ALAP)*, az alkalmazás nem alkalmazza a húzott kezdést. Az elengedés után megjelöli, melyik korlátozás tartja vissza a kezdést. A kezdés mozgatásához módosítsa azt a korlátozást. A jobb szél működik, mert az csak az időtartamot változtatja.

**A mozdulat más dolgot tesz.** Kapcsolat módban és megszakított tevékenység módban a sávon végzett mozdulatok másként működnek. Az Esc billentyű leállítja ezeket a módokat. Ha a Shift billentyűt nyomva tartja, miközben a sávról húz, a sáv mozgatása helyett kapcsolatot hoz létre. Lásd: [Kapcsolatok hozzáadása](docs://howto-relaties-leggen).

**A Pozíció és a Billentyűk módban a bal egérgomb nem tol.** Normál kurzort lát, nem kezet. Használja a görgőt vagy az egér középső gombját, vagy állítsa a módot *Nagyítás + húzás* értékre.

**Egy kattintás a megszakított sáv szünetében** kijelöli a tevékenységet, és nem indít húzást és keretet.

## Lásd még

- [Jobb egérgombos menük](docs://ref-contextmenus): a menük a sávon, egy soron és egy csoportfejlécen.
- [Billentyűparancsok](docs://ref-sneltoetsen): a billentyűk a nagyításhoz és a mozdulatok megszakításához.
- [Beállítások](docs://ref-instellingen): a görgetési mód és az időtengely.
- [Korlátozások és határidők](docs://uitleg-constraints): miért lesz a mozgatott kezdésből korlátozás.
