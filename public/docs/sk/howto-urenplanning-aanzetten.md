# Zapnutie plánovania v hodinách

Cieľ: plánovať úlohy v pracovnej dobe spolu s úlohami v dňoch.

## Kedy to potrebujete

Žeriav si prenajímate po hodinách, nie po dňoch. Betónovanie v trvaní šesť hodín sa nevojde do celého pracovného dňa. Nočná čata pracuje v iných časoch ako denná čata. Pri takej práci chcete trvanie v hodinách a začiatok a dokončenie s časom dňa. Zapnete to aj vtedy, ak otvoríte súbor a aplikácia zobrazí *Tento súbor obsahuje plánovanie v hodinách*. Prečo aplikácia počíta dni a hodiny inak, si môžete prečítať v článku [Dni a hodiny](docs://uitleg-dagen-en-uren).

## Postup

### Povolenie plánovania v hodinách

1. Vyberte *Nastavenia › Projekt › Nastavenia* a otvorte kartu *Plán*.
2. Pod položkou *Plánovanie v hodinách* zaškrtnite *Zapnúť plánovanie v hodinách*. Funguje to hneď. V hlásení *Tento súbor obsahuje plánovanie v hodinách* robí to isté tlačidlo *Zapnúť plánovanie v hodinách*.
3. Pod ňou je *Povoliť zmiešané plánovanie dní/hodín*, predvolene zapnuté. S týmto nastavením vyberiete pri každej úlohe, či sa počíta v dňoch alebo v hodinách. Ak ho vypnete, zoznam *Jednotka trvania* zmizne. Trvanie s jednotkou, napríklad `12h`, môžete zadať aj potom.

Zapnutie mení viac než trvanie úlohy. Na karte *Zobrazenie* môžete v zozname *Časová škála* zvoliť mierku *Hodina*. Okno *Kalendáre* dostane blok *Pracovná doba* a okno *Nový projekt* dostane možnosti *Pracovná zmena* a *Predvolená jednotka pre nové úlohy*.

### Plánovanie úlohy v hodinách

1. Vyberte úlohu. V paneli *Vlastnosti* pozrite pod nadpisom *Čas* na pole *Trvanie*.
2. Zadajte trvanie s jednotkou a stlačte Enter: `12h` (`12u`, holandská skratka, funguje tiež) na dvanásť hodín, `1h 30m` na hodinu a pol. Funguje aj `1.5h`. Číslo bez jednotky sa počíta v jednotke, ktorú úloha už má.
3. Ak chcete previesť existujúcu úlohu, vyberte jednotku *Hodiny* v zozname *Jednotka trvania*. Aplikácia trvanie za vás vypočíta a navrhne ho, napríklad *Presný návrh prevodu: 16h. Použite tento návrh alebo ponechajte aktuálnu jednotku*. Vyberte *Použiť návrh* alebo *Ponechať*.
4. Späť na dni môžete prejsť zadaním `2d` alebo jednotkou *Dni*.
5. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*. Úloha má teraz začiatok a dokončenie s časom dňa.
6. Ak chcete vidieť hodiny v Gantt diagrame, vyberte mierku *Hodina* v zozname *Časová škála* na karte *Zobrazenie*.

### Nové úlohy predvolene v hodinách

1. Vyberte *Nastavenia › Projekt › Info o projekte*.
2. V zozname *Predvolená jednotka pre nové úlohy* vyberte jednotku *Hodiny* a kliknite na *Použiť*.

Nová úloha potom začína s 5 hodinami namiesto 5 dní. Existujúce úlohy sa nemenia. Pri novom projekte je rovnaká voľba v okne *Nový projekt*. Ak tam vyberiete *Denná pracovná zmena* v zozname *Pracovná zmena*, *Hodiny* sa nedajú vybrať. Vyberte inú pracovnú zmenu alebo nastavte predvolenú jednotku až po vytvorení projektu v *Info o projekte*.

## Úskalia a čo aplikácia vtedy robí

**Kalendár nemá platné pracovné časy.** Ak kalendár úlohy nemá použiteľné pracovné časy, aplikácia zobrazí *Tento kalendár nemá platné pracovné časy. Skontrolujte pracovné dni a pracovné časy*. Pri prepočítaní sa môže zobraziť hlásenie *Hodinová úloha 'name' nemá v svojom kalendári platnú pracovnú dobu*.

**Pri dňoch nie sú desatinné čísla.** Trvanie v dňoch je celé číslo. `1.5d` zobrazí hlásenie *Zadajte celé číslo dní alebo hodín, napríklad 2d alebo 12h*. Ak chcete jeden a pol dňa, počítajte v hodinách.

**Prevod, ktorý nemôže byť presný.** Dvanásť hodín sa nevojde do celých dní po 8 hodinách. Aplikácia potom zobrazí hlásenie *Toto trvanie sa na aktuálnom kalendári nedá presne previesť na celé dni. Existujúca jednotka sa zachová; zadajte novú platnú hodnotu sami* a jednotku ponechá.

**Pole je neaktívne.** Ak je úloha fáza, hamak alebo medzník s nulovým trvaním, trvanie vyplýva z niečoho iného a ručne ho nemôžete zadať.

**Opätovné vypnutie plánovania v hodinách.** Úlohy v hodinách zostávajú a stále sa počítajú. Ich trvanie sa vtedy nedá upraviť. Pole zobrazuje *Na úpravu hodinovej úlohy zapnite plánovanie v hodinách*. Zobrazí sa aj tlačidlo na opätovné zapnutie.

## Pozri aj

- [Dni a hodiny](docs://uitleg-dagen-en-uren): ako aplikácia počíta hodiny, čo sa stane, keď sa dni a hodiny stretnú, a kde zaokrúhľuje.
- [Nastavenie pracovných časov](docs://howto-werktijden-instellen): časy kalendára podľa dňa v týždni.
- [Pridávanie závislostí](docs://howto-relaties-leggen): oneskorenie v hodinách medzi dvoma úlohami.
- [Nastavenia](docs://ref-instellingen): nastavenie Zapnúť plánovanie v hodinách a čo ďalšie mení.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): obsahuje úlohy v hodinách (armovanie a betónovanie) s vlastným hodinovým kalendárom, *Hourly calendar, rebar fixing & pouring*.
