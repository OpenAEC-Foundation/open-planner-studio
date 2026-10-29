# MS Project-fájl (.mpp) megnyitása

Cél: egy ütemezés megnyitása közvetlenül az alkalmazásban, előzetes exportálás nélkül, a Microsoft Project-ből.

## Mikor van erre szükség

Egy vállalkozó, egy konzulens vagy egy megrendelő `.mpp`-fájlként küldi el az ütemezését. Meg akarja tekinteni, ütemezés-számítást akar végezni rajta, vagy tovább akarja fejleszteni. Az alkalmazás az MS Project 2010-től 2021-ig terjedő verzióival készült `.mpp`-fájlokat olvassa. Csak olvas: nem ír `.mpp`-fájlt, és soha nem módosítja a fájlt. Az alkalmazás a fájlból magát az ütemezést veszi át: tevékenységeket szerkezettel, időtartammal és korlátozásokkal, késleltetéses kapcsolatokat, naptárakat, erőforrásokat, hozzárendeléseket és előrehaladást. Az alkalmazás olvassa az MS Project által maga kiszámított dátumokat és tartalékidőt is, de ezeket csak a *Fájlban rögzített dátumok* nézethez használja, bemenetként soha.

## Lépések

1. Válassza a *Kezdőlap › Fájl › Megnyitás* lehetőséget, vagy nyomja meg a Ctrl+O billentyűkombinációt. Válassza ki az `.mpp`-fájlt.
2. A projekt új lapon nyílik meg, vagy az aktuális lapon, ha az még üres volt és nem módosult. A projektnek nincs fájlja: a *Mentés* később új IFC-fájlt ír. Ezután egy ablak röviden ismerteti, mit vett át az alkalmazás a fájlból, és hogyan működik a mentés; lásd: [A fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan).
3. Olvassa el alul az üzenetet: *Ez a projekt a(z) Microsoft Project szerint számol. Módosítsa a Fájl → Projektadatok → Számítási profil és beállítások menüpontban.* Az alkalmazás az MS Project számítási szabályaival számolja ki ezt a projektet: a *Microsoft Project* számítási profillal. A *Számítási profil megnyitása* gombbal a beállításhoz jut. A *Bővebben* gombra kattintva a súgó nyílik meg a számítási profilokról.
4. Ellenőrizze, hogy van-e üzenetsáv a menüszalag alatt: *A dátumokat úgy látja, ahogy azok a fájlban szerepelnek; újraszámításkor 4 tevékenység eltérne.* Ezeknél a tevékenységeknél az alkalmazás eredménye eltér az MS Project által mentett dátumoktól. A 3. lépésben szereplő üzenet alatt ekkor egy további sor is megjelenik: *4 tevékenység a fájlban rögzített dátumokat mutatja (nem lett újraszámítva).* Hogy ez mit jelent, és hogyan kapcsolhatja át az alkalmazás saját számítására, azt a [Fájlban rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen) leírásában találja.
5. Ha megjelenik az *Ez a fájl óraalapú tervezést tartalmaz.* üzenet az *Óraalapú tervezés bekapcsolása* gombbal, akkor a fájl órában megadott adatokat tartalmaz. Lásd: [Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten).

Ha a fájl szünetes, kiegyenlített vagy erőforrás-alapú ütemezésű tevékenységeket tartalmaz, egy újabb üzenet jelenik meg, például: *Ez az MS Project-fájl 3 tevékenységet tartalmaz szünetes, simított vagy munkamennyiség alapú ütemezéssel. A program ilyenként olvassa be és jeleníti meg.* Egy tevékenység esetén az üzenet egyes számban jelenik meg.

## Buktatók és mit tesz ilyenkor az alkalmazás

**Nem minden került át.** Megnyitás után az alkalmazás egyetlen üzenetben jelzi, mit nem vett át: *Nem minden került át ebből az MS Project-fájlból.* Ez alatt minden tételhez egy sor tartozik a darabszámmal, például *2 alapterv nem lett átvéve.* Az `.mpp`-fájlnál a 3. lépésben említett számítási profilról szóló mondat ekkor az üzenet első sora. Az üzenet addig marad a képernyőn, amíg rá nem kattint a kereszt ikonra. Ha semmi nem vész el, nem kap ilyen üzenetet. Egy sor vonatkozhat a következőkre:

- beillesztett projektek (alprojektek): az alkalmazás normál tevékenységként olvassa be őket, a másik fájlra mutató kapcsolat nélkül;
- más projektből származó külső tevékenységek: az alkalmazás normál tevékenységként olvassa be őket;
- alaptervek: az `.mpp`-fájlból az alkalmazás nem vesz át alaptervet, az MS Project XML-ből csak a tevékenységek 0. alaptervét, és abból is csak a dátumokat és az időtartamot (órában megadott tevékenységnél az időt is; a munkát és a költséget nem, az erőforrások és a hozzárendelések alaptervét sem);
- MS Project XML esetén: olyan hozzárendelés, amelynek alaptervi dátumai eltérnek a tevékenységétől. Az alkalmazás csak a tevékenység alaptervét tartja meg; ha ezek azonosak, semmi nem vész el, és az alkalmazás nem jelez semmit. Ugyanazon a napon eltérő időpont is eltérésnek számít;
- egyéni mezők értékekkel, például keresőtáblából származó értékek és körvonalkódok (az alkalmazás az `.mpp`-fájlban nem veszi figyelembe az igen/nem mezőket);
- megjegyzések (akkor is, ha a megjegyzés csak képet tartalmaz) az erőforrásokon és a hozzárendeléseken, az `.mpp`-fájlból pedig a tevékenységeken is (MS Project XML-ből a tevékenység megjegyzése a leírásként jön át);
- hiperhivatkozások;
- a tevékenységek fix költségei;
- az erőforrások alapdíjai: az `.mpp`-fájlból egyáltalán nem, MS Project XML-ből csak a standard alapdíj;
- csak MS Project XML esetén: kézzel ütemezett tevékenységek (az alkalmazás automatikusan ütemezi őket), inaktív tevékenységek (a számításba bekerülnek) és a kiegyenlítési késleltetés;
- csak `.mpp` esetén: az MS Project kritikus küszöbértéke; az alkalmazás a 0 küszöbértéket használja.

Az MS Project-ben Ön által kitöltött WBS-kódot átveszi az alkalmazás; ellenkező esetben a tevékenységeket a szerkezet szerint számozza meg.

**Fájl MS Project 2007-es vagy régebbi verziójából.** Az alkalmazás nem nyitja meg, és ezt jelzi: *Ez a .mpp-fájl régi formátumot használ (Project 2007 vagy korábbi). Exportálja MS Project-ben XML-ként (Fájl → Mentés másként → XML), és nyissa meg azt a fájlt.* Az üzenet alatt az alkalmazás angolul egy műszaki okot is megad.

**Jelszóval védett fájl.** Az alkalmazás ezt jelzi: *Ez a .mpp-fájl jelszóval védett. Exportálja MS Project-ben XML-ként (Fájl → Mentés másként → XML), és nyissa meg azt a fájlt.* Itt is angol nyelvű műszaki ok tartozik az üzenethez.

**Olyan fájl, amely nem `.mpp`-fájl.** Ilyenkor ez jelenik meg: *A fájl megnyitása sikertelen*, műszaki okkal.

**Az XML-útvonal másként számol.** Ha az `.mpp` helyett az MS Project XML-exportot nyitja meg, az alkalmazás az *Open Planner Studio* számítási profillal számol, és nem jelenik meg a *Microsoft Project* profilra vonatkozó üzenet. A dátumok ezért eltérhetnek attól, amit az `.mpp`-fájl mutat. Az XML-exportnál is jelzi az alkalmazás, mit nem vesz át; lásd: *Nem minden került át*.

**Egy módosítás megszünteti az MS Project irányítását.** Ha olyan tevékenységet módosít, amelynek ütemezését az MS Project dátumablaka irányította, az alkalmazás projektenként egyszer jelzi: *Az MS Project dátumablaka ettől a művelettől már nem irányít 2 tevékenységet. Az órák eloszlása továbbra is érvényes, és megmarad a fájlban.* Egy tevékenység esetén az üzenet egyes számban jelenik meg.

**A mentés soha nem írja felül az `.mpp`-fájlt.** A projektnek nincs fájlja. A *Mentés* megkérdezi, hova kell menteni az új IFC-fájlt.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): miért csak olvasható az `.mpp`, és mit ír a mentés.
- [Fájlban rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen): az MS Project saját dátumainak nézete.
- [Az óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten): ha a fájl órában megadott adatokat tartalmaz.
- [Primavera P6-fájl (.xer) megnyitása](docs://howto-xer-openen): ugyanez Primavera-fájlnál.
- [Import- és exportformátumok](docs://ref-import-exportformaten): formátumonként, hogy mi kerül át és mi nem.
- [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen): miért nyílik meg az MS Project-fájl a saját számítási profiljával.
