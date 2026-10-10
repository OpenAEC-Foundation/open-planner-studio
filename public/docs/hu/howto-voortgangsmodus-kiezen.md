# Az előrehaladási mód kiválasztása

Cél: döntse el, hogyan tervezi az alkalmazás annak a tevékenységnek a hátralévő munkáját, amely már elindult, miközben az előde még fut: a kapcsolat szerint (Retained Logic) vagy a ténylegesen történtek szerint (Progress Override).

## Mikor van erre szükség

A helyszínen a munka gyakran megelőzi a logikát. A festő már olyan szobákban kezd, ahol kész a vakolat, miközben a vakoló máshol még dolgozik. Az ütemezésben ez például egy befejezés-kezdés kapcsolat, amelynek az utódja még azelőtt kezdődik, hogy az előde befejeződne. Az alkalmazás ezt **sorrenden kívüli előrehaladásnak** nevezi. Ha az állapotsorban ez látszik: *N sorrenden kívüli kapcsolat*, akkor ilyen eset áll fenn. Az előrehaladási mód dönti el, hogyan tervezi az alkalmazás az utód hátralévő munkáját. A két mód működését egy kidolgozott példával az [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang) című cikk írja le.

## Lépések

1. Frissítse az előrehaladást, és állítsa be az állapotdátumot, ahogy az [Az előrehaladás frissítése](docs://howto-voortgang-bijwerken) részben leírtuk.
2. Lépjen az *Ütemezés › Alaptervek és előrehaladás › Előrehaladási mód* menüpontra, és nyissa meg a listát.
3. Válassza a *Retained Logic* vagy a *Progress Override* lehetőséget.
4. Nyomja meg a **Számítás** gombot (F5), például az *Ütemezés › Ütemezés › Számítás* útvonalon. A választás miatt az ütemezés elavul: az állapotsor ezt jelzi: *Elavult — újraszámítsa (F5)*. Ha az *Automatikus ütemezés-számítás* be van kapcsolva, az alkalmazás ezt maga végzi el.

Hogyan válasszon?

- **Retained Logic** az alapértelmezett. A kapcsolat érvényben marad: az utód hátralévő munkája csak akkor kezdődik, ha az előde befejeződött. Válassza ezt, ha a sorrend valóban rögzített, vagy ha óvatosan szeretne tervezni.
- **Progress Override** a valóságnak ad elsőbbséget. Az utód hátralévő munkája az állapotdátumon kezdődik, anélkül hogy megvárná az elődöt. Válassza ezt, ha az utód valóban tovább dolgozik, és a befejezési dátumnak nem kell függnie egy még futó elődtől.

## Az eredmény ellenőrzése

- Kattintson az állapotsorban az *N sorrenden kívüli kapcsolat* üzenetre. Megnyílik a *Figyelmeztetések* panel, amely az *Ütemezés › Ütemezés › Figyelmeztetések* útvonalon is elérhető. Minden kapcsolat szerepel benne a következő szöveggel: *Sorrenden kívüli előrehaladás: az utód előrehaladása ellentmond a kapcsolatnak*, például *4.2 Plastering → 4.5 Painting (FS)*.
- Nézze meg az utód sávját. Retained Logic mellett az előde befejezése után ér véget. Progress Override mellett korábban ér véget. A magyarázat példájában ez kedd, július 27., szemben a július 22-i csütörtökkel.

## Buktatók és az alkalmazás működése

**Nincs különbség.** A mód csak olyan tevékenységekre hat, amelyek már elkezdődtek, miközben az előderük még nincs befejezve. Ilyen tevékenység nélkül semmi sem változik.

**Az üzenet megmarad.** A Progress Override nem oldja meg a sorrenden kívüli üzenetet. A mód azt dönti el, hogyan végzi az alkalmazás az ütemezés-számítást; az ellentmondás a kapcsolat és az előrehaladás között megmarad. Ha a kapcsolat már nem helyes, módosítsa ([Kapcsolatok hozzáadása](docs://howto-relaties-leggen)).

**A projekthez tartozik.** A választás a projektfájllal együtt mentődik, a teljes projektre vonatkozik, és a Ctrl+Z billentyűkombinációval visszavonható. Egy új projekt Retained Logic módon indul.

**Egy P6-fájl.** Ha egy Primavera P6 fájlt (.xer) nyit meg, az alkalmazás a módot a fájlból veszi át. A Retained Logic és a Progress Override mellett a P6 ismeri az Actual Dates módot is. Az alkalmazás ezt a harmadik módot nem ismeri; az ilyen fájl ütemezés-számítása Retained Logic szerint történik. Az importüzenet ezt így jelzi: *1 P6-ütemezési beállítás biztonságos tartalékot használt.*

**A számítási profil.** A Primavera P6 profilban a Progress Override visszafelé is működik, a legkésőbbi dátumokban és az előde szabad tartalékidejében (ütemezési szabály: *A Progress Override a már elkezdett utódot visszafelé is figyelmen kívül hagyja*). Az Open Planner Studio és a Microsoft Project profilban ez nem így van. Az ütemezési szabályokat a *Beállítások › Projekt › Projektinfó* útvonalon találja, a *Számítási profil és beállítások* blokkban. A magyarázat példájában ez a visszafelé hatás nem látszik.

## Lásd még

- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): a két mód közötti különbség, számokkal.
- [Az előrehaladás frissítése](docs://howto-voortgang-bijwerken): a rögzítendő előrehaladás, amelyen a mód dolgozik.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): egy már nem helyes kapcsolat módosítása.
