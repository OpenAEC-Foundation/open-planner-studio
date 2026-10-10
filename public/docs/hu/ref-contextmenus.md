# Jobb egérgombos menük

Ez az oldal leírja, mely menüket nyitja meg a jobb egérgomb a Gantt-diagramban és a tevékenységtáblázatban, mit tesz egy-egy elem, és mely tevékenységekre vonatkozik. Az elemek, amelyek gombként vagy billentyűparancsként is megvannak, a [A menüszalag, laponként](docs://ref-lint) és a [Billentyűparancsok](docs://ref-sneltoetsen) részben találhatók.

## Melyik menü hol nyílik meg

Négy menü van. Attól függ, melyik nyílik meg, hogy hova kattint:

- **Egy tevékenységsávon a Gantt-diagramban** — a tevékenységmenü, a tetején a *Kapcsolat létrehozása innen* elemmel.
- **Egy tevékenységen a tevékenységtáblázatban** — ugyanaz a tevékenységmenü, de a tetején nincs az az elem. Ez vonatkozik a Gantt-diagram bal oldalán lévő tevékenységtáblázatra és a *Táblázat* lapra is.
- **Egy csoportfejlécen a tevékenységtáblázatban** — egy kis menü a csoportok kibontásához és összecsukásához. Csoportfejléc csak csoportosításkor jelenik meg, például az *Erőforrásdiagram* elrendezés használatakor.
- **Üres helyen** — a Gantt-diagramban a sávok mellett vagy alatt, a tevékenységtáblázatban az utolsó tevékenység alatt vagy a szürke *Új tevékenység* soron. A menü tartalmazza az *Új tevékenység*, a *Mérföldkő hozzáadása* és a *Beillesztés* elemet; a Gantt-diagramban emellett a *Nagyítás visszaállítása* és az *Illesztés a projekthez* elemet is. Az új tevékenység vagy mérföldkő a lista aljára kerül. A Gantt-diagramban a kattintás helyén lévő dátumnál kezdődik. A tevékenységtáblázatban a névcella azonnal megnyílik, így közvetlenül gépelhet.

A csoportfejléc sávján a Gantt-diagramban a jobb egérgomb nem nyit meg menüt. Az idővonal fejlécén a jobb kattintás sem tesz semmit. A tevékenységtáblázat oszlopfejlécének saját menüje van. Ezt a [Táblázatoszlopok beállítása](docs://howto-tabelkolommen-aanpassen) írja le.

**Mely tevékenységekre vonatkozik egy elem?** Ön egy tevékenységre kattint, de a kijelölés határozza meg a hatókört. Ha az a tevékenység, amelyre kattint, a kijelölés része, az elem a teljes kijelölésre vonatkozik. Ha nem, csak arra az egy tevékenységre. Jobb kattintásnál egy sávon vagy egy soron az a tevékenység váltja fel a kijelölést, ha nem volt a kijelölés része. Minden elem, amely módosít valamit, egy lépés a *Visszavonás* parancsban, a teljes kijelölésre is.

## A tevékenységmenü

Az elemek ebben a sorrendben szerepelnek. Két csoport között elválasztó vonal van a menüben.

**Kapcsolat létrehozása innen** — csak a Gantt-diagramban, egy sávon. Bekapcsolja a kapcsolatmódot a kijelölt tevékenységgel; ezután az utódra húzhatja. Lásd: [Kapcsolatok hozzáadása](docs://howto-relaties-leggen).

**Szünet megszüntetése** és **Összes szünet megszüntetése** — csak a Gantt-diagramban, egy olyan sávon, amelyen szünetek vannak. A *Szünet megszüntetése* csak akkor jelenik meg, ha egy szünetre vagy az utána következő részre kattint, és a szünet szerkeszthető. Ez az egy szünetet törli. Az *Összes szünet megszüntetése* mindet törli, a forrásfájlból származókat is, amelyeket nem lehet szerkeszteni. Lásd: [Tevékenység felosztása](docs://howto-taak-splitsen).

**Szerkesztés...** — megnyitja a *Tevékenység szerkesztése* ablakot ehhez a tevékenységhez. Lásd: [Tevékenység párbeszédablak és tulajdonságok panel](docs://ref-taak-eigenschappen).

**Beszúrás fölé** és **Beszúrás alá** — egy új tevékenységet szúr be a hatókör legfelső tevékenysége fölé, vagy a legalsó alá, ugyanazon a szinten. Csak tiszta fanézetben működik, szűrő, csoportosítás vagy rendezés nélkül. Egyébként az alkalmazás üzenettel elutasítja a műveletet. Lásd: [Tevékenységek és mérföldkövek hozzáadása](docs://howto-taken-en-mijlpalen-toevoegen).

**Altevékenység hozzáadása** — új tevékenységet ad hozzá altevékenységként a tevékenységhez, amelyre rákattint, az altevékenységek alján. Csak arra az egy tevékenységre vonatkozik, nem a teljes kijelölésre.

**Mérföldkő hozzáadása** — mérföldkövet ad hozzá altevékenységként a tevékenységhez, amelyre rákattint. Csak arra az egy tevékenységre vonatkozik.

**Kapcsolat hozzáadása** — ugyanaz, mint a *Kapcsolat létrehozása innen*: bekapcsolja a kapcsolatmódot a kijelölt tevékenységgel. A tevékenységtáblázatban az elem le van tiltva, ha a Gantt-diagram nincs látható. A súgószöveg ilyenkor: *Csak akkor érhető el, ha a Gantt-diagram látható*.

**Behúz** és **Kihúz** — a hatókör tevékenységeit eggyel mélyebb vagy eggyel magasabb szintre helyezi a WBS-ben. Ez a két elem csak a tiszta fanézetben látható. Lásd: [A szerkezet módosítása](docs://howto-structuur-aanpassen).

**Mérföldkő váltása** — a tevékenységet mérföldkővé alakítja, vagy vissza. Az eredmény a tevékenységből következik, amelyre rákattint, és a teljes hatókörre vonatkozik: ha az még nem mérföldkő, a hatókör összes tevékenysége mérföldkővé válik. Egy összefoglaló tevékenység és egy hozzárendeléssel rendelkező tevékenység nem válik mérföldkővé. A hatókör többi tevékenysége igen. Indokonként kap egy üzenetet.

**Naptár hozzárendelése ▸** — almenü, benne a *Projektnaptár* (akkor a tevékenységnek nincs saját naptára), alatta az elérhető naptárak. A jelenlegi választás pipát kap. Egy tevékenység, amely már ezen a naptáron van, nem számít bele, és nem ad külön lépést a *Visszavonás* parancshoz. Lásd: [Naptár létrehozása és hozzárendelése](docs://howto-kalender-maken-en-toewijzen).

**Előrehaladás ▸** — almenü 0%, 25%, 50%, 75% és 100% értékkel. A jelenlegi érték pipát kap. Összefoglaló tevékenységnek nincs saját előrehaladása: ha a hatókörben van ilyen, az alatta lévő, altevékenység nélküli tevékenységek kapják meg a százalékot. Állapotdátum nélkül az alkalmazás a mai napra állítja, és üzenetet jelenít meg. Ha egy tevékenység tervezett kezdése az állapotdátum után van, és még nincs tényleges kezdése, előbb a tényleges kezdésre vonatkozó kérdést jeleníti meg. Ha elveti, nem változik semmi. Lásd: [Előrehaladás frissítése](docs://howto-voortgang-bijwerken).

**Prioritás ▸** — almenü, benne az *Alacsony* (100), a *Normál* (500) és a *Magas* (900) elemmel: ez a tevékenység kiegyenlítési prioritása. A jelenlegi érték pipát kap. Lásd: [Erőforrás-kiegyenlítés](docs://uitleg-nivelleren).

**Útvonalkövetés** — megjeleníti ennek a tevékenységnek az elődeit és utódait. Ha a követés már be van kapcsolva, az elem neve *Útvonalkövetés leállítása*. Lásd: [Útvonalkövetés](docs://howto-pad-traceren).

**Összecsukás**, **Kibontás** és **Ág mentése sablonként** — csak összefoglaló tevékenységnél. Az *Összecsukás* és a *Kibontás* mindig látható, mindkettő, akkor is, ha a tevékenység már össze van csukva vagy ki van bontva, és a teljes hatókörre vonatkoznak. Az *Ág mentése sablonként* a tevékenységet az altevékenységeivel és az azok közötti kapcsolatokkal együtt WBS-sablonként menti. Lásd: [WBS-sablonok mentése és beszúrása](docs://howto-wbs-sjablonen).

**Törlés** — törli a hatókör tevékenységeit az altevékenységeikkel együtt. Nincs megerősítés. A Ctrl+Z billentyűkombinációval visszaállíthatja őket, a teljes hatókörre egy lépésben. Lásd: [Tevékenységek kijelölése, törlése és visszavonása](docs://howto-taken-selecteren-verwijderen).

## A csoportfejléc menüje

Ez a menü csak a tevékenységtáblázatban van, csoportfejlécen:

**Csoport összecsukása** vagy **Csoport kibontása** — csak ezt a csoportot csukja össze vagy bontja ki. Az elem jelzi, mit lehet tenni.

**Összes kibontása** és **Összes összecsukása** — egyszerre az összes csoportot kibontja vagy összecsukja.

Csoportosítást egy elrendezéssel állíthat be. Lásd: [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken).

## Lásd még

- [Húzás, mozgatás és nagyítás a Gantt-diagramban](docs://howto-gantt-bedienen): mit csinál a húzás a bal és a középső egérgombbal.
- [A menüszalag, laponként](docs://ref-lint): a gombok, amelyek ugyanazt teszik.
- [Billentyűparancsok](docs://ref-sneltoetsen): a hozzájuk tartozó billentyűk.
