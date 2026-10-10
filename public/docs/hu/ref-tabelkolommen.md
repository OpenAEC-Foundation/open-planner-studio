# Táblázatoszlopok

A tevékenységtáblázatban 86 rögzített oszlop van. Ezenkívül a projekt minden tevékenységkódja és egyéni mezője egy-egy oszlopot kap, és minden alapterv nyolc oszlopot. Ez a cikk minden oszlopnál leírja, mit mutat, szerkeszthető-e, és milyen formában íródik ki az értéke. Az oszlopok kiválasztását és elrendezését a [Táblázatoszlopok testreszabása](docs://howto-tabelkolommen-aanpassen) cikk ismerteti.

## Hol választja ki az oszlopokat

A Gantt mellett lévő tevékenységtáblázatnak és a *Táblázat* lapon lévő táblázatnak külön oszlopválasztása van. A fejléc jobb oldalán lévő plusz jel megnyitja az oszlopválasztót (ablakcím: *Oszlop kiválasztása*). A *Táblázat* lapon a *Táblázat › Oszlopok › Oszlopok kiválasztása…* menüpont is használható. A választó kategóriánként sorolja fel az oszlopokat: *Tevékenység*, *Ütemezés*, *Korlátozások*, *Kapcsolatok*, *Erőforrások*, *Előrehaladás*, *Számított*, *Alapterv*, *Egyéni* és *Technikai*. Név szerint kereshet. A *Nemrég használt* a lista tetején áll. Az *Alapértelmezés visszaállítása* visszaállítja az alapértelmezett oszlopokat.

Alapértelmezés szerint a Gantt melletti táblázat a *WBS*, a *Tevékenység neve* és az *Időtartam* oszlopot mutatja. A *Táblázat* lapon lévő táblázat a *WBS*, a *Tevékenység neve*, az *Időtartam*, a *Kezdés*, a *Befejezés*, a *Tevékenységtípus*, a *Kritikus*, a *Teljes tartalékidő* és az *Előrehaladás* oszlopot mutatja, valamint a projekt minden tevékenységkódjához és egyéni mezőjéhez egy-egy oszlopot.

## Hogyan olvashatók és szerkeszthetők az értékek

- **Számított oszlopok** — a *Számított* kategória oszlopai és néhány más oszlop csak olvasható: a számításból származnak. Ha csak olvasható cellát próbál szerkeszteni, az alkalmazás ezt írja: *Ez a számított oszlop nem szerkeszthető.* Ez a szöveg minden csak olvasható cella általános üzenete, akkor is, ha az oszlop nem számított. Ha valamit módosít, és emiatt ezek elavulttá válnak, a mellettük lévő *elavult* jelzés addig látszik, amíg meg nem nyomja a *Számítás* gombot.
- **Dátumok** — a dátumok abban a formában jelennek meg, amelyet a *Beállítások* alatt, a *Nézet* lapon, a *Dátumformátum* részben választott.
- **Időtartamok és tartalékidő** — az időtartam a tevékenység egységében jelenik meg (`5d`, `12h`), vagy az *Időtartam megjelenítése* beállítás szerint (*Automatikus (tevékenységenként saját egység)*, *Mindig napok* vagy *Mindig órák*). A tartalékidő munkanapokban jelenik meg, két tizedesjeggyel, a nyelvének megfelelő tizedesjelet használva.
- **Igen/Nem** — az igen/nem érték *Igen* vagy *Nem* alakban jelenik meg; az üres érték gondolatjelként (—).
- **Szerkesztés** — írjon be vagy válasszon ki egy értéket. Az érvénytelen értéket az alkalmazás elutasítja, és a cella alatt megadja az okot, például *Adjon meg egy érvényes időtartamot, például 5d vagy 8h.* vagy *Adjon meg egy százalékot 0 és 100 között.* Egy cellablokk beillesztésekor az alkalmazás cellánként dolgozza fel az adatokat. A csak olvasható cellákat kihagyja, és jelzi, hogy hányat.

## Tevékenység

- **Tevékenység neve** — a tevékenység neve. Szerkeszthető; kötelező. Az összefoglaló tevékenység félkövéren jelenik meg, a névcella háttere enyhén színezett. A mérföldkő félkövéren jelenik meg, a mérföldkő színében (ugyanabban a színcsaládban, mint a mérföldkő a Gantt-diagramon). Egy egyszerű tevékenység nem változik. Ez csak formázás: a kijelölés, a húzás és a szerkesztés ugyanúgy működik.
- **Leírás** — a leírás. Szerkeszthető; szabad szöveg.
- **WBS** — a WBS-kód. Szerkeszthető és kötelező, de csak olvasható, amíg a *WBS automatikus* be van kapcsolva.
- **Tevékenységtípus** — a tevékenység típusa (*Építés*, *Szerelés*, *Bontás*, *Logisztika*, *Ellenőrzés*, *Áthelyezés*, *Felújítás*, *Karbantartás* vagy *Egyéb*). Lista segítségével szerkeszthető.
- **Egyéni tevékenységtípus** — a projekt egyéni tevékenységtípusa, vagy gondolatjel. Szerkeszthető a projekt egyéni típusainak listájából.
- **Szín** — a tevékenység mentett színe, színkódként, például `#1a73e8`. Színválasztóval szerkeszthető. Az IFC-fájlban tárolódik, de egyetlen sáv vagy jelentés sem használja; a sávszíneket a *Nézet › Alaptervek és előrehaladás › Sávszínek* menüpontban állítja be.
- **Megjegyzések** — a megjegyzések a `✓ text; ○ text` formában. Szerkeszthető, ha legfeljebb egy megjegyzés van (ekkor a szövegét szerkesztheti). Több megjegyzésnél csak olvasható.

## Ütemezés

- **Mérföldkő** — az, hogy a tevékenység mérföldkő-e. Szerkeszthető. Bekapcsolásakor az időtartam 0 lesz. Az alkalmazás ezt elutasítja összefoglaló tevékenységnél és hozzárendelésekkel rendelkező tevékenységnél.
- **Mérföldkőtípus** — *Kezdő mérföldkő* vagy *Befejezési mérföldkő*, vagy gondolatjel az automatikus beállításhoz. Csak mérföldkövön szerkeszthető.
- **Kötelező mérföldkő** — a *Kötelező (szerződéses)* jelölő. Csak mérföldkövön szerkeszthető.
- **Kiegyenlítési prioritás** — egész szám 0 és 1000 között, alapértelmezett érték: 500. Szerkeszthető. Az 1000 rögzíti a tevékenységet a kiegyenlítéshez.
- **Megszakítások** — a megszakítások száma, például `Split gaps: 2`, vagy gondolatjel. Csak olvasható; a *Tulajdonságok* panelen szerkesztheti őket.
- **Munkaszabály** — a tevékenység munkaszabálya. Üres érték esetén a projekt alapértelmezett szabálya érvényes. Listából szerkeszthető, de mérföldkőnél, összefoglaló tevékenységnél és hangmatnál üres és csak olvasható. Csak akkor látható a választóban, ha a munkaszabályok láthatók (*Munkaszabályok és munka megjelenítése*, vagy ha a fájl munkaszabályokat tartalmaz).
- **Hangmat (származtatott időtartam)** — az, hogy a tevékenység hangmat-e. Szerkeszthető, kivéve mérföldkőnél vagy összefoglaló tevékenységnél.
- **Naptár** — a tevékenység saját naptárának azonosítója. Üres (—) érték a projekt naptárát jelenti. Azonosítót írhat be, vagy kiválaszthatja a javaslatok közül; az ismeretlen azonosítót az alkalmazás elutasítja. Megjegyzés: a cella jelenleg a név helyett a belső azonosítót mutatja. Jobb, ha a *Tulajdonságok* panelen választ naptárat.
- **Időtartam típusa** — *Munkaidő* (az időtartam a naptár munkanapjaiban vagy munkaóráiban számít) vagy *Eltelt időtartam* (az időtartam folyamatos óraidőben számít, naptár nélkül). Szerkeszthető.
- **Időtartam egysége** — *Napok* vagy *Órák*. Szerkeszthető, kivéve összefoglaló tevékenységnél, hangmatnál vagy mérföldkőnél. A váltás csak akkor sikerül, ha az átváltás pontos, és az *Óraalapú tervezés bekapcsolása* be van kapcsolva.
- **Időtartam** — a tevékenység időtartama a tevékenység egységében, vagy az *Időtartam megjelenítése* beállítás szerint. Szerkeszthető: írja be `5d`, `12h` vagy `1h 30m` alakban. A tevékenység egységében megadott szám is elfogadott. Csak olvasható összefoglaló tevékenységnél, hangmatnál és 0 időtartamú mérföldkőnél.
- **Kezdés** — a megjelenített kezdés, ugyanaz a dátum, mint a Gantt-sáv kezdete. Szerkeszthető. Ha előddel rendelkező tevékenységnek új kezdést ad, a tevékenység erre a dátumra a *Nem korábban kezdődő (SNET)* korlátozást kapja. Összefoglaló tevékenységnél vagy hangmatnál csak olvasható, kivéve, ha kézzel ütemezett.
- **Befejezés** — a megjelenített befejezés. Szerkeszthető: az új befejezésből új időtartam lesz. Az alkalmazás elutasítja befejezett tevékenységnél, mérföldkőnél, eltelt időtartamú tevékenységnél és szünetekkel rendelkező tevékenységnél. Elutasítja a kezdésnél korábbi befejezést is (*A befejezés a kezdés előtt van.*). Összefoglaló tevékenységnél vagy hangmatnál csak olvasható, kivéve, ha kézzel ütemezett.
- **Ütemezett kezdés** — az a kiindulópont, ahonnan a számítás indul. Nem feltétlenül a megjelenített kezdés. Szerkeszthető; ugyanaz a hatása, mint a *Kezdés* mező kitöltésének.
- **Ütemezett befejezés** — a megadott befejezés. Csak kézzel ütemezett tevékenységnél szerkeszthető. Egyébként az alkalmazás ezt írja: *A tervezett befejezés csak kézzel ütemezett tevékenységnél érvényes. Módosítsa a befejezést a Befejezés oszlopban, vagy az időtartamon keresztül.*

## Korlátozások

- **Korlátozástípus** — a korlátozás típusa, a *Lehető legkorábban (ASAP)* típustól a *Kötelező befejezés (MFO)* típusig. Szerkeszthető. Korlátozás nélküli tevékenység *ASAP* értéket mutat.
- **Korlátozás dátuma** — a korlátozás dátuma. Szerkeszthető.
- **Kötelező korlátozás** — a *Kötelező (pin-logika)* jelölő. Csak *MSO* és *MFO* típusnál szerkeszthető.
- **Másodlagos korlátozástípus** — a második korlát típusa, vagy gondolatjel. Szerkeszthető. A táblázat minden típust felkínál, de a nem engedélyezett kombinációt az alkalmazás elutasítja. A másodlagos korlátozásnak *SNET*, *FNET*, *SNLT* vagy *FNLT* típusúnak kell lennie. Az elsődleges korlátozásnak korlátnak kell lennie (nem *ASAP*, *ALAP*, *MSO*, *MFO* vagy kötelező korlátozás), és a két korlátnak ellentétes oldalt kell határolnia (alsó korlát *SNET*/*FNET* és felső korlát *SNLT*/*FNLT*, vagy fordítva).
- **Másodlagos korlátozás dátuma** — a második korlát dátuma. Szerkeszthető.
- **Határidő** — a befejezés céldátuma. Szerkeszthető.

## Kapcsolatok

- **Elődök** — az elődök a `WBS type±lag` alakban, `; ` elválasztóval, például `1.2 FS+2d`. Szerkeszthető, ugyanebben az alakban írva. Projektközi kapcsolatot itt nem ad hozzá, hanem az *Ütemezés › Kapcsolatok › Összekapcsolás › Projektközi kapcsolat hozzáadása…* menüpontban.
- **Utódok** — az utódok ugyanebben az alakban. Szerkeszthető.
- **Meghatározó kapcsolatok** — azok a kapcsolatok, amelyek a tevékenység dátumát meghatározzák, `← 1.2` (előd) vagy `→ 1.4` (utód) alakban. Csak olvasható. Elavult, amíg meg nem nyomja a *Számítás* gombot.
- **Szabad tartalékidő** (a *Kapcsolatok* kategóriában) — a szabad tartalékidő kapcsolatonként, `← 1.2: 3d` alakban. Nem azonos a *Számított* alatti *Szabad tartalékidő* oszloppal, amely a tevékenység saját tartalékidejét mutatja. Csak olvasható.
- **Figyelmeztetések** — figyelmeztetések kapcsolatonként, például *Rossz sorrend* vagy *Nincs beszámítva a számításba*. Csak olvasható. Lásd: [Értesítések és figyelmeztetések](docs://ref-meldingen).

## Erőforrások

- **Hozzárendelt erőforrások** — a hozzárendelt erőforrások nevei, vesszővel elválasztva. Szerkeszthető: név hozzáadásakor az alkalmazás napi 1 mennyiséggel hozzárendeli az erőforrást, név törlésekor a hozzárendelés megszűnik. Csak olvasható mérföldkőnél vagy összefoglaló tevékenységnél.
- **Napi hozzárendelt mennyiség** — az erőforrásonkénti mennyiség, `Name: 1; Name: 0.5` alakban. Szerkeszthető, ha a tevékenységhez hozzárendelés tartozik.
- **Eloszlási görbe** — az erőforrásonkénti görbe, `Name: Uniform` alakban. Szerkeszthető, ha a tevékenységhez hozzárendelés tartozik.
- **Munkaablak kezdete** és **Munkaablak befejezése** — az erőforrásonkénti munkaablak egy importált fájlból, `Name: date` alakban. Csak olvasható.
- **Tervezett munka (órában)** és **Tényleges munka (órában)** — az erőforrásonkénti tervezett és tényleges munka órában, `Name: 12` alakban, importált fájlból. Csak olvasható.
- **Hátralévő munka (órában)** — az erőforrásonkénti hátralévő munka órában, `Name: 6` alakban. Ha van tárolt munka, az jelenik meg, egyébként a hátralévő időtartam × mennyiség. Szerkeszthető olyan, hozzárendeléssel rendelkező tevékenységnél, amelyre munkaszabály vonatkozik. Csak akkor látható a választóban, ha a munkaszabályok láthatók.

## Előrehaladás

- **Státusz** — *Nem kezdődött el*, *Folyamatban* vagy *Befejezett*. Szerkeszthető, kivéve összefoglaló tevékenységnél.
- **Előrehaladás** — a százalék, `40%` alakban. Szerkeszthető, 0 és 100 közötti számmal, kivéve összefoglaló tevékenységnél.
- **Tényleges kezdés** — az a dátum, amikor a tevékenység elkezdődött. Szerkeszthető, kivéve összefoglaló tevékenységnél.
- **Tényleges befejezés** — az a dátum, amikor a tevékenység befejeződött. Szerkeszthető, kivéve összefoglaló tevékenységnél.
- **Tényleges időtartam** — a tényleges időtartam számként. Szerkeszthető, kivéve összefoglaló tevékenységnél.
- **Hátralévő időtartam** — a hátralévő időtartam a tevékenység egységében. Szerkeszthető, kivéve összefoglaló tevékenységnél.
- **Folytatás dátuma** és **Leállítás dátuma** — a futó tevékenység folytatása és leállítása MS Project vagy Primavera fájlból. Csak olvasható.

Az előrehaladási oszlopok az előrehaladásra vonatkozó szabályokat követik: az állapotdátum utáni tényleges dátumot az alkalmazás elutasítja. Összefoglaló tevékenységnél az alkalmazás ezt írja: *Az összefoglaló tevékenység előrehaladását az altevékenységek határozzák meg, ezért itt nem módosítható.*

## Számított

Ebben a kategóriában minden oszlop csak olvasható.

- **Kiegyenlítési késleltetés** — hány munkanappal késleltette a kiegyenlítés a tevékenységet. Gondolatjel, ha nem alkalmaztak kiegyenlítést.
- **Korai kezdés** és **Korai befejezés** — a számítás legkorábbi dátumai.
- **Legkésőbbi kezdés** és **Legkésőbbi befejezés** — azok a legkésőbbi dátumok, amelyeken a tevékenység még elkezdődhet vagy befejeződhet a projekt késedelme nélkül.
- **Szabad tartalékidő** — azok a munkanapok, amennyivel a tevékenység csúszhat anélkül, hogy egy utódot késleltetne.
- **Teljes tartalékidő** — azok a munkanapok, amennyivel a tevékenység csúszhat anélkül, hogy a projektbefejezést késleltetné. Negatív, ha a korlátozást vagy a határidőt nem lehet betartani.
- **Kritikus** — *Igen*, ha a tevékenység a kritikus úton van.
- **Zavaró tartalékidő** — a teljes tartalékidő mínusz a szabad tartalékidő.
- **Közel kritikus** — *Igen* egy közel kritikus tevékenységnél. Csak akkor van kitöltve, ha a *Közel kritikus jelölése* be van kapcsolva (*Projektinfó*, blokk *Számítási profil és beállítások*). Egyébként gondolatjel.
- **Tartalékidő-útvonal** — a tartalékidő-útvonal sorszáma; az 1 a legkritikusabb. Csak akkor van kitöltve, ha a *Több tartalékidő-útvonal* be van kapcsolva. Egyébként gondolatjel.
- **Rögzített dátumok forrása** — rögzített dátumokat tartalmazó fájlnál: *Eltér* vagy *Részben nincs rögzítve*. Csak ilyen fájlnál látható a választóban. Ha nincsenek rögzített dátumok, a *Nincs rögzítve* jelenik meg a legkésőbbi dátum és a tartalékidő oszlopokban.

Lásd: [Kritikus út és tartalékidő](docs://uitleg-kritiek-pad).

## Alapterv

A projekt minden alaptervéhez oszlopok adódnak hozzá. Az alapterv neve az oszlop neve elé kerül (`<baseline> — Scheduled start`). Ezek csak olvashatók. Ha egy tevékenység nincs benne az alaptervben, gondolatjel jelenik meg. A súgószöveg: *Nem szerepel ebben az alaptervben*.

- **Ütemezett kezdés**, **Ütemezett befejezés** és **Időtartam** — a kezdés, a befejezés és az időtartam úgy, ahogy az alaptervben rögzítették.
- **Kezdési eltérés** és **Befejezési eltérés** — a munkanapok száma az alapterv és a megjelenített kezdés vagy befejezés között, a projekt naptárában. Pozitív, ha a tevékenység később van.
- **Időtartam-eltérés** — az aktuális időtartam mínusz az alapterv időtartama, munkanapokban.

## Egyéni

- **Tevékenységkód** — egy oszlop tevékenységkódonként, a kód nevével. A kiválasztott érték kódját mutatja. Szerkeszthető: beírhatja a kódot, vagy kiválaszthatja a javaslatok közül. Az ismeretlen kódot az alkalmazás elutasítja. Ha egy kód többször szerepel, az alkalmazás kéri, hogy válassza ki a listából.
- **Egyéni mező** — egy oszlop egyéni mezőnként, a mező nevével. A bevitel a típushoz igazodik: szöveg, szám, egész szám, költség, dátum vagy igen/nem. Szerkeszthető.

Ezek az oszlopok ahhoz a projekthez tartoznak, amelyben a kód vagy a mező található. Lásd: [Kódok és egyéni mezők](docs://howto-codes-en-velden).

## Technikai

Ebben a kategóriában minden oszlop csak olvasható. Ezek olyan adatokat mutatnak, amelyeket az alkalmazás tárol, de szokásos oszlopban nem jelenít meg, például egy importálás ellenőrzéséhez.

- **Tevékenység-azonosító** — a tevékenység belső azonosítója.
- **Szülő tevékenység azonosítója** és **Gyermek tevékenységek azonosítói** — a szülő- és gyermektevékenységek azonosítói.
- **Erőforrás-azonosítók** — a tevékenységhez tartozó erőforrások azonosítói.
- **Hozzárendelés-azonosító**, **Hozzárendelt tevékenység azonosítója** és **Hozzárendelt erőforrás azonosítója** — a tevékenység hozzárendeléseinek, tevékenységeinek és erőforrásainak azonosítói.
- **Időtartam (perc)** és **Hátralévő időtartam (perc)** — az időtartam és a hátralévő időtartam percben. Csak órában mért tevékenységnél van kitöltve.
- **Kiegyenlítési késleltetés (perc)** és **Eltelt kiegyenlítési késleltetés** — az MS Project kiegyenlítési késleltetése percben, és az, hogy óraidőben számít-e.
- **Kézzel ütemezett** — az, hogy a tevékenység kézzel van-e ütemezve.
- **MS Project tevékenységtípusa (import)** és **Munkamennyiség alapú** — a tevékenység típusa és a munkamennyiség-alapú jelölő úgy, ahogy az MS Projectben szerepeltek.
- **Primavera P6 eredet** — a forrásmezők egy Primavera-fájlból, `key: value` alakban.
- **Explicit összefoglaló tevékenység** — az, hogy a tevékenység altevékenységek nélküli explicit összefoglaló-e (Primavera-fájlból).
- **Időfázisos befejezési alsó határ**, **Időfázisos kezdési horgony**, **Időfázisos időtartam-szakaszok** és **Időfázisos eloszlások** — az órák eloszlása egy MS Project-fájlból, dátumok és számok formájában.
- **Tevékenységkód-adatok**, **Egyéni mező adatai** és **Megjegyzésadatok** — a kódhozzárendelések, egyéni mezők és megjegyzések száma.
- **Belső kapcsolati adatok** és **Projektközi kapcsolati adatok** — a belső és a projektközi kapcsolatok száma.
- Az egyes alaptervekhez a **Mérföldkő** és a **Mérföldkőtípus** is itt van, úgy, ahogy az alapterv rögzítette.
