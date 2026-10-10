# Úprava rozloženia práce

Cieľ: pri jednom priradení sami určíte, koľko zdroj pracuje každý pracovný deň úlohy, namiesto štandardnej krivky.

## Kedy to potrebujete

Krivka, napríklad *Zvonový tvar*, je pevný tvar. Niekedy viete lepšie. Murár začne na vonkajšej vrstve dutého muriva na polovičný výkon, lebo sa ešte montuje lešenie. Potom pracuje na plný úväzok. Alebo chcete, aby špička zostala tesne pod kapacitou. Potom upravíte **rozloženie práce**.

Pracujete s **fázami**: po sebe idúce pracovné dni, v ktorých zdroj pracuje s rovnakými jednotkami priradenia. Rozloženie mení len hodiny za deň pri tomto jednom priradení. Dátumy úlohy sa nemenia.

## Postup

Príklad je vonkajšia vrstva dutého muriva: 6 pracovných dní, jeden murár, 48 hodín.

1. Vyberte úlohu. Panel *Vlastnosti* je vpravo. Ak ho nevidíte, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. V bloku *Priradenia* kliknite na ikonu stĺpcového grafu *Upraviť rozloženie práce…* vedľa murára. Otvorí sa okno *Rozloženie hodín do fáz*. Začínate od toho, čo aplikácia teraz rezervuje. Pre túto vonkajšiu vrstvu muriva je to jedna fáza na 6 dní s jednotkami priradenia 1.
3. Ak treba, vyberte východisko v poli *Použiť tvar:*. Pri voľbe *Zvonový tvar* aplikácia vytvorí päť fáz: 0,18 jednotky priradenia na prvý a posledný deň, 0,84 na druhý a piaty deň a 1,98 na dva stredné dni. Súčet zostáva 48 hodín.

### Úprava fáz

Môžete upravovať v tabuľke alebo v páse nad ňou.

- Zadajte inú *Jednotky priradenia (jedn./deň)* vo fáze. Stĺpce *Hodiny/deň* a *Hodiny* sa počítajú automaticky.
- Zmeňte počet *Dni* fázy. Posledná fáza vždy trvá do konca úlohy a dostane zostávajúce dni.
- Vyberte *Rozdeliť*, ak chcete fázu rozdeliť na dve, napríklad 6 dní na 3 a 3. Vyberte *Zlúčiť*, ak chcete fázu zlúčiť s ďalšou.
- V páse potiahnete hranicu, ak chcete fázu predĺžiť alebo skrátiť. Horný okraj potiahnete, ak chcete nastaviť výkon. Dvojitým kliknutím na deň rozdelíte fázu.

### Použitie zmien

Vyberte *Použiť*. Tlačidlom *Zrušiť* sa okno zavrie bez zmeny.

Príklad. Vyberte *Rozdeliť*, nastavte *Dni* prvej fázy na 2 a výkon tejto fázy na 0,5. Druhá fáza potom trvá 4 dni s výkonom 1. Súčet je 2 × 0,5 × 8 + 4 × 1 × 8 = 40 hodín.

Po kliknutí na *Použiť* sa krivka priradenia nastaví na *Rozvrh práce* a je neaktívna. *Jedn./deň* zostane, ako bola. Histogram a preťaženie sa okamžite riadia novým rozložením práce. Prepočítanie nie je potrebné, lebo žiadny dátum sa nepresúva.

### Uvoľnenie rozloženia práce

Ak má priradenie vlastné rozloženie, okno má aj *Uvoľniť rozloženie práce*. Tým sa odstráni vaše vlastné rozloženie a aplikácia sa vráti k *Jedn./deň* a ku krivke. Túto voľbu zvoľte aj vtedy, ak chcete zmeniť krivku, lebo rozbaľovací zoznam *Krivka* je neaktívny, pokiaľ existuje vlastné rozloženie.

## Úskalia a čo aplikácia potom urobí

**Súčet sa mení spolu s tým.** Hodiny nerozdeľujete. Sami ich určíte. Ak nastavíte fázu na 0,5 namiesto 0,18, súčet bude väčší. Súčet v hodinách je dole v okne. Pred kliknutím na *Použiť* ho skontrolujte.

**Čo jednotky urobia potom, závisí od pravidla práce.** Pri pravidle *Pevné trvanie a jednotky priradenia* iná hodnota *Jedn./deň* nezmení rozloženie. Pri pravidle *Pevné trvanie a práca* aplikácia upraví hodiny za deň podľa nových jednotiek: pri jednotkách 2 namiesto 1 sa každý deň zdvojnásobí a zdvojnásobí sa aj súčet (z 32 na 64 hodín). Trvanie zostane rovnaké. Pri pravidle *Pevná práca* jednotky menia trvanie úlohy: rozloženie sa stlačí alebo natiahne na nové trvanie, s rovnakým súčtom. Pri pravidle *Pevné jednotky priradenia* jednotky menia aj trvanie. Potom skontrolujte súčet dole v okne.

**Ak zmeníte trvanie úlohy, rozloženie sa natiahne spolu s ním.** Tvar zostane rovnaký. Pri pravidle *Pevné trvanie a jednotky priradenia* a pri pravidle *Pevné jednotky priradenia* sa súčet zväčší úmerne k trvaniu. Ak sa trvanie úlohy s vlastným rozložením zdvojnásobí zo 4 na 8 pracovných dní, zdvojnásobí sa aj súčet, z 32 na 64 hodín. Pri pravidle *Pevné trvanie a práca* a pri pravidle *Pevná práca* zostane súčet rovnaký (32 hodín zostane 32 hodín) a jednotky klesnú.

**Práca sa riadi rozložením.** *Práca (zostáva)* sa stane súčtom vašich fáz, aj pri pravidle *Pevná práca*. Trvanie úlohy sa kvôli tomu nemení.

**Neplatné jednotky.** Prázdny alebo záporný výkon dostane červený okraj. Tlačidlo *Použiť* sa potom zablokuje. Fáza s výkonom 0 je povolená. Takáto fáza zostane v trvaní úlohy.

**Všetko platí pre toto jedno priradenie.** Aplikácia to hovorí sama: *Rozloženie mení len hodiny za deň tohto priradenia; dátumy úloh a rozdelenia zostávajú nezmenené.* Iné zdroje pri tej istej úlohe si zachovajú vlastné rozloženie.

**Vyvažovanie sa riadi rozložením.** Vyvažovanie počíta rovnaké hodiny za deň ako histogram.

**Vrátenie späť.** *Použiť* a *Uvoľniť rozloženie práce* sa každé dajú vrátiť ako jeden krok príkazom *Vrátiť späť* (Ctrl+Z).

## Pozri tiež

- [Priradenie zdrojov s krivkou](docs://howto-resource-toewijzen): priradenie zdroja k úlohe a výber krivky.
- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): čo urobiť, keď má zdroj na jeden deň príliš veľa práce.
