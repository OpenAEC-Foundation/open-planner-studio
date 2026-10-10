# Kódok és egyéni mezők

Cél: saját besorolásokat (tevékenységkódokat, például *Helyszín*) és saját mezőket (például *Kivitelező*) rendelhet a tevékenységeihez.

## Mikor van erre szükség

A tevékenység rögzített adatain (név, időtartam, kapcsolatok, …) kívül saját adatokat is felvehet. Ha a tevékenységeket az északi és a déli szárny szerint szeretné besorolni, szakág szerint, vagy nyomon követni, melyik kivitelező végzi a tevékenységet, ezt magának kell rögzítenie. Kétféle mód van, és a különbség fontos.

Egy **tevékenységkód** rögzített választólistás besorolás. Egy **kódtípust** (például *Helyszín*) hoz létre **értékekkel** (*N* az északi szárnyhoz, *Z* a déli szárnyhoz). Egy tevékenységhez kódtípusonként legfeljebb egy érték tartozik.

Az **egyéni mező** (az ablakban az *Egyéni mezők* alatt) szabad beviteli mező, amelynek típusa van: *Szöveg*, *Szám*, *Egész szám*, *Költség*, *Dátum* vagy *Igen/nem*. A mező minden tevékenységen más értéket tartalmazhat.

## Lépések

### Kódok és mezők definiálása

1. Válassza az *Ütemezés › Szerkezet › Kódok és mezők* lehetőséget.
2. **Kódtípus létrehozása.** Az *Új kódtípus (pl. Helyszín)* mezőbe írja be a nevet, és nyomja meg az Enter billentyűt, vagy kattintson a *Kódtípus hozzáadása* gombra.
3. **Értékek hozzáadása.** A kódtípus alatt kattintson az *Érték hozzáadása* gombra. Az alkalmazás ide egy ideiglenes kódot helyez, *V1* néven. Módosítsa a *Kód* mezőben (rövid alakban, ahogyan beírná: *N*), szükség esetén töltse ki a *Leírás* mezőt (*Északi szárny*), és válasszon színt a *Szín* mezőben. A módosítás érvényes lesz, amint elhagyja a mezőt, vagy megnyomja az Enter billentyűt.
4. **Egyéni mező létrehozása.** Az *Új mező (pl. Kivitelező)* mezőbe írja be a nevet, válassza ki a típust, és kattintson a *Mező hozzáadása* gombra (vagy nyomja meg az Enter billentyűt).

Az ablakban nincs OK gomb: minden módosítás azonnal érvényesül. A mező típusát később nem lehet módosítani, csak a nevét. Ha másik típust szeretne, hozzon létre új mezőt.

### Kód vagy mező megadása egy tevékenységen

Két helyen adhatja meg.

- **A *Tulajdonságok* panelen** (vagy az F2 billentyűvel megnyitott ablakban). Alul található a *Kódok és mezők* blokk: kódtípusonként egy választólista, mezőnként egy beviteli mező. A blokk csak akkor jelenik meg, ha van legalább egy kódtípus vagy mező.
- **Oszlopként a tevékenységtáblázatban.** Kattintson a táblázatfejléc jobb oldalán lévő **+** gombra (*Oszlop hozzáadása*), és az *Egyéni* csoportban válassza ki a kódtípust vagy a mezőt. Egy kódtípus cellájába írja be a kódot, például `N`, vagy válasszon a listából. Ha a kód nem létezik, ez jelenik meg: *Válasszon értéket ebből a tevékenységkódból.*

### Használat

Kódtípussal vagy egyéni mezővel szűrhet, csoportosíthat és rendezhet. Ezt elrendezéssel állítja be: *Nézet › Elrendezés › Új elrendezés*. Az ablakban jelölje be azokat a részeket, amelyeket rögzíteni szeretne. Ha a *Mentés* lehetőséget választja, a *Nézet › Elrendezés* menüben gomb jelenik meg, amelyre később újra rákattinthat. Az *Alkalmazás mentés nélkül* lehetőséggel csak most jeleníti meg az elrendezést a képernyőn. Csoportosításkor az érték nélküli tevékenységek a *(nincs)* csoportba kerülnek.

A sávok színezéséhez válassza a *Nézet › Alaptervek és előrehaladás › Sávszínek* lehetőséget, majd a *Kategória szerint* lehetőséget és a kódtípust. Ekkor minden sáv azt a színt kapja, amelyet az értékéhez a *Szín* mezőben adott meg.

## Buktatók és mit tesz az alkalmazás

**Törléskor a tevékenységekről eltűnnek az értékek.** Ha a kuka ikonnal kódtípust, értéket vagy mezőt töröl, az alkalmazás nem kér megerősítést. Ezzel együtt minden tevékenységen eltűnnek a hozzárendelt értékek. Az adott kódtípusra vagy mezőre vonatkozó csoportosítás vagy rendezés is megszűnik. A *Visszavonás* (Ctrl+Z) visszaállítja a kódtípust, az értéket vagy a mezőt és a kitöltött értékeket, de a csoportosítást és a rendezést nem: ezeket újra be kell állítania.

**Két érték ugyanazzal a kóddal.** Az *Érték hozzáadása* a meglévő értékek számától folytatja a számozást. Ha töröl egyet és hozzáad egyet, ezért egy kód kétszer is szerepelhet. Ha ezt a kódot beírja egy oszlopcellába, az alkalmazás nem fogadja el, és ezt jeleníti meg: *Ez a tevékenységkód-érték többször szerepel. Válassza ki a listából.* Adjon minden értéknek saját kódot.

**Sablonok nem viszik magukkal a kódokat és mezőket.** Lásd: [WBS-sablonok mentése és beszúrása](docs://howto-wbs-sjablonen). Ha tevékenységeket illeszt be egy másik dokumentumba, az alkalmazás törli azokat a kódokat és mezőket, amelyek ott nem léteznek, és ezt jelzi.

**Egy dátummező nem mozdul el.** Ha az egész projektet áthelyezi, a kitöltött, *Dátum* típusú egyéni mezők megtartják a dátumukat. Az előnézetben az alkalmazás erre figyelmeztet.

## Lásd még

- [Szerkezet módosítása](docs://howto-structuur-aanpassen): a WBS-fa, a tevékenységek szervezésének másik módja.
- [Projekt áthelyezése](docs://howto-project-verplaatsen): mi történik a dátumokkal, ha áthelyezi a projektet.
- [Elrendezés létrehozása és használata](docs://howto-layouts-gebruiken): csoportosítás és szűrés kódtípus vagy egyéni mező alapján.
- [Táblázatoszlopok módosítása](docs://howto-tabelkolommen-aanpassen): kódtípus vagy egyéni mező megjelenítése oszlopként.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): a tevékenységkódok *House* és *Discipline*, az egyéni mező *Cost estimate*, valamint a megjegyzések (nyitott és befejezett).
