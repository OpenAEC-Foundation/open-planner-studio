# Importálási és exportálási formátumok

Fájlformátumonként: megnyitható-e, menthető-e és exportálható-e, mi megy át és mi nem, és melyik számítási profillal nyílik meg. Az ok és egy példa számokkal a [Fájlok és formátumok](docs://uitleg-bestanden) oldalon található.

## Első pillantásra

**Megnyitás** működik ezekkel: IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` és `.xer`. Egy másik kiterjesztésű fájlt az alkalmazás IFC-ként kezel.

**Mentés** mindig IFC-t ír. Csak egy megnyitott IFC-fájl lesz a mentési cél. Egy másik formátumból megnyitott projektnek megnyitás után nincs fájlja, és ekkor a *Mentés* megkérdezi, hova kell az IFC-fájlt menteni.

**Exportálás** lehetséges ezekbe: IFC 4x3, MS Project XML, Primavera P6 XML, CSV és két előrehaladási lap (Excel és CSV). Az exportálás nem módosítja a projektet.

**Csak olvasható** a `.mpp` és a `.xer`: az alkalmazás meg tudja nyitni őket, de írni nem tudja.

**PDF** csak egy jelentésből készül (lásd: [Jelentés típusai](docs://ref-rapporttypes)). Az alkalmazás nem olvas PDF-et.

**Hol.** Megnyitás: *Kezdőlap › Fájl › Megnyitás*, *Fájl › Megnyitás* vagy Ctrl+O. Exportálás: *Kezdőlap › Fájl › Exportálás* vagy *Fájl › Exportálás*. Egy kitöltött előrehaladási lapot a *Fájl › Importálás* paranccsal lehet beolvasni, vagy a menüszalag *Előrehaladás* csoportjában lévő *Előrehaladás frissítése táblázatból* gombbal, az *Ütemezés*, *Táblázat* és *Jelentés* lapon.

**Számítási profil megnyitáskor.** Minden formátum számítási profillal nyílik meg. Hogy mi ez, azt a [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies) oldal írja le. Az `.xer` a *Primavera P6* profillal, az `.mpp` a *Microsoft Project* profillal, a CSV, az MS Project XML és a P6 XML az *Open Planner Studio* profillal nyílik meg. Az IFC megtartja a fájlban tárolt profilt. Az `.xer` és az `.mpp` esetében az alkalmazás jelzi, hogy a projekt így számítja ki az ütemezést. Csak az IFC tartalmazza a számítási profilt és a számítási beállításokat. A számítási beállítások közül az MS Project XML legfeljebb a kritikus küszöbértéket írja ki. Egy másik formátumba exportált fájl újbóli megnyitása után az alkalmazás az *Open Planner Studio* szerint számol.

## IFC

**Megnyitás** — igen, `.ifc`. Az alkalmazás az IFC 4.3-at olvassa. Számítási profil: a fájlban lévő.

**Mentés** — igen, és ez az egyetlen formátum, amelybe menteni lehet. A *Mentés* a teljes projektet IFC-fájlként menti el. A fájl lesz a mentési cél.

**Exportálás** — igen, mint *IFC 4x3* (a leírása: *BuildingSMART-szabvány. 4D-összekapcsolás BIM-modellekkel.*). Alapértelmezett név: a projekt neve `.ifc` kiterjesztéssel. Ha a projekt egy erőforrástárhoz kapcsolódik, az *Erőforrástár-fájl mentése mellé* jelölőnégyzet a kártyák alatt található a *Fájl › Exportálás* nézetben. Ha be van jelölve, az alkalmazás a projekt után a *projektnév-bibliotheek.ifc* fájl helyét kéri. A jelölőnégyzet nincs benne a *Kezdőlap* lapon lévő listában.

**Mi megy át** — minden, ami a projekthez tartozik: tevékenységek a szerkezetükkel, időtartamukkal, dátumaikkal és előrehaladásukkal; kapcsolatok késleltetéssel; korlátozások és határidők; naptárak; erőforrások és hozzárendelések, az óránkénti eloszlással együtt; alaptervek; tevékenységkódok és egyéni mezők; megjegyzések; projektközi kapcsolatok; szünetek; munkaszabályok és tevékenységtípusok; a projektbeállítások, például az állapotdátum, az előrehaladási mód, a számítási profil és a számítási beállítások; az erőforrástárhoz fűződő kapcsolat. Egy `.xer`-ből származó projekt esetében az eredeti forrásfájl is átmegy. Az egyéni tevékenységtípus IFC-típusként `USERDEFINED` néven tárolódik, a neve az ObjectType mezőben szerepel, így más IFC-programok a tevékenységet rendesen olvassák be. Az alkalmazás a típus rögzített azonosítóját is megőrzi, így az átnevezés nem töri el a kapcsolatot. Ha valaki egy másik számítógépen nyitja meg a fájlt, a típus ott az *Ebből a projektből* csoportban jelenik meg, nem a saját *Saját tevékenységtípusok* csoportjában.

**Mi nem megy át** — a képernyő beállításai (nagyítás, görgetési pozíció, kijelölt tevékenység, összecsukott fázisok, kiválasztott szűrő és csoportosítás) és az alkalmazás beállításai ([Beállítások](docs://ref-instellingen)). Az *IFC* lap a projekt IFC-szövegét mutatja.

## MS Project XML (MSPDI)

**Megnyitás** — igen. Az alkalmazás az `.xml` fájlt MS Project XML-ként ismeri fel a gyökérelem alapján: ez `Project`, az MS Project névtérben (vagy névtér nélkül). Számítási profil: *Open Planner Studio*.

**Mentés** — nem. Egy ilyen projekt nem kap mentési célt.

**Exportálás** — igen, mint *MS Project XML* (*Megnyitható a Microsoft Project-ben. Teljes WBS-szerkezet.*). Alapértelmezett név: a projekt neve `.xml` kiterjesztéssel.

**Mi megy át** — tevékenységek a szerkezetükkel (szint és WBS), időtartammal, dátumokkal és előrehaladással; kapcsolatok késleltetéssel, órában vagy százalékban is; korlátozások, a határidővel együtt; naptárak, a tevékenység- és erőforrásnaptárakkal együtt; erőforrások és hozzárendelések, a görbével vagy az óránkénti eloszlással együtt; az állapotdátum; a kritikus küszöbérték 0 vagy több egész számú munkanapként, a *Teljes tartalékidő ≤ küszöbérték* jelöléssel; a tevékenység leírása megjegyzésként; a tevékenység munkaszabálya MS Project-tevékenységtípusként; egy egyéni tevékenységtípus egy szabad mezőben (`ExtendedAttribute`), amelyet az alkalmazás visszaolvas, és amelyet az MS Project esetleg figyelmen kívül hagy. Az alapterveiből csak az aktív megy át, alapterv 0 néven. Az órában megadott tevékenység megtartja a mértékegységét, a mérföldkő pedig a típusát (kezdés, befejezés vagy automatikus).

**Mi nem megy át** — megjegyzések (a tevékenység ellenőrzőlistája), projektközi kapcsolatok, tevékenységkódok és egyéni mezők, egy második korlátozás, a *Kézzel ütemezett* jelölés, a kiegyenlítési késleltetés, a sorrenden kívüli előrehaladás folytatási és megállási pontja, az MS Project-profil ütemezési szabályai, *A hátralévő munka a már eltelt időtartam után folytatódik* és *Nem elkezdett tevékenységek nem tolódnak az állapotdátumra*, valamint a többi számítási beállítás. A szünetekkel rendelkező tevékenységek óránkénti eloszlás nélkül, a szüneteik nélkül kerülnek át.

**Mi változik útközben** — a *Kötelező kezdés (MSO)* vagy *Kötelező befejezés (MFO)* korlátozás, a *Kötelező (pin-logika)* választás nélkül, *Nem korábban kezdődő (SNET)* vagy *Nem korábban befejeződő (FNET)* lesz. A hangmat normál tevékenység lesz, számított dátumokkal.

## MS Project-fájl (`.mpp`)

**Megnyitás** — igen, az MS Project 2010-től 2021-ig terjedő verzióiból. Számítási profil: *Microsoft Project*. Az alkalmazás csak olvassa a fájlt: az `.mpp`-t soha nem módosítja. Az MS Project 2007-es vagy régebbi fájlt, valamint a jelszóval védett fájlt az alkalmazás elutasítja, egy üzenettel, amely az MS Project XML-exportra mutat.

**Mentés** — nem, és nincs mentési cél: a *Mentés* új IFC-fájlt készít.

**Exportálás** — nem.

**Mi megy át** — tevékenységek a szerkezetükkel, időtartamukkal és korlátozásaikkal; kapcsolatok késleltetéssel; naptárak; erőforrások és hozzárendelések; előrehaladás; egy WBS-kód, amelyet az MS Project-ben kézzel töltöttek ki. Az MS Project által kiszámított dátumokat és tartalékidőt is beolvassa, a *Rögzített dátumok* nézethez.

**Mi nem megy át** — alaptervek, költségek és alapdíjak, megjegyzések és az MS Project egyéni mezői. Lásd: [MS Project-fájl megnyitása (.mpp)](docs://howto-mpp-openen).

**Eredet és licenc** — az `.mpp`-olvasó az Open Planner Studio számára készült, és az MPXJ (`github.com/joniles/mpxj`, Jon Iles és mtsai.) forráskódján és szerkezeti ismeretein alapul. Az MPXJ egy LGPL-2.1 licenc alatt álló Java-csomag. A szerkezet és a mezőkonstansok TypeScriptre lettek átültetve. Az Open Planner Studio maga nyílt forráskódú, LGPL-3.0 licenc alatt. Az `.xer`-olvasó nem származék: az MPXJ-t ott csak megértési forrásként vették figyelembe.

## Primavera P6 XML

**Megnyitás** — igen. Az alkalmazás az `.xml` fájlt P6 XML-ként ismeri fel a gyökérelem `APIBusinessObjects` alapján. Számítási profil: *Open Planner Studio*.

**Mentés** — nem.

**Exportálás** — igen, mint *Primavera P6 XML* (*Oracle Primavera P6-hoz.*). Alapértelmezett név: a projekt neve `.xml` kiterjesztéssel, ugyanaz, mint egy MS Project XML-export neve. Ezért a két fájlt Önnek kell eltérően elneveznie.

**Mi megy át** — WBS-szerkezet és tevékenységek időtartammal, dátumokkal és előrehaladással; kapcsolatok késleltetéssel; korlátozások (egy második is, lágy korlátozásként); naptárak; erőforrások és hozzárendelések; az állapotdátum (`DataDate`-ként); egy egyéni tevékenységtípus saját mezőben, `OPS Custom Task Type` néven, amelyet az alkalmazás visszaolvas, és amelyet a P6 esetleg figyelmen kívül hagy.

**Mi nem megy át** — alaptervek és határidők; tevékenységkódok, egyéni mezők, megjegyzések és projektközi kapcsolatok; a számítási beállítások; egy munkanaptári kivétel (kivétel, amely egy napot munkanappá tesz). A P6-ban nincs százalékos késleltetés: az alkalmazás ezt rögzített számú napra alakítja. A naptári napokban megadott késleltetés munkaidőben megadott késleltetés lesz: 3 naptári nap 3 munkanap lesz. Egy hangmat normál tevékenység lesz, egy kézzel ütemezett tevékenység normál tevékenység lesz, számított dátumokkal, és az egy napnál rövidebb kiegyenlítési késleltetés elvész.

## Primavera-fájl (`.xer`)

**Megnyitás** — igen. Számítási profil: *Primavera P6*. Az alkalmazás csak olvassa a fájlt: `.xer`-t nem ír, és a fájlt soha nem módosítja. Projektenként egy-egy lapot nyit meg, amelyeken tevékenységek vannak. Egy olyan fájlt, amelyben nincs tevékenység, vagy amelynek a táblái sérültek, üzenettel utasít el.

**Mentés** — nem, és nincs mentési cél: a *Mentés* új IFC-fájlt készít, benne az eredeti `.xer`-rel.

**Exportálás** — nem. Ha egy `.xer`-ből származó projektet CSV-be, MS Project XML-be vagy P6 XML-be exportálnak, az alkalmazás jelzi, hogy az XER-forrásinformáció elvész, akkor is, ha a projektet közben IFC-ként mentették. IFC-be nem vész el semmi.

**Mi megy át** — a WBS-szerkezet és a tevékenységek időtartammal, dátumokkal, korlátozásokkal és előrehaladással; kapcsolatok késleltetéssel; naptárak; erőforrások a hozzárendelésekkel; tevékenységkódok; egyéni mezők (UDF-ek); megjegyzések; a P6 ütemezési beállításai. Az *Erőfeszítési szint* típusú tevékenység hangmat lesz. Egy alaptervprojekt a rá hivatkozó projekt aktív alapterve lesz. Két projekt közötti kapcsolatot az alkalmazás forrásadatként megőriz.

**Mi nem megy át** — egy tevékenység nélküli projekt, és két projekt közötti kapcsolat mint valódi kapcsolat az ütemezésben. Lásd: [Primavera P6-fájl megnyitása (.xer)](docs://howto-xer-openen).

## CSV

**Megnyitás** — igen. Az alkalmazás a `;` és a `,` karaktert használja elválasztóként. Az oszlopfejléceket angolul és hollandul ismeri fel (például `Name` vagy `Naam`, `Duration` vagy `Duur`, `Predecessors` vagy `Voorgangers`). A dátumok lehetnek *éééé-hh-nn*, *nn-hh-éééé* vagy *nn/hh/éééé* formátumúak. Az elődöt WBS-kódként, kapcsolattípusként és késleltetésként írja be, például `1.2FS+2d`. Számítási profil: *Open Planner Studio*. A projekt neve *CSV Import*. Egy `Task Type` érték, amely nem az egyik rögzített kód (például `CONSTRUCTION` vagy `INSTALLATION`, amelyeket az alkalmazás maga ír), egyéni tevékenységtípus lesz az *Ebből a projektből* csoportban, nem a *Saját tevékenységtípusok* csoportban. Az `OPS Custom Task Type ID` mezővel megmarad egy egyéni típus azonosítója.

**Mentés** — nem.

**Exportálás** — igen, mint *CSV (;)* (*Általános táblázat-export. Az összes tevékenység dátumokkal és időtartamokkal.*), a *CSV (pontosvesszővel tagolt)* kártyán. A fájl pontosvesszőt használ elválasztóként, UTF-8 kódolású BOM-mal, és angol oszlopfejléceket tartalmaz.

**Mi megy át** — tevékenységenként ezek az oszlopok: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` és `Description`. Az elkészültség egész százalékban van megadva.

**Mi nem megy át** — erőforrások, hozzárendelések, naptárak, korlátozások, határidők, alaptervek és az állapotdátum. Ha a dátumok a *Rögzített dátumok* nézetben vannak, az export üresen hagyja a `Critical` és a `Total Float` oszlopot azoknál a tevékenységeknél, amelyek forrásfájlja ezt nem rögzítette.

## Előrehaladási lap (Excel és CSV)

**Megnyitás** — igen, a *Fájl › Importálás* parancson keresztül (*Előrehaladás frissítése táblázatból*), vagy az ugyanilyen nevű gombbal, az *Előrehaladás* csoportban, az *Ütemezés*, *Táblázat* és *Jelentés* lapon. Az alkalmazás `.xlsx` és `.csv` fájlt olvas, legfeljebb 16 MB-osat és 50 000 sort. Ez nem nyit meg projektet: a megnyitott projekt előrehaladását frissíti. Lásd: [Előrehaladás importálása táblázatból](docs://howto-voortgang-importeren).

**Mentés** — nem.

**Exportálás** — igen, mint *Előrehaladási lap (Excel)* (a listában *Előrehaladás (Excel)*) és *Előrehaladási lap (CSV)* (*Előrehaladás (CSV)*). Alapértelmezett név: *projektnév-voortgang*. Az *Előrehaladási táblázat exportálása* gomb ugyanabban a menüszalag-csoportban egy kattintással elkészíti az Excel-lapot. Az Excel-lapnak rögzített oszlopszélessége, zárolt mezői és dátumellenőrzése van; a CSV-lap ugyanazt a tartalmat tartalmazza, egyszerű szövegként.

**Mi megy át** — ezek az oszlopok: `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` és `Actual Finish`. Beolvasáskor az alkalmazás a `Completion (%)`, `Actual Start` és `Actual Finish` oszlopot használja; a `Start` és a `Finish` csak a dátumformátum felismerésére szolgál, és nem módosítja az ütemezést. Az alkalmazás a sorokat az `OPS Task ID` alapján kapcsolja a tevékenységekhez, különben egyedi WBS-kód alapján.

**Mi nem megy át** — minden, ami ezeken az oszlopokon kívül esik: időtartam, kapcsolatok, erőforrások és az ütemezés többi része. Egy összefoglaló tevékenység nem kap előrehaladást a lapról.

## PDF

**Megnyitás** — nem.

**Mentés** — nem.

**Exportálás** — igen, egy jelentésből: a *Jelentés* lapon a *PDF exportálás* gomb. Az alkalmazás nem küld jelentést közvetlenül nyomtatóra; papírra a PDF-en keresztül jut. A tartalom a jelentés típusától függ: lásd [Jelentés típusai](docs://ref-rapporttypes) és [Jelentés készítése és nyomtatása](docs://howto-rapport-maken-en-afdrukken).

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): miért az IFC a saját formátum, és mit veszít egy exportálás, egy példával.
- [Fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan): a lépések.
- [Exportálás](docs://howto-exporteren): formátum kiválasztása és az exportálás utáni üzenetek.
- [Rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen): miért mutathat egy megnyitott fájl más dátumokat.
- [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies): a számítási profilok.
