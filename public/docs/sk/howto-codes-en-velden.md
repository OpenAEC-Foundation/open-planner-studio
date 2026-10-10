# Kódy a vlastné polia

Cieľ: priradiť k svojim úlohám vlastné klasifikácie (kódy aktivít, napríklad *Umiestnenie*) a vlastné polia (napríklad *Dodávateľ*).

## Kedy to potrebujete

Okrem pevných údajov úlohy (názov, trvanie, závislosti, …) môžete pridať vlastné údaje. Ak chcete úlohy klasifikovať podľa severného a južného krídla, podľa disciplíny, alebo chcete sledovať, ktorý dodávateľ vykonáva úlohu, zapíšete to sami. Existujú dva spôsoby a rozdiel je dôležitý.

**Kód aktivity** je klasifikácia s pevným zoznamom na výber. Vytvoríte **typ kódu** (napríklad *Umiestnenie*) s **hodnotami** (*N* pre severné krídlo, *Z* pre južné krídlo). Úloha dostane najviac jednu hodnotu pre každý typ kódu.

**Vlastné pole** (v okne, v časti *Vlastné polia*) je voľné vstupné pole s typom: *Text*, *Číslo*, *Celé číslo*, *Náklad*, *Dátum* alebo *Áno/nie*. Pole môže mať na každej úlohe inú hodnotu.

## Postup

### Definovanie kódov a polí

1. Vyberte *Plán › Štruktúra › Kódy a polia*.
2. **Vytvorenie typu kódu.** V poli *Nový typ kódu (napr. Umiestnenie)* zadajte názov a stlačte Enter, alebo kliknite na *Pridať typ kódu*.
3. **Pridanie hodnôt.** Pod typom kódu kliknite na *Pridať hodnotu*. Aplikácia tam vloží predbežný kód, napríklad *V1*. Zmeňte ho v poli *Kód* (krátky, ako ho napíšete: *N*). Podľa potreby vyplňte pole *Popis* (*Severné krídlo*) a v poli *Farba* vyberte farbu. Zmena platí hneď, ako opustíte pole alebo stlačíte Enter.
4. **Vytvorenie vlastného poľa.** V poli *Nové pole (napr. Dodávateľ)* zadajte názov, vyberte typ a kliknite na *Pridať pole* (alebo stlačte Enter).

Okno nemá tlačidlo OK: každá zmena platí hneď. Typ poľa potom nemôžete zmeniť. Môžete zmeniť len jeho názov. Ak chcete iný typ, vytvorte nové pole.

### Vyplnenie kódu alebo poľa pri úlohe

Máte dve miesta.

- **V paneli *Vlastnosti*** (alebo v okne, ktoré otvoríte klávesom F2). Dole je blok *Kódy a polia*: zoznam na výber pre každý typ kódu a vstupné pole pre každé pole. Blok sa zobrazí, až keď existuje aspoň jeden typ kódu alebo pole.
- **Ako stĺpec v tabuľke úloh.** Kliknite na **+** vpravo od hlavičky tabuľky (*Pridať stĺpec*) a v časti *Vlastné* vyberte typ kódu alebo pole. V bunke typu kódu zadajte kód, napríklad `N`, alebo ho vyberte zo zoznamu. Kód, ktorý neexistuje, zobrazí hlásenie *Vyberte hodnotu z tohto kódu aktivity.*

### Používanie

Typ kódu alebo vlastné pole môžete použiť na filtrovanie, zoskupovanie a radenie. Nastavíte to pomocou rozloženia: *Zobrazenie › Rozloženie › Nové rozloženie*. V okne označte časti, ktoré chcete zachytiť. Ak kliknete na *Uložiť*, získate tlačidlo v *Zobrazenie › Rozloženie*, na ktoré môžete neskôr znovu kliknúť. Ak kliknete na *Použiť bez uloženia*, zobrazíte ho len teraz na obrazovke. Pri zoskupovaní sú úlohy bez hodnoty v skupine *(žiadne)*.

Pri farbe pruhov vyberte *Zobrazenie › Smerné plány a postup › Farby pruhov*, potom *Podľa kategórie* a typ kódu. Každý pruh potom dostane farbu z poľa *Farba* svojej hodnoty.

## Úskalia a čo robí aplikácia

**Odstránenie odstráni hodnoty na úlohách.** Ak odstránite typ kódu, hodnotu alebo pole pomocou koša, aplikácia nepýta potvrdenie. Priradenia na všetkých úlohách zmiznú spolu s nimi. Zoskupenie alebo radenie podľa tohto typu kódu alebo poľa tiež prestane platiť. *Vrátiť späť* (Ctrl+Z) obnoví typ kódu, hodnotu alebo pole aj vyplnené hodnoty. Zoskupenie ani radenie neobnoví: tie nastavte znovu.

**Dve hodnoty s rovnakým kódom.** *Pridať hodnotu* pokračuje v číslovaní od počtu hodnôt, ktoré existujú. Ak jednu odstránite a potom pridáte novú, kód sa môže vyskytnúť dvakrát. Ak do bunky stĺpca zadáte tento kód, aplikácia to odmietne s hlásením *Táto hodnota kódu aktivity sa vyskytuje viackrát. Vyberte ju zo zoznamu.* Každej hodnote dajte vlastný kód.

**Šablóny nezahŕňajú kódy a polia.** Pozrite si [Ukladanie a vkladanie šablón WBS](docs://howto-wbs-sjablonen). Ak vložíte úlohy do iného dokumentu, aplikácia vymaže kódy a polia, ktoré tam neexistujú, a oznámi vám to.

**Pole typu dátum sa nepresúva.** Ak presuniete celý projekt, vyplnené vlastné polia typu *Dátum* zostanú na svojom dátume. Aplikácia na to upozorní v náhľade.

## Pozri tiež

- [Úprava štruktúry](docs://howto-structuur-aanpassen): strom WBS, druhý spôsob, ako usporiadať úlohy.
- [Presun projektu](docs://howto-project-verplaatsen): čo sa stane s dátumami, keď presuniete projekt.
- [Vytvorenie a používanie rozloženia](docs://howto-layouts-gebruiken): zoskupovanie a filtrovanie podľa kódu alebo vlastného poľa.
- [Úprava stĺpcov tabuľky](docs://howto-tabelkolommen-aanpassen): zobrazenie kódu alebo vlastného poľa ako stĺpca.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): kódy aktivít *House* a *Discipline*, vlastné pole *Cost estimate* a poznámky (otvorené aj dokončené).
