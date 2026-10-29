# Fájl megnyitása és mentése

Cél: projekt megnyitása fájlból, és a módosítások megőrzése.

## Mikor van erre szükség

Ön a tegnapi projekttel kezdi a napot, kap egy fájlt egy kollégától vagy egy másik csomagból, vagy egy köztes állapotot szeretne rögzíteni, mielőtt valami nagyot változtat. Az, hogy az alkalmazás mit tart meg egy fájlban, és miért csak az IFC őrzi meg a teljes projektet, a [Fájlok és formátumok](docs://uitleg-bestanden) részben van leírva.

## Lépések

### Fájl megnyitása

1. Válassza a *Kezdőlap › Fájl › Megnyitás* lehetőséget, vagy a *Fájl › Megnyitás* lehetőséget, vagy nyomja meg a Ctrl+O billentyűkombinációt (Mac-en ⌘+O). A *Fájl* csoport a *Táblázat* lapon is megtalálható.
2. Válassza ki a fájlt. Egyszerre egy fájlt nyithat meg. Az asztali alkalmazásban és a fájlhozzáférést támogató böngészőkben, például a Chrome-ban és az Edge-ben, az ablak fájltípusok listáját mutatja: *Minden támogatott*, *IFC-fájlok*, *CSV-fájlok*, *XML-fájlok*, *MS Project-fájlok* és *Primavera XER-fájlok*.
3. A projekt új lapon nyílik meg. Ha az aktuális lap még üres és nem módosult, a projekt abban a lapon nyílik meg.
4. Ha a fájl nem IFC volt, megjelenik egy ablak, amely röviden elmagyarázza ezt a formátumot. A zöld blokk azt mutatja, mit vett át az alkalmazás. A borostyánsárga blokk azt mutatja, ami kimaradt vagy csak részben került át. A kék blokk a mentés és a visszaírás működését mutatja. A *Bővebben* megnyitja a formátum útmutatóját. Az ablak bezárásához kattintson az *Értettem* gombra. Ha már nem szeretné látni ezt a magyarázatot az adott formátumhoz, előbb jelölje be a *Ne mutassa újra …* jelölőnégyzetet. Az [Alkalmazás beállításai](docs://ref-instellingen) részben, a *Speciális* lapon kapcsolhatja vissza.

Egy IFC-fájl a fájlnevét adja a lapnak. Másik formátumú projekt a projekt nevét kapja.

Az alkalmazás megnyitja a `.ifc`, `.csv`, `.xml` (MS Project XML vagy Primavera P6 XML), `.mpp` és `.xer` fájlokat. Az utolsó kettőhöz külön lépések tartoznak itt: [MS Project-fájl megnyitása (.mpp)](docs://howto-mpp-openen) és [Primavera P6-fájl megnyitása (.xer)](docs://howto-xer-openen).

### Legutóbbi projekt megnyitása

Válassza a *Kezdőlap › Fájl › Legutóbbi* lehetőséget, és kattintson a listában egy fájlra, vagy válassza a *Fájl › Legutóbbi* lehetőséget. A lista az utolsó tíz fájlt tartja meg, amelyeket megnyitott, mentett vagy exportált. Itt is, ha a fájl nem IFC, ezután megjelenik a formátumának magyarázata. Az asztali alkalmazás minden fájlhoz megjeleníti az elérési utat, a böngésző csak a nevet.

Ha az alkalmazás már nem tudja beolvasni a listában lévő fájlt, például mert áthelyezte, a fájl üzenet nélkül eltűnik a listából. A fájlhozzáférés nélküli böngészőkben, például a Firefoxban, a *Legutóbbi* üres marad.

### Példa megnyitása

Válassza a *Fájl › Példák* lehetőséget, és kattintson egy példaprojektre. A projekt egy lapon nyílik meg, fájl nélkül: ezért a *Mentés* megkérdezi, hova szeretné menteni.

### Mentés

Válassza a *Kezdőlap › Fájl › Mentés* lehetőséget vagy a *Fájl › Mentés* lehetőséget, vagy nyomja meg a Ctrl+S billentyűkombinációt. Mi történik ezután, az a projekttől függ:

1. Ha a projektnek már van fájlja, mert IFC-fájlt nyitott meg, vagy korábban mentette, az alkalmazás abba a fájlba ír. Nem jelenik meg ablak, kivéve az első mentésnél, ha a fájl az IFC 4.3 ADD2-től eltérő IFC-sémát használ. Ekkor az alkalmazás előbb megkérdezi: *Melyik IFC-sémában mentse?* Lásd: [IFC-séma kiválasztása](docs://howto-ifc-schema-kiezen).
2. Ha a projektnek még nincs fájlja, az alkalmazás megkérdezi, hova kerüljön. A projekt nevét javasolja `.ifc` kiterjesztéssel. Ezután ez a fájl lesz a projekt fájlja.
3. Ha a böngésző csak letöltéssel ment (például a Firefox), a fájl a letöltések mappájába kerül, és minden mentés új letöltést hoz létre. Egy munkamenetben először ez az üzenet jelenik meg: *Letöltésként mentve: „name.ifc” a letöltések mappájában van. Ez a böngésző nem engedi, hogy az alkalmazás saját helyre írjon, ezért minden mentés új letöltést hoz létre. Chrome-ban, Edge-ben vagy az asztali alkalmazásban a Mentés egyszerűen frissíti ugyanazt a fájlt.*
4. Ha a böngésző nem tud visszaírni a projekt fájljába, az alkalmazás minden mentéskor újra megkérdezi, hova tegye a fájlt. Ez a *Mentés másként* lehetőséghez hasonlít, de ez a böngésző korlátja. Egy munkamenetben először ez az üzenet magyarázza ezt, a [Fájlok](docs://uitleg-bestanden) oldalra mutató hivatkozással: *Ez a böngésző nem engedi, hogy az alkalmazás visszaírjon a „name.ifc” fájlba.*

Mentés után a *Nincs mentve* jelölés eltűnik: a pont a lapon, a csillag a projekt neve előtt a felső sorban, és a *Nincs mentve* szöveg az állapotsor jobb alsó sarkában.

### Mentés más néven

Válassza a *Kezdőlap › Fájl › Mentés másként* lehetőséget vagy a *Fájl › Mentés másként* lehetőséget, vagy nyomja meg a Ctrl+Shift+S billentyűkombinációt. Válasszon nevet és helyet (a Firefoxban az alkalmazás helyette új fájlt tölt le). Ezután a projekt ezzel az új fájllal dolgozik: a következő *Mentés* oda ír. A régi fájl ugyanolyan marad, mint az utolsó mentéskor volt.

### Projekt bezárása

Kattintson a lap bezáró keresztjére, vagy válassza a *Fájl › Projekt bezárása* lehetőséget. Ha a projektnek vannak nem mentett módosításai, az alkalmazás megkérdezi: *Nem mentett módosítások: „name” nem mentett módosításokat tartalmaz.* Ön a *Mégse* (a projekt nyitva marad), a *Mentés nélkül* (a projekt bezárul, és a módosításai elvesznek) vagy a *Mentés* (előbb mentés, utána bezárás) lehetőség közül választhat. Ha az asztali alkalmazást egészben zárja be (a bezárógombbal, az Alt+F4 billentyűkombinációval vagy az operációs rendszer menüjével), az minden módosított projektnél megkérdezi ugyanezt. A *Mégse* lehetőség, vagy egy sikertelen mentés megszakítja a bezárást. Egy ilyen normál bezárás után az alkalmazás törli az adott munkamenet helyreállítási másolatait, ezért a helyreállítási ablak csak valódi összeomlás után jelenik meg. Ha a projektnek módosításai vannak, és bezárja a böngésző lapját vagy ablakát, a böngésző megerősítést kér.

## Buktatók, és mit tesz ilyenkor az alkalmazás

**A megnyitott IFC-fájl azonnal a projekt fájlja lesz.** A *Mentés* felülírja ezt a fájlt, akkor is, ha másik programból származik. Ha meg akarja őrizni az eredetit, válassza előbb a *Mentés másként* lehetőséget.

**Más formátumok fájljait soha nem írja felül az alkalmazás.** A `.csv`, `.xml`, `.mpp` vagy `.xer` megnyitása után a projektnek nincs fájlja. A *Mentés* új IFC-fájlt ír, és az eredetit érintetlenül hagyja.

**A Firefoxban minden mentés új fájlt hoz létre.** Az alkalmazás ott nem tud a fájlba írni. Minden alkalommal új fájlt tölt le. A fájlnév a projekt neve, és nem a megnyitott fájl neve.

**A Chrome és az Edge engedélyt kér.** Amikor először ment egy megnyitott fájlt a *Mentés* lehetőséggel, a böngésző megkérdezi, hogy az alkalmazás írhat-e bele. Ha megtagadja, az alkalmazás egy ablakot nyit meg, amelyben új fájlt választhat. A Chrome-ban és az Edge-ben ez az ablak akkor is megjelenik, ha a meglévő fájlba írás nem sikerül, például mert a fájl eltűnt vagy zárolva van.

**Üzenet az azonos azonosítókról, és a számításba nem kerülő kapcsolatokról.** Megnyitás után üzenet maradhat a képernyőn. Ha ez áll benne: *Azonos azonosítójú objektumok ebben a fájlban*, minden ismétlődő objektum saját azonosítót kapott, és a hivatkozások az első előfordulásra mutatnak. Ilyenkor ellenőrizze a kapcsolatokat és a hozzárendeléseket. Ha ez áll benne: *kapcsolat(ok) nem vehető(k) figyelembe a számításban*, a kapcsolat egy összefoglaló tevékenységen volt, és nincs hatása. Ilyen például egy tevékenység, amelyet összekapcsoltak a saját összefoglaló tevékenységével. A fájl maga változatlan marad. Lásd: [Kapcsolatok](docs://uitleg-relaties): mit csinál a kapcsolat összefoglaló tevékenységen.

**A mentés sikertelen lehet.** Ha maga a mentés hibát ad, az alkalmazás a *Mentés sikertelen* üzenetet jeleníti meg az okkal együtt. A projekt nyitva marad, és továbbra is *Nincs mentve* jelöléssel van ellátva.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): mit tartalmaz egy IFC-fájl, és hogyan kezeli az alkalmazás a formátumokat.
- [Az automatikus mentés bekapcsolása](docs://howto-automatisch-opslaan): az alkalmazás magától frissíti a fájlt.
- [IFC-séma kiválasztása](docs://howto-ifc-schema-kiezen): mit jelent a kérdés: *Melyik IFC-sémában mentse?*
- [Exportálás](docs://howto-exporteren): másolat készítése másik formátumban.
- [Helyreállítás összeomlás után](docs://howto-herstellen-na-een-crash): mit tesz, ha az alkalmazás nem zárult le rendesen.
- [Import- és exportformátumok](docs://ref-import-exportformaten): formátumonként, hogy mi kerül át, és mi nem.
