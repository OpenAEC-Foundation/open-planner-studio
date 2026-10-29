# AI-segítőtárs csatlakoztatása (MCP)

Cél: egy AI-segítőtárs segítsen az ütemezésében. Ön lássa, mit tesz, és Ön állítsa be a korlátait.

## Mikor van erre szükség

Ön azt szeretné, hogy egy AI-segítőtárs olvassa, elemezze vagy módosítsa az ütemezését. Például azért, hogy készítsen egy első WBS-t, javítsa a tevékenységeket, vagy magyarázza el a kritikus utat. Ez a **Model Context Protocol** (MCP) révén működik: ez egy szabvány, amely lehetővé teszi, hogy egy AI-segítőtárs egy program eszközeit használja. Ehhez az Open Planner Studio egy kis szervert futtat a saját számítógépén: ez a **híd**. A híd eszközöket kínál, mindegyik neve `planner_` előtaggal kezdődik: tevékenységek, kapcsolatok, erőforrások, naptárak, alaptervek, dokumentumok és fájlok olvasása és módosítása. Hogy melyek ezek, és mit utasítanak el, azt az [AI-eszközök](docs://ref-ai-tools) cikkben találja. Hogy miért ilyen a kapcsolat, azt a [Hogyan működik az AI-kapcsolat](docs://uitleg-ai-koppeling) cikkben olvashatja el.

A híd csak az asztali alkalmazásban működik. Ha a böngészőben bekapcsolja az AI-módot, látja az *AI* fület, de a *Híd indítása* gomb szürke, és ez a szöveg látszik: *A híd csak az asztali alkalmazásban működik.* A cikk többi része az asztali alkalmazásról szól. A böngészőben a *Biztonsági mentés most* és a *Biztonsági mentési mappa megnyitása* gombok is szürkék.

## Lépések

### 1. Kapcsolja be az AI-módot

1. Válassza a *Beállítások › Projekt › Beállítások* lehetőséget. Választhatja a *Fájl › Beállítások* lehetőséget is, vagy a felső részen lévő fogaskereket.
2. Válassza a *Speciális* fület, és kapcsolja be az *AI-mód bekapcsolása* beállítást. Megjelenik az *AI* fül a menüszalagon.
3. Ha azt szeretné, hogy a híd már az alkalmazás indulásakor működjön, kapcsolja be a *Híd automatikus indítása* beállítást is. Ez csak akkor működik, ha az AI-mód be van kapcsolva, és csak az asztali alkalmazásban. Alapértelmezés szerint ki van kapcsolva, mert a port megnyitása tudatos döntés.

Ha az AI-módot kikapcsolja, a híd leáll, és eltűnik az *AI* fül.

### 2. Indítsa el a hidat

1. Nyissa meg az *AI* fület, és a *Szerver* alatt kattintson a *Híd indítása* gombra.
2. Nézze meg a gomb melletti státuszt. Ez a szöveg lehet: *Ki*, *Aktív a(z) 3877 porton*, *A(z) 3877 port foglalt* vagy *Hiba*. Ha az indítás sikerül, a szöveg *Aktív a(z) 3877 porton* lesz, és a gomb neve *Híd leállítása*. Ha *A(z) 3877 port foglalt* vagy *Hiba* látszik, a gomb neve *Híd indítása* marad; lásd a buktatókat.

A híd csak a saját számítógépén figyel, egy porton. Alapértelmezés szerint ez a 3877-es port. A *Csatlakozás* csoportban a *Port* alatt másikat választhat, de csak akkor, ha a híd le van állítva.

### 3. Csatlakoztassa az AI-segítőtársat

1. Kattintson a *Csatlakozás* gombra a *Csatlakozás* csoportban. Megnyílik a *Kapcsolat adatai* ablak.
2. Válassza ki, mire van szüksége a kliensnek. Lásd alább.
3. A token rejtve van. A szem ikonnal megjelenítheti. A másoló gombok mindig a valódi értéket másolják, akkor is, ha a képernyőn rejtve van a token.
4. Kérje meg az AI-segítőtársat, hogy kérdezze le az eszközök listáját. Ezt az ellenőrzést a csatlakozási prompt is tartalmazza: az AI-segítőtársnak látnia kell a `planner_` előtagú eszközöket; a várt szám a csatlakozási promptban van.

Az ablak három módot kínál a csatlakozásra:

- *Konfigurációs részlet*: egy konfigurációs részlet, amelyet be kell illeszteni a kliens MCP-beállításaiba.
- *Csatlakozási prompt*: egy szöveg, amelyet be kell illeszteni az AI-segítőtársba. Utána a segítőtárs maga csatlakozik.
- *Végpont* és *Hitelesítés*: a külön adatok. A végpont `http://localhost:3877/mcp`, az átvitel *streamelhető HTTP*. Minden kérésben egy `Authorization: Bearer` fejlécnek kell szerepelnie, amelyet az Ön tokenje követ. A kliensnek MCP-munkameneteket is kell támogatnia: csatlakozáskor a híd munkamenetkódot ad a `Mcp-Session-Id` fejlécben, és elutasítja az összes későbbi kérést, amely ez nélkül érkezik. A Claude Code és az `mcp-remote` ezt maga megoldja.

**Frissítés után csatlakozzon újra.** Ha az AI-kliens már egy régebbi verziójú alkalmazáshoz csatlakozott, az még nem küld munkamenetkódot, és a híd minden kérést elutasít. Csatlakozzon ezért újra a frissítés után: indítson új munkamenetet a Claude Code-ban, és lépjen ki teljesen a Claude Desktopból, majd indítsa újra.

**Claude Code.** A konfigurációs részlet közvetlenül illik a Claude Code-hoz. Adja ki ezt a parancsot egy terminálban, a saját tokenjével a `<token>` helyett:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

A részletet a projektmappájában lévő `.mcp.json` fájlba is beteheti. Ebben az esetben ne adja hozzá a fájlt a git-tárolóhoz, mert a token hozzáférést ad a tervhez. A `.mcp.json` fájlból származó kiszolgálót a Claude Code-ban először jóvá kell hagyni.

**Claude Desktop.** A konfigurációs részlet nem illik közvetlenül a Claude Desktopba. A `claude_desktop_config.json` fájlban olyan programot kell megadni, amelyet a Claude Desktop maga indít el, nem címet. Ezért a külső `mcp-remote` eszközt használja közbeiktatva; ehhez Node.js kell. A Claude Desktopban válassza a *Beállítások › Fejlesztő › Konfiguráció szerkesztése* lehetőséget, tegye bele a fájlba ezt (a saját tokenjével), és indítsa újra a Claude Desktopot:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

A token szándékosan az `env` részben van, és nem az `args` részben: Windowson a Claude Desktop megtöri azt az argumentumot, amely szóközt tartalmaz. Az *egyéni összekötő* a Claude-ban (*Testreszabás › Összekötők*) nem működik a híddal. Ekkor a Claude az Anthropic-felhőből csatlakozik, és az nem éri el a hidat a saját számítógépén.

A *Csatlakozás* csoportban van a *Token* mező is. Ez egy hosszú, véletlenszerű kód, amelyet az alkalmazás készít az Ön számára, és ezen a számítógépen tárol. Az ablakban ez áll: *Ez a token hozzáférést ad a megnyitott tervhez. Ne ossza meg másokkal.* Az *Új token* ikonnal új tokent készíthet. Az alkalmazás először ezt kérdezi: *Új token létrehozása minden meglévő kapcsolatot megszüntet. Folytatja?* Ha a híd fut, újraindul az új tokennel, és a régi token többé nem működik.

### 4. Nézze meg, mit tesz az AI

1. Kattintson a *Tevékenységpanel* elemre az *Aktivitás* csoportban. Az oldalsó oszlopban megnyílik az *AI-tevékenység* panel.
2. A híd minden hívása egy sorban jelenik meg, a legújabb felül: az időpont, mi történt, mennyi ideig tartott, és hogy sikeres volt-e. Kattintson egy sorra, hogy kibontsa az *Argumentumok* és a *Válasz* részt.
3. A *Törlés* gombbal üríti ki a listát. A panel az utolsó 500 hívást tartja meg. Amíg nincs hívás, ez áll benne: *Még nincs AI-tevékenység. A híd hívásai itt jelennek meg.*

Ha az AI-mód be van kapcsolva, az állapotsor jobb alsó sarkában van egy pont, az *AI* felirattal. Színe mutatja a híd státuszát. Ha rákattint, az *AI* fülre jut.

### 5. Állítson be korlátokat

A *Biztonság* csoportban vannak azok a gombok, amelyekkel korlátozza az AI-t:

- *Szüneteltetés*: az AI ideiglenesen semmit sem módosíthat, az olvasás megengedett marad. A híd aktív marad. A gomb neve *Folytatás* lesz.
- *Csak olvasható*: ha ez be van kapcsolva, az alkalmazás elutasítja az összes olyan eszközt, amely bármit módosít.
- *Auto-mentés: be*: az AI első módosítása előtt az alkalmazás IFC-mentést ír egy dokumentumban. Ez alapértelmezés szerint be van kapcsolva. A gombbal ki lehet kapcsolni; ekkor ez áll: *Auto-mentés: ki*. Ez dokumentumonként egyszer történik meg, minden alkalommal, amikor elindítja a hidat.
- *Biztonsági mentés most*: azonnal mentést készít az aktív dokumentumról. Utána ez áll: *Biztonsági mentés létrehozva:* a fájl nevével.
- *Biztonsági mentési mappa megnyitása*: megnyitja a mentések mappáját.

A mentések az alkalmazás adatmappájában, az `ai-backups` mappában vannak. Az alkalmazás a friss mentéseket megtartja, a régebbieket pedig ritkítja. A pontos működés az [AI-eszközök](docs://ref-ai-tools) cikkben olvasható.

### 6. Gondoskodjon róla, hogy az AI-segítőtárs jól ütemezzen

Egy AI-segítőtárs csak akkor ütemez jól, ha ismeri az ütemezési szabályokat. Hogy miért fontos ez, és mi van bennük, azt a [Hogyan működik az AI-kapcsolat](docs://uitleg-ai-koppeling) cikkben olvashatja el. Ezeket a lépéseket Ön maga végzi el:

1. **Az alapszabályokhoz nem kell tennie semmit.** Ezek csatlakozáskor maguktól érkeznek. Hogy az Ön kliense a rendszerpromptjába teszi-e őket, az a klienstől függ.
2. **Kérje meg, hogy olvassa el az útmutatót.** A *Kapcsolat adatai* ablak csatlakozási promptja arra kéri az AI-segítőtársat, hogy a `planner_get_planning_guide` eszközzel olvassa el az ütemezési útmutatót. Ha nem használja a promptot, kérje meg az AI-segítőtársat: *Olvassa el először a planner_get_planning_guide eszközzel az ütemezési útmutatót, mielőtt bármit módosít.* Az útmutatót Ön maga is elolvashatja itt: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Opcionálisan: telepítse a skilleket.** Ez csak olyan AI-segítőtárssal működik, amely támogatja a skilleket. Helyezze a *goed-plannen* és a *progress-update* `SKILL.md` fájljait a `.claude/skills/goed-plannen/SKILL.md` és a `.claude/skills/progress-update/SKILL.md` helyre abban a projektmappában, amelyben az AI-segítőtárs dolgozik, vagy a `~/.claude/skills/` mappába, hogy minden projektben működjön.

A fájlokat kétféleképpen szerezheti meg. Kérje meg az AI-segítőtársat, hogy hívja meg a `planner_get_planning_guide` eszközt, a `part` paramétert `skill` értékre állítva: a válasz mindkét szöveget tartalmazza, és skillenként megadja, hová tartoznak. Vagy töltse le őket innen: `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` és `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ha a *goed-plannen* még egy régebbi alkalmazásverzióból van meg, cserélje ki: a régi szöveg hollandul készült, és a Súgó-cikkre mutat, nem az AI-segítőtársak útmutatójára.

Azt, hogy a segítőtárs valóban elolvasta-e az útmutatót, a *Tevékenységpanel* panelen láthatja: ott szerepel egy hívás a `planner_get_planning_guide` eszközre. A végső válaszának tartalmaznia kell egy listát a feltevésekről: a becsült időtartamokat, a választott bontást, a saját maga által létrehozott kapcsolatokat és minden beállított korlátozást. Ha ez a lista hiányzik, kérje el. Egy *progress-update* szerinti előrehaladás-frissítés után a válasznak meg kell neveznie az állapotdátumot, az új befejezési dátumot és az alapterv szerinti eltérést.

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
