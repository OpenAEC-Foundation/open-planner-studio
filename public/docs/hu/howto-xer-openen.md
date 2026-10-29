# Primavera P6-fájl (.xer) megnyitása

Cél: ütemezést megnyitni közvetlenül az alkalmazásban a Primavera P6-ból, XML-exportálás nélkül.

## Mikor van erre szüksége

Egy ügyfél vagy fővállalkozó a Primavera-ban dolgozik, és az ütemezését `.xer`-fájlként küldi. Ön meg akarja nézni, ki akarja számítani, vagy hozzá akar adni. Az alkalmazás csak `.xer`-fájlokat olvas: `.xer`-fájlt nem ír, és a fájlt soha nem módosítja. A fájlból átveszi a WBS-szerkezetet, és a tevékenységeket az időtartammal, a dátumokkal, a korlátozásokkal és az előrehaladással. Átveszi a kapcsolatokat a késleltetéssel, a naptárakat, és az erőforrásokat a hozzárendeléseikkel. Emellett átveszi a tevékenységkódokat, az egyéni mezőket (UDF), a megjegyzéseket és a P6 ütemezési beállításait. A *Level of Effort* típusú tevékenységből hangmat lesz.

## Lépések

1. Válassza a *Kezdőlap › Fájl › Megnyitás* lehetőséget, vagy nyomja meg a Ctrl+O billentyűkombinációt. Válassza ki az `.xer`-fájlt.
2. Az alkalmazás minden olyan projekthez nyit egy lapot, amelyben vannak tevékenységek. A legtöbb tevékenységet tartalmazó projekt lesz az aktív lap. Egy lap neve *Projektnév (Projektazonosító)*, ha a P6-projektazonosító eltér a névtől. A *Projektbeállítások* csak a nevet mutatja. Ha átnevezi a projektet, a projektazonosító a név után marad. Ezután egy ablak röviden elmagyarázza, mit vett át az alkalmazás a fájlból, és hogyan működik a mentés; lásd: [Fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan).
3. Olvassa el az üzenetet alul. Három projektet tartalmazó fájlnál így is kinézhet: *XER-fájl megnyitva: 3 projektdokumentum.* Alatta olyan sorok állnak, amelyek leírják, mit tett az alkalmazás. Lásd az alábbi címet.
4. Nézze meg, hogy a menüszalag alatt megjelenik-e egy üzenetsáv: *Az ütemezést úgy látja, ahogy a Primavera rögzítette; újraszámításkor 1 tevékenység eltérne.* A Primavera a saját, számított dátumait rögzíti a fájlban. Ha az alkalmazás számítása eltér ezektől, az alkalmazás a Primavera dátumait mutatja, amíg Ön nem változtat semmit. Egy tevékenység, amelyet már elkezdtek vagy befejeztek, mindig a tényleges dátumain marad, ahogy a Primavera-ban is. Hogy mit jelent ez, és hogyan vált az alkalmazás saját számítására, az a [Dátumok rögzítve](docs://uitleg-datums-zoals-opgeslagen) részben olvasható. Megjelenhet az *Ez a fájl óraalapú tervezést tartalmaz.* üzenet is, az *Óraalapú tervezés bekapcsolása* gombbal. Lásd: [Óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten).
5. Mentse a projektet a Ctrl+S billentyűkombinációval. Mivel az `.xer`-fájl soha nem íródik felül, az alkalmazás megkérdezi, hová kerüljön az új IFC-fájl. Javasolt fájlnév: *Projektnév (Projektazonosító)*.

### Az üzenet alatti sorok

Az üzenet első sora megnevezi a megnyitott lapok számát. Alatta csak azok a sorok állnak, amelyek érvényesek. Ezekre figyeljen:

- *Ez a projekt a(z) Primavera P6 szerint számol. Módosítsa a Fájl → Projektadatok → Számítási profil és beállítások menüpontban.* Az alkalmazás ezt a projektet a Primavera ütemezés-számítási szabályai szerint végzi. A *Számítási profil megnyitása* gombbal jut el a beállításhoz.
- *1 alapterv-projekt kizárva.* és *1 alapterv létrehozva.* Ha egy projekt a P6-ban egy másik projektet jelöl ki alaptervként, akkor az a másik projekt nem nyílik meg saját lapként. Az lesz a rá hivatkozó projekt aktív alapterve.
- *Biztonsági alapterv-tartalék használva.* Ha az alaptervek kijelölése miatt egyetlen projekt sem nyílna meg, ha egy projekt önmagára hivatkozik, vagy ha a projektek körkörösen hivatkoznak egymásra, az alkalmazás egyszerűen minden projektet megnyit, és nem hoz létre alaptervet.
- *1 projektközi kapcsolat megőrizve.* Kapcsolat két projekt között. Az alkalmazás forrásadatként megtartja, de nem alakítja át az ütemezés kapcsolatává.
- *12 tevékenység a Primavera által rögzített dátumokat mutatja (nem lett újraszámítva).* A szám azoknak a tevékenységeknek a számát jelenti, amelyekhez a *Dátumok rögzítve* nézetben a Primavera dátumait látja: minden olyan tevékenységet, amelyhez a fájl dátumot rögzített, nem csak azokat, amelyek eltérnek.

A többi sor a beolvasás diagnózisa. Ezek nem igényelnek semmit Öntől:

- a talált projektek száma;
- egy kihagyott üres projekt;
- egy figyelmen kívül hagyott lógó alapterv-hivatkozás;
- egy szövegkódolás, amely nem sima UTF-8 (az üzenet megnevezi, melyik; arab, cirill vagy görög szöveg esetén az alkalmazás a megfelelő Windows-kódlapot választja, egyébként Windows-1252-t);
- tervezett kezdés nélküli tevékenységek (ezek a fájl állapotdátumán vagy projektkezdésén indulnak);
- számlálók a táblák, a naptárak és a számok megállapításaihoz, az ismeretlen mezőértékekhez és a P6-ütemezési beállításokhoz, amelyeket az alkalmazás biztonságos választásra cserélt.

A *Bővebben* gomb megnyitja a Primavera-fájlok megnyitásáról szóló súgót.

## Buktatók és az alkalmazás válasza

**Nem minden válik lappá vagy kapcsolattá.** Tevékenység nélküli projekt nem nyílik meg. Egy alapterv-projekt nem nyílik meg saját lapként, és két projekt közötti kapcsolat nem válik kapcsolattá az ütemezésben. Az alkalmazás ezt az üzenet alatti sorokban jelzi.

**Minden lap saját projekt.** Ha ment egy lapot, az IFC-fájl megtartja az eredeti, teljes `.xer`-fájlt is. Ha később újra megnyitja azt az IFC-fájlt, az alkalmazás továbbra is ismeri a Primavera dátumait. Ha ez a forrásarchívum sérült, vagy egy másik IFC-program átírta a fájlt, az alkalmazás jelzi: *Az XER-forrásarchívum ebben a fájlban használhatatlan, ezért kimaradt; maga a projekt teljes egészében megnyílt.* Az ütemezés, a számítási profil és az összes projektadat teljes. Hiányzik: a Primavera által tárolt dátumok és az AI- és a bővítményadatok forráseredete. Nyissa meg újra az eredeti `.xer`-fájlt, hogy visszakapja az archívumot.

**Az IFC-fájl nagyobb lesz.** Mivel az IFC-fájl az egész eredeti `.xer`-fájlt tartalmazza, nagyobb, mint egy archívum nélküli IFC-fájl. Nagy `.xer`-fájlnál ezt a fájlméreten és a mentés idején is észreveszi. Ha egy `.xer`-fájl több projektet nyit meg, minden mentett lap a teljes `.xer`-fájlt hordozza, nem csak a saját projektjét.

**Az export CSV-be, MS Project XML-be vagy P6 XML-be adatvesztéssel jár.** Az alkalmazás figyelmeztet: *A(z) CSV formátumba történő exportáláskor elvesznek a XER-forrásadatok.* Az IFC nem veszít semmit.

**Egy szabad szombat vagy vasárnap, amely nincs benne a fájlban.** Az alkalmazás ezt a hétvégi napot maga is szabaddá teheti. A napot ekkor a naptárban *Naptárkivétel (hétvégi rekonstrukció)* néven találja. A mintát az [Import- és exportformátumok](docs://ref-import-exportformaten) részben találja.

**Tartalékidő a projektbefejezésig, befejezési dátum nélkül.** Ha a fájlban nincs befejezési dátum, az alkalmazás kikapcsolja a *Tartalékidő ütemezés-számítása a projektbefejezési dátumig* beállítást. Ez beleszámít a következő sorba: *N P6-ütemezési beállítás biztonságos tartalékot használt.* Részletek: [Import- és exportformátumok](docs://ref-import-exportformaten).

**Befejezett tevékenységek az állapotdátumon.** Egy befejezett tevékenység keskeny sávként jelenhet meg az állapotdátumon a *Dátumok rögzítve* nézetben. Ez nem hiba a fájlban. A magyarázat és a kapcsolódó ütemezési szabály az [Import- és exportformátumok](docs://ref-import-exportformaten) részben található.

**Vesszővel tizedesjelölt számok.** Ha az alkalmazás nem tudja megbízhatóan megállapítani a tizedesjelet, nem nyitja meg a fájlt. Így nem nyílik meg olyan ütemezés, amelynek számait rosszul olvasta be. Kérjen a feladótól új exportot.

**Olyan fájl, amelyet az alkalmazás nem tud beolvasni.** Hibaüzenet jelenik meg, a hiba okával. Néhány példa:

- *Ez a fájl nem érvényes vagy nem támogatott XER-fájl.*
- *Egy XER-táblából kötelező oszlopok hiányoznak.*
- *Az XER-fájl P6-projektje nem tartalmaz tevékenységeket.*
- *Az XER-fájl tizedesjel-jelölése nem állapítható meg megbízhatóan.*

Ekkor semmi sem nyílik meg. Ellenőrizze a fájlt a P6-ban, vagy kérjen a feladótól új exportot.

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): miért csak olvasható egy `.xer`-fájl, és mit veszít egy export.
- [Dátumok rögzítve](docs://uitleg-datums-zoals-opgeslagen): a Primavera saját dátumainak nézete.
- [MS Project-fájl (.mpp) megnyitása](docs://howto-mpp-openen): ugyanez MS Project-fájllal.
- [Óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten): ha a fájl órákban megadott adatokat tartalmaz.
- [Import- és exportformátumok](docs://ref-import-exportformaten): formátumonként, mi kerül át és mi nem.
- [Számítási profilok és ütemezési szabályok](docs://uitleg-rekenprofielen): miért nyílik meg egy P6-fájl a saját számítási profiljával.
