# A szerkezet módosítása

Cél: tevékenységek rendezése szakaszokba és altevékenységekbe, a sorrend módosítása, és a WBS-számok helyesek maradnak.

## Mikor van erre szüksége

Az ütemezése egy fa: szakaszok (összefoglaló tevékenységek), alattuk altevékenységekkel, például a *Foundation* szakasz *Groundwork*, *Reinforcement* és *Pouring* altevékenységekkel. Ezt a fát akkor módosítja, ha tevékenységeket szeretne egy szakasz alá rendelni, kivenni egyet onnan, vagy ha a sorrend hibás. A **WBS-kód** (1, 1.1, 1.2, 2, …) a tevékenység száma ebben a fában.

## Lépések

### Tevékenység egy szinttel lejjebb helyezése

1. Jelölje ki a tevékenységet. Több tevékenység egyszerre is kijelölhető.
2. Válassza az *Ütemezés › Szerkezet › Behúz* lehetőséget. Használhatja az Alt+→ (vagy Alt+Shift+→) billentyűkombinációt is, vagy a *Behúz* lehetőséget a jobb egérgombbal megnyíló menüben.

A tevékenység az ugyanazon a szinten lévő előző tevékenység utolsó altevékenysége lesz. Emiatt az előző tevékenység összefoglaló tevékenység lesz. Ha összefüggő tartományt jelöl ki, a tartomány egészben behúzódik. Ha a tevékenységnek nincs előző tevékenysége ugyanezen a szinten, nem történik semmi, és nem jelenik meg üzenet.

### Tevékenység kihúzása

Válassza az *Ütemezés › Szerkezet › Kihúzás* lehetőséget, nyomja meg az Alt+← (vagy Alt+Shift+←) billentyűkombinációt, vagy válassza a *Kihúzás* lehetőséget a jobb egérgombbal megnyíló menüben.

A tevékenység közvetlenül a szakasz után, testvérként kerül, eddig pedig a szakasz alá tartozott. Saját altevékenységei vele együtt mennek. Az ugyanabban a szakaszban utána következő tevékenységek továbbra is abban maradnak. A legfelső szinten lévő tevékenység nem húzható ki tovább.

### Tevékenység áthelyezése

Három mód van.

- **Billentyűzettel.** Az Alt+↑ és az Alt+↓ felcseréli a tevékenységet az ugyanazon a szinten lévő szomszédjával. Az összefoglaló tevékenység az altevékenységeit is viszi. A szint elején vagy végén nem történik semmi. Ha több tevékenység van kijelölve, csak az mozdul, amelyre előbb kattintott.
- **Húzás a tevékenységtáblázatban.** Nyomjon egy sorra, és húzza függőlegesen. A sor felső negyedébe húzva a tevékenység *előtt*, az alsó negyedébe húzva *után* kerül. Ha összefoglaló tevékenység közepére húzza, a tevékenység annak utolsó altevékenysége lesz. Egy normál tevékenység közepe a legközelebbi szélnek számít. Ha olyan sort húz, amely több tevékenységből álló kijelölés része, a teljes kijelölés mozog.
- **Húzás a Gantt-diagramban.** Húzza a sávot függőlegesen egy másik sorba. Ez ugyanúgy működik, mint a húzás a tevékenységtáblázatban, és nem változtat dátumokat. Ha vízszintesen húz, a dátumok tolódnak el.

Minden áthelyezés egy lépésnek számít a *Visszavonás* (Ctrl+Z) funkció számára.

### A WBS-számok naprakészen tartása

Nézze meg az *Ütemezés › Szerkezet* csoportban lévő *WBS automatikus* gombot.

- **Be** (alapértelmezett érték új projektben). Akkor is *be* lesz, ha olyan fájlt nyitja meg, amelyben nincs ez a beállítás, és minden WBS-kód már megegyezik a fa számozásával (1, 1.1, 1.2 …). A kódok nem változnak. Egy üres fájl, amelyben nincs ez a beállítás, szintén *be* lesz, akárcsak egy új projekt. Az alkalmazás minden hozzáadásnál, törlésnél és áthelyezésnél újraszámozza a teljes fát. A WBS-kód ekkor csak olvasható: nem írhatja be a tevékenységtáblázatba vagy a *Tulajdonságok* panelbe. A *WBS újraszámozása* le van tiltva.
- **Ki.** Az alapértelmezett érték olyan fájlban, amelynek saját kódjai vannak (például *A1000*), vagy ha egy kód eltér a fától. A kódok akkor is megmaradnak, ha áthelyezi vagy behúzza a tevékenységet. Ön maga írja be őket a *WBS* oszlopban vagy a *WBS-kód* mezőben a *Tulajdonságok* panelen, vagy egyszer újraszámoztatja őket a *WBS újraszámozása* lehetőséggel. Ez a saját kézzel beírt kódokat is felülírja.

Ha bekapcsolja a *WBS automatikus* lehetőséget, az alkalmazás azonnal megszámozza a fát. Mindkét művelet visszavonható a *Visszavonás* (Ctrl+Z) paranccsal: a *WBS automatikus* és a *WBS újraszámozása*.

## Buktatók, és mit tesz az alkalmazás

**Szűrés, csoportosítás vagy rendezés be van kapcsolva.** A látott sorrend ilyenkor nem az ütemezés sorrendje, ezért az alkalmazás zárolja a szerkezetet. A *Behúz* és a *Kihúzás* le van tiltva, a súgószöveggel: *Szűrés/csoportosítás/rendezés közben nem érhető el*. Az Alt+→ és a húzás ugyanazt a szöveget mutatja egy piros üzenetcsíkban, a *Törlés* gombbal. Ez egy lépésben eltávolítja a szűrést, a csoportosítást és a rendezést, és a Ctrl+Z nem hozza vissza őket. Az üzenetcsík addig látszik, amíg Ön rá nem kattint a kereszttel, nem használja a Ctrl+Z vagy a Ctrl+Y billentyűt, vagy nem vált másik dokumentumra. Ilyenkor a *Behúz* és a *Kihúzás* hiányzik a jobb egérgombbal megnyíló menüből.

Az Alt+↑ és az Alt+↓ ilyen nézetben is működik, üzenet nélkül. Csak szűrés esetén azonnal látja az új sorrendet. Rendezés esetén az ütemezés sorrendje megváltozik, de ezt csak a *Törlés* után látja.

**A WBS automatikus ki van kapcsolva.** Ez olyan fájlnál fordul elő, amelynek saját kódjai vannak, vagy amely a beállítást *ki* értékkel menti. Egy új tevékenység azt a kódot kapja, amely a helyének megfelel a fában, akkor is, ha egy másik tevékenységnek már van ilyen kódja. Így megismétlődő számok jelenhetnek meg. Miután behúzta a tevékenységet, a kódok sem egyeznek már a fával. A *WBS újraszámozása* mindkettőt megoldja.

**Mérföldkőhöz altevékenység kerül.** A mérföldkő egy időpont, és nincs altevékenysége. Az alkalmazás eltávolítja a mérföldkőjelölést, és szól erről.

**Erőforrás-hozzárendelésekkel rendelkező tevékenységhez altevékenység kerül.** Az összefoglaló tevékenység maga nem hordoz hozzárendeléseket. Ezért az alkalmazás először megkérdezi, mi legyen velük, az *Összefoglaló tevékenység lesz* ablakban. A kérdés akkor jelenik meg, ha behúzza a tevékenységet, ha egy tevékenységen az *Altevékenység hozzáadása* vagy a *Mérföldkő hozzáadása* lehetőséget használja, ha sablont szúr be, és ha a *Tevékenység szerkesztése* ablakban új szülőt választ a *Szülő tevékenység* mezőben. Ez meglévő és új tevékenység esetén egyaránt előfordul. A *Tevékenység szerkesztése* ablakban a kérdés a mentés előtt jelenik meg. Ha ott a *Mégse* lehetőséget választja, a *Tevékenység szerkesztése* ablak nyitva marad a módosításaival. Az alábbi lehetőségek közül választhat:

- *Mégse*: semmi sem változik, a szerkezet is megmarad az eredeti állapotában.
- *Hozzárendelés törlése*: a tevékenység altevékenységeket kap, a hozzárendelései pedig törlődnek. Ezekkel együtt a tényleges munka is törlődik.
- *Áthelyezés ide: „…”*: a hozzárendelések a tényleges munkájukkal együtt az első új altevékenységre kerülnek, amely képes őket fogadni. Mérföldkő vagy összefoglaló tevékenység nem hordoz hozzárendeléseket.

Ha ez az altevékenység már ugyanazzal az erőforrással rendelkezik, vagy nincs megfelelő altevékenység, az *Áthelyezés* le van tiltva. A narancssárga doboz az ablakban megmondja, miért.

Ha egy hozzárendelésnek már van tényleges munkája, a narancssárga doboz erőforrásonként megmondja az órák számát, például: *A(z) Metselaar hozzárendelésének már 8 óra tényleges munkája van. Az eltávolítással ez a munka elvész.* Ilyenkor a *Mégse* gomb az alapértelmezett. Az Enter nem változtat semmit. Ha mégis el szeretné távolítani a hozzárendelést, saját maga kattintson a *Hozzárendelés törlése* gombra.

Amíg az ablak nyitva van, az ablakon kívüli billentyűparancsok nem működnek, többek között a *Visszavonás*, a *Beillesztés*, a Delete, az F5 és a Ctrl+S. Ha egy művelet egyszerre több összefoglaló tevékenységet hoz létre, az ablak tevékenységenként mutatja az erőforrásokat, és az Ön választása mindegyikre vonatkozik. Egy *Visszavonás* (Ctrl+Z) az egész műveletet visszavonja.

**Kapcsolat ciklust hozna létre.** Az összefoglaló tevékenység kapcsolatai az altevékenységeire is vonatkoznak. Ha az áthelyezés emiatt ciklust hozna létre, az alkalmazás megtagadja, *Ez az áthelyezés ciklust hozna létre az ütemezésben (…)* üzenettel. Semmi sem változik.

**Kapcsolat egy tevékenység és a szakasza között.** Ha olyan szakasz alá helyez egy tevékenységet, amellyel már van kapcsolata, a kapcsolat megmarad, de a számításban már nem vesz részt. Az alkalmazás szól erről. Az összefoglaló tevékenységek kapcsolatairól bővebben itt olvashat: [Kapcsolatok és késleltetés](docs://uitleg-relaties).

**Az ütemezés már nem naprakész.** A másik szakaszba történő áthelyezés megváltoztathatja a dátumokat. Nyomja meg az **Ütemezés-számítás** (F5) parancsot. Ha csak a sorrendet cseréli fel ugyanazon a szakaszon belül, ez nem változtatja meg a dátumokat.

## Lásd még

- [Tevékenységek és mérföldkövek hozzáadása](docs://howto-taken-en-mijlpalen-toevoegen): helyezze az új tevékenységeket a megfelelő helyre.
- [WBS-sablonok mentése és beszúrása](docs://howto-wbs-sjablonen): egy egész szakasz újrahasználása.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): tevékenységek összekapcsolása.
- [Tevékenységek kijelölése, törlése és visszavonása](docs://howto-taken-selecteren-verwijderen): egy áthelyezés visszavonása.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): négy szakasz az altevékenységeivel, ahogyan behúzással építi fel őket.
