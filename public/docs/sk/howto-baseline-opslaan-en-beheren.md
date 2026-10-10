# Uloženie a správa pôvodného plánu

Cieľ: zaznamenať plán ako dohodu (pôvodný plán), aby ste neskôr videli, ako ďaleko sa realizácia odchyľuje. Ďalej môžete uchovávať, premenovať, vyberať a odstraňovať viac pôvodných plánov.

## Kedy to potrebujete

Pôvodný plán zaznamenávate vtedy, keď je plán schválený a realizácia sa ešte nezačala. Ak neskôr formálne revidujete plán, napríklad po zmenovom príkaze, uložíte druhý pôvodný plán a prvý ponecháte. Vďaka tomu merate realizáciu voči prvej dohode aj voči revidovanej. Presne, čo pôvodný plán zaznamenáva a ako aplikácia počíta odchýlku, je vysvetlené v [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang).

## Kroky

### Uloženie pôvodného plánu

1. Stlačte **Prepočítať** (F5), napríklad cez *Plán › Plán › Prepočítať*. Pôvodný plán zaznamená dátumy, ktoré sa v tom okamihu vypočítajú.
2. Vyberte *Plán › Smerné plány a postup › Spravovať pôvodné plány…*. Otvorí sa okno *Pôvodné plány*.
3. V časti *Uložiť nový pôvodný plán* je navrhnutý názov, napríklad *Pôvodný plán 1 — (dnešný dátum)*. Zadajte vlastný názov, podľa ktorého ho neskôr spoznáte, napríklad *Pôvodný plán*.
4. Kliknite na *Uložiť*. Pôvodný plán je teraz v zozname a hneď je aktívny pôvodný plán.
5. Kliknite na *Zavrieť*.

Pod každým pruhom úlohy v diagrame Gantt je teraz tenký pruh s dátumami pôvodného plánu. Medzník dostane malý kosoštvorec. Prekrytie zapnete alebo vypnete cez *Zobrazenie › Smerné plány a postup › Prekrytie smerného plánu*.

### Výber aktívneho pôvodného plánu

Otvorte *Spravovať pôvodné plány…* a vyberte v stĺpci *Aktívny* pôvodný plán, s ktorým chcete porovnávať. Pokiaľ existujú pôvodné plány, presne jeden je aktívny. Prekrytie v diagrame Gantt, typ zostavy *Odchýlky* a *Zostava postupu* ho používajú.

### Premenovanie pôvodného plánu

Zmeňte názov v zozname. Zmena sa uplatní hneď; kliknúť na *Uložiť* nemusíte.

### Odstránenie pôvodného plánu

Kliknite na malý kôš na odpadky vedľa pôvodného plánu v zozname. Ak odstránite aktívny pôvodný plán, aplikácia sa spýta *Odstrániť aktívny pôvodný plán?*. Potom sa aktívnym stane najnovší zvyšný pôvodný plán. Ak iný neexistuje, aktívny pôvodný plán už nie je a prekrytie zmizne. Stlačením Ctrl+Z obnovíte odstránený pôvodný plán.

### Odchýlky v tabuľke úloh

Každý pôvodný plán má šesť stĺpcov v tabuľke úloh. Kliknite na **+** vpravo v hlavičke tabuľky úloh (*Pridať stĺpec*) a otvorte kategóriu *Pôvodný plán*. Pre každý pôvodný plán sú k dispozícii *Plánovaný začiatok*, *Plánované dokončenie*, *Trvanie*, *Odchýlka začiatku*, *Odchýlka dokončenia* a *Odchýlka v trvaní*. Pred každým z nich je názov pôvodného plánu, napríklad *Pôvodný plán — Odchýlka dokončenia*. Odchýlky sú v pracovných dňoch: plus znamená neskôr, mínus skôr. Úloha, ktorá nie je v pôvodnom pláne, zobrazí v týchto stĺpcoch pomlčku (—).

## Časté problémy a čo aplikácia robí

**Zastaraný plán.** Ak je plán zastaraný, okno zobrazí *Plán je zastaraný — najprv ho prepočítajte (F5)*. Ide o upozornenie; uloženie zostáva možné. Uložíte však staré dátumy. Zavrite okno, stlačte **Prepočítať** a až potom uložte.

**Pôvodný plán s postupom.** Ak uložíte pôvodný plán až po zadaní postupu, zaznamená stav so skutočnými dátumami. Odchýlka je potom nulová a už nič nevypovedá o realizácii. Pôvodný plán zaznamenajte pred začiatkom realizácie.

**Pôvodný plán sa nedá aktualizovať.** Ak chcete dohodu upraviť, uložte nový pôvodný plán a podľa potreby odstráňte starý.

**Len úlohy bez čiastkových úloh.** Fáza nie je v pôvodnom pláne: nemá pruh pôvodného plánu ani odchýlku. Fáza sa odvodzuje od úloh pod ňou.

**Nové a odstránené úlohy.** Úloha, ktorú pridáte po uložení, nemá pruh pôvodného plánu. V zostave odchýlok sa zobrazí ako *Nová*. Úloha, ktorú odstránite, sa zobrazí ako *Vypustená*.

**Presunúť projekt.** V okne *Presunúť projekt…* je, len čo existujú pôvodné plány, začiarkavacie políčko *Posunúť aj pôvodné plány*. Predvolená hodnota je vypnutá: pôvodné plány zostanú na mieste, takže posun sa zobrazí ako odchýlka. Pozri [Presun projektu](docs://howto-project-verplaatsen).

**Uložené v súbore projektu.** Pôvodné plány a výber aktívneho pôvodného plánu sa uložia spolu s projektom. Pri otvorení súboru sa vrátia.

## Pozri aj

- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): čo pôvodný plán zaznamenáva a ako sa počíta odchýlka.
- [Presun projektu](docs://howto-project-verplaatsen): začiarkavacie políčko *Posunúť aj pôvodné plány*.
- [Aktualizácia postupu](docs://howto-voortgang-bijwerken): zadanie skutočného stavu, ktorý porovnávate s pôvodným plánom.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): jeden pôvodný plán (*Baseline at start*) pred začiatkom, s postupom a dátumom kontroly stavu 20. mája 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dva pôvodné plány, *Contract* a *Re-baseline (variation order)*, s postupom a dátumom kontroly stavu 5. júla 2027.
