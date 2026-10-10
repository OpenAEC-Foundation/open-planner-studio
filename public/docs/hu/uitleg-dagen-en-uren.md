# Napok és órák

Egy 2 napos tevékenység és egy 16 órás tevékenység egyformának látszik, de az alkalmazás másként számítja ki őket. Miért választhat a napok és az órák között? És mi történik, ha egy órában megadott tevékenység egy napokban megadott tevékenységhez kapcsolódik? Ebben a cikkben megtudhatja, hogyan számolja az alkalmazás a napokat és az órákat, és hol kerekít. A kidolgozott példa mutatja a számokat.

## A fogalom

Egy **napalapú tevékenység** időtartama egész munkanapban van megadva, például `5d`. Teljes munkanapokat foglal el. A standard naptárban van kezdő- és befejezési dátuma, idő nélkül.

Egy **óraalapú tevékenység** időtartama munkaórában van megadva, például `12h` vagy `1h 30m`. Kezdete és befejezése pontos idővel szerepel, például kedd 11:00.

Az egység a tevékenységhez tartozik, nem a projekthez. Egy ütemezésben vegyesen használhat napalapú és óraalapú tevékenységeket. Ezt hívjuk **vegyes tervezésnek**.

Órákat olyan munkához használ, amely nem fér bele egész napokba: egy darut, amelyet tizenkét órára bérel, egy hat órán át tartó beöntést, vagy egy tevékenységet, amely csak ebéd után kezdhet. Minden másra elegendők a napok, és azok az egyszerűbbek.

Az **óraalapú tervezés** alapértelmezés szerint ki van kapcsolva. Amíg ki van kapcsolva, az alkalmazás napokban dolgozik. Ha egy fájl óraalapú tervezést is tartalmaz, például óraalapú tevékenységeket, akkor az alkalmazás ezt jelzi: *Ez a fájl óraalapú tervezést tartalmaz.* Ezeket a tevékenységeket továbbra is kiszámítja, de az időtartamukat csak akkor szerkesztheti, ha bekapcsolja az óraalapú tervezést.

## Hogyan számítja ki az alkalmazás

### Munkaidők és nettó órák

Minden naptárban vannak **idősávok** minden munkanapra (az alkalmazásban *idősáv* néven szerepelnek). A standard naptárban 07:00-tól 12:00-ig és 13:00-tól 16:00-ig tart a munkaidő. A rés a szünet. Az alkalmazás ezeket a sávokat a naptár *Kezdés (óra)*, *Befejezés (óra)* és szünet értékeiből számítja ki. Ehhez nem kell semmit beállítania. Ha hétköznaponként saját idősávokat állít be, azok élveznek elsőbbséget.

A napi nettó órák száma egy munkanap sávjainak összege. Ha a munkanapok hossza eltér, akkor a leggyakoribb napi összeg érvényes, és döntetlen esetén a legnagyobb. Négy 8 órás nap és egy 5 órás péntek esetén a napi nettó órák tehát 8.

### Tevékenység órákban

Az alkalmazás a kezdéstől számolja a munkaperceket, az idősávokon keresztül. Szünetek, esték, hétvégék és ünnepnapok nem számítanak. Egy 12 órás tevékenység ezért nem fér bele egy 8 órás munkanapba: átnyúlik a következő napra.

### Tevékenység napokban

Az alkalmazás egész munkanapokat számol. A napi órák nem játszanak szerepet. Egy 5 napos tevékenység ugyanazon a napon fejeződik be, akár 6, akár 8 óra van naponta a naptárban.

### Napok és órák átváltása

Egy nap a tevékenység naptárának napi nettó órái. Az alkalmazás ezt három helyen használja:

- Az *Időtartam megjelenítése* beállításhoz. A *Beállítások › Projekt › Beállítások* menüben, a *Megjelenés* lapon választhat: *Automatikus (tevékenységenként saját egység)*, *Mindig napok* vagy *Mindig órák*. Egy 18 órás tevékenység a *Mindig napok* beállításnál `2.25d(18h)` formában jelenik meg: a saját egység zárójelben marad.
- Órában megadott késleltetéshez napalapú tevékenység után (lásd *Kerekítés*).
- Ha átvált egy tevékenység egységét. Az alkalmazás ekkor a tevékenység kezdetétől számolja a napokat, mindegyiket a saját óráival, és csak akkor tesz javaslatot, ha az eredmény pontos. Két nap `16h` lesz. Olyan naptárban, ahol a péntek 5 órás, a hétfőtől számított 5 nap `37h` lesz. Tizenkét óra nem alakítható egész napokká 8 órás munkanapokat tartalmazó naptárban: az alkalmazás ekkor az egységet változatlanul hagyja.

### Napalapú és óraalapú tevékenységek együtt

A szabályok alább egy befejezés-kezdés kapcsolatra vonatkoznak, olyan naptárban, amelynek nincsenek saját idősávjai, mint a standard naptár.

- **Óra → óra.** Az utód abban a pillanatban kezdődik, amint az előd befejeződött, akkor is, ha ez a nap közepén van.
- **Óra → nap.** Egy napalapú tevékenység soha nem a nap közepén kezdődik. Az első munkanapon kezdődik, amely az óraalapú tevékenység befejezésének napját követi. A nap hátralévő része kihasználatlan marad, és az óraalapú tevékenység tartalékidejeként jelenik meg.
- **Nap → óra.** Egy napalapú tevékenység az utolsó napját teljesen elfoglalja. Az óraalapú tevékenység az ezt követő első munkanapon kezdődik, az első idősáv kezdetén.

### Kerekítés

Az alkalmazás négy helyen kerekít, vagy megtagad egy műveletet:

- **Napalapú tevékenység óraalapú tevékenység után** a következő munkanapon kezdődik. Az alkalmazás így mintegy egész napokra kerekíti felfelé az óraalapú tevékenységet.
- **Órában megadott késleltetés** a késleltetési naptárban számít, alapértelmezés szerint az előd naptárában. Ha az előd napalapú tevékenység, olyan naptáron, amelynek nincsenek saját idősávjai, mint a standard naptár, akkor az alkalmazás a késleltetést egész munkanapokra váltja át: a késleltetés osztva a napi nettó órákkal, egész számra kerekítve; a fél nap felfelé kerekít. 8 órás napoknál 1 óra 0 napnak számít, 4 óra 1 napnak és 12 óra 2 napnak. Ez akkor is érvényes, ha az utód óraalapú tevékenység. Ha az előd óraalapú tevékenység, vagy a naptárának saját idősávjai vannak, a késleltetés pontosan munkaórákban számít, és a szünet nem számít bele.
- **Időtartam napokban** mindig egész szám. Ha `1.5d` értéket ír be, az alkalmazás jelzi: *Adjon meg egész számú napot vagy órát, például 2d vagy 12h.* Az órában megadott időtartam lehet `1.5h`, vagy `1h 30m`.
- **Egység váltása** csak akkor történik meg, ha az eredmény pontos (lásd fent).

## Kidolgozott példa: a daru

A naptár munkanapjai hétfőtől péntekig vannak, 07:00-tól 12:00-ig és 13:00-tól 16:00-ig: napi 8 nettó óra. A projekt 2027. június 7-én, hétfőn kezdődik.

### Óra, óra és nap

*Place crane* 12 óráig tart. Hétfőn 8 munkaóra van (5 óra 12:00-ig és 3 a szünet után), kedden az utolsó 4 óra. A tevékenység hétfőn 07:00-kor kezdődik, és **június 8., kedd 11:00**-kor fejeződik be.

*Adjust elements* 8 óráig tart, és befejezés-kezdés kapcsolattal követi. Azonnal kedden 11:00-kor kezdődik: ez 1 óra a szünetig és 3 óra utána. Az utolsó 4 óra szerdán 07:00-tól 11:00-ig tart. A befejezés **június 9., szerda 11:00**.

*Finishing* 2 napig tart, és az *Adjust elements* után következik. Egy napalapú tevékenység nem kezdődik a nap közepén, ezért **június 10., csütörtökön** kezdődik, és június 11., pénteken fejeződik be.

### Kerekítés az átmenetnél

Ha kihagyja az *Adjust elements* tevékenységet, és a *Finishing* tevékenységet közvetlenül a *Place crane* tevékenységhez köti, a *Finishing* június 9-én, szerdán kezdődik, és június 10-én, csütörtökön fejeződik be. A kedd hátralévő része (4 munkaóra) nem használható fel. Ezt a 4 órát a *Place crane* teljes tartalékidejeként látja újra: fél munkanap.

Ha megfordítja a sorrendet, egyszerűbb lesz. A *Pour foundation* 2 napig tart, hétfőn, június 7-én kezdődik, és kedden, június 8-án fejeződik be. A *Place crane* most 4 óráig tart, és ezt követi. Szerdán, június 9-én 07:00-kor kezdődik, és 11:00-kor fejeződik be.

### Óra-késleltetés

A *Place crane* (12 óra) és az *Adjust elements* (8 óra) közé 2 órás késleltetést helyez. Az *Adjust elements* ekkor nem 11:00-kor, hanem kedden **14:00**-kor kezdődik: 1 óra a szünetig, és 1 óra utána. A befejezés **június 9., szerda 14:00**-ra tolódik.

Napalapú tevékenység után a késleltetés másként működik. A *Pour foundation* kedden, június 8-án fejeződik be. Késleltetés nélkül a *Finishing* szerdán, június 9-én kezdődik. Egy 4 órás késleltetés fél nap, és az alkalmazás felfelé kerekíti: a *Finishing* **június 10., csütörtökön** kezdődik. Egy 1 órás késleltetésnél az alkalmazás lefelé kerekít, és a *Finishing* egyszerűen szerdán kezdődik.

### Szabad péntek délután

Most a péntek csak egy idősávot tartalmaz, 07:00-tól 12:00-ig: 5 óra. A többi nap 8 órás marad. A napi nettó órák 8 maradnak, mert ez a leggyakoribb napi összeg. Egy hétnek most 37 munkaórája van.

Egy 40 órás tevékenység, amely június 7-én, hétfőn 07:00-kor kezdődik, hétfőtől csütörtökig tart (32 óra), és a péntek (5 óra). Az utolsó 3 óra a következő hétfőre esik, 07:00-tól 10:00-ig. A befejezés **június 14., hétfő, 10:00**. Egy 5 napos tevékenység hétfőtől 37 órát foglalna el, és ezt javasolja az alkalmazás, ha az 5 nap egységét órára váltja.

A 4. oktatóanyagban, az óraalapú tervezésről, saját maga tervezhet meg egy darus munkát órában.

## Következmények és félreértések

**„8 óra = 1 nap.”** Csak akkor igaz, ha a naptár 8 órás napokat tartalmaz. A szabad péntek délutánt tartalmazó naptáron 5 nap 37 óra, nem 40.

**„Ha naponta több órát állít be, a napalapú tevékenysége hamarabb fejeződik be.”** Nem. A napalapú tevékenység egész munkanapokat számol. A napi órák csak azt változtatják meg, mennyit ér egy nap órában, például a megjelenítésben és az órában megadott késleltetésnél. Csak erőforrással rendelkező tevékenységnél, a munkaszabály *Rögzített munka* vagy *Rögzített egységek* esetén változik az időtartam ezzel együtt, mert a munka ugyanaz marad: 40 órányi munka napi 8 órával 5 nap, napi 6 órával 7 nap.

**„Egy 8 órás tevékenység egy napig tart.”** Csak akkor, ha a nap elején kezdődik. Ha később kezdődik, például az *Adjust elements* kedden 11:00-kor, akkor átnyúlik a következő napra.

**Egy saját idősávokkal rendelkező naptár** másként működik, mint a standard naptár. Ilyen naptárat úgy kap, hogy hétköznaponként állít be munkaidőt, vagy műszakos előbeállítást választ (*2 műszak*, *3 műszak*, *Éjszakai műszak* vagy *24/7*). Ilyen naptáron az órában megadott késleltetés pontosan munkaórákban számít, napalapú tevékenység után is.

**Az óraalapú tervezés kikapcsolása** nem távolít el semmit. Az óraalapú tevékenységek megmaradnak, és az alkalmazás továbbra is kiszámítja őket, de nem szerkesztheti őket, amíg újra be nem kapcsolja az óraalapú tervezést.

## Lásd még

- [Óraalapú tervezés bekapcsolása](docs://howto-urenplanning-aanzetten): a lépések egy tevékenység órában történő megtervezéséhez.
- [Munkaidők beállítása](docs://howto-werktijden-instellen): a naptár idősávjainak módosítása.
- [Naptárak és munkanapok](docs://uitleg-kalenders): hogyan számolja az alkalmazás a munkanapokat, és melyik naptár érvényesül.
- [Kapcsolatok hozzáadása](docs://howto-relaties-leggen): a lépések egy kapcsolat vagy késleltetés hozzáadásához.
