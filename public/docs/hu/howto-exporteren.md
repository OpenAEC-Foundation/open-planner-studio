# Exportálás

Cél: az ütemezés átadása fájlként, más formátumban, olyan valakinek, aki nem olvas IFC-t, vagy egy másik csomagnak.

## Mikor van erre szükség

A tanácsadó MS Projectben dolgozik, az ügyfél Primaverában, az alvállalkozó Excelben szeretné a tevékenységeket, vagy olyan csomagnak küld ütemezést, amely nem kezeli az IFC-t. Az export másolat egy másik formátumban. Ha magát a projektet szeretné megtartani, mentse el: ez IFC-be ír, és mindent átvisz. Hogy melyik formátum mit visz át és mit nem, azt a [Fájlok és formátumok](docs://uitleg-bestanden) szakaszban találja.

## Lépések

1. Válassza a *Kezdőlap › Fájl › Exportálás* lehetőséget, és válasszon egy formátumot a listából, vagy válassza a *Fájl › Exportálás* lehetőséget. Ott minden formátum egy kártya, rövid leírással.
2. Az ablakban válasszon nevet és helyet. Az alkalmazás a projektnevet javasolja, az adott formátum kiterjesztésével. Az előrehaladási lapok neve *projektnév-előrehaladás* lesz, és ahol lehetséges, a letöltési mappába kerülnek.
3. Erősítse meg. Ha az export sikerül, nem jelenik meg üzenet, az alábbi üzeneteken kívül. A *Fájl › Exportálás* lapról az export után visszatér a *Kezdőlap* lapra, akkor is, ha megszakítja az ablakot. Ha a *Kezdőlap* lapon, a listából indított exportot szakítja meg, nem történik semmi.

Ha a böngészője csak letöltésként ment (például a Firefox), a fájl közvetlenül az 1. lépés után a letöltési mappában van. Ekkor ez az üzenet jelenik meg: *Letöltésként mentve: a(z) „name.xml” most a letöltési mappában van. Ebben a környezetben az alkalmazás nem írhat közvetlenül a kiválasztott helyre.*

### Melyik formátumot válassza?

A *Kezdőlap* lapon lévő lista és a *Fájl › Exportálás* kártyái ugyanazokat a formátumokat kínálják:

- *Előrehaladás (Excel)* és *Előrehaladás (CSV)*, a kártyákon *Előrehaladási lap (Excel)* és *Előrehaladási lap (CSV)*: egy egyszerű lap az azonosítóval, a WBS-sel, a névvel, a dátumokkal és az elkészültséggel, amelyet azoknak küldhet el, akik az előrehaladást kitöltik.
- *CSV (;)*, a *CSV (pontosvesszővel tagolt)* kártyán: tevékenységlista, amelyet táblázatkezelőben nyit meg.
- *MS Project XML*: a Microsoft Project programban nyitható meg.
- *Primavera P6 XML*: az Oracle Primavera P6-hoz.
- *IFC 4x3*: az alkalmazás saját formátuma, minden adattal.

### IFC-export erőforrástár-fájllal

Ha a projekt erőforrástárhoz kapcsolódik, a(z) *Erőforrástár-fájl mentése mellé* jelölőnégyzet a *Fájl › Exportálás* kártyái alatt található. Ha bejelöli, és az *IFC 4x3* lehetőséget választja, az alkalmazás kétszer kér helyet: először a projektnek, majd a *projektnév-erőforrástár.ifc* fájlnak. Ez a jelölőnégyzet csak a *Fájl › Exportálás* lapon látható, a *Kezdőlap* lapon lévő listában nem.

### Előrehaladási lap visszaolvasása

Egy kitöltött előrehaladási lapot a *Fájl › Importálás* lehetőséggel olvas vissza. Lásd: [Előrehaladás importálása táblázatból](docs://howto-voortgang-importeren).

## Buktatók és mit tesz ilyenkor az alkalmazás

**A projekt nem változik.** A projekt fájlja ugyanaz marad, és a *Nincs mentve* jelölés is megmarad, ha korábban megvolt.

**Az elavult ütemezést az alkalmazás előbb újraszámítja.** Így mindig az aktuális dátumokat kapja, akkor is, ha elfelejtette megnyomni a *Számítás* gombot.

**Az export a legutóbbi fájlok között is megjelenik.** Ez nem vonatkozik az előrehaladási lapokra. Ha innen megnyit egy exportot, az az adott formátum importjaként nyílik meg.

**Az export nem visz át mindent.** Egy CSV-fájlban nincs erőforrás és korlátozás, a P6 XML-ben nincs alapterv és határidő. A számítási profil sem kerül át: egy újra megnyitott export az *Open Planner Studio* számítási profillal számolja ki az ütemezést. Csak az IFC visz át mindent. Számokkal ellátott példát a [Fájlok és formátumok](docs://uitleg-bestanden) szakaszban talál.

**Két formátum ugyanazzal a kiterjesztéssel.** Az MS Project XML és a Primavera P6 XML is ugyanazt a nevet kapja: *projektnév.xml*. Adjon nekik saját, eltérő nevet, különben később nem tudja megkülönböztetni, melyik fájl melyik formátum.

**Egy ütemezés körkörös kapcsolattal nem exportálható.** Az alkalmazás előbb kiszámítja az ütemezést, és ha hurok van, leáll. A *Kezdőlap* lapon ez az üzenet jelenik meg: *Az ütemezés nem számítható ki*. Alatta például ez áll: *Körkörös kapcsolat a tevékenységek között: Set up site → Demolish existing extension → Set up site*. A *Fájl › Exportálás* lapon csak a második szöveg jelenik meg. Oldja fel a hurkot, és exportáljon újra.

**Egy Primaverából származó projekt elveszíti a forrásadatokat.** Ha egy ilyen projektet CSV-be, MS Project XML-be vagy P6 XML-be exportál, az alkalmazás ezt jelzi: *A(z) CSV formátumba történő exportáláskor elvesznek a XER-forrásadatok.* Az MS Project XML esetén az üzenetben *MSPDI* áll, a P6 XML esetén *P6*. Lásd: [Primavera P6-fájl (.xer) megnyitása](docs://howto-xer-openen).

**A megszakított tevékenységek elveszítik a megszakításaikat.** Az MS Project és a Primavera a megszakítást csak órabeosztásként ismeri. Ha a projektben olyan megszakított tevékenység van, amelynek nincs órabeosztása, az alkalmazás MS Project XML-be vagy P6 XML-be exportálás után ezt jelzi: *2 szünetes tevékenység szünetek nélkül lett exportálva. Az MS Project és a P6 csak munkaeloszlásként ismeri a szüneteket.* Egy tevékenység esetén ez áll: *1 szünetes tevékenység szünetek nélkül lett exportálva. Az MS Project és a P6 csak munkaeloszlásként ismeri a szüneteket.* Lásd: [Tevékenység megszakítása](docs://howto-taak-splitsen).

**Ütemezés a *Rögzített dátumok* nézetben.** Ha CSV-be exportál, miközben a forrásfájl dátumait látja, az alkalmazás a `Critical` és a `Total Float` mezőt üresen hagyja azoknál a tevékenységeknél, amelyekre a forrásfájl ezt nem rögzítette. Lásd: [Rögzített dátumok](docs://uitleg-datums-zoals-opgeslagen).

## Lásd még

- [Fájlok és formátumok](docs://uitleg-bestanden): melyik formátum mit visz át és mit nem.
- [Fájl megnyitása és mentése](docs://howto-bestand-openen-en-opslaan): a projekt megtartása IFC-ként.
- [Előrehaladás importálása táblázatból](docs://howto-voortgang-importeren): egy kitöltött előrehaladási lap beolvasása.
- [Import- és exportformátumok](docs://ref-import-exportformaten): formátumonként, mi kerül át és mi nem.
