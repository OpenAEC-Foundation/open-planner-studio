# Knižnica zdrojov

Vaša murárska parta nepracuje len pre jeden projekt. Dnes pracuje pri domoch na severe, zajtra pri garážach na juhu. Knižnica zdrojov je miesto, kde takú partu zapíšete raz, aby každý projekt používal tú istú partu. Aplikácia potom vidí aj to, kedy dva projekty žiadajú tých istých ľudí v ten istý deň. Žiadny jednotlivý projekt to nevidí. V tomto článku sa dozviete, ako spolu súvisia knižnica a projekt a ako aplikácia počíta obsadenosť naprieč projektmi.

## Koncept

Existujú dve vrstvy.

**Knižnica zdrojov** je zoznam zdrojov a kalendárov, ktoré patria vašej organizácii: murár, žeriav, omietkar, s ich typom, štandardnou sadzbou a počtom, koľko ich máte. Samotný zoznam, ktorý aplikácia nazýva aj **knižnica**, nie je v súboroch vášho projektu, ale v aplikácii. V desktopovej aplikácii je v súbore na tomto počítači. V prehliadači je v úložisku tohto prehliadača. Ak v prehliadači vymažete údaje webovej lokality, knižnica zmizne. Preto ju exportujte ako zálohu. Vždy je aspoň jedna knižnica. Prvá sa volá *Mijn resourcebibliotheek* (holandský názov) a môžete ju premenovať.

**Projekt** rozhoduje, koľko zdroja používa a kedy. Projekt je prepojený s jednou knižnicou alebo stojí samostatne. Samostatný projekt funguje dobre, len bez spoločného zoznamu.

Projekt neukazuje na knižnicu, ale ukladá si **kópiu**. Keď priradíte *Bricklayer* z knižnice k projektu, aplikácia vytvorí v projekte kópiu s **pôvodným označením**. Je to poznámka, že táto kópia pochádza z knižnice X a je v nej položkou Y. V tabuľke zdrojov spoznáte takú kópiu podľa malej ikony knižnice. Kópia je bežný zdroj: dajú sa jej priradiť úlohy a uloží sa priamo v súbore projektu.

Kalendáre v knižnici zdrojov sú niečo iné než zoznam kalendárov vášho projektu. Ten spravujete v dialógovom okne kalendára. Kalendár z knižnice sa dostane do projektu spolu so zdrojom, ktorý ho používa.

## Ako s tým aplikácia pracuje

### Čo rozhoduje knižnica a čo projekt

Knižnica rozhoduje o **tom, čo zdroj je**: o názve, type, štandardnej sadzbe za hodinu, mernej jednotke a popise. V kópii v projekte sa tieto polia zobrazujú ako obyčajný text. Zmeníte ich v knižnici, aby boli správne vo všetkých projektoch. Ak chcete, aby kópia predsa išla vlastnou cestou, odpojte ju od knižnice.

Projekt rozhoduje o **koľko a kedy**: o poliach *Maximálny počet jednotiek*, o kapacite, ktorá sa mení v čase (*Časovo fázovaná kapacita*), a o tom, ktorý kalendár zdroj má. Tieto polia zostanú v projekte upraviteľné a nepovažujú sa za odchýlku od knižnice. Tá istá parta môže predsa pri urgentnej zákazke bežať na inom kalendári než pri bežnom projekte. Obsah kalendára, ktorý prišiel so zdrojom, však knižnicu nasleduje.

### Kedy kópia nasleduje zmeny

Knižnica neaktualizuje kópie nepretržite, ale v pevne určených okamihoch:

- Keď upravíte niečo v knižnici, nezmenené kópie vo všetkých otvorených projektoch okamžite nasledujú zmenu.
- Keď otvoríte projekt alebo prepnete na inú kartu, aplikácia porovná kópie s knižnicou. Ak je nezmenená kópia pozadu, aplikácia ju potichu aktualizuje a krátko to oznámi: *1 položka aktualizovaná z knižnice* alebo *N položiek aktualizovaných z knižnice*.

Aplikácia si pamätá hodnoty z okamihu, keď sa kópia vytvorila alebo aktualizovala. Ak sa kópia od nich teraz líši, aplikácia nerozhoduje, kto má pravdu. Kópia potom dostane značku *sa líši — rozhodnite*. Keď otvoríte súbor s takouto kópiou, okno *Prepojiť knižnicu zdrojov* sa otvorí samo. Tam vyberiete pre každú položku, či platia hodnoty z knižnice, alebo či sa hodnoty z vášho súboru dostanú do knižnice. Pri prepínaní kariet sa nikdy neotvorí žiadne okno.

Odchýlka vznikne napríklad vtedy, keď prepojíte vlastný zdroj v projekte s položkou knižnice s rovnakým názvom, ale inými hodnotami, pomocou *Presunúť do knižnice*. Aplikácia ich naozaj prepojí a kópiu hneď označí ako odchýlenú.

### Kedy zdroj zmizne z knižnice

Ak zdroj z knižnice odstránite, kópia zostane vo vašich projektoch a ďalej funguje. Dostane značku *už nie je v knižnici*. Potom ju môžete upraviť úplne alebo ju odstrániť z projektu.

### Obsadenosť naprieč projektmi

Histogram a preťaženie v projekte sa pozerajú len na tento jeden projekt. Knižnica vie viac: koľko kusov zdroja je celkovo. Pohľad *Obsadenosť* sčítava na každý deň zaťaženie všetkých otvorených projektov, ktoré sú prepojené s rovnakou knižnicou a používajú kópiu tohto zdroja. Ak je súčet na deň väčší než kapacita knižnice, tento deň sa počíta ako deň s preťažením.

Tri pravidlá rozhodujú o tom, čo sa počíta:

- Kapacita pochádza z knižnice (hodnota *Maximálny počet jednotiek* položky knižnice, alebo jej *Časovo fázovaná kapacita* v ten deň), nie z hodnoty *Maximálny počet jednotiek* kópie v projekte. Dva projekty, z ktorých každý sa drží svojho pridelenia, preto môžu spolu stále žiadať príliš veľa.
- Súčet, ktorý sa presne rovná kapacite, nie je konflikt. Musí sa žiadať viac, než je kapacita.
- Počítajú sa len kópie s pôvodným označením a len v projektoch, ktoré sú v tej chvíli otvorené v tejto aplikácii. Vlastný zdroj jedného projektu nie je v knižnici, preto sa nepočíta. Prehľad nevidí dokumenty, ktoré sa neotvorili v tejto aplikácii. To je uvedené aj v spodnej časti samotného prehľadu.

## Príklad: murárska parta v dvoch projektoch

Knižnica obsahuje zdroj *Bricklayer* s hodnotou *Maximálny počet jednotiek* 3: tri murári na mzdovej listine. Dva projekty ho používajú, oba s kópiou, ktorá má hodnotu *Maximálny počet jednotiek* 2.

- Projekt *Houses North* má úlohu *Bricklaying facades* v trvaní 5 pracovných dní od pondelka 7. júna 2027, s 2 jednotkami priradenia za deň. Úloha beží od 7. do 11. júna vrátane.
- Projekt *Garages South* má úlohu *Bricklaying garages* v trvaní 4 pracovné dni od stredy 9. júna 2027, s 2 jednotkami priradenia za deň. Víkend sa nepočíta, takže úloha pokrýva 9., 10., 11. a 14. júna.

V každom projekte sa murár žiada o 2 zo svojich 2 jednotiek priradenia. Ani jeden projekt nehlási preťaženie: pod *Zdroje › Preťaženie* oba hovoria *Žiadne*. Spolu však prekračujú kapacitu 3 murárov. Aplikácia počíta na každý deň:

- Pondelok 7. a utorok 8. júna: 2 (len *Houses North*)
- Streda 9., štvrtok 10. a piatok 11. júna: 2 + 2 = 4
- Pondelok 14. júna: 2 (len *Garages South*)

Špička je 4 oproti kapacite 3. Prehľad ukazuje, že murár má *2 dokumenty*, obdobie *2027-06-07 – 2027-06-14*, *4.0 / 3.0* pre špičku a kapacitu a *3 dni s preťažením*: 9., 10. a 11. júna.

Čo ak niečo zmeníte:

- Ak *Bricklaying facades* trvá 6 pracovných dní, beží do pondelka 14. júna. Aj ten deň dosiahne 2 + 2 = 4, takže prehľad hlási *4 dni s preťažením*: 9., 10., 11. a 14. júna. Špička zostane 4.
- Ak knižnica má hodnotu *Maximálny počet jednotiek* 4, prehľad ukazuje *4.0 / 4.0* a nie je tam žiadny konflikt, lebo súčet nie je väčší než kapacita.
- Ak *Garages South* pracuje s 1 jednotkou priradenia za deň namiesto 2, špička je 3 a prehľad ukazuje *3.0 / 3.0*: žiadny konflikt.
- Ak *Garages South* začne až v pondelok 14. júna, projekty sa neprekrývajú. Obdobie sa zmení na *2027-06-07 – 2027-06-17* a špička je *2.0 / 3.0*.

Kroky, ako to pozrieť vo vlastných projektoch, sú v článku [Používanie prehľadu obsadenosti](docs://howto-bezettingsoverzicht-gebruiken).

## Dôsledky a mylné predstavy

**„Knižnica je zdieľaná s mojimi kolegami.“** Nie. Knižnica žije v aplikácii (v desktopovej aplikácii v súbore na tomto počítači, v prehliadači v úložisku tohto prehliadača) a nesynchronizuje sa. Ak dvaja plánovači pracujú s tou istou knižnicou zdrojov, ich knižnice sa môžu rozchádzať. Zdieľať môžete exportom a importom, pozrite [Správa a zdieľanie knižníc zdrojov](docs://howto-bibliotheken-beheren). Ak vaša organizácia zdieľa party medzi prevádzkovými spoločnosťami, zvoľte vedome jednu spoločnú knižnicu. Prehľad tiež vidí len projekty, ktoré sú otvorené v tejto aplikácii.

**„Ak zmením knižnicu, všetko v mojich projektoch sa zmení.“** Mení sa len identita zdroja: názov, typ, štandardná sadzba, merná jednotka a popis. *Maximálny počet jednotiek*, kapacita v čase a voľba kalendára projektu zostávajú, ako sú.

**„Zmenu v knižnici môžem vrátiť späť.“** Nie. Knižnica patrí aplikácii, nie projektu, takže zmeny v nej sú mimo *Vrátiť späť* (Ctrl+Z). Pohľad *Knižnica* na to upozorňuje sám: *Toto upravuje knižnicu a platí pre všetky projekty. Nedá sa vrátiť späť*. Odstránenie z knižnice tiež vyžaduje potvrdenie a nedá sa vrátiť späť.

**„Prehľad obsadenosti rieši preťaženie.“** Nie, prehľad je len okno iba na čítanie. Ukazuje, v ktoré dni dva projekty spolu žiadajú príliš veľa. Vyvažovanie (*Zdroje › Vyvažovanie › Vyvažovať…*, pozrite [Vyvažovanie zdrojov](docs://uitleg-nivelleren)) sa pozerá na zdroje jedného projektu a ostatné projekty nezohľadňuje. Presuňte úlohu v jednom z projektov sami, alebo zmeňte kapacitu v knižnici, ak sa naozaj pridá niekto ďalší.

**„Môj vlastný zdroj sa počíta do obsadenosti.“** Len ak je v knižnici. Zdroj, ktorý ste vytvorili len v projekte, napríklad prenajatý žeriav pre jednu zákazku, nemá pôvodné označenie, a preto nie je v prehľade. Pomocou *Presunúť do knižnice* ho pridáte.

## Pozri tiež

- [Používanie knižnice zdrojov](docs://howto-resourcebibliotheek-gebruiken): prepojenie, priraďovanie zdrojov a riešenie odchýlok.
- [Správa a zdieľanie knižníc zdrojov](docs://howto-bibliotheken-beheren): vytváranie, exportovanie a importovanie knižníc.
- [Používanie prehľadu obsadenosti](docs://howto-bezettingsoverzicht-gebruiken): hľadanie preťažení naprieč projektmi.
- [Správa zdrojov](docs://howto-resources-beheren): zdroje jedného projektu.
