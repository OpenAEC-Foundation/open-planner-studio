# A menüszalag, fülenként

A menüszalag a képernyő tetején fülekből áll. Minden fülön gombcsoportok vannak. Ez a cikk leírja, mit csinál minden gomb, és hol látja az eredményt. Azt, hogyan végezzen el egy munkafolyamatot lépésenként, az útmutatókban találja. Itt azt nézheti meg, mit csinál egy gomb. A gomb, amely csak bizonyos feltétel mellett létezik vagy működik, mellette szerepel ez a feltétel.

## A menüszalag működése

- **Fülek** — a *Fájl* balra van, utána a *Kezdőlap*, *Ütemezés*, *Erőforrások*, *Nézet*, *Beállítások*, *Táblázat*, *IFC*, *Jelentés* és – csak az AI-mód bekapcsolása esetén – az *AI*.
- **Keskeny ablak** — ha a menüszalag nem fér el, a gombok jobbról balra ikonra zsugorodnak. A nevet ekkor az eszköztipp mutatja. Minden gomb, amelynek nincs saját eszköztippje, megmutatja a nevét.
- **A menüszalag összecsukása** — a menüszalag jobb alsó sarkában lévő kis nyíl lapos sávvá alakítja, amely csak ikonokat mutat. Az *Alaptervek és előrehaladás* csoport és a *Csatlakozás* csoport az AI fülön ekkor egyetlen gomb mögé kerül, amely előugró ablakot nyit. Alapértelmezett: kinyitva. Az alkalmazás megjegyzi az Ön választását.
- **Bővítménygombok** — egy bővítmény saját csoportot adhat egy fül végére. Az ilyen gomb azt csinálja, amit a bővítmény adott hozzá.

## Fájl

Ha a *Fájl* fülre kattint, a saját képernyője (a Backstage) veszi át a munkaterületet. Nincs menüszalag. A *Vissza* gomb bezárja. Ha a *Projektbeállítások* alatt módosított valamit, és nem alkalmazta, az alkalmazás először megkérdezi, mit kell tenni vele.

- **Új** — megnyitja az *Új projekt* ablakot, és bezárja a Backstage-t. A mezőket itt találja: [Új projekt és Projektbeállítások](docs://ref-projectinfo).
- **Megnyitás** — kiválaszt egy fájlt, és dokumentumként megnyitja. Bezárja a Backstage-t.
- **Legutóbbi** — a nemrég megnyitott projektek listája; egy kattintással megnyit egyet. Csak akkor látható, ha a környezet újra meg tudja nyitni a fájlokat: az asztali alkalmazásban és azokban a böngészőkben, amelyek fájlhozzáférést kínálnak, például a Chrome-ben és az Edge-ben. Más böngészőkben a gomb ott van, de az oldal üres marad.
- **Példák** — mellékelt példaütemezések. Ezek a *Teljes bemutató-ütemezések* (jelvény: *Minden funkció*) és az *Egyszerű példák* csoportra oszlanak. Egy kattintás új lapon nyit meg egyet.
- **Mentés** — a projektet a dokumentum fájljába írja. Ha a dokumentumnak még nincs fájlja, először egy nevet és helyet választ. Az olyan fájlt, amelyet nem IFC-formátumban nyitott meg, soha nem írja felül. Ilyenkor a *Mentés* egy nevet és helyet kér egy IFC-fájlhoz.
- **Mentés másként** — új nevet vagy helyet választ, és oda IFC-formátumban menti.
- **Exportálás** — kártyák exportformátumonként, leírással. Egy kattintás átalakítja a projektet, elmenti, és visszaviszi a *Kezdőlap* fülre. Ha az ütemezésben ciklus van, a hiba a Backstage-ben jelenik meg, és Ön ott marad. Ha a projekt egy erőforrástárhoz kapcsolódik, alul megjelenik az *Erőforrástár-fájl mentése mellé* jelölőnégyzet. Ez csak az IFC-kártyánál működik.
- **Importálás** — felül az *Előrehaladás frissítése táblázatból* kártya (tevékenységek nélkül le van tiltva), alatta pedig a bővítmények által hozzáadott importálók.
- **Nyomtatás** — a *Nyomtatási előnézet megnyitása* gomb a *Jelentés* fülre visz.
- **Projektbeállítások** — ennek a projektnek a metaadatai és számítási profilja. A módosítások csak az *Alkalmazás* gombra kattintás után lépnek életbe. Lásd: [Új projekt és Projektbeállítások](docs://ref-projectinfo) és [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen).
- **Beállítások** — ugyanazok a beállítások, mint a *Beállítások* ablakban.
- **Bővítmények** — bővítmények kezelése és telepítése. Lásd: [Bővítmény telepítése és kezelése](docs://howto-extensie-installeren).
- **Erőforrástár** — erőforrástárak kezelése. Lásd: [Erőforrástárak kezelése és megosztása](docs://howto-bibliotheken-beheren).
- **Súgó** — a beépített dokumentáció, F1 billentyűvel is. A keresőmező címekben, fejezetcímekben és magában a szövegben keres. A cikkek négy csoportban vannak: *Oktatóanyagok*, *Útmutatók*, *Magyarázat* és *Referencia*. A *Dokumentáció nyelve* alatt az *Az alkalmazás nyelvét követi* lehetőséget vagy egy nyelvet választhat a listából. A holland és az angol a forrásnyelv. A többi nyelven csak a már lefordított cikkek érhetők el. Ha egy cikk hiányzik az Ön nyelvén, az angol változatot olvassa, figyelmeztetéssel. A választást ezen az eszközön tárolja az alkalmazás, az alkalmazás nyelvétől külön. A súgót ablakokból vagy panelekből is megnyithatja. Sok ablaknak, és a *Tulajdonságok*, *Erőforrások* és *Figyelmeztetések* paneleknek a jobb felső sarkában kérdőjel van (*Súgó ehhez a részhez*). Ez a súgót nyitja meg arról az ablakról vagy panelről szóló cikkel. Ha az ablakba olyat írt, amit még nem mentett, az alkalmazás először megkérdezi: *Mentés*, *Mégse* (elveti a bevitt adatokat) vagy *Vissza* (marad az ablakban). Ezután az ablak bezárul, és megnyílik a súgó. Néhány ablak, például a *Tevékenység szerkesztése* és az *Erőforrás-kiegyenlítés*, mindig rákérdez. Bevitel nélkül a súgó azonnal megnyílik.
- **Bemutató indítása** — bezárja a Backstage-t, és elindítja a bemutatót az 1. lépéstől.
- **Projekt bezárása** — bezárja az aktív dokumentumot. Ha mentetlen módosításai vannak, az alkalmazás megerősítést kér.

## Kezdőlap

### Kezdőlap › Fájl

- **Új**, **Mentés**, **Megnyitás** és **Mentés másként** — ugyanazok a műveletek, mint a *Fájl* fülön.
- **Legutóbbi** — legördülő lista a nemrég megnyitott projektekkel; egy kattintás megnyit egyet. Csak ugyanazzal a feltétellel látható, mint a *Fájl › Legutóbbi*. Ha nincs legutóbbi fájl, ez áll itt: *Nincs legutóbbi fájl*.
- **Exportálás** — legördülő lista az exportformátumokkal (rövid nevekkel). Egy kattintás átalakítja a projektet, és elmenti.

### Kezdőlap › Szerkesztés

- **Visszavonás** — visszafordítja az utolsó módosítást. Ha nincs visszavonható művelet, le van tiltva.
- **Ismétlés** — visszaállítja az utolsó visszavont módosítást. Ha nincs visszaállítható művelet, le van tiltva.
- **Törlés** — törli a kijelölt tevékenységeket az altevékenységeikkel együtt, egy lépésben. Kijelölés nélkül le van tiltva.

### Kezdőlap › Tevékenységek

- **Tevékenység** — új tevékenységet ad hozzá, *Új tevékenység* névvel, 5 munkanapos időtartammal, a projektkezdéstől kezdve. (Ha az *Óraalapú tervezés bekapcsolása* be van kapcsolva, és a *Projektbeállítások* részben az *Alapértelmezett egység új tevékenységekhez* óra, az időtartam 5 óra.) Ha van kijelölt tevékenység, és a nézet egyszerű fa, az új tevékenység a legalsó kijelölt tevékenység alá kerül (eszköztipp: *Új tevékenység közvetlenül a kijelölés alatt*). Kijelölés nélkül a lista aljára kerül (eszköztipp: *Új tevékenység a lista alján*). Ha van kijelölés, de szűrés, csoportosítás vagy rendezés van érvényben, az új tevékenység szintén a lista aljára kerül. Ilyenkor piros értesítés jelzi, hogy az alkalmazás nem tudja a kijelölés alá helyezni, a *Törlés* gombbal. Az új tevékenység lesz az egyetlen kijelölt elem. A Gantt-diagram odaugrik hozzá, a neve pedig felülírható a *Tulajdonságok* panelben.
- **Mérföldkő ▾** — legördülő lista, amely mérföldkövet (időtartam 0) tesz ugyanarra a helyre, mint a *Tevékenység* gomb. A *Kezdő mérföldkő* és a *Befejezési mérföldkő* állítják be a mérföldkő típusát. Az új mérföldkő neve *Új mérföldkő*, munkaneme *Egyéb*. Az *Ellenőrzési pont (kötelező)* befejező mérföldkövet hoz létre, *Ellenőrzés* munkanemmel és a *Kötelező (szerződéses)* jelöléssel. A neve *Új ellenőrzési pont*.
- **Összekapcsolás ▾** — legördülő lista négy fix művelettel. A fő gomb jelentése sosem változik. A négy műveletet lásd: *Ütemezés › Kapcsolatok*.
- **Tevékenység megszakítása** — be- vagy kikapcsolja a megszakítási módot. Bekapcsolt állapotban egy sáv a menüszalag alatt elmagyarázza, hogy a sávon kell kattintani, ahol a megszakítás kezdődik, és jobbra húzni a hosszához. Le van tiltva, ha a Gantt-diagram nem látható (a *Táblázat*, *IFC* és *Jelentés* füleken, valamint a teljes erőforráspanel alatt). Az eszköztipp ekkor ezt írja: *Csak akkor érhető el, ha a Gantt-diagram látható*. Lásd: [Tevékenység megszakítása](docs://howto-taak-splitsen).

### Kezdőlap › Ütemezés

- **Számítás** — kiszámítja az ütemezést: a dátumokat, a tartalékidőt, a kritikus utat és az erőforrás-terhelést. Ez soha nem történik meg magától, kivéve ha bekapcsolja az *Automatikus ütemezés-számítás* opciót (*Beállítások*, *Ütemezés* fül, *Ütemezés-számítás* címsor). Amíg az ütemezés elavult, az állapotsor ezt írja: *Elavult — újraszámítsa (F5)*.

### Kezdőlap › Nagyítás

- **Nagyítás +** — az időtengelyt naponként 10 pixellel nagyítja.
- **Kicsinyítés -** — az időtengelyt naponként 10 pixellel kicsinyíti.

## Ütemezés

### Ütemezés › Ütemezés

A *Számítás* gomb ugyanaz, mint a *Kezdőlap* fülön.

- **Projekt áthelyezése…** — megnyitja a *Projekt áthelyezése* ablakot. Ha nincs projektkezdés, le van tiltva. Lásd: [Projekt áthelyezése](docs://howto-project-verplaatsen).
- **Figyelmeztetések** — megjeleníti vagy elrejti a *Figyelmeztetések* panelt a jobb oldali oszlopban. A gomb világít, amíg a panel látható. Bekapcsolása kinyit egy összecsukott oszlopot. A panel tartalmát a következő cikk írja le: [Értesítések és figyelmeztetések](docs://ref-meldingen).

### Ütemezés › Kapcsolatok

A csoportban van az *Összekapcsolás ▾* gomb négy művelettel, és a *Tevékenység megszakítása* gomb (ugyanúgy, mint a *Kezdőlap* fülön). A négy művelet:

- **Kapcsolat rajzolása** — be- vagy kikapcsolja az összekapcsolási módot. Bekapcsolt állapotban pipa jelenik meg, és a fő gomb világít. Bekapcsolva a Gantt-diagramon egy sávról egy másikra húzva hozhat létre kapcsolatot. A menüszalag alatti sáv megmondja, hogyan lehet kilépni (*Leállítás* vagy Esc). Le van tiltva, ha a Gantt-diagram nem látható.
- **Kijelölt tevékenységek összekapcsolása** — befejezés-kezdés kapcsolatot hoz létre két tevékenység között, késleltetés nélkül. Az elsőnek kijelölt tevékenység lesz az előd. Csak akkor érhető el, ha pontosan két tevékenység van kijelölve (egyébként: *Válasszon ki pontosan két tevékenységet*). Ha már van ilyen kapcsolat, vagy ciklus keletkezne, az alkalmazás üzenettel elutasítja.
- **Projektközi kapcsolat hozzáadása…** — megnyit egy ablakot, amelyben külső elődöt vagy utódot adhat hozzá a kijelölt tevékenységhez. Csak akkor érhető el, ha pontosan egy tevékenység van kijelölve (egyébként: *Válasszon ki pontosan egy tevékenységet*).
- **Összes projektközi kapcsolat frissítése** — frissíti az összes projektközi kapcsolat horgonyait, és a menüben jelenti, hány frissült vagy hiányzik. Csak akkor érhető el, ha a projektben van projektközi kapcsolat (egyébként: *Ez a projekt nem tartalmaz projektközi kapcsolatot*).

A kapcsolatok hátterét ezekben olvashatja: [Kapcsolatok létrehozása](docs://howto-relaties-leggen) és [Kapcsolatok és késleltetés](docs://uitleg-relaties).

### Ütemezés › Útvonalkövetés

- **Elődök** — a Gantt-diagramon kiemeli a kijelölt tevékenységek elődjeit, lánconként.
- **Utódok** — kiemeli a kijelölt tevékenységek utódjait.

Egyszerre mindkettőt bekapcsolhatja. Egy gomb második kattintása ezt az oldalt újra kikapcsolja. A meghatározó kapcsolatok erősebb színezést kapnak. Lásd: [Útvonalkövetés](docs://howto-pad-traceren).

### Ütemezés › Naptár

- **Naptár** — megnyitja a *Naptárak* ablakot a projekt naptárkészletével. Lásd: [Naptárablakok](docs://ref-kalenders).

### Ütemezés › Szerkezet

- **Kódok és mezők** — megnyitja a *Kódok és mezők* ablakot a tevékenységkódokhoz és az egyéni mezőkhöz. Lásd: [Kódok és egyéni mezők](docs://howto-codes-en-velden).
- **WBS automatikus** — be- vagy kikapcsolja a WBS-kódok automatikus számozását. Alapértelmezett: be egy új projektben. Megnyitott fájlban, ha nincs ez a beállítás: be, ha a fájl üres, vagy ha minden kód már megegyezik a fa számozásával, különben ki. Bekapcsolva a teljes fa egyszerre újraszámozódik, a kódok ezután minden szerkezeti változást követnek, és a *WBS-kód* mező a panelen és az ablakban le van tiltva.
- **WBS újraszámozása** — egyszer újraszámozza a WBS-kódokat a fában elfoglalt helyzet szerint (1.2.3). Le van tiltva, amíg a *WBS automatikus* be van kapcsolva.
- **Sablonok** — legördülő lista a mentett WBS-sablonokkal. Mindegyiknél látszik a tevékenységek és a kapcsolatok száma. Egy kattintás a sablont a kijelölt tevékenység alá szúrja, kijelölés nélkül a legfelső szinten. A kuka ikon törli a sablont. Sablon nélkül megmondja, hogyan kell menteni egyet (jobb klikk egy összefoglaló tevékenységen, *Ág mentése sablonként*). Lásd: [WBS-sablonok mentése és beszúrása](docs://howto-wbs-sjablonen).
- **Behúz** — a kijelölt tevékenységeket az előttük lévő tevékenység altevékenységeivé teszi. Kijelölés nélkül, és amint szűr, csoportosít vagy rendez, le van tiltva. Az eszköztipp ekkor ezt írja: *Szűrés/csoportosítás/rendezés közben nem érhető el*.
- **Kihúz** — eggyel feljebb viszi a kijelölt tevékenységeket, közvetlenül jelenlegi szülőjük után. Ugyanazok a feltételek, mint a *Behúz* esetén.

### Ütemezés › Alaptervek és előrehaladás

- **Alaptervek kezelése…** — megnyitja az alaptervablakot. Lásd: [Alapterv mentése és kezelése](docs://howto-baseline-opslaan-en-beheren).
- **Állapotdátum** — az a dátum, ameddig az előrehaladást méri. Írjon be egy dátumot. A kereszt (*Állapotdátum törlése*) eltávolítja. Ha a projektnaptárnak vannak idősávjai, az alkalmazás órában számol, és a dátum mellett időmező jelenik meg (az MS Project gyakran 17:00-t tárol). Az idő ekkor számít: 12:00 a 17:00 helyett fél nappal eltérő hátralévő munkát ad. Idősávok nélkül az alkalmazás egész napokban számol, és nincs időmező. Hatás: az alkalmazás eddig a dátumig méri az előrehaladást, a Gantt-diagramon pedig az állapotdátum-vonal és az előrehaladási vonal erre a dátumra kerül. Lásd: [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang).
- **Előrehaladási mód** — választás a *Retained Logic* és a *Progress Override* között. Alapértelmezett: *Retained Logic*. Hatás: *Retained Logic* esetén egy elkezdett utód hátralévő munkája követi a kapcsolatot. *Progress Override* esetén a hátralévő munka az állapotdátumon kezdődik, anélkül hogy megvárná az elődöt. Lásd: [Az előrehaladási mód kiválasztása](docs://howto-voortgangsmodus-kiezen).

Összecsukott menüszalag esetén ez a három egyetlen zászlógomb mögött van, amelynek címe: *Alaptervek és előrehaladás*.

### Ütemezés › Előrehaladás

- **Előrehaladási lap exportálása** — `.xlsx` táblázatot készít a tevékenységekkel, hogy az előrehaladást az alkalmazáson kívül lehessen kitölteni. Tevékenységek nélkül le van tiltva.
- **Előrehaladás frissítése táblázatból** — megnyitja az importálóablakot egy visszakapott táblázathoz. Tevékenységek nélkül le van tiltva. Lásd: [Előrehaladás importálása táblázatból](docs://howto-voortgang-importeren).

Ez a csoport a *Táblázat* és a *Jelentés* fülön is látható.

## Erőforrások

### Erőforrások › Kezelés

- **Erőforrások** — megnyitja a teljes erőforráspanelt. Ez átveszi a munkaterületet. Világít, amíg ez a panel látható. Lásd: [Erőforráspanel](docs://ref-resourcepaneel).
- **Erőforrásdokk** — a kompakt erőforráspanelt a jobb oldali oszlopba dokkolja, a Gantt-diagram mellé. Világít, amíg a dokk látható. Egy második kattintás bezárja. A dokk csak a nevet, a színt, a túlterhelés figyelmeztetését és a *Maximális mennyiség* értéket mutatja. Ha tevékenység van kijelölve, csak azon tevékenységek erőforrásait mutatja.
- **Új erőforrás** — megnyitja a teljes erőforráspanelt egy üres piszkozatsorral az új erőforrásnak. Nem jön létre semmi, amíg nem ír be nevet. Ha máshova kattint, nem marad semmi. Az erőforrás az erőforrástárba vagy a projektbe kerül, a nézettől függően.

### Erőforrások › Hozzárendelés

- **Hozzárendelés ▾** — hozzárendel egy erőforrást a kijelölt tevékenységhez. Csak akkor érhető el, ha pontosan egy tevékenység van kijelölve, amely levéltevékenység és nem mérföldkő. Egyébként a gomb szürke. A menüben először a *Hozzárendelt mennyiség/nap* (alapértelmezett: 1) és a *Görbe* (alapértelmezett: *Egyenletes*) értéket állítja be. Egy erőforrásra kattintva azokkal az értékekkel rendeli hozzá. A menü csak azokat az erőforrásokat listázza, amelyek még nincsenek a tevékenységen. Lásd: [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen).

### Erőforrások › Hisztogram

- **Hisztogram** — megjeleníti vagy elrejti a hisztogramsávot a Gantt-diagram alatt. Alapértelmezett: ki. Az alkalmazás megjegyzi az Ön választását.
- **Előző** és **Következő** — az erőforrásokon lépked végig a hisztogramsáv választójában. A körben extra lépésként szerepel az *Összes erőforrás*. Le van tiltva, ha a hisztogram ki van kapcsolva, vagy a projektben nincs erőforrás.

### Erőforrások › Kiegyenlítés

- **Kiegyenlítés…** — megnyitja az *Erőforrás-kiegyenlítés* ablakot. Lásd: [Kiegyenlítés](docs://uitleg-nivelleren).
- **Kiegyenlítés törlése** — eltávolítja a késéseket és szüneteket, amelyeket a kiegyenlítés alkalmazott. Le van tiltva, ha egyik tevékenységnek sincs kiegyenlítési eredménye.

### Erőforrások › Túlterhelés

- **Túlterhelés** — nem gomb, hanem számláló: azoknak az erőforrásoknak a száma, amelyeknél legalább egy napon túlterhelés van, vagy *Nincs*. Ha van ilyen, piros színnel és figyelmeztető ikonnal jelenik meg. A szám a *Számítás* után frissül, és az erőforrások és hozzárendelések változásai után is. Ha a tevékenységek dátumait módosítja, az csak a *Számítás* után számít be.

## Nézet

### Nézet › Időskála

- **Nagyítás +** és **Nagyítás -** — nagyítja vagy kicsinyíti az időtengelyt naponta 10 pixellel.
- **Visszaállítás** — a nagyítást visszaállítja az alapértelmezett 30 pixel naponta értékre.
- **Illesztés a projekthez** — úgy nagyít és görget, hogy a teljes projekt látható legyen.
- **Időskála-választás** — lista ezekkel: *Év*, *Negyedév*, *Hónap*, *Hét*, *Nap* és — csak akkor, ha be van kapcsolva az *Óraalapú tervezés bekapcsolása* — *Óra*. Egy választás rögzített nagyítást állít be. A kijelzett érték követi az aktuális nagyítást, alatta pedig az látszik, hány pixel naponta ez a nagyítás.

### Nézet › Megjelenítés

- **Oszlopok…**, **Szűrés…**, **Csoportosítás…** és **Rendezés…** — csak akkor látható, ha be van kapcsolva a *Klasszikus nézetgombok megjelenítése* (*Beállítások*, *Speciális* fül, *Régi funkciók* címsor). Alapértelmezett: ki. Az *Oszlopok*… a *Táblázat* nézetre visz, és ott megnyitja az oszlopválasztót. A *Szűrés*… azonnal megnyitja a szűrőablakot, ha nincs mentett szűrő. Mentett szűrők esetén menüt nyit. Ebben a *Szűrés*…, a *Törlés* (csak ha szűrő aktív) és a mentett szűrők szerepelnek. A *Csoportosítás*… két szintet enged meg. A *Rendezés*… több szintet enged meg. Egy gomb kigyullad, ha az adott nézetbeállítás aktív. Az aktuális menüszalagon elrendezésgombokkal éri el ezt. Lásd: [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken).

### Nézet › Vázlat

- **Összecsukás** — összecsukja a kijelölt összefoglaló tevékenységeket. Kijelölés nélkül mindet. Csoportosított nézetben minden csoportot összecsuk, a kijelölésnek nincs hatása.
- **Kibontás** — az ellenkezője.

### Nézet › Elrendezés

- **Elrendezésgombok** — minden elrendezés egy kapcsoló, ikonnal és névvel. Az *Erőforrásdiagram* is benne van. Egy kattintás bekapcsolja az elrendezést. Újabb kattintás kikapcsolja, és visszaadja a kattintás előtti nézetet. Különböző részekből álló elrendezések együtt is be lehetnek kapcsolva. Kattintson jobb gombbal egy elrendezésre: *Szerkesztés*…, *Duplikálás* és *Törlés* (megerősítés után). Egy beépített elrendezés csak duplikálható.
- **Új elrendezés** — megnyitja az elrendezésablakot egy új elrendezéshez.

### Nézet › Prezentáció

- **Prezentáció** — be- vagy kikapcsolja a prezentációmódot (leállításhoz Esc, az asztali alkalmazásban emellett F11). Csak a Gantt-diagram tölti ki a képernyőt. Lásd: [Prezentálás nagy képernyőn](docs://howto-presentatie).
- **Osztott nézet** — a Gantt-diagramot két időablakra osztja. Mindkettő az aktuális nagyítással és pozícióval indul (50 százalékos osztás). Vagy visszaállítja egy ablakra. Alapértelmezett: ki. Lásd: [Az osztott nézet és a mini-térkép használata](docs://howto-split-view-en-mini-map).
- **Mini-térkép** — megjeleníti vagy elrejti a mini-térképet. Alapértelmezett: ki. A választása megmarad.

### Nézet › Panelek

- **Tulajdonságok** — megjeleníti vagy elrejti a *Tulajdonságok* panelt a jobb oldali oldalsávban. Alapértelmezett: be. Lásd: [Tevékenység-párbeszédablak és tulajdonságok panel](docs://ref-taak-eigenschappen).

Az *Erőforrások*, *Erőforrás-dokkoló* és *Hisztogram* gombok ugyanazok, mint az *Erőforrások* fülön. A *Figyelmeztetések* ugyanaz, mint az *Ütemezés* fülön.

**A jobb oldali oldalsáv.** A Gantt-diagram jobb oldalán lévő oldalsáv akkor jelenik meg, amint legalább az egyik *Tulajdonságok*, *Erőforrás-dokkoló* vagy *Figyelmeztetések* panel be van kapcsolva. Ha egyik sincs bekapcsolva, nincs oldalsáv. Ha egy teljes panel foglalja el a munkaterületet, például a teljes erőforráspanel, az oldalsáv eltűnik. Csak a *Táblázat* fülön marad meg.

- **Szélesség** — húzza el a munkaterület és az oldalsáv közötti elválasztót. Egy szélesség vonatkozik az oldalsáv összes panelére.
- **Felosztás** — ha két panel be van kapcsolva, húzza el a köztük lévő szegélyt. Ha csak egy van bekapcsolva, az a panel kitölti az egész oldalsávot.
- **Összecsukás** — a fejlécben lévő *Oldalsáv összecsukása* gomb elrejti az oldalsávot. A keskeny csíkon lévő *Oldalsáv kibontása* gomb visszahozza az oldalsávot, ugyanazokkal a panelekkel, mint korábban.
- **Bezárás** — minden panelnek van egy kereszt a fejlécében. Ez ugyanaz a kapcsoló, mint a menüszalagon lévő gomb.
- **Teljes panel** — az erőforrás-dokkolóban a *Teljes panel* gomb megnyitja a teljes erőforráspanelt.

### Nézet › Alapterv és előrehaladás

Ennek a csoportnak ugyanaz a neve, mint az *Ütemezés* fülön lévő csoporté. Ez a csoport azonban a Gantt-diagram rajzolási beállításait tartalmazza.

- **Alapterv-átfedés** — az aktív alaptervet vékony sávként mutatja minden tevékenységsáv alatt. Alapértelmezett: be. Aktív alapterv nélkül nincs mit látni.
- **Előrehaladási vonal** — vonalat rajzol az állapotdátumnál. Ez a vonal tevékenységenként annyira domborodik ki, amennyi az előrehaladása. Alapértelmezett: be. Állapotdátum nélkül nincs mit látni. Ha az előrehaladási vonal be van kapcsolva, ez a vonal jelöli az állapotdátumot is.
- **Állapotdátum-vonal** — szaggatott vonalat rajzol az állapotdátumnál. Alapértelmezett: be. Csak akkor látja, ha az előrehaladási vonal ki van kapcsolva, mert különben az veszi át a helyét. A fejlécben a dátum felirata addig marad, amíg a két vonal közül legalább az egyik be van kapcsolva. A felirat a beállított dátumformátumot követi, például 20-09-2006. Ha az alkalmazás órában számol, a vonal és a felirat az adott napi időpontnál áll, a felirat pedig az időt is mutatja, például 20-09-2006 17:00.
- **Sávszínek** — kiválasztja, hogyan színezi a sávokat: *Kritikus út* (alapértelmezett), *Tevékenységenként — automatikus* vagy *Kategória szerint*, a mező kiválasztásával. Ha ez a mező nincs benne a projektben, a menü jelzi, hogy ideiglenesen a *Munkanem* szerint színez. Ha a színezés nem a *Kritikus út*, piros körvonal jelöli a kritikus utat. A választás a jelentésre is vonatkozik.
- **Erőforrás-kiemelés** — vékony csíkot rajzol az erőforrás színében minden nem összefoglaló tevékenységsáv alá. A csík a napi hozzárendelt mennyiséggel arányosan van osztva. Alapértelmezett: ki.
- **Tartalékidő-sáv** — zöld sávot rajzol a nem kritikus sáv után, a tevékenység legkésőbbi befejezéséig. Alapértelmezett: be.
- **Kapcsolatvonalak** — megjeleníti vagy elrejti a tevékenységek közötti kapcsolatvonalakat. Alapértelmezett: be. A választás a dokumentumhoz és az elrendezéshez tartozik.

## Beállítások

### Beállítások › Projekt

- **Projektbeállítások** — megnyitja a *Projektbeállítások* ablakot: a projekt adatait, és a *Számítási profil és beállítások* blokkban azt, hogyan számítja ki a projekt az ütemezést. Lásd: [Új projekt és Projektbeállítások](docs://ref-projectinfo).
- **Beállítások** — megnyitja a *Beállítások* ablakot a *Megjelenés*, *Ütemezés* és *Speciális* fülekkel. Ugyanezek a beállítások a *Fájl › Beállítások* menüpont alatt érhetők el.

### Beállítások › Naptár

A *Naptár* gomb ugyanaz, mint az *Ütemezés* fülön.

### Beállítások › Gyorsbillentyűk

- **Gyorsbillentyűk** — megnyitja a *Gyorsbillentyűk* ablakot.

## Táblázat

A *Táblázat* fül a tevékenységeket teljes táblázatként mutatja a Gantt-diagram helyett. A *Fájl*, *Szerkesztés*, *Tevékenységek*, *Ütemezés* és *Útvonalkövetés* csoportok ugyanazok, mint a *Kezdőlap* és az *Ütemezés* fülön, és ugyanazt a kijelölést használják. Nincs *Nagyítás* csoport, mert a nagyítás csak a Gantt-diagram időtengelyét méretezi. A *Tevékenység megszakítása* és a *Kapcsolat rajzolása* gombok itt le vannak tiltva, mert nincs Gantt-diagram.

### Táblázat › Oszlopok

- **Oszlopok…** — megnyitja ennek a táblázatnak az oszlopválasztóját. Ugyanez az oszlopválasztó nyílik meg a táblázat fejlécében lévő plusz jelre kattintva. A súgószöveg ezt mondja: *Válassza ki a Táblázat nézet oszlopait*. Lásd: [Táblázatoszlopok módosítása](docs://howto-tabelkolommen-aanpassen) és [Táblázatoszlopok](docs://ref-tabelkolommen).

## IFC

A fül az IFC-panelt mutatja a munkaterületen. A menüszalagon itt nincs gomb, csak ez a szövegsor: *IFC - Industry Foundation Classes, a projekt sémájában (alapértelmezés: IFC 4.3 ADD2)*.

## Jelentés

### Jelentés › Jelentés

- **Nyomtatás** — csak ezen a fülön érhető el. Itt nem tesz semmit, mert a *Jelentés* már meg van nyitva. A jelentés lehetőségei a jelentésképernyőn vannak.

## AI

Az *AI* fül csak akkor létezik, ha be van kapcsolva az *AI-mód bekapcsolása* (*Beállítások*, *Speciális* fül, *AI-mód* címsor). Alapértelmezett: ki. Ha kikapcsolja, a fül eltűnik, és a híd leáll. Egy AI-segítőtárs az ütemezésével egy MCP-hídon keresztül dolgozik. Ezt a hidat itt indítja el. Lásd: [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Kiszolgáló

- **Híd indítása** és **Híd leállítása** — elindítja vagy leállítja az MCP-hidat. Mellette látható az állapot: *Ki*, *Aktív a(z) … porton*, *A(z) … port foglalt* (az okkal együtt) vagy *Hiba*. A webes verzióban tiltva. A súgószöveg ezt mondja: *A híd csak az asztali alkalmazásban működik*. Ugyanez az állapot pontként jelenik meg az állapotsorban, az *AI* felirattal.

### AI › Kapcsolat

- **Port** — a híd portja. Alapértelmezett: 3877. Csak akkor módosítható, ha az állapot *Ki*. A súgószöveg: *Csak akkor módosítható, ha a szerver le van állítva*.
- **Token** — a híd jelszava, rejtve jelenik meg. Kis gombok: *Token megjelenítése*/*Token elrejtése*, *Másolás* és *Új token*. Az *Új token* először megerősítést kér, mert egy új token megszakít minden meglévő kapcsolatot. Ha a híd fut, újraindul az új tokennel.
- **Csatlakozás** — megjeleníti a kapcsolat adatait: végpont, token, egy konfigurációs részlet és egy kapcsolódási szöveg. Ezt a szöveget illessze be az AI-ügynökbe.

### AI › Biztonság

- **Szünet** / **Folytatás** — ideiglenesen minden változtatást visszautasít az AI részéről. Az olvasás továbbra is engedélyezett, és a híd aktív marad. A gomb pirosan világít, amíg szünetel.
- **Csak olvasható** — visszautasít minden módosító eszközt, amíg be van kapcsolva.
- **Automatikus biztonsági mentés: be** / **Automatikus biztonsági mentés: ki** — dokumentumonként, az első AI-változtatás előtt automatikusan IFC-mentést ír. Alapértelmezett: be.
- **Biztonsági mentés most** — azonnal ír egy biztonsági mentést, és jelenti a fájl nevét. Csak az asztali alkalmazásban.
- **Biztonsági mentések mappájának megnyitása** — a biztonsági mentéseket tartalmazó mappát nyitja meg. Csak az asztali alkalmazásban.

### AI › Tevékenység

- **Tevékenységpanel** — megjeleníti vagy elrejti az *AI-tevékenység* panelt. Ebben a híd felé küldött hívások láthatók, azok argumentumaival és válaszaival.
