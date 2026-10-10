# Bővítmény-engedélyek

Minden engedély, amelyet egy bővítmény a manifesztjében felsorolhat: mit engedélyez, mi történik, ha hiányzik, és mit lát belőle, amikor bővítményt telepít. A bővítmények telepítését és kezelését itt találja: [Bővítmény telepítése és kezelése](docs://howto-extensie-installeren).

## Mi az engedély, és mi nem

Az engedély **a szerző nyilatkozata**: azt mondja meg, hogy az alkalmazás felületének mely részeit szeretné a bővítmény használni. Nem akadály. A bővítmény kódja ugyanabban a környezetben fut, mint maga az alkalmazás, ezért többre is képes, mint amit az engedélyei mondanak: nincs homokozó. Az alkalmazás a telepítési ablakban is ezt mondja. Csak olyan szerzőktől telepítsen bővítményeket, akiket megbízhatónak tart.

Az alkalmazás háromféleképpen érvényesíti az engedélyeket, és a különbség számít:

**Szigorúan érvényesített.** Ha az engedély hiányzik, a megfelelő metódus hibát dob, mielőtt bármi történne (holland nyelven, például *Extensie „…” mist permissie: ribbon*).

**Figyelmeztetés.** Ha az engedély hiányzik, a metódus még működik, de az alkalmazás figyelmeztetést ír a naplóba. Egy későbbi verzióban elutasítás lesz belőle.

**Csak tájékoztató.** Az engedélyhez nem tartozik a felületnek egyetlen része sem. Az alkalmazás telepítéskor megjeleníti, egyébként nem csinál vele semmit.

Engedélyt nem igényel a bővítményfelület alapja: a projekt, a naptár, a tevékenységek, a kapcsolatok, az erőforrások és a hozzárendelések olvasása; tevékenységek és kapcsolatok hozzáadása, illetve tevékenységek módosítása; projekt betöltése, újraszámítás és több módosítás összevonása; a saját beállítások megtartása, a saját mellékelt fájljainak olvasása és értesítés megjelenítése.

**A manifeszt.** Az engedélyek listaként szerepelnek a manifesztben. Az alkalmazás elutasítja azt a bővítményt, amelyet most telepít, és amelyben olyan engedély szerepel, amelyet ez az alkalmazásverzió nem ismer. Egy már tárolt, régebbi bővítménynél az alkalmazás eldobja az ismeretlen engedélyeket, és ezt a naplóba írja.

## Hogyan kérdez rá az alkalmazás

Telepítéskor, a katalógusból (*Fájl › Bővítmények › Böngészés › Telepítés*) vagy egy fájlból (*ZIP* vagy *JS*), az alkalmazás megjeleníti a *Bővítmény telepítése?* ablakot. A kérdés egyszer jelenik meg, telepítéskor: nem minden alkalommal, amikor bekapcsolja a bővítményt.

Az ablakban látható a név, a verzió, a leírás, a szerző és – ha van – a repozitórium. Az *Eredet* alatt az látszik, honnan származik a bővítmény (*Az online bővítménykatalógusból*, *Ezen a számítógépen lévő ZIP-fájlból* vagy *Ezen a számítógépen lévő JavaScript-fájlból*), és hogy a letöltés ellenőrzött-e: igen, a katalógus ellenőrző összegével; nincs ellenőrizve, mert a katalógus nem ad ilyet; vagy Ön maga választott ki egy fájlt. Az *Amibe beleegyezik* alatt az áll, hogy a bővítmény programkód, amely ugyanazokkal a jogokkal fut, mint az alkalmazás, és hogy ez a gyakorlatban mit jelent: az asztali alkalmazásban többek között a felhasználói mappán belüli fájlok olvasását és írását, valamint a projektekhez, a beállításokhoz és a vágólaphoz való hozzáférést; a böngészőben a tárolt projektekhez és beállításokhoz, a hozzáférést kapott fájlokhoz és a hálózathoz való hozzáférést.

Az *Amit ez a bővítmény állít, hogy használ* alatt a manifeszt engedélyei állnak, rövid címkékként, az alábbi néven. Ez a következőt mondja: *Ez a szerző nyilatkozata, nem korlátozás — a kód mindenesetre többre is képes.* Ha a bővítménynek nincs engedélye, ezt írja: *Nincs megadva semmi.* Két engedélyhez magyarázat is tartozik: *importSource* és *help*. A másik hatnak csak a címkéje van.

A *Telepítés* gombbal beleegyezik. A *Telepítés elvetése* gomb, az Esc billentyű és az ablakon kívüli kattintás elutasítja a telepítést.

## Az engedélyek

**ribbon** — gombot helyez el a menüszalagon. Hatás: a bővítmény gombot adhat hozzá a menüszalag-lap egy csoportjához. Ha a bővítménynek nincs ez az engedélye, és megpróbál gombot hozzáadni, hibát kap. A gombok a kiválasztott lap végén jelennek meg, a bővítmény egy csoportcímkéje alatt, és eltűnnek, ha kikapcsolja vagy eltávolítja a bővítményt. Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: szigorú. Hol: a bővítmény által választott lapon.

**events** — az alkalmazás eseményeinek követése, és saját események küldése. Hatás: a bővítmény feliratkozhat eseményekre, leiratkozhat róluk, és saját eseményeket küldhet. Az alkalmazás maga három eseményt küld: egy projekt betöltődik (importálás, megnyitás vagy egy bővítmény általi betöltés után), létrejön egy üres projekt, és az alkalmazás (újra)számítja az ütemezést. Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: szigorú. Hol: sehol; a bővítmény az eseményre reagál.

**backstage** — importálási formátumot kínál. Hatás: a bővítmény regisztrálhat egy importálót; ez megjelenik a *Fájl › Importálás* menüben, ahol egy formátumra kattintva fájlt választhat. A beépített formátumok ettől függetlenek (lásd: [Importálási és exportálási formátumok](docs://ref-import-exportformaten)). Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: figyelmeztetés. Ha az engedély hiányzik, a regisztráció akkor is működik, de a naplóba figyelmeztetés kerül. Ez átmeneti megoldás, mert a meglévő bővítmények nem mindig sorolják fel az engedélyt. Hol: *Fájl › Importálás*.

**pdf-fonts** — betűtípust ad a PDF-exporthoz. Hatás: a bővítmény betűtípus-szolgáltatót regisztrálhat. A PDF-export ezt használja azokhoz a karakterekhez, amelyeket a beépített betűtípusok nem fednek le, például a kínai, japán és koreai karakterekhez. Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: szigorú. Hol: egy jelentés PDF-kimenetében; a telepítési ablakban csak a címke látszik.

**importSource** — egy importált fájl eredeti bájtjainak olvasása. Hatás: a bővítmény kérheti egy importált projekt forrásfájljának teljes tartalmát (jelenleg: egy Primavera-fájl), beleértve azokat a mezőket is, amelyeket az alkalmazás szándékosan nem vesz át a projektbe, például az ellenőrzési és eredetmezőket, a költségeket, valamint a felülvizsgálati és a helymezőket. Ez sokkal szélesebb a felület többi részénél, ezért külön engedély. Engedély nélkül az alkalmazás a forrásfájlból egyetlen bájtot sem olvas: minden metódus hibát dob, mielőtt bármit lekérne. Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: szigorú, alapértelmezetten megtagadva. Hol: a telepítési ablakban magyarázat kíséri: *importSource — minden importált fájl teljes eredeti forrásbájtja (például egy nyers Primavera-fájl), beleértve azokat a mezőket is, amelyek soha nem kerülnek a projektbe.*

**help** — súgócikkeket és útmutatást adhat hozzá. Hatás: a bővítmény regisztrálhat és visszavonhat súgócikkeket (oktatóanyagokat), megnyithat egy mellékelt `.ifc`-fájlt új dokumentumként, és elindíthat, illetve leállíthat egy olyan útmutatót, amely az alkalmazás részeire mutat. Egy mellékelt projekt soha nem írja felül a szerkesztett dokumentumot: új dokumentumként nyílik meg, vagy csak egy üres, nem módosított lapot vesz át. Az 1.4.0-s szerződésverziótól érvényes. Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: szigorú. Hol: a *Súgó* ablakban (a cikkek), új lapon (a projekt), és gombokra mutató útmutatóként. A telepítési ablakban ehhez magyarázat tartozik: *help — súgócikkeket adhat hozzá, a mellékelt projekteket új dokumentumként nyithatja meg, és az alkalmazás részeire mutató útmutatót jeleníthet meg.*

**filesystem** — a bővítmény azt közli, hogy fájlokat használ. Hatás: nincs; a felületnek nincs hozzá kapcsolt része, és az alkalmazás nem tudja érvényesíteni. Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: csak tájékoztató. Hol: címkeként a telepítési ablakban.

**network** — a bővítmény azt közli, hogy használja a hálózatot. Hatás: nincs; mint a *filesystem* esetében. Alapértelmezett: nincs megadva; csak az, ami a manifesztben szerepel. Érvényesítés: csak tájékoztató. Hol: címkeként a telepítési ablakban.

## Lásd még

- [Importálási és exportálási formátumok](docs://ref-import-exportformaten): azok a formátumok, amelyeket az alkalmazás maga ismer, a bővítmények által a *Fájl › Importálás* alatt hozzáadottak mellett.
- [Bővítmény telepítése és kezelése](docs://howto-extensie-installeren): telepítés, kikapcsolás és eltávolítás egy bővítménynél.
