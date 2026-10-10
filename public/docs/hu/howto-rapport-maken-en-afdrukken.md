# Jelentés készítése és nyomtatása

Cél: válasszon jelentést az ütemezéséről, ellenőrizze az előnézetben, és mentse PDF-ként, hogy kiadhassa vagy maga kinyomtathassa.

## Mikor van rá szükség

Pénteken van a helyszíni megbeszélés. Az ügyfél papíron szeretné látni az ütemezést, a helyszíni vezető azt szeretné tudni, mi kezdődik a következő hetekben, a művezető pedig egy lapot, amelyen csak a saját tevékenységei szerepelnek. Ilyen áttekintéseket a *Jelentés* lapon készít. Az alkalmazás az ütemezés alapján számítja ki ezeket, és először előnézetben mutatja meg őket. Ezután PDF-be exportálja őket.

Az alkalmazás nem küld jelentést közvetlenül nyomtatóra. A végeredmény mindig egy PDF-fájl. Ezt a PDF-olvasójával nyomtathatja ki, vagy e-mailben küldheti el.

## Lépések

### 1. Nyissa meg a Jelentés lapot

Válassza a *Jelentés* lapot a menüszalagon, vagy nyomja meg a Ctrl+P billentyűkombinációt. A Ctrl+P erre a lapra visz. Ha éppen egy mezőbe ír, párbeszédpanel van megnyitva, vagy be van kapcsolva a prezentációs mód, a Ctrl+P nem működik. Böngészőben ilyenkor a böngésző nyomtatási párbeszédpanele nyílik meg, és az a képernyőt nyomtatja ki, nem a jelentést.

A bal oldalon található a *Jelentés* oszlop a *Jelentés típusa* listával, egy összefoglalóval és a beállításokkal. A jobb oldalon látható az előnézet.

### 2. Válassza ki a jelentés típusát

A *Jelentés típusa* listában tizenegy jelentés van. Válassza ki azt, amelyik megfelel a kérdésének.

- *Gantt-nyomtatvány*: az ütemezés sávdiagramként, a szokásos, kiadható ütemezéshez.
- *Erőforrásdiagram*: ugyanazok a sávok, de erőforrásonként külön csoportban. Ha azt kérdezi: „Mit csinál az X csapat?”, ha szeretné, csapatonként külön lapot kap.
- *Mérföldkő-áttekintés*: az összes mérföldkő dátummal és állapottal.
- *Eltérés*: az aktuális ütemezés az aktív alaptervvel egymás mellett. Ha azt kérdezi: „Mennyire csúsztunk el?”
- *Look-ahead*: ami a következő időszakban fut vagy kezdődik. A heti megbeszélés listája.
- *Kritikus és közel kritikus*: a tevékenységek, amelyeknél nincs vagy szinte nincs tartalékidő.
- *Előrehaladási jelentés*: hol tart a projekt az állapotdátumon, vagyis azon a napon, amelyen az előrehaladást méri.
- *Ütemezés előrehaladása*: az ütemezés ellenőrzése hibák és szokatlan értékek szempontjából.
- *Erőforrás-terhelés*: erőforrásonként, hetente vagy havonta, mennyi kell és mennyi áll rendelkezésre.
- *Erőforrás-hozzárendelések*: erőforrásonként azok a tevékenységek, amelyekhez hozzá van rendelve.
- *WBS-összefoglaló tevékenység*: az ütemezés WBS-szintenként összesítve, a vezetésnek.

### 3. Ellenőrizze, hogy az ütemezés naprakész

Az alkalmazás nem számol magától. Ha az utolsó számítás óta módosította a tevékenységeket, a kapcsolatokat vagy a naptárakat, nyomja meg az **ütemezés-számítás** (F5) parancsot. A táblázatos jelentések maguk figyelmeztetnek a jelentés tetején: *Az ütemezés az utolsó számítás óta módosult. Nyomja meg a Számítás (F5) gombot az aktuális értékekhez*. Vagy, ha még soha nem számították ki: *Még nincs kiszámítva. Nyomja meg a Számítás (F5) gombot a dátumokhoz és a tartalékidőhöz*.

A Jelentés lap menüszalagján nincs ütemezés-számítás gomb, de az F5 billentyű itt is működik. A *PDF exportálás* is előbb magától kiszámítja az eredményeket, ha az ütemezés nincs naprakész, így a PDF sosem marad le az ütemezéshez képest.

### 4. Állítsa be a jelentést

A *Beállítások* alatt találhatók a Gantt-nyomtatvány és az Erőforrásdiagram lehetőségei. A Look-ahead, a Kritikus és közel kritikus, az Előrehaladási jelentés, az Ütemezés előrehaladása, az Erőforrás-terhelés, az Erőforrás-hozzárendelések és a WBS-összefoglaló tevékenység jelentésnél csak a *Papír:* és a *Tájolás:* beállítás van, valamint egy *Jelentésbeállítások* blokk az adott jelentés lehetőségeivel. A Mérföldkő-áttekintésnek és az Eltérésnek nincs saját beállítása. A jelentés időszakáról olvassa el: [A jelentési időszak kiválasztása](docs://howto-rapportageperiode-kiezen).

- *Papír:* és *Tájolás:* határozza meg a lapot. Alapértelmezés szerint ez A3-as fekvő, ami egy építési ütemezésnél praktikus, de nem minden nyomtató nyomtat A3-as lapra. Ha A4-es nyomtatója van, most válassza az A4-et: az alkalmazás ekkor A4-re rendezi el az oldalakat, így utólag nem kell kicsinyítenie őket.
- Az Erőforrásdiagramnál a *Minden erőforrás új oldalon* jelölőnégyzet csapatonként külön lapot ad.
- *Betűméret:* (90% és 125% között) a szöveget és a táblázatot nagyobbá vagy kisebbé teszi. Nagyobb betűméret kevesebb helyet hagy az idővonalnak.
- A *Nézet követése (szűrő, csoportosítás, rendezés)* csak a Gantt-nyomtatványnál jelenik meg. Alapértelmezés szerint a teljes tevékenységfa kerül a papírra. Ezzel a jelölőnégyzettel a jelentés pontosan azokat a sorokat rajzolja ki, amelyeket a képernyőn lát, az összecsukott fázisokat is beleértve, például csak a kritikus tevékenységeket egy elrendezésből. Az ilyen nézet készítéséről olvassa el: [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken).
- Az *Alapterv-réteg megjelenítése* az aktív alaptervet a jelenlegi sávok mellett mutatja. Az *Előrehaladássor:* beállításnál választhat *Állapotdátum-vonal* lehetőséget vagy *Előrehaladási vonal* lehetőséget.
- Az *Automatikus illesztés papírra* alapértelmezés szerint be van kapcsolva: ekkor az idővonal az oldal szélességéhez igazodik, az oldalszám pedig a magasságból adódik. Ha kikapcsolja, a jelentés fix nagyítást használ, és szélességben is több oldalra osztja a tartalmat, ami gyorsan sok oldalt eredményez. Az *Idővonal ennyi oldalra:* beállítással, automatikus illesztés mellett, az idővonalat 2 és 8 oldal szélesre oszthatja, hosszú ütemezésnél, amelyet olvasható méretben szeretne kinyomtatni.

### 5. Ellenőrizze az előnézetet

A Gantt-nyomtatványnál és az Erőforrásdiagramnál a papírt látja az oldalfejléccel, a táblázattal, az idővonallal és a jelmagyarázattal. Görgessen végig az oldalakon. Az *Előnézet minősége* csak azt szabja meg, mennyire éles az előnézet a képernyőn; a PDF ettől nem változik. Ha az oldalak alatt ez olvasható: *… és még 1 oldal — a teljes dokumentumhoz exportáljon* (több oldal esetén: *… és még 2 oldal — a teljes dokumentumhoz exportáljon*), akkor az előnézetben még nincs kész minden oldal. A PDF mindet tartalmazza.

A többi jelentés a képernyőn táblázatként jelenik meg. Amit a képernyőn lát, az kerül a PDF-be.

### 6. Exportálás PDF-be

A bal oszlop alján kattintson a **PDF exportálás** gombra. A javasolt fájlnév a projekt neve, utána a jelentés típusa. A Gantt-nyomtatványnál ez például *Extension house-planning.pdf*.

- Az asztali alkalmazásban, és olyan böngészőben, amelyben van fájlmentési párbeszédpanel, Ön választja ki, hová kerül a PDF. Ha ezt a párbeszédpanelt mentés nélkül zárja be, nem történik semmi.
- Olyan böngészőben, amelyben nincs ilyen párbeszédpanel, a böngésző a PDF-et a letöltések mappába menti.

### 7. Nyomtassa ki a PDF-et

Nyissa meg a PDF-et a PDF-olvasóban, és nyomtassa ki ott. Ha A3-as PDF-et nyomtat A4-es nyomtatón, akkor a nyomtatási párbeszédpanelben kell kicsinyíteni az oldalakat. Ezért állítsa be a papírméretet már a 4. lépésben.

## Buktatók és az alkalmazás működése

**A Nyomtatás gomb és a Ctrl+P nem nyomtat.** A *Nyomtatás* gomb a *Jelentés* csoportban van, magán a Jelentés lapon, és nem csinál semmi többet. A Ctrl+P erre a lapra visz. Az alkalmazásban nincs külön nyomtatási parancs: papírra a PDF-en keresztül lehet eljutni. Ha a Ctrl+P nem működik (nézze meg az 1. lépést), a böngésző nyomtatási párbeszédpanele nyílik meg, és az a képernyőt nyomtatja ki, nem a jelentést.

**A Cég: a felülírt érték nem marad meg.** A *Cég:* mező a Gantt-nyomtatványon a projektinformációban megadott cégnévvel indul. Amit felülír, az nem marad meg. A *Szerző:* mezőbe itt nem írhat. Mindkettőt a *Beállítások › Projekt › Projektinfó* útvonalon módosíthatja, a *Megrendelő/szervezet* és a *Szerző* mezőben, majd az *Alkalmazás* gombbal erősítse meg.

**Sávszínek: a képernyőn is érvényes.** A jelentésben a *Sávszínek:* beállítás ugyanaz, mint a *Sávszínek* beállítás a Nézet lapon. Ha itt módosítja, a képernyőn lévő Gantt-diagram is megváltozik.

**Az Eltérés alapterv nélkül.** Az alapterv az ütemezés elmentett pillanatképe, amelyhez később hasonlít. Az elmentés módjáról olvassa el: [Alapterv mentése és kezelése](docs://howto-baseline-opslaan-en-beheren). Ha nincs aktív alapterv, összehasonlítás helyett ez olvasható: *Nincs aktív alapterv. Mentsen egy alaptervet, vagy állítson be egyet aktívként*.

**Előrehaladássor állapotdátum nélkül.** Ha *Előrehaladássor:* beállítást választ, miközben a projektnek nincs állapotdátuma, a jelentés ezt figyelmeztetéssel jelzi: *Állítsa be először az állapotdátumot*, és nem rajzol semmit. Az állapotdátumot itt állítja be: *Ütemezés › Alaptervek és előrehaladás › Állapotdátum*.

**Az ütemezésben hurok van.** Ha az ütemezésben hurok van, a *PDF exportálás* nem készít fájlt, és hibaüzenetet jelenít meg.

**A papírbeállítás jelenleg minden jelentésre vonatkozik.** Egy közös *Papír:* és *Tájolás:* beállítás van, amely minden jelentésre érvényes. A Mérföldkő-áttekintésnek és az Eltérésnek nincs saját papírbeállítása: egy másik jelentésben megadott értéket használják, alapértelmezés szerint A3-as fekvő. Ezért válassza ki először a papírt egy olyan jelentésnél, amely ezt kínálja, például a Gantt-nyomtatványnál, és utána térjen vissza.

**A beállítások minden projektre vonatkoznak.** Az alkalmazás ezen az eszközön megjegyzi a papírt, a betűméretet, az időszakot és a többi beállítást, az összes projektjére. Ezek nem a projektfájl részei.

## Lásd még

- [A jelentési időszak kiválasztása](docs://howto-rapportageperiode-kiezen): egy adott időszakra vonatkozó Look-ahead vagy előrehaladási jelentés.
- [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken): először szűrjön vagy csoportosítson, majd nyomtasson a *Nézet követése* beállítással.
- [Alapterv mentése és kezelése](docs://howto-baseline-opslaan-en-beheren): a pillanatkép, amelyhez az Eltérés hasonlít.
- [Túlterhelés feloldása](docs://howto-overbezetting-oplossen): mit tegyen, ha az Erőforrás-terhelés túlterhelt heteket mutat.
- [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad): miért kritikus vagy közel kritikus egy tevékenység.
- [Jelentés típusai](docs://ref-rapporttypes): az összes jelentés típusa és a beállításaik.
