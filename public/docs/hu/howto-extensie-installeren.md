# Bővítmény telepítése és kezelése

Cél: bővítmény telepítése, a jogosultsági kérdés elolvasása, és később a bővítmény letiltása vagy eltávolítása.

## Mikor van erre szükség

Egy bővítmény új funkciót ad az alkalmazáshoz, és nem kell új kiadásra várnia. Egy bővítmény például importformátumot adhat, amely megjelenik a *Fájl › Importálás* menüben. Gombot tehet a menüszalagra, vagy betűtípust adhat a PDF-exporthoz. A hivatalos katalógus ezeket kategóriákba sorolja: *Import/Export*, *Ütemezés*, *Jelentés*, *Segédprogram*, *Betűtípusok* és *Egyéb*.

Gondolja át alaposan, mielőtt telepít egyet. Egy bővítmény programkód, amely ugyanazokkal a jogokkal fut, mint maga az alkalmazás. Az alkalmazás ezt nem tudja korlátozni. Ezért kér az alkalmazás engedélyt minden telepítésnél. Hogy mit lát ebben a kérdésben, azt alább magyarázzuk.

## Lépések

### Bővítmény telepítése a katalógusból

1. Válassza a *Fájl › Bővítmények* menüpontot.
2. Válassza a *Böngészés* lapot. Az alkalmazás letölti a katalógust, amíg a *Katalógus betöltése...* felirat látszik. A katalógus tartalmát az azt karbantartó OpenAEC Foundation határozza meg, és ez megváltozhat.
3. Keressen bővítményt a *Bővítmények keresése...* mezővel. Az alkalmazás név, leírás, szerző és címke szerint keres.
4. Minden kártyán látható a név, a verzió, a kategória, a leírás és a szerző. Kattintson a *Telepítés* gombra.
5. Megnyílik a *Bővítmény telepítése?* ablak. Olvassa el, és nézze meg a következő lépést.
6. Kattintson a *Telepítés* gombra a folytatáshoz. A *Telepítés elvetése* gombbal nem történik semmi. Az Esc billentyű vagy az ablak melletti kattintás is elutasításnak számít, és ilyenkor az alkalmazás nem mutat hibaüzenetet.

A telepítés után a bővítmény azonnal engedélyezett lesz. A *Böngészés* lapon, a kártyán ez áll most: *Telepítve*. Amit a bővítmény hozzáad, azt magában az alkalmazásban látja: új gombot a menüszalagon, vagy importformátumot a *Fájl › Importálás* menüben. Egyes bővítmények üzenetet is mutatnak. Ezt a *Bővítmény* előtag és a bővítmény neve jelzi.

**Oktatóanyagok.** Az oktatóanyagok egy bővítmény. Ha a *Súgó* alatti *Oktatóanyagok* részben látja az *Oktatóanyagok telepítése* gombot, az a *Fájl › Bővítmények* menüpontot nyitja meg a *Böngészés* lapon. Az első bemutató után megjelenő kérdés is telepíti ezt a bővítményt. Mindkét út ugyanazt a jogosultsági kérdést mutatja, és ezt elutasíthatja.

### Bővítmény telepítése fájlból

Ha bővítményt fájlként kapott, így telepítse.

1. Válassza a *Fájl › Bővítmények* menüpontot.
2. A jobb felső sarokban kattintson a *ZIP* gombra egy ZIP-fájl esetén, vagy a *JS* gombra egy külön JavaScript-fájl esetén.
3. Válassza ki a fájlt. Megnyílik a *Bővítmény telepítése?* ablak, ahogy fent.

Egy ZIP-fájlnak tartalmaznia kell egy `manifest.json` fájlt és a bővítmény fő fájlját. Ha olyan bővítményt telepít, amely már telepítve van, az új verzió felülírja a régit. Ha az alkalmazás nem tudja telepíteni a fájlt, például mert a ZIP-fájl sérült, semmi sem történik: az alkalmazás ZIP- és JS-fájl esetén nem mutat hibaüzenetet, és a bővítmény nem jelenik meg a listában. Az okot viszont a hibakereső terminálban találja. Kapcsolja be a *Beállítások › Projekt › Beállítások* menüben, a *Speciális* lapon, a *Hibakereső terminál bekapcsolása* beállítással, és nyissa meg a *Hibakereső terminál megjelenítése* gombbal az állapotsorban. Ott látszik például ez: *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (az alkalmazás ezt a műszaki szöveget hollandul írja).

### A jogosultsági kérdés elolvasása

A kérdésből kiderül, mit kell eldöntenie.

- A *Szerző* és a *Tároló* azt mutatja, ki készítette a bővítményt, és hol van a forráskódja.
- Az *Eredet* megmutatja, honnan származik a fájl, és azt, hogy ellenőrizték-e. Ha piros színnel az áll, hogy a letöltés nincs ellenőrizve, csak akkor telepítse, ha ismeri a forrást.
- Az *Amibe beleegyezik* ismétli, hogy a bővítmény olyan programkód, amely ugyanazokkal a jogokkal fut, mint maga az alkalmazás, és azt, hogy ez az Ön platformján mit jelent. Csak olyan bővítményt telepítsen, amelynek szerzőjében megbízik.
- Az *Amit ez a bővítmény állít, hogy használ* mutatja a szerző által megadott jogosultságokat, kis címkék formájában. Ez a szerző nyilatkozata, nem korlátozás. Ha ott az áll: *Nincs megadva semmi*, a bővítmény attól még olvashatja és módosíthatja az ütemezése adatait.

Az egyes címkék jelentése és az ablak pontos szövegei a [Bővítmény jogosultságai](docs://ref-extensiepermissies) cikkben olvashatók.

### Bővítmény letiltása, újra engedélyezése vagy eltávolítása

1. Válassza a *Fájl › Bővítmények* menüpontot, majd a *Telepített* lapot. Minden bővítménynek van egy kártyája a névvel, a verzióval, a kategóriával, a leírással és a szerzővel.
2. A kártya kapcsolójával letiltja a bővítményt (*Letiltás*), vagy újra engedélyezi (*Engedélyezés*). Letiltott állapotban eltűnnek a gombok és az importformátumok, amelyeket a bővítmény hozzáadott, de a bővítmény telepítve marad. Az alkalmazás újraindítása után is kikapcsolva marad. Egy engedélyezett bővítmény magától elindul, amikor az alkalmazás elindul.
3. Kattintson az *Eltávolítás* gombra. A gomb *Megerősítés* lesz, és ez a magyarázat jelenik meg: *Végleges eltávolításhoz kattintson újra*. Kattintson még egyszer a bővítmény eltávolításához. Az alkalmazás a bővítmény által tárolt beállításokat is megtisztítja.

## Hibák és hogyan reagál erre az alkalmazás

**A katalógus nem töltődik be.** Ilyenkor ez áll: *A katalógus nem tölthető be:* a műszaki okkal együtt, és ott van az *Újrapróbálás* gomb. Ennek oka lehet, hogy nincs internetkapcsolata.

**A katalógus egy kártyája alatt ez áll:** *A telepítés nem sikerült.* A letöltés vagy a telepítés nem sikerült, például mert az ellenőrzőösszeg nem egyezett. Ilyenkor semmi sem települt. Ez nem ugyanaz, mint a kérdés elutasítása: ott nincs hibaüzenet.

**A lista felett ez áll:** *Kihagyott katalógustételek: 1*. A katalógus olyan tételt tartalmazott, amelyet az alkalmazás nem tud használni. A többi bővítményt a szokott módon telepítheti.

**A bővítmény nem indul el.** Ekkor a kártyán hibaüzenet látszik. Például az, hogy a bővítményhez az Open Planner Studio újabb verziója kell, a jelenlegi verziójával együtt. Vagy a hiba, amelyet maga a bővítmény adott. Ilyenkor a bővítmény nem aktív. Frissítse az alkalmazást, vagy távolítsa el a bővítményt.

**Egy kártya *Karantén* felirattal.** Az alkalmazás nem tudta használni a tárolt bővítményt. A név alatt *Ok:* áll, utána az ok. Az *Eltávolítás a tárhelyről* gombbal tisztítja meg.

**Saját bővítmény írása.** Az útmutató a bővítményszerzőknek (manifest, API, jogosultságok) a GitHub-tárolóban található: `OpenAEC-Foundation/open-planner-studio`, a `docs/extensions.md` fájlban.

**Egy bővítmény nem tartozik egy projekthez.** A bővítmények az alkalmazásban vannak tárolva. Az asztali alkalmazásban ezen a számítógépen, a böngészőben pedig annak a böngészőnek a tárhelyén van tárolva. Ezek minden projektjére vonatkoznak, és nem részei a projektfájlnak. Ha a böngészőben törli a webhely adatait, a bővítmények elvesznek.

## Lásd még

- [Az alkalmazás frissítése](docs://howto-app-bijwerken): egy bővítmény újabb alkalmazásverziót is kérhet.
- [Bővítményjogosultságok](docs://ref-extensiepermissies): mit jelent a telepítési kérdésben minden jogosultság.
