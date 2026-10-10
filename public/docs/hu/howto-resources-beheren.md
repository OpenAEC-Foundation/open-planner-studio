# Erőforrások kezelése

Cél: erőforrások (személyek, gépek és anyagok) létrehozása, szerkesztése és törlése a projektben, hogy tevékenységekhez rendelhesse őket.

## Mikor van erre szükség

Mielőtt egy kőművest vagy egy darut tevékenységre tesz, a személynek vagy a gépnek erőforrásként kell léteznie. Az erőforrás rögzíti, mennyi belőle van, és mely napokon dolgozik. Ezzel az alkalmazás megállapítja, hogy egy napon túl sokat követel-e tőle. Az erőforrást akkor szerkeszti, ha változik a létszám, például ha egy második kőműves csatlakozik.

Két fogalom. **Maximális mennyiség** az egy munkanapra eső kapacitás: az 1 egy személyt vagy gépet jelent, a 2 kettőt. Egy **hozzárendelés** az, amikor egy erőforrás egy tevékenységen van (lásd: [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen)).

## Lépések

### Erőforrás létrehozása

1. Válassza az *Erőforrások › Kezelés › Új erőforrás* menüpontot. Az erőforráspanel átveszi a munkaterületet, és a táblázat alján megjelenik egy üres sor. A panelt az *Erőforrások › Kezelés › Erőforrások* menüponttal is megnyithatja. Válassza utána az *Új erőforrás a projektben* lehetőséget.
2. Írja be a nevet, például *Bricklayer*.
3. Válassza ki a *Típus* értékét: *Munkaerő* (az alapértelmezett), *Gép*, *Anyag*, *Alvállalkozó* vagy *Brigád*.
4. Töltse ki a többi mezőt, ha szükséges. Minden mezőnek van alapértelmezett értéke: a *Maximális mennyiség* 1, a *Naptár* pedig a *Projektnaptár*. Az *Alapdíj/óra* üres. A *Mértékegység* csak az *Anyag* típusnál tölthető ki, például m³.
5. Nyomja meg az Entert, vagy kattintson a soron kívülre. Az erőforrás megjelenik a táblázatban. Ha megnyomja az Entert, azonnal megnyílik alatta egy üres sor a következő erőforrásnak. Ha végzett, nyomja meg az Esc billentyűt.

A sor csak akkor válik erőforrássá, ha van neve. Ha az Esc billentyűt nyomja, vagy név nélkül máshova kattint, az alkalmazás nem hoz létre semmit. A kitöltés sorrendje nem számít: a típust kiválaszthatja előbb is, és utána beírhatja a nevet.

### Erőforrás szerkesztése

Szerkessze a mezőket a sorban. Az alkalmazás a nevet, az alapdíjat és a mértékegységet akkor menti, amikor elhagyja a mezőt. A többi mezőt azonnal menti.

- Az alkalmazás csak akkor fogadja el a *Maximális mennyiség* értékét, ha az nagyobb, mint 0. 0 vagy annál kisebb érték esetén a mező piros szegélyt kap, és visszaugrik az előző értékre.
- A *Naptár* dönti el, mely napokon dolgozik az erőforrás. Válassza a *Projektnaptár* lehetőséget, vagy egy saját naptárat. A *+ Erőforrás-naptár* lehetőséggel új naptárat hoz létre. A ceruza (*Szerkesztés…*) megnyitja a kiválasztott naptárat. Ha egy tevékenység olyan napon dolgozik, amikor az erőforrás naptára szerint nincs munkaidő, akkor az a nap túlterheltnek számít. Az erőforrás-naptár létrehozását itt találja: [Erőforrás-naptár beállítása](docs://howto-resourcekalender-instellen).
- Az *Alapdíj/óra* és az *Összesen*: az *Összesen* az erőforrás terhelt óráinak és az alapdíjnak a szorzata. Egy vakoló, akit 32 órára terheltek óránként 50-es alapdíjjal, 1 600,00-t tesz ki. A táblázat alján az összes erőforrás összege áll.
- A *Brigád* egy erőforrást egy *Brigád* típusú erőforrás alá csoportosít. Ez csak csoportosítás: az alkalmazás nem összegzi a tagok kapacitását vagy terhelését a brigádba.
- A bal oldali színes négyzet az erőforrás színe. Ez csak megjelenítés, és nincs hatása az ütemezésre.

### Időben változó kapacitás

Csak július 19-én érkezik a második kőműves? Kattintson a *Maximális mennyiség* melletti nyílra. Az *Időszakonkénti kapacitás* alatt válassza a *Lépés hozzáadása* lehetőséget. Minden lépésnek van dátuma (*Dátumtól*) és száma (*Maximális mennyiség*). A megadott dátumtól ez a szám érvényes. Lépések nélkül mindig a fix érték érvényes.

Egy új lépés a mai dátummal és 1 értékkel indul. Mindkettőt módosítsa, mert különben már mától 1-es kapacitás érvényes.

### Erőforrás törlése

1. Kattintson a sorban lévő kukára.
2. Ha az erőforrásnak van hozzárendelése, az alkalmazás megerősítést kér, például: *„Bricklayer” 4 hozzárendeléssel rendelkezik. Törli?* Kattintson a pipára a törléshez, vagy a keresztre a megszakításhoz. Hozzárendelés nélkül az erőforrás azonnal eltűnik.

Az erőforrás hozzárendelései vele együtt törlődnek. Ha egy tevékenység munkaszabálya nem a *Rögzített időtartam és egységek*, az alkalmazás a törölt erőforrás munkáját a megmaradt erőforrások között osztja el. A szabálytól függően ez megváltoztatja a hozzárendelt mennyiségüket vagy a tevékenység időtartamát. Ha az időtartam változik, az ütemezés már nem naprakész.

Visszavonhatja a létrehozást, a szerkesztést és a törlést a *Visszavonás* (Ctrl+Z) paranccsal.

### A kis áttekintés az oldalsávon

Az *Erőforrások › Kezelés › Erőforrás-dokkoló* menüpont a jobb oldali oldalsávba, a *Tulajdonságok* mellé, egy kompakt áttekintést helyez. Itt látja az egyes erőforrások nevét és színét. A túlterhelt erőforrás mellett figyelmeztető jel (*Túlterhelt*) látható. Itt csak a *Maximális mennyiség* mezőt módosíthatja. Ha egy vagy több tevékenységet jelöl ki, az áttekintés csak ezeknek a tevékenységeknek az erőforrásait mutatja.

## Buktatók és mit tesz ilyenkor az alkalmazás

**Csak az *Anyag* típus változtat a számításon.** Az alkalmazás ugyanúgy kezeli a Munkaerőt, a Gépet, az Alvállalkozót és a Brigádot. Az anyag nem számít bele a tevékenység időtartamába, és az alkalmazás nem végez rajta erőforrás-kiegyenlítést. A hisztogram *Összes erőforrás* sora sem számolja bele az anyagot.

**Nincs név, nincs erőforrás.** Az üres sor nyom nélkül eltűnik.

**Új lépés a kapacitásban.** Ha elfelejti módosítani a dátumot és a számot, a kapacitás mától 1-es lesz.

**Olyan erőforrás törlése, amelyre még szükség van.** Ha véletlenül töröl, azonnal nyomja meg a Ctrl+Z billentyűkombinációt. A hozzárendelések is visszakerülnek.

## Lásd még

- [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen): erőforrás rendelése egy tevékenységhez.
- [Erőforrás-naptár beállítása](docs://howto-resourcekalender-instellen): egy erőforrás munkanapjainak rögzítése.
- [Túlterhelés megoldása](docs://howto-overbezetting-oplossen): mit tegyen, ha egy erőforrásnak egy napon túl sok a munkája.
- [Erőforráspanel](docs://ref-resourcepaneel): az erőforráspanel összes mezője és gombja.
