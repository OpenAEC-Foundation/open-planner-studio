# Rögzített dátumok

Ütemezést nyit meg Primaverából vagy MS Projectből, és a dátumok eltérnek attól, amit abban a programban látott. Elromlott az importálás? Általában nem. Ebben a cikkben megtudhatja, miért újraszámítja magától az alkalmazás a dátumokat, mikor mutatja a fájlban szereplő dátumokat, mi marad ilyenkor üresen, és hogyan tér vissza a saját számításához. A cikk végi példa két tevékenységet követ végig a teljes folyamaton.

## A fogalom

Egy ütemezési fájl kétféle adatot tartalmaz. Először a logikát: tevékenységeket, időtartamokat, kapcsolatokat, naptárakat és korlátozásokat. Másodszor azokat a dátumokat, amelyeket a program maga számított ki ebből. Megnyitáskor az Open Planner Studio a logikát használja, és maga számítja ki a dátumokat. A fájlban lévő dátumok tehát nem bemenő adatok.

Ha a saját számítása a fájlban megadottól eltérő dátumokra jut, nem tudja, melyik oldal a helyes. A fájlból hiányozhat olyan logika, amelyet a másik program ténylegesen használt. A másik program egy ponton eltérően is számíthatott, mint az alkalmazás. Ezért mutathatja az alkalmazás a dátumokat **rögzítve**: azokat a dátumokat, amelyeket a másik program írt a fájlba. Így az abban a programban látottal hasonlíthatja össze.

## Hogyan kezeli ezt az alkalmazás

### Melyik számítási profilt használja az alkalmazás

Az alkalmazás **számítási profillal** számol: ez egy számítási szabálykészlet (ütemezési szabályok), amely többek között azt határozza meg, hogyan kezeli a tevékenység tervezett kezdését és a korlátozásokat. Lásd: [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen). Három beépített profil van: *Primavera P6*, *Microsoft Project* és *Open Planner Studio*. Egy `.xer` a *Primavera P6* profillal nyílik meg, egy `.mpp` a *Microsoft Project* profillal. A CSV, az MS Project XML és a Primavera P6 XML az *Open Planner Studio* profillal nyílik meg. Egy projekt profilja a *Fájl › Projektbeállítások* menüpontban található, a *Számítási profil és beállítások* résznél. Az alkalmazásból származó IFC-fájl megőrzi a profilját.

### Mikor hasonlít össze az alkalmazás

Megnyitáskor az alkalmazás rögzíti, mit mondott a fájl, és összeveti ezt a saját eredményével. Ezt az alábbiaknál teszi:

- egy Primavera-fájl (`.xer`) és Primavera P6 XML;
- MS Project XML és MS Project-fájlok (`.mpp`);
- egy másik programból származó IFC-fájl, azoknál a tevékenységeknél, amelyeknek korai dátumai a fájlban szerepelnek;
- az alkalmazás saját IFC-fájlja, amely megjegyezte a forrását. Alább megtudhatja, mikor ez a helyzet.

Az alkalmazás soha nem hasonlít össze CSV-fájlt: a CSV kezdési dátuma bemenet, nem számítás eredménye. Az alkalmazás saját IFC-fájlját sem hasonlítja össze, ha nincs megjegyzett forrása.

Ha nincs eltérő tevékenység, nem tapasztal semmi különöset. Ha legalább egy tevékenység eltér az éppen importált fájlban, az alkalmazás azonnal bekapcsolja a nézetet.

Primavera-fájl esetén az alkalmazás a *Primavera P6* számítási profillal számol. Ez a fájlban szereplő tervezett kezdést a legkorábbi kezdésként tartja meg. Az a tevékenység, amely a fájlban a kapcsolatok által megkívántnál későbbre van tervezve, de a fájlban tervezett is, a helyén marad: ilyenkor nincs eltérés.

### Mit lát

A menüszalag alatt egy sáv van: *A dátumokat úgy látja, ahogy azok a fájlban szerepelnek; újraszámításkor 4 tevékenység eltérne.* Primavera-forrás esetén (`.xer` vagy Primavera P6 XML) a sáv ezt írja: *Az ütemezést úgy látja, ahogy a Primavera rögzítette; újraszámításkor 1 tevékenység eltérne.* A sáv jobb oldalán az *Újraszámítás* gomb található. A sávon nincs kereszt.

Van egy üzenet is: *12 tevékenység a fájlban rögzített dátumokat mutatja (nem lett újraszámítva).* Csak `.xer` esetén ez áll: *12 tevékenység a Primavera által rögzített dátumokat mutatja (nem lett újraszámítva).* Ez a szám minden olyan tevékenységet számol, amelyhez a fájl dátumokat rögzített, beleértve azokat is, amelyek nem térnek el. Az újraszámítás után eltérő tevékenységek száma a sávban látható. Minden olyan tevékenységnél, amelyhez a fájl dátumokat rögzített, a *Tulajdonságok* panelen, közvetlenül a *Kezdés* fölött, narancssárga jelölő jelenik meg: *A Primavera által mentett dátumokat látja, nem az alkalmazás számítását.* Más forrásnál ez áll: *A fájlban szereplő dátumokat látja, nem az alkalmazás számítását.* Egy második sor azt mondja, mi történik ezzel a tevékenységgel újraszámításkor: *Újraszámításkor ez a tevékenység megváltozik.* vagy *Újraszámításkor ez a tevékenység változatlan marad.* A Gantt-diagram, a tevékenységtáblázat és az állapotsor a fájlban lévő dátumokat mutatja.

### Tevékenységek, amelyek elkezdődtek vagy befejeződtek

Egy befejezett tevékenység azokon a napokon van, amikor ténylegesen zajlott: a tényleges kezdéstől a tényleges befejezésig. Egy folyamatban lévő tevékenység azon a napon kezdődik, amikor ténylegesen elkezdődött. A befejezése a kiszámított befejezés. Ez a nézetben, újraszámítás után és minden számítási profil mellett érvényes, ahogy a Primavera és az MS Project esetén is.

Ilyen tevékenységnél a fájl gyakran más korai dátumokat rögzít. A Primavera a folyamatban lévő vagy befejezett tevékenység korai kezdését az állapotdátumra teszi. Ezeket a dátumokat a *Korai kezdés* és a *Korai befejezés* oszlopokban látja, nem a *Kezdés* és a *Befejezés* oszlopokban. Egy befejezett tevékenység ezért soha nem számít eltérésnek. Egy folyamatban lévő tevékenység csak akkor számít, ha a befejezése eltér.

Egy elkezdődött tevékenységnél már nem írhatja be a kezdést. A tevékenységtáblázatban, a *Tulajdonságok* panelen és a *Tevékenység szerkesztése* ablakban a kezdés ekkor csak olvasható. Egy befejezett tevékenységnél ez a befejezésre is vonatkozik a tevékenységtáblázatban. Ehelyett az előrehaladással együtt módosítsa a *Tényleges kezdés* vagy a *Tényleges befejezés* mezőt. A Gantt-diagramban az ilyen tevékenység sávja nem mozdul el; ilyenkor üzenet jelenik meg.

### Mi marad üresen ebben a nézetben

Ebben a nézetben az alkalmazás semmit nem számol ki. Csak azt mutatja, amit a fájl rögzített. Tartalékidőt és kritikus utat tehát csak akkor lát, ha a fájl ezeket tartalmazza. Ha a fájl nem rögzít kritikus tevékenységet, az állapotsor 0 kritikus tevékenységet jelez. Ez a forrásfájl saját kritikus útjáról semmit nem mond. Ami csak számításból jön ki, az ebben a nézetben nem létezik: hogy mely kapcsolatok határozzák meg az ütemezést, a megsértett korlátozások, a sorrendből kieső tevékenységek és a közel kritikus tevékenységek.

Ha a fájl egy tevékenységnél nem rögzít mindent, a *Tulajdonságok* panelen lévő narancssárga jelölő harmadik sort kap, például: *A Primavera nem mentett el mindent ehhez a tevékenységhez. Hiányzik: szabad tartalékidő.* Más forrásnál ez áll: *A fájl nem tartalmaz mindent ehhez a tevékenységhez.* Az első két sor megmarad: így egy ilyen tevékenységnél is látja, hogy a dátumok a fájlból származnak, és hogy a tevékenység változik-e újraszámításkor. A hiányzó értékek neve megegyezik a tevékenységtáblázat oszlopainak nevével. CSV-exportban egy ilyen tevékenységnél a *Kritikus* és a *Teljes tartalékidő* oszlopok üresen maradnak, és nem jelenik meg kitalált nulla.

### A nézet elhagyása

A nézetet kétféleképpen hagyja el:

- Kattintson a sávban az *Újraszámítás* gombra, vagy válassza a *Számítás* lehetőséget (F5). Az alkalmazás a saját szabályai szerint számol.
- Módosítson olyasmit, ami megváltoztathatja a dátumokat, például egy tevékenység időtartamát vagy egy új tevékenységet. Az alkalmazás elhagyja a nézetet, és azonnal újraszámít, akkor is, ha az *Automatikus ütemezés-számítás* ki van kapcsolva. A név, a leírás, a munkanem vagy a tevékenységtípus módosítása nem vált ki ezt: a nézet bekapcsolva marad.

Az erőforrástárból érkező naptármódosítás bekapcsolva hagyja a nézetet és a fájl dátumait, de frissíti a sávban látható számot.

A nézet elhagyása után nincs gomb, amellyel visszakapcsolhatja a nézetet. A Ctrl+Z viszont visszahozza, közvetlenül az újraszámítás vagy egy ilyen módosítás után. Egyéb esetben újra megnyithatja a forrásfájlt. `.xer` forrás esetén az is visszakapcsolja a nézetet, ha megnyit egy olyan IFC-fájlt, amelyet újraszámítás után mentett, de utána nem szerkesztett.

### Visszaállás összeomlás után

Ha olyan projektet állít vissza összeomlás után, amely a nézetben volt, a nézet bekapcsolva marad. Ha a nézet ki volt kapcsolva, az alkalmazás elfelejti a fájlból származó dátumokat. Az aktív projekt ugyanazt a sávot mutatja, mint korábban. Egy másik lapon lévő projekt szám nélküli sávot mutat: *A dátumokat úgy látja, ahogy azok a fájlban szerepelnek. Nem történt újraszámítás.* Lásd: [Visszaállás összeomlás után](docs://howto-herstellen-na-een-crash).

### Mentés és újra megnyitás

Ha a nézetben ment, az alkalmazás a megjelenített dátumokat írja az IFC-fájlba, a forrásformátummal együtt. Ha később újra megnyitja ezt az IFC-fájlt, a nézet ismét be van kapcsolva, új üzenet nélkül. Ez akkor is igaz, ha a nézetben olyasmit módosított, ami nem befolyásolja a dátumokat, például egy nevet. Az alkalmazás úgy nyitja meg a fájlt, ahogy elhagyta.

Ha újraszámítással vagy olyan módosítással hagyta el a nézetet, amely megváltoztathatja a dátumokat, és utána ment, a fájl az alkalmazás saját számítását tartalmazza. Újra megnyitáskor ezt a számítást látja, sáv és a *Tulajdonságok* panelen lévő jelölő nélkül. Van egy kivétel: egy `.xer`, amelyet csak újraszámított, de nem szerkesztett (lásd fent). A szerkesztett ütemezése most már maga az ütemezés; a forrásfájl régi dátumai már nem tartoznak hozzá. Ha továbbra is látni szeretné őket, nyissa meg újra a forrásfájlt.

## Kidolgozott példa: az épületbővítés

Tegyük fel, hogy megnyit egy *Uitbouw* (épületbővítés) nevű Primavera-fájlt, amely két tevékenységet tartalmaz, ünnepnap nélküli naptáron. 2027-ben május 6. a Mennybemenetel napja, május 17. pedig pünkösdhétfő: ha a naptárban szerepelnek ünnepnapok, a dátumok másként jönnek ki. *Fundering storten* (alapozás betonozása) 5 munkanapig tart, *Metselwerk* (falazás) 10 munkanapig, és a Metselwerk a Fundering után következik, befejezés-kezdés kapcsolattal. A fájl rögzíti, hogy a Fundering 2027. május 3., hétfőtől május 7., péntekig tart, a Metselwerk pedig május 17., hétfőtől 2027. május 28., péntekig: egy héttel a legkorábbi kezdés után, amit a kapcsolat megenged. A Metselwerk tervezett kezdése a fájlban 2027. május 10., hétfő.

Közvetlenül a megnyitás után a fájlban lévő dátumokat látja. Az állapotsor ezt írja: *Befejezés: 28-05-2027* és *Kritikus út: 2 tevékenység, 20 munkanap*. A sáv jelzi, hogy újraszámításkor 1 tevékenység eltér. Mindkét tevékenység mutatja a narancssárga jelölőt: *A Primavera által mentett dátumokat látja, nem az alkalmazás számítását.* Alatta a Metselwerknél ez áll: *Újraszámításkor ez a tevékenység megváltozik.* A Funderingnél pedig: *Újraszámításkor ez a tevékenység változatlan marad.*

Az *Újraszámítás* gombra kattintva a Fundering továbbra is május 3. és 7. között marad. A Metselwerk most hétfőn, május 10-én kezdődik, a Fundering befejezését követő munkanapon, és pénteken, május 21-én fejeződik be. Az ütemezés 2027. május 21-én ér véget, és 20 helyett 15 munkanapot ölel át. A kritikus utat ugyanaz a 2 tevékenység alkotja.

Mi van, ha más a helyzet?

- Ha a Metselwerk a fájlban is hétfő, május 17-én van tervezve, a *Primavera P6* számítási profil megtartja ezt a kezdést. A Metselwerk május 17. és 28. között tart, nincs eltérés, és a nézet nem kapcsol be.
- Ha a nézetben új tevékenységet ad hozzá, ugyanaz az újraszámítás következik be. A Metselwerk május 10. és 21. közé kerül.
- Ha a nézetben ment, majd szerkesztés nélkül újra megnyitja az IFC-fájlt, a Metselwerk ismét május 17. és 28. között van.
- Ha újraszámít, mentés után további szerkesztés nélkül újra megnyitja az IFC-fájlt: a nézet ismét be van kapcsolva, a Metselwerk pedig május 17. és 28. között van.
- Ha a nézetben csak a Metselwerk nevét módosítja, ment, majd újra megnyitja: a nézet ismét be van kapcsolva, a Metselwerk pedig május 17. és 28. között van.
- Ha a nézetben új tevékenységet ad hozzá, ment, majd újra megnyitja: az alkalmazás elfelejti a fájlból származó dátumokat. A Metselwerk május 10. és 21. között van, sáv és jelölő nélkül.
- A Fundering a fájl szerint már befejezett: ténylegesen május 3-án kezdődött és május 7-én fejeződött be. A fájl az állapotdátumot rögzíti korai kezdésként. A Fundering sávja a nézetben és újraszámítás után továbbra is május 3. és 7. között van. A Fundering nem számít eltérésnek.

## Következmények és félreértések

**Az eltérés nem importálási hiba.** Az alkalmazás a saját szabályai szerint számol: `.xer` esetén a *Primavera P6* számítási profillal, `.mpp` esetén a *Microsoft Project* profillal, CSV, MS Project XML és Primavera P6 XML esetén az *Open Planner Studio* profillal. A forrásfájlban szereplő dátumok eltérésének oka lehet a fájl, de lehet a másik program is. A nézet azt mutatja meg, *hogy* eltérnek.

**A nézet nem számítási eredmény.** Az alkalmazás nem számolta ki a dátumokat. Ne vegye át őket egyszerűen a saját ütemezése eredményeként.

**A nézetben végzett mentés megtartja a forrásfájl dátumait.** Az IFC-fájl ekkor azt tartalmazza, amit a forrásfájl mondott, nem azt, amit az alkalmazás kiszámítana.

**Egy dátumokat megváltoztató módosítás után a fájl dátumai nem jönnek vissza.** Ha ilyen módosítással hagyta el a nézetet, mentés és újra megnyitás után csak az alkalmazás saját számítását látja. Egy név módosítása nem számít: ekkor a nézet bekapcsolva marad (lásd *Mentés és újra megnyitás*). Ha látni szeretné a forrásfájl dátumait, nyissa meg újra a forrásfájlt.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): mit tart meg az alkalmazás egy fájlban, és mit visz az import vagy export.
- [Primavera P6-fájl (.xer) megnyitása](docs://howto-xer-openen): a lépések és üzenetek egy `.xer` fájlhoz.
- [MS Project-fájl (.mpp) megnyitása](docs://howto-mpp-openen): a lépések és üzenetek egy `.mpp` fájlhoz.
- [Visszaállás összeomlás után](docs://howto-herstellen-na-een-crash): mi történik ezzel a projekttel összeomlás után.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): hogyan számítja ki az alkalmazás a tartalékidőt és a kritikusságot, amikor számol.
