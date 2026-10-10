# MS Project-fájl (.mpp) megnyitása

Cél: egy ütemezés megnyitása közvetlenül az alkalmazásban, előzetes exportálás nélkül, a Microsoft Project-ből.

## Mikor van erre szükség

Egy vállalkozó, egy konzulens vagy egy megrendelő `.mpp`-fájlként küldi el az ütemezését. Meg akarja tekinteni, ütemezés-számítást akar végezni rajta, vagy tovább akarja fejleszteni. Az alkalmazás az MS Project 2010-től 2021-ig terjedő verzióival készült `.mpp`-fájlokat olvassa. Csak olvas: nem ír `.mpp`-fájlt, és soha nem módosítja a fájlt. Az alkalmazás a fájlból magát az ütemezést veszi át: tevékenységeket szerkezettel, időtartammal és korlátozásokkal, késleltetéses kapcsolatokat, naptárakat, erőforrásokat, hozzárendeléseket és előrehaladást. Az alkalmazás olvassa az MS Project által maga kiszámított dátumokat és tartalékidőt is, de ezeket csak a *Fájlban rögzített dátumok* nézethez használja, bemenetként soha.

## Lépések

1. Válassza a *Kezdőlap › Fájl › Megnyitás* lehetőséget, vagy nyomja meg a Ctrl+O billentyűkombinációt. Válassza ki az `.mpp`-fájlt.
2. A projekt új lapon nyílik meg, vagy az aktuális lapon, ha az még üres és nem változott. A projektnek nincs fájlja: a *Mentés* később új IFC-fájlt ír.
3. Olvassa el alul az üzenetet: *Ez a projekt a(z) Microsoft Project számítási profillal számol. Módosítsa a Fájl → Projektinfó → Számítási profil és beállítások menüpontban.* Az alkalmazás az MS Project számítási szabályaival végez ütemezés-számítást ennél a projektnél: a *Microsoft Project* számítási profillal. A *Számítási profil megnyitása* gombbal a beállításhoz jut. A *Bővebben* gombra kattintva megnyílik a súgó a számítási profilokról.
4. Ellenőrizze, hogy van-e üzenetsáv a menüszalag alatt: *A dátumokat úgy látja, ahogy azok a fájlban szerepelnek; újraszámításkor 4 tevékenység eltérne.* Ezeknél a tevékenységeknél az alkalmazás eredménye ekkor eltér az MS Project által mentett dátumoktól. A 3. lépésben szereplő üzenet alatt ekkor egy további sor is megjelenik: *4 tevékenység a fájlban rögzített dátumokat mutatja (nem lett újraszámítva).* Hogy ez mit jelent, és hogyan kapcsolhatja át az alkalmazás saját ütemezés-számítására, azt a [Fájlban rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen) leírásában találja.
5. Ha megjelenik az *Ez a fájl óraalapú tervezést tartalmaz.* üzenet az *Óraalapú tervezés bekapcsolása* gombbal, akkor a fájl órában megadott adatokat tartalmaz. Lásd: [Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten).

Ha a fájl szünetes, kiegyenlített vagy erőforrás-alapú ütemezésű tevékenységeket tartalmaz, egy újabb üzenet jelenik meg, például: *Ez az MS Project-fájl 3 tevékenységet tartalmaz szünetes, simított vagy munkamennyiség alapú ütemezéssel. A program ilyenként olvassa be és jeleníti meg.* Egy tevékenység esetén az üzenet egyes számban jelenik meg.

## Buktatók és mit tesz ilyenkor az alkalmazás

**Nem minden kerül át.** Az alkalmazás nem veszi át az MS Project-fájlból ezeket: alaptervek, költségek és alapdíjak, megjegyzések és egyéni mezők. Az MS Project-ben Ön által kitöltött WBS-kódot átveszi, ellenkező esetben az alkalmazás a szerkezet szerint számozza meg a tevékenységeket.

**Fájl MS Project 2007-ből vagy régebbi verzióból.** Az alkalmazás nem nyitja meg a fájlt, és ezt jelzi: *Ez a .mpp-fájl régi formátumot használ (Project 2007 vagy korábbi). Exportálja MS Project-ben XML-ként (Fájl → Mentés másként → XML), és nyissa meg azt a fájlt.* Az üzenet alatt az alkalmazás angolul egy technikai okot is megad.

**Jelszóval védett fájl.** Az alkalmazás ezt jelzi: *Ez a .mpp-fájl jelszóval védett. Exportálja MS Project-ben XML-ként (Fájl → Mentés másként → XML), és nyissa meg azt a fájlt.* Ilyenkor az üzenet alatt is angolul jelenik meg egy technikai ok.

**Fájl, amely nem `.mpp`-fájl.** Az alkalmazás ezt jelzi: *A fájl megnyitása sikertelen*, technikai okkal.

**Az XML-útvonal másként végez ütemezés-számítást.** Ha az `.mpp` helyett az MS Project XML-exportját nyitja meg, az alkalmazás az *Open Planner Studio* számítási profillal végez ütemezés-számítást. Ilyenkor nem jelenik meg a *Microsoft Project*-re vonatkozó üzenet. A dátumok ezért eltérhetnek attól, amit az `.mpp`-fájl ad.

**Egy módosítás megszünteti az MS Project irányítását.** Ha olyan tevékenységet módosít, amelynek az ütemezését az MS Project dátumablaka irányította, az alkalmazás projektenként egyszer jelzi: *Az MS Project dátumablaka ettől a művelettől már nem irányít 2 tevékenységet. Az órák eloszlása továbbra is érvényes, és megmarad a fájlban.* Egy tevékenység esetén az üzenet egyes számban jelenik meg.

**A mentés soha nem írja felül az `.mpp`-fájlt.** A projektnek nincs fájlja. A *Mentés* megkérdezi, hova kell menteni az új IFC-fájlt.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): miért csak olvasható az `.mpp`, és mit ír a mentés.
- [Fájlban rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen): az MS Project saját dátumainak nézete.
- [Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten): ha a fájl órában megadott adatokat tartalmaz.
- [Primavera P6-fájl (.xer) megnyitása](docs://howto-xer-openen): ugyanez Primavera-fájlnál.
- [Import- és exportformátumok](docs://ref-import-exportformaten): formátumonként, hogy mi kerül át és mi nem.
- [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen): miért nyílik meg az MS Project-fájl a saját számítási profiljával.
