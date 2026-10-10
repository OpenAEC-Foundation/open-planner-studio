# A túlterhelés megoldása

Cél: megtalálni, hol van túl sok tevékenység egy erőforrásra egy napon, és ezt megoldani, általában a tevékenységek kiegyenlítésével.

## Mikor van erre szüksége

Papíron az ütemezése működik, de a bricklayer két falon dolgozik, amelyek ugyanazokra a napokra esnek. Az alkalmazás ezt **túlterhelés** néven említi. Egy erőforrás munkanapon túlterhelés alatt áll, ha az ütemezés az adott napon több munkát kér tőle, mint a kapacitás (*Maximális mennyiség*), vagy ha a naptár szerint nem dolgozik azon a napon.

Először keresse meg a túlterhelést. Ezután válasszon egy megoldást. A **kiegyenlítés** az a megoldás, amelyet az alkalmazás Ön helyett kiszámít: a tevékenységek később kezdődnek, amíg az erőforrás már el tudja látni a munkát. Hogy ez pontosan hogyan történik, azt a [Erőforrás-kiegyenlítés](docs://uitleg-nivelleren) című részben olvashatja el.

## Lépések

### 1. A túlterhelés megkeresése

1. Nézze meg a menüszalagon az *Erőforrások › Túlterhelés* menüpontot. Ez a *Nincs* szót mutatja, vagy piros színnel a túlterhelés alatt álló erőforrások számát, például *1 erőforrás*. Egy számítás után az állapotsor is kiírja: *1 erőforrás túlterhelve*.
2. Kattintson az állapotsorban arra az üzenetre. A jobb oldalon megnyílik a *Figyelmeztetések* panel. Minden erőforráshoz tartozik egy sor, például a *Bricklayer* sorában ez áll: *Túlterhelés 5 napon (29-06-2027 – 05-07-2027)*.
3. Kattintson erre a sorra. Az alkalmazás bekapcsolja a hisztogramot, kiválasztja az erőforrást, és kijelöli az összes tevékenységet, amelyhez az erőforrás hozzá van rendelve.
4. Nézze meg a hisztogramot a Gantt-diagram alatt. A piros sávok túlterhelés alatt álló napokat jelölnek. Ha az egérmutatót egy nap fölé viszi, látja, mely tevékenységek járulnak hozzá, például: *2 tevékenység járul hozzá ekkor: 2027-06-30*, alatta a nevükkel.

Ön is bekapcsolhatja a hisztogramot az *Erőforrások › Hisztogram › Hisztogram* menüponttal. Válasszon ki egy erőforrást a bal oldali listában, vagy lépkedjen végig az erőforrásokon az *Előző* és a *Következő* gombbal. Egy piros pont a listában azt jelzi, hogy az erőforrás túlterhelés alatt áll. Az *Összes erőforrás* sor az erőforrásokat összeadja, az anyag típusú erőforrások nélkül.

Ha egy tevékenység ki van jelölve, a hisztogram csak annak a tevékenységnek a terhelését mutatja, és csak a hozzárendelt erőforrásokat. A kijelölés törléséhez nyomja meg az Esc billentyűt, és újra a teljes projekt látszik.

### 2. Válasszon megoldást

- **Több kapacitás.** Ha tényleg érkezik egy második bricklayer, állítsa a *Maximális mennyiség* értékét 2-re (lásd: [Erőforrások kezelése](docs://howto-resources-beheren)). Akkor a túlterhelés megszűnik.
- **Kevesebb hozzárendelt mennyiség naponta.** Csökkentse a *Hozzárendelt mennyiség/nap* értékét, vagy válasszon másik görbét a hozzárendeléshez (lásd: [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen)).
- **Helyezze a tevékenységeket egymás után.** Adjon hozzá egy kapcsolatot a két tevékenység közé, hogy a második csak akkor kezdődjön, amikor az első befejeződött (lásd: [Kapcsolatok hozzáadása](docs://howto-relaties-leggen)).
- **Kiegyenlítés.** Az alkalmazás egy tevékenység kezdését későbbre teszi.

### 3. Kiegyenlítés

1. Győződjön meg róla, hogy az ütemezést már kiszámították az **ütemezés-számítás** (F5) paranccsal, például a *Kezdőlap › Ütemezés › Számítás* menüponttal.
2. Válassza az *Erőforrások › Kiegyenlítés › Kiegyenlítés*… lehetőséget. Megnyílik az *Erőforrás-kiegyenlítés* ablak.
3. Döntse el, hogy a projekt befejezési dátuma változhat-e. Ha nem jelöli be a *Kiegyenlítés csak a tartalékidőn belül — a projekt befejezési dátuma változatlan marad* jelölőnégyzetet, a befejezési dátum eltolódhat. Ha bejelöli, az alkalmazás a tevékenységeket csak a tartalékidőn belül mozdítja el.
4. Az *Erőforrások* alatt találhatók azok az erőforrások, amelyeket ki fognak egyenlíteni. Alapértelmezés szerint minden erőforrás be van jelölve, az anyag típusú erőforrások kivételével. Törölje a jelölést annál az erőforrásnál, amelyet nem szeretne módosítani.
5. Kattintson a *Számítás* gombra. Számítás közben a *Számítás*… felirat jelenik meg, és a *Leállítás* lehetőséggel leállíthatja. Az ütemezés még nem változik: ez egy javaslat.
6. Olvassa el a javaslatot. Felül a befejezési dátum látható, például *Projekt befejezése: változatlan (30-08-2027)* vagy *Projekt befejezése: 25-08-2027 → 30-08-2027*. Alatta egy táblázat látható, amelyben tevékenységenként szerepel a *Régi kezdés*, az *Új kezdés* és az *Eltolt napok*, például *Build outer cavity leaf*, 29-06-2027, 06-07-2027 és *5 nap*.
7. Válassza az *Alkalmazás* lehetőséget. Az alkalmazás a késleltetéseket írja a tevékenységekhez, és azonnal újraszámítja az ütemezést. Az F5 billentyű megnyomására nincs szükség. A *Mégse* lehetőség bezárja az ablakot módosítás nélkül.
8. Ellenőrizze az *Erőforrások › Túlterhelés* menüpontot. Most a *Nincs* szöveg jelenik meg.

Ha az ablakban a *Számítás* gomb megnyomása után módosít egy beállítást, a javaslat eltűnik. Ekkor kattintson újra a *Számítás* gombra. Ha az ütemezés módosul, amíg az alkalmazás számol, ez jelenik meg: *Az ütemezés módosult a számítás közben. Kattintson újra a Számítás gombra.*

### Annak eldöntése, melyik tevékenység marad a helyén

Az alkalmazás a tevékenységeket egyenként helyezi el. Az előrébb lévő tevékenységek a helyükön maradnak. A legnagyobb prioritású tevékenységek kerülnek először sorra. Azonos prioritás esetén az a tevékenység kerül előre, amelynek a legkevesebb tartalékidő van.

Ha Ön szeretné maga eldönteni, melyik tevékenység marad a helyén, adjon neki magasabb prioritást. Kattintson jobb gombbal a tevékenység sávjára a Gantt-diagramban, és válassza a *Prioritás* lehetőséget, majd az *Alacsony* (100), *Normál* (500) vagy *Magas* (900) lehetőséget. A *Normál* az alapértelmezett. A *Kiegyenlítési prioritás* oszlopba Ön is beírhat egy számot 0 és 1000 között: kattintson a tevékenységtáblázat fejlécének jobb oldalán lévő **+** jelre (*Oszlop hozzáadása*), és válassza ki ezt az oszlopot az *Ütemezés* csoportban. Minél nagyobb a szám, annál valószínűbb, hogy a tevékenység a helyén marad. Az alkalmazás nem fogad el 1000-nél nagyobb számot. Az 1000 prioritású tevékenység kapacitás miatt soha nem mozdul el.

### Visszavonás és újravégrehajtás

- A *Visszavonás* (Ctrl+Z) egy lépésben visszavonja az *Alkalmazás* műveletet.
- Az *Erőforrások › Kiegyenlítés › Kiegyenlítés törlése* menüpont eltávolítja a kiegyenlítést a tevékenységekről. A gomb szürke, amíg nincs kiegyenlítés. Az így visszakapott túlterhelés egyszerűen újra megjelenik.
- Ha azóta módosította az ütemezést, egyszerűen válassza újra a *Kiegyenlítés*… lehetőséget. Az alkalmazás ekkor nulláról indul: a régi késleltetések nem számítanak.

## Buktatók és mit tesz ekkor az alkalmazás

**Még nincs kiszámítva.** Ha az ütemezést még nem számolták ki, az ablak ezt írja: *Számítsa ki előbb az ütemezést (F5), mielőtt simít.* Ilyenkor a *Számítás* gomb nem érhető el.

**Fennmaradó ütközések.** Nem minden túlterhelés oldható meg eltolással. A fennmaradó tevékenységek a *Fennmaradó ütközések* alatt szerepelnek, a napok számával és az okkal együtt:

- *Nincs elég szabad kapacitás a tartalékidőn belül az ütközés megoldásához.* Ezt akkor látja, ha csak a tartalékidőn belül kiegyenlít. Ilyenkor a tartalékidőn belül nincs szabad időpont. Vegye ki a jelölést, és a befejezési dátum eltolódhat.
- *Az erőforrás nem dolgozik minden olyan napon, amelyre ez a tevékenység szükséges — eltolás nem oldja meg.* Az erőforrásnál a naptár szerint szabadnap esik a tevékenység közepére. Módosítsa a naptárat vagy a tevékenységet.
- *Bricklayer csúcsa 2 hozzárendelt mennyiség/nap, a kapacitás 1 — eltolással nem oldható meg.* A görbe miatt maga a tevékenység egy napon több munkát kér, mint amennyit az erőforrás biztosítani tud. Válasszon másik görbét, vagy csökkentse a hozzárendelt mennyiséget.

**Ez jelenik meg:** *Egyetlen tevékenységet sem kell eltolni — az ütemezés már ütközésmentes.* Ha ez a sor a javaslatban a *Fennmaradó ütközések* listával együtt jelenik meg, higgyen a listának. A sor csak azt mondja, hogy nincs mit eltolni. Ha a sor lista nélkül jelenik meg, miközben az *Erőforrások › Túlterhelés* még egy erőforrást jelez, akkor az ütközésben lévő összes tevékenység 1000 prioritáson van rögzítve, vagy már elkezdődtek. Ezek nem mozdulnak el, és az ablak sem jelenti őket ütközésként. Ezért alkalmazás után mindig nézze meg a *Túlterhelés* értéket.

**Tevékenységek, amelyek nem mozdulnak el.** Az a tevékenység, amely már elkezdődött vagy befejeződött, soha nem mozdul el. A terhelése viszont számít. A mérföldkövek és a fázisok sem mozdulnak el.

**Az anyag típusú erőforrások kiegyenlítése nem történik meg.** Ha egy anyag típusú erőforrás egy napon több munkát kér, mint a *Maximális mennyiség*, akkor a *Túlterhelés* jelzésben túlterhelésként szerepel, de a kiegyenlítési ablakban nem.

**A kiegyenlítés nem alkalmazkodik.** A késleltetések megmaradnak úgy, ahogy az alkalmazás kiszámította őket. Ha később módosítja egy tevékenység időtartamát, a kiegyenlített tevékenység ott marad, ahol van, akkor is, ha arra a helyre már nincs szükség. Ilyenkor végezze el újra a kiegyenlítést.

**A naptár miatti túlterhelés.** Ha az erőforrás a naptár szerint nem dolgozik egy napon, a *Figyelmeztetések* panel például ezt írja: *Túlterhelés 5 napon (29-06-2027 – 05-07-2027), ebből 1 napon az erőforrás a naptára szerint nem dolgozik*. Ha egy tevékenység mindig átnyúlik egy ilyen napon, ami a fenti második ok, akkor a kiegyenlítés ezt nem oldja meg.

## Lásd még

- [Erőforrás-kiegyenlítés](docs://uitleg-nivelleren): mit mozdít el a kiegyenlítés a tartalékidőn belül és azon túl, és mit nem tesz meg.
- [Erőforrások kezelése](docs://howto-resources-beheren): az erőforrás kapacitásának és naptárának beállítása.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): tevékenységek egymás utáni elhelyezése.
- [Értesítések és figyelmeztetések](docs://ref-meldingen): a túlterhelésre vonatkozó figyelmeztetés a Figyelmeztetések panelen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): a vakolóknál 5 napon van túlterhelés. Ha a *Kiegyenlítés csak a tartalékidőn belül — a projekt befejezési dátuma változatlan marad* jelölőnégyzet be van jelölve, a befejezés 2027. augusztus 17-én marad, és egy fennmaradó ütközés megmarad. Ha a jelölőnégyzet nincs bejelölve (ez az alapértelmezett), minden megoldódik, és a befejezés 2027. augusztus 24-re tolódik.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): a toronydaru 65 napon, a vakolóknál pedig 15 napon van túlterhelés. Ha a *Kiegyenlítés csak a tartalékidőn belül — a projekt befejezési dátuma változatlan marad* jelölőnégyzet nincs bejelölve, a kiegyenlítés a befejezést május 9-ről 2028. október 12-re tolja.
