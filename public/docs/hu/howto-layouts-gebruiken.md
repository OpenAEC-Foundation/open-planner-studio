# Elrendezés létrehozása és használata

Cél: egy kattintással váltson az ütemezés nézetei között, például csak a kritikus tevékenységek, a munkacsoportonkénti tevékenységek vagy egy másik rendezési sorrend között.

## Mikor van erre szükség

A helyszíni egyeztetésen a megrendelő csak a kritikus tevékenységeket akarja látni. Ezután a helyszíni vezető munkacsoportonként akarja látni, ki mikor kell. Ezután Ön ismét az egész ütemezést akarja látni. A szűrések, csoportosítások és rendezések újra és újra való beállítása fárasztó. Egy **elrendezés** ilyen nézetet gombként tárol a menüszalagon.

Egy elrendezés hat dolgot tárolhat: a szűrést, a csoportosítást, a rendezést, a Gantt melletti tevékenységtáblázat oszlopait, az időskálát, valamint a kapcsolatvonalakat és a rátéteket (alapterv, előrehaladási vonal, állapotdátumvonal, erőforráskiemelés, tartalékidősáv és sávszínek). Csak az változik, amit bejelöl, amikor rákattint a gombra. A nézet többi része marad, ahogy volt.

Szűrést, csoportosítást és rendezést elrendezéssel végez. A külön gombok *Szűrés…*, *Csoportosítás…* és *Rendezés…* most csak egy rejtett beállítás mögött érhetők el (lásd a buktatókat).

## Lépések

### Egy meglévő elrendezés használata

1. Válassza a *Nézet* lapot. Az *Elrendezés* csoportban elrendezésenként van egy gomb. Alapértelmezés szerint ez az *Erőforrásdiagram*.
2. Kattintson rá. Az *Erőforrásdiagram* erőforrásonként csoportosítja a tevékenységeket, minden csoporton belül a kezdés szerint rendezi őket, és kikapcsolja a kapcsolatvonalakat. Két erőforrással rendelkező tevékenység mindkét csoport alatt megjelenik.
3. Kattintson újra a gombra a kikapcsoláshoz. A nézet visszatér abba az állapotba, amilyen a kattintás előtt volt.

Minden kattintás egy visszavonható lépés a *Visszavonás* (Ctrl+Z) funkcióval, a be- és a kikapcsolás is.

### Saját elrendezés készítése

1. Kattintson az *Elrendezés* csoportban az *Új elrendezés* gombra. Megnyílik az *Új elrendezés* ablak.
2. Írja be a *Név* mezőt, és válassza ki az *Ikon* elemet.
3. A *Mit rögzít ez az elrendezés?* alatt található a hat rész, mindegyik jelölőnégyzettel. Az új ablak minden résszel bejelölve nyílik meg, és azzal töltődik ki, ami most a képernyőn látszik. Vegye ki a jelölést minden olyan részből, amelyet az elrendezés nem változtathat meg. Ha csak szűrést akar, hagyja bekapcsolva csak a *Szűrés* részt. Az *Aktuális nézet átvétele* ismét minden részt a képernyőn látható állapottal tölt ki.
4. Állítsa be a részeket.
5. Kattintson a *Mentés* gombra.

Az elrendezés most gomb a menüszalagon, de még nincs alkalmazva. Kattintson a gombra a bekapcsoláshoz.

### A szűrés beállítása

A *Szűrés* alatt szabályokat állít össze. Kattintson a *+ szabály* gombra. Ezután a *Mező*, az *Operátor* és az érték mezőben állítsa be a feltételt. Ha csak a kritikus tevékenységek kellenek: a mező *Kritikus*, az operátor *egyenlő*, az érték *Igen*. A mezők közé tartozik a *Tevékenység neve*, a *Kezdés*, a *Befejezés*, a *Teljes tartalékidő*, az *Előrehaladás* és a *Mérföldkő*, továbbá a saját tevékenységkódjai és mezői, valamint az *Erőforrások*. Az operátorok a mező típusától függnek: szövegnél a *tartalmazza* operátort, számnál és dátumnál a *között* operátort választhatja.

Hogy mely operátorok érhetők el, az a mező típusától függ:

- Szöveg (*Tevékenység neve*, *WBS*): *egyenlő*, *nem egyenlő*, *tartalmazza*, *ezzel kezdődik* és *üres*.
- Szám és dátum (*Teljes tartalékidő*, *Kezdés*, *Előrehaladás*): *egyenlő*, *nem egyenlő*, *kisebb, mint*, *kisebb vagy egyenlő*, *nagyobb, mint*, *nagyobb vagy egyenlő*, *között* és *üres*. A *között* operátornál két mező van: számnál a *Tól* és az *Eddig* jelenik meg tippként, dátumnál nincs tipp (az első dátum a kezdet, a második a vég).
- Igen/nem (*Kritikus*, *Mérföldkő*, *Közel kritikus*): *egyenlő* és *nem egyenlő*, az érték *Igen* vagy *Nem*.
- Választás (*Típus*, egy tevékenységkód): *egyenlő*, *nem egyenlő*, *az alábbiak egyike* (jelölőnégyzetes értékekkel) és *üres*.
- *Erőforrások*: *az alábbiak egyike* és *üres*.
- *Folyamatban*: csak *között*, két dátummal (kezdettől végéig).

A *Folyamatban* mezővel, a *között* operátorral és két dátummal minden olyan tevékenység megjelenik, amely a megadott időszakban bármikor fut, például minden, ami júniusban aktív.

Több szabályt a lista tetején lévő beállítással kapcsol össze: az *Az alábbiak mindegyike (ÉS)* azokat a tevékenységeket mutatja, amelyek minden szabálynak megfelelnek, az *Az alábbiak bármelyike (VAGY)* pedig azokat, amelyek legalább egynek. A *+ csoport* gombbal saját szabályokkal rendelkező alcsoportot ad hozzá.

A szűrés a tevékenységeket nézi. Az összefoglaló tevékenységek, amelyek alá az adott tevékenység tartozik, szürkén láthatók maradnak, így látszik, hová tartozik. Ha csoportosítást is használ, ezek a szürke összefoglalók eltűnnek.

### Csoportosítás és rendezés

A *Csoportosítás* alatt *+ szint* gombbal adhat hozzá egy mezőt. Legfeljebb két csoportosítási szint van. Csoportosítás nélkül a WBS-szerkezetet látja. A *Rendezés* alatt *+ szint* gombbal adhat hozzá egy mezőt, és a *Növekvő* vagy a *Csökkenő* közül választhat. Két szint esetén a második dönt, ha az első szinten az értékek egyenlők.

### Gyors kipróbálás gomb nélkül

Az ablakban kattintson az *Alkalmazás mentés nélkül* gombra. A bejelölt részek megjelennek a képernyőn, de nem jön létre gomb. Ez hasznos egy olyan szűréshez, amelyre csak egyszer van szükség. Ctrl+Z visszavonja.

### Elrendezés módosítása, másolása vagy törlése

Kattintson jobb gombbal az elrendezés gombjára. Ekkor a *Szerkesztés…*, a *Duplikálás* vagy a *Törlés* közül választhat. A *Törlés* előbb megerősítést kér. Egy másolat neve *név (másolat)*. Egy beépített elrendezés, például az *Erőforrásdiagram* nem szerkeszthető és nem törölhető; ehhez duplikálja, és így készíti el a saját változatát.

### Több elrendezés egyszerre

Elrendezések, amelyek nem ugyanazokat a részeket tárolják, egyszerre is be lehetnek kapcsolva. Ha van egy olyan elrendezése, amely csak egy szűrést tárol, *Kritikus*, *egyenlő*, *Igen* (nevezze el például *Csak kritikus* néven), és bekapcsolja az *Erőforrásdiagram* elrendezéssel együtt (csoportosítás, rendezés, kapcsolatvonalak), akkor erőforrásonként a kritikus tevékenységeket kapja. Ha két elrendezés ugyanazt a részt tárolja, például mindkettő szűrést, a második átveszi a helyét, és az első kikapcsol. Ha ezt a második elrendezést ismét kikapcsolja, a nézet visszatér az első kattintás előtti állapotra, nem az első elrendezésre.

## Buktatók és az alkalmazás működése

**Elfelejti kivenni a jelölést.** Egy elrendezés, amely az oszlopokat, az időskálát és a rátéteket is tárolja, minden kattintáskor visszaállítja ezeket a mentett állapotra. Ekkor a nagyítás elugrik, pedig csak szűrést akart. Ellenőrizze az ablakban, hogy csak a kívánt részek legyenek bejelölve.

**Egy hiányos szabály nem mutat semmit.** Ha nem választ értéket igen/nem mezőhöz (még mindig *—* áll benne), vagy üresen hagyja a *Folyamatban* dátumait, nincs olyan tevékenység, amely megfelel, és a lista üres marad. Töltse ki a szabályt.

**Egy kézi módosítás kikapcsolja az elrendezést.** Ha Ön maga módosít egy részt, amelyet az elrendezés tárol, például a *Kapcsolatvonalak* részt, miközben az *Erőforrásdiagram* be van kapcsolva, akkor az elrendezés kiesik, és a többi rész visszatér az elrendezés előtti nézetre. A nagyítás kikapcsol minden olyan elrendezést, amely az időskálát tárolja, és egy oszlop szélesítése kikapcsol minden olyan elrendezést, amely az oszlopokat tárolja. A nézet többi része ekkor marad, ahogy van. Az *Erőforrásdiagram* nem tárolja az időskálát, ezért a nagyítás nem érinti.

**Az oszlopok a Gantt melletti tevékenységtáblázatra vonatkoznak.** Az *Oszlopok* rész az idővonal bal oldalán lévő táblázat oszlopait tárolja. A *Táblázat* lapon lévő táblázat megtartja a saját oszlopait. Az oszlopok kiválasztásáról a következő cikkben olvashat: [Táblázatoszlopok beállítása](docs://howto-tabelkolommen-aanpassen).

**A *Behúz* és a *Kihúzás* ki van kapcsolva.** Amíg szűrés, csoportosítás vagy rendezés be van kapcsolva, a megjelenített sorrend nem egyezik meg az ütemezés sorrendjével. Ilyenkor a *Behúz* és a *Kihúzás* ki van kapcsolva, a súgószöveg pedig ez: *Szűrés/csoportosítás/rendezés közben nem érhető el*. Kapcsolja ki az elrendezést, ha ismét a szerkezetet akarja módosítani, ahogy ebben olvashatja: [A szerkezet módosítása](docs://howto-structuur-aanpassen).

**Az állapotsor nem követi a nézetet.** A *Tevékenységek:* az állapotsorban az egész projekt tevékenységeinek számát mutatja, akkor is, ha a szűrés csak egy részüket jeleníti meg.

**Az elrendezések az eszközén vannak, nem a projektben.** Az alkalmazás az elrendezéseit és az oszlopait minden projektjéhez ezen az eszközön tárolja. Egy elrendezés rátétei (alapterv, előrehaladási vonal és a többi) minden projektjére érvényesek. A szűrés, a csoportosítás és a rendezés, amely éppen be van kapcsolva, a megnyitott projekthez tartozik, de nem mentődnek el a projektfájlban: mentés és újranyitás után a nézet ismét tiszta. Ezek a beállítások a projektet sem jelölik „módosítottnak”.

**A külön gombok el vannak rejtve.** A *Nézet* lapon lévő külön gombok, *Oszlopok…*, *Szűrés…*, *Csoportosítás…* és *Rendezés…*, a régi nézethez tartoznak. Ezeket a beállítási ablak (⚙ a címsorban) *Speciális* lapján, a *Régi funkciók* alatt, a *Klasszikus nézetgombok megjelenítése* beállítással hozhatja vissza. Használja inkább az elrendezéseket.

## Lásd még

- [Táblázatoszlopok beállítása](docs://howto-tabelkolommen-aanpassen): az oszlopok kiválasztása, áthelyezése és rögzítése.
- [Jelentés készítése és nyomtatása](docs://howto-rapport-maken-en-afdrukken): a nézet papírra vitele a *Nézet követése* beállítással.
- [A szerkezet módosítása](docs://howto-structuur-aanpassen): miért nem lehet behúzni szűrés közben.
