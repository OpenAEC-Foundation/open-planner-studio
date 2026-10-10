# Zotavenie zo zlyhania

Cieľ: získať späť svoju prácu po neočakávanom zastavení aplikácie alebo prehliadača, keď ste ešte neuložili.

## Kedy to potrebujete

Notebook sa vypol, aplikácia zamrzla alebo karta prehliadača spadla a vy ste ešte neuložili posledné zmeny. Hneď ako nastane akákoľvek zmena, aplikácia v pozadí uchováva záložné kópie všetkých otvorených projektov, najviac raz za desať sekúnd. Táto kópia je oddelená od súboru projektu. Rozdiel oproti ukladaniu a automatickému ukladaniu si prečítate v článku [Súbory a formáty](docs://uitleg-bestanden).

## Kroky

1. Spustite aplikáciu znova. V prehliadači znovu načítajte tú istú kartu: záložná kópia patrí len k tejto jednej karte.
2. Ak aplikácia našla kópie, objaví sa okno *Obnoviť neuloženú prácu*: *Open Planner Studio sa neukončil správne. Nasledujúce dokumenty mali neuložené zmeny, ktoré je možné obnoviť:* Pri každom projekte zobrazí názov, cestu k súboru, ak má projekt súbor (v prehliadači len názov súboru), počet úloh a čas kópie, napríklad *21 úloh* a *Uložené: 29. sep 2026, 9:41 dopoludnia*. Okno môže zobrazovať aj projekty, ktoré ste nezmenili.
3. Vyberte *Obnoviť*. Aplikácia otvorí všetky projekty v zozname, každý na karte, so stavom poslednej kópie. Enter urobí to isté.
4. Skontrolujte svoje projekty a hneď ich uložte pomocou Ctrl+S.

Ak nechcete obnoviť, máte dve možnosti. *Neobnovovať* odstráni kópie a túto akciu nemožno vrátiť späť. Ak okno zavriete klávesom Escape, krížikom alebo kliknutím vedľa okna, kópie zostanú a aplikácia sa pri ďalšom spustení opýta znova.

Otáznik vpravo hore v okne otvorí tento článok bez toho, aby ste niečo zvolili. Kým čítate v Nápovede, okno čaká. Keď sa vrátite, okno je tam znova a stále môžete obnoviť.

## Úskalia a čo aplikácia vtedy urobí

**Dostanete stav poslednej kópie.** Čo ste urobili v posledných sekundách pred pádom, môže chýbať. Projekt, ktorý mal zmeny, sa znova označí ako *Neuložené*. História *Vrátiť späť* je prázdna: kroky pred pádom nemôžete vrátiť. Priblíženie, pozícia posúvania a výber sa znova vytvoria.

**Na počítači obnovený projekt si ponechá svoj súbor, v prehliadači nie.** Na počítači *Uložiť* zapíše do pôvodného súboru, s obnoveným stavom. V prehliadači obnovený projekt už nie je prepojený so svojím súborom: *Uložiť* sa spýta, kam má súbor uložiť. Prepínač *Automatické ukladanie* je vtedy tiež sivý, kým projekt neuložíte aspoň raz.

**Projekt v zobrazení *Dátumy tak, ako boli zaznamenané* zostane v tomto zobrazení.** Pozri [Dátumy tak, ako boli zaznamenané](docs://uitleg-datums-zoals-opgeslagen).

**Na počítači sa okno po každom spustení neobjaví.** Záložné kópie sú v dátovom priečinku aplikácie, ako súbory IFC s názvom, ktorý začína na *recovery*. Ak aplikáciu zatvoríte bežným spôsobom, sama vymaže svoje kópie. Okno sa preto objaví po neočakávanom ukončení, po reštarte kvôli aktualizácii aplikácie alebo ak ste obnovenie pri predchádzajúcom spustení odložili.

**V prehliadači je kópia uložená pre každú kartu.** Kópia je v úložisku prehliadača. Nová karta alebo nové okno neponúkne kópie inej karty. Kópie kariet, ktoré už neexistujú, sa vymažú po siedmich dňoch, hneď ako aplikácia zapíše kópie znova.

**V prehliadači sa okno objaví aj po bežnom znovunačítaní stránky.** To sa stane aj vtedy, keď ste všetko uložili. Ak ste pred znovunačítaním stránky uložili a potom ste nič nezmenili, môžete bez obáv zvoliť *Neobnovovať*: váš súbor je aktuálny.

**Okno sa neobjaví.** Potom aplikácia nenašla žiadnu kópiu. To sa stane, ak ste ešte nič nezmenili, ak používate novú kartu v prehliadači, ak ste kópie skôr zahodili voľbou *Neobnovovať*, alebo ak zlyhanie prišlo skôr, než aplikácia uložila prvú kópiu: to môže trvať až približne desať sekúnd po vašej prvej zmene.

**Kópia je poškodená.** Aplikácia zobrazí *Obnovený súbor sa nepodarilo prečítať* s dôvodom a ponúkne ostatné projekty. Ak zvolíte *Obnoviť*, aplikácia potom vymaže všetky kópie, vrátane nečitateľnej. Ak sa nedá prečítať žiadna kópia, okno sa neobjaví a kópie zostanú.

**Obnovenie zlyhá.** Aplikácia zobrazí *Obnovenie zlyhalo* s dôvodom. Kópie zostanú a otázka sa vráti pri ďalšom spustení.

**Niektoré projekty sa nedajú načítať.** Aplikácia zobrazí: *2 súbory na obnovenie sa nepodarilo načítať a boli preskočené.* Pri jednom súbore zobrazí: *1 súbor na obnovenie sa nepodarilo načítať a bol preskočený.* Ostatné projekty sa obnovia. Pretože niečo bolo preskočené, všetky kópie zostanú a okno sa pri ďalšom spustení vráti s rovnakým zoznamom. Potom zvoľte *Neobnovovať*, ak ste už získali späť všetko, čo sa dalo získať.

## Pozri tiež

- [Súbory a formáty](docs://uitleg-bestanden): ukladanie, automatické ukladanie a zotavenie zo zlyhania vedľa seba.
- [Zapnutie automatického ukladania](docs://howto-automatisch-opslaan): nechajte aplikáciu aktualizovať súbor samu.
- [Otvorenie a uloženie súboru](docs://howto-bestand-openen-en-opslaan): ukladanie po obnovení.
- [Dátumy tak, ako boli zaznamenané](docs://uitleg-datums-zoals-opgeslagen): čo sa stane s projektom v tomto zobrazení.
