# Oprávnenia rozšírení

Všetky oprávnenia, ktoré môže rozšírenie uviesť v svojom manifeste: čo povoľujú, čo sa stane, keď chýbajú, a čo z nich uvidíte pri inštalácii rozšírenia. Ako rozšírenie nainštalujete a spravujete, je opísané v článku [Inštalácia a správa rozšírenia](docs://howto-extensie-installeren).

## Čo je a čo nie je oprávnenie

Oprávnenie je **vyhlásenie autora**: ktoré časti rozhrania aplikácie chce rozšírenie používať. Nie je to bariéra. Kód rozšírenia beží v rovnakom prostredí ako samotná aplikácia. Preto môže robiť viac, než uvádzajú jeho oprávnenia: neexistuje žiadny sandbox. Aplikácia to hovorí aj v okne inštalácie. Inštalujte len rozšírenia od autorov, ktorým dôverujete.

Aplikácia vynucuje oprávnenie jedným z troch spôsobov. Rozdiel je dôležitý:

**Prísne vynucované.** Ak oprávnenie chýba, príslušná metóda vyhodí chybu (v holandčine, napríklad *Extensie „…“ mist permissie: ribbon*), skôr než sa čokoľvek stane.

**Upozornenie.** Ak oprávnenie chýba, metóda funguje ďalej, ale aplikácia zapíše upozornenie do protokolu. V budúcej verzii sa z toho stane odmietnutie.

**Len informatívne.** Oprávnenie nie je spojené so žiadnou časťou rozhrania. Aplikácia ho zobrazí pri inštalácii a inak s ním nič nerobí.

Na základnú časť rozhrania rozšírenia nie je potrebné žiadne oprávnenie: čítanie projektu, kalendára, úloh, závislostí, zdrojov a priradení; pridávanie úloh a závislostí a úprava úloh; načítanie projektu, prepočítanie a zlúčenie niekoľkých zmien; ukladanie vlastných nastavení, čítanie vlastných priložených súborov a zobrazenie oznámenia.

**Manifest.** Oprávnenia sú v manifeste ako zoznam. Rozšírenie, ktoré nainštalujete teraz s oprávnením, ktoré táto verzia aplikácie nepozná, sa odmietne. Pri už uloženom staršom rozšírení aplikácia neznáme oprávnenia vynechá a zapíše to do protokolu.

## Ako sa aplikácia pýta

Pri inštalácii z katalógu (*Súbor › Rozšírenia › Prehľadávať › Nainštalovať*) alebo zo súboru (*ZIP* alebo *JS*) zobrazí aplikácia okno *Nainštalovať rozšírenie?*. Otázka sa zobrazí raz, pri inštalácii. Nie zakaždým, keď rozšírenie zapnete.

Okno ukazuje názov, verziu, popis, autora a, ak existuje, úložisko. V časti *Pôvod* je uvedené, odkiaľ rozšírenie pochádza (*Z online katalógu rozšírení*, *Zo súboru ZIP v tomto počítači* alebo *Zo súboru JavaScript v tomto počítači*), a či bolo sťahovanie overené: kontrolným súčtom z katalógu, neoverené, lebo katalóg žiadny nedáva, alebo súbor, ktorý ste si vybrali sami. V časti *Na čo súhlasíte* je uvedené, že rozšírenie je programový kód, ktorý beží s rovnakými právami ako aplikácia, a čo to v praxi znamená: v desktopovej aplikácii okrem iného čítanie a zapisovanie súborov kdekoľvek vo vašom používateľskom priečinku a prístup k projektom, nastaveniam a schránke; v prehliadači prístup k uloženým projektom a nastaveniam, k súborom, ku ktorým ste udelili prístup, a k sieti.

V časti *Čo toto rozšírenie uvádza, že používa* sú oprávnenia z manifestu ako krátke štítky s názvom, ako je uvedené nižšie. Je tam napísané: *Toto je vyhlásenie autora, nie obmedzenie. Kód môže aj tak robiť viac.* Ak rozšírenie nemá žiadne oprávnenia, je tam *Nič nebolo uvedené.* Dve oprávnenia dostanú vysvetlenie: *importSource* a *help*. Ostatných šesť má len svoj štítok.

Kliknutím na *Inštalovať* súhlasíte. *Neinštalovať*, Esc a kliknutie mimo okna inštaláciu odmietnu.

## Oprávnenia

**ribbon** — pridať tlačidlo na pás s nástrojmi. Účinok: rozšírenie smie pridať tlačidlo do skupiny na karte. Rozšírenie bez tohto oprávnenia dostane chybu, keď to skúsi. Tlačidlá sa zobrazia na konci zvolenej karty, pod názvom skupiny rozšírenia. Zmiznú, keď rozšírenie vypnete alebo odstránite. Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: prísne. Kde: na karte, ktorú rozšírenie zvolilo.

**events** — sledovať udalosti aplikácie a posielať vlastné udalosti. Účinok: rozšírenie sa smie prihlásiť na udalosti a odhlásiť sa z nich a smie posielať vlastné udalosti. Aplikácia sama posiela tri: projekt je načítaný (po importe, otvorení alebo načítaní rozšírením), je vytvorený prázdny projekt a plán sa (znova) prepočíta. Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: prísne. Kde: nikde; rozšírenie na udalosť len reaguje.

**backstage** — ponúknuť formát importu. Účinok: rozšírenie smie zaregistrovať importér. Ten sa objaví v *Súbor › Importovať*, kde kliknete na formát a vyberiete súbor. Vstavané formáty sú od toho oddelené (pozri [Formáty importu a exportu](docs://ref-import-exportformaten)). Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: upozornenie. Ak oprávnenie chýba, registrácia funguje ďalej, s upozornením v protokole. Je to prechodné opatrenie, lebo existujúce rozšírenia oprávnenie nie vždy uvádzajú. Kde: *Súbor › Importovať*.

**pdf-fonts** — dodať písmo pre export do PDF. Účinok: rozšírenie smie zaregistrovať poskytovateľa písiem. Export do PDF ho použije pre znaky, ktoré vstavané písma nepokrývajú, napríklad čínske, japonské a kórejské znaky. Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: prísne. Kde: v PDF zostavy; v okne inštalácie je len štítok.

**importSource** — prečítať pôvodné bajty importovaného súboru. Účinok: rozšírenie smie požiadať o úplný obsah zdrojového súboru importovaného projektu (zatiaľ len súbor Primavera). Patria sem aj polia, ktoré aplikácia do vášho projektu zámerne nepreberá, napríklad polia auditu a pôvodu, náklady, polia kontroly a polia umiestnenia. Je to oveľa širšie než zvyšok rozhrania, preto je to samostatné oprávnenie. Bez tohto oprávnenia aplikácia neprečíta ani jeden bajt zo zdrojového súboru: každá metóda potom vyhodí chybu, skôr než sa niečo načíta. Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: prísne, predvolene zamietnuté. Kde: v okne inštalácie je k nemu pridané vysvetlenie: *importSource — úplné pôvodné zdrojové bajty každého importovaného súboru (napríklad surový súbor Primavera), vrátane polí, ktoré sa do projektu nikdy nedostanú.*

**help** — pridať články pomocníka a sprievodcu. Účinok: rozšírenie smie pridávať a odoberať články pomocníka (návody), otvárať dodávaný súbor `.ifc` ako nový dokument a spúšťať a zastavovať sprievodcu, ktorý ukazuje časti aplikácie. Dodávaný projekt nikdy neprepíše dokument, v ktorom pracujete. Otvorí sa ako nový dokument, alebo prevezme len prázdnu a nezmenenú záložku. Od verzie kontraktu 1.4.0. Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: prísne. Kde: v okne *Pomocník* (články), ako nová záložka (projekt) a ako sprievodca, ktorý ukazuje na tlačidlá. V okne inštalácie je k nemu pridané vysvetlenie: *help — môže pridávať články pomocníka, otvárať dodávané projekty ako nový dokument a zobrazovať sprievodcu, ktorý ukazuje časti aplikácie.*

**filesystem** — rozšírenie uvádza, že používa súbory. Účinok: žiadny; s ničím v rozhraní to nie je spojené a aplikácia to nemôže vynútiť. Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: len informatívne. Kde: ako štítok v okne inštalácie.

**network** — rozšírenie uvádza, že používa sieť. Účinok: žiadny; ako *filesystem*. Predvolené: nie je udelené; len to, čo je v manifeste. Vynucovanie: len informatívne. Kde: ako štítok v okne inštalácie.

## Pozri aj

- [Formáty importu a exportu](docs://ref-import-exportformaten): formáty, ktoré aplikácia pozná sama, vedľa toho, čo rozšírenia pridajú pod *Súbor › Importovať*.
- [Inštalácia a správa rozšírenia](docs://howto-extensie-installeren): inštalácia, vypnutie a odstránenie rozšírenia.
