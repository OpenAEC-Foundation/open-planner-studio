# A jelentési időszak kiválasztása

Cél: eldönteni, hogy a jelentés az idő melyik szakaszát fedje le, például a következő négy hetet vagy a júniusi hónapot.

## Mikor van erre szükség

A heti megbeszélésen azt szeretnék tudni, mi történik a következő négy hétben. A havi jelentés júniust fedi le. Időszak nélkül a teljes ütemezést kapja papíron. Öt jelentés ezért használja a *Jelentési időszak* beállítást. Ezek: *Előretekintés*, *Előrehaladási jelentés*, *Erőforrás-terhelés*, *Erőforrás-hozzárendelések* és *Erőforrásdiagram*. A többi jelentésnek nincs időszaka.

Az időszak nincs a naptári hónaphoz kötve. Az időszak egy **referencianaphoz** van kötve: a projekt állapotdátumához (az a nap, amelyen az előrehaladást méri, lásd [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang)), vagy a mai naphoz, ha a projektnek nincs állapotdátuma. A *Következő 4 hét* ettől a naptól számít. Ha áthelyezi az állapotdátumot, az időszak is vele mozog.

## Lépések

### 1. Állapotdátum beállítása

Ha relatív választást használ, például a *Következő 4 hét* vagy az *Elmúlt hónap* lehetőséget, állítsa be előbb az állapotdátumot. Válassza az *Ütemezés › Alaptervek és előrehaladás* lehetőséget, és töltse ki az *Állapotdátum* mezőt. A mellette lévő kereszttel (*Állapotdátum törlése*) újra eltávolíthatja a dátumot. Ha rögzített időszakkal dolgozik (4. lépés), erre nincs szükség.

### 2. Válasszon olyan jelentést, amelynek van időszaka

Nyissa meg a *Jelentés* fület, és a *Jelentés típusa* résznél válasszon egyet az öt jelentés közül. A *Jelentési időszak* lista a *Jelentésbeállítások* alatt van. Az Erőforrásdiagramnál a lista a *Beállítások* alatt található, a jelentés négy jelölőnégyzete alatt.

Minden jelentés megjegyzi a saját időszakát. Ezek a kezdeti értékek:

- *Előretekintés*: *Következő hónap*.
- *Előrehaladási jelentés*: *Elmúlt hónap*.
- *Erőforrás-terhelés*, *Erőforrás-hozzárendelések* és *Erőforrásdiagram*: *Projekt időtartama*.

### 3. Válasszon időszakot a listából

A listában szerepel a *Következő hét*, a *Következő 2 hét*, a *Következő 4 hét*, a *Következő 6 hét*, a *Következő 8 hét*, a *Következő 12 hét* és a *Következő hónap*. Ugyanez a hét lehetőség megvan *Elmúlt* előtaggal is. Emellett ott van a *Projekt időtartama* és az *Egyéni*. A lista alatt a *Dátumtól* és az *Eddig* mezők állnak, a választás által adott dátumokkal. Ezeket itt csak olvasni lehet.

Mindkét nap beleszámít. Ha az állapotdátum május 20., csütörtök, a *Következő hét* május 20-tól május 26-ig tart, a *Következő 4 hét* május 20-tól június 16-ig, bezárólag (28 nap). A *Következő hónap* a következő hónap ugyanazon napja előtti napig tart, itt június 19-ig, bezárólag. Az *Elmúlt 2 hét* május 7-től május 20-ig, bezárólag tart.

A *Projekt időtartama* az ütemezést a legkorábbi kezdéstől a legkésőbbi befejezésig veszi figyelembe.

### 4. Vagy válassza az Egyéni lehetőséget

Az *Egyéni* lehetőségnél a *Dátumtól* és az *Eddig* két dátummezővé válik. Kezdetben az előbb kiválasztott lehetőség dátumai szerepelnek. Töltse ki mindkettőt, például június 1. és június 14. Ha a bevitel nem helyes, a jelentés az utolsó érvényes időszakon marad, és ezt pirossal jelzi:

- *A befejezési dátum a kezdődátum előtt van.* ha az *Eddig* korábbi, mint a *Dátumtól*.
- *Töltse ki mindkét dátumot.* ha az egyik dátum üres.

### 5. Olvassa le az időszakot a jelentésben

Az Előretekintés, az Erőforrás-terhelés és az Erőforrás-hozzárendelések esetén az időszak a cím alatt látszik, például *Időszak: 20-05-2027 – 19-06-2027*. Ha a *Projekt időtartama* lehetőséget választja, a *Projekt időtartama* szöveg a dátumok mögé kerül. Az Előrehaladási jelentés az időszakot az összegzés *Időszak* sorában mutatja. Az Erőforrásdiagram időtengelye pontosan az időszakot fedi le.

### Mit tesz az időszak jelentésenként

Az időszak nem minden jelentésben működik ugyanúgy.

- **Előretekintés** azokat a befejezetlen tevékenységeket veszi figyelembe, amelyek érintik az időszakot, akkor is, ha az egész időszakon átnyúlnak. A referencianap előtti lejárt tevékenységek is bekerülnek, feltéve hogy az időszak befejezése nem a referencianap előtt van. Egy egészen múltbeli egyéni időszak visszatekintés: csak azt mutatja, ami akkor futott, és még nincs befejezve, a mai hátralék nélkül.
- **Előrehaladási jelentés** az időszakot a *Befejezve a múltbeli időszakban* résznél használja. A *Kezdődik a következő időszakban* rész az állapotdátumtól kezdve előre tekint, az összegzés *Előretekintés eddig* dátumáig. Ha *Elmúlt* időszakot választ, a jelentés annyit tekint előre, amennyit visszatekint: *Elmúlt 2 hét* és május 20. állapotdátum esetén az *Előretekintés eddig* június 3. lesz. Ha az egyéni időszak vagy a *Projekt időtartama* teljesen a múltban van, a jelentés nem tükrözi azt előre.
- **Erőforrás-terhelés** minden olyan hetet vagy hónapot teljes egészében megmutat, amelyet az időszak érint. Ha az időszak szerdától szerdáig tart, egész heteket lát, így egy sor mindig ugyanazt a számot mutatja, mint a hisztogram.
- **Erőforrás-hozzárendelések** azoknak a tevékenységeknek a hozzárendeléseit mutatja, amelyek érintik az időszakot. A *Projekt időtartama* esetén nincs szűrés dátum szerint.
- **Erőforrásdiagram** csak azokat a tevékenységeket mutatja, amelyek érintik az időszakot. Az összegzés *Az időszakon kívül* sora azt mutatja, hány tevékenységet hagytak ki.

## Buktatók és az alkalmazás működése

**Nincs állapotdátum.** Ilyenkor az alkalmazás a mai napot használja. A négy táblázatos jelentésnél, amelyeknek van időszaka (*Előretekintés*, *Előrehaladási jelentés*, *Erőforrás-terhelés* és *Erőforrás-hozzárendelések*), a jelentés relatív időszak esetén a tetején ezt írja: *Nincs állapotdátum beállítva. A jelentés a mai napot használja (29-09-2026).*, a mai dátummal. Az Erőforrásdiagram ezt nem jelzi. Nézze meg ezért a *Dátumtól* és az *Eddig* mezőket: ezek a mai nap körül állnak, nem az ütemezése körül.

**Az időszak az ütemezésen kívül esik.** Ilyenkor a jelentés üres. Az Erőforrásdiagram ezt így jelzi: *Nincs tevékenység a jelentési időszakban. Válasszon másik időszakot vagy a Teljes projektet.* (a listában ezt a választást *Projekt időtartama* néven találja). A többi jelentésben nulla tevékenység látszik, vagy nincs sor.

**A dátumok az Ön dátumformátumát követik.** A *Dátumtól* és az *Eddig* mezők a beállításaiban megadott dátumformátumot követik, kivéve az *Egyéni* dátummezőit: azok a böngészője formátumát mutatják.

**Az időszak együtt mozog.** Egy relatív választás, például a *Következő hónap*, minden alkalommal újra meghatározódik. Ha az állapotdátum megváltozik, vagy állapotdátum nélkül eltelik egy nap, az időszak azonnal vele mozog. Ha rögzített időszakot szeretne, válassza az *Egyéni* lehetőséget.

**A választás minden projektre vonatkozik.** Az egyéni időszak is az eszközön lévő összes projektre vonatkozik, nem csak a megnyitott projektre.

## Lásd még

- [Jelentés készítése és nyomtatása](docs://howto-rapport-maken-en-afdrukken): a teljes út a jelentés típusától a PDF-ig.
- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): mi az állapotdátum, és miért számol vele az alkalmazás.
- [Túlterhelés megoldása](docs://howto-overbezetting-oplossen): mit kezdjen az Erőforrás-terhelésben látható túlterhelt hetekkel.
- [A jelentések típusai](docs://ref-rapporttypes): az összes jelentés típusa és azok beállításai.
