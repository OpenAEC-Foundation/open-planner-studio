# Az órás eloszlás beállítása

Cél: egy hozzárendelésnél Ön határozza meg, mennyit dolgozik az erőforrás a tevékenység minden munkanapján, szabványos görbe használata helyett.

## Mikor van erre szükség

A görbe, például a *Harang alakú*, rögzített alak. Néha Ön jobban tudja. A kőműves az outer cavity leaf tevékenységen fél teljesítménnyel kezd, mert az állványt még építik. Utána teljes munkaidőben dolgozik. Vagy a csúcsot éppen a kapacitás alatt szeretné tartani. Ekkor az **órás eloszlást** állítja be.

Ön fázisokkal dolgozik. **Fázisok**: egymást követő munkanapok, amelyeken az erőforrás ugyanazzal a hozzárendelt mennyiséggel dolgozik. Az eloszlás csak ennek az egy hozzárendelésnek a napi óráit módosítja. A tevékenység dátumai nem változnak.

## Lépések

A példa az outer cavity leaf tevékenység: 6 munkanap, egy kőműves, 48 óra.

1. Válassza ki a tevékenységet. A *Tulajdonságok* panel a jobb oldalon látható. Ha nem látja, kapcsolja be ezzel: *Nézet › Panelek › Tulajdonságok*.
2. A *Hozzárendelések* blokkban kattintson a kőműves melletti oszlopdiagram-ikonra: *Órás eloszlás beállítása…*. Megnyílik az *Óraeloszlás fázisonként* ablak. Ön abból indul ki, amit az alkalmazás jelenleg könyvel: ennél az outer cavity leaf tevékenységnél egy fázis, 6 nap, 1-es hozzárendelt mennyiséggel.
3. Szükség esetén válasszon kiindulópontot az *Alak alkalmazása:* listából. A *Harang alakú* beállítással az alkalmazás öt fázist hoz létre: 0,18 hozzárendelt mennyiséggel az első és az utolsó napon, 0,84 a második és az ötödik napon, és 1,98 a két középső napon. Az összeg változatlanul 48 óra.

### A fázisok beállítása

A táblázatban vagy a fölötte lévő csíkban is dolgozhat.

- Írjon be egy másik *Hozzárendelt mennyiség (egys./nap)* értéket egy fázisba. Az *Óra/nap* és az *Órák* oszlop együtt számolódik.
- Módosítsa egy fázis *Napok* értékét. Az utolsó fázis mindig a tevékenység végéig tart, és megkapja a hátramaradó napokat.
- Válassza a *Szétbontás* lehetőséget, ha egy fázist kettéosztana, például 6 napot 3 és 3 napra. Válassza az *Összevonás* lehetőséget, ha egy fázist a következővel akar egyesíteni.
- A csíkban húzza a határt, ha egy fázist hosszabbítani vagy rövidíteni akar. Húzza a felső szélét, ha a hozzárendelt mennyiséget állítja be. Kattintson duplán egy napra, ha egy fázist szét akar bontani.

### Alkalmazás

Válassza az *Alkalmazás* lehetőséget. Ha a *Mégse* lehetőséget választja, az ablak változtatás nélkül záródik be.

Példa: Ön a *Szétbontás* lehetőséget választja, az első fázis *Napok* értékét 2-re állítja, és ennek a fázisnak a hozzárendelt mennyiségét 0,5-re. A második fázis ezután 4 napig tart, 1-es mennyiséggel. Az összeg 2 × 0,5 × 8 + 4 × 1 × 8 = 40 óra.

Az *Alkalmazás* után a hozzárendelés görbéje *Eloszlás* értékre áll, és letiltott lesz. A *Hozzárendelt mennyiség/nap* változatlan marad. A hisztogram és a túlterhelés azonnal követi az új eloszlást. Újraszámításra nincs szükség, mert egyetlen dátum sem mozdul el.

### Az eloszlás feloldása

Ha a hozzárendelésnek saját eloszlása van, az ablakban van egy *Eloszlás feloldása* lehetőség is. Ezzel törli a saját eloszlást, és az alkalmazás visszatér a *Hozzárendelt mennyiség/nap* és a görbe használatára. Válassza ezt akkor is, ha módosítani akarja a görbét, mert a *Görbe* legördülő lista addig nem használható, amíg van saját eloszlás.

## Buktatók, és mit tesz ilyenkor az alkalmazás

**Az összeg ezzel együtt változik.** Az órákat nem osztja el, hanem Ön határozza meg őket. Ha egy fázist 0,18 helyett 0,5-re állít, az összeg nagyobb lesz. Az összeg órában az ablak alján látható, ezért ellenőrizze, mielőtt az *Alkalmazás* lehetőséget választja.

**A hozzárendelt mennyiség utólag mit tesz, az a munkaszabálytól függ.** Ha *Rögzített időtartam és egységek* van beállítva, más *Hozzárendelt mennyiség/nap* érték nem változtat az eloszláson. Ha *Rögzített időtartam és munka* van beállítva, az alkalmazás a napi órákat az új hozzárendelt mennyiséggel együtt skálázza: 1 helyett 2 hozzárendelt mennyiségnél minden nap duplázódik, és az összeg is (32-ről 64 órára), az időtartam pedig változatlan marad. Ha *Rögzített munka* van beállítva, a hozzárendelt mennyiség megváltoztatja a tevékenység időtartamát: az eloszlás ekkor az új időtartamra összenyomódik vagy megnyúlik, azonos összeggel. Ha *Rögzített egységek* van beállítva, a hozzárendelt mennyiség az időtartamot is megváltoztatja; ellenőrizze utána az összeget az ablak alján.

**Ha módosítja a tevékenység időtartamát, az eloszlás vele együtt nyúlik.** Az alak ugyanaz marad. *Rögzített időtartam és egységek* és *Rögzített egységek* esetén az összeg az időtartammal arányosan nő: ha egy saját eloszlással rendelkező tevékenység időtartama 4-ről 8 munkanapra duplázódik, az összeg is duplázódik, 32-ről 64 órára. *Rögzített időtartam és munka* és *Rögzített munka* esetén az összeg változatlan marad (a 32 óra 32 óra marad), és a hozzárendelt mennyiség csökken.

**A munka követi az eloszlást.** A *Munka (hátr.)* a fázisok összege lesz, *Rögzített munka* esetén is. A tevékenység időtartama ettől nem változik.

**Érvénytelen hozzárendelt mennyiség.** Üres vagy negatív érték piros szegélyt kap, és az *Alkalmazás* ezután letiltott lesz. Egy fázis hozzárendelt mennyisége 0 is lehet. Az ilyen fázis a tevékenység időtartamán belül marad.

**Minden csak erre a hozzárendelésre vonatkozik.** Az alkalmazás ezt maga is kiírja: *Az eloszlás csak ennek a hozzárendelésnek a napi óráit módosítja; a tevékenység dátumai és felosztásai változatlanok maradnak.* Ugyanazon tevékenység más erőforrásai megtartják a saját eloszlásukat.

**A kiegyenlítés követi az eloszlást.** A kiegyenlítés ugyanannyi órát számol naponként, mint a hisztogram.

**Visszavonás.** Az *Alkalmazás* és az *Eloszlás feloldása* egyaránt egy-egy lépés, amelyet a *Visszavonás* (Ctrl+Z) visszacsinál.

## Lásd még

- [Erőforrások hozzárendelése görbével](docs://howto-resource-toewijzen): erőforrás hozzárendelése egy tevékenységhez, és görbe kiválasztása.
- [A túlterhelés megoldása](docs://howto-overbezetting-oplossen): mit tegyen, ha egy erőforrásnak egy napon túl sok a munkája.
