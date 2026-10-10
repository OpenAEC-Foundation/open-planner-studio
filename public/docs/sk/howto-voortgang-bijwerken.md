# Aktualizácia postupu

Cieľ: zapísať skutočný stav práce do plánu a prepočítať plán: ktoré úlohy sú hotové, ktoré bežia a koľko práce ešte zostáva.

## Kedy to potrebujete

Postup aktualizujete v pevne stanovených termínoch, napríklad každý piatok, keď stavbyvedúci nahlási stav. Plán tak vidí, čo sa skutočne stalo, a zostávajúcu prácu vypočíta od dátumu kontroly stavu. Prečo to aplikácia robí takto, je vysvetlené v článku [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang).

## Kroky

### 1. Nastavte dátum kontroly stavu

Dátum kontroly stavu je deň, ku ktorému zhodnotíte stav. Nastavte ho skôr, ako zadáte postup.

1. Prejdite na *Plán › Smerné plány a postup › Dátum kontroly stavu*.
2. Zadajte dátum do troch polí pre deň, mesiac a rok (v poradí, v akom píšete dátumy), napríklad 28, 06 a 2027, a stlačte Enter. Aplikácia prejde do ďalšieho poľa sama.
3. Malým krížikom vedľa poľa vymažete dátum kontroly stavu.

Ak stav kontrolujete v piatok po skončení pracovnej doby, nastavte dátum kontroly stavu na najbližší pracovný deň, na pondelok. Aplikácia naplánuje zostávajúcu prácu od začiatku dátumu kontroly stavu.

Ak zadáte postup, keď ešte nie je nastavený dátum kontroly stavu, aplikácia ho nastaví na dnešok a oznámi: *Dátum stavu ešte nebol nastavený: teraz je nastavený na dnešok (…), pretože postup sa meria do dátumu stavu. Zmeniť ho môžete na karte Plán → Dátum stavu.* Radšej to preto urobte najprv sami.

### 2. Zadajte postup

Vyberte spôsob, ktorý vám vyhovuje. Všetky dávajú rovnaký výsledok.

**Jedna úloha v paneli vlastností.** Hodí sa, keď aktualizujete jednu úlohu.

1. Kliknite na úlohu. Ak nevidíte panel *Vlastnosti*, zapnite ho cez *Zobrazenie › Panely › Vlastnosti*.
2. Potiahnite posúvač *Postup (%)* na percento, ktoré je hotové.
3. Ak treba, vyplňte *Skutočný začiatok* a *Skutočné dokončenie* rovnakým spôsobom ako dátum kontroly stavu. Aplikácia pole *Zostáva* vypočíta sama; tu ho nemôžete zmeniť.

Medzník má jedno pole, *Skutočný dátum*.

**Výber percenta v ponuke.** Hodí sa na rýchly stav.

1. Kliknite pravým tlačidlom na pruh úlohy v diagrame Gantt.
2. Vyberte *Postup* a potom 0%, 25%, 50%, 75% alebo 100%.

**Viac úloh v tabuľke úloh.** Hodí sa, keď aktualizujete celý zoznam.

1. Kliknite na **+** vpravo v záhlaví tabuľky úloh (*Pridať stĺpec*) a otvorte kategóriu *Postup*. Pridajte stĺpce *Skutočný začiatok*, *Skutočné dokončenie*, *Zostáva* a *Stav*. Stĺpec *Postup* je už na karte *Tabuľka*.
2. Dvakrát kliknite na bunku, zadajte hodnotu a stlačte Enter. Percento zadajte ako `50` alebo `50%`, dátum ako `25-06-2027` a zostávajúce trvanie ako `1`.
3. V stĺpci *Stav* po dvojitom kliknutí stlačte Enter a vyberte *Nezačaté*, *Prebieha* alebo *Dokončené*.

Ak zadáte zostávajúce trvanie, aplikácia spätne vypočíta percento: pri úlohe s trvaním 2 pracovné dni zvyšok 1 znamená 50%. Zvyšok 0 úlohu dokončí. Ak v stĺpci *Stav* vyberiete *Nezačaté*, percento klesne na 0% a skutočné dátumy zmiznú.

**Všetko o jednej úlohe v okne úpravy úlohy.** Kliknite pravým tlačidlom na úlohu a vyberte *Upraviť...*. Polia postupu sú tam tiež. Platia až po kliknutí na *Uložiť*.

**Viac úloh naraz z tabuľkového hárka.** Pozrite si [Import postupu z tabuľkového hárka](docs://howto-voortgang-importeren).

### 3. Prepočítajte plán

Každá zmena postupu alebo dátumu kontroly stavu urobí plán zastaralým: stavový riadok ukáže *Zastaralé — prepočítajte (F5)*. Stlačte **Prepočítať** (F5), napríklad cez *Plán › Plán › Prepočítať*. Ak je *Automatický prepočet* zapnutý (v *Nastavenia › Projekt › Nastavenia*, karta *Plán*), aplikácia to urobí sama.

## Kontrola výsledku

- Na dátume kontroly stavu diagram Gantt zobrazí prerušovanú čiaru s dátumom v záhlaví. Pri bežiacich úlohách sa čiara vyklenie k percentu v pruhu. Tieto čiary zapínate alebo vypínate pomocou *Zobrazenie › Smerné plány a postup › Čiara postupu* a *Čiara dátumu kontroly stavu*.
- Dokončené úlohy nikdy nie sú červené: pri dátume kontroly stavu dokončená úloha nie je kritická.
- Fázy zobrazujú odvodené percento a dátum dokončenia plánu sa mohol posunúť.
- Ak ste uložili pôvodný plán, pod každým pruhom je pôvodný plán a typ zostavy *Odchýlky* zobrazuje odchýlku.

## Úskalia a čo aplikácia robí

**Dátum neskorší ako dátum kontroly stavu.** Aplikácia neprijme skutočný začiatok ani skutočné dokončenie neskorší ako dátum kontroly stavu. V paneli je pod poľami text *Skutočné hodnoty nemôžu byť po dátume kontroly stavu*; v tabuľke bunka hlási *Skutočný dátum je neskorší ako dátum kontroly stavu.* Najprv nastavte dátum kontroly stavu neskôr, alebo opravte dátum.

**Úloha, ktorá by mala začať až po dátume kontroly stavu.** Ak zadáte postup úlohy, ktorá podľa plánu ešte nemala začať, otvorí sa okno *Zadajte skutočný začiatok*. Pýta sa, kedy sa úloha skutočne začala; návrh je dátum kontroly stavu. Tlačidlom *Použiť postup* ho zaznamenáte, tlačidlom *Zrušiť* sa nič nezmení.

**100% bez dátumov.** Ak úlohu nastavíte na 100% bez skutočného dokončenia, skutočné dokončenie sa stane dátumom kontroly stavu, aj keď bola úloha dokončená skôr. Potom skutočné dokončenie vyplňte sami.

**Percento nižšie ako 100%.** Ak dokončenú úlohu nastavíte späť pod 100%, skutočné dokončenie sa zruší. Ak vymažete iba skutočné dokončenie, percento klesne na 0% a úloha zostane v stave *Prebieha*. Ak chcete, aby úloha opäť platila ako nezačatá, vymažte aj skutočný začiatok, alebo v tabuľke v stĺpci *Stav* vyberte *Nezačaté*.

**Zmena trvania bežiacej úlohy.** Hotová práca zostane hotová a percento sa prispôsobí. Úloha s trvaním 5 pracovných dní pri 60% sa po nastavení na 10 pracovných dní dostane na 30%. Aplikácia neprijme trvanie kratšie ako práca, ktorá už bola vykonaná: *Úloha „Build inner cavity leaf“ je už hotová na 60 %: trvanie kratšie ako už vykonaná práca nie je možné. Trvanie nebolo zmenené.* V tabuľke bunka hlási *Toto trvanie je kratšie ako práca, ktorá už bola vykonaná.*

**Zostávajúce trvanie sa zaokrúhľuje.** Aplikácia zaokrúhli zostávajúce trvanie na celé pracovné dni. Pri úlohe s trvaním 2 pracovné dni dávajú 50% aj 75% zvyšok 1 pracovný deň.

**Fáza.** Fáza nemá vlastný postup. V paneli je text *Odvodené z čiastkových úloh: postup tam zmeňte. Súhrnná úloha sa aktualizuje po prepočítaní (F5).* V tabuľke bunka hlási *Postup súhrnnej úlohy sa odvodzuje z jej čiastkových úloh a tu sa nedá zmeniť.*

**Dátum kontroly stavu posúvate neskôr.** Zostávajúca práca bežiacich úloh začína na novom dátume kontroly stavu a práca, ktorá ešte nezačala, nemôže ležať pred týmto dátumom. Preto ho posúvajte len spolu s aktualizáciou postupu. Ak nastavíte dátum kontroly stavu bez zadania postupu, všetka práca, ktorá ešte nezačala, sa presunie na tento dátum (okrem profilu Microsoft Project).

**Omyl.** Každú zmenu postupu vrátite jedným krokom pomocou Ctrl+Z.

## Pozri tiež

- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): ako aplikácia vypočíta zostávajúcu prácu a dátum kontroly stavu, s príkladom.
- [Import postupu z tabuľkového hárka](docs://howto-voortgang-importeren): načítanie postupu pre viac úloh naraz.
- [Výber režimu postupu](docs://howto-voortgangsmodus-kiezen): čo aplikácia urobí s úlohou, ktorá sa začala, kým jej predchádzajúca úloha ešte beží.
- [Uloženie a správa pôvodného plánu](docs://howto-baseline-opslaan-en-beheren): zápis pôvodného plánu, s ktorým sa porovnáva postup.
