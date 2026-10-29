# Výber alebo vytvorenie profilu výpočtu

Cieľ: rozhodnite, ktoré pravidlá výpočtu projekt používa. Vyberiete vstavaný profil alebo vytvoríte vlastný profil, v ktorom si pravidlá výpočtu nastavíte sami.

## Kedy to potrebujete

Otvoríte projekt, ktorý sa musí počítať ako Primavera P6 alebo Microsoft Project, alebo chcete jedno pravidlo výpočtu nastaviť inak, ako ho nastavuje profil. Čo je profil a prečo sa dátumy môžu posunúť, je v [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen).

## Kroky

### Výber profilu pre nový projekt

1. Vyberte *Domov › Súbor › Nová*. Otvorí sa okno *Nový projekt*.
2. V rozbaľovacom zozname *Profil výpočtu* vyberte profil: *Open Planner Studio*, *Primavera P6* alebo *Microsoft Project*.
3. Vytvorte projekt. Aplikácia nahradí už vyplnené možnosti výpočtu. Použije predvolené hodnoty profilu.

### Zmena profilu existujúceho projektu

1. Vyberte *Nastavenia › Projekt › Nastavenia projektu*. Môžete tiež vybrať *Súbor › Nastavenia projektu*.
2. V bloku *Profil výpočtu a možnosti výpočtu* otvorte rozbaľovací zoznam *Profil výpočtu* a vyberte iný profil.
3. Kliknite na **Použiť**. Aplikácia okamžite prepočíta plán, aj keď je *Automatický prepočet* vypnutý. Ak sa úlohy posunuli, aplikácia oznámi, koľko ich bolo.

Kým nekliknete na *Použiť*, zmena existuje iba vo formulári. Celé prepnutie je jeden krok, ktorý vrátite príkazom *Vrátiť späť*. Prepnutie mení iba pravidlá výpočtu; vaše možnosti výpočtu zostanú nezmenené.

### Vytvorenie vlastného profilu

1. V bloku *Profil výpočtu a možnosti výpočtu* kliknite na *Nový profil* vedľa rozbaľovacieho zoznamu.
2. Zadajte názov. Aplikácia navrhne názov *Kópia z* zvoleného profilu, napríklad *Kópia z Open Planner Studio*.
3. Kliknite na *Vytvoriť*. Časť *Pravidlá výpočtu tohto profilu* sa rozbalí.
4. Zapnite alebo vypnite pravidlá výpočtu pomocou začiarkavacích políčok. Ikona i za riadkom zobrazí vysvetlenie daného pravidla výpočtu. Pravidlo výpočtu, ktoré sa líši od základu, dostane označenie *Späť na základ*.
5. Kliknite na **Použiť**. Až potom projekt počíta s novým profilom.

Tri vstavané profily sa nedajú zmeniť. Ich pravidlá výpočtu sa zobrazujú iba na informáciu.

### Uchovanie vlastného profilu ako šablóny

1. Ak je to potrebné, zadajte vlastnému profilu iný názov do poľa *Názov tohto vlastného profilu*.
2. Kliknite na *Uložiť ako šablónu*. Aplikácia oznámi, že šablóna bola uložená, alebo prečo sa to nepodarilo.
3. V inom projekte v tej istej aplikácii je šablóna v rozbaľovacom zozname *Profil výpočtu*.

Ak sa profil neskôr líši od šablóny, žltý blok to oznámi. Potom vyberte *Aktualizovať šablónu z tohto projektu* alebo *Aktualizovať zo šablóny*.

Šablónu odstránite príkazom *Odstrániť šablónu*. Aplikácia najprv požiada o potvrdenie.

## Kontrola výsledku

- Blok *Profil výpočtu a možnosti výpočtu* zobrazuje zvolený profil.
- Po kliknutí na *Použiť* aplikácia oznámi posunuté úlohy, napríklad *Po použití boli posunuté 4 úlohy.*
- Oranžový blok nad možnosťami výpočtu hovorí, že vaše možnosti výpočtu sa líšia od predvoleného nastavenia profilu. To je často zámer. Ak chcete aj tak predvolené nastavenia, kliknite na *Použiť predvolené nastavenia …*.

## Úskalia a správanie aplikácie

**Dátumy sa posunú.** Iný profil môže zmeniť dátumy v pláne. Skontrolujte výsledok. Ak sa vám nepáči, vyberte *Vrátiť späť*: profil aj dátumy sa vrátia spolu.

**Žltý blok po príkaze Vrátiť späť.** Ak stlačíte *Vrátiť späť* alebo *Vykonať znova*, keď je otvorené okno nastavení projektu, blok sleduje stav projektu. Ak ste v bloku už niečo zmenili sami, vaša voľba zostane. Žltý blok potom oznámi, že *Použiť* túto voľbu obnoví.

**Môže existovať najviac 100 šablón.** Ak ich je už 100, aplikácia šablónu neuloží a oznámi to. Najprv odstráňte jednu šablónu. Plné alebo chýbajúce úložisko aplikácie tiež zobrazí hlásenie.

**Šablóny patria aplikácii a profil patrí projektu.** Projekt má vždy vlastnú kópiu profilu. Ak šablónu neskôr zmeníte, projekt sa s ňou nezmení.

**Nastavenia zo zdrojového súboru.** Ak vyberiete *Primavera P6* alebo *Microsoft Project* pre projekt, ktorý pochádza z iného súboru, nastavenia zo zdrojového súboru zostanú. Tu ich nemôžete zmeniť.

## Pozri aj

- [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen): čo je profil a čo robí s dátumami.
- [Možnosti výpočtu a pravidlá výpočtu](docs://ref-rekenopties-en-conventies): všetky pravidlá výpočtu a možnosti výpočtu na jednom mieste.
- [Výber režimu postupu](docs://howto-voortgangsmodus-kiezen): Retained Logic alebo Progress Override, oddelene od profilu.
