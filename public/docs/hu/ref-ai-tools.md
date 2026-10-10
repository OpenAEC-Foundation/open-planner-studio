# AI-eszközök (planner_*)

Az összes eszköz, amelyet egy AI-segítőtárs a hídon keresztül meghívhat, csoportonként, azzal, hogy mit tesznek és mit utasítanak el. Mindegyik `planner_`-rel kezdődik. A *Kapcsolat adatai* ablak csatlakozási szövege megadja a jelenlegi portszámot, a segítőtárs pedig a teljes listát a leírásokkal együtt a hídtól kapja (`tools/list`). Azt, hogy a kapcsolat miért így működik, a [Az AI-kapcsolat működése](docs://uitleg-ai-koppeling) ismerteti. Azt, hogyan kapcsolja be, a [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen) ismerteti.

## Hogyan olvassa ezt a listát

**Olvasás** azt jelenti: az eszköz nem változtat semmit. Ez a *Szüneteltetés* és a *Csak olvasható* módban is működik. Egy nyitott párbeszédablak viszont blokkolja (lásd lent: *Ha egy eszközt elutasítanak*). Egy olvasó eszköz mindig aktuális dátumokat ad. Ha az ütemezés nem naprakész, az eszköz először újraszámítja, *Szüneteltetés* és *Csak olvasható* módban is. Ezek a módok a változtatásokat tartják vissza, az olvasáskori újraszámítást nem. Ha éppen szerkeszt (sávot húz, mezőbe ír), az eszköz nem számít újra. A segítőtárs akkor a szerkesztése előtti dátumokat kapja, azzal a figyelmeztetéssel, hogy azok nem naprakészek. Ha a projekt a *Rögzített dátumok* nézetben van, az eszköz nem számít újra. A segítőtárs akkor a rögzített dátumokat kapja, azzal a figyelmeztetéssel, hogy azokat nem számolták újra.

**Változtatás** azt jelenti: az eszköz módosítja a projektet. Ez *Szüneteltetés* és *Csak olvasható* módban, valamint nyitott párbeszédablak esetén tiltott. Ez vonatkozik a címke nélküli eszközökre is (`planner_undo`, `planner_redo`, a fájleszközök és a dokumentumeszközök, kivéve `planner_list_documents`). Minden változtatás egy lépés a visszavonási előzményekben. Ha a projektadatok változnak, az alkalmazás utána magától újraszámítja az ütemezést. Nem kell megnyomnia a *Számítás* gombot. Az első változtatás előtt dokumentumonként biztonsági mentést ír, ha az *Automatikus biztonsági mentés* be van kapcsolva.

**Tömeges** azt jelenti: egy hívás több elemet tartalmazhat. Egy érvénytelen elemet indokkal elutasítanak, a többi érvényes elem megmarad. A válasz megnevezi az elutasított elemeket.

## Olvasás: ütemezés

- `planner_get_project_info` (olvasás) — a projekt adatai és főbb számadatok: a tevékenységek, kapcsolatok, erőforrások és mérföldkövek száma, az állapotdátum, a projekt befejezése és időtartama, az, hogy az ütemezés nem naprakész-e, a számítási profil és a naptárak összefoglalása. Jó első hívás.
- `planner_get_project_overview` (olvasás) — az egész WBS-fa egy válaszban: tevékenységazonosítónként a WBS, a név, az időtartam, a korai dátumok, az előrehaladás, a kritikus jelleg, és a kimenő kapcsolatok a kapcsolatazonosítójukkal.
- `planner_list_tasks` (olvasás) — tevékenységek szűrőkkel (kritikus, előrehaladás, dátumablak, kapcsolat nélküli tevékenységek) és lapozással.
- `planner_get_task` (olvasás) — egy tevékenység részletesen: dátumok, tartalékidő, előrehaladás, korlátozások, határidő, naptár, hozzárendelések, elődök és utódok, szünetek.
- `planner_get_critical_path` (olvasás) — a kritikus tevékenységek a teljes tartalékidejükkel, és azok a kapcsolatok, amelyek meghatározzák a kritikus utat.
- `planner_list_resources` (olvasás) — erőforrások kapacitással, alapdíjjal, naptárral, munkacsapattal, elérhetőséggel és a hozzárendelések összefoglalásával. Ha egy erőforrás az erőforrástárból származik, megmutatja, mely mezők rögzítettek.
- `planner_get_resource_histogram` (olvasás) — az erőforrás-terhelés a kapacitáshoz képest, erőforrásonként, naponként, hetente vagy havonta (alapértelmezés szerint hetente). Ablak és erőforrás nélkül erőforrásonkénti összefoglalót ad. Ablakkal vagy erőforrásokkal a teljes sorozatot adja, és a túlterhelést okozó tevékenységeket.
- `planner_get_calendars` (olvasás) — az összes naptár a teljes definíciójával, és azzal, hogy hány tevékenység és erőforrás használja.

## Olvasás: alaptervek és eltérés

- `planner_list_baselines` (olvasás) — a mentett alaptervek, és hogy melyik az aktív.
- `planner_compare_baseline` (olvasás) — a jelenlegi terv összevetése az aktív alaptervvel: csak az eltérő tevékenységek, és a különbség a projektbefejezésben, munkanapokban, az aktuális projektnaptár szerint. Aktív alapterv nélkül elutasítja.
- `planner_analyze_delay` (olvasás) — késésanalízis az aktív alaptervhez képest: a projektbefejezés eltérése és a kritikus tevékenységek, amelyek elmozdultak. Aktív alapterv nélkül elutasítja.

## Tevékenységek és szerkezet

- `planner_add_tasks` (változtatás, tömeges) — tevékenységek létrehozása, egymásba ágyazott WBS-sel egy hívásban is. Minden tevékenység a saját ideiglenes nevet kapja (`tmp-…`), így egy alárendelt tevékenység hivatkozhat a szülőjére. Időtartam nélkül egy tevékenység 5 munkanapot kap. Egy mérföldkő időtartama 0. Egy hívás összes tevékenysége együtt sikerül, vagy együtt bukik meg.
- `planner_update_tasks` (változtatás, tömeges) — meglévő tevékenységek mezőinek módosítása: név, leírás, időtartam egységgel (nap vagy óra), időtartam típusa, tevékenységtípus, mérföldkő, kötelező, prioritás, korlátozás, határidő, naptár és munkaszabály. Ide tartoznak az előrehaladás mezői is: készültségi szint, tényleges kezdés és tényleges befejezés. Minden más kulcsot indokkal elutasít.
- `planner_delete_tasks` (változtatás) — tevékenységek törlése a teljes alárendelt águkkal, kapcsolataikkal és hozzárendeléseikkel együtt. A válasz pontosan megnevezi, mi ment velük.
- `planner_move_task` (változtatás) — egy tevékenység áthelyezése másik szülő alá, megadott pozícióval. Ciklust létrehozó áthelyezést, vagy a tevékenység saját alá helyezését elutasítja.
- `planner_set_task_splits` (változtatás) — egy tevékenység szüneteinek beállítása: hány munkanap (vagy munkaóra) munka után, és hány munkanap (vagy munkaóra) szünet következik. Üres lista minden szünetet eltávolít. Lásd [Egy tevékenység felosztása](docs://howto-taak-splitsen).

## Kapcsolatok

- `planner_add_dependencies` (változtatás, tömeges) — kapcsolatok létrehozása típussal (`FS`, `SS`, `FF`, `SF` vagy a hosszú alak) és késleltetéssel, például `+2d`.
- `planner_update_dependencies` (változtatás, tömeges) — egy meglévő kapcsolat típusának, késleltetésének, elődjének vagy utódjának módosítása a kapcsolatazonosító alapján. Ez egy lépés, nem kell törölni és újra létrehozni.
- `planner_remove_dependencies` (változtatás, tömeges) — kapcsolatok törlése kapcsolatazonosító alapján.

## Projekt és naptárak

- `planner_update_project` (változtatás) — név, leírás, szerző, cég, projektkezdés, befejezési dátum, állapotdátum, előrehaladási mód, és a munkaszabály projektszintű alapértelmezése. A projektkezdés az új tevékenységek horgonya. Ha a segítőtárs később állítja be, csak a laza tevékenységek mozdulnak el (elődje nélkül, és olyan korlátozás nélkül, amely alsó határt szab, például *nem korábban kezdődő*). A válasz az `anchorsClamped` mezőben megadja, hányat. A többi ütemezés helyben marad, lásd [Új projekt és Projektinfó](docs://ref-projectinfo). Az állapotdátum nem címke, hanem a számítás hivatkozási dátuma: előrehaladás nélküli ütemezésen minden együtt mozdul. A befejezési dátum csak metaadat.
- `planner_move_project` (változtatás) — az egész meglévő ütemezés áthelyezése új projektkezdésre. A naptárak nem mozdulnak el, ezért a befejezés más számú nappal ugorhat, mint a kezdés. Az alaptervek megmaradnak, kivéve ha a segítőtárs kifejezetten kéri, hogy azok is mozduljanak. Lásd [Projekt áthelyezése](docs://howto-project-verplaatsen).
- `planner_update_calendar` (változtatás, tömeges) — naptárak módosítása vagy létrehozása: munkanapok, munkaórák, szünet, idősávok, ünnepnapok (generálás egy ország és régió szerint, vagy kézzel megadva) és munkanapi kivételek. Nem tudja megváltoztatni, melyik naptár a projektnaptár.

## Erőforrások és egységek

- `planner_manage_resources` (változtatás, tömeges) — erőforrások létrehozása, módosítása vagy törlése: név, típus (munkaerő, gép, anyag, alvállalkozó vagy munkacsapat), leírás, maximális mennyiség, óránkénti alapdíj, egység, naptár, munkacsapat és elérhetőség az időben. Olyan erőforrást, amelynek vannak hozzárendelései, nem töröl, amíg a segítőtárs ezt kifejezetten meg nem erősíti. Erőforrástárból származó erőforrásnál a név, a típus, a leírás, az óránkénti alapdíj és az egység rögzített.
- `planner_manage_assignments` (változtatás, tömeges) — hozzárendelések hozzáadása, módosítása, áthelyezése vagy eltávolítása: munkanaponkénti hozzárendelt mennyiség, görbe és hátralévő munka. Csak levéltevékenységen, és ugyanaz az erőforrás tevékenységenként csak egyszer. Hogy a hozzárendelt mennyiség változása mit okoz az időtartamban, az a tevékenység munkaszabályától függ, lásd [Munkaszabályok: időtartam, egységek és munka](docs://uitleg-werkregels).
- `planner_level_resources` (változtatás) — a túlterhelés kiegyenlítése. Alapértelmezés szerint a tartalékidőn belül, így a befejezési dátum marad. A `constrainToFloat: false` beállítással a befejezés elmozdulhat. Száraz futtatással a segítőtárs először előnézetet kap, és semmi nem változik. Az anyagot kihagyja. Lásd [Erőforrás-kiegyenlítés](docs://uitleg-nivelleren).
- `planner_clear_leveling` (változtatás) — az összes kiegyenlítési késleltetést törli.

## Alaptervek kezelése

- `planner_save_baseline` (változtatás) — az aktuális ütemezés mentése alapterv gyanánt, és azonnali aktívvá tétele. Előbb újraszámítja a nem naprakész dátumokat. Szkriptben nem használható.
- `planner_activate_baseline` (változtatás) — egy alapterv aktívvá tétele, vagy egyik sem aktív.
- `planner_rename_baseline` (változtatás) — alapterv átnevezése.
- `planner_delete_baseline` (változtatás) — egy alapterv törlése. Ha az volt az aktív, a megmaradt utolsó alapterv lesz aktív, vagy egyik sem, ha nem maradt más.

## Visszavonás

- `planner_undo` és `planner_redo` — egy lépés visszavonása vagy újra végrehajtása az aktív dokumentumban. Az előzmény megegyezik az Ön előzményével. A válasz megmondja, valójában vontak-e vissza bármit.

## Dokumentumok és fájlok

- `planner_list_documents` (olvasás) — az összes megnyitott dokumentum címmel, azzal, hogy aktív-e és módosított-e, a tevékenységek számával, a projektkezdéssel és a kiszámított befejezéssel.
- `planner_new_document` — egy új, üres dokumentum a saját lapján, az *Új projekt* ablak nélkül.
- `planner_duplicate_document` — az aktív dokumentum másolása új lapra, például egy „mi lenne, ha” vagy egy ajánlati változathoz. A másolat független, és nincs fájlútvonala.
- `planner_switch_document` — másik dokumentum aktívvá tétele. Ezzel is megerősíthető, melyik dokumentumon dolgozik a segítőtárs, miután lapot váltott.
- `planner_import_schedule` — ütemezési fájl megnyitása lemezről dokumentumként: `.ifc`, `.xml` (Primavera P6 vagy MS Project, a tartalma alapján felismerve), `.csv`, `.xer` és `.mpp` (MS Project 2010-től 2021-ig). Semmi nem olvad össze a jelenlegi tervvel. A CSV-nek nincs naptára, ezért a dátumok eltolódhatnak. Csak a felhasználói mappán belül. CSV, XML vagy `.mpp` importálás után a dokumentumnak nincs mentési célja. Csak egy IFC veszi át az útvonalát.
- `planner_export_ifc` — az aktív dokumentum írása IFC 4.3 fájlként. Csak a felhasználói mappán belül, és a meglévő fájlt csak kifejezett kérésre írja felül. A projekt mentetlen marad.

## Útmutató és forrás

- `planner_get_planning_guide` (olvasás) — az angol útmutató a segítőtársaknak (a [Jól tervezni](docs://gids-goed-plannen) elvei, az egyes elvekhez tartozó eszközökkel), a két készség, *goed-plannen* (ütemezés felállítása) és *progress-update* (előrehaladás frissítése), vagy mindkettő. A `part` paraméterrel választhat: `guide`, `skill` (mindkét készség) vagy `both`. Alapértelmezés szerint `both`. Minden készséghez visszaadja, hol tartozik, és a letöltési címeket. A `language` paramétert a régebbi segítőtársak miatt még elfogadja, de a szöveg mindig angol. Nem nyúl az ütemezéshez.
- `planner_inspect_xer_provenance` (olvasás) — egy megnyitott Primavera P6 fájl (`.xer`) megőrzött forrásszemantikájának vizsgálata: mit tartalmazott a fájl, az importálás és a diagnosztika számlálóival. A fájl szabad szövegmezői alapértelmezés szerint láthatatlanok maradnak. A segítőtársnak kifejezetten kell kérnie őket. Szkriptben nem használható.

## A szkript

- `planner_batch` — egy legfeljebb 100 lépésből álló szkript futtatása egy változtatásként: egy visszavonási lépés, egy újraszámítás, egy biztonsági mentés. Ha egy lépés szerkezetileg hibás, az alkalmazás a teljes szkriptet visszaállítja, és a válasz lépésenként megmondja, mi valósult meg, mi hibázott, és mi nem jutott el odáig. Az ideiglenes nevek (`tmp-…`) a `planner_add_tasks` eszköztől a későbbi lépésekben is érvényesek. Lépésként nem engedélyezett: maga a `planner_batch`, a visszavonás és az újra végrehajtás, a dokumentum- és fájleszközök, a `planner_save_baseline`, a `planner_get_planning_guide` és a `planner_inspect_xer_provenance`. A szkript nem programozási nyelv: nincsenek benne változók, feltételek vagy ciklusok.

## Ha egy eszközt elutasítanak

Ilyenkor a segítőtárs hibakódot és magyarázatot kap.

- `PAUSED` — a *Szüneteltetés* be van kapcsolva.
- `READ_ONLY` — a *Csak olvasható* be van kapcsolva.
- `DIALOG_OPEN` — egy párbeszédablak nyitva van. Ez az olvasásra is vonatkozik, a `planner_get_planning_guide` kivételével. A válasz a belső nevén nevezi meg, mi van nyitva, például `showTaskDialog`.
- `DOC_DRIFT` — lapot váltott, miközben a segítőtárs dolgozott. A segítőtársnak a `planner_switch_document` eszközzel kell megerősítenie, melyik dokumentumon dolgozik.
- `VALIDATION` — az argumentumok nem felelnek meg a sémának, vagy a kért változtatás nem engedélyezett. A válasz megnevezi a mezőt.
- `NOT_FOUND` — egy azonosító vagy dokumentum nem létezik.
- `CYCLE` — a változtatás ciklust hozna létre. Az adott hívás minden változtatását visszaállítják.
- `SCOPE` — a fájl útvonala a felhasználói mappán kívül esik.
- `BACKUP_FAILED` — a változtatás előtti biztonsági mentés nem sikerült. A változtatás nem valósult meg.
- `INTERNAL` — váratlan hiba egy eszköz futtatásakor, például egy sikertelen fájlművelet. A válasz megadja az eredeti hibaüzenetet.
- `STALE_PRECONDITION` — a híd szerződésének része, de a jelenlegi eszközök közül egy sem adja vissza.

Az alkalmazás nem hajtja végre a kérést, ha az 110 másodpercnél tovább várakozott a sorban. Az ügyfél ekkor már időtúllépést kapott, és az újrapróbálkozáskor a végrehajtás kétszer változtatna. Egy hívás, amely 120 másodpercnél tovább tart, a hídtól időtúllépést kap.

## Amit a segítőtárs nem állíthat be

Tevékenységenként a segítőtárs nem állíthat be: hangmatot, kézzel ütemezett állapotot, második korlátozást, megjegyzéseket, színt, tevékenységkódokat, egyéni mezőket, projektközi kapcsolatokat és kézzel kiegyenlítési késleltetést. A WBS-kódot az alkalmazás maga számolja ki. Projektszinten nem módosíthatja a számítási profilt és a számítási beállításokat. A beállítások, a téma, a nyelv, a bővítmények és a frissítések nem érhetők el, és az erőforrástár sem. A segítőtárs jelentésekhez, elrendezésekhez, szűrőkhöz és nézethez sem fér hozzá. Hogy miért, azt a [Az AI-kapcsolat működése](docs://uitleg-ai-koppeling) ismerteti.

## Amit az alkalmazás tárol

- **A token** ezen a számítógépen van, az alkalmazás mentett beállításaiban. 64 karakter hosszú, és véletlenszerű. Az *Új token* lecseréli.
- **A port** alapértelmezés szerint 3877. Csak akkor módosítható, ha a híd le van állítva.
- **Az aktivitáspanel** az utolsó 500 hívást tartja meg, csak amíg az alkalmazás nyitva van. Az argumentumokat és a válaszokat mezőnként 20 kB után csonkolja. A *Törlés* kiüríti a listát.
- **A biztonsági mentések** az `ai-backups` mappában vannak, az alkalmazás adatmappájában. A *Biztonsági mentési mappa megnyitása* gomb oda visz. Nevük `<project name>-<timestamp>.ifc`. Egy mentett projektfájlnak egy mappa van, amely minden munkamenetben közös. Egy soha nem mentett dokumentum minden munkamenetben saját mappát kap. A híd minden indításakor dokumentumonként egy biztonsági mentés készül, plusz azok, amelyeket Ön készít a *Biztonsági mentés most* gombbal.
- **A ritkítás** magától történik, mappánként. Az elmúlt 7 napból mind megmarad, legfeljebb 20 darab. Amit a futó munkamenet készített, az mindig megmarad. Ezután hetente egy marad, legfeljebb 30 napos korig, havonta egy legfeljebb egy éves korig, azután évente egy. Egy soha nem mentett dokumentum biztonsági mentései egy év után teljesen eltűnnek. A mappában lévő, az alkalmazáshoz nem tartozó fájlokhoz nem nyúl.

## Lásd még

- [Az AI-kapcsolat működése](docs://uitleg-ai-koppeling): miért így van felépítve a híd, és mit szabad és mit nem szabad a segítőtársnak.
- [AI-segítőtárs csatlakoztatása (MCP)](docs://howto-ai-assistent-koppelen): a híd indítása, csatlakozás, a készség telepítése.
- [Beállítások](docs://ref-instellingen): a két AI-kapcsoló.
- [Értesítések és figyelmeztetések](docs://ref-meldingen): az AI-pont az állapotsorban.
