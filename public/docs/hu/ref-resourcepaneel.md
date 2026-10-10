# Erőforráspanel

Az erőforráspanelen kezeli az erőforrásokat: azt, hogy mi áll rendelkezésre, milyen kapacitással és melyik naptárral. A Gantt alatti hisztogram és a túlterhelés is ehhez tartozik. Ez a cikk minden mezőnél és gombnál leírja, mit tesz, mi az alapértelmezett érték, és mit lát belőle. Az erőforrások létrehozását és hozzárendelését itt találja: [Erőforrások kezelése](docs://howto-resources-beheren) és [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen). A túlterhelés megoldását itt: [Túlterhelés megoldása](docs://howto-overbezetting-oplossen).

## Hol találja

- **Teljes panel** — *Erőforrások › Kezelés › Erőforrások* vagy *Nézet › Panelek › Erőforrások*. Ez átveszi a munkaterületet; a jobb felső sarokban lévő kereszt bezárja.
- **Erőforrás-dokkoló** — *Erőforrások › Kezelés › Erőforrás-dokkoló* vagy *Nézet › Panelek › Erőforrás-dokkoló*: kompakt lista a jobb oldali oszlopban, a Gantt mellett. Lásd lentebb.
- **Hisztogram** — *Erőforrások › Hisztogram › Hisztogram* vagy *Nézet › Panelek › Hisztogram*: egy csík a Gantt alatt. Lásd lentebb.
- **Nézetek** — ha a projekt erőforrástárhoz tartozik, a panel jobb felső részén ezek közül választhat: *Erőforrástár*, *Projekt* és *Foglaltság*. Erőforrástár nélkül csak a projekttáblázat van. Minden megnyitáskor a panel a *Projekt* nézettel indul, így a megosztott erőforrástárba nem kerül véletlenül.

## Új erőforrás

- **Új erőforrás a projektben** (az *Erőforrástár* nézetben *Új erőforrás az erőforrástárban*) — gomb a jobb felső sarokban. A táblázat alján piszkozatsort nyit. Semmi sem jön létre, amíg nem ad meg nevet, és ki nem lép a sorból (vagy meg nem nyomja az Enter billentyűt). Ha üresen kattint el, vagy megnyomja az Esc billentyűt, nem marad semmi: sem erőforrás, sem lépés a *Visszavonás* alatt. A mezőket bármilyen sorrendben kitöltheti; minden egyszerre kerül be. Az Enter vagy a lefelé nyíl rögzíti a sort, és új piszkozatsort nyit. A Shift+Enter vagy a felfelé nyíl rögzíti a sort, és visszaviszi a táblázatba. A piszkozatsorban nincs a kapacitás kinyitója, a naptárceruza és a kuka, mert ezek egy még nem létező erőforrásra hatnak. Az *Új erőforrás* gomb az *Erőforrások › Kezelés* lapon ugyanezt teszi.
- **Rácsnavigáció** — a táblázatban az Enter és a Shift+Enter, valamint a fel- és lefelé nyíl mozgatja a kurzort a sorok között. Az utolsó soron az Enter új piszkozatsort nyit.

## A Projekt nézet

Ez a táblázat azt mutatja, mit használ ez a projekt. Minden sor egy erőforrás. A szöveges mezők és az alapdíj változásai akkor lépnek érvénybe, amikor elhagyja a mezőt, és egy lépésnek számítanak a *Visszavonás* alatt.

- **Szín** — színválasztó. Alapértelmezett érték: az első szabad szín a palettáról. Hatás: az erőforrás-kiemelés színe a Gantt-sávok alatt (*Nézet › Alaptervek és előrehaladás › Erőforrás-kiemelés*) és a színminta színe a dokkolóban.
- **Név** — az erőforrás neve. Üres nevet nem tartunk meg; a mező visszaáll a régi névre.
- **Típus** — *Munkaerő*, *Gép*, *Anyag*, *Alvállalkozó* vagy *Brigád*. Alapértelmezett érték új erőforrásnál: *Munkaerő*. Hatás: az *Anyag* típusnál van *Mértékegység* mező, és az nem számít bele a hisztogram *Összes erőforrás* összegébe; a kiegyenlítés kihagyja az anyagot. A *Brigád* típus választható más erőforrások *Brigád* mezőjében. A többi típus ugyanúgy számol.
- **Maximális mennyiség** — az erőforrás napi rendelkezésre álló mennyisége: egy szám, nagyobb mint 0 (törtek is megengedettek). Alapértelmezett érték: 1. Hatás: a napi kapacitás. Ha a terhelés ennél nagyobb, az erőforrás túlterhelt. A mellette lévő nyíl kinyitja az *Időszakonkénti kapacitás* részt; a nyíl melletti szám a lépések száma.
- **Időszakonkénti kapacitás** — lépések, *Dátumtól* (egy dátum) és *Maximális mennyiség* megadásával. A *Lépés hozzáadása* gomb egy lépést ad hozzá a mai dátummal és 1-gyel. Lépés nélkül ez áll: *Nincsenek lépések — az egyenletes maximális mennyiség mindig érvényes.* Hatás: egy lépés dátumától a *Maximális mennyiség* érvényes az egyenletes érték helyett. Az a lépés érvényesül, amelynek dátuma az adott napon vagy az előtt van, és a sorrendben a legutolsó.
- **Naptár** — lista: *Projektnaptár* (alapértelmezett), a projekt naptárai, és *+ Erőforrás-naptár* egy új naptárhoz. A ceruza (*Szerkesztés*…) megnyitja a kiválasztott naptárat; a *Projektnaptár* esetén nem használható. Hatás: a napok, amelyeken az erőforrás dolgozik. Szabadnapon a kapacitás 0. Ha akkor munka van tervezve, az erőforrás túlterhelt lesz, ezzel az okkal: *Az erőforrás a(z) „…” naptár szerint ezen a napon nem dolgozik.* Az erőforrás-naptár nem változtatja meg a tevékenység dátumait. Lásd: [Naptárablakok](docs://ref-kalenders).
- **Alapdíj/óra** — a költség óránként. Üres = nincs alapdíj; egy érvénytelen szám esetén a korábbi érték marad. Hatás: nincs hatás az ütemezésre vagy a terhelésre. Az alapdíj határozza meg az *Összesen* oszlopot, az IFC-fájlban tárolódik, és az MS Project (standard rate) és a Primavera P6 XML (price per unit) exportálásakor is átíródik.
- **Összesen** — csak olvasható: a terhelt órák × az alapdíj, két tizedesjegyre. *—*, ha nincs alapdíj vagy terhelés. Alul az *Összesen* sor összeadja az összes erőforrást. Az órák az utolsó számításból származnak, és a hozzárendelt mennyiség × napi órák szerint számítódnak a tevékenység naptárában. Elavult? Nyomja meg a *Számítás* gombot.
- **Mértékegység** — az anyag mértékegysége, például `m³`. Csak az *Anyag* típusnál tölthető ki (súgószöveg: *Csak az Anyag típusú erőforrásoknál tölthető ki.*). Hatás: csak felirat; nem számol.
- **Brigád** — a brigád, amelyhez az erőforrás tartozik, a *Brigád* típusú erőforrások közül. Alapértelmezett érték: *Nincs*. Hatás: csak csoportosítás; egy brigád kapacitása és terhelése nem a tagjainak összege.
- **Törlés** (a kuka) — törli az erőforrást. Ha vannak hozzárendelései, az alkalmazás először ezt kérdezi: *„…” … hozzárendeléssel rendelkezik. Törli?* Egy pipa megerősíti, egy kereszt megszakítja.
- **Az erőforrástárba** — csak akkor látható, ha a projekt erőforrástárhoz tartozik, és az erőforrás neve még nem az erőforrástárból jön. Az erőforrást az erőforrástárba teszi, vagy összekapcsolja az azonos nevű meglévő elemmel, és jelzi, mi történt (*Hozzáadva.*, *Már szerepelt az erőforrástárban — most hozzá lett kapcsolva.* vagy *A meglévő erőforrástár-elemhez lett kapcsolva — az értékek eltérnek, lásd a jelölést.*).
- **Leválasztás az erőforrástárról** — a leválasztás-ikon az olyan erőforrásnál, amely az erőforrástárból származik. Eltávolítja az eredetet; utána minden mező ismét szabadon szerkeszthető.

Erőforrások nélkül ez áll: *Még nincsenek erőforrások. Adjon hozzá egyet a kezdéshez.* Ha a projekt erőforrástárhoz tartozik, ez áll: *Ez a projekt még nem használ erőforrástári erőforrásokat.*, egy tippel.

### Erőforrások az erőforrástárból

Az erőforrástárból származó erőforrásnak egy kis erőforrástár-ikonja van (*Az erőforrástárból*). Ennek *Név*, *Típus*, *Alapdíj/óra* és *Mértékegység* mezője ekkor egyszerű szöveg (*Erőforrástár-érték — szerkessze az Erőforrástár nézetben, vagy válassza le ezt az erőforrást az erőforrástárról.*), mert az erőforrástár dönti el, mi az erőforrás. A *Szín*, a *Maximális mennyiség*, a kapacitás-lépések, a *Naptár* és a *Brigád* szerkeszthető marad, mert a projekt dönti el, mennyi és mikor. Két jelvény jelenhet meg: *eltér — döntsön* (kattintásra megnyílik az *Erőforrástár összekapcsolása* ablak) és *már nincs az erőforrástárban*, az *Eltávolítás a projektből* gombbal.

## Az Erőforrástár nézet

Csak akkor, ha a projekt erőforrástárhoz tartozik. Lásd: [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken) és [Erőforrástárak kezelése és megosztása](docs://howto-bibliotheken-beheren). A tetején egy színes értesítés áll: *Ez az erőforrástárat szerkeszti, és az összes projektre hat — ez nem vonható vissza.* A táblázatnak ugyanazok a mezői, mint a *Projekt* nézetnek, az alábbi különbségekkel:

- Nincs *Összesen* oszlop: az egy projekt számítása.
- A *Brigád* oszlop megjelenik, amint az erőforrástárban van erőforrás.
- A *Naptár* oszlop az erőforrástár naptárait kínálja, alapértelmezésként a *Nincs naptár* értékkel.
- **Hozzáadás a projekthez** — az erőforrást a projektbe teszi, a naptárának másolatával. Jelzi: *Hozzáadva.* vagy *Már benne van a projektben.*
- **Törlés** — megkérdezi: *Eltávolítja a(z) „…” erőforrást az erőforrástárból? Ez az összes projektre vonatkozik, és nem vonható vissza.*
- Erőforrások nélkül ez áll: *Még nincs erőforrás az erőforrástárban.*

## A Foglaltság nézet

Csak olvasható nézet az összes megnyitott dokumentumra: melyik erőforrástár-erőforrás hol van lefoglalva. Új erőforráshoz nincs gomb. Lásd: [A foglaltsági áttekintés használata](docs://howto-bezettingsoverzicht-gebruiken).

- **Táblázat** — erőforrástár-erőforrásonként: *Név*, *Dokumentumok* (hány dokumentumban szerepel), *Időszak* és *Csúcs / kapacitás* (a legnagyobb összesített terhelés a kapacitáshoz képest, azon a napon). Egy piros *N nap túlterhelt* azt jelenti, hogy több dokumentumban együtt az erőforrás a kapacitása fölött van. A név melletti nyíl kinyitja a dokumentumokat, mindegyiket időszakkal és csúccsal; egy sorra kattintva megjelenik az adott erőforrás hisztogramja (*Válasszon ki egy erőforrást a hisztogram megtekintéséhez.*).
- **Mi számít bele** — csak azok a dokumentumok, amelyek nyitva vannak ebben az alkalmazásban (*Ez a nézet csak az ebben a programban megnyitott dokumentumokat látja.*). Egy dokumentum, amelyet nem számítottak ki, üzenetet kap a sorában. Az aktív dokumentum az utoljára kiszámított adatokkal számít (*Elavult: ezek az utoljára kiszámított adatok — nyomja meg az F5-öt ebben a dokumentumban.*). Egy másik dokumentumot az áttekintés előre kiszámít (*Erre a nézetre előre ki lett számítva — maga a dokumentum a régebbi dátumokat mutatja, amíg ott meg nem nyomja az F5-öt, vagy be nem kapcsolja az „Automatikus ütemezés-számítás” beállítást.*). Ha az *Automatikus ütemezés-számítás* be van kapcsolva, az áttekintés valóban kiszámolja ezeket a dokumentumokat. Ha a számítás nem sikerül, a dokumentum nem számít bele (*Nem számít bele: az ütemezés nincs kiszámítva — aktiválja ezt a dokumentumot, és nyomja meg az F5 billentyűt.*). Ha nincs lefoglalt erőforrás, ez áll: *Nincsenek erőforrástári erőforrások lefoglalva a megnyitott dokumentumokban.*
- **Sorrend** — a túlterhelt erőforrások vannak felül, a legtöbb ütközési nappal elöl, majd ábécé szerint.

## Az erőforrás-dokkoló

Kompakt lista a jobb oldali oszlopban, a *Tulajdonságok* panel mellett. Erőforrásonként: egy színminta, a név (csak olvasható), egy piros háromszög *Túlterhelt* jelzéssel, amint az erőforrásnak legalább egy túlterhelt napja van, és a *Maximális mennyiség*, amely szerkeszthető. Ha van tevékenységkijelölés, csak ezeknek a tevékenységeknek az erőforrásai látszanak. A fejlécben a *Teljes panel* (megnyitja a teljes panelt) és a *Dokkoló bezárása* található. Erőforrások nélkül ez áll: *Még nincsenek erőforrások. Adjon hozzá egyet a kezdéshez.*

## A hisztogram

Egy csík a Gantt alatt, amely egy erőforrás terhelését mutatja naponként. Kapcsolja be vagy ki ezzel: *Erőforrások › Hisztogram › Hisztogram* vagy *Nézet › Panelek › Hisztogram*. Alapértelmezett érték: ki; az Ön választását a program megjegyzi. A magasság alapértelmezés szerint 160 pixel, és a Gantt és a hisztogram közötti szélen húzható át.

- **Választó** — bal oldalon, a tevékenységtáblázat alatt van egy lista: felül rögzítve az *Összes erőforrás*, alatta soronként egy erőforrás. Egy kattintás kiválasztja a sort, a nyílbillentyűkkel lehet végigmenni rajta, és az *Erőforrások › Hisztogram › Előző* és a *Következő* ugyanezt teszi. Egy sor mellett lévő piros pont azt jelenti, hogy az erőforrásnak legalább egy túlterhelt napja van; az *Összes erőforrás* esetén a pont csak az anyag nélküli erőforrásokat nézi. Ha van tevékenységkijelölés, a lista csak ezeknek a tevékenységeknek az erőforrásait tartalmazza. Ha a kiválasztott erőforrás kívül esik, a csík ideiglenesen a kijelölés *Összes erőforrás* adatait mutatja.
- **Oszlopok** — naponként egy oszlop: a terhelés mennyisége. Egy vonal mutatja a kapacitást; az oszlopnak a kapacitás fölötti része piros. A bal felső sarokban a legnagyobb érték áll, *hozzárendelt mennyiség* egységben. Az *Összes erőforrás* összeadja az összes erőforrás terhelését és kapacitását, az anyag kivételével.
- **Súgószöveg** — tartsa egy pillanatig mozdulatlanul az egeret egy nap fölött: *N tevékenység járul hozzá ekkor: {date}*, legfeljebb nyolc tevékenység nevével. Egy kiválasztott erőforrásnál, és olyan napon, amikor a naptára szerint nem dolgozik, ez is ott áll: *Az erőforrás a(z) „…” naptár szerint ezen a napon nem dolgozik.*
- **Üzenetek a csíkban** — *Számítsa újra (F5) a terhelés megjelenítéséhez*, amíg nincs terhelés; *Még nincsenek erőforrások*, ha nincsenek erőforrások; és *⚠ Az ütemezés elavult — számítsa újra (F5)* a jobb felső sarokban, ha az ütemezés elavult.
- **Mi számít bele** — minden hozzárendelés napi mennyisége, a tevékenység munkanapjaira szétosztva a *Görbe* szerint (vagy az *Órás eloszlás beállítása* szerint). Csak a legalsó szintű tevékenységek számítanak, mérföldkövek nélkül. A terhelés a *Számítás* után frissül, és az erőforrások és hozzárendelések változása után is. Ha a tevékenységek dátumait módosítja, az csak a *Számítás* után számít.

## Túlterhelés

Egy erőforrás egy napon túlterhelt, ha a terhelése nagyobb a kapacitásánál. A kapacitás a *Maximális mennyiség* (a kapacitás-lépésekkel együtt) a naptárának egy munkanapján, és 0 egy szabadnapon. Az anyag itt is beleszámít. Az ok vagy a kevés kapacitás, vagy egy nap, amelyen az erőforrás a naptára szerint nem dolgozik.

Hol látja:

- **Erőforrások › Túlterhelés** — a túlterhelt erőforrások száma, vagy *Nincs*.
- **Állapotsor** — *N erőforrás túlterhelve*; egy kattintás megnyitja a *Figyelmeztetések* panelt.
- **Figyelmeztetések** — soronként egy erőforrás: *Túlterhelés N napon (first – last)*. Ha az összes nap szabadnap, hozzáadódik: *az erőforrás ezeken a napokon a naptára szerint nem dolgozik*. Vegyes esetben: *ebből N napon az erőforrás a naptára szerint nem dolgozik*. Lásd: [Értesítések és figyelmeztetések](docs://ref-meldingen).
- **Hisztogram** — az oszlopok piros részei és a piros pont a választóban.
- **Dokkoló** — a *Túlterhelt* háromszög.

A kiegyenlítés a tevékenységeket a tartalékidejükön belül mozgatva megoldhatja a túlterhelést; egy olyan erőforrást, amelynek szabadnapon kell dolgoznia, nem old meg. Lásd: [Kiegyenlítés](docs://uitleg-nivelleren).
