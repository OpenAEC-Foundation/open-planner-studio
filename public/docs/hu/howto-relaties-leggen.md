# Kapcsolatok hozzáadása

Cél: tevékenységek összekapcsolása, hogy egy tevékenység csak akkor kezdődjön, ha az előtte lévő munka befejeződött. Szükség esetén adjon hozzá várakozási időt (késleltetést) közéjük.

## Mikor van erre szüksége

Kapcsolatok nélkül az alkalmazás nem tudja, hogy a falazó csak akkor kezdhet, ha az alapozást leöntötték. Minden tevékenység ekkor a projektkezdéssel indul, és a befejezési dátumnak nincs értelme. Egy **kapcsolat** rögzíti ezt a sorrendet. Az első tevékenység az **előd**, a második az **utód**.

Kapcsolatokat akkor érdemes hozzáadni, amikor összeállítja az ütemezést, amikor új tevékenységet vesz fel, vagy amikor kiderül, hogy két tevékenység mégis függ egymástól. Egy **késleltetés** két tevékenység közötti várakozási idő, például beton, amelynek meg kell szilárdulnia, vagy padlóaljzat, amelynek meg kell száradnia.

Az alapértelmezett kapcsolat a **FS** (befejezés-kezdés): az utód csak akkor kezdődhet, ha az előd befejeződött. Az alkalmazás ezen kívül az SS, FF és SF típust is ismeri, amelyek egy kezdést vagy befejezést egy másik kezdéshez vagy befejezéshez kötnek. Például SS (kezdés-kezdés) esetén a vakolás csak akkor kezdődhet, ha az épületgépészet már elkezdődött.

Nem tudja, melyik típusra van szüksége? A típusválasztás alatt egy mondat magyarázza el a valódi tevékenységnevekkel, például *Metselwerk csak akkor kezdődhet, ha Fundering befejeződött.* Válasszon másik típust, és a mondat ezzel együtt változik. Ezt a *Kapcsolattípus* ablakban, a *Kapcsolatok* blokkban és az *Elődök* vagy *Utódok* oszlopban látja.

## Lépések

Négyféleképpen adhat hozzá kapcsolatot. Mindegyik ugyanazt a kapcsolatot hozza létre. Válassza azt, ami a helyzetéhez a legjobban illik.

### Két kijelölt tevékenység összekapcsolása

Akkor hasznos, ha a tevékenységtáblázatban dolgozik.

1. A tevékenységtáblázatban kattintson az elsőként jövő tevékenységre: ez az előd.
2. Tartsa lenyomva a Ctrl billentyűt (Mac-en ⌘), és kattintson a következő tevékenységre: ez az utód.
3. Válassza a *Kezdőlap › Tevékenységek › Kapcsolat ▾ › Kijelöltek összekapcsolása* lehetőséget. Ugyanez a gomb az *Ütemezés › Kapcsolatok* alatt is megtalálható.

Az alkalmazás befejezés-kezdés kapcsolatot hoz létre késleltetés nélkül, és például ezt jelzi: *Kapcsolat létrehozva: Foundation brickwork → Lay hollow-core floor*. A gomb csak pontosan két kijelölt tevékenységgel működik.

### Kapcsolat rajzolása a Gantt-ben

Akkor hasznos, ha egymás után sok kapcsolatot ad hozzá.

1. Válassza a *Kezdőlap › Tevékenységek › Kapcsolat ▾ › Kapcsolat rajzolása* lehetőséget. A Gantt felett megjelenik ez az üzenet: *Kapcsolatmód: húzzon a Gantt egyik sávjától a másikig kapcsolat létrehozásához. Az Esc leállítja.*
2. Nyomja le az előd sávját, és húzza az utód sávjára. Szaggatott vonal nyíllal követi a mutatót.
3. Engedje fel az egérgombot. Megjelenik a *Kapcsolattípus* kis ablak a típussal (alapértelmezés szerint FS) és egy mezővel a késleltetéshez.
4. Ha szükséges, módosítsa a típust vagy a késleltetést, majd nyomja meg az Enter billentyűt, vagy kattintson az ablakon kívülre. A kapcsolat létrejön.
5. Adja hozzá azonnal a következőt: a mód bekapcsolva marad. A leállításhoz nyomja meg az Esc billentyűt, kattintson az üzenet *Leállítás* gombjára, vagy válassza újra a *Kapcsolat rajzolása* lehetőséget.

Ha az Esc billentyűt nyomja meg a *Kapcsolattípus* ablakban, nem rögzül semmi. Egyetlen kapcsolathoz nem kell bekapcsolnia a módot: tartsa lenyomva a Shift billentyűt, miközben sávról sávra húz. A sáv helyi menüjének *Kapcsolat létrehozása innen* pontja bekapcsolja a kapcsolatmódot; a húzást ezután is Önnek kell elvégeznie. A *Táblázat* lapon, Gantt nélkül, a *Kapcsolat rajzolása* parancs le van tiltva.

### Kapcsolat hozzáadása a Tulajdonságok panelen

Akkor hasznos, ha egy tevékenységet néz, és hozzá szeretné adni az elődeit vagy utódait.

1. Jelölje ki a tevékenységet. A *Tulajdonságok* panel a jobb oldalon található. Ha nem látja, kapcsolja be a *Nézet › Panelek › Tulajdonságok* lehetőséget.
2. A *Kapcsolatok* blokkban kattintson a *Kapcsolat hozzáadása* gombra.
3. Hagyja az irányt *Előd* értéken, ha a másik tevékenység előbb van. Ellenkező esetben válassza az *Utód* lehetőséget.
4. Írjon be a másik tevékenység nevéből egy részletet. A megfelelőt a nyílbillentyűkkel és az Enter billentyűvel válassza ki, vagy kattintson rá.
5. Válassza ki a típust (alapértelmezés szerint FS), és szükség esetén töltse ki a késleltetést.
6. Nyomja meg az Enter billentyűt, vagy kattintson a pipára (*Kapcsolat létrehozása*).

A tevékenység kapcsolatai ekkor a *Kapcsolatok* részben jelennek meg. Mindegyiknél ott van a másik tevékenység WBS-száma, a típus és a késleltetés.

### Kapcsolatok beírása az Elődök oszlopba

Akkor hasznos, ha gyorsan dolgozik a billentyűzettel, és ismeri a WBS-számokat.

1. Kattintson a tevékenységtáblázat fejlécének jobb oldalán lévő **+** jelre (*Oszlop hozzáadása*), és a *Kapcsolatok* alatt válassza az *Elődök* oszlopot. Az *Utódok* oszlop ugyanígy működik.
2. Az *Elődök* oszlopban kattintson az utód cellájára.
3. Írja be az előd WBS-számát, egy szóközt és a típust, például `2.6 FS`. Közvetlenül utána írja be a késleltetést: `2.6 FS+1d`. Több elődöt pontosvesszővel vagy vesszővel válasszon el: `3.1 FS; 3.2 SS+2d`.
4. Nyomja meg az Enter billentyűt.

Amit beír, az egész cellát felülírja. Ha már vannak benne elődök, írja be őket is (lásd a buktatókat). Ha beírás helyett az Enter vagy az F2 billentyűt nyomja meg a cellában, megnyílik egy beviteli mező, amely megtartja a meglévő kapcsolatokat. Ebben tevékenységet keres WBS-szám vagy név alapján, és minden kapcsolathoz kiválasztja a típust és a késleltetést.

### Késleltetés beállítása vagy módosítása

A késleltetést a típus melletti mezőbe írhatja be, a fent felsorolt módok mindegyikével. Meglévő késleltetést a *Kapcsolatok* részben lehet módosítani. Kattintson a késleltetés mezőbe, írja be az új értéket, és nyomja meg az Enter billentyűt.

- `3` vagy `3d`: 3 munkanap. A hétvége nem számít bele. Az alkalmazás `+3d` alakban jeleníti meg.
- `3ed`: 3 naptári nap. A hétvége beleszámít, ahogy a beton is szombaton és vasárnap szilárdul.
- `-1`: negatív késleltetés (átfedés). Az utód egy nappal korábban kezdődhet, így a tevékenységek átfedésbe kerülnek.
- `4h`: 4 munkaóra; az alkalmazás ezt `+4u` alakban jeleníti meg. Ha az előd napalapú tevékenység, és a naptárnak nincsenek saját idősávjai, például a standard naptárnak, az alkalmazás ezt egész munkanapokra váltja át, a legközelebbi egész napra kerekítve: a `4h` ekkor 1 napként, a `2h` 0 napként számít. Ha a naptárnak vannak saját idősávjai, vagy ha az előd óraalapú tevékenység, a késleltetés pontosan órában számít.
- `50%`: az előd időtartamának a fele.

Példa: az alapozóbetonnak meg kell szilárdulnia, mielőtt a falazó rajta dolgozhat. Ezért a *Pour foundation → Foundation brickwork* kapcsolat FS típusú, `3` késleltetéssel. Ha az öntés 2027. június 18., pénteken van, a falazás a **Számítás** után, június 24., csütörtökön kezdődik: hétfőtől szerdáig várakozási idő van. Ha `3ed` értéket ír be, a hétvége beleszámít, és a falazás kedden, június 22-én kezdődik.

### Végül: újraszámítás

Egy új kapcsolat még nem mozgat egyetlen sávot sem. Az állapotsor ezt írja: *Elavult — újraszámítsa (F5)*. Nyomja meg a **Számítás** gombot (F5), például a *Kezdőlap › Ütemezés › Számítás* lehetőségnél. Csak ezután kapják meg az utódok az új dátumukat. Ha azt szeretné, hogy az alkalmazás ezt automatikusan végezze, kapcsolja be az *Automatikus ütemezés-számítás* beállítást a *Beállítások › Projekt › Beállítások* alatt, az *Ütemezés* lapon.

## Buktatók és az alkalmazás viselkedése

**Fordított sorrend.** A *Kijelöltek összekapcsolása* parancsnál a kattintás sorrendje számít, nem a listában lévő sorrend. Ha előbb a későbbi tevékenységre kattint, a kapcsolat fordítva jön létre. Törölje a *Kapcsolatok* részben a kuka ikonnal, majd adja hozzá újra.

**Az oszlopba írás törli, ami ott volt.** Ha a cellában `3.4 FS; 3.2 FS` áll, és csak `3.2 FS` értéket ír be, a 3.4-es kapcsolat figyelmeztetés nélkül megszűnik. Írja be az összes elődöt, az Enter vagy az F2 billentyűvel fűzze hozzájuk a meglévőket, vagy vonja vissza a műveletet a Ctrl+Z billentyűvel.

**Ciklus.** Ha olyan kapcsolatot ad hozzá, amely a lánc egy korábbi tevékenységéhez vezet vissza, az ütemezés soha nem indulhatna el. Az alkalmazás nem fogadja el az ilyen kapcsolatot: *Ez a kapcsolat ciklust hozna létre az ütemezésben (…), ezért nem jött létre*. A zárójelben a ciklus tevékenységei állnak. Törölje először azt a kapcsolatot, amely a ciklust zárja.

**Tevékenység a saját összefoglaló tevékenységével.** Kapcsolat egy tevékenység és az alatta lévő összefoglaló tevékenység között nem lehetséges. Az alkalmazás ezt írja: *Nem engedélyezett kapcsolat egy tevékenység és a saját szülő- vagy nagyszülő-összefoglaló tevékenysége között*.

**Ismétlés.** Ha a kapcsolat már létezik, az alkalmazás ezt írja: *Ez a kapcsolat már létezik*, és semmi sem változik.

**Rövidebb üzenetek az oszlopban.** Az *Elődök* oszlop ugyanazokat az elutasításokat adja, de a cella alatt rövidebb szöveggel: *Ez a módosítás ciklust hozna létre az ütemezésben.*, *Ez a kapcsolat már létezik.* vagy *Egy tevékenységnek nem lehet kapcsolata a saját összefoglaló tevékenységével.* Ha csak WBS-számot ír be, például `3.1`, a típus hiányzik, és a cella ezt írja: *Használjon például ilyen formát: 1.2 FS+2d.* A cella nyitva marad. Javítsa a bevitelt, vagy nyomja meg az Esc billentyűt a megszakításhoz.

**Nincs fél napos késleltetés.** Napban megadott késleltetés mindig egész szám: `1.5` értékből `+2d` lesz. Ha az előd napalapú tevékenység, és a naptárnak nincsenek saját idősávjai, az alkalmazás az órában megadott késleltetést egész munkanapokra kerekíti. Nem értelmezhető bevitelt, például egy szót, az alkalmazás nem ment el: a mező visszaugrik az előző értékre.

## Lásd még

- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): mit számít ki az alkalmazás a kapcsolataiból, és miért lesz egy tevékenység kritikus.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): mit tesz a négy kapcsolattípus és a késleltetés a dátumokkal.
- [Útvonal követése](docs://howto-pad-traceren): az előd- és utódlánc láthatóvá tétele.
- [Tevékenység párbeszédablak és tulajdonságok panel](docs://ref-taak-eigenschappen): a kapcsolatok és a késleltetés mezői a panelen és a párbeszédablakban.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): befejezés-kezdés kapcsolatok egy lánca, egy kezdés-kezdés kapcsolattal (falak és tető, 2 napos késleltetés) és egy befejezés-befejezés kapcsolattal (burkolás és festés, 1 napos késleltetés).
