# Az erőforrástár használata

Cél: erőforrások használata az erőforrástárból a projektben, és a projektben létrehozott erőforrás felvétele az erőforrástárba, hogy minden projekt ugyanazokat az adatokat használja.

## Mikor van erre szükség

Önnek van egy állandó falazócsapata, egy daruja és egy vakolója, amelyek több projektben is szerepelnek. Erőforrástár nélkül minden projektben újra be kell írnia őket. Így eltérő nevek és alapdíjak is kerülhetnek be, és egyik projekt sem látja, hogy egy másik projekt ugyanezt a csapatot is igényli. Az erőforrástárban egyszer rögzíti őket.

Hogy mi az erőforrástár, és mit vesz át belőle egy projekt, azt a [Az erőforrástár](docs://uitleg-resourcebibliotheek) című részben olvashatja el. Ez a cikk a műveletekkel foglalkozik. Az erőforrástárak létrehozása, exportálása és törlése a [Erőforrástárak kezelése és megosztása](docs://howto-bibliotheken-beheren) részben található.

## Lépések

### 1. A projekt összekapcsolása erőforrástárral

Az erőforrástárral csak akkor dolgozhat, ha a projekt össze van kapcsolva vele. Összekapcsolás nélkül az *Erőforrások* panel nem mutatja az *Erőforrástár*, *Projekt* és *Foglaltság* kapcsolót.

Új projekt esetén:

1. Válassza a *Fájl › Új* lehetőséget. Megnyílik az *Új projekt* ablak.
2. Nézze meg az *Erőforrástár* mezőt. A mező az alapértelmezett erőforrástárra van állítva. Választhat másikat, a *nincs erőforrástár (önálló projekt)* lehetőséget vagy a *+ Új erőforrástár…* lehetőséget.
3. Kattintson a *Létrehozás* gombra.

Meglévő projekt esetén:

1. Válassza a *Fájl › Projektinfó* lehetőséget.
2. Az *Erőforrástár* résznél válassza ki a kívánt erőforrástárat.
3. Kattintson az *Alkalmazás* gombra. Addig az ablak alján ez áll: *A módosítások nincsenek alkalmazva — a megtartásukhoz kattintson erre: Alkalmazás.*

Ha a projektben már van olyan erőforrás, amelynek neve megegyezik egy erőforrástár-elem nevével, megnyílik az *Erőforrástár összekapcsolása* ablak a *Felismert* szakasszal. Minden olyan erőforrásnál, amelynek van egyezése, ez áll: *Javaslat: Bricklayer*. Kattintson az *Összekapcsolás* gombra, ha csak ezt az egyet szeretné összekapcsolni. Ha több javaslat van, kattintson az *Összes javaslat összekapcsolása* gombra. Az alkalmazás figyelmen kívül hagyja a nagy- és kisbetűket és a dupla szóközöket, amikor a neveket összehasonlítja. Összekapcsoláskor az erőforrás átveszi az erőforrástár-elem nevét, típusát, alapdíját, mértékegységét és leírását. A *Maximális mennyiség* a projektben megadott érték marad. Az ablakban a projekt azon naptárai is megjelennek, amelyek neve megegyezik egy erőforrástár-naptár nevével. A *Döntés később* gombbal összekapcsolás nélkül zárja be az ablakot.

### 2. Erőforrás felvétele az erőforrástárba

1. Válassza az *Erőforrások › Kezelés › Erőforrások* lehetőséget. Az erőforráspanel átveszi a munkaterületet. Mindig a *Projekt* nézettel nyílik meg, összekapcsolt projekt esetén is.
2. Jobb felül válassza az *Erőforrástár* lehetőséget. A táblázat fölött ez áll: *Ez az erőforrástárat szerkeszti, és az összes projektre hat — ez nem vonható vissza.*
3. Kattintson az *Új erőforrás az erőforrástárban* gombra. A táblázat alján egy üres sor jelenik meg.
4. Írja be a nevet, például a *Bricklayer* nevet, majd nyomja meg az Enter billentyűt. Az erőforrás most már az erőforrástárban van, és azonnal megnyílik egy üres sor a következő erőforrásnak. Ha végzett, nyomja meg az Esc billentyűt. Név nélkül az alkalmazás nem hoz létre semmit.
5. Töltse ki a sor többi mezőjét. A *Típus* alapértelmezés szerint *Munkaerő*. A *Maximális mennyiség* mezőben adja meg, hogy összesen hány ebből az erőforrásból van, például 3, ha három falazója van. A foglaltság-áttekintés ezt a számot használja kapacitásként. Az *Alapdíj/óra* mező nem kötelező. A *Mértékegység* mezőt csak *Anyag* típusnál tudja kitölteni. A *Naptár* mezőben a tárból választhat naptárat, vagy a *+ Erőforrásnaptár* lehetőséggel készíthet egyet, lásd: [Erőforrásnaptár beállítása](docs://howto-resourcekalender-instellen). Az alkalmazás a nevet, az alapdíjat és a mértékegységet akkor menti, amikor elhagyja a mezőt, a többi mezőt pedig azonnal menti.

Az erőforrástár minden változása azonnal átvezetődik a megnyitott projektekben lévő, nem módosított másolatokba.

### 3. Erőforrás hozzárendelése a projekthez

1. Az *Erőforrástár* nézetben válassza a *Hozzárendelés a projekthez* lehetőséget az erőforrás sorában. A táblázat fölött ez áll: *Hozzáadva.* Ha ismét rákattint, ez áll: *Már benne van a projektben.*, és nem jelenik meg második másolat.
2. Válassza a *Projekt* lehetőséget. A másolat ott van a táblázatban. A neve mellett kis erőforrástár-ikon látható, a jelölés neve *Az erőforrástárból*. A név, a típus, az alapdíj és a mértékegység egyszerű szövegként jelenik meg. Ha az egérmutatót föléjük viszi, ez jelenik meg: *Erőforrástár-érték — szerkessze az Erőforrástár nézetben, vagy válassza le ezt az erőforrást az erőforrástárról.*
3. Állítsa be a *Maximális mennyiség* értéket ehhez a projekthez. A mező az erőforrástárból átvett értékkel indul, és a projektben szerkeszthető marad.
4. Most rendelje hozzá az erőforrást a tevékenységekhez, ahogy minden más erőforrást, lásd: [Erőforrás hozzárendelése görbével](docs://howto-resource-toewijzen). Az *Erőforrások › Hozzárendelés › Hozzárendelés* lehetőség csak azokat az erőforrásokat mutatja, amelyek már benne vannak a projektben. Ezért előbb rendelje hozzá az erőforrástárból származó erőforrást a projekthez ezen a módon.

A *Hozzárendelés a projekthez* csak olyan projekt *Erőforrástár* nézetében létezik, amely össze van kapcsolva azzal az erőforrástárral.

### 4. Erőforrás felvétele a projektből az erőforrástárba

Ezt olyan erőforrásnál teheti meg, amelyet a projektben hozott létre, és gyakrabban használja, például egy bérelt darunál.

1. A *Projekt* nézetben válassza a *Felvétel az erőforrástárba* lehetőséget az erőforrásnál. A gomb csak olyan erőforrásnál jelenik meg, amelynek van neve, és amely még nem az erőforrástárból származik, összekapcsolt projektben.
2. Olvassa el a táblázat fölötti üzenetet.

Az üzenet három dolgot mondhat:

- *Hozzáadva.* Az erőforrástárban nem volt az adott nevű elem. Új elem jött létre, és az alkalmazás az erőforrást ehhez az elemhez kapcsolta.
- *Már szerepelt az erőforrástárban — most hozzá lett kapcsolva.* Volt olyan elem, amelynek ugyanaz a neve és ugyanazok az adatai. Az alkalmazás ehhez kapcsolta az erőforrást.
- *A meglévő erőforrástár-elemhez lett kapcsolva — az értékek eltérnek, lásd a jelölést.* Volt olyan elem, amelynek ugyanaz a neve, de eltérő adatai vannak. Az erőforrás össze van kapcsolva, és azonnal megkapja az *eltér — döntsön* jelölést. Folytassa a 6. lépéssel.

### 5. Másolat leválasztása

Ha egy projektben el szeretne térni az erőforrástártól, például eltérő alapdíjjal, leválasztja a másolatot.

1. A *Projekt* nézetben kattintson a sor végén lévő *Leválasztás az erőforrástárról* ikonra.
2. Az erőforrás ezután normál projekterőforrás. Minden mező szerkeszthető, és már nem követi az erőforrástárat. Az erőforrással együtt átvett naptár is leválasztódik, kivéve, ha a projekt egy másik erőforrása még követi.

A *Visszavonás* (Ctrl+Z) gombbal vonja vissza a leválasztást.

### 6. Eltérés megoldása

Az a másolat, amelyen az *eltér — döntsön* jelölés áll, eltér az erőforrástár-elemtől. Az alkalmazás nem dönti el, melyik a helyes.

1. Kattintson az erőforráson lévő *eltér — döntsön* jelölésre. Megnyílik az *Erőforrástár összekapcsolása* ablak. Az ablak akkor is magától megnyílik, ha olyan másolatot tartalmazó fájlt nyit meg.
2. Az *Eltérések* szakaszban válassza ki, mit szeretne az elemmel kapcsolatban, lásd alább.
3. Ha még nem szeretne választani, kattintson a *Döntés később* gombra. Az ablak bezárul, és a jelölés megmarad.

Eltérés esetén két lehetősége van:

- *Erőforrástár-értékek használata*: a másolat megkapja az adatokat az erőforrástárból.
- *Fájlértékek átvétele az erőforrástárba*: az erőforrástár megkapja az adatokat a másolatából. Alatta ez áll: *Figyelem: ez módosítja az erőforrástárat, és az összes projektjére vonatkozik.* A más megnyitott projektekben lévő másolatok ezt követik.

## Buktatók, és mit tesz ilyenkor az alkalmazás

**A példaprojektekhez saját erőforrástár tartozik.** Ha a három bemutató példa egyikét nyitja meg (*Fájl › Példák*, vagy a Súgó egyik hivatkozásán keresztül), az alkalmazás egyszer létrehozza a *Demo erőforrástár* nevű erőforrástárat, és összekapcsolja vele a projektet. Az olyan projekterőforrások, amelyek neve megegyezik egy erőforrástár-elem nevével, azonnal össze lesznek kapcsolva. A naptárak nem. A saját erőforrástárai érintetlenek maradnak. Ha két bemutatót egymás mellett nyit meg, együtt ütközéseket mutatnak a [Foglaltság-áttekintés használata](docs://howto-bezettingsoverzicht-gebruiken) részben, például a falazócsapatnál (*Masonry crew*) a *Refurbishment & Extension of a Family Home* és a *6 New Terraced Houses, De Akkers* projekt között.

**Nem látja a kapcsolót.** A projekt nincs erőforrástárhoz kapcsolva. Végezze el az 1. lépést.

**Véletlenül az erőforrástárat szerkeszti.** Ennek megelőzésére a panel mindig a *Projekt* nézetben nyílik meg. Az *Erőforrástár* nézetben végzett módosítások az összes projektre hatnak, és a *Visszavonás* nem vonja vissza őket.

**Erőforrást töröl az erőforrástárból.** Az alkalmazás először megkérdezi: *Eltávolítja a(z) „Bricklayer” erőforrást az erőforrástárból? Ez az összes projektre vonatkozik, és nem vonható vissza.* A projektekben lévő másolatok megmaradnak, és tovább működnek. Megkapják a *már nincs az erőforrástárban* jelölést, és teljesen szerkeszthetők. Az *Eltávolítás a projektből* gombbal kiveheti a másolatot a projektből.

**Az Erőforrástár résznél másik erőforrástárat vagy a *nincs erőforrástár (önálló projekt)* lehetőséget választja.** Az előző erőforrástár eredetjelölései eltűnnek. Az erőforrások a projektben normál projekterőforrásként maradnak meg. Másik erőforrástár esetén az alkalmazás újra megkeresi az azonos nevű erőforrásokat.

**Egy erőforrásnál nincs javaslat a *Felismert* szakaszban.** Ez áll rajta: *Nincs javaslat — válassza ki kézzel*, de ennek az ablaknak nincs erre gombja. Ez hiányosságnak tűnik. Vegye fel az ilyen erőforrást az erőforrástárba a *Felvétel az erőforrástárba* lehetőséggel (4. lépés).

## Lásd még

- [Az erőforrástár](docs://uitleg-resourcebibliotheek): mit dönt el az erőforrástár, mit dönt el a projekt, és hogyan követik a másolatok az erőforrástárat.
- [Erőforrástárak kezelése és megosztása](docs://howto-bibliotheken-beheren): erőforrástárak létrehozása, exportálása és importálása.
- [Foglaltság-áttekintés használata](docs://howto-bezettingsoverzicht-gebruiken): annak megnézése, hogy két projekt egyszerre kéri-e ugyanazt az erőforrást.
- [Erőforrások kezelése](docs://howto-resources-beheren): egy projekt erőforrásai.
