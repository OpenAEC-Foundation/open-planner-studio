# Fájlok és formátumok

Mi van valójában abban a fájlban, amelyet ment? És mi történik az ütemezésével, ha egy másik csomagba exportálja? Ebben a cikkben megtudja, hogyan kezeli az alkalmazás a fájlokat: az IFC-t saját formátumként, a többi formátumot átalakítóként, azt, hogy mit hagy ki egy export, és hogy a mentés, az automatikus mentés és a visszaállás összeomlás után miben különbözik. A cikk végi példa számokkal mutatja meg, mit csinál egy export.

## Az alapelv

Az Open Planner Studiónak egy saját fájlformátuma van: az **IFC**, a buildingSMART nyílt cseréformátuma építési információkhoz. Az alkalmazás IFC 4.3 verziót ír. Az exportlistában ez *IFC 4x3* néven szerepel. Nincs második, saját projektfájl. A *Mentés* a teljes projektet IFC-fájlként (`.ifc`) írja ki, a *Megnyitás* pedig ilyen fájlt olvas be. Szeretné látni, mi kerül a fájlba? Az *IFC* lap mutatja a projekt IFC-szövegét. Az *IFC-generálás* frissíti ezt a szöveget.

Minden más formátum **adapter**: átalakító az egyik program modellje és az alkalmazás modellje között. Az alkalmazás olvassa a CSV-t, az MS Project XML-t, a Primavera P6 XML-t, az MS Project-fájlokat (`.mpp`) és a Primavera-fájlokat (`.xer`). Írja a CSV-t, az MS Project XML-t, a Primavera P6 XML-t és két táblázatot az előrehaladásról. Nem exportálhat `.mpp`- vagy `.xer`-formátumba.

Miért számít ez a különbség? Egy átalakító csak azt viheti át, amit mindkét oldal ismer. Az IFC-fájl megőrzi a projekt minden részét, ami a projekthez tartozik. Minden más formátumból hiányzik valami, és az a rész lemarad.

## Hogyan kezeli az alkalmazás a fájlokat

### Mit csinál a megnyitás

Az alkalmazás a fájl végződése alapján választ olvasót: `.ifc`, `.csv`, `.xml`, `.mpp` vagy `.xer`. Egy `.xml`-fájlnál a tartalmát nézi meg, hogy MS Project XML-e vagy Primavera P6 XML-e. Az ismeretlen kiterjesztést IFC-ként kezeli. Ha a fájl nem IFC, az alkalmazás a *A fájl megnyitása sikertelen* üzenetet jeleníti meg az okkal együtt.

Minden fájl saját lapon nyílik meg. Kivétel az a lap, amely még mindig üres és nem módosított: ez a lap átveszi a fájlt. Egyetlen Primavera-fájlból több lap is keletkezhet, mert minden projektnek, amelyben van tevékenység, külön lap jut.

Megnyitás után az alkalmazás mindig újraszámít. Ha a fájl más csomagból származik, a dátumok eltérhetnek attól, amit a fájl mondott. Ezt a [Rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen) cikk írja le.

Csak egy IFC-fájl lesz **mentési célfájl**: az a fájl, amelybe a *Mentés* visszaír. Egy CSV-, XML-, `.mpp`- vagy `.xer`-fájl nem lesz az. Egy ilyen projekthez megnyitás után nincs fájl. A *Mentés* ekkor megkérdezi, hová kell menteni az új IFC-fájlt. Így a Ctrl+S soha nem írja felül az eredeti fájlt IFC-szöveggel.

### Mit ír a mentés

A *Mentés* mindig az egész projektet írja. Ez kerül bele:

- tevékenységek szerkezettel, időtartammal, dátumokkal és előrehaladással;
- kapcsolatok késleltetéssel, korlátozásokkal és határidőkkel;
- naptárak, erőforrások és hozzárendelések, a görbékkel együtt;
- alaptervek, tevékenységkódok, egyéni mezők és megjegyzések;
- projektközi kapcsolatok más projektekhez;
- a projektbeállítások, például az állapotdátum, a számítási profil és a számítási beállítások;
- a hivatkozás egy erőforrástárra.

Amit a képernyőn állít be, nem tartozik a projekthez, és nem kerül bele: a nagyítás, a görgetési pozíció, a kijelölt tevékenység és az összecsukott fázisok. Az alkalmazás-beállítások, például a nyelv és a téma, sincsenek a fájlban. Az alkalmazás ezeket maga tárolja, az alkalmazásban vagy a böngészőben.

Egy exportálás más formátumba nem változtatja meg a projektet. Az export után a projektnek továbbra is ugyanaz a mentési célfájlja van. Ha korábban *Nincs mentve* jelölés volt rajta, az most is látszik.

### Mit hagy ki egy export

Minden átalakító azt viszi át, amit a formátuma ismer.

**MS Project XML** átviszi a tevékenységeket, kapcsolatokat, naptárakat, erőforrásokat, hozzárendeléseket, korlátozásokat, határidőket és az állapotdátumot. Az alaptervekből csak az aktív megy át. A tevékenységkódok, az egyéni mezők, a megjegyzések és a projektközi kapcsolatok nem mennek át. Egy tevékenység második korlátozása nem megy át. Egy *Kötelező kezdés (MSO)* vagy *Kötelező befejezés (MFO)* korlátozás a *Kötelező (pin-logika)* lehetőség nélkül *Nem korábban kezdődő (SNET)*, illetve *Nem korábban befejeződő (FNET)* korlátozásként tér vissza. A *Kézzel ütemezett* beállítás és egy tevékenység *Kiegyenlítési késleltetés* értéke nem tér vissza. Egy hangmat szokásos tevékenységgé válik, kiszámított dátumokkal.

**Primavera P6 XML** átviszi a tevékenységeket, kapcsolatokat, naptárakat, erőforrásokat, hozzárendeléseket, korlátozásokat és az állapotdátumot. Az alaptervek és a határidők nem mennek át, és nem mennek át a tevékenységkódok, az egyéni mezők, a megjegyzések és a projektközi kapcsolatok sem. A hangmat itt is szokásos tevékenységgé válik. A P6-ban nincs százalékos késleltetés: az alkalmazás az ilyen késleltetést fix számú napra alakítja át. A naptári napokban megadott késleltetés munkanapok szerinti késleltetéssé válik.

**CSV** egy tevékenységlista. A fájlban minden tevékenységhez ezek az oszlopok tartoznak: tevékenység-azonosító, WBS, szint, név, időtartam, kezdés, befejezés, elődök, típus, az egyéni tevékenységtípus azonosítója (`OPS Custom Task Type ID`), státusz, elkészültség, tényleges kezdés és befejezés, kritikus, teljes tartalékidő és leírás. Erőforrások, hozzárendelések, naptárak, korlátozások, határidők, alaptervek és az állapotdátum nincs benne. Az oszlopfejlécek mindig angolul vannak.

**Csak az IFC hordozza a számítási profilt és a számítási beállításokat.** Ha CSV-be, MS Project XML-be vagy Primavera P6 XML-be exportál, a profil nincs benne a fájlban. A számítási beállítások közül az MS Project XML legfeljebb a kritikus küszöbértéket írja. Egy ilyen fájl újranyitása *Open Planner Studio* néven nyílik meg. Ha a projekt *Primavera P6* vagy *Microsoft Project* számítással készült, például mert egy `.xer`- vagy `.mpp`-fájlból származik, a dátumok emiatt eltolódhatnak. Hogy mi a számítási profil, azt a [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen) cikk írja le.

Ha a projekt Primavera-fájlból (`.xer`) származik, akkor is, ha közben IFC-ként mentette, az alkalmazás CSV-, MS Project XML- vagy P6 XML-exportálás után ezt az üzenetet jeleníti meg: *A(z) CSV formátumba történő exportáláskor elvesznek a XER-forrásadatok.* MS Project XML esetén az üzenetben *MSPDI* áll a *CSV* helyett. P6 XML esetén *P6* áll. IFC esetén nem kap ilyen üzenetet, mert az IFC-fájl viszi tovább a Primavera forrásfájlját. Lásd: [Primavera P6-fájl (.xer) megnyitása](docs://howto-xer-openen).

Két további dolgot csinál az alkalmazás exportnál. Ha az ütemezés nem naprakész, az alkalmazás előbb újraszámít, és csak utána exportál. Körkörös kapcsolatot tartalmazó ütemezést nem exportál. Ilyenkor a hurkot megnevező üzenetet kap, például: *Körkörös kapcsolat a tevékenységek között: Set up site → Demolish existing extension → Set up site.*

### Mentés, automatikus mentés és visszaállás összeomlás után

Ez három külön dolog. Hasonlítanak egymásra, de máshová írnak.

**Mentés** egy művelet, amelyet Ön végez. Az alkalmazás a projektet a fájlba írja, és eltávolítja a *Nincs mentve* jelölést.

**Automatikus mentés** alapértelmezés szerint ki van kapcsolva. Projektenként Ön kapcsolja be. Az alkalmazás ilyenkor ablak nélkül, ugyanabba a fájlba ír, ha van változás, legfeljebb tíz másodpercenként. Ez csak akkor működik, ha a projektnek már van fájlja. Lásd: [Az automatikus mentés bekapcsolása](docs://howto-automatisch-opslaan).

**Visszaállás összeomlás után** mindig be van kapcsolva. Amint bármiben változás történik, az alkalmazás legfeljebb tíz másodpercenként visszaállítási másolatot tart fenn az összes megnyitott projektről. Ez azokat is magában foglalja, amelyeket Ön nem módosított. A másolat nincs a projektfájlban. Az asztali alkalmazásban az alkalmazás adatmappájában van, a böngészőben a böngésző tárolójában. Az alkalmazás a következő induláskor felajánlja ezt a másolatot. Erről a [Visszaállás összeomlás után](docs://howto-herstellen-na-een-crash) cikkben olvashat. A visszaállás összeomlás után soha nem ír a projektfájlba.

Mivel a másolat legfeljebb tíz másodpercenként készül, összeomláskor az utolsó néhány másodperc munkája elveszhet.

### Asztali gép és böngésző

Az asztali alkalmazás és a böngészőben futó változat ugyanúgy kezeli a projektet, de másképp írja a fájlokat.

Az asztali alkalmazás valódi elérési utakkal dolgozik. A *Mentés* közvetlenül a fájlba ír. Az alkalmazás általában először a mellette lévő ideiglenes fájlba ír (`.ops-save.tmp`), és csak utána cseréli ki a fájlt. Így egy félbeszakadt írás nem csonkítja meg a régi fájlt. Ha változásokkal zárja be az alkalmazást, minden projektnél megkérdezi, akarja-e menteni. Tiszta kilépéskor törli a visszaállítási másolatait.

Olyan böngészőben, amely fájlokat bárhova tud menteni (például Chrome és Edge), a szokásos megnyitási és mentési ablak jelenik meg. Ezután a *Mentés* közvetlenül a fájlba ír. Egy megnyitott fájlnál a böngésző egyszer engedélyt kér. A *Legutóbbi* lista működik, de csak a fájlneveket mutatja.

Olyan böngészőben, amely ezt nem tudja (például Firefox), az alkalmazás a fájlválasztón keresztül nyit meg fájlt, és letöltésként ment. A *Mentés* esetén a *Letöltésként mentve: „name.ifc” a letöltési mappában van. …* üzenet munkamenetenként egyszer magyarázza ezt. A *Mentés másként* és az exportok esetén ezt látja: *Letöltésként mentve: a(z) „name.ifc” most a letöltési mappában van. Ebben a környezetben az alkalmazás nem írhat közvetlenül a kiválasztott helyre.* Ha a böngésző mutat mentési ablakot, de nem tud visszaírni a projekt fájljába, a *Mentés* minden alkalommal új helyet kér. Erről is munkamenetenként egyszer kap üzenetet. A *Fájl › Legutóbbi* ott van, de üres oldalt nyit, és az automatikus mentés nem érhető el. Ugyanezt az üzenetet kapja minden környezetben, amely nem engedi, hogy az alkalmazás abba a helyre írjon, amelyet Ön választott.

## Példa: a példaprojekt exportálása

Vegye a példát, a *Refurbishment & Extension of a Family Home* projektet (*Fájl › Példák*). Ebben 20 tevékenység van, ebből 4 fázis és 2 mérföldkő, továbbá 16 kapcsolat. Van 6 erőforrás 8 hozzárendeléssel, 1 alapterv, és egy hivatkozás a *Demo resource library* erőforrástárra. A *Demolish existing extension* tevékenységen a *Nem korábban kezdődő (SNET)* korlátozás van, 2027. május 14-ére. A *Handover inspection* tevékenységen 2027. július 29-i határidő van. Az ütemezés 2027. július 7-én ér véget.

Így jön vissza a projekt minden formátumból, az exportfájl újbóli megnyitása után mérve:

- Az IFC-fájl mindent visszaad: 20 tevékenységet, 16 kapcsolatot, 6 erőforrást, 8 hozzárendelést, az alaptervet, a korlátozást, a határidőt és a hivatkozást az erőforrástárra. Az ütemezés újra 2027. július 7-én ér véget.
- Az MS Project XML-fájl is mindent visszaad, a hivatkozást az erőforrástárra kivételével. Az ütemezés 2027. július 7-én ér véget.
- A P6 XML-fájl visszaadja a tevékenységeket, a kapcsolatokat, az erőforrásokat, a hozzárendeléseket és a korlátozást. Az alapterv és a határidő hiányzik. Az ütemezés továbbra is 2027. július 7-én ér véget, mert a korlátozás még benne van.
- A CSV-fájl 20 tevékenységet és 16 kapcsolatot ad vissza. Az erőforrások, a hozzárendelések, az alapterv, a korlátozás és a határidő hiányzik, a projekt neve pedig *CSV Import*. A korlátozás nélkül a munka előbbre kerül: az ütemezés 2027. július 2-án ér véget, öt naptári nappal korábban.

A korlátozás nélkül maga a példa is 2027. július 2-án ér véget. A különbség tehát a korlátozásból adódik, amelyet a CSV-fájl nem hordoz.

## Következmények és félreértések

**Egy export nem biztonsági mentés.** Csak az IFC őriz meg mindent. Ha meg akarja őrizni a projektet, mentse IFC-ként. Exportáljon csak akkor, ha valakinek más formátum kell.

**Egy exportfájl újbóli megnyitása nem mindig ad ugyanazt az ütemezést.** Az alkalmazás megnyitáskor mindig újraszámít, a formátumhoz tartozó számítási profillal. Ha hiányzik a logika, mint a CSV-példában a korlátozás, vagy ha a profil másként számít, az eredmény megváltozik.

**Egy export is ott van a *Legutóbbi* listában.** Az asztali alkalmazásban és a fájlhozzáférésű böngészőkben az export ugyanúgy a *Legutóbbi* listába kerül, mint egy mentett projekt. Az előrehaladási táblázatok viszont nem. Ha onnan nyitja meg, az adott formátum importjaként nyílik meg.

**A mentés nem azonos a visszaállással összeomlás után.** A visszaállás összeomlás után segít, de nem helyettesíti a mentést. Ezért mentsen, mielőtt lapot vagy az alkalmazást bezárja.

## Lásd még

- [Fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan): a lépések a megnyitáshoz, a mentéshez és a mentés másként művelethez.
- [Exportálás](docs://howto-exporteren): formátum kiválasztása és az, amit kap.
- [Rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen): miért mutathat egy importált ütemezés más dátumokat.
- [Korlátozások és határidők](docs://uitleg-constraints): mit csinál egy korlátozás, és mi tűnik el, ha hiányzik.
- [Kapcsolatok és késleltetés](docs://uitleg-relaties): mi a késleltetés, és hogyan számítja ki az alkalmazás.
- [Hangmat létrehozása](docs://howto-hammock): mi a hangmat, és amit egy export szokásos tevékenységként ír ki.
- [Kódok és egyéni mezők](docs://howto-codes-en-velden): a tevékenységkódok és az egyéni mezők, amelyeket csak az IFC őriz meg.
- [Projektközi kapcsolatok egy másik projekthez](docs://howto-externe-relaties): hivatkozások, amelyeket az MS Project XML és a P6 XML nem visz át.
- [Alapterv mentése és kezelése](docs://howto-baseline-opslaan-en-beheren): alaptervek; ezek közül az MS Project XML csak az aktívat viszi át.
- [Import- és exportformátumok](docs://ref-import-exportformaten): formátumonként, mi kerül át és mi nem.
