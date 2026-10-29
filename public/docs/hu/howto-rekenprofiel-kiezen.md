# Számítási profil kiválasztása vagy létrehozása

Cél: döntse el, mely számítási profilt használja a projekt. Ön egy beépített profilt választ, vagy egyéni profilt készít saját ütemezési szabályokkal.

## Mikor van erre szükség

Ön olyan projektet nyit meg, amelyet Primavera P6 vagy Microsoft Project szerint kell számolni, vagy egy ütemezési szabályt másként szeretne beállítani, mint ahogy a profil teszi. Hogy mi a számítási profil, és miért tolódhatnak el a dátumok, azt itt olvashatja el: [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen).

## Lépések

### Profil választása új projekthez

1. Válassza a *Kezdőlap › Fájl › Új* menüpontot. Az *Új projekt* ablak nyílik meg.
2. A *Számítási profil* legördülő listában válassza ki a profilt: *Open Planner Studio*, *Primavera P6* vagy *Microsoft Project*.
3. Hozza létre a projektet. Az alkalmazás a már kitöltött számítási beállításokat a profil alapértelmezett értékeire cseréli.

### Egy meglévő projekt profiljának váltása

1. Válassza a *Beállítások › Projekt › Projektbeállítások* lehetőséget. Ön a *Fájl › Projektbeállítások* lehetőséget is választhatja.
2. A *Számítási profil és beállítások* blokkban nyissa meg a *Számítási profil* legördülő listát, és válasszon másik profilt.
3. Kattintson az **Alkalmazás** gombra. Az alkalmazás azonnal újraszámítja az ütemezést, akkor is, ha az *Automatikus ütemezés-számítás* ki van kapcsolva. Ha tevékenységek mozdultak el, az alkalmazás megadja, hány tevékenység mozdult el.

Amíg Ön nem kattint az *Alkalmazás* gombra, a változás csak az űrlapban létezik. A teljes váltás egy lépésben visszavonható a *Visszavonás* paranccsal. A váltás csak az ütemezési szabályokat módosítja, a számítási beállításai változatlanok maradnak.

### Egyéni profil készítése

1. A *Számítási profil és beállítások* blokkban kattintson a legördülő lista melletti *Új profil* gombra.
2. Adjon meg egy nevet. Az alkalmazás a kiválasztott profil nevét javasolja *… másolata* alakban, például *Open Planner Studio másolata*.
3. Kattintson a *Létrehozás* gombra. Az *Ennek a profilnak az ütemezési szabályai* rész kinyílik.
4. Kapcsolja be vagy ki az ütemezési szabályokat a jelölőnégyzetekkel. A sor után álló i ikon megmutatja az adott ütemezési szabály magyarázatát. Az alaptól eltérő ütemezési szabály megkapja a *Visszaállítás az alapra* címkét.
5. Kattintson az **Alkalmazás** gombra. Csak ezután számítja ki a projekt az új profil szerint.

A három beépített számítási profil nem módosítható. Az ütemezési szabályaik csak tájékoztatásul jelennek meg.

### Egyéni profil mentése sablonként

1. Ha szükséges, adjon az egyéni profilnak másik nevet az *Ennek az egyéni profilnak a neve* mezőben.
2. Kattintson a *Mentés sablonként* gombra. Az alkalmazás jelenti, hogy a sablon mentése sikerült, vagy hogy miért nem.
3. Egy másik projektben, ugyanebben az alkalmazásban, a sablon a *Számítási profil* legördülő listában található.

Ha a számítási profil később eltér a sablontól, egy sárga blokk jelzi ezt. Ekkor válassza a *Sablon frissítése ebből a projektből* vagy a *Frissítés sablonból* lehetőséget.

A sablont a *Sablon törlése* gombbal törölheti. Az alkalmazás előbb megerősítést kér.

## Az eredmény ellenőrzése

- A *Számítási profil és beállítások* blokk mutatja a kiválasztott profilt.
- Az *Alkalmazás* után az alkalmazás jelenti az eltolódott tevékenységeket, például: *Az alkalmazás után 4 tevékenység tolódott el.*
- Egy narancssárga blokk a számítási beállítások fölött jelzi, hogy a beállításai eltérnek a profil alapértelmezett beállításaitól. Ez gyakran szándékos. Ha mégis az alapértelmezett beállításokat szeretné, kattintson a *… alapértelmezett beállításainak használata* gombra.

## Buktatók és az alkalmazás működése

**A dátumok eltolódnak.** Egy másik számítási profil megváltoztathatja a dátumokat. Ellenőrizze az eredményt. Ha nem tetszik, válassza a *Visszavonás* parancsot: a profil és a dátumok együtt térnek vissza.

**Sárga blokk a *Visszavonás* után.** Ha a *Visszavonás* vagy a *Megismétlés* gombot nyomja meg, miközben a *Projektbeállítások* ablak nyitva van, a blokk a projekt állapotát követi. Ha Ön már módosított valamit a blokkban, a választása megmarad. Ekkor egy sárga blokk jelzi, hogy az *Alkalmazás* gomb visszaállítja ezt a választást.

**Legfeljebb 100 sablon lehet.** Ha már 100 sablon van, az alkalmazás nem menti a sablont, és ezt jelzi. Előbb törölje az egyik sablont. Ha az alkalmazás tárhelye tele van, vagy nincs meg, az alkalmazás szintén üzenetet jelenít meg.

**A sablonok az alkalmazáshoz, a profil a projekthez tartozik.** A projekt mindig a saját másolatát tartalmazza a profilból. Ha később módosítja a sablont, a projekt ezzel nem változik.

**Beállítások egy forrásfájlból.** Ha a *Primavera P6* vagy a *Microsoft Project* lehetőséget választja olyan projekthez, amely másik fájlból származik, a forrásfájl beállításai megmaradnak. Itt nem módosíthatja azokat.

## Lásd még

- [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen): mi a számítási profil, és mit tesz a dátumokkal.
- [Számítási beállítások és ütemezési szabályok](docs://ref-rekenopties-en-conventies): az összes ütemezési szabály és számítási beállítás egy helyen.
- [Az előrehaladási mód kiválasztása](docs://howto-voortgangsmodus-kiezen): Retained Logic vagy Progress Override, a számítási profiltól függetlenül.
