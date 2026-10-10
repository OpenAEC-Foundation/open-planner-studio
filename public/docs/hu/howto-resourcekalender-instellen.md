# Erőforrás-naptár beállítása

Cél: rögzítse, mely napokon áll rendelkezésre egy erőforrás. Így a hisztogram, a túlterhelés és a kiegyenlítés ezzel a naptárral számol.

## Mikor van rá szükség

A kőművescsapat csak hétfőtől csütörtökig dolgozik. A daru augusztus első két hetében egy másik projekten van. Egy alvállalkozónak négy meghatározott munkanapja van. Saját naptár nélkül az alkalmazás azt feltételezi, hogy az erőforrás a projektnaptár napjain dolgozik.

Az erőforrás-naptár egyetlen tevékenység dátumát sem módosítja. Csak azt határozza meg, mikor áll rendelkezésre az erőforrás. Ha egy tevékenység olyan napon dolgozik, amelyen az erőforrás nem dolgozik, a kapacitás aznap 0, és a nap túlterheltnek számít. Ha maga a tevékenység más napokon szeretne futni, adjon neki saját naptárat ([Naptár létrehozása és hozzárendelése](docs://howto-kalender-maken-en-toewijzen)). A különbséget a [Naptárak és munkanapok](docs://uitleg-kalenders) című rész ismerteti.

## Lépések

### Új erőforrás-naptár létrehozása

1. Válassza ki az *Erőforrások › Kezelés › Erőforrások* menüpontot. Megnyílik az erőforráspanel. Ha az erőforrás még nem létezik, hozza létre az *Új erőforrás a projektben* lehetőséggel.
2. Keresse meg az erőforrás sorát. A *Naptár* oszlopban az alapértelmezett érték a *Projektnaptár*: ekkor az erőforrás a projektnaptárat követi.
3. Válassza a listából a *+ Erőforrás-naptár* lehetőséget. Megnyílik az *Erőforrás-naptár* ablak. Ugyanazok a mezők szerepelnek benne, mint a naptárűrlapon: *Név*, *Munkanapok*, a munkaidő és az *Ünnepnapok*. Az új naptár a szabványos naptár másolataként indul, és a neve *Erőforrás-naptár* lesz.
4. Adjon a naptárnak az erőforráshoz illő nevet, például *Crew Mon–Thu*, és állítsa be a munkanapokat: a *Munkanapok* alatt kapcsolja ki a pénteket. Ünnepnapokat vagy leállásokat az *Ünnepnap hozzáadása* gombbal vesz fel az *Ünnepnapok* listába.
5. Kattintson az *Alkalmazás* gombra. A naptár most a projekt erőforrástárában van, és egy lépésben hozzá van rendelve az erőforráshoz. Ezt a *Visszavonás* gombbal vonhatja vissza. A *Mégse* gombbal semmi sem jön létre.

### Meglévő naptár kiválasztása vagy módosítása

A *Naptár* oszlopban válasszon egy naptárt a listából. A *Projektnaptár* lehetőség újra eltávolítja az erőforrás saját naptárát. Ha módosítani szeretné a kiválasztott naptárt, kattintson a lista melletti ceruzára (*Szerkesztés…*). Megnyílik az *Erőforrás-naptár* ablak az aktuális naptárral.

### Az eredmény ellenőrzése

1. Ha az állapotsorban ez áll: *Elavult — újraszámítsa (F5)*, nyomja meg a **Számítás** parancsot (F5).
2. Válassza az *Erőforrások › Hisztogram › Hisztogram* menüpontot, majd kattintson az erőforrásra a hisztogram bal oldalán lévő listában. Azok a napok, amelyeken az erőforrás nem dolgozik, de be van ütemezve, pirossal jelennek meg. Ha az egér mutatóját egy ilyen nap fölé viszi, a sáv például ezt jelzi: *Az erőforrás a(z) „Crew Mon–Thu” naptár szerint ezen a napon nem dolgozik*.
3. Az *Erőforrások › Túlterhelés* menüpontban látható a túlterhelt erőforrások száma. Az állapotsor például ezt jelzi: *1 erőforrás túlterhelve*.

## Buktatók és az alkalmazás válasza

**Csak a napok számítanak, nem az órák.** Az erőforrás-naptár határozza meg, mely napokon dolgozik az erőforrás. Az aznap rendelkezésre álló mennyiség a *Maximális mennyiség* értékéből következik, nem a naptár munkaidejéből.

**A kiegyenlítés nem mindig oldja meg ezt.** Ha nincs olyan időszak, amelyben a tevékenység minden napja az erőforrás munkanapjára esik, az eltolás nem segít. Válassza az *Erőforrások › Kiegyenlítés › Kiegyenlítés…* menüpontot, majd kattintson a *Számítás* gombra. A tevékenység ezután a *Fennmaradó ütközések* alatt jelenik meg, az okkal együtt: *Az erőforrás nem dolgozik minden olyan napon, amelyre ez a tevékenység szükséges — eltolás nem oldja meg*. Ezután rendelje a tevékenységet egy másik erőforráshoz, vagy adjon neki saját naptárat.

**Közös naptár.** A lista a projekt összes naptárát mutatja, tehát a projektnaptárat és a tevékenységek naptárait is. Ha egy ilyen naptárt a ceruzával módosít, a naptárat használó tevékenységek ütemezése is megváltozik, és az állapotsor ezt jelzi: *Elavult — újraszámítsa (F5)*. Inkább hozzon létre saját naptárat az erőforrásnak.

**A túlterhelést nem mindig a naptár okozza.** Egy olyan erőforrás is lehet túlterhelt, amely minden nap dolgozik. A képernyőtipp csak akkor említi a naptárat, ha a nap nem munkanap az erőforrás számára.

## Lásd még

- [Naptárak és munkanapok](docs://uitleg-kalenders): miért nem módosít az erőforrás-naptár dátumot.
- [Naptár létrehozása és hozzárendelése](docs://howto-kalender-maken-en-toewijzen): a naptárűrlap mezői.
- [Ünnepnapok és az építőipari szabadság generálása](docs://howto-feestdagen-genereren): ünnepnapok és leállások felvétele a naptárba.
- [Naptárablakok](docs://ref-kalenders): a naptárablakok összes mezője.
