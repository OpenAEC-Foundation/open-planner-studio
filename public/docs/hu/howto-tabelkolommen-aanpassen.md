# Táblázatoszlopok beállítása

Cél: kiválasztani, hogy mely oszlopok látszanak a tevékenységtáblázatban, milyen sorrendben, és milyen szélesek legyenek.

## Mikor van erre szükség

Az értekezleten minden tevékenység mellett látni szeretné a határidőt és a teljes tartalékidőt. Az építésvezető csak a kezdést és a befejezést szeretné a név mellett. Vagy egy oszlop olyan keskeny, hogy a fejléce le van vágva. A tevékenységtáblázat olyan oszlopokból áll, amelyeket Ön maga választ ki: tucatnyi oszlop van, a *Tevékenység neve* és az *Időtartam* oszloptól a *Határidő*, a *Szabad tartalékidő* és a *Hozzárendelt erőforrások* oszlopig.

Két tevékenységtáblázat van, és mindegyiknek saját oszlopai vannak:

- A **Gantt melletti tevékenységtáblázat** az idővonal bal oldalán látható többek között a *Kezdőlap*, az *Ütemezés* és a *Nézet* lapon. Alapértelmezés szerint a *WBS*, a *Tevékenység neve* és az *Időtartam* oszlop látszik, így az idővonalnak is marad hely.
- A **táblázat a Táblázat lapon** az egész munkaterületet kitölti. Alapértelmezés szerint a *WBS*, *Tevékenység neve*, *Időtartam*, *Kezdés*, *Befejezés*, *Tevékenységtípus*, *Kritikus*, *Teljes tartalékidő* és *Előrehaladás* oszlop van benne, plusz a projekt minden tevékenységkódjához és egyéni mezőjéhez egy-egy oszlop.

Az egyik táblázat módosítása nem változtatja meg a másikat.

## Lépések

### Oszlop hozzáadása

1. Kattintson a táblázat fejlécének jobb oldalán lévő pluszjelre (**+**). A *Táblázat* lapon a *Táblázat › Oszlopok › Oszlopok…* menüpontot is használhatja. Megnyílik az *Oszlop kiválasztása* ablak.
2. Keresse meg az oszlopot. Ha korábban már választott oszlopokat, felül a *Nemrég használt* látható. Írjon a *Keresés* mezőbe a névnek egy részét, például *határ* a *Határidő* oszlophoz, vagy nyisson meg egy kategóriát: *Tevékenység*, *Ütemezés*, *Korlátozások*, *Kapcsolatok*, *Erőforrások*, *Előrehaladás*, *Számított*, *Alapterv*, *Egyéni* vagy *Technikai*.
3. Kattintson az oszlopra. Az oszlop a táblázat végére kerül, és az ablak bezárul.

A táblázatban már meglévő oszlop szürke, és nem választható ki.

### Oszlop eltávolítása

Kattintson a mínuszjelre az oszlopfejlécben (*Eltávolítás: Határidő*). Vagy kattintson a fejlécre jobb gombbal, és válassza az *Eltávolítás: Határidő* lehetőséget. A Ctrl+Z billentyűkombinációval visszakapja az oszlopot, vagy a pluszjellel újra kiválasztja.

### Szélesség beállítása

Húzza az oszlopfejléc jobb szélét balra vagy jobbra. Kattintson duplán erre a szélre, vagy válassza az *Automatikus illesztés* lehetőséget a fejléc menüjében (jobb egérgomb), hogy az oszlop elég széles legyen a tartalmához, legfeljebb 480 képpont széles. Ha a szél fókuszban van, a nyílbillentyűk lépésenként szélesítik vagy keskenyítik.

### Oszlopok rögzítése

Kattintson jobb gombbal a fejlécre, és válassza a *Rögzítés* lehetőséget. A rögzített oszlopok az elejére kerülnek, és vízszintes görgetéskor a bal oldalon maradnak. Ez addig működik, amíg az együttes szélességük nem nagyobb az ablaknál. A *Rögzítés feloldása* visszateszi őket a sorba.

### Sorrend módosítása

Húzza az oszlopfejlécet egy másik helyre. Rögzített oszlopot a rögzítettek között mozgat, normál oszlopot a normál oszlopok között.

### Visszaállítás az alapértelmezésre

Nyissa meg az *Oszlop kiválasztása* ablakot, és kattintson alul az *Alapértelmezés visszaállítása* gombra. A gomb szürke, ha az oszlopok már alapértelmezettek. A *Táblázat* lapon lévő táblázatnál a projekt minden tevékenységkódjához és egyéni mezőjéhez is hozzáadódik egy-egy oszlop, akkor is, ha ezeket korábban eltávolította. Ezek az oszlopok ahhoz a projekthez tartoznak, amelyben a kód vagy a mező van. Ezekről a kódokról és mezőkről a [Kódok és egyéni mezők](docs://howto-codes-en-velden) cikkben olvashat.

## Buktatók és az alkalmazás viselkedése

**A fejléc le van vágva.** Egy keskeny oszlop levágja a nevét, például a *Teljes tartalékidő* helyett csak *Telj…* látszik. Kattintson duplán az oszlopfejléc szélére, hogy az oszlop beleférjen.

**Rossz táblázatot állít be.** A Gantt melletti tevékenységtáblázat és a *Táblázat* lap oszlopai külön vannak. Ha a *Nézet* vagy a *Kezdőlap* lapon dolgozik, a Gantt melletti táblázatot állítja be. A *Táblázat* lapon lévő plusz a nagy táblázatot módosítja.

**Egy elrendezés visszaállítja az oszlopokat.** Ha az elrendezésben be van jelölve az *Oszlopok* rész, az elrendezés gombra kattintva a Gantt melletti tevékenységtáblázat oszlopai visszakerülnek a mentett állapotba. A *Táblázat* lapon lévő táblázat érintetlen marad. Lásd: [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken).

**Az oszlopbeállítás az eszközén van, nem a projektben.** Az alkalmazás az oszlopválasztást minden projektjéhez megőrzi ezen az eszközön, és nem menti a projektfájlba. Ettől a projekt sem lesz „módosítva”. Minden oszlopmódosítást visszavonhatja a *Visszavonás* (Ctrl+Z) paranccsal; a lépések neve például *Határidő oszlop hozzáadása* és *Tevékenység neve oszlop szélességének módosítása*.

## Lásd még

- [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken): oszlopok gombhoz rendelése szűrővel vagy rendezéssel együtt.
- [Kódok és egyéni mezők](docs://howto-codes-en-velden): saját oszlopok létrehozása, amelyeket itt ki lehet választani.
- [Táblázatoszlopok](docs://ref-tabelkolommen): az összes oszlop és az, amit megjelenít.
