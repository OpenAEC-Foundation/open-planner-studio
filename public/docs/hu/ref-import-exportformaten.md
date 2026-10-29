# Importálási és exportálási formátumok

Fájlformátumonként: megnyitható-e, menthető-e és exportálható-e, mi megy át és mi nem, és melyik számítási profillal nyílik meg. Az ok és egy példa számokkal a [Fájlok és formátumok](docs://uitleg-bestanden) oldalon található.

## Első pillantásra

**Megnyitás** működik ezekkel: IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` és `.xer`. Egy másik kiterjesztésű fájlt az alkalmazás IFC-ként kezel.

**Mentés** mindig IFC-t ír. Csak egy megnyitott IFC-fájl lesz a mentési cél. Egy másik formátumból megnyitott projektnek megnyitás után nincs fájlja, és ekkor a *Mentés* megkérdezi, hova kell az IFC-fájlt menteni.

**Exportálás** lehetséges ezekbe: IFC, MS Project XML, Primavera P6 XML, CSV és két előrehaladási lap (Excel és CSV). Az exportálás nem módosítja a projektet.

**Csak olvasható** a `.mpp` és a `.xer`: az alkalmazás meg tudja nyitni őket, de írni nem tudja.

**PDF** csak egy jelentésből készül (lásd: [Jelentés típusai](docs://ref-rapporttypes)). Az alkalmazás nem olvas PDF-et.

**Hol.** Megnyitás: *Kezdőlap › Fájl › Megnyitás*, *Fájl › Megnyitás* vagy Ctrl+O. Exportálás: *Kezdőlap › Fájl › Exportálás* vagy *Fájl › Exportálás*. Egy kitöltött előrehaladási lapot a *Fájl › Importálás* paranccsal lehet beolvasni, vagy a menüszalag *Előrehaladás* csoportjában lévő *Előrehaladás frissítése táblázatból* gombbal, az *Ütemezés*, *Táblázat* és *Jelentés* lapon.

**Számítási profil megnyitáskor.** Minden formátum számítási profillal nyílik meg. Hogy mi ez, azt a [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies) oldal írja le. Az `.xer` a *Primavera P6* profillal, az `.mpp` a *Microsoft Project* profillal, a CSV, az MS Project XML és a P6 XML az *Open Planner Studio* profillal nyílik meg. Az IFC megtartja a fájlban tárolt profilt. Az `.xer` és az `.mpp` esetében az alkalmazás jelzi, hogy a projekt így számítja ki az ütemezést. Csak az IFC tartalmazza a számítási profilt és a számítási beállításokat. A számítási beállítások közül az MS Project XML legfeljebb a kritikus küszöbértéket írja ki. Egy másik formátumba exportált fájl újbóli megnyitása után az alkalmazás az *Open Planner Studio* szerint számol.

## IFC

**Megnyitás** — igen, `.ifc`. Az alkalmazás az IFC4-et és az IFC 4.3-at olvassa (az ADD2-t is). Egy másik sémájú fájl, például IFC2X3, szintén megnyílik. Az első mentéskor ezután olyan sémát választ, amelyet az alkalmazás tud írni (lásd: [Az IFC-séma kiválasztása](docs://howto-ifc-schema-kiezen)). Számítási profil: a fájlban lévő.

**Mentés** — igen, és ez az egyetlen formátum, amelybe menteni lehet. A *Mentés* a teljes projektet IFC-fájlként menti el, a projekt IFC-sémájában (alapértelmezés szerint IFC 4.3 ADD2). A fájl lesz a mentési cél.

**Exportálás** — igen, mint *IFC*, a projekt IFC-sémájában (alapértelmezés: IFC 4.3 ADD2). Alapértelmezett név: a projekt neve `.ifc` kiterjesztéssel. Ha a projekt erőforrástárhoz kapcsolódik, az *Erőforrástár-fájl mentése mellé* jelölőnégyzet a kártyák alatt található a *Fájl › Exportálás* nézetben. Ha be van jelölve, az alkalmazás a projekt után a *projectname-bibliotheek.ifc* fájl helyét kéri. A jelölőnégyzet nincs benne a *Kezdőlap* lapon lévő listában.

**Mi megy át** — minden, ami a projekthez tartozik: tevékenységek a szerkezetükkel, időtartamukkal, dátumaikkal és előrehaladásukkal; kapcsolatok késleltetéssel; korlátozások és határidők; naptárak; erőforrások és hozzárendelések, az óránkénti eloszlással együtt; alaptervek; tevékenységkódok és egyéni mezők; megjegyzések; projektközi kapcsolatok; szünetek; tevékenységtípusok és egyéni munkanemek; a projektbeállítások, például az állapotdátum, az előrehaladási mód, a számítási profil és a számítási beállítások; az erőforrástárral való kapcsolat. Egy `.xer`-ből származó projekt esetében az eredeti forrásfájl is átmegy. Az egyéni munkanem IFC-ben `USERDEFINED` típusként tárolódik, a neve az ObjectType mezőben szerepel, így más IFC-programok a tevékenységet rendesen olvassák be. Az alkalmazás a munkanem rögzített azonosítóját is megőrzi, így az átnevezés nem töri el a kapcsolatot. Ha valaki egy másik számítógépen nyitja meg a fájlt, a munkanem ott az *Ebből a projektből* csoportban jelenik meg, nem a saját *Saját munkanemek* csoportjában.

**Mi nem megy át** — a képernyő beállításai (nagyítás, görgetési pozíció, kijelölt tevékenység, összecsukott fázisok, kiválasztott szűrő és csoportosítás) és az alkalmazás beállításai ([Beállítások](docs://ref-instellingen)). Az *IFC* lap a projekt IFC-szövegének szerkesztője. Az *IFC-generálás* frissíti a szöveget, a *Másolás* a vágólapra másolja, az *Alkalmazás* pedig a szöveget projektként betölti, és a projektet ezen a lapon lecseréli.

## MS Project XML (MSPDI)

**Megnyitás** — igen. Az alkalmazás az `.xml` fájlt MS Project XML-ként ismeri fel a gyökérelem alapján: ez `Project`, az MS Project névtérben (vagy névtér nélkül). Számítási profil: *Open Planner Studio*. Megnyitás után az alkalmazás egy üzenetben közli, mit nem vett át; lásd: [MS Project-fájl megnyitása (.mpp)](docs://howto-mpp-openen).

**Mentés** — nem. Ilyen projekt nem kap mentési célt.

**Exportálás** — igen, mint *MS Project XML* (*Megnyitható a Microsoft Project-ben. Teljes WBS-szerkezet.*). Alapértelmezett név: a projekt neve `.xml` kiterjesztéssel.

**Mi megy át** — tevékenységek a szerkezetükkel (szint és WBS), időtartammal, dátumokkal és előrehaladással; kapcsolatok késleltetéssel, órában vagy százalékban is; korlátozások, a határidővel együtt; naptárak, a tevékenység- és erőforrásnaptárakkal együtt; erőforrások és hozzárendelések, a görbével vagy az óránkénti eloszlással együtt; az állapotdátum; a kritikus küszöbérték 0 vagy több egész számú munkanapként, a *Teljes tartalékidő ≤ küszöbérték* jelöléssel; a tevékenység leírása megjegyzésként; a tevékenységtípus, mint MS Project-tevékenységtípus; egy egyéni munkanem egy szabad mezőben (`ExtendedAttribute`), amelyet az alkalmazás visszaolvas, és amelyet az MS Project esetleg figyelmen kívül hagy. Az alapterveiből csak az aktív megy át, alapterv 0 néven. Az órában megadott tevékenység megtartja a mértékegységét, a mérföldkő pedig a típusát (kezdés, befejezés vagy automatikus).

**Mi nem megy át** — megjegyzések (a tevékenység ellenőrzőlistája), projektközi kapcsolatok, tevékenységkódok és egyéni mezők, egy második korlátozás, a *Kézzel ütemezett* jelölés, a kiegyenlítési késleltetés, a sorrenden kívüli előrehaladás folytatási és megállási pontja, az MS Project-profil ezen ütemezési szabályai: *A hátralévő munka a már eltelt időtartam után folytatódik* és *Nem elkezdett tevékenységek nem tolódnak az állapotdátumra*, valamint a többi számítási beállítás. A szünetekkel rendelkező tevékenységek óránkénti eloszlás nélkül, a szüneteik nélkül kerülnek át.

**Ünnepnapok megnyitáskor.** A származtatott naptár örökli az alapnaptárának kivételeit. Egy naptár, amelynek saját munkahete van és nincs kivétele, nem kap ünnepnapot. Csak olyan naptár tartja meg a szokásos holland ünnepnapokat, amelynek nincs alapnaptára, munkahete vagy kivétele. Ha ünnepnapok hiányoznak, a befejezési dátum eltérhet: lásd: [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren).

**Mi változik útközben** — egy *Kötelező kezdés (MSO)* vagy *Kötelező befejezés (MFO)* korlátozás, a *Kötelező (pin-logika)* választás nélkül, *Nem korábban kezdődő (SNET)* vagy *Nem korábban befejeződő (FNET)* lesz. Egy hangmat normál tevékenység lesz, számított dátumokkal. Az MS Project XML csak a projektnaptár napi óráit tárolja. Megnyitáskor egy másik, saját napi órákkal rendelkező naptár a munkaidejét napi órákként kapja meg: 8 óra naponta, 10 órás munkaidő mellett, 10 lesz. Egy ilyen naptáron a napokban megadott tevékenység ezért rövidebb lesz, például 4 nap az 5 nap helyett.

## MS Project-fájl (`.mpp`)

**Megnyitás** — igen, az MS Project 2010-től 2021-ig terjedő verzióiból. Számítási profil: *Microsoft Project*. Az alkalmazás csak olvassa a fájlt: az `.mpp`-t soha nem módosítja. Az MS Project 2007-es vagy régebbi fájlt, valamint a jelszóval védett fájlt az alkalmazás elutasítja, egy üzenettel, amely az MS Project XML-exportra mutat. Megnyitás után az alkalmazás egy üzenetben közli, mit nem vett át.

**Mentés** — nem, és nincs mentési cél: a *Mentés* új IFC-fájlt készít.

**Exportálás** — nem.

**Mi megy át** — tevékenységek a szerkezetükkel, időtartamukkal és korlátozásaikkal; kapcsolatok késleltetéssel; naptárak; erőforrások és hozzárendelések; előrehaladás; egy WBS-kód, amelyet az MS Project-ben kézzel töltöttek ki. Az MS Project által kiszámított dátumokat és tartalékidőt is beolvassa, a *Rögzített dátumok* nézethez.

**Mi nem megy át** — alaptervek, költségek és alapdíjak, megjegyzések, hiperhivatkozások, az MS Project egyéni mezői, a részprojektek és a külső tevékenységek kapcsolata, valamint a kritikus küszöbérték. Lásd: [MS Project-fájl megnyitása (.mpp)](docs://howto-mpp-openen).

**Eredet és licenc** — az `.mpp`-olvasó az Open Planner Studio számára készült, és az MPXJ (`github.com/joniles/mpxj`, Jon Iles és mtsai.) forráskódján és szerkezeti ismeretein alapul. Az MPXJ egy LGPL-2.1 licenc alatt álló Java-csomag. A szerkezet és a mezőkonstansok TypeScriptre lettek átültetve. Az Open Planner Studio maga nyílt forráskódú, LGPL-3.0 licenc alatt. Az `.xer`-olvasó nem származék: az MPXJ-t ott csak megértési forrásként vették figyelembe.

## Primavera P6 XML

**Megnyitás** — igen. Az alkalmazás az `.xml` fájlt P6 XML-ként ismeri fel a gyökérelem `APIBusinessObjects` alapján. Számítási profil: *Open Planner Studio*.

**Több projekt egy fájlban.** Minden tevékenységgel rendelkező projekt a saját fülén nyílik meg, *Projektnév (Projektazonosító)* néven. Az alkalmazás kihagyja a tevékenység nélküli projektet. Az aktív fül az a projekt, amelyben a legtöbb tevékenység van. Az alkalmazás nem veszi át a másik projektre mutató kapcsolatot, és nem veszi át azt a tevékenységet sem, amely egyetlen projekthez sem tartozik. Megnyitás után az alkalmazás jelenti, hány projektet nyitott meg.

**Ünnepnapok megnyitáskor.** Ugyanaz a szabály érvényes, mint az MS Project XML-nél: egy naptár, amelynek saját munkahete van és nincs kivétele, nem kap ünnepnapot.

**Alaptervek.** A fájlban lévő `<BaselineProject>` a projektjének alapterve lesz. Az alapterv, amelyet a P6 aktívnak jelöl, az alkalmazásban is aktív.

**Hozzárendelés üteme.** Ha van hátralévő munka, a hátralévő ütem (`RemainingUnitsPerTime`) lesz a *Hozzárendelt mennyiség/nap*. Ellenkező esetben a tervezett ütem (`PlannedUnitsPerTime`). Anyagnál a tervezett ütem marad. Az alkalmazás megnyitáskor semmit sem számít újra. P6 XML-exportnál a tervezett ütemet `PlannedUnitsPerTime`-ként írja. A hátralévő ütemet `RemainingUnitsPerTime`-ként csak akkor írja, ha a hozzárendelésnek külön tervezett üteme van.

**Nincs olvasható tevékenység.** Ha az alkalmazás nem talál olyan tevékenységet, amelyet ki tud olvasni, nem nyit fület. Jelzi ezt, az okkal együtt, ha az ismert. Példák: tevékenységek `ObjectId` nélkül, vagy XER-oszlopnevek egy XML-fájlban. Ilyenkor exportálja újra a projektet a P6-ból P6 XML-ként, vagy nyissa meg `.xer`-ként.

**Mentés** — nem.

**Exportálás** — igen, mint *Primavera P6 XML* (*Oracle Primavera P6-hoz.*). Alapértelmezett név: a projekt neve `.xml` kiterjesztéssel, zárójelben a projektazonosítóval, ha a projektnek van. Egy MS Project XML-export ugyanezt a nevet kapja: adjon nekik eltérő nevet.

**Projektnév és projektazonosító.** Az alkalmazás a P6 projektazonosítóját a projektnévtől külön tárolja, ahogy egy `.xer`-nél is. A *Projektbeállítások* csak a nevet mutatja, például *Bid for Facility Extension*. A fül ezt mutatja: *Bid for Facility Extension (OZB-05)*. Ha a projektet *Hall extension* névre nevezi át, a fül neve *Hall extension (OZB-05)* lesz. P6 XML-exportnál az *OZB-05* visszakerül projektazonosítóként, a *Hall extension* pedig névként. Így a P6 felismeri a projektet. Egy `.xer`-ből származó projekt is megtartja a projektazonosítóját. A projektazonosító megmarad, ha a projektet IFC-ként menti. A név saját zárójelei, például *New build (phase 2)*, a névben maradnak. Ha a projektnek nincs projektazonosítója, az alkalmazás exportáláskor egyedi azonosítót ad neki, amely *OPS:* kezdetű.

**Mi megy át** — WBS-szerkezet és tevékenységek időtartammal, dátumokkal és előrehaladással; kapcsolatok késleltetéssel; korlátozások (egy második is, lágy korlátozásként); naptárak; erőforrások és hozzárendelések; az állapotdátum (`DataDate`-ként); egy egyéni munkanem a saját mezőjében, `OPS Custom Task Type` néven, amelyet az alkalmazás visszaolvas, és amelyet a P6 esetleg figyelmen kívül hagy.

**Mi nem megy át** — alaptervek és határidők; tevékenységkódok, egyéni mezők, megjegyzések és projektközi kapcsolatok; a számítási beállítások; az ünnepnapok nevei. A P6-ban nincs név minden szabadnaphoz: újra megnyitás után az ünnepnapot *Ünnepnap* néven, a munkanap-kivételt pedig *Munkanap-kivétel* néven hívja. Az egymást követő nem munkanapok egy tartományként jönnek vissza. Az alkalmazás lerövidíti azt a nevet vagy kódot, amely hosszabb, mint amit a P6 megenged: a tevékenység nevét 120 karakterre, a tevékenységazonosítót vagy WBS-kódot 40-re, a WBS- vagy projektnevet 100-ra. Jelenti, hány nevet és kódot rövidített le. A P6-ban nincs százalékos késleltetés: az alkalmazás ezt rögzített számú napra alakítja. A naptári napokban megadott késleltetés munkaidőben megadott késleltetés lesz: 3 naptári nap 3 munkanap lesz. Egy hangmat normál tevékenység lesz, egy kézzel ütemezett tevékenység normál tevékenység lesz, számított dátumokkal, és az egy napnál rövidebb kiegyenlítési késleltetés elvész.

## Primavera-fájl (`.xer`)

**Megnyitás** — igen. Számítási profil: *Primavera P6*. Az alkalmazás csak olvassa a fájlt: nem ír `.xer`-t, és soha nem módosítja a fájlt. Projektenként egy lapot nyit meg, amelyen tevékenységek vannak. Az olyan fájlt, amelyben nincs tevékenység, vagy amelynek a táblái sérültek, üzenettel utasítja el.

**Mentés** — nem, és nincs mentési cél: a *Mentés* új IFC-fájlt készít, benne az eredeti `.xer`-rel.

**Exportálás** — nem. Ha egy `.xer`-ből származó projektet exportálnak CSV-be, MS Project XML-be vagy P6 XML-be, az alkalmazás jelzi, hogy az XER-forrásinformáció elvész, akkor is, ha a projektet közben IFC-ként mentették. IFC-be nem vész el semmi.

**Mi megy át** — a WBS-szerkezet és a tevékenységek időtartammal, dátumokkal, korlátozásokkal és előrehaladással; kapcsolatok késleltetéssel; naptárak; erőforrások a hozzárendelésekkel; tevékenységkódok; egyéni mezők (UDF-ek); megjegyzések; a P6 ütemezési beállításai. Az *Erőfeszítési szint* típusú tevékenység hangmat lesz. Egy alaptervprojekt a rá hivatkozó projekt aktív alapterve lesz. Két projekt közötti kapcsolatot az alkalmazás forrásadatként megőriz.

**Egy hozzárendelés mértéke.** Ha hátralévő munka van, a hátralévő mérték (`remain_qty_per_hr`) lesz a *Hozzárendelt mennyiség/nap*. Egyébként a tervezett mérték (`target_qty_per_hr`). A tervezett, a tényleges és a hátralévő munka változatlanul marad, ahogy a fájlban van. Anyagnál a tervezett mérték marad.

**Szabad szombat vagy vasárnap, amely nincs a fájlban.** Egyes P6-exportok a szabad hétvégi napot több egymást követő szabad nap szakaszán belül a megelőző péntekre vagy a következő hétfőre helyezik át. Ha a naptár szombaton vagy vasárnap dolgozik, az a nap tévesen munkanappá válna. Ha az alkalmazás ilyen mintát lát legalább három szabad napból álló szakaszban, a hétvégi napot mégis szabaddá teszi. A naptárban a napot *Naptári kivétel (hétvége-rekonstrukció)* néven hívja, és beleszámít az üzenet *N naptármegállapítás.* sorába. Olyan naptárnál, amely hétvégén nem dolgozik, nem változik semmi.

**Tartalékidő a projektbefejezésig, befejezési dátum nélkül.** Be van kapcsolva a P6-beállítás, amely a tartalékidőt a projektbefejezésig számítja ki? De a fájlban nincs befejezési dátum a projekthez, és egyetlen tevékenységhez sincs tervezett befejezési dátum? Ekkor az alkalmazás kikapcsolja a *Tartalékidő ütemezés-számítása a projektbefejezési dátumig* beállítást. Ezután a legkésőbbi dátumokat a legutolsó korai befejezésből visszafelé számítja ki. Ez beleszámít a *N P6-ütemezési beállítás biztonságos tartalékot használt.* sorába.

**Befejezett tevékenységek az állapotdátumon.** Egyes fájlok nem rögzítik egy befejezett tevékenység tényleges dátumait, csak egy ablakot az állapotdátumon. A *Rögzített dátumok* nézetben egy ilyen tevékenység ekkor keskeny sáv az állapotdátumon. Ha az újraszámítás más helyre teszi, ez beleszámít a sáv által adott tevékenységek számába. A *Befejezett tevékenység az állapotdátum-ablakban* ütemezési szabály ilyen ablakot számít ki, és csak ezzel a szabállyal kap egy befejezett tevékenység valódi tartalékidőt a *Befejezett tevékenység: legkésőbbi dátumok az állapotdátumtól* számítási beállítás révén. Ez az ütemezési szabály egy közelítés: az alkalmazás ezt a viselkedést csak P3-kimenetben figyelte meg, a Primavera pedig sehol sem erősíti meg. Ezért minden beépített profilban ki van kapcsolva, a *Primavera P6* profilban is. A *Számítási profil és beállítások* csoportban kapcsolhatja be; ekkor a projekt egyéni profilt kap. Lásd: [Számítási beállítások és konvenciók](docs://ref-rekenopties-en-conventies).

**Tizedesvesszős számok.** A P6 a tizedesjelet és az ezres elválasztót a `CURRTYPE` táblában rögzíti. Az alkalmazás ezeket a karaktereket olvassa be, mielőtt az időtartamokat, a munkát és a tartalékidőt átalakítja. Ha ez az információ hiányzik, az alkalmazás a pontot használja tizedesjelként. Ha a fájlban még mindig tizedesvesszős számok vannak, az alkalmazás semmit sem nyit meg. Így nem nyílik meg olyan ütemezés, amelynek a számait helytelenül olvasták be.

**Mi nem megy át** — egy tevékenység nélküli projekt, és két projekt közötti kapcsolat mint valódi kapcsolat az ütemezésben. Lásd: [Primavera P6-fájl megnyitása (.xer)](docs://howto-xer-openen).

## CSV

**Megnyitás** — igen. Az alkalmazás a `;` és a `,` karaktert használja elválasztóként. Az oszlopfejléceket angolul és hollandul ismeri fel (például `Name` vagy `Naam`, `Duration` vagy `Duur`, `Predecessors` vagy `Voorgangers`). A dátumok lehetnek *éééé-hh-nn*, *nn-hh-éééé* vagy *nn/hh/éééé* formátumúak. Az elődöt WBS-kódként, kapcsolattípusként és késleltetésként írja be, például `1.2FS+2d`. Számítási profil: *Open Planner Studio*. A projekt neve *CSV Import*. A `Task Type` oszlop a munkanemet tartalmazza, nem a tevékenységtípust; az alkalmazás a `Werksoort` és a `Work category` fejlécet is felismeri. Egy olyan `Task Type` érték, amely nem az egyik rögzített kód (például `CONSTRUCTION` vagy `INSTALLATION`, amelyeket az alkalmazás maga ír), egyéni munkanem lesz az *Ebből a projektből* csoportban, nem a *Saját munkanemek* csoportban. Az `OPS Custom Task Type ID` mezővel megmarad egy egyéni munkanem azonosítója.

**Mentés** — nem.

**Exportálás** — igen, mint *CSV (;)* (*Általános táblázat-export. Az összes tevékenység dátumokkal és időtartamokkal.*), a *CSV (pontosvesszővel tagolt)* kártyán. A fájl pontosvesszőt használ elválasztóként, UTF-8 kódolású, BOM-mal, és angol oszlopfejléceket tartalmaz.

**Mi megy át** — tevékenységenként ezek az oszlopok: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` és `Description`. A `Task Type` oszlop a munkanemet tartalmazza. Az elkészültség egész százalékban van megadva. Az órában megadott késleltetés az alkalmazás nyelvének órajelét kapja: `1.2FS+2h` angolul, `1.2FS+2u` hollandul. Megnyitáskor az alkalmazás mindkettőt felismeri.

**Mi nem megy át** — erőforrások, hozzárendelések, naptárak, korlátozások, határidők, alaptervek és az állapotdátum. Ha a dátumok a *Rögzített dátumok* nézetben vannak, az export üresen hagyja a `Critical` és a `Total Float` oszlopot azoknál a tevékenységeknél, amelyeknek a forrásfájlja ezt nem rögzítette.

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
