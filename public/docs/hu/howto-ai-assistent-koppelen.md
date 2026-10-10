# AI-segítőtárs csatlakoztatása (MCP)

Cél: egy AI-segítőtárs segítsen az ütemezésében. Ön lássa, mit tesz, és Ön állítsa be a korlátait.

## Mikor van erre szükség

Ön azt szeretné, hogy egy AI-segítőtárs olvassa, elemezze vagy módosítsa az ütemezését. Például azért, hogy készítsen egy első WBS-t, javítsa a tevékenységeket, vagy magyarázza el a kritikus utat. Ez a **Model Context Protocol** (MCP) révén működik: ez egy szabvány, amely lehetővé teszi, hogy egy AI-segítőtárs egy program eszközeit használja. Ehhez az Open Planner Studio egy kis szervert futtat a saját számítógépén: ez a **híd**. A híd eszközöket kínál, mindegyik neve `planner_` előtaggal kezdődik: tevékenységek, kapcsolatok, erőforrások, naptárak, alaptervek, dokumentumok és fájlok olvasása és módosítása. Hogy melyek ezek, és mit utasítanak el, azt az [AI-eszközök](docs://ref-ai-tools) cikkben találja. Hogy miért ilyen a kapcsolat, azt a [Hogyan működik az AI-kapcsolat](docs://uitleg-ai-koppeling) cikkben olvashatja el.

A híd csak az asztali alkalmazásban működik. Ha a böngészőben bekapcsolja az AI-módot, látja az *AI* fület, de a *Híd indítása* gomb szürke, és ez a szöveg látszik: *A híd csak az asztali alkalmazásban működik.* A cikk többi része az asztali alkalmazásról szól. A böngészőben a *Biztonsági mentés most* és a *Biztonsági mentési mappa megnyitása* gombok is szürkék.

## Lépések

### 1. Kapcsolja be az AI-módot

1. Válassza a *Beállítások › Projekt › Beállítások* lehetőséget. Választhatja a *Fájl › Beállítások* lehetőséget is, vagy a felső részen lévő fogaskereket.
2. Válassza a *Speciális* fület, és kapcsolja be az *AI-mód bekapcsolása* beállítást. Megjelenik az *AI* fül a menüszalagon.
3. Ha azt szeretné, hogy a híd már az alkalmazás indulásakor működjön, kapcsolja be a *Híd automatikus indítása* beállítást is. Ez csak akkor kapcsol be, ha az AI-mód be van kapcsolva, és csak az asztali alkalmazásban működik. Alapértelmezés szerint ki van kapcsolva, mert a port megnyitása tudatos döntés.

Ha az AI-módot kikapcsolja, a híd leáll, és eltűnik az *AI* fül.

### 2. Indítsa el a hidat

1. Nyissa meg az *AI* fület, és a *Szerver* alatt kattintson a *Híd indítása* gombra.
2. Nézze meg a gomb melletti státuszt. A szöveg ez lehet: *Ki*, *Aktív a(z) 3877 porton*, *A(z) 3877 port foglalt* vagy *Hiba*. Ha az indítás sikerül, a szöveg *Aktív a(z) 3877 porton* lesz, és a gomb neve *Híd leállítása*. Ha *A(z) 3877 port foglalt* vagy *Hiba* látszik, a gomb *Híd indítása* marad; lásd a buktatókat.

A híd csak a saját számítógépén figyel, egy porton. Alapértelmezés szerint ez a 3877-es port. A *Csatlakozás* csoportban a *Port* alatt másikat választhat, de csak akkor, ha a híd le van állítva.

### 3. Csatlakoztassa az AI-segítőtársat

1. Kattintson a *Csatlakozás* gombra a *Csatlakozás* csoportban. Megnyílik a *Kapcsolat adatai* ablak.
2. Válassza ki, mire van szüksége a kliensnek. Lásd alább.
3. A token rejtve van. A szem ikonnal megjelenítheti. A másoló gombok mindig a valódi értéket másolják, akkor is, ha a képernyőn rejtve van a token.
4. Kérje meg az AI-segítőtársat, hogy kérje le az eszközök listáját. Ezt az ellenőrzést a csatlakozási prompt is tartalmazza: az AI-segítőtársnak látnia kell a `planner_` előtagú eszközöket; a várt szám a csatlakozási promptban van.

Az ablak három módot kínál a csatlakozásra:

- *Konfigurációs részlet*: egy konfigurációs részlet, amelyet a kliens MCP-beállításaiba illeszt be.
- *Csatlakozási prompt*: egy szöveg, amelyet beilleszt az AI-segítőtársba. Utána a segítőtárs maga csatlakozik.
- *Végpont* és *Hitelesítés*: a külön adatok. A végpont `http://localhost:3877/mcp`, az átvitel *streamelhető HTTP*. Minden kérésben szerepelnie kell egy `Authorization: Bearer` fejléc, amelyet az Ön tokenje követ.

A *Csatlakozás* csoportban van a *Token* mező is. Ez egy hosszú, véletlenszerű kód, amelyet az alkalmazás készít, és ezen a számítógépen tárol. Az ablakban ez áll: *Ez a token hozzáférést ad a megnyitott tervhez. Ne ossza meg másokkal.* Az *Új token* ikonnal új tokent készíthet. Az alkalmazás először ezt kérdezi: *Új token létrehozása minden meglévő kapcsolatot megszüntet. Folytatja?* Ha a híd fut, újraindul az új tokennel, és a régi token nem működik többé.

### 4. Nézze meg, mit tesz az AI

1. Kattintson a *Tevékenységpanel* elemre az *Aktivitás* csoportban. Az oldalsó oszlopban megnyílik az *AI-tevékenység* panel.
2. A híd minden hívása egy sorban jelenik meg, a legújabb felül: az idő, hogy mi történt, mennyi ideig tartott, és hogy sikeres volt-e. Kattintson egy sorra, hogy kibontsa az *Argumentumok* és a *Válasz* részt.
3. A *Törlés* gombbal üríti ki a listát. A panel az utolsó 500 hívást tartja meg. Amíg nincs hívás, ez áll benne: *Még nincs AI-tevékenység. A híd hívásai itt jelennek meg.*

Ha az AI-mód be van kapcsolva, az állapotsor jobb alsó sarkában van egy pont, az *AI* felirattal. Színe mutatja a híd státuszát. Ha rákattint, az *AI* fülre jut.

### 5. Állítson be korlátokat

A *Biztonság* csoportban vannak azok a gombok, amelyekkel korlátozza az AI-t:

- *Szüneteltetés*: az AI ideiglenesen semmit sem módosíthat, az olvasás megengedett marad. A híd aktív marad. A gomb neve *Folytatás* lesz.
- *Csak olvasható*: ha ez be van kapcsolva, az alkalmazás elutasítja az összes olyan eszközt, amely valamit módosít.
- *Auto-mentés: be*: az AI első módosítása előtt az alkalmazás IFC-mentést ír egy dokumentumban. Ez alapértelmezés szerint be van kapcsolva. A gombbal ki lehet kapcsolni; ekkor ez áll: *Auto-mentés: ki*. Ez dokumentumonként egyszer történik meg, minden alkalommal, amikor elindítja a hidat.
- *Biztonsági mentés most*: azonnal mentést készít az aktív dokumentumról. Utána ez áll: *Biztonsági mentés létrehozva:* a fájlnévvel.
- *Biztonsági mentési mappa megnyitása*: megnyitja a mentések mappáját.

A mentések az `ai-backups` mappában vannak, az alkalmazás adatmappájában. Az alkalmazás a friss mentéseket megtartja, a régebbieket pedig ritkítja. A pontos működés az [AI-eszközök](docs://ref-ai-tools) cikkben olvasható.

### 6. Gondoskodjon róla, hogy az AI-segítőtárs jól ütemezzen

Egy AI-segítőtárs, amely ismeri az eszközöket, akkor is olyan ütemezést készíthet, amelyet egyetlen ütemező sem tud használni: kapcsolatok nélküli tevékenységeket, minden tevékenységen rögzített dátumot, vagy túl részletes bontást. Ezért az AI-segítőtárs háromféleképpen kapja meg az ütemezési szabályokat. Az első kettőhöz Önnek nem kell tennie semmit.

1. **Az alapszabályok maguktól érkeznek.** Csatlakozáskor a híd egy rövid szöveget küld az alapszabályokkal. Sok kliens ezt a rendszerpromptjába teszi. Hogy az Ön kliense így tesz-e, az a klienstől függ. A szöveg többek között ezt mondja: a mérföldkövek megadásával kezdjen, körülbelül egy naptól két hétig tartó tevékenységeket készítsen, az ütemezést kapcsolatokkal vezérelje, ne rögzített dátumokkal, és a végén mondja el, mit feltételezett.
2. **A csatlakozási prompt a teljes útmutatóra mutat.** A *Kapcsolat adatai* ablak csatlakozási promptja arra kéri az AI-segítőtársat, hogy először olvassa el az ütemezési útmutatót a `planner_get_planning_guide` eszközzel. Ez egy angol nyelvű útmutató a segítőtársaknak: ugyanazok az elvek, mint a [Jól ütemezni](docs://gids-goed-plannen) cikkben, és mindegyikhez megadja, mely eszközöket használja. Ön maga is elolvashatja itt: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Ha nem használja a promptot, kérje meg az AI-segítőtársat, hogy ezt tegye: *Olvassa el először a `planner_get_planning_guide` eszközzel az ütemezési útmutatót, mielőtt bármit módosít.*
3. **Opcionálisan: a skillek.** Egy skill egy kis instrukciófájl, amelyet egy AI-segítőtárs minden munkamenetben elolvas. Így egy későbbi beszélgetésben is tudja a helyes munkamódot. Kettő van, mindkettő angolul: *goed-plannen* egy ütemezés felállításához vagy átalakításához, és *progress-update* a heti előrehaladás-frissítéshez. Minden skill egy `SKILL.md` nevű fájl a saját, a skill nevét viselő mappájában: `.claude/skills/goed-plannen/SKILL.md` és `.claude/skills/progress-update/SKILL.md` abban a projektmappában, ahol az AI-segítőtárs dolgozik, vagy ugyanezek a mappák a `~/.claude/skills/` alatt, hogy minden projektben működjenek. Ez csak olyan AI-segítőtárssal működik, amely támogatja a skilleket. A skillek maguk a Claude Code-ot és a hasonló segítőtársakat említik.

A fájlokat kétféleképpen kapja meg. Kérje meg az AI-segítőtársat, hogy hívja meg a `planner_get_planning_guide` eszközt, a `part` paramétert `skill` értékre állítva: a válasz mindkét szöveget tartalmazza, és skillenként megadja, hová tartoznak. Vagy töltse le őket innen: `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` és `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ha a *goed-plannen* még ott van az alkalmazás egy régebbi verziójából, cserélje ki. A régi szöveg hollandul készült, és a Súgó-cikkre mutat, nem az AI-segítőtársak útmutatójára.

Azt, hogy a segítőtárs tényleg elolvasta-e az útmutatót, a *Tevékenységpanel* nevű panelen láthatja: ekkor szerepel egy hívás a `planner_get_planning_guide` eszközre. A végső válaszának tartalmaznia kell egy listát a feltevésekről: becsült időtartamok, a választott bontás, a saját maga által létrehozott kapcsolatok és minden beállított korlátozás. Ha ez a lista hiányzik, kérje el. Egy *progress-update* szerinti előrehaladás-frissítés után a válasznak meg kell neveznie az állapotdátumot, az új befejezés dátumát és az alapterv szerinti eltérést.

## Buktatók és mit tesz ilyenkor az alkalmazás

**Az AI olyasmit módosít, amit Ön vissza szeretne vonni.** Az AI minden módosítása egy lépés, amelyet a *Visszavonás* paranccsal (Ctrl+Z) vonhat vissza. Az AI által egyben átadott módosítássorozat egy lépés. Ezután a projekt mentetlenként látszik. Egy módosítás után az alkalmazás újraszámítja az ütemezést, így Önnek nem kell az F5 billentyűt megnyomnia.

**Az alkalmazás elutasít egy AI-hívást.** Ha a *Szüneteltetés* vagy a *Csak olvasható* be van kapcsolva, az alkalmazás minden módosítást elutasít. Az olvasás lehetséges marad, beleértve az elavult ütemezés újraszámítását is. Ha Ön éppen maga szerkeszt, például húz egy sávot vagy szöveget ír be egy mezőbe, az AI az Ön szerkesztése előtti dátumokat kapja, és figyelmeztetést, hogy azok elavultak. Ha párbeszédablak van nyitva, például a beállítások, egy tevékenység-párbeszédablak vagy az üdvözlőablak, vagy be van kapcsolva a prezentációs mód, az alkalmazás minden hívást elutasít, az olvasást is, amíg be nem zárja az ablakot. Az AI ekkor hibaüzenetet kap a nyitott elem belső nevével, például `showTaskDialog`. Csak a `planner_get_planning_guide` működik tovább, mert az nem olvassa az ütemezését.

**Ön fület vált, miközben az AI dolgozik.** Az AI azon a dokumentumon dolgozik, ahol az első módosítása történt. Ha közben fület vált, az alkalmazás elutasítja a következő módosítását, amíg az AI meg nem erősíti, hogy a másik fülön akar dolgozni. Így semmi nem kerül rossz projektbe.

**Az AI fájlt ír vagy nyit meg.** Az AI ütemezést írhat IFC-fájlba, és ütemezést tartalmazó fájlt nyithat meg új fülön. Ezt csak az Ön felhasználói mappáján belül teheti meg. Meglévő fájlt csak akkor ír felül, ha kifejezetten kéri.

**A státusz *A(z) 3877 port foglalt*.** Egy másik program használja a portot. Az alkalmazás üzenete a státusz alatt látszik. A *Port* mező ekkor zárolva marad (*Csak akkor szerkeszthető, ha a szerver le van állítva.*), pedig a híd nem fut, és nincs leállítás gomb. Ez ismert hiányosság. Amíg ezt nincs javítva, kapcsolja ki, majd újra be az *AI-mód bekapcsolása* beállítást. Ekkor a státusz újra *Ki*, és másik portot választhat. Utána másolja újra a kapcsolat adatait, mert a végpont tartalmazza a portot.

**A kliens nem tud csatlakozni új token után.** Az új token megszakítja az összes meglévő kapcsolatot. Adja meg a kliensnek az új tokent, vagy illessze be újra a konfigurációs részletet.

**Ön állította le a hidat, és az nem indul magától újra.** A *Híd automatikus indítása* beállítás minden alkalommal egyszer működik, amikor az alkalmazás elindul. Ha Ön állítja le a hidat, az alkalmazás nem kapcsolja be csendben újra.

**Az *AI* fül eltűnt.** Az AI-mód ki van kapcsolva. Kapcsolja be az 1. lépésben.

**Egy weboldal a böngészőben nem tud beszélni a híddal.** A híd minden olyan kérést elutasít, amely böngészőből érkezik, és minden olyan kérést, amelynek nincs megfelelő tokenje.

## Lásd még

- [Visszajelzés adása](docs://howto-feedback-geven): ha a kapcsolat másként működik, mint itt olvasható, jelezze.
- [Hogyan működik az AI-kapcsolat](docs://uitleg-ai-koppeling): mi a kapcsolat, miért az AI-segítőtárs dolgozik a megnyitott projektben, és mit nem tehet meg.
- [AI-eszközök](docs://ref-ai-tools): az összes `planner_*` eszköz csoportonként, a hibakódok és a mentések megőrzési ideje.
- [Jól ütemezni](docs://gids-goed-plannen): az ütemezési elvek; az AI-segítőtárs ezeket angol változatban kapja, az eszközökkel kiegészítve.
- [Beállítások](docs://ref-instellingen): az AI-beállítások.
