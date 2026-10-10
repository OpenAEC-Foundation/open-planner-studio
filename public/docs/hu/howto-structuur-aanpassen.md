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

A tevékenység közvetlenül a szakasz után következő testvér lesz, amely alá eddig tartozott. Saját altevékenységei vele együtt mennek. Az ugyanabban a szakaszban utána következő tevékenységek továbbra is abban maradnak. A legfelső szinten lévő tevékenység nem húzható ki tovább.

### Tevékenység áthelyezése

Három mód van.

- **Billentyűzettel.** Az Alt+↑ és az Alt+↓ felcseréli a tevékenységet az ugyanazon a szinten lévő szomszédjával. Az összefoglaló tevékenység az altevékenységeit is viszi. A szint elején vagy végén nem történik semmi. Ha több tevékenység van kijelölve, csak az mozdul, amelyre előbb kattintott.
- **Húzás a tevékenységtáblázatban.** Nyomjon egy sorra, és húzza függőlegesen. A sor felső negyedébe húzva a tevékenység *előtt*, az alsó negyedébe húzva *után* kerül. Ha összefoglaló tevékenység közepére húzza, a tevékenység annak utolsó altevékenysége lesz. Egy normál tevékenység közepe a legközelebbi szélnek számít. Ha olyan sort húz, amely több kijelölés része, a teljes kijelölés mozog.
- **Húzás a Gantt-diagramban.** Húzza a sávot függőlegesen egy másik sorba. Ez ugyanúgy működik, mint a húzás a tevékenységtáblázatban, és nem változtat dátumokat. Ha vízszintesen húz, a dátumok tolódnak el.

Minden áthelyezés egy lépésnek számít a *Visszavonás* (Ctrl+Z) funkció számára.

### A WBS-számok naprakészen tartása

Nézze meg az *Ütemezés › Szerkezet* csoportban lévő *WBS automatikus* gombot.

- **Be** (alapértelmezett érték új projektben). Az alkalmazás minden hozzáadásnál, törlésnél és áthelyezésnél újraszámozza a teljes fát. A WBS-kód ekkor csak olvasható: nem írhatja be a tevékenységtáblázatba vagy a *Tulajdonságok* panelbe. A *WBS újraszámozása* le van tiltva.
- **Ki.** A kódok megmaradnak, áthelyezés és szintváltás után is. Ön maga írja be őket a *WBS* oszlopban vagy a *WBS-kód* mezőben a *Tulajdonságok* panelen, vagy a *WBS újraszámozása* lehetőséggel egyszer újraszámoztathatja őket. Ez felülírja az Ön által beírt kódokat is.

Ha bekapcsolja a *WBS automatikus* lehetőséget, az alkalmazás azonnal megszámozza a fát. Mindkét művelet visszavonható a *Visszavonás* (Ctrl+Z) paranccsal: a *WBS automatikus* és a *WBS újraszámozása*.

## Buktatók, és mit tesz az alkalmazás

**Szűrés, csoportosítás vagy rendezés be van kapcsolva.** A látott sorrend ilyenkor nem az ütemezés sorrendje, ezért az alkalmazás zárolja a szerkezetet. A *Behúz* és a *Kihúzás* le van tiltva, a súgószöveggel: *Szűrés/csoportosítás/rendezés közben nem érhető el*. Az Alt+→ és a húzás ugyanazt a szöveget mutatja egy üzenetcsíkban, a *Törlés* gombbal. Ez egy lépésben eltávolítja a szűrést, a csoportosítást és a rendezést, és a Ctrl+Z nem hozza vissza őket. A *Behúz* és a *Kihúzás* ilyenkor hiányzik a jobb egérgombbal megnyíló menüből.

Az Alt+↑ és az Alt+↓ ilyen nézetben is működik, üzenet nélkül. Csak szűrés esetén azonnal látja az új sorrendet. Rendezés esetén az ütemezés sorrendje megváltozik, de ezt csak a *Törlés* után látja.

**A WBS automatikus ki van kapcsolva.** Egy új tevékenység azt a kódot kapja, amely a helyének megfelel a fában, akkor is, ha egy másik tevékenységnek már van ilyen kódja. Így megismétlődő számok jelenhetnek meg. Miután behúzta a tevékenységet, a kódok sem egyeznek már a fával. A *WBS újraszámozása* mindkettőt megoldja.

**Mérföldkőhöz altevékenység kerül.** A mérföldkő egy időpont, és nincs altevékenysége. Az alkalmazás eltávolítja a mérföldkőjelölést, és szól erről.

**Erőforráshozzárendeléssel rendelkező tevékenységhez altevékenység kerül.** Az összefoglaló tevékenység maga nem hordoz hozzárendeléseket. Az alkalmazás ezeket az első új altevékenységre helyezi, amely képes őket fogadni, és szól erről. Ha nincs ilyen altevékenység, vagy az már ugyanazzal az erőforrással rendelkezik, nem történik semmi, és az üzenet megmondja, miért.

**Kapcsolat ciklust hozna létre.** Az összefoglaló tevékenység kapcsolatai az altevékenységeire is vonatkoznak. Ha az áthelyezés emiatt ciklust hozna létre, az alkalmazás megtagadja, *Ez az áthelyezés ciklust hozna létre az ütemezésben (…)* üzenettel. Semmi sem változik.

**Kapcsolat egy tevékenység és a szakasza között.** Ha olyan szakasz alá helyez egy tevékenységet, amellyel már van kapcsolata, a kapcsolat megmarad, de a számításban már nem vesz részt. Az alkalmazás szól erről. Az összefoglaló tevékenységek kapcsolatairól bővebben itt olvashat: [Kapcsolatok és késleltetés](docs://uitleg-relaties).

**Az ütemezés már nem naprakész.** A másik szakaszba történő áthelyezés megváltoztathatja a dátumokat. Nyomja meg az **Ütemezés-számítás** (F5) parancsot. Ha csak a sorrendet cseréli fel ugyanazon a szakaszon belül, ez nem változtatja meg a dátumokat.

## Lásd még

- [Tevékenységek és mérföldkövek hozzáadása](docs://howto-taken-en-mijlpalen-toevoegen): helyezze az új tevékenységeket a megfelelő helyre.
- [WBS-sablonok mentése és beszúrása](docs://howto-wbs-sjablonen): egy egész szakasz újrahasználása.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): tevékenységek összekapcsolása.
- [Tevékenységek kijelölése, törlése és visszavonása](docs://howto-taken-selecteren-verwijderen): egy áthelyezés visszavonása.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): négy szakasz az altevékenységeivel, ahogyan behúzással építi fel őket.
