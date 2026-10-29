# Visszajelzés adása

Cél: hibát jelenteni vagy ötletet továbbadni, adott esetben képernyőképpel, közvetlenül az alkalmazásból.

## Mikor van erre szükség

Az ütemezés olyan értékeket számol ki, amelyeket nem ért, egy gomb nem azt csinálja, amit kellene, vagy hiányzik valami az alkalmazásban. Egy jó visszajelzés segít a készítőknek megtalálni a hibát. Ezért az alkalmazás maga is beleteszi a visszajelzésbe a verziót, az operációs rendszert és a nyelvet. Amit Ön ír le, az dönti el, hogy tudnak-e vele kezdeni valamit: mit tett, mit várt és mi történt.

## Lépések

1. Kattintson a *Visszajelzés küldése* gombra az ablak tetején. Ez a gomb mindig a címsorban van. A szövege tízpercenként változik: *Visszajelzés küldése*, *Hiba bejelentése* vagy *Új funkció kérése*. Mindig ugyanaz a gomb. Megnyílik a *Visszajelzés küldése* ablak.
2. Válassza ki a bejelentés típusát. A *Valami nem működik* a hibákhoz való: valami nem úgy működik, ahogy kellene. Az *Ötlet* olyasmire való, amit hiányol, vagy másképp szeretne. A *Kérdés vagy megjegyzés* minden másra való. Alapértelmezés szerint a *Valami nem működik* van kiválasztva.
3. Töltse ki a *Cím* mezőt, majd a *Leírás* mezőt. Az üres mezők példát mutatnak: a *Cím* mezőben például *Pl. A kritikus út a mentés után ugrik*, a *Leírás* mezőben pedig a kérdés: *Mit csinált, mit várt, és mi történt?* Amíg a *Küldés* gomb szürke, a mellette lévő szürke sor megmondja az okát, például *Adjon meg egy címet*, vagy azt, hogy a címbe és a leírásba együtt legalább 10 karaktert kell beírnia.
4. Ha választ szeretne kapni, töltse ki az *E-mail-cím* mezőt. Ez a mező nem kötelező. Az alkalmazás sikeres bejelentés után megjegyzi a címet, ezért a következő alkalommal már ott lesz.
5. Ha valamit meg szeretne mutatni, kapcsolja be a *Képernyőkép összekapcsolása* jelölőnégyzetet. Az alkalmazás ekkor az alkalmazásról készít képet, ezen ablak nélkül. Egy pillanat múlva egy kis előnézetet lát, mellette három gombbal: *Jegyzetelés*, *Újrakészítés* és *Eltávolítás*.
6. A *Jegyzetelés* gomb egy szerkesztőt nyit meg. Ebben nyilakat, téglalapokat, szabad vonalakat és szöveget tehet a képre. A *Takarás* gombbal fekete területet rajzolhat olyasmi fölé, ami nem kerülhet bele a képre, például egy név vagy egy összeg fölé. Ez a rész ekkor valóban eltűnik az elküldött képről. Kiválasztja a színt, visszavonhatja az utolsó műveletét a *Visszavonás* gombbal, vagy az *Összes törlése* gombbal kezdheti elölről. Kattintson a *Befejezés* gombra a módosítások megtartásához, vagy a *Mégse* gombra (vagy az Esc billentyűre) a módosítások eldobásához.
7. Az *Újrakészítés* gomb új képernyőképet készít, és törli a jegyzeteit. Az *Eltávolítás* gomb eltávolítja a képernyőképet, és kikapcsolja a *Képernyőkép összekapcsolása* jelölőnégyzetet.
8. Nézze meg az űrlap alatti szürke sort, a *Mellékelve* sort. Ez mutatja, mit küld el az alkalmazás magától: a verziót, az operációs rendszert és a nyelvet, például *Mellékelve: v2026.10.1 · Windows · angol*.
9. Kattintson a *Küldés* gombra. Küldés közben a gomb ezt írja: *Küldés*…
10. Ön ezt látja: *Köszönjük, a bejelentését elküldtük*. Ha a bejelentéséhez GitHubon issue készült, megjelenik a *Megtekintés a GitHubon* gomb is. Kattintson a *Bezárás* gombra.

## Hová kerül a bejelentése

Az alkalmazás az OpenAEC által üzemeltetett Open Feedback Studio-nak küldi el a bejelentését. Ehhez nincs szükség fiókra, a GitHubon sem. A készítők a bejelentését az áttekintésükben látják. Ha ott az alkalmazás össze van kapcsolva a GitHubbal, az Open Feedback Studio a bejelentésből a GitHubon nyilvános issue-t is készít. A *Valami nem működik* típusnál az issue a *bug* címkét kapja, az *Ötlet* típusnál az *enhancement* címkét. A leírása alatt ekkor egy sor áll: az Open Planner Studio verziója, az operációs rendszer és az alkalmazás nyelve.

## Buktatók és az, amit az alkalmazás ilyenkor tesz

**A bejelentése nyilvánosságra kerülhet.** Ne tegyen bele olyat, amit nem akar megosztani. Ez a képernyőképre is vonatkozik: a kép mindent mutat, ami ekkor látszik az alkalmazásban, például a projekt tevékenységeinek nevét és erőforrásait. Az alkalmazás a *Képernyőkép összekapcsolása* bekapcsolásának pillanatában készíti a képernyőképet. Ha a képernyő még nem jó, zárja be az ablakot, állítsa be a képernyőt, nyissa meg újra az ablakot, és kattintson az *Újrakészítés* gombra. Használja a *Takarás* gombot, hogy elrejtse, amit nem akar megmutatni.

**A képernyőkép túl nagy.** Az alkalmazás küldés előtt kisebbre méretezi a képernyőképet. Ha utána is túl nagy, a bejelentés kép nélkül megy el. A köszönő képernyőn ekkor ez olvasható: *A képernyőkép túl nagy volt, ezért nem lett elküldve*.

**A küldés nem működik.** Az ablakban üzenet jelenik meg, és a szövege megmarad. Négy eset lehetséges:

- *A bejelentést nem fogadták el.* Ellenőrizze a szöveget és az e-mail-címet. Az olyan bejelentést, amely főleg hivatkozásokból áll, nem fogadjuk el.
- *Rövid idő alatt sok bejelentést küldött.* Próbálja újra egy óra múlva.
- *A küldés nem sikerült.* Nincs kapcsolat, vagy a szerver nem válaszol. Próbálja újra, vagy kattintson a *Megnyitás a GitHubon* gombra. Ez a gomb nem jelenik meg, ha egy korábbi próbálkozás bizonytalan volt (lásd lent).
- *Nem vagyunk biztosak abban, hogy a bejelentése megérkezett. Várjon egy percet, és küldje el újra. Ha már megérkezett, ezt automatikusan észrevesszük*. A kapcsolat megszakadt, miután az alkalmazás elküldte a bejelentést. A szövege megmarad. Nincs *Megnyitás a GitHubon* gomb, mert a bejelentése még megérkezhet. Ez így marad, amíg el nem küldi a bejelentést, vagy már beérkezett, akkor is, ha közben bezárja az ablakot, és újra megnyitja.

**A bejelentés már beérkezett.** Ha olyan bejelentést küld, amely már ott van, az űrlap fölött ez áll: *Ez a bejelentés már megérkezett hozzánk. Szeretne valamit hozzáfűzni? Akkor módosítsa a szöveget, és küldje el újra*. A szöveg megmarad, és az alkalmazás megjegyzi az e-mail-címet. Kattintson a *Bezárás* gombra, ha nem akar hozzáfűzni semmit; a következő alkalommal az űrlap üres lesz. Ha többet ír, az üzenet eltűnik, és újra küldhet. A gomb ekkor ismét *Mentés és bezárás* lesz, és a szövege megmarad.

**Megnyitás a GitHubon.** Ez az út az Open Feedback Studio nélkül működik. Ehhez viszont szükség van egy GitHub-fiókra. Képernyőkép nélkül az új issue létrehozásához szükséges GitHub-oldal azonnal megnyílik a böngészőben, a címmel és a leírással már kitöltve. Képernyőképpel először a *Majdnem kész — a képernyőkép a vágólapon van* üzenetet látja, négy lépéssel. Kattintson az *OK, ugrás a GitHubra* gombra, kattintson az issue-oldal nagy szövegmezőjébe, és nyomja le a Ctrl+V billentyűt (Mac-en a Cmd+V billentyűt). Ezután kattintson lent az *Új issue beküldése* gombra. Csak ekkor küldi el a bejelentést.

**A beillesztés nem működik.** A GitHub-úton a képernyőkép fájlként is el van mentve a számítógépén. Az asztali alkalmazásban az ablak megnevezi az útvonalat: *Nem tud beilleszteni? A képernyőképet ide is elmentettük:* azt az útvonalat *— húzza ezt a fájlt a szövegmezőbe.* A böngészőben az alkalmazás a képet `feedback-` névvel és egy számmal, `.png` kiterjesztéssel tölti le. Megtalálja a Letöltések mappában, és húzza a szövegmezőbe.

**A képernyőkép készítése nem sikerül.** Ekkor ez áll: *A képernyőkép készítése nem sikerült. A visszajelzést képernyőkép nélkül is elküldheti*. A *Képernyőkép összekapcsolása* jelölőnégyzet kikapcsol, és a bejelentést kép nélkül is elküldheti.

**Az ablak bezárása küldés előtt.** Ha az űrlapban van valami, az alsó gomb neve *Mentés és bezárás*. Üres űrlapnál a neve *Bezárás*. A *Mentés és bezárás* gomb, a bezáró kereszt és az Esc billentyű bezárja az ablakot. A bejelentés piszkozatként marad meg, amíg el nem küldi, vagy az *Ürítés* gombra nem kattint. Ha újra megnyitja az ablakot, a típus, a szöveg, az e-mail-cím és a jegyzetekkel ellátott képernyőkép még ott van. A piszkozat addig marad meg, amíg az alkalmazás nyitva van. Ha kilép az alkalmazásból, a piszkozat eltűnik. Sikeres bejelentés után az űrlap ismét üres. Ha újra szeretne kezdeni, kattintson a bal alsó sarokban lévő *Ürítés* gombra. Az ablak melletti kattintás nem zárja be az ablakot. Küldés közben az Esc billentyű nem zárja be az ablakot.

## Lásd még

- [Az alkalmazás frissítése](docs://howto-app-bijwerken): visszajelzés előtt ellenőrizze, hogy a legújabb verziót használja-e.
