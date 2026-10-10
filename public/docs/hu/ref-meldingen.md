# Értesítések és figyelmeztetések

Az alkalmazás három helyen jelzi, mi történik: az alsó állapotsorban, a jobb oldali oszlopban lévő *Figyelmeztetések* panelen és a rövid ideig az ablak alján megjelenő értesítésekben. Ez a cikk minden helyhez leírja, mit lát, mikor jelenik meg, és mit tehet. Azt, hogy miért kritikus vagy túlterhelt egy ütemezés, a [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad) cikk magyarázza; a túlterhelés feloldását a [Túlterhelés feloldása](docs://howto-overbezetting-oplossen) cikk, a kapcsolatok létrehozását a [Kapcsolatok létrehozása](docs://howto-relaties-leggen) cikk ismerteti.

## A három elem közötti különbség

- **Állapotsor** — rögzített sor számlálókkal. Ezek az utolsó számításból származnak, és addig maradnak meg, amíg újra nem futtatja az ütemezés-számítást.
- **Figyelmeztetések panel** — a lista a számlálók mögött, az utolsó számítás minden megállapításával. Egy kattintás a tevékenységhez, kapcsolathoz vagy erőforráshoz viszi. Az utolsó számításból származik; semmi nincs tárolva.
- **Értesítések** — rövid üzenetek arról, amit éppen tett (sikertelen mentés, elutasított kapcsolat, beolvasott importálás). Ezek újra eltűnnek, és nincsenek benne a panelben.

## Az állapotsor

Az állapotsor az alján balról jobbra ezeket mutatja:

- **Tevékenységek:** — a levéltevékenységek száma (az összefoglaló tevékenységek nem számítanak).
- **Mérföldkövek:** — a mérföldkövek száma.
- **Kritikus út: N tevékenység, N munkanap** — a kritikus tevékenységek száma és a projekt időtartama. Csak számítás után látható.
- **Befejezés:** — a projektbefejezés a számításból. Csak számítás után látható; egy üres projektnek nincs.
- **N határidő lekésve**, **N megsértett korlátozás**, **N sorrenden kívüli előrehaladás** és **N erőforrás túlterhelve** — mindegyik figyelmeztető jellel ellátott gomb, és csak akkor látható, ha a számláló nagyobb, mint 0, és van számítás. Egy kattintás megnyitja a *Figyelmeztetések* panelt (eszköztipp: *A Figyelmeztetések panel megnyitása (részletek és navigáció)*). Ha az *IFC* vagy a *Jelentés* fülön áll, az alkalmazás ugyanakkor a *Kezdőlap* fülre ugrik, mert a jobb oldali oszlop ott nincs. Az *erőforrás túlterhelve* számláló az erőforrások és hozzárendelések változása után is frissül; a többi számláló csak a *Számítás* után változik. A négy számláló csak egy válogatás. Ami a panelen más is megjelenik (csonkolt átfedés, figyelmen kívül hagyott kapcsolat, befejezést meghatározó kapcsolat nélküli hangmat, korlátozott befejezési dátum, ütemezési hiba), az nincs az állapotsorban.
- **Elavult — számítsa újra (F5)** — figyelmeztető jellel (eszköztipp: *Az ütemezés elavult — számítsa újra (F5)*). Akkor látható, amint módosít valamit, ami hat az ütemezésre, és még nem újraszámította. Ha az *Automatikus ütemezés-számítás* be van kapcsolva, nem látszik, kivéve ha a számítás hibát adott; akkor látszik.
- **Kijelölés: N tevékenység** — a kijelölt tevékenységek száma; csak kijelöléskor látható.
- **Skála:** és **Nagyítás: Npx/nap** — az idővonal időskálája és a nagyítási szint. Az időskála a nagyításból következik.
- **Nem mentett** — amíg a dokumentumnak van olyan módosítása, amely nincs a fájlban.
- **AI** — egy színes pont az AI szóval, csak ha az AI-mód be van kapcsolva. Az eszköztipp *AI-híd:* után ezek egyike áll: *Ki*, *Aktív a(z) N porton*, *A(z) N port foglalt* vagy *Hiba*. Egy kattintás megnyitja az *AI* fület.
- **Hibakereső terminál** — egy terminálgomb, csak ha a hibakereső terminál be van kapcsolva; megjeleníti vagy elrejti a terminált (*Hibakereső terminál megjelenítése* / *Hibakereső terminál elrejtése*).

## A Figyelmeztetések panel

- **Megnyitás** — *Ütemezés › Ütemezés › Figyelmeztetések*, *Nézet › Panelek › Figyelmeztetések*, vagy egy számláló az állapotsorban. A panel a jobb oldali oszlopban van, a *Tulajdonságok* és az erőforrásdokk alatt, és kibontja az összecsukott oszlopot. Alapértelmezés szerint zárva van, és munkamenetek között nem marad meg. Ha más panelek alatt van, a magasságát a szélénél húzza, és ez a magasság megmarad. A jobb felső sarokban lévő kereszt bezárja (*Bezárás*).
- **Fejlécsor** — *N hiba, N figyelmeztetés*. Ha még nincs semmi kiszámítva, ez áll itt: *Még nincs kiszámítva — nyomjon az Ütemezés-számítás (F5) gombra az ellenőrzések futtatásához.*
- **Számítás** — gomb a fejlécsorban, amely látható, amíg az ütemezés elavult vagy még nincs kiszámítva. Ugyanazt teszi, mint a menüszalagon lévő *Számítás*.
- **Figyelmeztető jel a fejlécsorban** — ha az ütemezés elavult, ezzel az eszköztippel: *Az ütemezés elavult — ez a lista az utolsó számítás eredménye. Végezzen újraszámítást (F5).* A lista nincs elrejtve, csak elavultnak van jelölve.
- **Üres lista** — *Nincs figyelmeztetés. Az ütemezés minden ellenőrzésen átmegy.*
- **Egy sor** — felül a hely (tevékenység, kapcsolat, erőforrás vagy projekt), alatta a leírás. Egy hiba saját nyolcszögletű jelet kap, egy figyelmeztetés háromszögletűt. Egy tevékenység így jelenik meg: `WBS név`. Egy kapcsolat így jelenik meg: `előd → utód (FS+2d)`, a típussal és a késleltetéssel együtt. Egy kattintás a helyre visz (eszköztipp: *Ugrás ide: …*), lásd lent. A sor, amely az aktív tevékenységhez tartozik (kapcsolatnál az utódhoz), vagy a hisztogramban kiválasztott erőforráshoz, ki van emelve.
- **Sorrend** — először a hibák; utána típusonként a lenti lista sorrendjében; egy típuson belül a dokumentum sorrendjében (kapcsolatnál az utód sorrendjében, erőforrásnál az erőforráslista sorrendjében). Az utolsó számítás után törölt tevékenység, kapcsolat vagy erőforrás kiesik a listából.

### A figyelmeztetések típusai

- **Ütemezési hiba** — *Az ütemezést nem lehetett kiszámítani: …*, utána az ok, lásd lent. Egy kattintás: ciklus esetén az alkalmazás kijelöli a ciklus összes tevékenységét, és az elsőre ugrik; más hibáknál nincs hová ugrani, és a sor nem gomb.
- **Határidő lekésve** — *A {date} határidő lekésve — korai befejezés: {date}*. A tevékenységnek van határideje, és a számítás nem tartja be. Egy kattintás a tevékenységre ugrik. A javításhoz módosítsa a logikát vagy az időtartamot, vagy helyezze át a határidőt.
- **Megsértett korlátozás** — *A {type and date} korlátozást a logika felülírja (negatív tartalékidő)*. A korlátozás nem teljesíthető a logika megsértése nélkül; a tartalékidő negatív. Egy kattintás a tevékenységre ugrik. Lásd a [Korlátozások](docs://uitleg-constraints) cikket.
- **Sorrenden kívüli előrehaladás** — *Sorrenden kívüli előrehaladás: az utód előrehaladása ellentmond a kapcsolatnak*. Az utód előrehaladása nem illik a kapcsolat típusához, például ha egy utód már folyamatban van, miközben az előd befejezés-kezdés kapcsolat esetén még nincs kész. Egy kattintás mindkét tevékenységet kijelöli, és az utód lesz az aktív. Ellenőrizze a tényleges dátumokat vagy a kapcsolatot.
- **Átfedés csonkolva** — *Az átfedést a projektkezdés csonkolja — a kapcsolat nincs teljesen kihasználva*. A kapcsolat átfedése (negatív késleltetés) a projektkezdés elé nyúlik. Egy kattintás mindkét tevékenységet kijelöli.
- **Kapcsolat figyelmen kívül hagyva** — *Kapcsolat figyelmen kívül hagyva: az előd vagy az utód hiányzik, vagy nem levéltevékenység*. A számítás nem használja a kapcsolatot. Egy kattintás kijelöli a még létező tevékenységeket. Lásd a [Kapcsolatok](docs://uitleg-relaties) cikket.
- **Hangmat befejezést meghatározó kapcsolat nélkül** — *Hangmat befejezést meghatározó kapcsolat nélkül (nincs FF/SF-előd): az időtartam nulla lesz*. Egy kattintás a tevékenységre ugrik. Lásd a [Hangmat-tevékenységek](docs://howto-hammock) cikket.
- **Befejezési dátum korlátozva** — *A befejezési dátum korlátozva: a naptár nem hagy munkával kitölthető időablakot a tevékenységnek*. A számítás elérte a napok keresési határát, például mert a naptárban nagyon hosszú, megszakítás nélküli szabadnap-sor van. Egy kattintás a tevékenységre ugrik. Lásd a [Naptárak és munkanapok](docs://uitleg-kalenders) cikket.
- **Túlterhelés** — *Túlterhelés N napon (first – last)*. Ha minden nap szabadnap, ehhez ez kerül: *az erőforrás ezeken a napokon a naptára szerint nem dolgozik*. Vegyes esetben ehhez ez kerül: *ebből N napon az erőforrás a naptára szerint nem dolgozik*. Egy kattintás kijelöli azokat a tevékenységeket, amelyekben az adott erőforrás hozzárendelése van, bekapcsolja a hisztogramot, és kiválasztja benne az erőforrást; a *Táblázat*, az *IFC* vagy a *Jelentés* lapról az alkalmazás az *Erőforrások* lapra ugrik. Lásd az [Erőforráspanel](docs://ref-resourcepaneel) cikket.

### Az ütemezési hiba okai

- *Körkörös kapcsolat a tevékenységek között: {path}* — a kapcsolatok ciklust alkotnak. A tevékenységek benne vannak az útvonalban; fordítsa meg vagy törölje az egyik kapcsolatot.
- *A naptárban nincs munkanap beállítva* — adjon a naptárnak legalább egy munkanapot, lásd a [Naptárablakok](docs://ref-kalenders) cikket.
- *Érvénytelen időtartam napokban a(z) '{task}' tevékenységnél* és *Érvénytelen, órában megadott időtartam a(z) „{task}” tevékenységnél* — a tevékenység időtartama nem érvényes szám.
- *A(z) '{task}' óraalapú tevékenység naptárában nincsenek érvényes munkaórák* — egy óraalapú tevékenység olyan naptáron, amelynek nincsenek munkaórái.
- *Érvénytelen kezdődátum a(z) '{task}' tevékenységnél* — a tevékenység kezdődátuma nem érvényes.

## Értesítések

Az értesítések a képernyő alján jelennek meg, a táblázatban, a Backstage-ben és a bemutató módban is. Az értesítés *hiba* vagy *információ*. A hiba addig marad látható, amíg rá nem kattint. Az információ 5 másodperc után eltűnik. Ezek az időzítők újraindulnak, amint az értesítéssor változik. Ha az értesítésre kattint, az bezáródik (súgószöveg: *Bezárás*). Egyszerre legfeljebb három értesítés látható. Ha egy negyedik érkezik, először a legrégebbi információ tűnik el. Ha nincs információ, a legrégebbi értesítés tűnik el. Így egy hibát soha nem szorít ki információ. Az értesítéssor kikerüli a megnyitott párbeszédpanel gombjait és a rögzített műveletsávokat.

- **Számláló ×N** — egy rögzített kulcsú értesítés az ismétlődést egy sorba vonja össze, számlálóval. Például egy mentési hiba, amely újra és újra visszatér, vagy egy elutasított kapcsolat, amelyet megismétel. Nem minden értesítés teszi ezt.
- **Bővebben** — egyes értesítéseknek van *Bővebben* hivatkozásuk vagy saját témájuk (például *Munkaszabályok ismertetése*), amely a Backstage › Súgó útmutatójához vezet.
- **Műveletgomb** — a számítási profilra vonatkozó értesítésen van egy *Számítási profil megnyitása* gomb, amely a projektinfóhoz visz.

Az alábbi lista egy válogatás, témák szerint csoportosítva. Ahol másként nincs írva, az információ.

### Mentés, megnyitás és visszaállítás

- **Mentési hiba** (hiba) — *Mentés sikertelen*, alatta az okkal. Mentéskor, másként mentéskor és egy jelentés exportálásakor.
- **Letöltésként mentve** (információ) — *Letöltésként mentve: „{name}” most a letöltések mappában van. …* A *Mentés másként* és az exportálások esetén jelenik meg, ha a környezet nem engedi, hogy az alkalmazás közvetlenül a kiválasztott helyre írjon. Két, közvetlenül egymás utáni letöltés összevonódik.
- **Letöltésként mentve (magyarázat)** (információ) — *Letöltésként mentve: „{name}” a letöltések mappában van. Ez a böngésző nem engedi, hogy az alkalmazás a saját helyére írjon, …* A *Mentés* esetén jelenik meg olyan böngészőben, amely csak letöltéssel ment. Munkamenetenként egyszer, a fájlokról szóló magyarázat hivatkozásával.
- **A böngésző nem írja vissza** (információ) — *Ez a böngésző nem engedi, hogy az alkalmazás visszaírjon ide: „{name}”. …* A *Mentés* esetén jelenik meg, olyan projektnél, amelynek van fájlja, ha a böngészőnek újra helyet kell kérnie. Munkamenetenként egyszer, a fájlokról szóló magyarázat hivatkozásával.
- **Automatikus mentés sikertelen** (hiba) — *Az automatikus mentés sikertelen*, az okkal együtt. Ez vonatkozik az automatikus mentésre a fájlba és a visszaállás összeomlás után.
- **Az erőforrástár nem menthető** (hiba) — *Az erőforrástár nem menthető*, az erőforrástár mentésekor.
- **Fájl megnyitása sikertelen** (hiba) — *A fájl megnyitása sikertelen*, az okkal együtt. Például egy legutóbbi fájlnál vagy egy importált fájlnál.
- **Régi vagy védett .mpp** (hiba) — *Ez a .mpp-fájl régebbi formátumot használ (Project 2007 vagy korábbi)…* vagy *Ez a .mpp-fájl jelszóval védett…*. Mindkettő azt tanácsolja, hogy exportálja XML-ként az MS Projectben, és nyissa meg azt a fájlt.
- **Érvénytelen XER-fájl** (hiba) — az *XER…* szövegek egyike, például *Ez a fájl nem érvényes vagy nem támogatott XER-fájl.* vagy *Az XER-fájl egy táblát kétszer tartalmaz.*, az okkal kiegészítve.
- **Az IFC nem olvasható be** (hiba) — *Az IFC nem olvasható be*, az okkal együtt, az IFC-nézetben.
- **Visszaállítás** (hiba) — *A visszaállított fájl nem olvasható*, *Visszaállítás sikertelen* és *N visszaállítási fájl nem tölthető be, ezért ki lett hagyva.* Váratlan leállás után, a visszaállításkor jelenik meg.
- **Ág sablonként mentve** (információ) — *Ág mentve sablonként: „{name}”*.
- **Üzenet egy bővítménytől** (információ, vagy hiba, ha a bővítmény hibát jelez) — *Bővítmény ({name}): {message}*. Egy bővítmény 10 másodpercenként legfeljebb három új üzenetet jeleníthet meg, így nem tölti meg az értesítéssort. Ha egy bővítmény útmutatójának egy lépése meghiúsul, ez jelenik meg: *A(z) {name} bővítmény egyik lépése hibát jelzett. Az útmutató folytatódik.* Ha egy bővítmény projektfájlja nem nyitható meg, ez jelenik meg: *A(z) {name} bővítmény projektfájlja ({file}) nem nyitható meg.* Mindkettő hiba.
- **Közben változás történt** (információ) — *Közben változás történt az AI-segítőtárs vagy egy bővítmény részéről. …* Ha a tevékenység párbeszédpanelt megszakítja, miközben az AI vagy egy bővítmény módosított valamit: a változás előtti tevékenységszerkesztések nem vonódnak vissza, hanem közönséges lépésként maradnak meg a *Visszavonás* alatt.

### Számítás

- **Az ütemezés nem számítható ki** (hiba) — *Az ütemezés nem számítható ki*, alatta az okkal (lásd *Az ütemezési hiba okai*). A *Számítás* parancsnál, dokumentumváltáskor és fájl megnyitásakor jelenik meg.
- **Állapotdátum a mai napra állítva** (információ) — *Nem volt még állapotdátum: most a mai napra ({date}) lett beállítva, mert a program az előrehaladást az állapotdátumig méri. Módosíthatja az Ütemezés → Állapotdátum menüpontban.* Akkor jelenik meg, amikor állapotdátum nélküli projektben rögzít előrehaladást.
- **Az időtartam rövidebb, mint az elvégzett munka** (információ) — *„{name}” már {N}%-ban kész: az időtartam nem lehet rövidebb a már elvégzett munkánál. Az időtartam nem módosult.*

### Kapcsolatok és hierarchia

- **Kapcsolat létrehozva** (információ) — *Kapcsolat létrehozva: {predecessor} → {successor}*.
- **Kapcsolat elutasítva** (információ) — *Ez a kapcsolat már létezik*, *Nem engedélyezett kapcsolat egy tevékenység és a saját szülő- vagy nagyszülő-összefoglaló tevékenysége között*, vagy *Ez a kapcsolat ciklust hozna létre az ütemezésben ({cycle}), ezért nem jött létre.* A ciklus megnevezi a tevékenységeket. Így látja, melyik kapcsolatot kell előbb eltávolítani vagy megfordítani.
- **Áthelyezés elutasítva** (információ) — *Ez az áthelyezés ciklust hozna létre az ütemezésben ({cycle}): egy összefoglaló tevékenység kapcsolatai az altevékenységeire is vonatkoznak. Semmi nem lett áthelyezve.*
- **Kapcsolatok kiesnek áthelyezés után** (információ) — *Az áthelyezés után N kapcsolat köt össze tevékenységet a saját összefoglaló tevékenységével. Ezek már nem számítanak bele a számításba.*
- **Kapcsolatok kihagyva beszúráskor** (információ) — *N kapcsolat nem jött létre: érvénytelen kapcsolat…*, ág beillesztésekor vagy beszúrásakor.
- **Kapcsolatok nem számítanak be importálás után** (információ) — *N kapcsolatot nem lehetett figyelembe venni a számításban. Ellenőrizze az „Elődök” és az „Utódok” oszlopot.*
- **Ismétlődő azonosítók importálás után** (információ) — *Ebben a fájlban N objektum azonosítója ismétlődik. Ezek saját azonosítót kaptak…*

### Tevékenységek szerkesztése

- **Kezdés korlátozásként rögzítve** (információ) — *„{name}” előddel rendelkezik: az új kezdés nem korábban kezdődő (SNET) korlátozásként lett rögzítve: {date}. Az újraszámítás (F5) után a tevékenység nem kezdődik ezen a dátum előtt.* Akkor jelenik meg, ha egy előddel rendelkező tevékenység kezdetét módosítja. Ha a tevékenységnek már volt ilyen korlátozása, az értesítés jelzi, hogy áthelyeződött. Több tevékenységnél egyszerre az értesítés darabszámot ad meg.
- **Kezdés nem lett alkalmazva** (információ) — *A(z) „{name}” tevékenység új kezdése nem lett alkalmazva: a tevékenységnek van előde, és a(z) {type} {date} korlátozás. Ezek határozzák meg a kezdést. A kezdés áthelyezéséhez módosítsa ezt a korlátozást.*
- **Mérföldkő elutasítva** (információ) — *A(z) '{task}' tevékenységnek vannak erőforrás-hozzárendelései, ezért nem lehet mérföldkő. Előbb távolítsa el a hozzárendeléseket.* vagy *A(z) '{task}' összefoglaló tevékenység altevékenységekkel rendelkezik, ezért nem lehet mérföldkő.* Ez akkor jelenik meg, ha a tevékenységet mérföldkővé alakítja a párbeszédpanelen, a tulajdonságok panelen, a helyi menüben vagy a táblázatban.
- **Hozzárendelések áthelyezve altevékenységre** (információ) — *A(z) {resources} hozzárendelése át lett helyezve a(z) '{phase}' tevékenységről az új '{child}' altevékenységre: egy összefoglaló tevékenység nem tartalmaz saját hozzárendeléseket.* Akkor jelenik meg, ha egy hozzárendeléssel rendelkező tevékenység altevékenységeket kap.
- **Mérföldkő-jelölés eltávolítva** (információ) — *A(z) '{phase}' mérföldkőnek mostantól altevékenységei vannak, és összefoglaló tevékenység lett; a mérföldkő-jelölés el lett távolítva.*
- **Összefoglaló tevékenység elutasítva** (információ) — *„{phase}” nem lehet összefoglaló tevékenység: …*, az okkal együtt, és *Semmi nem változott.*
- **Cellák kihagyva beillesztéskor** (információ) — *N cella kihagyva: csak olvashatók (például automatikusan számozott WBS-kód vagy számított oszlop).*
- **Hivatkozások törölve beillesztéskor** (információ) — *N hivatkozás nem létezett ebben a dokumentumban, ezért törölve lett (tevékenységnaptárak, egyéni tevékenységtípusok, tevékenységkódok vagy egyéni mezők a forrásdokumentumból).*
- **Munkaszabály módosította az időtartamot** (információ) — *A munkaszabály a naptármódosítás után N tevékenység időtartamát módosította (a munka megmaradt, a napi órák száma változott).* A *Munkaszabályok ismertetése* hivatkozással együtt jelenik meg.

### Primavera (XER)

- **XER-fájl megnyitva** (információ) — *XER-fájl megnyitva: N projektdokumentum.* Fájlonként egy értesítés jelenik meg, akkor is, ha a fájl több projektet nyit meg. Van hozzá *Bővebben* hivatkozás, és alatta részletsorok állnak. Ez mindig megjelenik: *N projekt találva.* Csak akkor, ha a szám nagyobb mint 0: *N üres projekt kihagyva.*, *N alapterv-projekt kizárva.*, *N alapterv létrehozva.*, *N nem létező alapterv-hivatkozás figyelmen kívül hagyva.*, *Biztonsági alapterv-tartalék használva.* és *N projektközi kapcsolat megőrizve.* Csak az UTF-8-tól eltérő kódolás esetén: *Szövegkódolás megállapítva: {encoding}.* Ezenkívül, ha a szám nagyobb mint 0: *N elemzési megállapítás.*, *N naptármegállapítás.*, *N számformátum-probléma.*, *N tartalék felsorolási érték.* és *N P6-ütemezési beállítás biztonságos tartalékot használt.*
- **Dátumok Primavera szerint** (részletsor ugyanabban az értesítésben) — *N tevékenység a Primavera által rögzített dátumokat mutatja (nem lett újraszámítva).*, vagy ha a mód nincs bekapcsolva, *N tevékenység eltér a fájl dátumaitól – megjelenítheti őket.*
- **XER-forrásarchívum használhatatlan** (információ) — *Az XER-forrásarchívum ebben a fájlban használhatatlan, ezért kimaradt; maga a projekt teljes egészében megnyílt.* Az okot (például *Ok: az ellenőrző összeg nem egyezik a forrásbájtokkal, az archívum sérült.*) és a következményt (*Az ütemezés, a számítási profil és az IFC-ből származó összes projektadat teljes. …*) is megadja. Akkor jelenik meg, ha olyan IFC-fájlt nyit meg, amelyben egy korábban mentett XER-forrásarchívum nem használható.
- **Export elveszíti az XER-adatokat** (információ) — *A(z) {format} formátumba történő exportáláskor elvesznek a XER-forrásadatok.* Egy projekt sikeres exportálása után, IFC-től eltérő formátumba, ha a projektnek olyan adata van, amely csak XER-fájlban létezik. *Bővebben* hivatkozással.

### Importálás, exportálás és számítási profil

- **Dátumok a fájl szerint** (információ) — *N tevékenység a fájlban rögzített dátumokat mutatja (nem lett újraszámítva).* vagy *N tevékenység eltér a fájl dátumaitól – megjelenítheti őket.* Rögzített dátumokat tartalmazó fájl megnyitásakor jelenik meg.
- **Munka és munkaszabályok láthatók** (információ) — *Ez a fájl mentett munkát vagy saját munkaszabályokat tartalmaz; a munkaszabály és a hátralévő munka ennél a projektnél látható.*
- **MS Project-ütemezés beolvasva** (információ) — *Ez az MS Project-fájl N tevékenységet tartalmaz szünetes, simított vagy munkamennyiség alapú ütemezéssel. A program ilyenként olvassa be és jeleníti meg.*
- **Szünetek nem exportálva** (információ) — *N szünetes tevékenység szünetek nélkül lett exportálva. Az MS Project és a P6 csak munkaeloszlásként ismeri a szüneteket.* Az MS Projectbe vagy a Primaverába történő exportáláskor jelenik meg.
- **Projektkezdés áthelyezve** (információ) — *A projektkezdés megváltozott: N tevékenység, amelynek nincs elődje vagy korlátozása, az új kezdő dátumra tolódott.*
- **Dátumablak már nem irányít** (információ) — *Az MS Project dátumablaka a szerkesztés után már nem irányít N tevékenységet; …* Dokumentumonként egyszer.
- **Kiegyenlítési késleltetés kerekítve** (információ) — *A kiegyenlítés N tevékenység MS Project-beli, percre pontos kiegyenlítési késleltetését egész munkanapokra kerekíti.* Dokumentumonként egyszer.
- **Számítási profil alkalmazva** (információ) — *Ez a projekt a(z) {profile} számítási profillal számol. Módosítsa a Fájl → Projektinfó → Számítási profil és beállítások menüpontban.* A *Számítási profil megnyitása* gombbal. Profil alkalmazása után, szükség esetén, megjelenik: *Az alkalmazás után N tevékenység tolódott el.*
