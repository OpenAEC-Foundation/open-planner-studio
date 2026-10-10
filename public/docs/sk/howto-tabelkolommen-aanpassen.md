# Úprava stĺpcov tabuľky

Cieľ: vyberte, ktoré stĺpce uvidíte v tabuľke úloh, v akom poradí a akú majú mať šírku.

## Kedy to potrebujete

Na porade chcete vidieť *Termín* a celkovú časovú rezervu pri každej úlohe. Stavbyvedúci chce vedľa názvu vidieť iba začiatok a dokončenie. Alebo je stĺpec taký úzky, že jeho hlavička je orezaná. Tabuľka úloh sa skladá zo stĺpcov, ktoré si vyberiete sami. Je ich desiatky, od *Názov úlohy* a *Trvanie* až po *Termín*, *Voľná časová rezerva* a *Priradené zdroje*.

Existujú dve tabuľky úloh, každá s vlastnými stĺpcami:

- **Tabuľka úloh vedľa diagramu Gantt** je naľavo od časovej osi na kartách, medzi inými *Domov*, *Plán* a *Zobrazenie*. Predvolene obsahuje *WBS*, *Názov úlohy* a *Trvanie*, aby zostalo miesto pre časovú os.
- **tabuľka na karte Tabuľka** zaberá celý pracovný priestor. Predvolene obsahuje *WBS*, *Názov úlohy*, *Trvanie*, *Začiatok*, *Dokončenie*, *Typ úlohy*, *Kritická*, *Celková časová rezerva* a *Postup*. Pridá sa k tomu stĺpec pre každý kód aktivity a každé vlastné pole projektu.

Zmena jednej tabuľky nemení druhú.

## Kroky

### Pridanie stĺpca

1. Kliknite na znamienko plus (**+**) vpravo od hlavičky tabuľky. Na karte *Tabuľka* môžete použiť aj *Tabuľka › Stĺpce › Stĺpce…*. Otvorí sa okno *Vybrať stĺpec*.
2. Nájdite stĺpec. Hore je *Naposledy použité*, ak ste už stĺpce vyberali. Zadajte časť názvu do poľa *Hľadať*, napríklad *Term* pre *Termín*. Alebo otvorte kategóriu: *Úloha*, *Plán*, *Obmedzenia*, *Závislosti*, *Zdroje*, *Postup*, *Vypočítané*, *Pôvodný plán*, *Vlastné* alebo *Technické*.
3. Kliknite na stĺpec. Pridá sa na posledné miesto v tabuľke a okno sa zavrie.

Stĺpec, ktorý už v tabuľke je, je šedý a nedá sa vybrať.

### Odstránenie stĺpca

Kliknite na znamienko mínus v hlavičke stĺpca (*Odstrániť: Termín*). Alebo kliknite pravým tlačidlom myši na hlavičku a vyberte *Odstrániť: Termín*. Stĺpec získate späť pomocou Ctrl+Z, alebo ho znova vyberiete pomocou plusu.

### Úprava šírky

Presuňte okraj vpravo od hlavičky stĺpca doľava alebo doprava. Dvakrát kliknite na tento okraj alebo vyberte *Prispôsobiť* v ponuke hlavičky (pravým tlačidlom myši). Tým sa stĺpec rozšíri tak, aby sa do neho zmestil obsah, najviac do 480 pixelov. Ak má okraj zameranie, šípky stĺpec rozšíria alebo zúžia po krokoch.

### Pripnutie stĺpcov

Kliknite pravým tlačidlom myši na hlavičku a vyberte *Pripnúť*. Pripnuté stĺpce sa presunú na začiatok a pri vodorovnom posúvaní zostanú vľavo. Funguje to, pokiaľ nie sú spolu širšie ako okno. *Odopnúť* ich vráti späť medzi ostatné stĺpce.

### Zmena poradia

Presuňte hlavičku stĺpca na iné miesto. Pripnutý stĺpec presúvate len medzi pripnuté stĺpce, bežný stĺpec len medzi bežné stĺpce.

### Návrat k predvolenému stavu

Otvorte okno *Vybrať stĺpec* a dole kliknite na *Obnoviť predvolené*. Tlačidlo je šedé, ak sú stĺpce už predvolené. Pre tabuľku na karte *Tabuľka* sa pridá aj stĺpec pre každý kód aktivity a každé vlastné pole projektu, aj keď ste ich predtým odstránili. Tieto stĺpce patria k projektu, v ktorom je daný kód alebo pole. O týchto kódoch a poliach si môžete prečítať v článku [Kódy a vlastné polia](docs://howto-codes-en-velden).

## Úskalia a čo robí aplikácia

**Hlavička je orezaná.** Úzky stĺpec orezáva svoj názov, napríklad *Celková časová rezerva* na *Celk…*. Dvakrát kliknite na okraj hlavičky, aby sa stĺpec prispôsobil.

**Upravujete zlú tabuľku.** Stĺpce tabuľky úloh vedľa diagramu Gantt a stĺpce na karte *Tabuľka* sú oddelené. Ak ste na karte *Zobrazenie* alebo *Domov*, upravujete tabuľku vedľa diagramu Gantt. Plus na karte *Tabuľka* upravuje veľkú tabuľku.

**Rozloženie vráti stĺpce späť.** Ak má rozloženie zaškrtnutú časť *Stĺpce*, kliknutie na tlačidlo rozloženia vráti stĺpce tabuľky úloh vedľa diagramu Gantt do uloženého stavu. Tabuľka na karte *Tabuľka* zostane nedotknutá. Pozrite si [Vytvorenie a použitie rozloženia](docs://howto-layouts-gebruiken).

**Stĺpce sú vo vašom zariadení, nie v projekte.** Aplikácia uchováva váš výber stĺpcov pre všetky vaše projekty na tomto zariadení. Do súboru projektu ho neukladá. Projekt ani neoznačí ako „zmenený“. Každú zmenu stĺpcov môžete vrátiť pomocou *Vrátiť späť* (Ctrl+Z). Kroky sa volajú napríklad *Pridať stĺpec Termín* a *Zmeniť šírku stĺpca Názov úlohy*.

## Pozri aj

- [Vytvorenie a použitie rozloženia](docs://howto-layouts-gebruiken): umiestnenie stĺpcov na tlačidlo spolu s filtrom alebo zoradením.
- [Kódy a vlastné polia](docs://howto-codes-en-velden): vytvorenie vlastných stĺpcov, ktoré tu môžete vybrať.
- [Stĺpce tabuľky](docs://ref-tabelkolommen): všetky stĺpce a to, čo zobrazujú.
