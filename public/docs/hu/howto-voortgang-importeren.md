# Előrehaladás importálása táblázatból

Cél: egy lépésben átvinni az ütemezésbe a helyszíni munkatársak által táblázatban kitöltött előrehaladást. Így nem kell minden tevékenységet külön megnyitnia.

## Mikor van erre szükség

Egy alvállalkozó vagy helyszíni vezető nem használja az alkalmazást. Mégis minden héten jelenti az előrehaladását: hány százalékos az elkészültsége, mikor kezdte, és mikor fejezte be. Ön küld neki egy táblázatot a tevékenységeivel. Ő három oszlopot tölt ki, és visszaküldi. Ebből az alkalmazás tevékenységenként csak három értéket olvas be: az elkészültséget, a tényleges kezdést és a tényleges befejezést. Az ütemezés többi része érintetlen marad. Hogy az alkalmazás mit kezd ezzel az előrehaladással, azt itt olvashatja el: [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang).

## Lépések

### 1. Állapotdátum beállítása és ütemezés-számítás

Az állapotdátumot a következő leírás szerint állítsa be: [Az előrehaladás frissítése](docs://howto-voortgang-bijwerken). A helyszíni vezető a tényleges dátumokat az adott napig bezárólag tölti ki. Ha az ütemezés nincs naprakészen, az alkalmazás újraszámítja, mielőtt a táblázat elkészül.

### 2. Táblázat készítése

Válassza az *Ütemezés › Előrehaladás › Előrehaladási táblázat exportálása* lehetőséget. Ugyanez a gomb a *Táblázat* és a *Jelentés* lapon is megtalálható. Az alkalmazás Excel-fájlt készít, és a *(projektnév)-előrehaladás.xlsx* nevet javasolja. Böngészőben a fájl a letöltési mappába kerül. Inkább CSV-t szeretne? Válassza a *Fájl › Exportálás › Előrehaladási lap (CSV)* lehetőséget. Az Excel-táblázat is megtalálható, *Előrehaladási lap (Excel)* néven.

A táblázatnak nyolc oszlopa van. Az oszlopnevek angolul maradnak, utánuk az alkalmazás nyelvén írt rövid utasítás áll:

- `OPS Task ID`, `WBS` és `Name` csak azért vannak ott, hogy felismerje a tevékenységet. Ezeket hagyja érintetlenül.
- A `Start` és a `Finish` a tervezett dátumok, tájékoztatásul. Az alkalmazás ezeket soha nem írja vissza.
- A `Completion (%)`, az `Actual Start` és az `Actual Finish` azok, amelyeket ki kell tölteni.

Az Excel-táblázat védett, jelszó nélkül: csak a három kitöltendő oszlop szerkeszthető. Az Excel ellenőrzi, hogy a százalék 0 és 100 közötti legyen, a tényleges dátum pedig dátum legyen. Egy fázis (összefoglaló tevékenység) szürke színnel van jelölve, és ez a felirat látható rajta: *— összefoglaló tevékenység: ne töltse ki*.

### 3. Kitöltés

A helyszíni vezető minden tevékenységnél a következőket tölti ki:

- `Completion (%)`: 0-tól 100-ig, mindkét határt beleértve. Az Excel-táblázatban tizedes értékek is megengedettek (például 33,3). A CSV-ben az utasítás egész számokat kér.
- `Actual Start` és `Actual Finish`: Excelben dátumként, az Ön területi beállításának megfelelően; a CSV-ben nn-hh-éééé formában.

Ami üres marad, azon nem változtat az alkalmazás. Egy üres cella tehát a meglévő előrehaladást sem törli. Ezt csak az alkalmazásban lehet megtenni. Egy még nem kezdett tevékenységnél a cellákat teljesen üresen kell hagyni.

### 4. A táblázat beolvasása

1. Válassza az *Ütemezés › Előrehaladás › Előrehaladás frissítése táblázatból* lehetőséget (a *Táblázat* és a *Jelentés* lapon is), vagy a *Fájl › Importálás › Előrehaladás frissítése táblázatból* lehetőséget. Megnyílik az *Előrehaladás frissítése táblázatból* ablak.
2. Kattintson a *Fájl kiválasztása…* gombra, és válassza ki a kitöltött `.xlsx` vagy `.csv` fájlt.
3. Ha a CSV-dátumok kétértelműek, az alkalmazás megkérdezi: *Először a nap vagy a hónap?* A fájl dátumát két módon mutatja meg. Kattintson a helyes dátumra.
4. Most megjelenik az előnézet. Felül négy számláló áll: *Alkalmazva*, *Változatlan*, *Összekapcsolásra vár* és *Elutasítva*. Alatta tevékenységenként látja, mi változik, például: *Elkészültség: 0% → 100%*.
5. Ellenőrizze az előnézetet, és kattintson az *Alkalmazás* gombra. Az ablakban megjelenik az *Eredmény*, a számlálókkal és azokkal a sorokkal, amelyeket az alkalmazás elutasított, és az indokkal. Fejezze be a *Bezárás* gombbal.

Az előnézetet nem lehet kihagyni. Az *Alkalmazás* gomb addig le van tiltva, amíg nincs mit alkalmazni.

### 5. Ütemezés újraszámítása

A beolvasás nem számítja újra magától az ütemezést. Nyomja meg az **Ütemezés-számítás** (F5) parancsot, például az *Ütemezés › Ütemezés › Számítás* menüponton keresztül, kivéve ha az *Automatikus ütemezés-számítás* be van kapcsolva.

## Sorok, amelyek nem illeszkednek egyszerűen

Az alkalmazás minden sort összekapcsolja egy tevékenységgel: először az `OPS Task ID` alapján, egyébként a WBS-szám alapján.

**Az összekapcsolás kétséges.** Ha az alkalmazás a tevékenységet csak WBS-szám alapján találta meg, a sor az *Az összekapcsolás kétséges* listában jelenik meg, a *Megerősítés* és a *Módosítás* gombokkal. Ha nem tesz semmit, az alkalmazás akkor is átvezeti a sort. Ezért ellenőrizze, hogy a tevékenység a helyes-e. A *Megerősítés* kiveszi a sort ebből a listából; az alkalmazott értékeken nem változtat. A *Módosítás* lehetővé teszi, hogy másik tevékenységet válasszon. Az *Összekapcsolás törlése* gombbal eltávolíthat egy saját maga készítette összekapcsolást. Megjegyzés: egy másik projekt táblázata, amelyben ugyanazok a WBS-számok szerepelnek, mégis összekapcsolódik. Ez az *Az összekapcsolás kétséges* listában jelenik meg, és az *Alkalmazás* gombra kattintva az alkalmazás átvezeti.

**Összekapcsolásra vár.** Ha az alkalmazás nem talált tevékenységet, vagy több olyat talált ugyanazzal a WBS-számmal, a sor az *Összekapcsolásra vár* listában jelenik meg. A *Válasszon tevékenységet…* mezőben válassza ki a megfelelő tevékenységet. Keressen WBS-szám vagy név alapján. Ha nem kapcsolja össze, az alkalmazás elutasítja a sort.

## Buktatók és az alkalmazás válasza

A sort, amely nem illeszkedik, indokkal együtt elutasítja az alkalmazás. A táblázat többi része ezután is feldolgozódik. Ezek a fő üzenetek:

- *A tényleges dátum későbbi, mint az állapotdátum.* Állítsa későbbre az állapotdátumot, vagy javítsa a táblázatot.
- *Ez a tevékenység a terv szerint az állapotdátum után kezdődik. Előbb töltse ki a táblázatban a tényleges kezdést.* Az alkalmazás nem talál ki kezdési dátumot. Adja meg a táblázatban.
- *A százalék nincs 0–100 között. Ellenőrizze a tizedesjelet: a 8,38 más nyelvi beállítású táblázatkezelőben 838-nak olvasható.*
- *Az összefoglaló tevékenységek nem kaphatnak előrehaladást táblázatból.* Egy fázis előrehaladása a benne lévő tevékenységekből adódik.
- *A tényleges befejezés a tényleges kezdés előtt van.*
- *Olvashatatlan dátum.* és *Olvashatatlan százalék.*
- *A megadott értékek ellentmondanak egymásnak.* Például egy tényleges befejezés 100-nál kisebb százalékkal.
- *Ehhez a sorhoz nem található tevékenység.* A táblázat olyan tevékenység-azonosítóra és WBS-számra hivatkozik, amely ebben a projektben nem szerepel.
- *Ez a WBS-kód több tevékenységnél szerepel. Kézzel kapcsolja össze a sort.*
- *Egy másik sor már hozzárendelte ezt a tevékenységet.* Két sor mutat ugyanarra a tevékenységre.
- *Az ütemező elutasította.* Az ütemezés egy másik elutasítása, saját üzenet nélkül.

Ha a teljes fájlt elutasítja az alkalmazás, az ablakban ezek egyike jelenik meg: *Ez a fájl nem tartalmaz „OPS Task ID” vagy „WBS” oszlopot, amellyel a sorokat tevékenységekhez lehetne összekapcsolni.*, *Ez a fájl nem tartalmazza az Elkészültség, a Tényleges kezdés vagy a Tényleges befejezés oszlopok egyikét sem.*, *Ez a fájl túl nagy ahhoz, hogy előrehaladási táblázatként be lehessen olvasni.* (16 MB-nál nagyobb), *Ez a fájl túl sok sort tartalmaz ahhoz, hogy előrehaladási táblázatként be lehessen olvasni.* (50 000 sornál több), vagy *Ez a fájl jelszóval védett, ezért nem olvasható be.* vagy *Ez a fájl nem olvasható be előrehaladási táblázatként.*

**Nincs állapotdátum.** Ha még nincs állapotdátum, és az importálás előrehaladást alkalmaz, az alkalmazás a mai napra állítja, és erről értesíti Önt. Állítsa be tehát előbb maga.

**Egy lépésben visszavonható.** Az egész táblázat egy lépésnek számít a Ctrl+Z parancsnál.

**Csak a kitöltött értékek számítanak.** Az a sor, amelyben nincs eltérés az ütemezéstől, *Változatlan* lesz. Az a tevékenység, amelynek nincs sora a táblázatban, változatlan marad, ahogy volt.

## Lásd még

- [Előrehaladás, állapotdátum és alapterv](docs://uitleg-voortgang): mit számít az alkalmazás a tényleges dátumokkal és százalékokkal.
- [Az előrehaladás frissítése](docs://howto-voortgang-bijwerken): az előrehaladás bevitele magában az alkalmazásban.
