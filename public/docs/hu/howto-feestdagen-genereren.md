# Ünnepnapok és az építőipari szabadság generálása

Cél: egy ország ünnepnapjait, és adott esetben az építőipari szabadságot, betölteni egy naptárba. Ha szükséges, saját nem munkanapot vagy időszakot is hozzáadhat.

## Mikor van erre szükség

Ünnepnapok nélkül az alkalmazás karácsonyra vagy királynapra egyszerűen munkanapot jelöl ki. Egy új projekt már megkapja a holland ünnepnapokat, ha az *Építési mód* be van kapcsolva. Újra generálhat, ha másik országra vagy régióra van szüksége, ha bele szeretné venni az építőipari szabadságot, vagy ha a projekt olyan évekre esik, amelyekre nem jöttek létre ünnepnapok. Ezek az évek fontosak: az alkalmazás számára az ezeken kívül eső nap egyszerűen munkanap. Hogy az alkalmazás a számításnál hogyan veszi figyelembe az ünnepnapot, azt a [Naptárak és munkanapok](docs://uitleg-kalenders) című részben olvashatja el.

Az **építőipari szabadság** (*bouwvak*) a holland építőiparban általános nyári szabadság, három hét a nyáron. Az alkalmazásban alapértelmezés szerint nincs bekapcsolva.

## Lépések

### Ünnepnapok generálása

1. Válassza az *Ütemezés › Naptár › Naptár* lehetőséget, és a bal oldalon válassza ki azt a naptárat, amelybe az ünnepnapoknak kerülniük kell.
2. Kattintson az *Ünnepnapok generálása…* gombra. A gomb alatt megnyílik egy blokk a lehetőségekkel.
3. Válassza az *Ország* mezőt: Hollandia, Németország, Belgium, Franciaország, Egyesült Királyság, Ausztria, Svájc vagy *Nincs ünnepnap*. Több országnál megjelenik egy *Régió* lista is, például Németországban egy szövetségi tartomány. Az *Országos* beállítás csak azokat az ünnepnapokat hagyja meg, amelyek az egész országban érvényesek.
4. Hollandia esetén válassza az *Építőipari szabadság* mezőt: *Nincs* (alapértelmezett), *Észak*, *Közép* vagy *Dél*. Az építőipari szabadság egy időszakként jelenik meg a listában, például *Bouwvak (Noord)* néven, három hét hétfőtől péntekig. Ezt a lehetőséget csak akkor látja, ha az *Építési mód* be van kapcsolva.
5. A lehetőségek alatt egy összegzés látható, például *21 ünnepnap, 2026–2028*. Kattintson rá a dátumok megtekintéséhez.
6. Kattintson a *Generálás* gombra. Az *Ünnepnapok* lista most már feltöltődött.
7. Kattintson az *Alkalmazás* gombra. Az alkalmazás azonnal újraszámítja az ütemezést.

Hollandia esetén az alkalmazás minden évben az alábbi ünnepnapokat teszi a listába: Nieuwjaar (újév), Goede Vrijdag (nagypéntek), Pasen (húsvét, két nap), Koningsdag (királynap), Hemelvaart (mennybemenetel), Pinksteren (pünkösd, két nap) és Kerst (karácsony, december 25. és 26.). Ha a Koningsdag (királynap) vasárnapra esik, április 26-án van. A Bevrijdingsdag (felszabadulás napja) csak a lustrumévekben kerül a listába, például 2025-ben és 2030-ban.

Az évek a projekt időszakát követik: a kezdődátumot megelőző évtől a befejezési dátumot követő évig. Ha a projektnek nincs befejezési dátuma, a kezdés évétől számított három évig terjed. A kezdő- és a befejezési dátumot a *Beállítások › Projekt › Projektinfó* alatt módosíthatja.

### Újragenerálás új projektidőszak után

Ha a projekt eltolódik, vagy későbbi befejezési dátumot kap, az ünnepnapok már nem fedik le az új éveket. Az alkalmazás ezt a *Naptárak* ablakban jelzi, például így: *Az ünnepnapok a(z) 2025–2028 időszakot fedik le; a projekt 2030-ig tart. Újragenerálja?* Ekkor kattintson az *Újragenerálás* gombra. Az alkalmazás az előző alkalommal használt választásokat (ország, régió, építőipari szabadság) alkalmazza a projekt éveire. Ezután kattintson az *Alkalmazás* gombra. Ez az üzenet csak olyan naptárnál jelenik meg, amelynek ünnepnapjait korábban generálták.

### Saját nem munkanap vagy időszak hozzáadása

1. A *Naptárak* ablakban kattintson az *Ünnepnap hozzáadása* gombra. A lista alján megjelenik egy új sor, a *Dátumtól* alatt a mai dátummal.
2. Töltse ki a *Leírás* mezőt, például *Céges kirándulás* szöveggel.
3. Módosítsa a *Dátumtól* mezőt. Egy napra hagyja üresen az *Eddig* mezőt, vagy egy időszaknál töltse ki az utolsó nem munkanapot, például a téli leállásra.
4. Kattintson az *Alkalmazás* gombra.

A sor mögötti kuka ikonnal törölhet egy ünnepnapot.

### Összes ünnepnap eltávolítása

Válassza a *Nincs ünnepnap* lehetőséget az *Ország* alatt, és kattintson a *Generálás* gombra. A lista ezután üres.

## Buktatók és mit tesz ilyenkor az alkalmazás

**A generálás lecseréli a teljes listát.** Az Ön által hozzáadott napok is eltűnnek. Adja őket utána újra hozzá.

**A Goede Vrijdag is benne van.** Ha a vállalat nagypénteken vagy lustrumévben a felszabadulás napján dolgozik, a kuka ikonnal törölje az adott sort.

**Az építőipari szabadság dátumai tájékoztató jellegűek.** Az alkalmazás 2025-től 2028-ig bezárólag ismeri őket; más éveknél durva becslést ad. Ha az építőipari szabadság ki van választva, az alkalmazás ezért ezt jeleníti meg: *Tájékoztató dátumok — ellenőrizze a Bouwend Nederlandnál*. Szükség esetén módosítsa az időszakot a listában.

**Hibás sor.** Ha egy sorban nincs érvényes *Dátumtól*, az *Eddig* dátum a *Dátumtól* előtt van, vagy a dátum nem olvasható, a sor piros üzenetet kap, például: *A befejezési dátum a kezdődátum előtt van.* Az *Alkalmazás* gomb addig nem használható, amíg ki nem javítja.

**Új projekt esetén.** Az *Új projekt* ablakban ugyanazok a lehetőségek találhatók az *Ünnepnaplista* alatt. Az *Egyéni…* lehetőséggel ünnepnapok nélkül indít; a létrehozás után megnyílik a *Naptárak* ablak, hogy Ön maga tölthesse ki őket.

## Lásd még

- [Naptárak és munkanapok](docs://uitleg-kalenders): hogyan veszi figyelembe az alkalmazás az ünnepnapokat és az építőipari szabadságot a munkanapok számításánál.
- [Naptár létrehozása és hozzárendelése](docs://howto-kalender-maken-en-toewijzen): saját naptár készítése, amelybe az ünnepnapokat felveheti.
- [Naptárablakok](docs://ref-kalenders): a naptárablakok összes mezője.
- [Új projekt és Projektinfó](docs://ref-projectinfo): az ünnepnaplista egy új projekthez.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): az ünnepnapok mellett a projektnaptárban van egy nem munkaidős időszak is: *Frost delay, foundations*.
