# Alapterv mentése és kezelése

Cél: rögzítse az ütemezést megállapodásként (alapterv), hogy később láthassa, mennyire tér el a végrehajtás. Több alapterv is tárolható, átnevezhető, kiválasztható és törölhető.

## Mikor van erre szükség

Akkor rögzít alaptervet, amikor az ütemezést jóváhagyták, de a munka még nem kezdődött el. Ha az ütemezést később hivatalosan módosítják, például egy megrendelésmódosítás után, második alaptervet ment, és az elsőt megtartja. Így a végrehajtást az első megállapodáshoz és a módosítotthoz is mérheti. Azt, hogy pontosan mit rögzít az alapterv, és hogyan számítja ki az alkalmazás az eltérést, a következő helyen olvashatja el: [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang).

## Lépések

### Alapterv mentése

1. Nyomja meg a **Számítás** gombot (F5), például a *Ütemezés › Ütemezés › Számítás* menüponton keresztül. Az alapterv a számítás pillanatában kiszámított dátumokat rögzíti.
2. Válassza az *Ütemezés › Alaptervek és előrehaladás › Alapterv kezelése…* lehetőséget. Megnyílik az *Alaptervek* ablak.
3. Az *Új alapterv mentése* alatt egy javasolt név látható, például *Alapterv 1 — (mai dátum)*. Írjon be saját nevet, amelyet később is felismer, például *Alapterv*.
4. Kattintson a *Mentés* gombra. Az alapterv most már a listában van, és azonnal ez lesz az aktív alapterv.
5. Kattintson a *Bezárás* gombra.

A Gantt-diagramban minden tevékenységsáv alatt most egy vékony sáv látható az alapterv dátumaival. Egy mérföldkő kis rombuszt kap. Az átfedést a *Nézet › Alaptervek és előrehaladás › Alapterv-átfedés* menüponttal kapcsolhatja be vagy ki.

### Az aktív alapterv kiválasztása

Nyissa meg az *Alapterv kezelése…* parancsot, és az *Aktív* oszlopban válassza ki azt az alaptervet, amellyel össze akarja hasonlítani. Amíg van alapterv, pontosan egy lesz aktív. A Gantt-átfedés, az *Eltérés* jelentés típusa és az *Előrehaladási jelentés* ezt az alaptervet használja.

### Alapterv átnevezése

Módosítsa a nevet a listában. A változás azonnal érvényes. Nem kell a *Mentés* gombra kattintania.

### Alapterv törlése

Kattintson a listában az alapterv melletti kis kukára. Ha az aktív alaptervet törli, az alkalmazás megkérdezi: *Törli az aktív alaptervet?* Ezután a megmaradt legújabb alapterv lesz az aktív. Ha nincs másik, nincs aktív alapterv, és az átfedés eltűnik. A Ctrl+Z billentyűkombinációval visszahozhatja a törölt alaptervet.

### Eltérések a tevékenységtáblázatban

Minden alapterv hat oszlopot kap a tevékenységtáblázatban. Kattintson a tevékenységtáblázat fejléce jobb oldalán lévő **+** gombra (*Oszlop hozzáadása*), és nyissa meg az *Alapterv* kategóriát. Alaptervenként ezek az oszlopok találhatók: *Tervezett kezdés*, *Tervezett befejezés*, *Időtartam*, *Kezdési eltérés*, *Befejezési eltérés* és *Időtartam-eltérés*. Az oszlopok elején az alapterv neve áll, például *Alapterv — Befejezési eltérés*. Az eltérések munkanapokban értendők: a plusz későbbit, a mínusz korábbit jelent. Ha egy tevékenység nincs benne az alaptervben, ezekben az oszlopokban kötőjel (—) jelenik meg.

## Buktatók és az alkalmazás viselkedése

**Elavult ütemezés.** Ha az ütemezés elavult, az ablak ezt írja: *Az ütemezés elavult — végezzen előbb újraszámítást (F5)*. Ez figyelmeztetés; a mentés ettől még lehetséges. Ilyenkor viszont a régi dátumokat menti el. Zárja be az ablakot, nyomja meg a **Számítás** gombot, és csak utána mentsen.

**Alapterv előrehaladással.** Ha az előrehaladás megadása után menti az alaptervet, az a tényleges dátumokkal rögzíti az állapotot. Az eltérés ekkor nulla, és már nem mond semmit a végrehajtásról. Rögzítse az alaptervet, mielőtt a munka megkezdődik.

**Az alapterv nem frissíthető.** Ha módosítani szeretné a megállapodást, mentsen egy új alaptervet, és szükség esetén törölje a régit.

**Csak altevékenység nélküli tevékenységek.** Egy fázis nincs benne az alaptervben: nincs alapterv-sávja és nincs eltérése sem. A fázis az alatta lévő tevékenységekből adódik.

**Új és törölt tevékenységek.** A mentés után hozzáadott tevékenységnek nincs alapterv-sávja. Az eltérésjelentésben *Új* néven jelenik meg. Egy törölt tevékenység *Elhagyott* néven jelenik meg.

**Projekt áthelyezése.** A *Projekt áthelyezése…* ablakban, ha már van alapterv, megjelenik az *Alapterveket is eltolja* jelölőnégyzet. Alapértelmezetten ki van kapcsolva: az alapterv a helyén marad, így az eltolás eltérésként látszik. Olvassa el: [Projekt áthelyezése](docs://howto-project-verplaatsen).

**Tárolás a projektfájlban.** Az alapterveket és az aktív alapterv kiválasztását a projekttel együtt menti az alkalmazás. A fájl megnyitásakor ezek újra megjelennek.

## Lásd még

- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): mit rögzít az alapterv, és hogyan számítja ki az alkalmazás az eltérést.
- [Projekt áthelyezése](docs://howto-project-verplaatsen): az *Alapterveket is eltolja* jelölőnégyzet.
- [Előrehaladás frissítése](docs://howto-voortgang-bijwerken): a tényleges előrehaladás rögzítése, amelyet az alaptervvel hasonlít össze.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): egy alapterv (*Baseline at start*) a kezdés előtt, előrehaladással és 2027. május 20-i állapotdátummal.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): két alapterv, a *Contract* és a *Re-baseline (variation order)*, előrehaladással és 2027. július 5-i állapotdátummal.
