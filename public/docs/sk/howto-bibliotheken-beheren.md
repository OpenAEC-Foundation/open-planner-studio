# Správa a zdieľanie knižníc zdrojov

Cieľ: vytvárať a odstraňovať knižnice zdrojov, vkladať do nich kalendáre a exportovať alebo importovať knižnicu. Môžete to urobiť ako zálohu alebo na použitie na inom počítači.

## Kedy to potrebujete

Knižnica nie je v súboroch vášho projektu, ale v aplikácii. V počítačovej aplikácii je v súbore na tomto počítači. V prehliadači je v úložisku tohto prehliadača. Nesynchronizuje sa. Ak v prehliadači vymažete údaje stránky, knižnica zmizne. Preto ju exportujte ako zálohu. Ak chce kolega pracovať s rovnakými tímami a štandardnými sadzbami, odovzdajte mu knižnicu aj ako súbor. Ak má vaša organizácia niekoľko prevádzkových spoločností s vlastnými tímami, vytvorte pre každú samostatnú knižnicu. Pre nový projekt vyberiete, ktorú knižnicu použije.

Čo knižnica je, prečítate v článku [Knižnica zdrojov](docs://uitleg-resourcebibliotheek). Samotné zdroje tu neupravujete, ale v paneli zdrojov. Pozrite [Používanie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken).

## Postup

### Otvorte obrazovku správy

Vyberte *Súbor › Knižnica*. Vľavo je zoznam *Knižnice zdrojov*. Vpravo sú podrobnosti knižnice, na ktorú kliknete: názov, tlačidlá a zoznam *Kalendáre*. Hore je text, že zdroje spravujete na karte *Zdroje*.

### Vytvorenie, premenovanie a výber predvolenej knižnice

1. Kliknite na znamienko plus nad zoznamom (*Pridať knižnicu zdrojov*). Pridá sa knižnica *Nová knižnica zdrojov* a hneď sa vyberie.
2. Napíšte nový názov do poľa názvu hore v pravej časti a stlačte Enter. Môžete tiež kliknúť mimo poľa. Aplikácia neprijme prázdny názov.
3. Kliknite na *Nastaviť predvolenú*. Táto knižnica sa odteraz vopred vyberie pre nové projekty. Predvolená knižnica má v zozname hviezdičku.

### Pridanie kalendára do knižnice

1. V časti *Kalendáre* kliknite na *Pridať z projektu*. Otvorí sa zoznam kalendárov vášho aktívneho projektu.
2. Kliknite na malú šípku za kalendárom, ktorý chcete prevziať. Nad zoznamom sa zobrazí *Pridané.* Kalendár, ktorý je už prepojený s touto knižnicou, má za názvom *už prepojené*.
3. Kalendár je teraz v zozname *Kalendáre* knižnice. Ikonou ceruzky (*Upraviť*) zmeníte názov a uložíte ho ikonou začiarknutia. Ikona koša odstráni kalendár okamžite, bez potvrdenia. Kópie v projektoch zostanú.

Za nadpisom *Kalendáre* je číslo verzie, napríklad *v2*. Číslo sa zvýši pri každej zmene knižnice. Kalendár knižnice sa prenesie do projektu vždy, keď priradíte zdroj, ktorý ho používa. Pripojíte ho k zdroju na karte *Zdroje*, v zobrazení *Knižnica*, v stĺpci *Kalendár*.

### Export knižnice

1. Vyberte knižnicu v zozname.
2. Kliknite na *Exportovať*.
3. V počítačovej aplikácii a v prehliadačoch Chrome a Edge vyberiete, kam sa súbor uloží. V iných prehliadačoch sa súbor uloží priamo do priečinka pre stiahnuté súbory a aplikácia vás o tom informuje. Súbor sa volá `bibliotheek-` a za ním názov knižnice, s príponou `.ifc`.

Pod tlačidlami je text *Export je zároveň vaša záloha: uchovajte súbor na bezpečnom mieste.*

### Import knižnice

1. Kliknite na *Importovať*. Otvorí sa okno *Importovať knižnicu* pre knižnicu, ktorú ste vybrali v zozname.
2. Kliknite na *Vybrať súbor…* a vyberte súbor `.ifc` z exportu. Ak súbor neobsahuje knižnicu, zobrazí sa text *Tento súbor IFC neobsahuje knižnicu zdrojov.*
3. Aplikácia ukáže, čo súbor obsahuje, napríklad *Kalendáre: 2, zdroje: 5 (verzia 3).*
4. Vyberte, čo so súborom chcete urobiť. Pozrite nižšie.
5. Kliknite na *Pridať* alebo *Nahradiť*. Ak chcete import zastaviť, kliknite na *Zrušiť*.

Máte dve možnosti:

- *Pridať ako novú knižnicu zdrojov*: súbor sa stane samostatnou knižnicou vedľa vašich existujúcich knižníc. Pod tým je text, pod akým názvom, napríklad *Pridá sa ako „Mijn resourcebibliotheek (2)“.* Nič sa nestratí a váš aktívny projekt zostane prepojený so svojou vlastnou knižnicou.
- *Nahradiť existujúcu knižnicu zdrojov*: celý obsah vybranej knižnice sa nahradí obsahom zo súboru. Aj to je uvedené: *Import nahradí CELÝ spoločný zoznam vybranej knižnice zdrojov.* Ak máte dve alebo viac knižníc, vyberiete, ktorú z nich, v poli *Importovať do knižnice zdrojov*. Ak je vaša knižnica novšia ako súbor, aplikácia upozorní: *Vaša lokálna knižnica je novšia. Import môže prepísať vaše zmeny.*

Aplikácia navrhne voľbu sama. Ak súbor obsahoval predvolenú knižnicu, je vopred vybraté *Pridať ako novú knižnicu zdrojov*. Ak knižnica zo súboru už existuje vo vašom počítači a nie je predvolená, je vopred vybraté *Nahradiť existujúcu knižnicu zdrojov* a presne táto knižnica. Ak si nie ste istí, zvoľte pridanie: tým sa nič neprepíše.

### Odstránenie knižnice

1. Vyberte knižnicu v zozname a kliknite na *Odstrániť knižnicu zdrojov*. Tlačidlo je sivé pri poslednej knižnici, pretože vždy zostane aspoň jedna.
2. Potvrďte tlačidlom *Odstrániť*. Otázka je *Odstrániť túto knižnicu zdrojov?* Ak sú k nej pripojené otvorené projekty, zobrazí sa text *Táto knižnica zdrojov je prepojená s 1 otvoreným projektom. Odstránením sa tento projekt odpojí. Pokračovať?* Pri viacerých projektoch je text rovnaký s počtom, napríklad *prepojená s 2 otvorenými projektmi*.

Knižnica sa potom odstráni spolu so všetkými zdrojmi a kalendármi v nej. Otvorené projekty, ktoré ju používali, sa odpoja. Ich zdroje zostanú ako bežné zdroje projektu. Ak chcete obsah zachovať, najskôr ho exportujte.

### Odovzdanie projektu spolu s knižnicou

Súbor projektu obsahuje vlastné kópie zdrojov. Ak chcete odovzdať celú knižnicu, postupujte takto. Samotný export je opísaný aj v článku [Exportovanie](docs://howto-exporteren).

1. Otvorte projekt, ktorý je prepojený s knižnicou, a vyberte *Súbor › Export*.
2. Zaškrtnite *Uložiť súbor knižnice vedľa*. Políčko je k dispozícii iba pri prepojenom projekte.
3. Vyberte kartu *IFC 4x3* a uložte súbor. Aplikácia potom vyžiada aj druhý súbor. Ten má názov ako projekt a za ním `-bibliotheek`, a obsahuje knižnicu.

Políčko funguje iba pri exporte IFC, nie pri ostatných formátoch exportu. Váš kolega importuje druhý súbor, ako je opísané vyššie.

## Úskalia a čo vtedy aplikácia urobí

**Dvaja plánovači, dve knižnice.** Aplikácia nesynchronizuje knižnice medzi počítačmi. Okno importu o tom vždy zobrazí upozornenie: *Poznámka: knižnice sa medzi počítačmi nesynchronizujú. Ak dvaja plánovači pracujú s rovnakou knižnicou zdrojov, knižnice sa môžu rozísť. Ak vaša organizácia zdieľa tímy medzi prevádzkovými spoločnosťami, zvoľte vedome jeden spoločný zoznam.*

**Nahradenie prepíše všetko.** Všetko, čo bolo vo vybranej knižnici, sa stratí. Zmenu knižnice nemožno vrátiť pomocou *Vrátiť späť*. Ak si nie ste istí, najskôr exportujte.

**Odstránenie kalendára zo zoznamu prebehne okamžite.** Aplikácia nežiada o potvrdenie, na rozdiel od odstránenia zdroja. To vyzerá ako nedostatok. Zmeny knižnice nemožno vrátiť pomocou *Vrátiť späť*.

## Pozri tiež

- [Knižnica zdrojov](docs://uitleg-resourcebibliotheek): ako súvisia knižnica a projekt.
- [Používanie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken): prepojenie zdrojov, ich priraďovanie a riešenie odchýlok.
- [Exportovanie](docs://howto-exporteren): formáty exportu vrátane IFC so súborom knižnice.
