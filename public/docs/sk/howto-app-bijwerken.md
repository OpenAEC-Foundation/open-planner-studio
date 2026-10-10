# Aktualizácia aplikácie

Cieľ: zistiť, či máte najnovšiu verziu, aktualizovať aplikáciu a prečítať si, čo sa zmenilo vo verzii.

## Kedy to potrebujete

Nová verzia Open Planner Studio vychádza pravidelne. Chcete vedieť, či ju už máte, napríklad pred tým, ako nahlásite chybu, alebo keď rozšírenie vyžaduje novšiu verziu. Alebo ste práve aktualizovali a chcete vidieť, čo sa zmenilo.

Aktualizácia funguje len v desktopovej aplikácii. Verzia v prehliadači nemá aktualizátor.

## Postup

### Aktualizácia, keď aplikácia oznámi novú verziu

1. Spustite desktopovú aplikáciu. Pri spustení aplikácia na pozadí kontroluje, či je k dispozícii nová verzia. Ak nová verzia nie je alebo kontrola zlyhá, napríklad bez internetového pripojenia, nič nezbadáte.
2. Ak je k dispozícii nová verzia, otvorí sa okno *Aktualizácia softvéru*. Zobrazuje položky *Aktuálna verzia* a *Nová verzia*, správu *Je k dispozícii nová verzia* a text, ktorý patrí k aktualizácii, pod položkou *Čo je nové*.
3. Uložte otvorené projekty.
4. Kliknite na *Stiahnuť a nainštalovať*. Ukazovateľ priebehu zobrazí *Sťahuje sa…* a potom nasleduje inštalácia. Okno nemôžete zavrieť, kým sa sťahuje.
5. Počkajte, kým sa aplikácia sama reštartuje. Potom máte novú verziu.

Tesne predtým, ako sa aktualizácia nainštaluje, aplikácia tiež vytvorí záložnú kópiu rozpracovaných údajov na zotavenie zo zlyhania. Pozrite si [Zotavenie po páde aplikácie](docs://howto-herstellen-na-een-crash).

### Sami skontrolujte, či je k dispozícii nová verzia

1. Vyberte *Nastavenia › Projekt › Nastavenia*. Môžete tiež vybrať *Súbor › Nastavenia*, alebo ozubené koliesko v hornej časti.
2. Vyberte kartu *Rozšírené*. Pod položkou *Verzia* je číslo vašej aktuálnej verzie.
3. Kliknite na *Skontrolovať aktualizácie*. Otvorí sa okno *Aktualizácia softvéru* a zobrazí *Kontroluje sa…*. Potom sa zobrazí buď *Používate najnovšiu verziu*, alebo správa, že je k dispozícii nová verzia, s rovnakým tlačidlom *Stiahnuť a nainštalovať*.

V prehliadači toto tlačidlo nerobí nič osobitné: okno hneď zobrazí *Používate najnovšiu verziu*, bez toho aby aplikácia niečo kontrolovala.

### Čo je v novej verzii

1. Ak desktopovú aplikáciu spustíte prvýkrát v inej verzii, ako naposledy, alebo po čerstvej inštalácii, okno sa otvorí samo. Okno sa volá *Máte najnovšiu verziu!*
2. Hore je zmena z predchádzajúcej verzie na novú. Po čerstvej inštalácii sa zobrazí len nová verzia.
3. Ak má aplikácia pre túto verziu zabudovaný súhrn, uvidíte jeden hlavný bod a štyri menšie body. Hlavný bod môže mať tlačidlo *Prečítať sprievodcu*. Inak uvidíte len zmenu verzie a to, čo je pod ňou.
4. Tlačidlom *Zobraziť úplné poznámky k vydaniu* otvoríte zoznam zmien na GitHub. Ak to nefunguje, zobrazí sa *Poznámky k vydaniu sa nepodarilo otvoriť.*
5. Pod položkou *Táto aktualizácia v číslach* je počet dní od predchádzajúceho vydania, počet commitov a počet pridaných riadkov kódu. Ak aplikácia dokáže zistiť rozdiel vo veľkosti inštalačného balíka, zobrazí sa aj ten. Každý údaj sa zobrazí len vtedy, ak je k dispozícii.
6. Kliknite na *Potvrdiť*, aby sa okno zavrelo.

Ak chcete toto okno neskôr zobraziť znova, vyberte *Nastavenia › Projekt › Nastavenia*, kartu *Rozšírené* a tlačidlo *Zobraziť novinky* pod položkou *Verzia*. Okno sa potom otvorí pre vašu aktuálnu verziu, bez predchádzajúcej verzie.

## Problémy a čo aplikácia potom urobí

**Aktualizácia zlyhá.** Okno zobrazí *Pri aktualizácii sa niečo pokazilo*, pod tým technický dôvod a tlačidlo *Skúsiť znova*.

**Aplikáciu ste nainštalovali ako balík .deb a inštalácia zlyhá.** Okno vysvetlí: *Aktualizujte ručne spustením tohto príkazu v termináli alebo si stiahnite najnovší balík.* Pod položkou *Inštalačný príkaz* je samotný príkaz s tlačidlom *Kopírovať príkaz* (potom sa zobrazí *Skopírované*). Tlačidlom *Otvoriť stránku na stiahnutie* prejdete na sťahovaciu stránku najnovšej verzie.

**Aplikáciu máte z Snap Store.** Aplikácia sa potom sama neaktualizuje a ani pri spustení nekontroluje. Snap Store to robí za ňu. V okne sa zobrazí *Táto verzia sa aktualizuje automaticky cez Snap Store. Nemusíte nič robiť.*

**Pri spustení sa nič nezobrazí.** To je normálne, ak už máte najnovšiu verziu. Kontrola pri spustení nehlási chyby. Ak chcete mať istotu, že ste aktuálni, skontrolujte to sami, ako je uvedené vyššie.

## Pozrite tiež

- [Odoslanie spätnej väzby](docs://howto-feedback-geven): nahláste chybu v najnovšej verzii.
