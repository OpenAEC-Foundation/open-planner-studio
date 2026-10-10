# Zapnutie automatického ukladania

Cieľ: aplikácia aktualizuje súbor vášho projektu počas práce, takže nemusíte stále stláčať Ctrl+S.

## Kedy to potrebujete

Dlho pracujete na jednom pláne alebo často zabudnete uložiť a chcete, aby súbor na disku alebo v zdieľanom priečinku ostal aktuálny. Automatické ukladanie nenahrádza zotavenie zo zlyhania: to je vždy zapnuté a funguje oddelene od tohto. Rozdiel opisuje článok [Súbory a formáty](docs://uitleg-bestanden).

## Kroky

1. Ak projekt ešte nemá súbor, najprv ho raz uložte pomocou *Domov › Súbor › Uložiť ako*. Kým projekt nemá súbor, prepínač je sivý a nápoveda hovorí: *Ak chcete použiť automatické ukladanie, najprv uložte tento projekt.*
2. V ľavom hornom rohu na lište hore kliknite na prepínač *Automatické ukladanie*. Keď je zapnutý, nápoveda hovorí: *Automatické ukladanie je zapnuté: zmeny sa zapisujú do tohto súboru.*
3. Pracujte ďalej. Hneď ako má projekt zmeny, aplikácia ich zapíše do vášho súboru bez okna, najviac raz každých desať sekúnd. Značka *Neuložené* potom sama zmizne.
4. Ak chcete prestať, kliknite na prepínač ešte raz. Nápoveda potom hovorí: *Automatické ukladanie je vypnuté. Zotavenie zo zlyhania zostáva vždy aktívne.*

Chrome a Edge najprv dovoľujú iba čítať súbor, ktorý ste otvorili. Prepínač tam nefunguje, kým raz neuložíte pomocou *Uložiť* (Ctrl+S) a prehliadač nedá povolenie na zápis. Potom ho môžete zapnúť. Vo Firefoxe zostáva prepínač sivý: aplikácia tam do vášho súboru zapisovať nemôže.

## Úskalia a čo aplikácia vtedy urobí

**Prepínač patrí jednému projektu.** Každá karta má vlastný stav. Po otvorení projektu je prepínač vždy vypnutý a aplikácia si ho na ďalší raz nepamätá.

**Automatické ukladanie zapisuje iba do súboru, ktorý projekt už má.** Ak zvolíte *Uložiť ako*, zapisuje od tej chvíle do nového súboru. Aplikácia zapisuje, iba ak sú zmeny.

**Zápis sa môže nepodariť.** Ak napríklad súbor zmizol alebo je zamknutý, zobrazí sa hlásenie *Automatické ukladanie zlyhalo* s dôvodom. Ak prehliadač nemá (alebo už nemá) povolenie na zápis, aplikácia dané kolo potichu preskočí: o povolenie nepožiada.

**Súbor dostane aj zmeny, ktoré by ste radšej nechceli.** Automatické ukladanie zapisuje stav projektu taký, aký je v danom okamihu. Ak niečo vrátite pomocou Ctrl+Z, súbor dostane aj tento vrátený stav do desiatich sekúnd. Ak chcete zachovať staršiu verziu, najprv vytvorte kópiu pomocou *Uložiť ako*.

**Aj pri páde aplikácie sa stratia posledné sekundy.** Aplikácia zapisuje najviac raz každých desať sekúnd, takže to, čo ste urobili medzitým, ešte nie je vo vašom súbore. Zotavenie zo zlyhania má rovnaké obmedzenie.

**Po obnovení v prehliadači je prepínač opäť sivý.** Projekt, ktorý v prehliadači získate späť po páde aplikácie, už nie je prepojený so svojím súborom. Uložte ho raz a prepínač znovu funguje. Pozrite si [Zotavenie zo zlyhania po páde aplikácie](docs://howto-herstellen-na-een-crash).

**Projekt z iného formátu nemá žiadny súbor.** Projekt z formátu CSV, XML, `.mpp` alebo `.xer` dostane súbor IFC až pri uložení. Potom môžete zapnúť automatické ukladanie.

## Pozrite tiež

- [Súbory a formáty](docs://uitleg-bestanden): rozdiel medzi ukladaním, automatickým ukladaním a zotavením zo zlyhania.
- [Otváranie a ukladanie súboru](docs://howto-bestand-openen-en-opslaan): ukladanie, uložiť ako a značku *Neuložené*.
- [Zotavenie zo zlyhania po páde aplikácie](docs://howto-herstellen-na-een-crash): čo aplikácia ponúkne, ak sa pred tým nezatvorila správne.
