# Erőforrástárak kezelése és megosztása

Cél: erőforrástárakat létrehozni és törölni, naptárakat tenni beléjük, és egy erőforrástárat exportálni vagy importálni, biztonsági mentésként vagy egy másik számítógépen való használathoz.

## Mikor van erre szükség

Az erőforrástár nem a projektfájlokban van, hanem az alkalmazásban: az asztali alkalmazásban egy fájlban ezen a számítógépen, a böngészőben pedig a böngésző tárhelyén. Nincs szinkronizálva. Ha törli a webhely adatait a böngészőben, az erőforrástár elvész. Ezért exportálja biztonsági mentésként. Ha egy kolléga ugyanazokkal a munkacsapatokkal és alapdíjakkal szeretne dolgozni, az erőforrástárat fájlként is átadja. Ha a szervezetének több üzemeltető társasága van, saját munkacsapatokkal, minden társasághoz külön erőforrástárat hoz létre. Egy új projekthez Ön választja ki, melyik erőforrástárat használja.

Hogy mi az erőforrástár, azt itt olvashatja el: [Az erőforrástár](docs://uitleg-resourcebibliotheek). Az erőforrásokat itt nem szerkeszti, hanem az erőforráspanelen. Lásd: [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken).

## Lépések

### A kezelőfelület megnyitása

Válassza a *Fájl › Erőforrástár* lehetőséget. Bal oldalon látható az *Erőforrástárak* lista. Jobb oldalon a kiválasztott erőforrástár adatai láthatók: a neve, a gombok és a *Naptárak* lista. A tetején ez olvasható: az erőforrásokat az *Erőforrások* fülön kezeli.

### Erőforrástár létrehozása, átnevezése és alapértelmezettként való kijelölése

1. Kattintson a lista feletti pluszjelre (*Erőforrástár hozzáadása*). Új erőforrástár, *Új erőforrástár* néven jön létre, és azonnal kijelölődik.
2. Írja be az új nevet a jobb oldali rész tetején lévő névmezőbe, és nyomjon Entert, vagy kattintson a mezőn kívülre. Az alkalmazás nem fogad el üres nevet.
3. Kattintson az *Alapértelmezetté tétel* gombra, hogy ez az erőforrástár mostantól alapból legyen kijelölve az új projektekhez. Az alapértelmezett erőforrástár csillagot kap a listában.

### Naptár elhelyezése az erőforrástárban

1. A *Naptárak* alatt kattintson a *+ Projektből* gombra. Megnyílik a lista az aktív projekt naptáraival.
2. Kattintson a kis nyílra a naptár után, amelyet át szeretne venni. A lista fölött ez áll: *Hozzáadva.* Az a naptár, amely már kapcsolva van ehhez az erőforrástárhoz, a neve után ezt kapja: *már kapcsolva*.
3. A naptár most benne van az erőforrástár *Naptárak* listájában. A ceruzával (*Szerkesztés*) módosíthatja a nevet, a pipajellel pedig menti. A kuka azonnal törli a naptárat, megerősítés nélkül. A projektekben lévő másolatok megmaradnak.

A *Naptárak* után egy verziószám áll, például *v2*. Ez minden módosítással nő. Az erőforrástár naptára átkerül a projektbe, amikor olyan erőforrást rendel hozzá, amely ezt használja. Az erőforráshoz az *Erőforrások* fülön, az *Erőforrástár* nézetben, a *Naptár* oszlopban rendelheti hozzá a naptárat.

### Erőforrástár exportálása

1. Válassza ki az erőforrástárat a listában.
2. Kattintson az *Exportálás* gombra.
3. Az asztali alkalmazásban, valamint a Chrome és az Edge böngészőben Ön választja ki, hová kerül a fájl. Más böngészőkben a fájl közvetlenül a letöltések mappájába kerül, és az alkalmazás ezt jelzi. A fájl neve `bibliotheek-` plusz az erőforrástár neve, kiterjesztése `.ifc`.

A gombok alatt ez áll: *Az exportálás biztonsági mentés is: tárolja a fájlt biztonságos helyen.*

### Erőforrástár importálása

1. Kattintson az *Importálás* gombra. Megnyílik az *Erőforrástár importálása* ablak a listában kijelölt erőforrástárhoz.
2. Kattintson a *Fájl kiválasztása…* gombra, és válassza ki az exportált `.ifc` fájlt. Ha a fájl nem tartalmaz erőforrástárat, ez áll: *Ez az IFC-fájl nem tartalmaz erőforrástárat.*
3. Az alkalmazás megmutatja, mi van benne, például: *2 naptár, 5 erőforrás (verzió: 3).*
4. Válassza ki, mit szeretne tenni vele, lásd lent.
5. Kattintson a *Hozzáadás* vagy a *Csere* gombra, vagy a *Mégse* gombra a megszakításhoz.

Két lehetőség közül választhat:

- *Hozzáadás új erőforrástárként*: a fájl külön erőforrástárként kerül a meglévők mellé. Alatta látható, melyik néven, például: *Ez „Mijn resourcebibliotheek (2)” néven lesz hozzáadva.* Semmi nem vész el, és az aktív projekt továbbra is a saját erőforrástárához marad kapcsolva.
- *Meglévő erőforrástár cseréje*: a kiválasztott erőforrástár teljes tartalmát a fájl tartalma váltja fel. Ezt az alkalmazás is kiírja: *Az importálás a kiválasztott erőforrástár TELJES készletét felülírja.* Ha két vagy több erőforrástár van, az *Importálás erőforrástárba* résznél választja ki, melyiket. Ha az erőforrástára újabb a fájlnál, az alkalmazás figyelmeztet: *Az Ön helyi erőforrástára újabb — az importálás felülírhatja a módosításait.*

Az alkalmazás maga is javasol egy választást. Ha a fájl az alapértelmezett erőforrástárat tartalmazta, a *Hozzáadás új erőforrástárként* van előre kijelölve. Ha a fájlból származó erőforrástár már megvan a számítógépén, és nem az alapértelmezett, a *Meglévő erőforrástár cseréje* van előre kijelölve, pontosan azzal az erőforrástárral. Ha bizonytalan, válassza a hozzáadást: az nem ír felül semmit.

### Erőforrástár törlése

1. Válassza ki az erőforrástárat a listában, és kattintson az *Erőforrástár eltávolítása* gombra. A gomb szürke az utolsó erőforrástárnál, mert mindig marad egy.
2. Erősítse meg a *Törlés* gombbal. A kérdés ez: *Eltávolítja ezt az erőforrástárat?* Ha megnyitott projektek kapcsolódnak hozzá, ez áll: *Ez az erőforrástár 1 megnyitott projekthez kapcsolódik. Az eltávolítás leválasztja azt a projektet. Folytatja?* Több projekt esetén ugyanez áll, a számmal, például: *2 megnyitott projekthez kapcsolódik.*

Az erőforrástár ezután megszűnik, benne minden erőforrással és naptárral. A megnyitott projektek, amelyek használták, leválnak róla: erőforrásaik a projekt saját erőforrásai maradnak. Ha meg szeretné őrizni a tartalmat, exportálja előbb.

### Projekt átadása az erőforrástárral együtt

Egy projektfájl tartalmazza az erőforrások saját másolatait. Ha az egész erőforrástárat is át szeretné adni, járjon el az alábbiak szerint. Maga az exportálás is itt van leírva: [Exportálás](docs://howto-exporteren).

1. Nyisson meg egy erőforrástárhoz kapcsolt projektet, és válassza a *Fájl › Exportálás* lehetőséget.
2. Pipálja be az *Erőforrástár-fájl mentése mellé* jelölőnégyzetet. A jelölőnégyzet csak kapcsolt projekt esetén látszik.
3. Válassza az *IFC 4x3* kártyát, és mentse a fájlt. Az alkalmazás ezután egy második fájlt is kér. Ennek neve a projekt nevére épül, utána `-bibliotheek` áll, és tartalmazza az erőforrástárat.

A jelölőnégyzet csak az IFC-exportnál működik, a többi exportformátumnál nem. Az Ön kollégája a második fájlt a fentebb leírt módon importálja.

## Buktatók, és mit tesz ilyenkor az alkalmazás

**Két tervező, két erőforrástár.** Az alkalmazás nem szinkronizálja az erőforrástárakat a számítógépek között. Az importálási ablak erről mindig figyelmeztet: *Megjegyzés: az erőforrástárak nincsenek szinkronizálva a gépek között. Ha két tervező ugyanazt az erőforrástárat használja, az erőforrástárak eltérhetnek egymástól. Ha a szervezete munkacsapatokat oszt meg üzemeltető társaságok között, szándékosan válasszon egy közös készletet.*

**Csere mindent felülír.** A kiválasztott erőforrástárban lévő minden elvész, és az erőforrástár-módosítást nem lehet a *Visszavonás* paranccsal visszavonni. Ha bizonytalan, előbb exportáljon.

**A naptár törlése a listából azonnal történik.** Az alkalmazás nem kér megerősítést, erőforrás törlésekor viszont igen. Ez hiányosságnak tűnhet. Az erőforrástár-módosításokat nem lehet a *Visszavonás* paranccsal visszavonni.

## Lásd még

- [Az erőforrástár](docs://uitleg-resourcebibliotheek): hogyan függ össze az erőforrástár és a projekt.
- [Az erőforrástár használata](docs://howto-resourcebibliotheek-gebruiken): erőforrások összekapcsolása, hozzárendelése és az eltérések kezelése.
- [Exportálás](docs://howto-exporteren): az exportformátumok, köztük az IFC erőforrástár-fájllal.
