# Bemutatás nagy képernyőn

Cél: a Gantt-diagram megjelenítése teljes képernyőn, menüszalag és panelek nélkül, például vetítőn vagy tévén a helyszíni megbeszélésen.

## Mikor van erre szükség

Tíz ember néz egy képernyőt a helyszíni irodában. A menüszalag, az állapotsor és a tulajdonságok panel ekkor helyet foglal el, amelyre az ütemezésnek szüksége van, és zavaróak. A **bemutató módban** az alkalmazás csak a tevékenységtáblázatot és a Gantt-diagramot tartja meg, a teljes képernyőn.

## Lépések

### A nézet előkészítése

A bemutató módban nincs menüszalag, ezért állítsa be előre, amit meg szeretne mutatni.

1. Nyomja meg az **ütemezés-számítást** (F5), hogy a megjelenített dátumok helyesek legyenek.
2. Állítsa be a megjeleníteni kívánt nézetet, például olyan elrendezést, amely csak a kritikus tevékenységeket mutatja (lásd: [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken)).
3. Válasszon olyan időskálát és nagyítást, amelynél a tevékenységnevek távolról is olvashatók, és csukja össze vagy bontsa ki a fázisokat a *Nézet* lap *Vázlat* csoportjának *Összecsukás* és *Kibontás* gombjával.
4. Ha használni szeretné őket, kapcsolja be az *Osztott nézet* és a *Mini-térkép* lehetőséget (lásd: [Az osztott nézet és a mini-térkép használata](docs://howto-split-view-en-mini-map)).

### A bemutató indítása

Válassza a *Nézet › Bemutató › Bemutató* lehetőséget, vagy nyomja meg az F11 billentyűt. A menüszalag, a lapok, az állapotsor és a jobb oldali panel eltűnik. Látja a tevékenységtáblázatot, a Gantt-diagramot és – ha bekapcsolta őket – a hisztogramot és a mini-térképet. Néhány másodpercig alul ez látható: *Nyomja meg az Esc vagy az F11 billentyűt a teljes képernyőből való kilépéshez.*

A bemutatót bármelyik lapról indíthatja, a *Táblázat* vagy a *Jelentés* lapról is. Mindig a megnyitott projekt Gantt-diagramját látja, és a leállításkor a lapra kerül vissza, ahonnan elindította.

### A bemutató leállítása

Nyomja meg az Esc vagy az F11 billentyűt. A menüszalag és a panelek visszatérnek arra a lapra, ahonnan elindította.

## Buktatók és az alkalmazás viselkedése

**A bemutató módban is szerkeszthet.** A kattintás, a húzás, a cellák szerkesztése és a Delete billentyű továbbra is működik. Ha véletlenül húz egy sávot, az áthelyeződik, és az ütemezés már nem naprakész. Egy véletlenül törölt tevékenységet a Ctrl+Z billentyűkombinációval hozhat vissza, a bemutató módban is. Ezért óvatosan kattintson, ha csoporttal dolgozik.

**Az értesítések láthatók maradnak.** Az alkalmazás üzenete, például mentési hiba, a bemutató módban is megjelenik. Egyébként nincs menüszalag vagy állapotsor, ezért egy ilyen üzenet az egyetlen jel, hogy valami nincs rendben.

**Állítsa be előre az osztott nézetet, a mini-térképet és az elrendezéseket.** Ehhez a menüszalag kell, de ez a mód nem jeleníti meg. A nagyítás működik: az egérgörgővel vagy a Ctrl+= és a Ctrl+- billentyűkkel. A + és a - billentyű is működik, de csak akkor, ha a fókusz a Gantt-diagramon van. F11 után a fókusz gyakran a tevékenységtáblázatban van, ezért először kattintson a Gantt-diagramba.

**A teljes képernyő nem működik.** A menüszalag elrejtése mellett az alkalmazás valóban teljes képernyőt is kér. Ha a böngésző vagy az ablak ezt elutasítja, csak a menüszalag és a panelek tűnnek el. A bemutató ettől még működik. Ha az Esc vagy az F11 billentyűtől eltérő módon lép ki a teljes képernyőből, például az operációs rendszer egyik billentyűjével, a bemutató mód is leáll.

**Az alkalmazás nem jegyzi meg a bemutató módot.** Bezárás és újbóli megnyitás után a bemutató mód ki van kapcsolva.

## Lásd még

- [Az osztott nézet és a mini-térkép használata](docs://howto-split-view-en-mini-map): két időablak vagy átfogó áttekintő csík a bemutató alatt.
- [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken): a megjeleníteni kívánt nézet beállítása egyetlen kattintással.
- [Billentyűparancsok](docs://ref-sneltoetsen): az F11 és a többi billentyű.
