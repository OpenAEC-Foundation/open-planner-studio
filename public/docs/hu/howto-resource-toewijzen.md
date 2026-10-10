# Erőforrások hozzárendelése görbével

Cél: erőforrás hozzárendelése egy tevékenységhez, napi hozzárendelt mennyiséggel és egy görbével. A görbe határozza meg, hogyan oszlanak el ezek a mennyiségek a tevékenység napjai között.

## Mikor van erre szükség

Amint látni szeretné, ki hol és mikor dolgozik: a kőműves a külső falrétegnél, a daru az üreges födémelemeknél. Hozzárendelés nélkül nincs terhelés, így nincs hisztogram és nincs túlterhelés.

Két fogalom. A **hozzárendelt mennyiség** (az alkalmazásban *Hozzárendelt mennyiség/nap*) az, hogy az erőforrásból mennyi dolgozik a tevékenységen munkanaponként: az 1 egy kőműves, a 2 kettő, a 0,5 fél nap. A **görbe** határozza meg, hogyan oszlik el az összeg, vagyis a hozzárendelt mennyiség szorozva az időtartammal, a tevékenység munkanapjain. A munka ritkán egyenletes: egy falnál az elején csendes a munka, a közepén zsúfolt, a végén ismét csendes.

A külső falréteg 6 munkanapot vesz igénybe. Egy kőművessel és az *Egyenletes* görbével ez napi 1 hozzárendelt mennyiség a 6 napon, összesen 6. A *Harang alakú* görbével továbbra is összesen 6 hozzárendelt mennyiség lesz, de az eloszlás 0, 1, 2, 2, 1 és 0 lesz.

## Lépések

Erőforrást kétféleképpen rendelhet hozzá. Az erőforrásnak már léteznie kell (lásd: [Erőforrások kezelése](docs://howto-resources-beheren)).

### A menüszalagon keresztül

1. Válasszon ki egy tevékenységet a tevékenységtáblázatban. Normál tevékenységnek kell lennie, nem mérföldkőnek és nem összefoglaló tevékenységnek.
2. Válassza az *Erőforrások › Hozzárendelés › Hozzárendelés ▾* lehetőséget.
3. Az ablakban töltse ki a *Hozzárendelt mennyiség/nap* mezőt (alapértelmezés: 1), és válassza ki a *Görbe* mezőt (alapértelmezés: *Egyenletes*). Ezek a beállítások a most kiválasztott erőforrásra vonatkoznak.
4. Kattintson az erőforrásra. Az ablak bezárul, és a hozzárendelés megjelenik.

Egy második erőforrás hozzárendeléséhez újra megnyitja az ablakot. Azok az erőforrások, amelyek már rajta vannak a tevékenységen, nem szerepelnek a listában.

### A tulajdonságok panelen keresztül

1. Válassza ki a tevékenységet. A *Tulajdonságok* panel a jobb oldalon található. Ha nem látja, kapcsolja be a *Nézet › Panelek › Tulajdonságok* lehetőséggel.
2. A *Hozzárendelések* blokk legalján válassza ki az erőforrást az *Erőforrás hozzárendelése* mezőnél. A hozzárendelés 1-es hozzárendelt mennyiséggel és az *Egyenletes* görbével indul.
3. Minden hozzárendelésnél módosítsa a *Hozzárendelt mennyiség/nap* értékét, és válasszon másik *Görbe* értéket.

Így módosíthat egy meglévő hozzárendelést is. A névnél található kuka ikonnal (*Eltávolítás*) veszi le a hozzárendelést a tevékenységről. Maga az erőforrás megmarad. Az *Áthelyezés ide…* lehetőséggel a hozzárendelést egy másik tevékenységhez helyezi át.

### A görbék

- *Egyenletes*: minden nap ugyanannyi. Ez az alapértelmezés, és olyan munkához illik, amely minden nap egyformán nehéz.
- *Elöl terhelt*: az eleje nehezebb, mint a vége. Olyan munkához illik, amely nagy erőfeszítéssel indul, például kitűzéssel.
- *Hátul terhelt*: a vége nehezebb, mint az eleje. Olyan munkához illik, amely a befejezés felé egyre sűrűbb.
- *Harang alakú*: csúcs a közepén, csendes elejével és végével. Olyan falhoz illik, amely csendesen indul, a közepén teljes erővel dolgozik, majd elhalkul.
- *Korai csúcs*: csúcs a közepe előtt. Olyan munkához illik, amely gyorsan felpörög.
- *Késői csúcs*: csúcs a közepe után. Olyan munkához illik, amelynek a zsúfolt szakasza csak későn jön.
- *Kettős csúcs*: két csúcs. Olyan munkához illik, amelynek két intenzív szakasza van.
- *Teknős*: csendes eleje és vége, a közepén széles csúcs. Olyan hosszú munkához illik, amely fokozatosan épül fel és csendesedik el.

A görbe csak az eloszlást változtatja meg. Az időtartam, a dátumok és az összeg ugyanaz marad. Utána nincs szükség újraszámításra. A hisztogram azonnal igazodik. A megtekintéshez válassza az *Erőforrások › Hisztogram › Hisztogram* lehetőséget. Ha tevékenységet választ ki, a hisztogram csak annak a tevékenységnek a terhelését mutatja.

## Buktatók, és hogy mit tesz ilyenkor az alkalmazás

**A görbe a csúcsot a hozzárendelt mennyiség fölé tolhatja.** Egész számot megadva az alkalmazás napi értéket egész mennyiségre kerekít, az összeg viszont ugyanaz marad. Egy kőműves 1-es hozzárendelt mennyiséggel a külső falrétegen és a *Harang alakú* görbével a 0, 1, 2, 2, 1, 0 eloszlást adja. A két középső napon ez 2 hozzárendelt mennyiség, szemben az 1-es *Maximális mennyiség* értékkel. A hisztogram ezeket a napokat pirosra színezi, és az erőforrás túlterhelésnek minősül. Válasszon másik görbét, vagy ossza el maga az órákat (lásd: [Az órás eloszlás beállítása](docs://howto-urenverdeling-aanpassen)). A 0,5 hozzárendelt mennyiségnél az alkalmazás századokra kerekít. Rövid tevékenységnél egész mennyiségekkel az alak ezért durvává válik: 10 napon, 1-es hozzárendelt mennyiséggel a *Teknős* görbe a 0, 1, 1, 2, 2, 1, 1, 1, 1, 0 eloszlást adja, ami pontosan megegyezik a *Korai csúcs* görbével.

**Nincs mérföldkő és nincs összefoglaló tevékenység.** Ekkor a *Hozzárendelés* gomb le van tiltva, a *Tulajdonságok* panelen pedig ez áll: *Mérföldkő esetén nem lehet hozzárendelést megadni*, vagy *Összefoglaló tevékenységen nem lehet hozzárendelést megadni*.

**Egy erőforrás egy tevékenységen csak egyszer szerepelhet.** Ha az erőforrás már rajta van a tevékenységen, nincs többé a listában. Ha az összes erőforrás már rajta van a tevékenységen, az alkalmazás ezt írja: *Minden erőforrás már hozzá van rendelve*. Ha még nincs erőforrás, ezt írja: *Hozzon létre előbb erőforrásokat (Erőforrások lap)*.

**A hozzárendelt mennyiségnek nagyobbnak kell lennie 0-nál.** Az alkalmazás a 0 vagy ennél kisebb értéket nem fogadja el.

**Anyag.** Anyag típusú erőforrásnál a hozzárendelt mennyiség a napi mennyiség, az erőforrás mértékegységében, például m³. Az anyag nem számít bele a tevékenység időtartamába.

**Egy munkaszabály módosíthatja az időtartamot.** Ha a tevékenység *Rögzített munka* vagy *Rögzített egységek* típusú, egy második erőforrás megváltoztatja a tevékenység időtartamát. Ekkor az ütemezés már nem naprakész. Nyomja meg az **Ütemezés-számítás** parancsot (F5). Lásd: [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels).

**Saját eloszlás.** Ha a hozzárendelésnek már van saját órás eloszlása, a görbe le van tiltva, és az *Eloszlás* jelenik meg. Előbb oldja fel ezt az eloszlást az *Órás eloszlás beállítása…* lehetőséggel.

**Visszavonás.** A hozzárendelés létrehozását, módosítását és eltávolítását a *Visszavonás* (Ctrl+Z) paranccsal vonhatja vissza.

## Lásd még

- [Az órás eloszlás beállítása](docs://howto-urenverdeling-aanpassen): a napi órák saját kezű beállítása.
- [A túlterhelés megoldása](docs://howto-overbezetting-oplossen): teendők, ha egy erőforrásnak egy napon túl sok a munkája.
- [Munkaszabályok: időtartam, hozzárendelt mennyiség és munka](docs://uitleg-werkregels): mi történik az időtartammal, ha módosítja a hozzárendelt mennyiséget.
- [Erőforráspanel](docs://ref-resourcepaneel): az erőforráspanel összes mezője és gombja.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): mind az öt erőforrástípus, mind a hat görbe, és egy toronydaru, amelynek kapacitás-lépcsője 2027. augusztus 30-tól van.
