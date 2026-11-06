# MCP-kliens csatlakoztatása

Cél: lehetővé tenni, hogy egy MCP-kliens olvassa és módosítsa az ütemezését, úgy, hogy látható legyen, mit csinál, és a korlátokat Ön szabja meg.

## Gyorsan: hagyja, hogy Claude elvégezze

Claude Desktopot vagy Claude Code-ot használja? Akkor Claude maga is telepítheti a kapcsolatot:

1. Kattintson lent a *Prompt másolása* gombra.
2. Illessze be a promptot egy új csevegésbe Claude-dal, és küldje el.

Claude ezután telepíti az Open Planner Studio bővítményt, és közben elmagyarázza, mit csinál. Ha valamit Önnek kell elvégeznie, például a Claude Desktopban a *Telepítés* gombra kattintania, Claude pontosan megmondja, melyik kattintást kell tennie. Ehhez nincs szükség tokenre.

```prompt
Telepítse nekem az Open Planner Studio bővítményt, hogy olvashassa és módosíthassa az építési ütemezéseimet az Open Planner Studioban. Végezzen el magától mindent, amit csak tud. Minden lépés előtt mondja meg egy egyszerű mondatban, mit fog tenni, és miért. Ha szükség van rám, egyszerre csak egy dolgot kérdezzen meg, és várja meg a válaszomat. Ha nekem kell valamit megtennem, mondja meg pontosan, melyik egyetlen kattintást vagy műveletet kell elvégeznem, és hol.

Amit tudnia kell:
- A bővítmény egyetlen fájl, az open-planner-studio-<version>.mcpb, a legújabb kiadásban: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. A közvetlen link ebben található: https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (az a fájl, amelynek a neve .mcpb-re végződik). A fájl ZIP-fájl.
- A bővítmény működik az Open Planner Studio asztali alkalmazással és alkalmazás nélkül is. Ha az alkalmazás nyitva van, és az MCP-híd fut, az alkalmazásban nyitva lévő tervben dolgozik. Ha az alkalmazás zárva van, az általam kiválasztott munkamappában lévő ütemezési fájlokon dolgozik.
- A telepítéshez nincs szükség tokenre és jelszóra. Ne kérjen tőlem egyet sem, és ne olvassa be vagy jelenítse meg egyiket sem.

Ha Claude Desktopban fut:
1. Ha tud fájlt letölteni, és meg tudja nyitni a számítógépemen, akkor ezt tegye meg az .mcpb-fájllal. Ha nem tudja, adja meg nekem a közvetlen letöltési linket, és mondja meg nekem, hogy a letöltés befejeztével kattintsak duplán a fájlra.
2. Claude Desktop ezután megjeleníti az Open Planner Studio bővítményt. Mondja meg nekem, hogy kattintsak a Telepítés gombra. Ezután mondja meg nekem, hogy a Working folder mezőben válasszam ki azt a mappát, amelyben az ütemezési fájljaim vannak.
3. Mondja meg nekem, hogy indítsak új csevegést, és ott kérdezzem meg Öntől, hogy milyen Open Planner Studio eszközöket lát.

Ha Claude Code-ban fut:
1. Ellenőrizze, hogy telepítve van-e a Node.js 22 vagy újabb verziója. Ha nincs, mondja meg nekem, hogyan telepíthetem, és álljon meg.
2. Kérdezze meg tőlem, melyik mappában vannak az ütemezési fájljaim. Ez a munkamappa.
3. Töltse le az .mcpb-fájlt, és csomagolja ki egy új, saját mappába a felhasználói mappámban. Olvassa el ott a manifest.json fájlt: a server.mcp_config megmondja, hogyan indul a szerver. Cserélje ki a ${__dirname} részt a kicsomagolt mappára, a ${user_config.workdir} részt pedig a munkamappára.
4. Futtassa a claude mcp list parancsot. Ha már van open-planner-studio nevű szerver, kérdezze meg tőlem, szabad-e lecserélnie. Ne jelenítse meg a beállításait, mert tokent tartalmazhatnak.
5. Adja hozzá a szervert a felhasználói fiókomhoz, például: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<munkamappa> -- node <kicsomagolt mappa>/server/index.mjs
6. Mondja meg nekem, hogy indítsak új Claude Code-munkamenetet, és hogy ott a /mcp megmutatja, kapcsolódik-e az open-planner-studio.

Ha máshol fut, például a böngészőben, a claude.ai oldalon, mondja meg nekem, hogy ehhez Claude Desktop vagy Claude Code szükséges. Ha nem tudja, hol fut, kérdezze meg tőlem.

Amikor a telepítés kész, magyarázza el néhány mondatban:
- hogyan engedélyezhetem Önnek, hogy a megnyitott alkalmazásban dolgozzon: az Open Planner Studioban válassza a Beállítások › Projekt › Alkalmazásbeállítások menüpontot, a Speciális fület, és kapcsolja be az MCP-kapcsolat engedélyezése lehetőséget. Ezután az MCP fülön kattintson a Híd indítása gombra.
- hogy alkalmazás nélkül a módosítás csak a mentés után kerül a fájlba, és hogy nyitott alkalmazás mellett nem írja felül a meglévő fájlt.
Ha egy lépés nem sikerül, mondja meg nekem egy mondatban, mi ment rosszul, és mit tehetek. Ne találgasson.
```

Inkább Ön szeretné elvégezni, vagy másik MCP-klienst használja? Akkor kövesse az alábbi lépéseket.

## Mikor van erre szüksége

Azt szeretné, hogy egy MCP-kliens olvassa, elemezze vagy módosítsa az ütemezését. Például hogy készítsen egy első WBS-t, javítsa a tevékenységeket, vagy magyarázza el a kritikus utat. Ez a **Model Context Protocol** (MCP) révén működik: ez egy olyan szabvány, amely lehetővé teszi, hogy egy AI-program, az **MCP-kliens**, egy másik program eszközeit használja. Ehhez az Open Planner Studio egy kis szervert futtat a saját számítógépén: ez a **híd**. Eszközkészletet kínál, mindegyik eszköz neve `planner_`-rel kezdődik: tevékenységek, kapcsolatok, erőforrások, naptárak, alaptervek, dokumentumok és fájlok olvasása és módosítása. Hogy melyek ezek, és mit nem engednek meg, azt az [MCP-eszközök](docs://ref-ai-tools) oldalon találja. Az MCP-kliens a megnyitott projektben dolgozik, nem egy másolatban: a tevékenység, amelyet hozzáadja, azonnal megjelenik a Gantt-diagramban. Ugyanazt a számítást használja, és ugyanazt a *Visszavonás* előzményt, mint Ön.

A híd csak az asztali alkalmazásban működik. Ha a böngészőben engedélyezi az MCP-kapcsolatot, akkor látja az *MCP* fület, de a *Híd indítása* gomb szürke, a rajta lévő szöveg: *A híd csak az asztali alkalmazásban működik*. A cikk többi része az asztali alkalmazásról szól. A böngészőben a *Biztonsági mentés most* és a *Biztonsági mentési mappa megnyitása* gombok is szürkék.

## Lépések

### 1. Engedélyezze az MCP-kapcsolatot

1. Válassza a *Beállítások › Projekt › Alkalmazásbeállítások* lehetőséget. Azt is választhatja: a *Fájl › Alkalmazásbeállítások* lehetőséget, vagy a felül lévő fogaskereket.
2. Válassza a *Speciális* fület, és kapcsolja be az *MCP-kapcsolat engedélyezése* lehetőséget. Megjelenik a menüszalagon az *MCP* fül.
3. Ha azt szeretné, hogy a híd már az alkalmazás indulásakor aktív legyen, kapcsolja be a *Híd automatikus indítása* lehetőséget is. Ez csak akkor működik, ha az MCP-kapcsolat be van kapcsolva, és csak az asztali alkalmazásban. Alapértelmezés szerint ki van kapcsolva, mert a port megnyitása tudatos döntés.

Ha kikapcsolja az MCP-kapcsolatot, a híd leáll, és az *MCP* fül eltűnik.

### 2. Indítsa el a hidat

1. Lépjen az *MCP* fülre, és kattintson a *Szerver* alatt lévő *Híd indítása* gombra.
2. Nézze meg a gomb melletti státuszt. Ott ez áll: *Ki*, *Aktív a(z) 3877 porton*, *A(z) 3877 port foglalt* vagy *Hiba*. Ha az indítás sikerül, ez áll: *Aktív a(z) 3877 porton*, és a gomb felirata *Híd leállítása* lesz. Ha a státusz *A(z) 3877 port foglalt* vagy *Hiba*, a gomb felirata továbbra is *Híd indítása* marad. Lásd a buktatókat.

A híd csak a saját számítógépén figyel, egy porton. Alapértelmezés szerint ez a 3877-es port. A *Csatlakozás* csoportban a *Port* alatt másik portot választhat, de csak akkor, ha a híd le van állítva. A kapcsolat sima HTTP a saját számítógépén. Maga az alkalmazás nem küld semmit kifelé. Az, hogy az MCP-kliens mit tesz az ütemezésével, például hogy a szolgáltatója mit kezd vele, az alkalmazáson kívül esik.

### 3. Csatlakoztassa az MCP-klienst

1. Kattintson a *Csatlakozás* gombra a *Csatlakozás* csoport alatt. Megnyílik a *Kapcsolat adatai* ablak.
2. Válassza ki, mire van szüksége az MCP-kliensnek. Lásd alább.
3. A token el van rejtve. A szem ikonnal megjelenítheti. A másológombok mindig a valódi értéket másolják, akkor is, ha a képernyőn el van rejtve a token.
4. Kérje meg az MCP-klienst, hogy kérje le az eszközök listáját. Ez az ellenőrzés a csatlakozási promptban is benne van: a kliensnek a `planner_` előtagú eszközöket kell látnia. A várt szám a csatlakozási promptban van.

Az ablakban négy csatlakozási mód érhető el:

- *Beállítás Claude-dal*: ugyanaz a prompt, mint a cikk elején, a *Prompt másolása* gombbal. Ez a Claude Desktop és a Claude Code esetében használható. Ehhez nincs szükség tokenre.
- *Konfigurációs részlet*: egy konfigurációs részlet, amelyet az MCP-kliens beállításaiba illeszt be.
- *Csatlakozási prompt*: egy szöveg, amelyet az MCP-kliensbe illeszt be. Ezután a kliens magától csatlakozik.
- *Végpont* és *Hitelesítés*: a külön adatok. A végpont `http://localhost:3877/mcp`, a szállítási mód pedig *streamable HTTP*. Minden kérésnek tartalmaznia kell az `Authorization: Bearer` fejlécet, amelyet a saját tokenje követ. Az MCP-kliensnek munkameneteket is kell támogatnia: csatlakozáskor a híd munkamenetkódot ad az `Mcp-Session-Id` fejlécben, és minden későbbi kérést visszautasít, amelyben ez a kód nincs benne. A Claude Code és az `mcp-remote` ezt magától elvégzi.

**Csatlakozzon újra az alkalmazás frissítése után.** Ha az MCP-kliens már csatlakozott az alkalmazás egy régebbi verziójához, még nem küld munkamenetkódot, és a híd minden kérést visszautasít. Ezért a frissítés után csatlakozzon újra: indítson új munkamenetet a Claude Code-ban, és lépjen ki teljesen a Claude Desktopból, majd indítsa újra.

**Claude Code.** A konfigurációs részlet közvetlenül illeszkedik a Claude Code-hoz. Futtassa ezt a parancsot egy terminálban. A `<token>` helyére írja a saját tokenjét:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

A konfigurációs részletet a projektmappában lévő `.mcp.json` fájlba is beillesztheti. Ezt a fájlt ne tegye git-be, mert a token hozzáférést ad a tervéhez. A `.mcp.json` fájlból származó szervert a Claude Code-ban először jóvá kell hagyni.

**Claude Desktop.** A Claude Desktophoz készült egy bővítmény: az `open-planner-studio-<version>.mcpb` fájl. A Claude Desktop dupla kattintással telepíti. Ehhez nincs szükség Node.js-re. A bővítmény az alkalmazással és az alkalmazás nélkül is működik. A cikk elején lévő prompt használatával gyorsabb. Alább kézzel követheti a lépéseket.

1. Töltse le a `.mcpb` fájlt a legutóbbi kiadásból: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Kattintson duplán a fájlra. A Claude Desktop megnyílik, és megmutatja az *Open Planner Studio* bővítményt. Telepítse. Ha a dupla kattintás nem működik, nyissa meg a Claude Desktopban a *Beállítások › Bővítmények* részt, és telepítse ott a fájlt.
3. A *Munkamappa* beállításnál válassza ki azt a mappát, amelyben az ütemezésfájlok vannak. A Claude csak akkor használja ezt a mappát, ha az alkalmazás zárva van. Ezután a Claude csak ebben a mappában olvas és ír.
4. Kapcsolja be a bővítményt, és indítson új csevegést. Kérdezze meg a Claude-tól, hogy az Open Planner Studio mely eszközeit látja.

Nem kell tokent és portot megadnia: amíg a híd fut, a bővítmény magától megtalálja az alkalmazást. Claude minden kérésénél a bővítmény újra választ:

- *Az alkalmazás nyitva van, és a híd fut*: Claude a megnyitott tervben dolgozik. Minden változtatást azonnal látja az alkalmazásban.
- *Az alkalmazás zárva van, vagy a híd ki van kapcsolva*: Claude a munkamappában lévő ütemezésfájlon dolgozik. Egy változtatás csak akkor kerül a fájlba, ha Claude menti a fájlt. Nincs automatikus mentés. Amíg az alkalmazás nyitva van, Claude nem írja felül a meglévő fájlt, hanem új néven menti.

Ha az alkalmazás megnyílik vagy bezárul, miközben Claude dolgozik, a bővítmény átvált, és erről értesíti Claude-ot. Claude ezután először újra kiválasztja vagy megnyitja a tervet, és csak utána változtat valamit. Ha Claude-nak még vannak olyan változtatásai az alkalmazás nélkül, amelyek nincsenek mentve, a bővítmény addig dolgozik tovább az alkalmazás nélkül, amíg Claude el nem menti őket. Így nem vész el munka. Ha a bővítmény nem éri el az alkalmazást, és nincs használható munkamappa, Claude csak az `open_planner_studio_status` eszközt látja, egy üzenettel, amely megmondja, mit kell tennie.

**Claude Desktop bővítmény nélkül.** Ha nem tudja használni a bővítményt, a Claude Desktopot az `mcp-remote` külső eszközzel kapcsolja össze. A konfigurációs részlet nem illeszkedik közvetlenül a Claude Desktophoz: a `claude_desktop_config.json` fájlban olyan programot kell megneveznie, amelyet a Claude Desktop maga indít el, nem egy címet. Az `mcp-remote` Node.js-t igényel. A Claude Desktopban válassza a *Beállítások › Fejlesztő › Konfiguráció szerkesztése* lehetőséget, tegye bele a fájlba ezt (a saját tokenjével), majd indítsa újra a Claude Desktopot:

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

A token az `env` mezőben van, és nem az `args` mezőben, szándékosan: Windowson a Claude Desktop szétválasztja azt az argumentumot, amelyben szóköz van. Az *egyéni összekötő* a Claude-ban (*Testreszabás › Összekötők*) nem működik a hiddal. Claude ilyenkor az Anthropic felhőjéből csatlakozik, és az nem éri el a hidat az Ön számítógépén.

A *Csatlakozás* csoportban van még a *Token* mező. Ez egy hosszú, véletlenszerű kód, amelyet az alkalmazás Önnek készít, és ezen a számítógépen tárol. Az ablakban ez áll: *Ez a token hozzáférést ad a megnyitott tervhez. Ne ossza meg másokkal.* Az *Új token* ikonnal új tokent hozhat létre. Az alkalmazás először ezt kérdezi: *Új token létrehozása minden meglévő kapcsolatot megszüntet. Folytatja?* Ha a híd fut, új tokennel indul újra, és a régi token már nem működik.

**Így találja meg a bővítmény az alkalmazást.** Amíg a híd fut, az asztali alkalmazás a portot és a tokent az alkalmazás adatmappájában lévő `mcp/runtime.json` fájlba írja. A Claude Desktop bővítménye ezt a fájlt minden kérésnél beolvassa. Linuxon és macOS-en csak az Ön felhasználói fiókja olvashatja a fájlt. Windowson a profilmappa alapértelmezett ACL-je védi a fájlt; az alkalmazás ezt külön nem ellenőrzi. Ha leállítja a hidat, vagy kikapcsolja az MCP-kapcsolatot, az alkalmazás eltávolítja a fájlt. Az alkalmazás a megnyitott fájlok listáját az `mcp/open-files.json` fájlban is vezeti, akkor is, ha az MCP-kapcsolat ki van kapcsolva. Amíg ez a fájl létezik, a bővítmény és a felület nélküli MCP-szerver nem írja felül a meglévő fájlokat, még azt a fájlt sem, amelyet Ön éppen megnyitott, és amely még nincs a listában. Új fájl létrehozása megengedett. Az olvasás is megengedett: Claude ilyenkor a lemezen lévő változatot látja, az Ön még nem mentett módosításai nélkül.

### 4. Nézze meg, mit csinál az MCP-kliens

1. Kattintson az *Aktivitás* alatt lévő *Tevékenységpanel* gombra. Az oldalsávban megnyílik az *MCP-tevékenység* panel.
2. A híd minden hívása egy sorban jelenik meg, a legújabb felül: az időpont, az, hogy mi történt, mennyi ideig tartott, és hogy sikeres volt-e. Kattintson egy sorra, hogy kibontsa az *Argumentumok* és a *Válasz* részt.
3. Az *Ürítés* gombbal üríti ki a listát. A panel az utolsó 500 hívást tartja meg. Amíg nem történt semmi, ez áll: *Még nincs MCP-tevékenység. A híd hívásai itt jelennek meg.*

Ha az MCP-kapcsolat be van kapcsolva, az állapotsor jobb alsó sarkában egy pont látható, *MCP* felirattal. Színe a híd státuszát mutatja, és ha rákattint, az *MCP* fülre jut.

### 5. Korlátok beállítása

A *Biztonság* alatt találhatók azok a gombok, amelyekkel korlátozhatja az MCP-klienst:

- *Szüneteltetés*: az MCP-kliens átmenetileg semmit nem változtathat, az olvasás továbbra is megengedett. A híd aktív marad. A gomb felirata *Folytatás* lesz.
- *Csak olvasható*: amíg ez be van kapcsolva, az alkalmazás visszautasít minden olyan eszközt, amely valamit megváltoztat.
- *Auto-mentés: be*: mielőtt az MCP-kliens egy dokumentumban az első változtatást végezné, az alkalmazás IFC-biztonsági mentést ír. Ez alapértelmezés szerint be van kapcsolva. A gombbal kikapcsolhatja; ekkor ez áll: *Auto-mentés: ki*. Ez dokumentumonként egyszer történik meg, minden híd-indításkor.
- *Biztonsági mentés most*: azonnal biztonsági mentést készít az aktív dokumentumról. Ezután ez áll: *Biztonsági mentés készült:*, a fájlnévvel együtt.
- *Biztonsági mentési mappa megnyitása*: megnyitja a biztonsági mentéseket tartalmazó mappát.

A biztonsági mentések az alkalmazás adatmappájában lévő `ai-backups` mappában vannak. Az alkalmazás megtartja a legutóbbi mentéseket, a régebbieket pedig ritkítja; a pontos működés itt olvasható: [MCP-eszközök](docs://ref-ai-tools).

### 6. Gondoskodjon arról, hogy az MCP-kliens jól tervezzen

Egy MCP-kliens csak akkor tervez jól, ha ismeri a tervezési szabályokat. Ezeket Ön végzi el:

1. **Az alapszabályokért nem kell tennie semmit.** Ezek a csatlakozáskor automatikusan megérkeznek: a híd az MCP-kézfogás `instructions` mezőjében küldi el őket. Az, hogy az MCP-kliens a rendszerpromptjába teszi-e őket, a klienstől függ.
2. **Kérje meg, hogy olvassa el az útmutatót.** A *Kapcsolat adatai* ablak csatlakozási promptja arra kéri az MCP-klienst, hogy olvassa el az útmutatót a `planner_get_planning_guide` eszközzel. Ha nem használja a promptot, ezt kérje az MCP-klienstől: *Olvassa el a tervezési útmutatót a planner_get_planning_guide eszközzel, mielőtt bármit megváltoztat.* Az útmutatót Ön is elolvashatja itt: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Nem kötelező: telepítse a skilleket.** Ez csak olyan MCP-klienssel működik, amely támogatja a skilleket. Helyezze a *goed-plannen* és a *progress-update* `SKILL.md` fájlját a `.claude/skills/goed-plannen/SKILL.md` és a `.claude/skills/progress-update/SKILL.md` helyre abban a projektmappában, amelyben az MCP-kliens dolgozik, vagy a `~/.claude/skills/` mappába, hogy minden projektben működjön.

A fájlokat két módon kapja meg. Kérje meg az MCP-klienst, hogy hívja meg a `planner_get_planning_guide` eszközt a `part` paraméterrel, amelynek értéke `skill`: a válasz mindkét szöveget tartalmazza, és minden skillnél az is olvasható, hová tartozik. Vagy töltse le őket innen: `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` és `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ha a *goed-plannen* még ott van egy régebbi verzióból, cserélje le: az a régi szöveg hollandul készült, és az MCP-klienseknek szóló útmutató helyett a súgócikkre mutat.

Azt, hogy az MCP-kliens valóban elolvasta-e az útmutatót, a *Tevékenységpanel* ablakban láthatja: ekkor szerepel egy hívás a `planner_get_planning_guide` eszközre. A végső válasznak tartalmaznia kell a feltételezések listáját: a becsült időtartamokat, a választott bontást, az általa létrehozott kapcsolatokat és az általa beállított minden korlátozást. Ha ez a lista hiányzik, kérje el. Egy *progress-update* skill szerinti előrehaladás-frissítés után a válasznak meg kell neveznie az állapotdátumot, az új befejezési dátumot és az alapterv szerinti eltérést.

## Buktatók és mit tesz ekkor az alkalmazás

**Az MCP-kliens olyan változtatást végez, amelyet vissza szeretne vonni.** Az MCP-kliens minden változtatása egy lépés, amelyet a *Visszavonás* (Ctrl+Z) paranccsal vonhat vissza. Az MCP-kliens által egészként átadott változtatássorozat egyetlen lépés. Ezután a projekt mentetlennek jelenik meg. Egy változtatás után az alkalmazás újraszámítja az ütemezést, így Önnek nem kell az F5 billentyűt megnyomnia.

**Az alkalmazás visszautasít egy hívást az MCP-klienstől.** A *Szüneteltetés* és a *Csak olvasható* mellett az alkalmazás minden változtatást visszautasít, az olvasás viszont megmarad, az elavult ütemezés újraszámítását is beleértve. Ha Ön éppen szerkesztést végez, például húz egy sávot vagy ír egy mezőbe, az MCP-kliens az Ön szerkesztése előtti dátumokat kapja meg, azzal a figyelmeztetéssel, hogy elavultak. Ha nyitva van egy párbeszédablak, például a beállítások, egy tevékenység párbeszédablaka vagy az üdvözlőablak, vagy be van kapcsolva a prezentációs mód, az alkalmazás minden hívást visszautasít, az olvasást is, amíg be nem zárja a párbeszédablakot. Az MCP-kliens ekkor egy hibaüzenetet kap, amely a megnyitott elem belső nevét tartalmazza, például `showTaskDialog`. Csak a `planner_get_planning_guide` működik tovább, mert nem olvassa az ütemezését.

**Ön másik dokumentumfület választ, miközben az MCP-kliens dolgozik.** Az MCP-kliens azon a dokumentumon dolgozik, ahol az első változtatása történt. Ha közben másik fület választ, az alkalmazás visszautasítja a következő változtatást, amíg az MCP-kliens meg nem erősíti, hogy a másik fülön akar dolgozni. Így semmi sem kerül a rossz projektbe. Ha az MCP-kliens saját maga nyit meg vagy duplikál egy dokumentumot, ezután abban az új dokumentumban dolgozik.

**Az MCP-kliens fájlt ír vagy nyit meg.** Az MCP-kliens ütemezést írhat IFC-fájlként, és ütemezésfájlt nyithat új fülön. Ezt csak az Ön felhasználói mappáján belül teheti meg. Meglévő fájlt csak akkor ír felül, ha ezt kifejezetten kéri.

**A státusz *A(z) 3877 port foglalt*.** Másik program használja a portot. Az alkalmazás üzenete alatta jelenik meg. Ekkor a port mező zárolva marad (*Csak akkor szerkeszthető, ha a szerver le van állítva.*), bár a híd nem fut, és nincs leállító gomb. Ez ismert hiányosság. Amíg ez nincs javítva, kapcsolja ki, majd újra be az *MCP-kapcsolat engedélyezése* lehetőséget. Ekkor a státusz ismét *Ki*, és másik portot választhat. Ezután másolja ki újra a kapcsolat adatait, mert a végpont tartalmazza a portot.

**Az MCP-kliens új token után nem tud csatlakozni.** Az új token minden meglévő kapcsolatot megszüntet. Adja meg a kliensnek az új tokent, vagy illessze be újra a konfigurációs részletet. A Claude Desktop bővítménye az új tokent magától olvassa be; ott nincs teendője.

**Ön állította le a hidat, és az nem indul el magától.** A *Híd automatikus indítása* minden indításkor egyszer lép működésbe. Ha Ön állítja le a hidat, az alkalmazás nem kapcsolja be csendben újra.

**Az *MCP* fül eltűnt.** Az MCP-kapcsolat ki van kapcsolva. Kapcsolja be az 1. lépésben.

**Egy weboldal a böngészőjében nem tud kommunikálni a híddal.** A híd minden olyan kérést visszautasít, amely böngészőből érkezik, és minden olyan kérést, amelynek nincs megfelelő tokenje.

## Az alkalmazás nélkül

Van egy MCP-kiszolgáló is, amely az asztali alkalmazás nélkül is működik: a **fejnélküli MCP-kiszolgáló**. Ugyanazokat a `planner_*` eszközöket kínálja, de a lemezen tárolt ütemezési fájlon dolgozik, nem a megnyitott projekten. Ezért nem látja a módosításokat a Gantt-diagramban, és az alkalmazásban a *Visszavonás* parancs sem vonatkozik rájuk. Használja akkor, ha nem akarja megnyitva tartani az alkalmazást, vagy olyan számítógépen, amelynek nincs képernyője.

A Claude Desktophoz készült bővítmény az alkalmazás bezárásakor automatikusan elindítja ezt a kiszolgálót (lásd a 3. lépést). Az alábbi lépések egy másik MCP-kliensre vonatkoznak, például a Claude Code-ra.

A kiadás nem tartalmaz kész kiszolgálót letöltésre. A forráskódból építi meg a következő paranccsal: `npm run build:mcp-server`. Ehhez Node.js 22 vagy újabb verzió szükséges. Az eredmény egyetlen fájl: `server.mjs`.

1. Válasszon egy munkamappát, ahol az ütemezési fájljai vannak. A kiszolgáló csak ebben a mappában olvas és ír.
2. Csatlakoztassa az MCP-klienst. Claude Code esetén a parancs a lista után, lentebb található.
3. Kérje meg az MCP-klienst, hogy nyisson meg egy ütemezést, például a `~/plan.ifc` fájlt. Ebben a kiszolgálóban a `~` a munkamappát jelenti.
4. Kérje meg az MCP-klienst, hogy mentse az eredményt. Nincs automatikus mentés: az MCP-kliens a `planner_export_ifc` eszközzel írja ki a fájlt. Ami nincs elmentve, az a kiszolgáló leállásakor elvész.

A 2. lépéshez, Claude Code esetén, adja meg ezt a parancsot egy terminálban a saját útvonalaival:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Dokumentumonként az első módosítás előtt a kiszolgáló az alkalmazáshoz hasonlóan MCP-biztonsági másolatot készít. Az MCP-kliens, amely a munkamappán kívüli útvonalat választ, akár parancsikonon (szimbolikus hivatkozáson) keresztül is, elutasítást kap. Amíg az alkalmazás nyitva van, a kiszolgáló nem írja felül a meglévő fájlt.

## Lásd még

- [Visszajelzés adása](docs://howto-feedback-geven): ha a kapcsolat másként működik, mint itt le van írva, jelezze.
- [MCP-eszközök](docs://ref-ai-tools): az összes `planner_*` eszköz csoportonként, a hibakódok, és az, hogy meddig őrződnek meg a biztonsági másolatok.
- [Alkalmazásbeállítások](docs://ref-instellingen): az MCP-beállítások.
