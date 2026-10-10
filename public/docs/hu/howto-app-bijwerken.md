# Az alkalmazás frissítése

Cél: megtudni, hogy megvan-e a legújabb verzió, frissíteni az alkalmazást, és elolvasni, mi újdonság egy verzióban.

## Mikor van erre szüksége

Az Open Planner Studio új verziói rendszeresen megjelennek. Ön azt szeretné tudni, hogy már megvan-e az új verzió, például mielőtt hibát jelentene, vagy mert egy bővítmény újabb verziót kér. Vagy éppen frissített, és látni szeretné, mi változott.

Frissíteni csak az asztali alkalmazásban lehet. A böngészőverzióban nincs frissítő.

## Lépések

### Frissítés, ha az alkalmazás jelez új verziót

1. Indítsa el az asztali alkalmazást. Indításkor az alkalmazás a háttérben ellenőrzi, hogy van-e új verzió. Ha nincs új verzió, vagy az ellenőrzés nem sikerül, például internetkapcsolat nélkül, nem vesz észre semmit.
2. Ha van új verzió, megnyílik a *Szoftverfrissítés* ablak. Ez a következőket mutatja: a *Jelenlegi verzió*, az *Új verzió*, az *Új verzió érhető el* üzenet, és az *Újdonságok* alatt a frissítéshez tartozó szöveg.
3. Mentse el a megnyitott projekteket.
4. Kattintson a *Letöltés és telepítés* gombra. A folyamatjelző a *Letöltés…* szöveget mutatja, utána következik a telepítés. Letöltés közben nem zárhatja be az ablakot.
5. Várjon, amíg az alkalmazás újraindul. Ez már az új verzió.

Közvetlenül a frissítés telepítése előtt az alkalmazás a megnyitott projektekről is pillanatfelvételt készít a visszaállás összeomlás után funkció számára. Lásd: [Visszaállás összeomlás után](docs://howto-herstellen-na-een-crash).

### Új verzió keresése kézzel

1. Válassza a *Beállítások › Projekt › Beállítások* lehetőséget. Ön a *Fájl › Beállítások* lehetőséget is választhatja, vagy a felül lévő fogaskerék ikont.
2. Válassza a *Speciális* fület. A *Verzió* alatt látható a jelenlegi verzió száma.
3. Kattintson a *Frissítések keresése* gombra. Megnyílik a *Szoftverfrissítés* ablak, és ezt mutatja: *Ellenőrzés…*. Utána ez áll benne: *A legújabb verziót használja*, vagy az üzenet, hogy van új verzió, ugyanazzal a *Letöltés és telepítés* gombbal.

A böngészőverzióban ennek a gombnak nincs különleges hatása: az ablak azonnal ezt írja: *A legújabb verziót használja*, és az alkalmazás nem ellenőriz semmit.

### Az újdonságok elolvasása

1. Ha az asztali alkalmazást először indítja el olyan verzióval, amely eltér az előzőtől, vagy friss telepítés után, az ablak magától megnyílik. Angolul ez a cím: „You're up to date!”. A magyar felirat: *Naprakész!*
2. A tetején látható, hogy melyik előző verzióról melyik új verzióra lépett. Friss telepítés után csak az új verzió látszik.
3. Ha az alkalmazásban van beépített összefoglaló ehhez a verzióhoz, egy fő pontot és négy kisebb pontot lát. A fő ponthoz tartozhat egy *Útmutató megnyitása* gomb. Ellenkező esetben csak a verzióváltást és az alatta lévő részt látja.
4. A *Kiadási jegyzetek megtekintése* gombbal megnyitja a változásnaplót a GitHub-on. Ha ez nem működik, ezt írja: *A kiadási jegyzeteket nem lehetett megnyitni.*
5. Az *Ez a frissítés számokban* részben látható az előző kiadás óta eltelt napok száma, a commitok száma és a hozzáadott kódsorok száma. Ha az alkalmazás le tudja kérdezni a telepítőcsomag méretének változását, az is megjelenik. Minden szám csak akkor látszik, ha elérhető.
6. Kattintson az *Értettem* gombra, így bezárja az ablakot.

Ha később újra látni szeretné ezt az ablakot, válassza a *Beállítások › Projekt › Beállítások* lehetőséget, majd a *Speciális* fület, és a *Verzió* alatt az *Újdonságok* gombot. Az ablak ekkor a jelenlegi verzióhoz nyílik meg, előző verzió nélkül.

## Buktatók, és mit tesz ilyenkor az alkalmazás

**A frissítés sikertelen.** Az ablak a *Hiba történt a frissítés során* üzenetet mutatja. Alatta a technikai ok látható, és van egy *Újrapróbálkozás* gomb.

**Ha .deb csomagként telepítette az alkalmazást, és a telepítés nem sikerül.** Az ablak ezt magyarázza: *Frissítsen kézzel: futtassa ezt a parancsot egy terminálban, vagy töltse le a legújabb csomagot.* A *Telepítő parancs* részben látható a parancs, a *Parancs másolása* gombbal (utána ez áll: *Másolva*). A *Letöltési oldal megnyitása* gombbal a legújabb verzió letöltési oldalára jut.

**A Snap Store-on keresztül telepítette az alkalmazást.** Ekkor az alkalmazás nem frissíti magát, és indításkor sem ellenőriz. Ezt a Snap Store végzi. Az ablakban ez áll: *Ez a verzió automatikusan frissül a Snap Store-on keresztül. Nincs dolga.*

**Indításkor nem jelenik meg semmi.** Ez normális, ha már a legújabb verziót használja. Az indításkori ellenőrzés nem jelez hibát. Ha biztos szeretne lenni benne, hogy naprakész, ellenőrizze kézzel a fenti módon.

## Lásd még

- [Visszajelzés küldése](docs://howto-feedback-geven): hiba bejelentése a legújabb verzióban.
