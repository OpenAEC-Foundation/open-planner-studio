# A foglaltságáttekintés használata

Cél: látni, mely napokon kér két vagy több megnyitott projekt együtt egy erőforrásból többet, mint amennyi az erőforrástárban van.

## Mikor van erre szükség

Az egyik projektben a kőműves csapata a homlokzatokon dolgozik, egy másikban a garázsokon. Mindegyik projektben jól megtervezettnek látszik a csapat, mert a hisztogram és a projekt túlterhelése csak az adott projektet nézi. Csak akkor derül ki, hogy ugyanazokon a napokon együtt több kőművest kérnek, mint amennyi van, ha a projekteket egymás mellé teszi. A foglaltságáttekintés ezt az egymás mellé helyezést Ön helyett elvégzi.

Az áttekintés csak az erőforrástárból származó erőforrásokat számolja, az ugyanahhoz az erőforrástárhoz kapcsolt projektekben. Azt, hogyan számítja ki, itt olvashatja el: [Az erőforrástár](docs://uitleg-resourcebibliotheek).

## Lépések

### 1. Készítse elő a projekteket

1. Nyissa meg az összehasonlítani kívánt projekteket, mindegyiket a saját lapján. Lásd: [Több projekt egyidejű használata](docs://howto-meerdere-projecten). Az áttekintés csak az ebben a programban megnyitott projekteket látja.
2. Kapcsolja minden projektet ugyanahhoz az erőforrástárhoz, és használja minden projektben az erőforrástárból származó erőforrást. Erőforrástár-kapcsolat nélkül az erőforráspanel nem mutatja az áttekintést. Lásd: [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken).
3. Számítsa ki a projekteket a *Számítás* (F5) paranccsal, vagy kapcsolja be az *Automatikus ütemezés-számítás* beállítást. Hogy az áttekintés mit tesz az elavult projektekkel, az alábbi buktatók között van leírva.

### 2. Nyissa meg az áttekintést

1. Nyissa meg az egyik projektet, és válassza az *Erőforrások › Kezelés › Erőforrások* lehetőséget.
2. A jobb felső sarokban válassza a *Foglaltság* lehetőséget. Az áttekintés az éppen használt projekt erőforrástárához tartozik. Ebben a panelben nem módosíthat semmit: ez egy csak olvasható ablak.

### 3. Olvassa el a táblázatot

Minden olyan erőforrás az erőforrástárból, amely legalább egy megnyitott projektben le van foglalva, kap egy sort. A foglalás nélküli erőforrások nem jelennek meg. A legtöbb túlterhelt napot tartalmazó sorok állnak a lista tetején, utána betűrendben.

- A *Dokumentumok* megmutatja, hány projektben van lefoglalva az erőforrás, például *2 dokumentum*.
- Az *Időszak* az első naptól az utolsó napig tart, amelyen van terhelés, yyyy-mm-dd formában, például *2027-06-07 – 2027-06-14*.
- A *Csúcs / Kapacitás* szembeállítja az összes projekt együttes legnagyobb napi terhelését az erőforrástárban lévő kapacitással, például *4.0 / 3.0*. Ha van legalább egy túlterhelt nap, ez piros színnel látszik.
- A sor után álló piros jelölő, például *3 nap túlterhelt*, azokat a napokat számolja, amelyeken az összeg nagyobb a kapacitásnál. Ha az egérmutatót fölé tartja, látja a dátumokat.

### 4. Nézze meg projektenként

1. Kattintson az erőforrás neve előtti kis nyílra. A sor kinyílik.
2. A tetején a túlterhelt napok dátumai láthatók: az első öt, és ha több van, utána *… és 3 további*. Alatta projektenként látszik a név az időszakkal és az adott projekt csúcsával, például *Houses North 2027-06-07 – 2027-06-11 Csúcs: 2.0*.
3. Kattintson magára a sorra, és alul megjelenik egy hisztogram. Minden projektnek saját színe van, és az oszlopok egymásra halmozódnak. A szaggatott vonal az erőforrástár kapacitása. Ha az idővel változik, lépcsőket lát. A túlterhelt napok az oszlopok mögött piros sávot kapnak. Kattintson a sorra még egyszer, és a hisztogram bezáródik. Ha nincs sor kiválasztva, ez áll ott: *Válasszon ki egy erőforrást a hisztogram megtekintéséhez*.

### 5. Oldja meg

Az áttekintés megmutatja a problémát, de nem oldja meg. Két lehetősége van:

- Mozgasson egy tevékenységet az egyik projektben, vagy adjon neki kevesebb hozzárendelt mennyiséget naponta. Ezután újraszámítsa azt a projektet az F5 billentyűvel.
- Ha valóban csatlakozik valaki, emelje meg az erőforrástárban az erőforrás *Maximális mennyiség* értékét. Ezt az *Erőforrások › Kezelés › Erőforrások* menüpontban teszi meg, az *Erőforrástár* nézetben.

A menüszalag *Kiegyenlítés*… parancsa itt nem segít: az csak azt a projektet nézi, amelyben éppen dolgozik, és annak erőforrásait. Lásd: [Erőforrás-kiegyenlítés](docs://uitleg-nivelleren).

## Buktatók, és mit tesz ilyenkor az alkalmazás

**Az áttekintés üres.** Ekkor ez jelenik meg: *Nincsenek erőforrástári erőforrások lefoglalva a megnyitott dokumentumokban*. Ilyenkor egyik megnyitott projektben sincs olyan erőforrás az erőforrástárból, amelyet egy tevékenységhez lefoglaltak.

**Nem látja a *Foglaltság* gombot.** Az éppen használt projekt nincs erőforrástárhoz kapcsolva.

**Egy projekt nem számít bele.** Nincs megnyitva ebben a programban, más erőforrástárhoz van kapcsolva, vagy a benne lévő erőforrás az adott projekt saját erőforrása. Az áttekintés alján mindig ez áll: *Ez a nézet csak az ebben a programban megnyitott dokumentumokat látja*. Az olyan erőforrás-másolat sem számít bele, amelyet azóta eltávolítottak az erőforrástárból.

**Egy másolat vagy változat teljes egészében beleszámít.** Minden megnyitott, erőforrástárhoz kapcsolt projekt beleszámít, akkor is, ha egy másik megnyitott projekt másolata vagy változata, például egy olyan változat, amelyet egy AI-segítőtárs a `planner_duplicate_document` eszközzel készített. Az eredeti és a változat együtt olyan túlterhelést mutathat, amely a valóságban csak egyszer létezik. Az áttekintés ezt nem szűri ki csendben. Zárja be a változatot egy pillanatra, vagy úgy olvassa az adatokat, hogy ezt figyelembe veszi.

**Egy projekt elavult.** Egy projekt elavult, ha az ütemezésen újraszámítás nélkül módosított valamit. Az áttekintés ilyenkor a projektet így kezeli:

- Ha a projekt nem az aktív lap, az áttekintés maga számítja ki előre a projektet, a projekt módosítása nélkül. A táblázat fölött ekkor ez áll: *A módosított dokumentumok előre ki lettek számítva erre a nézetre. Nyomja meg az F5-öt a dokumentumban, vagy kapcsolja be az „Automatikus ütemezés-számítás” beállítást, hogy ez véglegesen így legyen*. A projekt után ez áll: *Erre a nézetre előre ki lett számítva — maga a dokumentum a régebbi dátumokat mutatja, amíg ott meg nem nyomja az F5-öt, vagy be nem kapcsolja az „Automatikus ütemezés-számítás” beállítást*. Ha az *Automatikus ütemezés-számítás* be van kapcsolva (*Beállítások › Projekt › Beállítások*, *Ütemezés* lap), az alkalmazás valóban újraszámítja az ilyen projekteket, amint megnézi az áttekintést, és az üzenet eltűnik. Ha az aktív projekt is elavult, a következő pontban leírt üzenet jelenik meg a táblázat fölött.
- Az áttekintés nem számítja ki maga azt a projektet, amelyben Ön dolgozik. Ha az elavult, ez áll a táblázat fölött: *Egy módosított dokumentum még nincs újraszámítva; az utoljára kiszámított adataival együtt szerepel itt. Nyomja meg az F5-öt abban a dokumentumban, vagy kapcsolja be az „Automatikus ütemezés-számítás” beállítást*. A projekt után pedig ez áll: *Elavult: ezek az utoljára kiszámított adatok — nyomja meg az F5-öt ebben a dokumentumban*. Figyelem: az *utoljára kiszámított adatok* kifejezés nem egészen pontos. Az áttekintés a régi kezdési dátumokat veszi át, de már a módosított időtartamot és hozzárendelést is. Ezért az adatok eltérhetnek a régi és az új ütemezéstől is, és a Gantt-diagram sávjaitól is. Csak az F5 megnyomása után bízzon bennük.
- Ha az áttekintés nem tud kiszámítani egy projektet, például a kapcsolatainak körhurkolása miatt, az a projekt nem számít bele. Ettől még szerepel a listában, ezzel a szöveggel: *Nem számít bele: az ütemezés nincs kiszámítva — aktiválja ezt a dokumentumot, és nyomja meg az F5 billentyűt*. A táblázat fölött pedig ez áll: *Legalább egy dokumentum nincs kiszámítva, ezért nem számít bele a foglaltságba*.

**Az áttekintés nem egyezik azzal, amit vár.** A kapacitás az erőforrástárból jön (az erőforrástári elem *Maximális mennyiség* értéke, vagy az *Időszakonkénti kapacitás* az adott napon), nem a projektben lévő másolat *Maximális mennyiség* értékéből. Ha az összeg egyenlő a kapacitással, az nem túlterhelés.

## Lásd még

- [Az erőforrástár](docs://uitleg-resourcebibliotheek): hogyan számítja ki az alkalmazás a foglaltságot, egy kidolgozott példával.
- [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken): projektek kapcsolása és erőforrások hozzárendelése.
- [A túlterhelés megoldása](docs://howto-overbezetting-oplossen): túlterhelés egyetlen projekten belül.
