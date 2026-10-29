# IFC-séma kiválasztása

Cél: mentse az ütemezését az épületmodell IFC-sémájában, amellyel egyesíteni szeretné.

## Mikor van erre szüksége

Alapértelmezés szerint az alkalmazás a projektet IFC 4.3 ADD2 sémában menti. Ez az IFC 4.3 neve azokban a fájlokban, amelyeket az IfcOpenShell és a Bonsai készít. Ha az ütemezést egy épületmodellel egyetlen 4D-fájlba szeretné egyesíteni, például az IfcOpenShell *MergeProjects* receptjével (ifcpatch), mindkét fájlnak ugyanazt a sémát kell használnia. Ha az épületmodell IFC4-fájl, az IfcOpenShell nem egyesíti egy IFC 4.3 ütemezéssel. Ilyenkor válassza itt a modell sémáját.

## Lépések

1. Nyissa meg a *Beállítások › Projekt › Projektbeállítások* menüpontot, vagy a *Fájl › Projektbeállítások* menüpontot.
2. Az *IFC-séma mentéskor* mezőben válassza ki az épületmodell sémáját.
3. Kattintson az *Alkalmazás* gombra. A projekt állapota ekkor *Nincs mentve*.
4. Mentse a *Mentés* (Ctrl+S) paranccsal, vagy használja a *Mentés másként* parancsot.

A három lehetőség:

- *IFC 4.3 ADD2 (alapértelmezett)* a fájl fejlécében az `IFC4X3_ADD2` értéket írja.
- *IFC 4.3* a fájl fejlécében az `IFC4X3` értéket írja. Így írták az IFC 4.3 fájlokat az alkalmazás régebbi verziói.
- *IFC4* a fájl fejlécében az `IFC4` értéket írja, egy IFC4 épületmodellhez.

## Buktatók és amit az alkalmazás tesz

**Az egyesítés legyen az utolsó lépés.** Ne nyissa meg az egyesített 4D-fájlt (épületmodell és ütemezés) az alkalmazásban, hogy újra mentse. Az alkalmazás csak az ütemezést tartja meg. A falak és az épületmodell többi része elvész, akkor is, ha megtartja a sémát. Módosítsa az ütemezést a saját fájljában, és utána egyesítse újra.

**Az alkalmazás először rákérdez, ha a megnyitott fájl más sémát használ.** Ha például egy IFC4-fájlt nyit meg, vagy egy régebbi verziójú alkalmazással mentett IFC 4.3-fájlt, az alkalmazás nem változtatja meg egyszerűen a fájltípust. Az első alkalommal, amikor a *Mentés* vagy a *Mentés másként* parancsot használja, előbb megkérdezi, hogy megtartja-e a fájl sémáját, vagy átvált az IFC 4.3 ADD2 sémára. Az *IFC4 megtartása* (vagy az *IFC 4.3 megtartása*) az a gomb, amelyet az Enter billentyű választ. Ha a kérdést az Esc billentyűvel vagy a kereszttel zárja be, az alkalmazás nem ment semmit.

**Az alkalmazás fájlonként csak egyszer kérdez.** A választása a fájlban tárolódik. Ha később újra megnyitja, az alkalmazás nem kérdez újra. Ha a *Projektbeállítások* ablakban Ön választ sémát, és az *Alkalmazás* gombra kattint, az alkalmazás akkor sem kérdez.

**Olyan séma, amelyet az alkalmazás nem tud írni**, például az IFC2X3, megnyílik az alkalmazásban. Az első mentéskor a kérdés ezt jelzi, és Ön a fenti három séma egyikét választja ki.

**Az automatikus mentés és a visszaállás összeomlás után nem kérdez semmit.** Ezek a fájl sémáját írják, és az első mentés kérdését Önre hagyják. Olyan sémánál, amelyet az alkalmazás nem tud írni, az *Automatikus mentés* nem ír a fájlba, amíg nem válaszolt a kérdésre.

**Egy új projekt nem kérdez semmit.** Az új projekt, és a más formátumból származó projekt, például XER, MPP vagy CSV formátumból, az *IFC 4.3 ADD2 (alapértelmezett)* sémával indul.

**A fájl tartalma nem változik.** A három séma ugyanúgy kezeli azt az ütemezési adatot, amelyet az alkalmazás ír. Csak a fejlécben lévő `FILE_SCHEMA` sor különbözik. Ezért semmit sem veszít, ha másik sémát választ.

**Egy IFC 4.3 modell, amelyet az IfcOpenShell vagy a Bonsai készített,** általában az `IFC4X3_ADD2` értéket tartalmazza a fejlécében, ahogy az alkalmazás alapértelmezése is. Az IfcOpenShell nem egyesít vele `IFC4X3` sémájú ütemezést. Ha kétsége van, nézze meg a modellfájl tetején lévő `FILE_SCHEMA` sort.

**A visszavonás nem változtatja meg a sémát.** A séma a fájlhoz tartozik, ahogy az is, hogy hol van tárolva. A *Projektbeállítások* ablakban tett választás és a mentéskor adott válasz ezért nem része a *Visszavonás* lépéseinek. Ha vissza szeretne térni, válassza a másik sémát a *Projektbeállítások* ablakban. Így az *Automatikus mentés* soha nem ír csendben másik sémát, miután visszavont egy módosítást.

## Lásd még

- [Új projekt és Projektbeállítások](docs://ref-projectinfo): az űrlap összes mezője.
- [Fájlok és formátumok](docs://uitleg-bestanden): miért az IFC az alkalmazás saját formátuma.
- [Fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan): mentés és mentés másként.
