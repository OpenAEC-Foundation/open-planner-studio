# Rögzített dátumok

Ütemezést nyit meg Primaverából vagy MS Projectből, és a dátumok eltérnek attól, amit abban a programban látott. Elromlott az importálás? Általában nem. Ebben a cikkben megtudhatja, miért újraszámítja magától az alkalmazás a dátumokat, mikor mutatja a fájlban szereplő dátumokat, mi marad ilyenkor üresen, és hogyan tér vissza a saját számításához. A cikk végi példa két tevékenységet követ végig a teljes folyamaton.

## A fogalom

Egy ütemezési fájl kétféle adatot tartalmaz. Először a logikát: tevékenységeket, időtartamokat, kapcsolatokat, naptárakat és korlátozásokat. Másodszor azokat a dátumokat, amelyeket a program maga számított ki ebből. Megnyitáskor az Open Planner Studio a logikát használja, és maga számítja ki a dátumokat. A fájlban lévő dátumok tehát nem bemenő adatok.

Ha a saját számítása a fájlban megadottól eltérő dátumokra jut, nem tudja, melyik oldal a helyes. A fájlból hiányozhat olyan logika, amelyet a másik program ténylegesen használt. A másik program egy ponton eltérően is számíthatott, mint az alkalmazás. Ezért mutathatja az alkalmazás a dátumokat **rögzítve**: azokat a dátumokat, amelyeket a másik program írt a fájlba. Így az abban a programban látottal hasonlíthatja össze.

## Hogyan kezeli ezt az alkalmazás

### Melyik számítási profilt használja az alkalmazás

Az alkalmazás egy **számítási profillal** számol: ez egy számítási szabálykészlet (ütemezési szabályok), amely többek között azt határozza meg, hogyan kezeli a tevékenység tervezett kezdését és a korlátozásokat. Lásd: [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen). Három beépített profil van: *Primavera P6*, *Microsoft Project* és *Open Planner Studio*. Egy `.xer` fájl a *Primavera P6* profillal nyílik meg, egy `.mpp` a *Microsoft Project* profillal. CSV, MS Project XML és Primavera P6 XML az *Open Planner Studio* profillal nyílik meg. Egy projekt profilja a *Fájl › Projektinfó* alatt található, a *Számítási profil és beállítások* résznél. Az alkalmazásból származó IFC-fájl megőrzi a profilját.

### Mikor hasonlít össze az alkalmazás

Megnyitáskor az alkalmazás rögzíti, mit mondott a fájl, és ezt összeveti a saját eredményével. Ezt az alábbiaknál teszi:

- egy Primavera-fájl (`.xer`) és Primavera P6 XML;
- MS Project XML és MS Project-fájlok (`.mpp`);
- egy másik programból származó IFC-fájl, azoknál a tevékenységeknél, amelyeknek korai dátumai a fájlban szerepelnek;
- az alkalmazás saját IFC-fájlja, amely megjegyezte a forrását. Alább megtudhatja, mikor ez a helyzet.

Az alkalmazás soha nem hasonlít össze CSV-fájlt: a CSV kezdési dátuma bemenet, nem számítás eredménye. Az alkalmazás saját IFC-fájlját sem hasonlítja össze, ha nincs megjegyzett forrása.

Ha nincs eltérő tevékenység, nem tapasztal semmi különöset. Ha legalább egy tevékenység eltér az éppen importált fájlban, az alkalmazás azonnal bekapcsolja a nézetet.

Primavera-fájl esetén az alkalmazás a *Primavera P6* számítási profillal számol. Ez a fájlban szereplő tervezett kezdést a legkorábbi kezdésként tartja meg. Az a tevékenység, amely a fájlban a kapcsolatok által megkívántnál későbbre van tervezve, de a fájlban tervezett is, a helyén marad: ilyenkor nincs eltérés.

### Mit lát

A menüszalag alatt egy sáv van: *A dátumokat úgy látja, ahogy azok a fájlban szerepelnek; újraszámításkor 4 tevékenység eltérne*. Primavera-forrás esetén (`.xer` vagy Primavera P6 XML) a sáv ezt írja: *Az ütemezést úgy látja, ahogy a Primavera rögzítette; újraszámításkor 1 tevékenység eltérne*. A sáv jobb oldalán az *Újraszámítás* gomb található. A sávon nincs kereszt.

Van egy üzenet is: *4 tevékenység a fájlban rögzített dátumokat mutatja (nem lett újraszámítva)*. Csak `.xer` esetén ez áll: *1 tevékenység a Primavera által rögzített dátumokat mutatja (nem lett újraszámítva)*. Minden olyan tevékenységnél, amelyhez a fájl dátumokat rögzített, jelölő jelenik meg a *Tulajdonságok* panelen: *A Primavera saját mentett dátumait mutatja ehhez a tevékenységhez* Primavera-forrásnál, vagy *A dátumokat mutatja úgy, ahogy a fájlban szerepelnek ehhez a tevékenységhez* más forrásnál. A Gantt-diagram, a tevékenységtáblázat és az állapotsor a fájlban lévő dátumokat mutatja.

### Mi marad üresen ebben a nézetben

Ebben a nézetben az alkalmazás semmit nem számol ki. Csak azt mutatja, amit a fájl rögzített. Tartalékidőt és kritikus utat tehát csak akkor lát, ha a fájl ezeket tartalmazza. Ha a fájl nem rögzít kritikus tevékenységet, az állapotsor 0 kritikus tevékenységet jelez. Ez semmit nem mond a kritikus útról magában a másik programban. Ami csak számításból jön ki, az ebben a nézetben nem létezik: hogy mely kapcsolatok határozzák meg az ütemezést, a megsértett korlátozások, a sorrendből kieső tevékenységek és a közel kritikus tevékenységek.

Ha a fájl egy tevékenységnél nem rögzít mindent, a *Tulajdonságok* panelen megjelenik ez a jelölő: *A rögzítés részben hiányos — lásd a legkésőbbi és a tartalékidő oszlopokat*. Egy CSV-exportban ilyen tevékenységnél a *Kritikus* és a *Teljes tartalékidő* oszlopok üresen maradnak, és nem jelenik meg kitalált nulla.

### A nézet elhagyása

A nézetet kétféleképpen hagyja el:

- Kattintson a sávban az *Újraszámítás* gombra, vagy válassza a *Számítás* lehetőséget (F5). Az alkalmazás a saját szabályai szerint számol.
- Ha olyasmit módosít, ami változtathat a dátumokon, például egy tevékenység időtartamát vagy egy új tevékenységet, az alkalmazás azonnal elhagyja a nézetet és újraszámít, akkor is, ha az *Automatikus ütemezés-számítás* ki van kapcsolva. Egy név módosítása nem vált ki ezt: a nézet bekapcsolva marad.

A nézet elhagyása után nincs gomb, amellyel visszakapcsolhatja a nézetet. A Ctrl+Z viszont visszahozza, közvetlenül az újraszámítás vagy egy ilyen módosítás után. Egyéb módon újra megnyithatja a forrásfájlt. `.xer` forrás esetén az is visszakapcsolja a nézetet, ha megnyit egy IFC-fájlt, amelyet újraszámítás után mentett, de utána nem szerkesztett.

### Visszaállás összeomlás után

Ha egy projektet összeomlás után állít vissza, amely a nézetben volt, a nézet bekapcsolva marad. Az aktív projekt ugyanazt a sávot mutatja, mint korábban. Egy másik lapon lévő projekt szám nélküli sávot mutat: *A dátumokat úgy látja, ahogy azok a fájlban szerepelnek. Nem történt újraszámítás*. Lásd: [Visszaállás összeomlás után](docs://howto-herstellen-na-een-crash).

### Mentés és újra megnyitás

Ha a nézetben ment, az alkalmazás a megjelenített dátumokat írja az IFC-fájlba, a forrásformátummal együtt. Ha később újra megnyitja ezt az IFC-fájlt, és az importálás óta nem szerkesztette, a nézet ismét be van kapcsolva, új üzenet nélkül.

Ha közben szerkesztett és mentett, ez a forrástól függ. Primavera-fájl esetén az IFC-fájl megtartja az eredeti `.xer` fájlt is. Az alkalmazás ekkor újra összehasonlít, és felajánlja a nézetet: *Az újraszámítás 1 tevékenységet mozdított el a fájlban lévő dátumokhoz képest (összesen 2)*. Ehhez jön a *Rögzített dátumok megjelenítése* gomb és egy kereszt. Minden eltérő tevékenységnél a *Tulajdonságok* panelen megjelenik a jelölő: *Eltér a mentett dátumoktól*. A *Rögzített dátumok megjelenítése* gomb bekapcsolja a nézetet; a Ctrl+Z ezt visszavonja. A kereszt elrejti az ajánlatot.

MS Project XML, `.mpp`, Primavera P6 XML vagy egy másik programból származó IFC-fájl esetén az IFC-fájl nem őrzi meg a forrást. Ha egy ilyen projektet szerkeszt és ment, az alkalmazás újra megnyitáskor már nem hasonlít össze.

## Kidolgozott példa: az épületbővítés

Tegyük fel, hogy megnyit egy *Uitbouw* (épületbővítés) nevű Primavera-fájlt, amely két tevékenységet tartalmaz, ünnepnap nélküli naptáron. 2027-ben május 6. a Mennybemenetel napja, május 17. pedig pünkösdhétfő: ha a naptárban szerepelnek ünnepnapok, a dátumok másként jönnek ki. *Fundering storten* (alapozás betonozása) 5 munkanapig tart, *Metselwerk* (falazás) 10 munkanapig, és a Metselwerk a Fundering után következik, befejezés-kezdés kapcsolattal. A fájl rögzíti, hogy a Fundering 2027. május 3., hétfőtől május 7., péntekig tart, a Metselwerk pedig május 17., hétfőtől 2027. május 28., péntekig: egy héttel a legkorábbi kezdés után, amit a kapcsolat megenged. A Metselwerk tervezett kezdése a fájlban 2027. május 10., hétfő.

Közvetlenül a megnyitás után a fájlban lévő dátumokat látja. Az állapotsor ezt írja: *Befejezés: 28-05-2027* és *Kritikus út: 2 tevékenység, 20 munkanap*. A sáv jelzi, hogy újraszámításkor 1 tevékenység eltér, és mindkét tevékenység mutatja ezt a jelölőt: *A Primavera saját mentett dátumait mutatja ehhez a tevékenységhez*.

Az *Újraszámítás* gombra kattintva a Fundering továbbra is május 3. és 7. között marad. A Metselwerk most hétfőn, május 10-én kezdődik, a Fundering befejezését követő munkanapon, és pénteken, május 21-én fejeződik be. Az ütemezés 2027. május 21-én ér véget, és 15 munkanapot ölel át 20 helyett. A kritikus utat ugyanaz a 2 tevékenység alkotja.

Mi van, ha más a helyzet?

- Ha a Metselwerk a fájlban is hétfő, május 17-én van tervezve, a *Primavera P6* számítási profil megtartja ezt a kezdést. A Metselwerk május 17. és 28. között tart, nincs eltérés, és a nézet nem kapcsol be.
- Ha a nézetben új tevékenységet ad hozzá, ugyanaz az újraszámítás következik be. A Metselwerk május 10. és 21. közé kerül.
- Ha a nézetben ment, majd szerkesztés nélkül újra megnyitja az IFC-fájlt, a Metselwerk ismét május 17. és 28. között van.
- Ha újraszámít, mentés után további szerkesztés nélkül újra megnyitja az IFC-fájlt: a nézet ismét be van kapcsolva, a Metselwerk pedig május 17. és 28. között van.
- Ha szerkeszt, ment, majd újra megnyit: az alkalmazás felajánlja a nézetet ezzel: *Az újraszámítás 1 tevékenységet mozdított el a fájlban lévő dátumokhoz képest (összesen 2)*. A Metselwerk tevékenységen megjelenik a jelölő: *Eltér a mentett dátumoktól*.

## Következmények és félreértések

**Az eltérés nem importálási hiba.** Az alkalmazás a saját szabályai szerint számol: `.xer` esetén a *Primavera P6* számítási profillal, `.mpp` esetén a *Microsoft Project* profillal, CSV, MS Project XML és Primavera P6 XML esetén pedig az *Open Planner Studio* profillal. A forrásban szereplő dátumok eltérésének oka lehet a fájl, de lehet a másik program is. A nézet azt mutatja meg, *hogy* eltérnek.

**A nézet nem számítási eredmény.** Az alkalmazás nem számolta ki a dátumokat. Ne vegye át őket egyszerűen a saját ütemezése eredményeként.

**A nézetben végzett mentés megtartja a forrásprogram dátumait.** Az IFC-fájl ekkor azt tartalmazza, amit a forrásprogram mondott, nem azt, amit az alkalmazás kiszámítana.

**A *Rögzített dátumok megjelenítése* gomb nem jelenik meg minden importálásnál.** Új megnyitásnál a nézet már be van kapcsolva. A gomb csak akkor jelenik meg, ha egy újra megnyitott IFC-fájl forrása Primavera, és az importálás óta szerkesztette.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): mit tart meg az alkalmazás egy fájlban, és mit visz az import vagy export.
- [Primavera P6-fájl (.xer) megnyitása](docs://howto-xer-openen): a lépések és üzenetek egy `.xer` fájlhoz.
- [MS Project-fájl (.mpp) megnyitása](docs://howto-mpp-openen): a lépések és üzenetek egy `.mpp` fájlhoz.
- [Visszaállás összeomlás után](docs://howto-herstellen-na-een-crash): mi történik ezzel a projekttel összeomlás után.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): hogyan számítja ki az alkalmazás a tartalékidőt és a kritikusságot, amikor számol.
