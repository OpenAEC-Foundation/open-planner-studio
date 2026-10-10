# Az előrehaladás frissítése

Cél: vigye be a munka tényleges állapotát az ütemezésbe, és újraszámítsa az ütemezést: melyik tevékenység készült el, melyik fut, és mennyi van még hátra.

## Mikor van erre szüksége

Az előrehaladást rögzített időpontokban frissíti, például minden pénteken, amikor a helyszíni vezető jelenti az állapotot. Így az ütemezés látja, mi történt valójában, és az állapotdátumtól számítja ki a hátralévő munkát. Hogy az alkalmazás miért így működik, azt a következő cikkben olvashatja el: [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang).

## Lépések

### 1. Állítsa be az állapotdátumot

Az állapotdátum az a nap, amelyen felmérést készít. Állítsa be, mielőtt megadja az előrehaladást.

1. Lépjen az *Ütemezés › Alaptervek és előrehaladás › Állapotdátum* menüpontra.
2. Írja be a dátumot a három mezőbe: nap, hónap és év (a dátum szokásos sorrendjében), például 28, 06 és 2027, majd nyomja meg az Enter billentyűt. Az alkalmazás magától a következő mezőre ugrik.
3. A mező melletti kis kereszttel újra kiürítheti az állapotdátumot.

Ha pénteken munkaidő után készít felmérést, állítsa az állapotdátumot a következő munkanapra, a hétfőre. Az alkalmazás a hátralévő munkát az állapotdátum kezdetétől ütemezi.

Ha még nincs állapotdátum, és Ön mégis megad előrehaladást, az alkalmazás az állapotdátumot a mai napra állítja, és ezt jelzi: *Nem volt még állapotdátum: most a mai napra (…) lett beállítva, mert a program az előrehaladást az állapotdátumig méri. Módosíthatja az Ütemezés → Állapotdátum menüpontban.* Ezért célszerű ezt előbb Ön maga beállítani.

### 2. Adja meg az előrehaladást

Válassza ki a helyzetének megfelelő módot. Mindegyik ugyanazt az eredményt adja.

**Egy tevékenység a tulajdonságok panelen.** Hasznos, ha egyetlen tevékenységet frissít.

1. Kattintson a tevékenységre. Ha nem látja a *Tulajdonságok* panelt, kapcsolja be a *Nézet › Panelek › Tulajdonságok* menüponttal.
2. Húzza a(z) *Előrehaladás (%)* csúszkát a kész százalékra.
3. Ha szükséges, töltse ki a *Tényleges kezdés* és a *Tényleges befejezés* mezőt, ugyanúgy, mint az állapotdátumnál. Az alkalmazás a *Hátralévő* mezőt maga számítja ki; ezt itt nem módosíthatja.

Egy mérföldkőnek egy mezője van: a *Tényleges dátum*.

**Százalék kiválasztása a menüben.** Hasznos gyors előrehaladás megadásához.

1. Kattintson a jobb gombbal a Gantt-diagram tevékenységsávjára.
2. Válassza az *Előrehaladás* menüpontot, majd a 0%, 25%, 50%, 75% vagy 100% értéket.

**Több tevékenység a tevékenységtáblázatban.** Hasznos, ha egy egész listát frissít.

1. Kattintson a tevékenységtáblázat fejlécének jobb szélén lévő **+** jelre (*Oszlop hozzáadása*), és nyissa meg az *Előrehaladás* kategóriát. Adja hozzá ezeket az oszlopokat: *Tényleges kezdés*, *Tényleges befejezés*, *Hátralévő* és *Státusz*. Az *Előrehaladás* oszlop már rajta van a *Táblázat* lapon.
2. Kattintson duplán egy cellára, írja be az értéket, és nyomja meg az Enter billentyűt. A százalékot `50` vagy `50%` alakban írja be, a dátumot `25-06-2027` alakban, a hátralévő időtartamot `1` alakban.
3. A *Státusz* oszlopban kattintson duplán, nyomja meg az Enter billentyűt, és válassza a *Nem kezdődött el*, a *Folyamatban* vagy a *Befejezett* értéket.

Ha hátralévő időtartamot ír be, az alkalmazás visszaszámolja a százalékot: 2 munkanapos tevékenységnél az 1 maradék 50 százalékot jelent. A 0 maradék befejezetté teszi a tevékenységet. Ha a *Státusz* oszlopban a *Nem kezdődött el* értéket választja, a százalék 0 lesz, és a tényleges dátumok eltűnnek.

**Egy tevékenység minden adata a tevékenységszerkesztő ablakban.** Kattintson a tevékenységre jobb gombbal, és válassza a *Szerkesztés...* lehetőséget. Az előrehaladási mezők is ott vannak. Ezek csak a *Mentés* gombra kattintás után érvényesülnek.

**Sok tevékenység egyszerre, táblázatkezelő programból.** Olvassa el: [Előrehaladás importálása táblázatkezelőből](docs://howto-voortgang-importeren).

### 3. Az ütemezés újraszámítása

Minden változás az előrehaladásban vagy az állapotdátumban elavulttá teszi az ütemezést: az állapotsor az *Elavult — újraszámítsa (F5)* üzenetet jeleníti meg. Nyomja meg a **Számítás** parancsot (F5), például az *Ütemezés › Ütemezés › Számítás* menüpontban. Ha az *Automatikus ütemezés-számítás* be van kapcsolva (a *Beállítások › Projekt › Beállítások* alatt, az *Ütemezés* lapon), az alkalmazás ezt maga végzi el.

## Az eredmény ellenőrzése

- Az állapotdátumnál a Gantt szaggatott vonalat mutat, a fejlécben a dátummal. Futó tevékenységeknél a vonal kidudorodik a sávban látható százalékig. Ezeket a *Nézet › Alaptervek és előrehaladás › Előrehaladási vonal* és az *Állapotdátum-vonal* menüponttal kapcsolhatja be vagy ki.
- Befejezett tevékenységek sosem pirosak: ha van állapotdátum, a befejezett tevékenység nem kritikus.
- A fázisok származtatott százalékot mutatnak, és az ütemezés befejezése eltolódhatott.
- Ha mentett egy alaptervet, az eredeti ütemezés minden sáv alatt látható, és az *Eltérés* jelentés típusa mutatja az eltéréseket.

## Buktatók és az alkalmazás működése

**Dátum az állapotdátum után.** Az alkalmazás nem fogadja el a tényleges kezdést vagy a tényleges befejezést az állapotdátum után. A panelen a mezők alatt ez olvasható: *A tényleges dátumok nem lehetnek az állapotdátum után*; a tevékenységtáblázatban a cella ezt jelzi: *A tényleges dátum az állapotdátum után van.* Állítsa előbb későbbre az állapotdátumot, vagy javítsa ki a dátumot.

**Tevékenység, amely csak az állapotdátum után kezdődne.** Ha olyan tevékenységhez ad meg előrehaladást, amely az ütemezés szerint még nem kezdődhetett volna el, megnyílik az *Adja meg a tényleges kezdést* ablak. Ez azt kérdezi, mikor kezdődött valójában a tevékenység; a javaslat az állapotdátum. Az *Előrehaladás alkalmazása* gombbal ezt rögzíti; a *Mégse* gombbal semmi nem változik.

**100% dátumok nélkül.** Ha egy tevékenységet tényleges befejezés nélkül 100%-ra állít, a tényleges befejezés az állapotdátum lesz, akkor is, ha a tevékenység korábban készült el. Ezután Ön maga adja meg a tényleges befejezést.

**100% alatti százalék.** Ha egy befejezett tevékenységet 100% alá állít vissza, a tényleges befejezés törlődik. Ha csak a tényleges befejezést üríti ki, a százalék 0 lesz, és a tevékenység *Folyamatban* marad. Ha azt szeretné, hogy a tevékenység ismét nem kezdődöttnek számítson, ürítse ki a tényleges kezdést is, vagy válassza a *Nem kezdődött el* értéket a *Státusz* oszlopban a tevékenységtáblázatban.

**A futó tevékenység időtartamának módosítása.** Az elvégzett munka megmarad, a százalék pedig igazodik. Az 5 munkanapos, 60%-os tevékenységet 10 munkanapra állítva a százalék 30% lesz. Az alkalmazás nem fogadja el a már elvégzett munkánál rövidebb időtartamot: *„Build inner cavity leaf” már 60%-ban kész: az időtartam nem lehet rövidebb a már elvégzett munkánál. Az időtartam nem módosult.* A tevékenységtáblázatban a cella ezt jelzi: *Ez az időtartam rövidebb, mint a már elvégzett munka.*

**A hátralévő időtartam kerekítése.** Az alkalmazás a hátralévő időtartamot egész munkanapokra kerekíti. 2 munkanapos tevékenységnél az 50% és a 75% is 1 munkanapos maradékot ad.

**Fázis.** A fázisnak nincs saját előrehaladása. A panelen ez olvasható: *Az altevékenységekből származik: az előrehaladást ott módosítsa. Az összefoglaló tevékenység a Számítás (F5) után követi.* A tevékenységtáblázatban a cella ezt jelzi: *Az összefoglaló tevékenység előrehaladását az altevékenységek határozzák meg, ezért itt nem módosítható.*

**Az állapotdátum későbbre helyezése.** A futó tevékenységek hátralévő munkája az új állapotdátumon kezdődik, a még nem kezdődött munka pedig nem kezdődhet az állapotdátum előtt. Ezért csak az előrehaladás frissítésével együtt módosítsa az állapotdátumot. Ha állapotdátumot állít be úgy, hogy közben nem ad meg előrehaladást, minden még nem kezdődött munka erre a dátumra kerül (kivéve a Microsoft Project profilban).

**Hiba.** Minden előrehaladás-változtatás egy lépésben visszavonható a Ctrl+Z billentyűvel.

## Kapcsolódó témák

- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): hogyan számítja ki az alkalmazás a hátralévő munkát és az állapotdátumot, egy kidolgozott példával.
- [Előrehaladás importálása táblázatkezelőből](docs://howto-voortgang-importeren): több tevékenység előrehaladásának beolvasása egyszerre.
- [Az előrehaladási mód kiválasztása](docs://howto-voortgangsmodus-kiezen): mit tesz az alkalmazás olyan tevékenységgel, amely már elkezdődött, miközben az elődje még fut.
- [Alapterv mentése és kezelése](docs://howto-baseline-opslaan-en-beheren): az eredeti ütemezés rögzítése, amellyel az előrehaladás összehasonlítható.
