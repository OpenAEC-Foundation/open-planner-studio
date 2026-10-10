# Visszajelzés adása

Cél: hibát jelenteni vagy ötletet továbbadni, adott esetben képernyőképpel, hogy a GitHubon issue legyen belőle.

## Mikor van erre szükség

Az ütemezés olyan értékeket számol ki, amelyeket nem ért, egy gomb nem azt csinálja, amit kellene, vagy hiányzik valami az alkalmazásban. Egy jó visszajelzés segít a készítőknek megtalálni a hibát. Ezért az alkalmazás maga is beleteszi a visszajelzésbe a verziót, az operációs rendszert és a nyelvet. Amit Ön ír le, az dönti el, hogy tudnak-e vele kezdeni valamit: mit tett, mit várt és mi történt.

## Lépések

1. Kattintson az ablak tetején lévő *Visszajelzés küldése* gombra. Ez a gomb mindig a címsorban található. Szövege tízpercenként változik: *Visszajelzés küldése*, *Hiba bejelentése* és *Új funkció kérése*. Mindig ugyanez a gomb. Megnyílik a *Visszajelzés küldése* ablak.
2. Válassza a *Hiba* lehetőséget, ha valami nem úgy működik, ahogy kellene, vagy a *Funkciókérés* lehetőséget, ha ötlete van. Alapértelmezés szerint a *Hiba* van kiválasztva.
3. Töltse ki a *Cím* mezőt. Cím nélkül a *Küldés a GitHubra* gomb szürke. Töltse ki a *Leírás* mezőt is, például: melyik tevékenységet módosította, mit várt, és mit látott.
4. Ha szeretne valamit megmutatni, kapcsolja be a *Képernyőkép összekapcsolása* lehetőséget. Az alkalmazás ekkor képet készít az alkalmazásról, de ezt az ablakot nem tartalmazza. Egy pillanat múlva egy kis előnézetet lát. A *Jegyzetelés* gombbal szerkesztő nyílik meg, ahol nyilakat, téglalapokat, szabadkézi vonalakat és szöveget helyezhet a képre. Ott kiválaszthatja a színt, a *Visszavonás* gombbal visszavonhatja az utolsó műveletet, vagy az *Összes törlése* gombbal elölről kezdheti. Ha elégedett, kattintson a *Befejezés* gombra.
5. Kattintson a *Küldés a GitHubra* gombra.
6. Nem csatolt képernyőképet? Akkor a GitHub-oldal, ahol új issue-t hozhat létre, azonnal megnyílik a böngészőben. Folytassa a 8. lépéssel.
7. Csatolt képernyőképet? Akkor először a *Majdnem kész — a képernyőkép a vágólapon van.* üzenetet látja, amely négy lépésből áll. Kattintson az *OK, ugrás a GitHubra* gombra, kattintson az issue oldal nagy szövegterületére, és nyomja meg a Ctrl+V billentyűkombinációt (Mac-en a Cmd+V). A kép feltöltődik, és megjelenik a szövegben.
8. Az issue oldal alján kattintson az *Új issue beküldése* gombra. Csak ekkor küldi el a visszajelzését. Jelentkezzen be a GitHubba, ha még nem tette meg.

Az issue oldalon már ki van töltve a cím és a leírás. Az alkalmazás a *bug* vagy az *enhancement* címkét javasolja, a leírás alá pedig egy sort tesz a típussal, az Open Planner Studio verziójával, az operációs rendszerrel és az alkalmazás nyelvével.

## Buktatók és mit tesz ilyenkor az alkalmazás

**Az alkalmazás magától nem küld semmit.** A *Küldés a GitHubra* gomb csak a kitöltött issue oldalt nyitja meg. Ha bezárja az oldalt anélkül, hogy az *Új issue beküldése* gombra kattintana, akkor nem küldte el a visszajelzését. Ehhez GitHub-fiók szükséges.

**A visszajelzés a GitHubra kerül.** Ne írjon bele semmit, amit nem szeretne megosztani. Ez a képernyőképre is vonatkozik: a kép mindent megmutat, ami az alkalmazásban abban a pillanatban látszik, például a tevékenységek nevét és a projekt erőforrásait. Az alkalmazás a képernyőképet abban a pillanatban készíti, amikor bekapcsolja a *Képernyőkép összekapcsolása* lehetőséget. Ellenőrizze tehát, hogy a képernyő megfelelő-e, mielőtt ezt megteszi, és hagyja ki azt, amit nem szeretne megmutatni.

**A beillesztés nem működik.** A képernyőkép fájlként is el van mentve a számítógépén. Az asztali alkalmazásban az ablak megadja az útvonalat: *Nem lehet beilleszteni? A képernyőképet ide is elmentettük:* ezt az útvonalat *— húzza ezt a fájlt a szövegterületre.* A böngészőben az alkalmazás a képet `feedback-` névvel, egy számmal és a `.png` végződéssel tölti le. Megtalálja a letöltések mappájában, és húzza a szövegterületre.

**A képernyőkép készítése sikertelen.** Az alkalmazás ezt mondja: *A képernyőkép készítése nem sikerült. A visszajelzést képernyőkép nélkül is elküldheti.* A jelölőnégyzet kikapcsol, és képernyőkép nélkül is elküldheti a visszajelzését.

**Sokat írt be, és véletlenül az ablak mellé kattint.** Ez nem zárja be az ablakot, így a szövege megmarad. Az Esc billentyű vagy a *Mégse* gomb bezárja az ablakot, és akkor a szövege elvész.

## Lásd még

- [Az alkalmazás frissítése](docs://howto-app-bijwerken): visszajelzés előtt ellenőrizze, hogy a legújabb verziót használja-e.
